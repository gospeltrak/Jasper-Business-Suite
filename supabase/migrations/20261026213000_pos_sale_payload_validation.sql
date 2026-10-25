-- POS checkout data-shape diagnostics and authenticated branch normalization.
-- No DML against existing customer data. No grants beyond the existing POS RPC.
-- Replaces only post_current_branch_pos_sale; other Money & Bank permissions remain unchanged.
create or replace function public.post_current_branch_pos_sale(
  p_sale jsonb, p_lines jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_sale_id text;
  v_income numeric(18,2);
  v_paid numeric(18,2);
  v_line_total numeric(18,2);
  v_currency text;
  v_journal_id uuid := gen_random_uuid();
  v_existing public.treasury_journals%rowtype;
  v_sale_with_journal jsonb;
  v_snapshot jsonb;
  v_sales jsonb;
  v_item jsonb;
  v_account uuid;
  v_amount numeric(18,2);
  v_balance numeric(18,2);
  v_saved jsonb;
begin
  if v_actor is null or v_tenant is null
    or not private.is_active_tenant_member(v_tenant) then
    raise exception using errcode='42501', message='An active tenant session is required.';
  end if;
  v_context := public.get_current_branch_context();
  if v_context->>'activeScope' is distinct from 'branch' then
    raise exception using errcode='42501', message='Select one active branch to process a POS payment.';
  end if;
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  if v_branch is null or not private.can_write_branch(v_tenant,v_branch,'pos.write') then
    raise exception using errcode='42501', message='POS sale permission is required for the selected branch.';
  end if;

  -- Independent validations: before this patch, unrelated malformed fields
  -- collapsed into one generic 22023, making cashiers unable to resolve the
  -- branch/sale mismatch. Never expose customer/product data in these errors.
  if p_sale is null or jsonb_typeof(p_sale) is distinct from 'object' then
    raise exception using errcode='22023',
      message='POS sale payload is missing. Please reopen the cart.';
  end if;
  if p_sale->>'tenantId' is distinct from v_tenant::text then
    raise exception using errcode='22023',
      message='POS business context changed. Sign in to the correct business.';
  end if;
  -- Client may omit branchId; derive it ONLY from the authenticated staff's
  -- selected active branch. NEVER trust a client-supplied different branch.
  if nullif(p_sale->>'branchId','') is not null
    and p_sale->>'branchId' is distinct from v_branch::text then
    raise exception using errcode='22023',
      message='POS branch is out of sync. Re-select your branch before checkout.';
  end if;
  if jsonb_typeof(p_sale->'items') is distinct from 'array'
    or jsonb_array_length(coalesce(p_sale->'items','[]'::jsonb)) not between 1 and 500 then
    raise exception using errcode='22023',
      message='POS cart must contain between 1 and 500 items.';
  end if;
  if nullif(btrim(p_sale->>'id'),'') is null or length(p_sale->>'id')>180 then
    raise exception using errcode='22023',
      message='POS sale reference is invalid. Please reopen the cart.';
  end if;
  if p_sale->>'treasuryJournalId' is not null then
    raise exception using errcode='22023',
      message='POS sale already carries a payment reference. Check Sales before retrying.';
  end if;
  v_sale_id := btrim(p_sale->>'id');
  if p_lines is null or jsonb_typeof(p_lines)<>'array'
    or jsonb_array_length(p_lines) not between 1 and 20 then
    raise exception using errcode='22023', message='At least one valid payment account is required.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sale->'items') as item
    where nullif(item->>'productId','') is null
      or coalesce((item->>'qty')::numeric,0)<=0
      or coalesce((item->>'price')::numeric,-1)<0
  ) then
    raise exception using errcode='22023', message='POS sale items must have a product, quantity and price.';
  end if;
  v_income := round((p_sale->>'total')::numeric-coalesce((p_sale->>'deliveryCost')::numeric,0),2);
  -- POS revenue excludes delivery fees, even if the customer pays both together.
  v_paid := least(v_income, greatest(0, round(coalesce((p_sale->>'amountPaid')::numeric,v_income),2)));
  if v_income is null or v_income<=0 or v_paid is null or v_paid<=0
    or v_income>9999999999999999.99 or v_paid>v_income
    or (p_sale->>'paymentStatus'='paid' and v_income-v_paid>0.01)
  then
    raise exception using errcode='22023', message='POS payment cannot exceed sale revenue.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) as supplied(item)
    where jsonb_typeof(supplied.item)<>'object'
      or nullif(supplied.item->>'accountId','') is null
      or nullif(supplied.item->>'amount','') is null
      or (supplied.item->>'amount')::numeric <= 0
      or (supplied.item->>'amount')::numeric <> round((supplied.item->>'amount')::numeric,2)
  ) then
    raise exception using errcode='22023', message='Every payment line must have a valid positive amount.';
  end if;
  select sum((item->>'amount')::numeric)::numeric(18,2)
    into v_line_total from jsonb_array_elements(p_lines) as item;
  if v_line_total is distinct from v_paid then
    raise exception using errcode='23514', message='Collected payment must match POS sale amount paid.';
  end if;
  if (select count(distinct item->>'accountId') from jsonb_array_elements(p_lines) as item)
     <> jsonb_array_length(p_lines) then
    raise exception using errcode='22023', message='POS split payment accounts must be unique.';
  end if;

  -- Serialize all checkouts for a tenant. The save_current_branch_sales RPC
  -- uses this same row lock so a retry cannot insert a duplicate sale.
  perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
  if private.normalized_writes_enabled(v_tenant) then
    v_snapshot := private.normalized_mutation_snapshot(v_tenant,array['sales']);
  else
    select payload into v_snapshot from public.tenant_workspaces where tenant_id=v_tenant;
  end if;
  v_sales := coalesce(v_snapshot->'sales','[]'::jsonb);

  select * into v_existing from public.treasury_journals
  where tenant_id=v_tenant and idempotency_key='sale:'||v_sale_id||':v1';
  if found then
    if v_existing.source_type<>'sale' or v_existing.source_id<>v_sale_id
      or not exists (select 1 from jsonb_array_elements(v_sales) as item
        where item->>'id'=v_sale_id
          and item->>'treasuryJournalId'=v_existing.id::text
          and abs(least(v_income,greatest(0,coalesce((item->>'amountPaid')::numeric,v_income)))-v_paid)<0.01)
    then
      raise exception using errcode='23505', message='Sale idempotency key conflicts with an existing posting.';
    end if;
    return jsonb_build_object('journalId',v_existing.id,'branchId',v_branch,'status','already_posted');
  end if;
  if exists (select 1 from jsonb_array_elements(v_sales) as item where item->>'id'=v_sale_id) then
    raise exception using errcode='23505', message='This sale already exists without a matching payment journal.';
  end if;

  select min(a.currency) into v_currency
  from jsonb_array_elements(p_lines) supplied(item)
  join public.branch_payment_accounts a
    on a.id=(supplied.item->>'accountId')::uuid and a.tenant_id=v_tenant
    and a.branch_id=v_branch and a.status='active' and not a.is_locked;
  if v_currency is null or exists (
    select 1 from jsonb_array_elements(p_lines) supplied(item)
    left join public.branch_payment_accounts a
      on a.id=(supplied.item->>'accountId')::uuid and a.tenant_id=v_tenant
      and a.branch_id=v_branch and a.status='active' and not a.is_locked
    where a.id is null or a.currency<>v_currency
  ) then
    raise exception using errcode='23514', message='POS payments require active accounts in one branch and currency.';
  end if;

  insert into public.treasury_journals
    (id,tenant_id,journal_type,source_type,source_id,idempotency_key,currency,
     description,external_cash_flow,posted_by,metadata)
  values
    (v_journal_id,v_tenant,'money_in','sale',v_sale_id,'sale:'||v_sale_id||':v1',
     v_currency,'POS sale '||left(coalesce(p_sale->>'reference',v_sale_id),160),
     true,v_actor,jsonb_build_object('posSaleId',v_sale_id,'cashier',coalesce(p_sale->>'cashierName','')));

  for v_item in select value from jsonb_array_elements(p_lines) order by value->>'accountId'
  loop
    v_account := (v_item->>'accountId')::uuid;
    v_amount := (v_item->>'amount')::numeric;
    insert into public.branch_account_balances
      (tenant_id,branch_id,account_id,currency,current_balance,row_version)
    values (v_tenant,v_branch,v_account,v_currency,0,0)
    on conflict (tenant_id,account_id,currency) do nothing;
    update public.branch_account_balances
    set current_balance=current_balance+v_amount,
        row_version=row_version+1,updated_at=now()
    where tenant_id=v_tenant and account_id=v_account and currency=v_currency
    returning current_balance into v_balance;
    insert into public.treasury_journal_lines
      (tenant_id,journal_id,branch_id,account_id,currency,signed_amount,balance_after)
    values (v_tenant,v_journal_id,v_branch,v_account,v_currency,v_amount,v_balance);
  end loop;

  -- Trust the validated payment lines and server-selected branch rather than
  -- an outdated UI paymentStatus field. The paid amount is still checked
  -- against sale revenue, preserving no-overpayment and no-double-posting.
  v_sale_with_journal := p_sale || jsonb_build_object(
    'branchId',v_branch::text,
    'paymentStatus',case when v_paid>=v_income then 'paid' else 'partial' end,
    'treasuryJournalId',v_journal_id::text
  );
  v_saved := public.save_current_branch_sales(jsonb_build_array(v_sale_with_journal));
  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_saved->'sales','[]'::jsonb)) as item
    where item->>'id'=v_sale_id and item->>'treasuryJournalId'=v_journal_id::text
  ) then
    raise exception using errcode='23514', message='POS sale was not persisted with the payment journal.';
  end if;
  return jsonb_build_object('journalId',v_journal_id,'branchId',v_branch,'status','posted');
end;
$function$;
