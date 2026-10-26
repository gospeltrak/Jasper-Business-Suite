CREATE OR REPLACE FUNCTION private.has_branch_permission(p_tenant_id uuid, p_branch_id uuid, p_permission_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_key text := lower(nullif(btrim(p_permission_key), ''));
  v_module text;
  v_action text;
  v_profile_value text;
begin
  if v_key is null or not private.is_active_tenant_member(p_tenant_id) then
    return false;
  end if;
  if private.is_tenant_branch_administrator(p_tenant_id) then
    return true;
  end if;
  if not private.is_branch_assigned(p_tenant_id, p_branch_id) then
    return false;
  end if;
  if exists (
    select 1 from public.branch_permission_grants g
    where g.tenant_id=p_tenant_id and g.staff_id=(select auth.uid())
      and g.permission_key=v_key and g.effect='deny'
      and (g.branch_id is null or g.branch_id=p_branch_id)
  ) then return false; end if;
  -- The Roles UI and staff provisioning persist { pos: { write: true } },
  -- not { "pos.write": true }. The saved user override is authoritative
  -- for real module read/write/edit permissions, including explicit false.
  if v_key='money_bank.transfer' then
    return private.has_branch_permission(p_tenant_id,p_branch_id,'fundtransfers.write');
  end if;
  v_module := case split_part(v_key,'.',1) when 'fundtransfers' then 'fundTransfers' when 'paymentin' then 'paymentIn' when 'paymentout' then 'paymentOut' when 'cashandbank' then 'cashAndBank' else split_part(v_key,'.',1) end;
  v_action := split_part(v_key,'.',2);
  if v_action in ('read','write','edit') and v_key = lower(v_module) || '.' || v_action then
    select u.role_permissions #>> array[v_module,v_action] into v_profile_value
    from public.users u
    where u.id=(select auth.uid()) and u.tenant_id=p_tenant_id and u.is_active;
    if v_profile_value in ('true','false') then
      return v_profile_value = 'true';
    end if;
  end if;

  if exists (
    select 1 from public.branch_permission_grants g
    where g.tenant_id=p_tenant_id and g.staff_id=(select auth.uid())
      and g.permission_key=v_key and g.effect='allow'
      and (g.branch_id is null or g.branch_id=p_branch_id)
  ) then return true; end if;

  if exists (
    select 1 from public.branch_staff_assignments a
    join public.branch_roles r
      on r.tenant_id=a.tenant_id and r.id=a.branch_role_id and r.status='active'
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
      and a.staff_id=(select auth.uid()) and a.status='active'
      and (a.starts_at is null or a.starts_at<=now())
      and (a.ends_at is null or a.ends_at>now())
      and (r.permissions @> jsonb_build_object(v_key,true)
        or (v_action in ('read','write','edit')
          and v_key=lower(v_module)||'.'||v_action
          and r.permissions #>> array[v_module,v_action]='true'))
  ) then return true; end if;
  if exists (
    select 1 from public.branch_staff_assignments a
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
      and a.staff_id=(select auth.uid()) and a.status='active'
      and (a.starts_at is null or a.starts_at<=now())
      and (a.ends_at is null or a.ends_at>now())
      and (a.permissions @> jsonb_build_object(v_key,true)
        or (v_action in ('read','write','edit')
          and v_key=lower(v_module)||'.'||v_action
          and a.permissions #>> array[v_module,v_action]='true'))
  ) then return true; end if;
  -- Delivery UI is a POS workflow. Inherit POS write only when no delivery
  -- override or explicit branch deny resolved above; never inherit money_bank.post.
  if v_key='deliveries.write' then
    if exists (
      select 1 from public.branch_staff_assignments a
      left join public.branch_roles r on r.id=a.branch_role_id and r.tenant_id=a.tenant_id and r.status='active'
      where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.staff_id=(select auth.uid())
        and a.status='active' and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
        and (a.permissions #>> array['deliveries','write']='false' or r.permissions #>> array['deliveries','write']='false')
    ) then return false; end if;
    return private.has_branch_permission(p_tenant_id,p_branch_id,'pos.write');
  end if;
  return false;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.save_current_branch_expenses(p_expenses jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item jsonb;
  v_old_item jsonb;
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

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['expenses']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
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
        and not (private.can_write_branch(v_tenant_id, v_branch_id, 'expenses.write') or private.can_write_branch(v_tenant_id, v_branch_id, 'expenses.edit'))
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

  if not private.is_tenant_branch_administrator(v_tenant_id) then
    for v_item in select value from jsonb_array_elements(v_next_expenses) loop
      select value into v_old_item from jsonb_array_elements(v_existing_expenses) where value->>'id'=v_item->>'id';
      if v_old_item is null then
        if not private.can_write_branch(v_tenant_id,v_branch_id,'expenses.write') then
          raise exception using errcode='42501',message='Expense create permission is required.';
        end if;
      elsif (v_old_item-array['syncUpdatedAt','updatedAt','branchId']) is distinct from (v_item-array['syncUpdatedAt','updatedAt','branchId']) then
        if not private.can_write_branch(v_tenant_id,v_branch_id,'expenses.edit') then
          raise exception using errcode='42501',message='Expense edit permission is required.';
        end if;
        if (v_old_item->>'amount') is distinct from (v_item->>'amount')
          or (v_old_item->>'paidFromAccountId') is distinct from (v_item->>'paidFromAccountId') then
          raise exception using errcode='23514',message='Expense payment changes must use the atomic expense payment operation.';
        end if;
      end if;
    end loop;
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_build_object('expenses', v_next_expenses));
    return private.normalized_mutation_result(array['expenses','expenseTombstones']);
  else
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
  end if;

  return jsonb_build_object('expenses', v_next_expenses);
end;
$function$

;

CREATE OR REPLACE FUNCTION public.save_current_branch_expenses(p_expenses jsonb, p_expense_tombstones jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item jsonb;
  v_old_item jsonb;
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_expenses jsonb;
  v_existing_expense_tombstones jsonb;
  v_next_expenses jsonb;
  v_next_expense_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_expenses is null or jsonb_typeof(p_expenses) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid expenses array is required.';
  end if;
  if p_expense_tombstones is null or jsonb_typeof(p_expense_tombstones) <> 'object' then
    p_expense_tombstones := '{}'::jsonb;
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['expenses']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_expenses := coalesce(v_existing -> 'expenses', '[]'::jsonb);
  v_existing_expense_tombstones := coalesce(v_existing -> 'expenseTombstones', '{}'::jsonb);

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

    v_next_expense_tombstones := coalesce(p_expense_tombstones, v_existing_expense_tombstones);
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
        and not (private.can_write_branch(v_tenant_id, v_branch_id, 'expenses.write') or private.can_write_branch(v_tenant_id, v_branch_id, 'expenses.edit'))
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

    v_next_expense_tombstones := v_existing_expense_tombstones || p_expense_tombstones;

    v_next_expenses := private.merge_branch_json_array_by_id(
      v_existing_expenses, p_expenses, v_branch_id, v_include_unassigned, v_next_expense_tombstones
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if not private.is_tenant_branch_administrator(v_tenant_id) then
    for v_item in select value from jsonb_array_elements(v_next_expenses) loop
      select value into v_old_item from jsonb_array_elements(v_existing_expenses) where value->>'id'=v_item->>'id';
      if v_old_item is null then
        if not private.can_write_branch(v_tenant_id,v_branch_id,'expenses.write') then
          raise exception using errcode='42501',message='Expense create permission is required.';
        end if;
      elsif (v_old_item-array['syncUpdatedAt','updatedAt','branchId']) is distinct from (v_item-array['syncUpdatedAt','updatedAt','branchId']) then
        if not private.can_write_branch(v_tenant_id,v_branch_id,'expenses.edit') then
          raise exception using errcode='42501',message='Expense edit permission is required.';
        end if;
        if (v_old_item->>'amount') is distinct from (v_item->>'amount')
          or (v_old_item->>'paidFromAccountId') is distinct from (v_item->>'paidFromAccountId') then
          raise exception using errcode='23514',message='Expense payment changes must use the atomic expense payment operation.';
        end if;
      end if;
    end loop;
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_build_object('expenses', v_next_expenses, 'expenseTombstones', v_next_expense_tombstones));
    return private.normalized_mutation_result(array['expenses','expenseTombstones']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('expenses', v_next_expenses, 'expenseTombstones', v_next_expense_tombstones),
    statement_timestamp(),
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        jsonb_set(public.tenant_workspaces.payload, '{expenses}', v_next_expenses, true),
        '{expenseTombstones}', v_next_expense_tombstones, true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object('expenses', v_next_expenses, 'expenseTombstones', v_next_expense_tombstones);
end;
$function$

;

