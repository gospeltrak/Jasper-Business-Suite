set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Purchase installments settle the supplier liability and debit treasury atomically.
create or replace function public.add_current_branch_purchase_payment(
  p_purchase_id text, p_payment_id uuid, p_amount numeric,
  p_funding_type text, p_source_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_payload jsonb;
  v_purchase jsonb;
  v_payment jsonb;
  v_previous jsonb;
  v_payments jsonb;
  v_allocations jsonb;
  v_account public.branch_payment_accounts%rowtype;
  v_post jsonb;
  v_total numeric;
  v_paid numeric;
  v_currency text;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or v_tenant is null then
    raise exception using errcode='42501', message='Tenant authentication is required.';
  end if;
  if nullif(btrim(p_purchase_id),'') is null or p_payment_id is null
    or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount <= 0 or p_amount <> round(p_amount,2)
    or p_funding_type is null or p_funding_type not in ('registered','external')
    or (p_funding_type='registered' and nullif(btrim(p_source_key),'') is null)
    or (p_funding_type='external' and p_source_key is not null)
  then
    raise exception using errcode='22023', message='A purchase, payment ID, positive amount and funding account are required.';
  end if;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  if (v_context->>'activeScope') is distinct from 'branch' or v_branch is null
    or not private.can_write_branch(v_tenant,v_branch,'products.write')
    or not private.can_write_branch(v_tenant,v_branch,'money_bank.post') then
    raise exception using errcode='42501', message='Select a writable purchase branch with Money and Bank permission.';
  end if;
  select payload into v_payload from public.tenant_workspaces where tenant_id=v_tenant for update;
  select item into v_purchase from jsonb_array_elements(coalesce(v_payload->'purchases','[]'::jsonb)) as item
    where item->>'id'=p_purchase_id;
  if v_purchase is null then
    raise exception using errcode='P0002', message='Purchase was not found.';
  end if;
  if (nullif(v_purchase->>'branchId','') is not null and v_purchase->>'branchId'<>v_branch::text)
    or (nullif(v_purchase->>'branchId','') is null and not coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false))
  then
    raise exception using errcode='42501', message='The purchase belongs to another branch.';
  end if;
  v_payments := coalesce(v_purchase->'payments','[]'::jsonb);
  select item into v_previous from jsonb_array_elements(v_payments) as item where item->>'id'=p_payment_id::text;
  if v_previous is not null then
    if (v_previous->>'amount')::numeric <> p_amount or v_previous->>'fundingType'<>p_funding_type
      or (v_previous->>'sourceKey') is distinct from p_source_key then
      raise exception using errcode='23505', message='This payment ID was already used with different payment details.';
    end if;
    return jsonb_build_object('purchase',v_purchase,'status','already_recorded');
  end if;
  v_total := coalesce((v_purchase->>'totalAmount')::numeric,0);
  v_paid := coalesce((v_purchase->>'amountPaid')::numeric,0);
  if v_paid < 0 or v_total < v_paid or p_amount > v_total-v_paid then
    raise exception using errcode='23514', message='Payment exceeds the outstanding purchase amount.';
  end if;
  select currency_code into v_currency from public.tenants where id=v_tenant;
  v_payment := jsonb_build_object('id',p_payment_id,'amount',p_amount,'fundingType',p_funding_type,
    'accountName','External Account','paidAt',v_now,'recordedBy',v_actor,'currency',v_currency);
  if p_funding_type='registered' then
    select * into v_account from public.branch_payment_accounts
      where tenant_id=v_tenant and branch_id=v_branch and source_key=p_source_key
        and status='active' and not is_locked;
    if v_account.id is null or v_account.currency is distinct from v_currency then
      raise exception using errcode='23514', message='Select an active unlocked account in the purchase currency.';
    end if;
    v_post := public.post_current_tenant_treasury_split_outgoing_entry(
      v_branch,jsonb_build_array(jsonb_build_object('accountId',v_account.id,'amount',p_amount)),
      'supplier_payment',p_purchase_id,'purchase-installment:'||p_payment_id::text,
      'Purchase payment to '||coalesce(v_purchase->>'supplierName','supplier'),
      jsonb_build_object('purchaseId',p_purchase_id,'purchasePaymentId',p_payment_id,'supplierId',v_purchase->>'supplierId'));
    v_payment := v_payment || jsonb_build_object('sourceKey',p_source_key,'accountId',p_source_key,
      'accountName',v_account.account_name,'treasuryJournalId',v_post->>'journalId');
  end if;
  -- Preserve legacy initial funding when the first installment is appended.
  v_allocations := coalesce(v_purchase->'paymentAllocations','[]'::jsonb);
  if jsonb_array_length(v_allocations)=0 and v_paid>0 and nullif(v_purchase->>'paidFromAccountId','') is not null then
    v_allocations := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'fundingType','registered','accountId',v_purchase->>'paidFromAccountId','sourceKey',v_purchase->>'paidFromAccountId',
      'accountName',coalesce(v_purchase->>'paymentMethod','Original payment'),'amount',v_paid,
      'paidAt',v_purchase->>'timestamp','treasuryJournalId',v_purchase->>'treasuryJournalId')));
  end if;
  v_purchase := v_purchase || jsonb_build_object(
    'amountPaid',v_paid+p_amount,'amountDue',v_total-v_paid-p_amount,
    'payments',v_payments||jsonb_build_array(v_payment),
    'paymentAllocations',v_allocations||jsonb_build_array(v_payment),
    'syncUpdatedAt',v_now,'updatedAt',v_now);
  update public.tenant_workspaces set payload=jsonb_set(v_payload,'{purchases}',(
    select jsonb_agg(case when item->>'id'=p_purchase_id then v_purchase else item end order by ord)
    from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
  ),true),updated_at=v_now,updated_by=v_actor where tenant_id=v_tenant;
  return jsonb_build_object('purchase',v_purchase,'status','recorded');
