-- Same lost-update fix as sales/purchases, now for Deliveries. Deliveries
-- had no tombstone mechanism -- deletion relied purely on "the incoming
-- array omits this id". Adds a deliveryTombstones column to the workspace
-- payload, a p_delivery_tombstones parameter to save_current_branch_deliveries
-- (new 2-arg overload -- the client always calls with named parameters, so
-- it resolves to this one), and swaps the deliveries replace for a
-- merge-by-id using the already-generic private.merge_branch_json_array_by_id.
--
-- The old 1-arg overload is left in place as dead code: DROP FUNCTION calls
-- were repeatedly blocked by the Supabase MCP tool's destructive-SQL
-- approval gate when this was applied (same as the old save_current_branch_purchases
-- 3-arg overload from 20261023110000). Harmless and unreachable; dropping
-- both is a follow-up for whoever has interactive Supabase SQL Editor access.

create or replace function public.save_current_branch_deliveries(
  p_deliveries jsonb,
  p_delivery_tombstones jsonb default '{}'::jsonb
)
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
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_deliveries jsonb;
  v_existing_delivery_tombstones jsonb;
  v_next_deliveries jsonb;
  v_next_delivery_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_deliveries is null or jsonb_typeof(p_deliveries) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid deliveries array is required.';
  end if;
  if p_delivery_tombstones is null or jsonb_typeof(p_delivery_tombstones) <> 'object' then
    p_delivery_tombstones := '{}'::jsonb;
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
  v_existing_deliveries := coalesce(v_existing -> 'deliveries', '[]'::jsonb);
  v_existing_delivery_tombstones := coalesce(v_existing -> 'deliveryTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_deliveries);
    v_incoming_count := jsonb_array_length(p_deliveries);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_deliveries := v_existing_deliveries;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=deliveries existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_deliveries := p_deliveries;
    end if;

    v_next_delivery_tombstones := coalesce(p_delivery_tombstones, v_existing_delivery_tombstones);
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
      if not private.is_tenant_branch_administrator(v_tenant_id) then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
      if not private.is_tenant_branch_administrator(v_tenant_id)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'deliveries.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for deliveries.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_deliveries, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_deliveries, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=deliveries existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_delivery_tombstones := v_existing_delivery_tombstones || p_delivery_tombstones;

    v_next_deliveries := private.merge_branch_json_array_by_id(
      v_existing_deliveries, p_deliveries, v_branch_id, v_include_unassigned, v_next_delivery_tombstones
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('deliveries', v_next_deliveries, 'deliveryTombstones', v_next_delivery_tombstones),
    statement_timestamp(),
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        jsonb_set(public.tenant_workspaces.payload, '{deliveries}', v_next_deliveries, true),
        '{deliveryTombstones}', v_next_delivery_tombstones, true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object('deliveries', v_next_deliveries, 'deliveryTombstones', v_next_delivery_tombstones);
end;
$$;

revoke all on function public.save_current_branch_deliveries(jsonb, jsonb) from public, anon;
grant execute on function public.save_current_branch_deliveries(jsonb, jsonb) to authenticated;
