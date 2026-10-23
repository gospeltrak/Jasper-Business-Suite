-- Same lost-update-race family as the sales/purchases/deliveries/expenses
-- fixes, for Settings. save_current_tenant_settings replaced the whole
-- `settings` object with whatever the client sent -- two sessions editing
-- DIFFERENT sections (e.g. Business Info vs Tax) within the realtime
-- protection window (Dashboard.tsx's LOCAL_WORKSPACE_PROTECTION_MS) could
-- have one session's edit silently discarded by the other's save.
--
-- Settings has no stable per-record id (it's one object, not an array), but
-- the client already stamps every leaf path with its own update time
-- (settingsSync, written by stampSettingsForSync in settingsSync.ts) for
-- exactly this purpose -- mergeSettingsForSync already does this merge
-- client-side, but only against local React state, which can be stale
-- relative to another session's just-committed write. private.merge_settings_by_path
-- moves the same algorithm server-side (kept as its own pure function so it
-- can be tested directly, same pattern as private.merge_branch_json_array_by_id),
-- under save_current_tenant_settings's row lock, so it sees the truly
-- current remote settings at write time: for every leaf path known to
-- either side's settingsSync map, the side with the newer timestamp wins
-- (incoming wins ties or when a path has no prior timestamp on either
-- side, mirroring mergeSettingsForSync's `incomingTime >= currentTime`
-- exactly). Base is the existing settings; incoming values are layered on
-- top of it, creating any missing intermediate containers first (jsonb_set
-- does not create missing *intermediate* path segments on its own).

begin;

create or replace function private.merge_settings_by_path(
  p_existing jsonb,
  p_incoming jsonb,
  p_updated_at timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_existing_sync jsonb;
  v_incoming_sync jsonb;
  v_merged jsonb;
  v_merged_sync jsonb;
  v_path text;
  v_path_arr text[];
  v_partial_path text[];
  v_existing_time timestamptz;
  v_incoming_time timestamptz;
  v_existing_value jsonb;
  v_incoming_value jsonb;
  v_i int;
begin
  p_existing := coalesce(p_existing, '{}'::jsonb);
  p_incoming := coalesce(p_incoming, '{}'::jsonb);
  v_existing_sync := coalesce(p_existing -> 'settingsSync', '{}'::jsonb);
  v_incoming_sync := coalesce(p_incoming -> 'settingsSync', '{}'::jsonb);

  -- Base = existing settings; incoming values are layered on top per path
  -- below, so any leaf path neither side has ever stamped (new fields added
  -- after this code was deployed, not yet exercised by either the existing
  -- row or this request) simply keeps whichever object already had it.
  v_merged := p_existing;
  v_merged_sync := v_existing_sync;

  for v_path in
    select key from jsonb_object_keys(v_existing_sync) as key
    union
    select key from jsonb_object_keys(v_incoming_sync) as key
  loop
    v_incoming_time := coalesce(nullif(v_incoming_sync ->> v_path, '')::timestamptz, '-infinity'::timestamptz);
    v_existing_time := coalesce(nullif(v_existing_sync ->> v_path, '')::timestamptz, '-infinity'::timestamptz);
    v_path_arr := string_to_array(v_path, '.');
    v_incoming_value := p_incoming #> v_path_arr;
    v_existing_value := p_existing #> v_path_arr;

    if v_incoming_value is not null
      and (v_existing_value is null or v_incoming_time >= v_existing_time)
    then
      -- jsonb_set only auto-creates the final path segment -- make sure
      -- every intermediate container exists first, or the whole call is a
      -- silent no-op (e.g. a brand-new tenant's first save, where v_merged
      -- starts as '{}' and has no "business" key yet).
      if array_length(v_path_arr, 1) > 1 then
        for v_i in 1..(array_length(v_path_arr, 1) - 1) loop
          v_partial_path := v_path_arr[1:v_i];
          if jsonb_typeof(v_merged #> v_partial_path) is distinct from 'object' then
            v_merged := jsonb_set(v_merged, v_partial_path, '{}'::jsonb, true);
          end if;
        end loop;
      end if;
      v_merged := jsonb_set(v_merged, v_path_arr, v_incoming_value, true);
      v_merged_sync := jsonb_set(
        v_merged_sync, array[v_path],
        to_jsonb(coalesce(nullif(v_incoming_sync ->> v_path, ''), p_updated_at::text)),
        true
      );
    end if;
  end loop;

  return jsonb_set(v_merged, '{settingsSync}', v_merged_sync, true);
end;
$$;

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

  select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;

  v_merged_settings := private.merge_settings_by_path(
    coalesce(v_existing -> 'settings', '{}'::jsonb),
    p_settings,
    v_updated_at
  );

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
    v_merged_settings,
    v_updated_at
  )
  on conflict (tenant_id, data_key) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'settings', v_merged_settings,
    'updatedAt', v_updated_at
  );
end;
$$;

revoke all on function public.save_current_tenant_settings(jsonb) from public, anon;
grant execute on function public.save_current_tenant_settings(jsonb) to authenticated;

commit;
