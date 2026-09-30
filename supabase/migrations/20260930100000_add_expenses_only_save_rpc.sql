-- Same performance fix as save_current_branch_products, extended to
-- Expenses: handleUpdateExpense's only explicit save currently round-trips
-- the entire tenant workspace (products, sales, purchases, deliveries...)
-- to change one expense row. This RPC touches only `expenses`, using the
-- exact same per-scope logic save_current_branch_workspace already applies
-- to that key (private.replace_branch_json_array for branch/
-- compatibility_primary, blind-replace-with-shrink-guard for all_branches),
-- so behavior is unchanged -- only the payload size and round trips shrink.
--
-- handleAddExpense has no explicit save of its own (it relies on the
-- existing debounced whole-workspace autosave) and is intentionally left
-- untouched by this migration.

begin;

create or replace function public.save_current_branch_expenses(
  p_expenses jsonb
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
  v_existing_expenses jsonb;
  v_next_expenses jsonb;
  v_existing_count integer;
  v_incoming_count integer;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_expenses is null or jsonb_typeof(p_expenses) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid expenses array is required.';
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
  v_existing_expenses := coalesce(v_existing -> 'expenses', '[]'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_expenses);
    v_incoming_count := jsonb_array_length(p_expenses);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_expenses := v_existing_expenses;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=expenses existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_expenses := p_expenses;
    end if;
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
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'expenses.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for expenses.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_expenses, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_expenses, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=expenses existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_expenses := private.replace_branch_json_array(
      v_existing_expenses,
      p_expenses,
      v_branch_id,
      v_include_unassigned
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('expenses', v_next_expenses),
    statement_timestamp(),
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(public.tenant_workspaces.payload, '{expenses}', v_next_expenses, true),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object('expenses', v_next_expenses);
end;
$$;

revoke all on function public.save_current_branch_expenses(jsonb) from public, anon;
grant execute on function public.save_current_branch_expenses(jsonb) to authenticated;

commit;
