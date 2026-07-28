begin;

-- Ordinary workspace saves happen for sales, stock, expenses, branch switches,
-- and realtime reconciliation. They must never be able to replace tenant
-- settings as a side effect. Only save_current_tenant_settings marks an update
-- as an explicit settings write.
create or replace function private.preserve_tenant_settings_on_workspace_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_explicit_tenant text := nullif(
    current_setting('app.jasper_explicit_settings_tenant', true),
    ''
  );
begin
  if v_explicit_tenant is distinct from new.tenant_id::text then
    new.payload := jsonb_set(
      coalesce(new.payload, '{}'::jsonb),
      '{settings}',
      coalesce(old.payload -> 'settings', '{}'::jsonb),
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_tenant_settings_on_workspace_update
  on public.tenant_workspaces;
create trigger preserve_tenant_settings_on_workspace_update
before update on public.tenant_workspaces
for each row
execute function private.preserve_tenant_settings_on_workspace_update();

create or replace function public.save_current_tenant_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch_id uuid;
  v_saved_settings jsonb;
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

  insert into public.tenant_workspaces (
    tenant_id,
    payload,
    updated_at,
    updated_by
  )
  values (
    v_tenant_id,
    jsonb_build_object('settings', p_settings),
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

  -- Keep the legacy settings row aligned for older clients and recovery tools.
  insert into public.tenant_data (
    tenant_id,
    data_key,
    payload,
    updated_at
  )
  values (
    v_tenant_id::text,
    'settings',
    p_settings,
    v_updated_at
  )
  on conflict (tenant_id, data_key) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at;

  select workspace.payload -> 'settings'
  into v_saved_settings
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id;

  return jsonb_build_object(
    'settings', v_saved_settings,
    'updatedAt', v_updated_at
  );
end;
$$;

revoke all on function
  private.preserve_tenant_settings_on_workspace_update()
  from public;
revoke all on function
  public.save_current_tenant_settings(jsonb)
  from public, anon;
grant execute on function
  public.save_current_tenant_settings(jsonb)
  to authenticated;

commit;
