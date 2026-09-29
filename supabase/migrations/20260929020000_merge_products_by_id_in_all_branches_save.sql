-- Live data-loss bug report: a tenant owner said products they added kept
-- "disappearing", unrelated to branch scoping (confirmed via direct query --
-- the products were present, correctly branch-tagged, right up until some
-- later save silently dropped them again).
--
-- Root cause: in the 'all_branches' (tenant admin/owner consolidated view)
-- path of save_current_branch_workspace, every key including 'products' is
-- a BLIND REPLACE with whatever the client currently has locally
-- (`v_next := p_workspace`), protected only by (a) a full-wipe-to-zero
-- guard and (b) a >50% shrink warning that does not block the save. Any
-- smaller staleness in the client's local product list -- for example from
-- two tabs/devices editing the same tenant, or a background reload racing
-- an in-flight edit -- gets silently written back as the new source of
-- truth, permanently deleting whatever products were missing from that one
-- stale snapshot, with no warning at all.
--
-- The 'branch' (single-branch) scope already avoids this exact failure mode
-- for products specifically, via private.merge_workspace_products_by_id
-- (an ID-based merge: existing products are kept and updated, never
-- dropped just because a given save's snapshot didn't include them).
-- This migration gives the 'all_branches' scope that same protection,
-- closing the one path that still had it.

begin;

