-- Closes the gap the sales/purchases/deliveries/expenses online-save fixes
-- (20261023100000/110000/120000/130000) left open: Dashboard.tsx also runs
-- a debounced "catch-all" autosave (scheduleTenantWorkspaceSave, effect
-- dependency array includes salesMap/purchasesMap/deliveriesMap/expensesMap)
-- that fires shortly after almost every change, including the narrow saves
-- those fixes protect -- and it calls save_current_branch_workspace, whose
-- generic per-key loop still replaced the branch's whole sales/purchases/
-- deliveries/expenses list with whatever array the client happened to hold
-- at render time. So the exact lost-update race just fixed on the direct
-- path could still happen a moment later via this second path.
--
-- Pulls those four keys out of the generic replace loop and merges them by
-- id via private.merge_branch_json_array_by_id, using tombstones merged
-- from the existing payload and whatever the client sent (Dashboard.tsx now
-- includes saleTombstones/purchaseTombstones/deliveryTombstones/
-- expenseTombstones in the workspace object it builds for this autosave).
-- pendingDeliveryNotes, branchStocks and branchStaffAssignments are left on
-- the old replace loop -- they have no tombstone mechanism, and client-side
-- appendMergeWorkspaceKeys already merges branches/branchStocks/
-- branchStaffAssignments before this RPC is even called, which is the
-- existing, separate protection for those.

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
  v_existing jsonb;
  v_existing_scoped jsonb;
  v_next jsonb;
  v_existing_settings jsonb;
  v_incoming_settings jsonb;
  v_next_settings jsonb;
  v_key text;
  v_permission_key text;
  v_next_sale_tombstones jsonb;
  v_next_purchase_tombstones jsonb;
  v_next_delivery_tombstones jsonb;
  v_next_expense_tombstones jsonb;
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

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
    and private.is_tenant_branch_administrator(v_tenant_id)
  then
    v_next := p_workspace;
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
    -- Replace-based: no tombstone mechanism for these three, and
    -- branches/branchStocks/branchStaffAssignments are already merged by id
    -- client-side (appendMergeWorkspaceKeys) before this RPC is called.
    foreach v_key in array array[
      'pendingDeliveryNotes', 'branchStocks', 'branchStaffAssignments'
    ]
    loop
      v_next := jsonb_set(
        v_next,
        array[v_key],
        private.replace_branch_json_array(
          v_existing -> v_key,
          p_workspace -> v_key,
          v_branch_id,
          case when v_key in ('branchStocks', 'branchStaffAssignments') then false else v_include_unassigned end
        ),
        true
      );
    end loop;

    -- sales/purchases/deliveries/expenses: merge by id instead of replace --
    -- the same lost-update fix as save_current_branch_sales/purchases/
    -- deliveries/expenses, needed here too because this whole-workspace
    -- autosave can independently push a stale render-time snapshot for any
    -- of these moments after a narrow save already protected it.
    v_next_sale_tombstones := coalesce(v_existing -> 'saleTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'saleTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{sales}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'sales', p_workspace -> 'sales', v_branch_id, v_include_unassigned, v_next_sale_tombstones
      ),
      true
    );

    v_next_purchase_tombstones := coalesce(v_existing -> 'purchaseTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'purchaseTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{purchases}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'purchases', p_workspace -> 'purchases', v_branch_id, v_include_unassigned, v_next_purchase_tombstones
      ),
      true
    );

    v_next_delivery_tombstones := coalesce(v_existing -> 'deliveryTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'deliveryTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{deliveries}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'deliveries', p_workspace -> 'deliveries', v_branch_id, v_include_unassigned, v_next_delivery_tombstones
      ),
      true
    );

    v_next_expense_tombstones := coalesce(v_existing -> 'expenseTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'expenseTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{expenses}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'expenses', p_workspace -> 'expenses', v_branch_id, v_include_unassigned, v_next_expense_tombstones
      ),
      true
    );

    v_next := jsonb_set(
      v_next,
      '{products}',
      private.merge_workspace_products_by_id(
        v_existing -> 'products',
        p_workspace -> 'products'
      ),
      true
    );

    v_existing_settings := coalesce(v_existing -> 'settings', '{}'::jsonb);
    v_incoming_settings := coalesce(p_workspace -> 'settings', '{}'::jsonb);
    if private.is_tenant_branch_administrator(v_tenant_id) then
      v_next_settings := v_incoming_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_incoming_settings -> 'staffs',
          v_branch_id,
          v_include_unassigned
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_incoming_settings -> 'paymentChannels',
          v_branch_id,
          v_include_unassigned
        )
      );
    else
      v_next_settings := v_existing_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_incoming_settings -> 'staffs',
          v_branch_id,
          false
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_incoming_settings -> 'paymentChannels',
          v_branch_id,
          false
        )
      );
    end if;
    v_next := jsonb_set(v_next, '{settings}', v_next_settings, true);

    -- Tenant-wide metadata/tombstones are merge-only for branch-scoped saves.
    v_next := v_next || jsonb_build_object(
      'productTombstones',
      coalesce(v_existing -> 'productTombstones', '{}'::jsonb)
        || coalesce(p_workspace -> 'productTombstones', '{}'::jsonb),
      'saleTombstones', v_next_sale_tombstones,
      'purchaseTombstones', v_next_purchase_tombstones,
      'deliveryTombstones', v_next_delivery_tombstones,
      'expenseTombstones', v_next_expense_tombstones
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
