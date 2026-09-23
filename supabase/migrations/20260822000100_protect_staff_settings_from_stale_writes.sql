-- Prevent an older browser/tab settings snapshot from deleting newly saved
-- staff or role records. The client stamps these arrays in settingsSync; this
-- RPC now enforces those clocks atomically in Postgres.

begin;

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
  v_existing_settings jsonb := '{}'::jsonb;
  v_effective_settings jsonb := p_settings;
  v_saved_settings jsonb;
  v_protected_key text;
  v_existing_sync text;
  v_incoming_sync text;
  v_updated_at timestamptz := statement_timestamp();
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' or p_settings = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'A non-empty settings object is required.';
  end if;

  if not private.is_tenant_branch_administrator(v_tenant_id) then
    v_context := public.get_current_branch_context();
    v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;
    if v_branch_id is null
      or not private.can_write_branch(v_tenant_id, v_branch_id, 'settings.write')
    then
      raise exception using errcode = '42501', message = 'Settings write permission is required.';
    end if;
  end if;

  -- Serialize settings writers for this tenant before comparing field clocks.
  select coalesce(workspace.payload -> 'settings', '{}'::jsonb)
  into v_existing_settings
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;

  v_existing_settings := coalesce(v_existing_settings, '{}'::jsonb);

  foreach v_protected_key in array array['staffs', 'customRoles'] loop
    if v_existing_settings ? v_protected_key
      and (v_existing_settings -> v_protected_key)
        is distinct from (p_settings -> v_protected_key)
    then
      v_existing_sync := v_existing_settings #>> array['settingsSync', v_protected_key];
      v_incoming_sync := p_settings #>> array['settingsSync', v_protected_key];

      -- Intentional edits from current clients carry a newer field clock.
      -- Missing, equal, or older clocks identify partial/stale snapshots.
      if not (p_settings ? v_protected_key)
        or v_incoming_sync is null
        or (v_existing_sync is not null and v_incoming_sync <= v_existing_sync)
      then
        v_effective_settings := jsonb_set(
          v_effective_settings,
          array[v_protected_key],
          v_existing_settings -> v_protected_key,
          true
        );
        if v_existing_sync is not null then
          v_effective_settings := jsonb_set(
            v_effective_settings,
            array['settingsSync', v_protected_key],
            to_jsonb(v_existing_sync),
            true
          );
        end if;
      end if;
    end if;
  end loop;

  perform set_config('app.jasper_explicit_settings_tenant', v_tenant_id::text, true);

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('settings', v_effective_settings),
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

  insert into public.tenant_data (tenant_id, data_key, payload, updated_at)
  values (v_tenant_id::text, 'settings', v_effective_settings, v_updated_at)
  on conflict (tenant_id, data_key) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at;

  select workspace.payload -> 'settings'
  into v_saved_settings
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id;

  return jsonb_build_object('settings', v_saved_settings, 'updatedAt', v_updated_at);
end;
$$;

revoke all on function public.save_current_tenant_settings(jsonb) from public, anon;
grant execute on function public.save_current_tenant_settings(jsonb) to authenticated;

commit;