create or replace function public.save_current_branch_workspace(p_workspace jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean := false;
  v_key_include_unassigned boolean;
  v_existing jsonb;
  v_existing_scoped jsonb;
  v_next jsonb;
  v_existing_settings jsonb;
  v_incoming_settings jsonb;
  v_effective_settings jsonb;
  v_next_settings jsonb;
  v_key text;
  v_permission_key text;
  v_protected_key text;
  v_existing_sync text;
  v_incoming_sync text;
  v_existing_count integer;
  v_incoming_count integer;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_workspace is null or jsonb_typeof(p_workspace) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid workspace object is required.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);

  v_existing_settings := coalesce(v_existing -> 'settings', '{}'::jsonb);
  v_incoming_settings := coalesce(p_workspace -> 'settings', '{}'::jsonb);
  v_effective_settings := v_incoming_settings;
  foreach v_protected_key in array array['staffs', 'customRoles'] loop
    if v_existing_settings ? v_protected_key
      and (v_existing_settings -> v_protected_key)
        is distinct from (v_incoming_settings -> v_protected_key)
    then
      v_existing_sync := v_existing_settings #>> array['settingsSync', v_protected_key];
      v_incoming_sync := v_incoming_settings #>> array['settingsSync', v_protected_key];
      if not (v_incoming_settings ? v_protected_key)
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

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
    and private.is_tenant_branch_administrator(v_tenant_id)
  then
    v_next := p_workspace;
    foreach v_key in array array[
      'sales', 'expenses', 'deliveries', 'pendingDeliveryNotes', 'purchases'
    ]
    loop
      v_existing_count := jsonb_array_length(coalesce(v_existing -> v_key, '[]'::jsonb));
      v_incoming_count := jsonb_array_length(coalesce(p_workspace -> v_key, '[]'::jsonb));
      if v_existing_count > 0 and v_incoming_count = 0 then
        v_next := jsonb_set(v_next, array[v_key], v_existing -> v_key, true);
      elsif v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=%s existing=%s incoming=%s',
          v_tenant_id, v_key, v_existing_count, v_incoming_count
        );
      end if;
    end loop;
    -- Products get the same ID-based safe merge the single-branch scope
    -- already uses below, instead of the blind-replace-with-shrink-warning
    -- treatment the other ledger keys above still get: a stale local
    -- snapshot from one tab/device can never again delete a product just
    -- by omitting it from a save.
    v_next := jsonb_set(
      v_next,
      '{products}',
      private.merge_workspace_products_by_id(
        v_existing -> 'products',
        p_workspace -> 'products'
      ),
      true
    );
    v_next := v_next || jsonb_build_object('settings', v_effective_settings);
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
    end if;

    v_existing_scoped := coalesce(
      public.get_current_branch_workspace() -> 'payload',
      '{}'::jsonb
    );
    if not private.is_tenant_branch_administrator(v_tenant_id) then
      if v_scope = 'compatibility_primary' then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;

      foreach v_key in array array[
        'products', 'sales', 'expenses', 'deliveries',
        'pendingDeliveryNotes', 'purchases', 'branchStocks',
        'branchStaffAssignments'
      ]
      loop
        v_permission_key := case v_key
          when 'products' then 'products.write'
          when 'sales' then 'pos.write'
          when 'expenses' then 'expenses.write'
          when 'deliveries' then 'deliveries.write'
          when 'pendingDeliveryNotes' then 'deliveries.write'
          when 'purchases' then 'products.write'
          when 'branchStocks' then 'products.write'
          when 'branchStaffAssignments' then 'branches.manage'
        end;
        if coalesce(p_workspace -> v_key, '[]'::jsonb)
          is distinct from coalesce(v_existing_scoped -> v_key, '[]'::jsonb)
          and not private.can_write_branch(v_tenant_id, v_branch_id, v_permission_key)
        then
          raise exception using
            errcode = '42501',
            message = format('Write permission is required for %s.', v_key);
        end if;
      end loop;

      if coalesce(p_workspace -> 'settings', '{}'::jsonb)
        is distinct from coalesce(v_existing_scoped -> 'settings', '{}'::jsonb)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'settings.write')
      then
        raise exception using
          errcode = '42501',
          message = 'Settings write permission is required.';
      end if;
    end if;

    v_next := v_existing;
    foreach v_key in array array[
      'sales', 'expenses', 'deliveries', 'pendingDeliveryNotes', 'purchases',
      'branchStocks', 'branchStaffAssignments'
    ]
    loop
      v_key_include_unassigned := case when v_key in ('branchStocks', 'branchStaffAssignments') then false else v_include_unassigned end;

      if v_key in ('sales', 'expenses', 'deliveries', 'pendingDeliveryNotes', 'purchases') then
        v_existing_count := jsonb_array_length(private.filter_branch_json_array(v_existing -> v_key, v_branch_id, v_key_include_unassigned));
        v_incoming_count := jsonb_array_length(private.filter_branch_json_array(p_workspace -> v_key, v_branch_id, v_key_include_unassigned));
        if v_existing_count > 0 and v_incoming_count = 0 then
          continue;
        elsif v_existing_count > 0 and v_incoming_count > 0
          and v_incoming_count < (v_existing_count * 0.5)
        then
          raise warning using message = format(
            'Suspicious branch ledger shrink: tenant=%s branch=%s key=%s existing=%s incoming=%s',
            v_tenant_id, v_branch_id, v_key, v_existing_count, v_incoming_count
          );
        end if;
      end if;

      v_next := jsonb_set(
        v_next,
        array[v_key],
        private.replace_branch_json_array(
          v_existing -> v_key,
          p_workspace -> v_key,
          v_branch_id,
          v_key_include_unassigned
        ),
        true
      );
    end loop;

    v_next := jsonb_set(
      v_next,
      '{products}',
      private.merge_workspace_products_by_id(
        v_existing -> 'products',
        p_workspace -> 'products'
      ),
      true
    );

    if private.is_tenant_branch_administrator(v_tenant_id) then
      v_next_settings := v_effective_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_effective_settings -> 'staffs',
          v_branch_id,
          v_include_unassigned
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_effective_settings -> 'paymentChannels',
          v_branch_id,
          v_include_unassigned
        )
      );
    else
      v_next_settings := v_existing_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_effective_settings -> 'staffs',
          v_branch_id,
          false
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_effective_settings -> 'paymentChannels',
          v_branch_id,
          false
        )
      );
    end if;
    v_next := jsonb_set(v_next, '{settings}', v_next_settings, true);

    v_next := v_next || jsonb_build_object(
      'productTombstones',
      coalesce(v_existing -> 'productTombstones', '{}'::jsonb)
        || coalesce(p_workspace -> 'productTombstones', '{}'::jsonb),
      'saleTombstones',
      coalesce(v_existing -> 'saleTombstones', '{}'::jsonb)
        || coalesce(p_workspace -> 'saleTombstones', '{}'::jsonb)
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return public.get_current_branch_workspace();
end;
$$;

revoke all on function public.save_current_branch_workspace(jsonb) from public, anon;
grant execute on function public.save_current_branch_workspace(jsonb) to authenticated;

commit;
