CREATE OR REPLACE FUNCTION public.transfer_current_tenant_treasury_funds(p_source_account_id uuid, p_destination_account_id uuid, p_amount numeric, p_idempotency_key text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_source public.branch_payment_accounts%rowtype;
  v_destination public.branch_payment_accounts%rowtype;
  v_existing public.treasury_journals%rowtype;
  v_existing_line_count integer;
  v_existing_source_count integer;
  v_existing_destination_count integer;
  v_journal_id uuid;
  v_source_balance numeric(18, 2);
  v_destination_balance numeric(18, 2);
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'Tenant authentication is required.';
  end if;
  if p_source_account_id is null or p_destination_account_id is null
    or p_source_account_id = p_destination_account_id or coalesce(p_amount, 0) <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2)
  then
    raise exception using errcode = '22023', message = 'Two different accounts and a positive amount are required.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or nullif(btrim(p_description), '') is null then
    raise exception using errcode = '22023', message = 'Idempotency key and description are required.';
  end if;

  select * into v_source from public.branch_payment_accounts
  where tenant_id = v_tenant_id and id = p_source_account_id
    and status = 'active' and not is_locked;
  select * into v_destination from public.branch_payment_accounts
  where tenant_id = v_tenant_id and id = p_destination_account_id
    and status = 'active' and not is_locked;
  if v_source.id is null or v_destination.id is null or v_source.currency <> v_destination.currency then
    raise exception using errcode = '23514', message = 'Active source and destination accounts must use the same currency.';
  end if;
  if not private.can_write_branch(v_tenant_id, v_source.branch_id, 'money_bank.transfer')
    or not private.can_write_branch(v_tenant_id, v_destination.branch_id, 'money_bank.transfer')
  then
    raise exception using errcode = '42501', message = 'Transfer permission is required for both branches.';
  end if;

  select * into v_existing from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    select
      count(*),
      count(*) filter (
        where account_id = p_source_account_id and signed_amount = -p_amount
      ),
      count(*) filter (
        where account_id = p_destination_account_id and signed_amount = p_amount
      )
    into v_existing_line_count, v_existing_source_count, v_existing_destination_count
    from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = v_existing.id;
    if v_existing.journal_type <> 'transfer'
      or v_existing_line_count <> 2
      or v_existing_source_count <> 1
      or v_existing_destination_count <> 1
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used for another operation.';
    end if;
    return jsonb_build_object('journalId', v_existing.id, 'status', 'already_posted');
  end if;

  insert into public.branch_account_balances (
    tenant_id, branch_id, account_id, currency, current_balance, row_version
  ) values
    (v_tenant_id, v_source.branch_id, v_source.id, v_source.currency, 0, 0),
    (v_tenant_id, v_destination.branch_id, v_destination.id, v_destination.currency, 0, 0)
  on conflict (tenant_id, account_id, currency) do nothing;

  perform 1
  from public.branch_account_balances
  where tenant_id = v_tenant_id
    and account_id in (v_source.id, v_destination.id)
    and currency = v_source.currency
  order by account_id
  for update;

  select current_balance into v_source_balance from public.branch_account_balances
  where tenant_id = v_tenant_id and account_id = v_source.id and currency = v_source.currency;
  if v_source_balance < p_amount then
    raise exception using errcode = '23514', message = 'Insufficient source account balance.';
  end if;

  insert into public.treasury_journals (
    tenant_id, journal_type, source_type, source_id, idempotency_key,
    currency, description, external_cash_flow, posted_by, metadata
  ) values (
    v_tenant_id, 'transfer', 'transfer', btrim(p_idempotency_key),
    btrim(p_idempotency_key), v_source.currency, btrim(p_description),
    false, v_actor_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_journal_id;

  update public.branch_account_balances
  set current_balance = current_balance - p_amount, row_version = row_version + 1, updated_at = now()
  where tenant_id = v_tenant_id and account_id = v_source.id and currency = v_source.currency
  returning current_balance into v_source_balance;
  update public.branch_account_balances
  set current_balance = current_balance + p_amount, row_version = row_version + 1, updated_at = now()
  where tenant_id = v_tenant_id and account_id = v_destination.id and currency = v_destination.currency
  returning current_balance into v_destination_balance;

  insert into public.treasury_journal_lines (
    tenant_id, journal_id, branch_id, account_id, currency, signed_amount, balance_after
  ) values
    (v_tenant_id, v_journal_id, v_source.branch_id, v_source.id, v_source.currency, -p_amount, v_source_balance),
    (v_tenant_id, v_journal_id, v_destination.branch_id, v_destination.id, v_destination.currency, p_amount, v_destination_balance);

  if not private.has_branch_permission(v_tenant_id,v_source.branch_id,'cashandbank.read')
    or not private.has_branch_permission(v_tenant_id,v_destination.branch_id,'cashandbank.read') then
    return jsonb_build_object('journalId',v_journal_id,'status','posted');
  end if;

  return jsonb_build_object(
    'journalId', v_journal_id, 'sourceBalance', v_source_balance,
    'destinationBalance', v_destination_balance, 'status', 'posted'
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION public.save_current_branch_sales(p_sales jsonb, p_sale_tombstones jsonb DEFAULT '{}'::jsonb, p_products jsonb DEFAULT NULL::jsonb, p_deliveries jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sale_before jsonb;
  v_sale_after jsonb;
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_sales jsonb;
  v_existing_deliveries jsonb;
  v_existing_products jsonb;
  v_existing_sale_tombstones jsonb;
  v_next_sales jsonb;
  v_next_deliveries jsonb;
  v_next_products jsonb;
  v_next_sale_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_sales is null or jsonb_typeof(p_sales) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid sales array is required.';
  end if;
  if p_sale_tombstones is null or jsonb_typeof(p_sale_tombstones) <> 'object' then
    p_sale_tombstones := '{}'::jsonb;
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_deliveries is not null and jsonb_typeof(p_deliveries) <> 'array' then
    raise exception using errcode = '22023', message = 'deliveries, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['sales','products','deliveries']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_sales := coalesce(v_existing -> 'sales', '[]'::jsonb);
  v_existing_deliveries := coalesce(v_existing -> 'deliveries', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_sale_tombstones := coalesce(v_existing -> 'saleTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_sales);
    v_incoming_count := jsonb_array_length(p_sales);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_sales := v_existing_sales;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=sales existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_sales := p_sales;
    end if;

    if p_deliveries is not null then
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
            v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
          );
        end if;
        v_next_deliveries := p_deliveries;
      end if;
    end if;

    v_next_sale_tombstones := coalesce(p_sale_tombstones, v_existing_sale_tombstones);
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
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'pos.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for sales.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_sales, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_sales, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=sales existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_sale_tombstones := v_existing_sale_tombstones || p_sale_tombstones;

    v_next_sales := private.merge_branch_json_array_by_id(
      v_existing_sales, p_sales, v_branch_id, v_include_unassigned, v_next_sale_tombstones
    );

    if p_deliveries is not null then
      v_next_deliveries := private.replace_branch_json_array(
        v_existing_deliveries, p_deliveries, v_branch_id, v_include_unassigned
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  -- An ordinary sale edit must retain committed customer payments.
  for v_sale_before in select value from jsonb_array_elements(v_existing_sales)
    where jsonb_array_length(coalesce(value->'payments','[]'::jsonb))>0 loop
    if v_next_sale_tombstones ? (v_sale_before->>'id') then
      raise exception using errcode='23514',message='Sales with installments must remain in the payment audit history.';
    end if;
    select value into v_sale_after from jsonb_array_elements(v_next_sales) where value->>'id'=v_sale_before->>'id';
    if v_sale_after is null then continue; end if;
    if (v_sale_after->>'total')::numeric < (v_sale_before->>'amountPaid')::numeric then
      raise exception using errcode='23514',message='Sale total cannot be less than committed customer payments.';
    end if;
    v_sale_after:=v_sale_after||jsonb_build_object('payments',v_sale_before->'payments','amountPaid',v_sale_before->'amountPaid',
      'amountDue',(v_sale_after->>'total')::numeric-(v_sale_before->>'amountPaid')::numeric,
      'paymentStatus',case when (v_sale_after->>'total')::numeric=(v_sale_before->>'amountPaid')::numeric then 'paid' else 'partial' end);
    select jsonb_agg(case when item->>'id'=v_sale_before->>'id' then v_sale_after else item end order by ord) into v_next_sales
      from jsonb_array_elements(v_next_sales) with ordinality records(item,ord);
  end loop;

  v_next_payload := jsonb_set(v_existing, '{sales}', v_next_sales, true);
  v_next_payload := jsonb_set(v_next_payload, '{saleTombstones}', v_next_sale_tombstones, true);
  if v_next_deliveries is not null then
    v_next_payload := jsonb_set(v_next_payload, '{deliveries}', v_next_deliveries, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
    return private.normalized_mutation_result(array['sales','saleTombstones','deliveries','products','branchStocks']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object(
    'sales', v_next_sales,
    'saleTombstones', v_next_sale_tombstones,
    'deliveries', v_next_deliveries,
    'products', v_next_products
  );
end;
$function$

;

-- Internal record reads lock the workspace before resolving normalized records.
create or replace function private.payment_operation_snapshot(p_tenant uuid,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;
begin
  perform 1 from public.tenant_workspaces where tenant_id=p_tenant for update;
  if private.normalized_writes_enabled(p_tenant) then
    return private.normalized_business_snapshot(p_tenant,array[p_key]);
  end if;
  select payload into v_payload from public.tenant_workspaces where tenant_id=p_tenant;
  return coalesce(v_payload,'{}'::jsonb);
end; $$;
revoke all on function private.payment_operation_snapshot(uuid,text) from public,anon,authenticated;

create or replace function private.persist_payment_operation(p_tenant uuid,p_key text,p_record jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_payload jsonb; v_records jsonb;
begin
  v_payload:=private.payment_operation_snapshot(p_tenant,p_key);
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_records
    from jsonb_array_elements(coalesce(v_payload->p_key,'[]'::jsonb)) item
    where item->>'id'<>p_record->>'id';
  v_records:=v_records||jsonb_build_array(p_record);
  if private.normalized_writes_enabled(p_tenant) then
    perform private.persist_normalized_business_snapshot(p_tenant,jsonb_build_object(p_key,v_records));
  else
    update public.tenant_workspaces set payload=jsonb_set(payload,array[p_key],v_records,true),
      updated_at=clock_timestamp(),updated_by=auth.uid() where tenant_id=p_tenant;
  end if;
  v_payload:=private.payment_operation_snapshot(p_tenant,p_key);
  if not exists(select 1 from jsonb_array_elements(coalesce(v_payload->p_key,'[]'::jsonb)) item where item=p_record) then
    raise exception using errcode='40001',message='The saved payment record changed. Refresh before retrying.';
  end if;
end; $$;
revoke all on function private.persist_payment_operation(uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.save_current_branch_expense_payment(p_expense jsonb,p_expected_version text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid:=private.current_tenant_id(); v_actor uuid:=auth.uid();
  v_context jsonb; v_branch uuid; v_payload jsonb; v_old jsonb; v_next jsonb;
  v_account public.branch_payment_accounts%rowtype; v_post jsonb; v_amount numeric;
  v_financial_change boolean; v_version text:=clock_timestamp()::text;
begin
  v_context:=public.get_current_branch_context(); v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
  if v_actor is null or v_tenant is null or v_branch is null or v_context->>'activeScope'<>'branch' then
    raise exception using errcode='42501',message='Select an authorized expense branch.';
  end if;
  if jsonb_typeof(p_expense) is distinct from 'object' or nullif(btrim(p_expense->>'id'),'') is null
    or nullif(btrim(p_expense->>'description'),'') is null or nullif(btrim(p_expense->>'category'),'') is null then
    raise exception using errcode='22023',message='Expense reference, description and category are required.';
  end if;
  v_amount:=(p_expense->>'amount')::numeric;
  if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<>round(v_amount,2) then
    raise exception using errcode='22023',message='A valid positive expense amount is required.';
  end if;
  if nullif(p_expense->>'branchId','') is not null and p_expense->>'branchId'<>v_branch::text then
    raise exception using errcode='42501',message='Expense belongs to another branch.';
  end if;
  v_payload:=private.payment_operation_snapshot(v_tenant,'expenses');
  select item into v_old from jsonb_array_elements(coalesce(v_payload->'expenses','[]'::jsonb)) item where item->>'id'=p_expense->>'id';
  if not private.can_write_branch(v_tenant,v_branch,case when v_old is null then 'expenses.write' else 'expenses.edit' end) then
    -- Retrying the identical create is safe but never permits an edit.
    if v_old is not null and p_expected_version is null and private.can_write_branch(v_tenant,v_branch,'expenses.write')
      and v_old->>'branchId'=v_branch::text
      and (v_old-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId'])=(p_expense-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId']) then
      return jsonb_build_object('expense',v_old,'status','already_recorded');
    end if;
    raise exception using errcode='42501',message='Expense create or edit permission is required.';
  end if;
  if v_old is not null then
    if coalesce(v_old->>'branchId',v_branch::text)<>v_branch::text or
      (nullif(v_old->>'branchId','') is null and not coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false)) then
      raise exception using errcode='42501',message='Expense belongs to another branch.';
    end if;
    if p_expected_version is null then
      if (v_old-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId']) is distinct from (p_expense-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId']) then
        raise exception using errcode='23505',message='Expense already exists. Refresh before editing.';
      end if;
      return jsonb_build_object('expense',v_old,'status','already_recorded');
    end if;
    if p_expected_version is distinct from coalesce(v_old->>'syncUpdatedAt',v_old->>'updatedAt',v_old->>'timestamp','') then
      raise exception using errcode='40001',message='Expense changed. Refresh before editing.';
    end if;
  end if;
  v_financial_change:=v_old is null or (v_old->>'amount')::numeric is distinct from v_amount
    or (v_old->>'paidFromAccountId') is distinct from (p_expense->>'paidFromAccountId');
  v_next:=(p_expense-'treasuryJournalId')||jsonb_build_object('branchId',v_branch,'syncUpdatedAt',v_version,'updatedAt',v_version);
  if v_old is not null and not v_financial_change then
    if v_old ? 'treasuryJournalId' then v_next:=v_next||jsonb_build_object('treasuryJournalId',v_old->'treasuryJournalId'); end if;
  else
    if v_old is not null then
      if nullif(v_old->>'treasuryJournalId','') is null then
        raise exception using errcode='23514',message='Historical expense funding must be reconciled before changing its amount or account.';
      end if;
      if not exists(select 1 from public.treasury_journals j join public.treasury_journal_lines l
        on l.journal_id=j.id and l.tenant_id=j.tenant_id
        where j.tenant_id=v_tenant and j.id=(v_old->>'treasuryJournalId')::uuid
          and j.source_type in ('expense','payroll') and (j.source_id=v_old->>'id'
            or (j.metadata->>'expenseId'=v_old->>'id' and j.source_id like (v_old->>'id')||':edit:%'))
          and l.branch_id=v_branch and l.signed_amount=-(v_old->>'amount')::numeric
          and (select count(*) from public.treasury_journal_lines where journal_id=j.id and tenant_id=v_tenant)=1) then
        raise exception using errcode='23514',message='The original expense payment could not be verified.';
      end if;
      perform private.reverse_current_tenant_treasury_journal_authorized((v_old->>'treasuryJournalId')::uuid,
        'expense-edit-reversal:'||(v_old->>'treasuryJournalId'),'Corrected expense '||(v_old->>'id'));
    end if;
    select * into v_account from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch
      and source_key=p_expense->>'paidFromAccountId' and status='active' and not is_locked;
    if v_account.id is null or v_account.currency is distinct from (select currency_code from public.tenants where id=v_tenant) then
      raise exception using errcode='23514',message='Select an active expense payment account in this branch and currency.';
    end if;
    v_post:=private.post_current_tenant_treasury_entry_authorized(v_branch,v_account.id,v_amount,'out',
      case when nullif(p_expense->>'payrollPaymentType','') is null then 'expense' else 'payroll' end,
      case when v_old is null then p_expense->>'id' else (p_expense->>'id')||':edit:'||(v_old->>'treasuryJournalId') end,
      case when v_old is null then 'expense:'||(p_expense->>'id')||':v1' else 'expense-edit:'||(v_old->>'treasuryJournalId') end,
      p_expense->>'description',jsonb_build_object('expenseId',p_expense->>'id','category',p_expense->>'category','staffId',p_expense->>'staffId'));
    v_next:=v_next||jsonb_build_object('treasuryJournalId',v_post->>'journalId');
  end if;
  perform private.persist_payment_operation(v_tenant,'expenses',v_next);
  return jsonb_build_object('expense',v_next,'status','recorded');
end; $$;
revoke all on function public.save_current_branch_expense_payment(jsonb,text) from public,anon;
grant execute on function public.save_current_branch_expense_payment(jsonb,text) to authenticated;

create or replace function public.save_current_branch_funded_purchase(p_purchase jsonb,p_products jsonb default null,p_branch_stocks jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid:=private.current_tenant_id(); v_branch uuid; v_context jsonb; v_payload jsonb; v_old jsonb;
  v_next jsonb; v_lines jsonb:='[]'; v_allocations jsonb; v_allocation jsonb; v_account public.branch_payment_accounts%rowtype;
  v_total numeric; v_paid numeric; v_funded numeric:=0; v_amount numeric; v_post jsonb; v_result jsonb; v_currency text;
begin
  v_context:=public.get_current_branch_context(); v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
  if auth.uid() is null or v_tenant is null or v_branch is null or v_context->>'activeScope'<>'branch'
    or not private.can_write_branch(v_tenant,v_branch,'purchases.write') then
    raise exception using errcode='42501',message='Purchase write permission is required in the selected branch.';
  end if;
  if jsonb_typeof(p_purchase) is distinct from 'object' or nullif(btrim(p_purchase->>'id'),'') is null
    or (nullif(p_purchase->>'branchId','') is not null and p_purchase->>'branchId'<>v_branch::text) then
    raise exception using errcode='22023',message='A purchase in the selected branch is required.';
  end if;
  v_total:=(p_purchase->>'totalAmount')::numeric; v_paid:=coalesce((p_purchase->>'amountPaid')::numeric,0);
  if v_total is null or v_total<=0 or v_paid<0 or v_paid>v_total or v_total::text in ('NaN','Infinity','-Infinity')
    or v_paid::text in ('NaN','Infinity','-Infinity') or v_paid<>round(v_paid,2) then
    raise exception using errcode='23514',message='Purchase total and paid amount must be valid.';
  end if;
  v_payload:=private.payment_operation_snapshot(v_tenant,'purchases');
  select item into v_old from jsonb_array_elements(coalesce(v_payload->'purchases','[]'::jsonb)) item where item->>'id'=p_purchase->>'id';
  if v_old is not null then
    if v_old->>'branchId' is distinct from v_branch::text or (v_old->>'totalAmount')::numeric<>v_total
      or (v_old->>'amountPaid')::numeric<>v_paid or v_old->'items' is distinct from p_purchase->'items'
      or v_old->'paymentAllocations' is distinct from p_purchase->'paymentAllocations' then
      raise exception using errcode='23505',message='Purchase reference already exists. Refresh Purchases.';
    end if;
    return jsonb_build_object('purchase',v_old,'status','already_recorded');
  end if;
  if nullif(p_purchase->>'treasuryJournalId','') is not null or jsonb_array_length(coalesce(p_purchase->'payments','[]'::jsonb))>0 then
    raise exception using errcode='22023',message='New purchases cannot supply payment journal references.';
  end if;
  v_allocations:=coalesce(p_purchase->'paymentAllocations','[]'::jsonb);
  if jsonb_typeof(v_allocations)<>'array' or jsonb_array_length(v_allocations)>20 then
    raise exception using errcode='22023',message='Valid purchase funding allocations are required.';
  end if;
  select currency_code into v_currency from public.tenants where id=v_tenant;
  for v_allocation in select value from jsonb_array_elements(v_allocations) loop
    v_amount:=(v_allocation->>'amount')::numeric;
    if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<>round(v_amount,2)
      or coalesce(v_allocation->>'fundingType','') not in ('registered','external') then
      raise exception using errcode='23514',message='Every funding allocation must have a valid amount and funding type.';
    end if;
    v_funded:=v_funded+v_amount;
    if v_allocation->>'fundingType'='registered' then
      select * into v_account from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch
        and source_key=coalesce(v_allocation->>'sourceKey',v_allocation->>'accountId') and status='active' and not is_locked;
      if v_account.id is null or v_account.currency is distinct from v_currency then
        raise exception using errcode='23514',message='Purchase funding requires an active account in this branch and currency.';
      end if;
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object('accountId',v_account.id,'amount',v_amount));
    end if;
  end loop;
  if v_funded<>v_paid then raise exception using errcode='23514',message='Funding allocations must equal the purchase amount paid.'; end if;
  v_next:=p_purchase||jsonb_build_object('branchId',v_branch,'amountDue',v_total-v_paid,'syncUpdatedAt',clock_timestamp());
  if jsonb_array_length(v_lines)>0 then
    -- Aggregate repeat account rows so account locks and journal lines remain deterministic.
    select jsonb_agg(jsonb_build_object('accountId',account_id,'amount',amount) order by account_id) into v_lines
      from (select item->>'accountId' account_id,sum((item->>'amount')::numeric) amount from jsonb_array_elements(v_lines) item group by item->>'accountId') grouped;
    v_post:=private.post_current_tenant_treasury_split_outgoing_entry_authorized(v_branch,v_lines,'purchase',p_purchase->>'id',
      'purchase:'||(p_purchase->>'id')||':v1','Purchase payment to '||coalesce(p_purchase->>'supplierName','supplier'),jsonb_build_object('fundingAllocations',v_allocations));
    v_next:=v_next||jsonb_build_object('treasuryJournalId',v_post->>'journalId');
  end if;
  v_result:=public.save_current_branch_purchases(p_purchases=>jsonb_build_array(v_next),p_purchase_tombstones=>'{}'::jsonb,p_products=>p_products,p_branch_stocks=>p_branch_stocks);
  v_payload:=private.payment_operation_snapshot(v_tenant,'purchases');
  if not exists(select 1 from jsonb_array_elements(coalesce(v_payload->'purchases','[]'::jsonb)) item where item=v_next) then
    raise exception using errcode='40001',message='The purchase changed. Refresh before retrying.';
  end if;
  return jsonb_build_object('purchase',v_next,'workspace',v_result,'status','recorded');
end; $$;
revoke all on function public.save_current_branch_funded_purchase(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_current_branch_funded_purchase(jsonb,jsonb,jsonb) to authenticated;

create or replace function public.add_current_branch_sale_payment(p_sale_id text,p_payment_id uuid,p_amount numeric,p_source_key text,p_paid_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid:=private.current_tenant_id(); v_context jsonb; v_branch uuid; v_payload jsonb; v_sale jsonb;
  v_payment jsonb; v_previous jsonb; v_account public.branch_payment_accounts%rowtype; v_post jsonb; v_paid numeric; v_total numeric;
begin
  v_context:=public.get_current_branch_context(); v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
  if auth.uid() is null or v_tenant is null or v_branch is null or v_context->>'activeScope'<>'branch'
    or not private.can_write_branch(v_tenant,v_branch,'paymentin.write') then
    raise exception using errcode='42501',message='Customer payment permission is required in the selected branch.';
  end if;
  if nullif(btrim(p_sale_id),'') is null or p_payment_id is null or p_amount is null or p_amount<=0
    or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2) then
    raise exception using errcode='22023',message='A sale, payment reference and valid positive payment are required.';
  end if;
  v_payload:=private.payment_operation_snapshot(v_tenant,'sales');
  select item into v_sale from jsonb_array_elements(coalesce(v_payload->'sales','[]'::jsonb)) item where item->>'id'=p_sale_id;
  if v_sale is null then raise exception using errcode='P0002',message='Sale was not found.'; end if;
  if coalesce(v_sale->>'branchId',v_branch::text)<>v_branch::text or
    (nullif(v_sale->>'branchId','') is null and not coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false)) then
    raise exception using errcode='42501',message='Sale belongs to another branch.';
  end if;
  select item into v_previous from jsonb_array_elements(coalesce(v_sale->'payments','[]'::jsonb)) item where item->>'id'=p_payment_id::text;
  if v_previous is not null then
    if (v_previous->>'amount')::numeric<>p_amount or v_previous->>'sourceKey' is distinct from p_source_key then
      raise exception using errcode='23505',message='Payment reference was already used with different details.';
    end if;
    return jsonb_build_object('sale',v_sale,'status','already_recorded');
  end if;
  v_total:=(v_sale->>'total')::numeric;
  v_paid:=coalesce((v_sale->>'amountPaid')::numeric,case when v_sale->>'paymentMethod'='Credit' then 0 else v_total end);
  if v_total is null or v_paid<0 or p_amount>v_total-v_paid then
    raise exception using errcode='23514',message='Payment exceeds the outstanding sale amount.';
  end if;
  select * into v_account from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch
    and source_key=p_source_key and status='active' and not is_locked;
  if v_account.id is null then raise exception using errcode='23514',message='Select an active payment account in this branch.'; end if;
  v_post:=private.post_current_tenant_treasury_entry_authorized(v_branch,v_account.id,p_amount,'in','customer_payment',
    p_sale_id||':payment:'||p_payment_id,'sale-installment:'||p_payment_id,'Customer payment for sale '||p_sale_id,
    jsonb_build_object('saleId',p_sale_id,'paymentId',p_payment_id));
  v_payment:=jsonb_build_object('id',p_payment_id,'amount',p_amount,'sourceKey',p_source_key,'accountId',v_account.id,
    'method',v_account.account_name,'date',coalesce(p_paid_at,clock_timestamp()),'recordedAt',clock_timestamp(),
    'recordedBy',auth.uid(),'treasuryJournalId',v_post->>'journalId');
  v_sale:=v_sale||jsonb_build_object('amountPaid',v_paid+p_amount,'amountDue',v_total-v_paid-p_amount,
    'paymentStatus',case when v_total=v_paid+p_amount then 'paid' else 'partial' end,
    'payments',coalesce(v_sale->'payments','[]'::jsonb)||jsonb_build_array(v_payment),'syncUpdatedAt',clock_timestamp());
  perform private.persist_payment_operation(v_tenant,'sales',v_sale);
  return jsonb_build_object('sale',v_sale,'status','recorded');
end; $$;
revoke all on function public.add_current_branch_sale_payment(text,uuid,numeric,text,timestamptz) from public,anon;
grant execute on function public.add_current_branch_sale_payment(text,uuid,numeric,text,timestamptz) to authenticated;


