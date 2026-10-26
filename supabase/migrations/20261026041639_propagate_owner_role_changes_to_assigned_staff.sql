CREATE OR REPLACE FUNCTION public.save_current_tenant_settings(p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch_id uuid;
  v_existing jsonb;
  v_merged_settings jsonb;
  v_updated_at timestamptz := statement_timestamp();
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'An active tenant account is required.';
  end if;
  if p_settings is null
    or jsonb_typeof(p_settings) <> 'object'
    or p_settings = '{}'::jsonb
  then
    raise exception using
      errcode = '22023',
      message = 'A non-empty settings object is required.';
  end if;

  if not private.is_tenant_branch_administrator(v_tenant_id) then
    v_context := public.get_current_branch_context();
    v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;
    if v_branch_id is null
      or not private.can_write_branch(
        v_tenant_id,
        v_branch_id,
        'settings.write'
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Settings write permission is required.';
    end if;
  end if;

  perform set_config(
    'app.jasper_explicit_settings_tenant',
    v_tenant_id::text,
    true
  );

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array[]::text[]);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;

  v_merged_settings := private.merge_settings_by_path(
    coalesce(v_existing -> 'settings', '{}'::jsonb),
    p_settings,
    v_updated_at
  );

  if not private.is_tenant_branch_administrator(v_tenant_id)
    and (v_merged_settings->'customRoles') is distinct from (v_existing->'settings'->'customRoles') then
    raise exception using errcode='42501', message='Only the business owner may change staff roles.';
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_set(coalesce(v_existing, '{}'::jsonb), '{settings}', v_merged_settings, true));
  else
  insert into public.tenant_workspaces (
    tenant_id,
    payload,
    updated_at,
    updated_by
  )
  values (
    v_tenant_id,
    jsonb_set(coalesce(v_existing, '{}'::jsonb), '{settings}', v_merged_settings, true),
    v_updated_at,
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        coalesce(public.tenant_workspaces.payload, '{}'::jsonb),
        '{settings}',
        excluded.payload -> 'settings',
        true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  insert into public.tenant_data (
    tenant_id,
    data_key,
    payload,
    updated_at
  )
  values (
    v_tenant_id::text,
    'settings',
    v_merged_settings,
    v_updated_at
  )
  on conflict (tenant_id, data_key) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at;

  -- Staff provisioning copies the selected role preset into each user profile.
  -- Owner changes must update every assigned profile, including older stale copies.
  if p_settings ? 'customRoles' then
    update public.users u set role_permissions = new_role.item->'permissions',
      role_key = new_role.item->>'name'
    from jsonb_array_elements(coalesce(v_existing->'settings'->'customRoles','[]'::jsonb)) old_role(item)
    join jsonb_array_elements(coalesce(v_merged_settings->'customRoles','[]'::jsonb)) new_role(item)
      on new_role.item->>'id'=old_role.item->>'id'
    where u.tenant_id=v_tenant_id and u.is_active
      and lower(coalesce(u.role_key,u.role))=lower(old_role.item->>'name')
      and old_role.item is distinct from new_role.item;
  end if;

  return jsonb_build_object(
    'settings', v_merged_settings,
    'updatedAt', v_updated_at
  );
end;
$function$