end;
$$;
revoke all on function public.add_current_branch_purchase_payment(text,uuid,numeric,text,text) from public,anon;
grant execute on function public.add_current_branch_purchase_payment(text,uuid,numeric,text,text) to authenticated;

-- Installment totals/history are authoritative; delayed generic saves cannot undo them.
create or replace function private.preserve_purchase_payment_state(p_existing jsonb,p_incoming jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_incoming jsonb := coalesce(p_incoming,'[]'::jsonb);
  v_old jsonb;
  v_new jsonb;
  v_result jsonb := '[]'::jsonb;
  v_fields text[] := array['amountPaid','amountDue','payments','paymentAllocations','paidFromAccountId','paymentMethod','syncUpdatedAt','updatedAt'];
begin
  for v_new in select value from jsonb_array_elements(v_incoming) loop
    select value into v_old from jsonb_array_elements(coalesce(p_existing,'[]'::jsonb)) where value->>'id'=v_new->>'id';
    if jsonb_array_length(coalesce(v_old->'payments','[]'::jsonb))>0 then
      if (v_new->>'totalAmount')::numeric < (v_old->>'amountPaid')::numeric then
        raise exception using errcode='23514',message='Purchase total cannot be less than its recorded payments.';
      end if;
      v_new := (v_new-v_fields) || (select jsonb_object_agg(key,value) from jsonb_each(v_old) where key=any(v_fields));
      v_new := jsonb_set(v_new,'{amountDue}',to_jsonb((v_new->>'totalAmount')::numeric-(v_old->>'amountPaid')::numeric),true);
    end if;
    v_result := v_result||jsonb_build_array(v_new);
  end loop;
  for v_old in select value from jsonb_array_elements(coalesce(p_existing,'[]'::jsonb)) loop
    if jsonb_array_length(coalesce(v_old->'payments','[]'::jsonb))>0
      and not exists(select 1 from jsonb_array_elements(v_result) where value->>'id'=v_old->>'id') then
      v_result := v_result||jsonb_build_array(v_old);
    end if;
  end loop;
  return v_result;
end;
$$;
revoke all on function private.preserve_purchase_payment_state(jsonb,jsonb) from public,anon,authenticated;

do $patch$
declare v_definition text; v_signature text;
begin
  foreach v_signature in array array['public.save_current_branch_purchases(jsonb,jsonb,jsonb,jsonb)', 'public.save_current_branch_purchases(jsonb,jsonb,jsonb)'] loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if position('private.preserve_purchase_payment_state' in v_definition)=0 then
      v_definition := replace(v_definition,
        '  v_next_payload := jsonb_set(v_existing, ''{purchases}'', v_next_purchases, true);',
        '  v_next_purchases := private.preserve_purchase_payment_state(v_existing_purchases,v_next_purchases);'||chr(10)||
        '  v_next_payload := jsonb_set(v_existing, ''{purchases}'', v_next_purchases, true);');
      if position('private.preserve_purchase_payment_state' in v_definition)=0 then raise exception 'Purchase save patch target missing'; end if;
      execute v_definition;
    end if;
  end loop;
  v_definition := pg_get_functiondef('public.save_current_branch_workspace(jsonb)'::regprocedure);
  if position('private.preserve_purchase_payment_state' in v_definition)=0 then
    v_definition := replace(v_definition,
      '  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)',
      '  v_next := jsonb_set(v_next, ''{purchases}'', private.preserve_purchase_payment_state(v_existing->''purchases'',v_next->''purchases''),true);'||chr(10)||
      '  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)');
    if position('private.preserve_purchase_payment_state' in v_definition)=0 then raise exception 'Workspace patch target missing'; end if;
    execute v_definition;
  end if;
end;
$patch$;

CREATE OR REPLACE FUNCTION public.reverse_current_tenant_treasury_journal(p_journal_id uuid, p_idempotency_key text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_original public.treasury_journals%rowtype;
  v_existing public.treasury_journals%rowtype;
  v_line public.treasury_journal_lines%rowtype;
  v_reversal_id uuid;
  v_balance numeric(18, 2);
  v_payload jsonb;
  v_purchase jsonb;
  v_payment jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'Tenant authentication is required.';
  end if;
  if p_journal_id is null or nullif(btrim(p_idempotency_key), '') is null
    or nullif(btrim(p_reason), '') is null
  then
    raise exception using errcode = '22023', message = 'Journal, idempotency key, and reversal reason are required.';
  end if;

  select * into v_existing from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.journal_type <> 'reversal' or v_existing.reversal_of_journal_id <> p_journal_id then
      raise exception using errcode = '23505', message = 'Idempotency key was already used for another operation.';
    end if;
    return jsonb_build_object('journalId', v_existing.id, 'status', 'already_reversed');
  end if;

  select * into v_original from public.treasury_journals
  where tenant_id = v_tenant_id and id = p_journal_id and journal_type <> 'reversal';
  if not found then
    raise exception using errcode = 'P0002', message = 'Original treasury journal was not found.';
  end if;
  if exists (
    select 1 from public.treasury_journals
    where tenant_id = v_tenant_id and reversal_of_journal_id = p_journal_id
  ) then
    raise exception using errcode = '23505', message = 'Treasury journal was already reversed.';
  end if;

  for v_line in
    select * from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = p_journal_id
    order by account_id
  loop
    if not private.can_write_branch(v_tenant_id, v_line.branch_id, 'money_bank.reverse') then
      raise exception using errcode = '42501', message = 'Reversal permission is required for every affected branch.';
    end if;
  end loop;

  -- Lock the purchase before balances, in the same order as installment posting.
  if v_original.source_type='supplier_payment' and v_original.metadata ? 'purchasePaymentId' then
    select payload into v_payload from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    select item into v_purchase from jsonb_array_elements(v_payload->'purchases') as item where item->>'id'=v_original.source_id;
    select item into v_payment from jsonb_array_elements(v_purchase->'payments') as item
      where item->>'id'=v_original.metadata->>'purchasePaymentId'
        and item->>'treasuryJournalId'=p_journal_id::text and not item ? 'reversedAt';
    if v_payment is null then raise exception using errcode='23514',message='Purchase installment was not found or was already reversed.'; end if;
  end if;

  perform 1 from public.branch_account_balances
  where tenant_id = v_tenant_id
    and account_id in (
      select account_id from public.treasury_journal_lines
      where tenant_id = v_tenant_id and journal_id = p_journal_id
    )
    and currency = v_original.currency
  order by account_id
  for update;

  if exists (
    select 1
    from public.treasury_journal_lines line
    join public.branch_account_balances balance
      on balance.tenant_id = line.tenant_id
      and balance.account_id = line.account_id
      and balance.currency = line.currency
    where line.tenant_id = v_tenant_id
      and line.journal_id = p_journal_id
      and balance.current_balance - line.signed_amount < 0
  ) then
    raise exception using errcode = '23514', message = 'Reversal would create a negative account balance.';
  end if;

  insert into public.treasury_journals (
    tenant_id, journal_type, source_type, source_id, idempotency_key,
    reversal_of_journal_id, currency, description, external_cash_flow,
    posted_by, metadata
  ) values (
    v_tenant_id, 'reversal', v_original.source_type,
    v_original.source_id || ':reversal', btrim(p_idempotency_key),
    v_original.id, v_original.currency, btrim(p_reason),
    v_original.external_cash_flow, v_actor_id,
    jsonb_build_object('reason', btrim(p_reason), 'originalJournalId', v_original.id)
  ) returning id into v_reversal_id;

  for v_line in
    select * from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = p_journal_id
    order by account_id
  loop
    update public.branch_account_balances
    set current_balance = current_balance - v_line.signed_amount,
        row_version = row_version + 1,
        updated_at = now()
    where tenant_id = v_tenant_id
      and account_id = v_line.account_id
      and currency = v_line.currency
    returning current_balance into v_balance;

    insert into public.treasury_journal_lines (
      tenant_id, journal_id, branch_id, account_id, currency, signed_amount, balance_after
    ) values (
      v_tenant_id, v_reversal_id, v_line.branch_id, v_line.account_id,
      v_line.currency, -v_line.signed_amount, v_balance
    );
  end loop;

  if v_payment is not null then
    v_purchase := v_purchase || jsonb_build_object(
      'amountPaid',(v_purchase->>'amountPaid')::numeric-(v_payment->>'amount')::numeric,
      'amountDue',(v_purchase->>'totalAmount')::numeric-(v_purchase->>'amountPaid')::numeric+(v_payment->>'amount')::numeric,
      'payments',(select jsonb_agg(case when item->>'id'=v_payment->>'id' then item||jsonb_build_object('reversedAt',v_now,'reversalJournalId',v_reversal_id) else item end order by ord)
        from jsonb_array_elements(v_purchase->'payments') with ordinality as records(item,ord)),
      'paymentAllocations',coalesce((select jsonb_agg(item order by ord) from jsonb_array_elements(v_purchase->'paymentAllocations') with ordinality as records(item,ord) where item->>'id' is distinct from v_payment->>'id'),'[]'::jsonb),
      'syncUpdatedAt',v_now,'updatedAt',v_now);
    update public.tenant_workspaces set payload=jsonb_set(v_payload,'{purchases}',(
      select jsonb_agg(case when item->>'id'=v_original.source_id then v_purchase else item end order by ord)
      from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
    ),true),updated_at=v_now,updated_by=v_actor_id where tenant_id=v_tenant_id;
  end if;

  return jsonb_build_object(
    'journalId', v_reversal_id, 'reversalOfJournalId', v_original.id, 'status', 'reversed'
  );
end;
$function$
;


notify pgrst,'reload schema';

