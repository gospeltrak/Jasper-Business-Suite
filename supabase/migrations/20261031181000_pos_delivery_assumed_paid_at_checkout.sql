-- Simple delivery rule (Oct 31): choosing a delivery payment mode at POS
-- immediately records the DELIVERY fee as "collected" in its own treasury source.
-- Cash-on-delivery is treated as deemed received by the business owner.
-- Do not credit Sales; do not credit Delivery again at Dispatch/Delivered.
-- One authenticated RPC, one PostgreSQL transaction, idempotent journal keys.
begin;

create or replace function public.post_current_branch_pos_sale_with_delivery(
  p_sale jsonb,
  p_lines jsonb,
  p_delivery_account_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_sale_id text;
  v_delivery_id text;
  v_fee numeric(18,2);
  v_product_total numeric(18,2);
  v_product_paid numeric(18,2);
  v_delivery_method text;
  v_account public.branch_payment_accounts%rowtype;
  v_sale_result jsonb;
  v_sale_journal uuid;
  v_delivery_journal uuid := gen_random_uuid();
  v_sale_uuid uuid;
  v_balance numeric(18,2);
  v_now timestamptz := transaction_timestamp();
  v_delivery jsonb;
  v_saved jsonb;
begin
  if v_actor is null or v_tenant is null
    or not private.is_active_tenant_member(v_tenant) then
    raise exception using errcode='42501',message='Active tenant session required.';
  end if;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  if v_context->>'activeScope' is distinct from 'branch'
    or v_branch is null
    or not private.can_write_branch(v_tenant,v_branch,'pos.write') then
    raise exception using errcode='42501',message='Select an authorized POS branch.';
  end if;
  if p_sale is null or jsonb_typeof(p_sale)<>'object'
    or p_sale->>'tenantId' is distinct from v_tenant::text
    or nullif(p_sale->>'id','') is null
    or length(p_sale->>'id')>170
    or p_sale->>'id' not like 'sl-%'
    or jsonb_typeof(p_sale->'items')<>'array'
    or jsonb_array_length(p_sale->'items') not between 1 and 500
    or nullif(p_sale->>'treasuryJournalId','') is not null
    or (nullif(p_sale->>'branchId','') is not null
       and p_sale->>'branchId' is distinct from v_branch::text) then
    raise exception using errcode='22023',message='Invalid POS sale with delivery.';
  end if;
  v_sale_id := p_sale->>'id';
  v_delivery_id := 'DL-'||upper(substr(v_sale_id,4));
  v_fee := round(coalesce((p_sale->>'deliveryCost')::numeric,0),2);
  v_product_total := round(coalesce((p_sale->>'total')::numeric,0)-v_fee,2);
  v_delivery_method := nullif(btrim(p_sale->>'deliveryPaymentMethod'),'');
  if v_fee<=0 or v_fee>9999999999999999.99
     or v_product_total<=0
     or v_delivery_method is null
     or p_delivery_account_id is null
     or nullif(v_sale_id,'') is null then
    raise exception using errcode='22023',message='Choose a delivery fee and payment mode.';
  end if;
  if nullif(p_sale->>'productTotal','') is not null
    and round((p_sale->>'productTotal')::numeric,2) is distinct from v_product_total then
    raise exception using errcode='23514',message='Product and delivery totals do not match.';
  end if;
  v_product_paid := least(v_product_total,
    greatest(0,round(coalesce((p_sale->>'amountPaid')::numeric,0),2)));
  if v_product_paid is null or v_product_paid<0 then
    raise exception using errcode='22023',message='Invalid product payment amount.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' then
    raise exception using errcode='22023',message='Invalid product payment lines.';
  end if;
  if v_product_paid=0 and jsonb_array_length(p_lines)<>0 then
    raise exception using errcode='23514',message='No product payment should have no payment lines.';
  end if;
  if v_product_paid>0 and jsonb_array_length(p_lines)=0 then
    raise exception using errcode='23514',message='Product payment lines are required.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sale->'items') line
    where nullif(line->>'productId','') is null
      or coalesce((line->>'qty')::numeric,0)<=0
      or coalesce((line->>'price')::numeric,-1)<0
  ) then
    raise exception using errcode='22023',message='Invalid POS product lines.';
  end if;

  -- Fee is booked to the exact delivery account selected by the cashier;
  -- the server validates ownership and branch, never trusting a UI label.
  select * into v_account from public.branch_payment_accounts
    where id=p_delivery_account_id and tenant_id=v_tenant
      and branch_id=v_branch and status='active' and not is_locked;
  if v_account.id is null
     or lower(btrim(v_account.source_key))<>lower(btrim(
       coalesce(p_sale->>'deliveryPaymentAccountKey',v_account.source_key))) then
    raise exception using errcode='23514',message='Delivery payment account is unavailable.';
  end if;
  if not private.normalized_writes_enabled(v_tenant) then
    raise exception using errcode='23514',message='Normalized delivery checkout is not enabled.';
  end if;

  -- Existing paid-sale RPC atomically posts only PRODUCT money and saves the
  -- sale. This new wrapper adds delivery in the SAME database transaction.
  if v_product_paid>0 then
    v_sale_result := public.post_current_branch_pos_sale(p_sale,p_lines);
    if v_sale_result->>'status'='already_posted' then
      -- A retry must never create another journal. Caller may refresh data.
      if exists(
        select 1 from public.treasury_journals
        where tenant_id=v_tenant
          and idempotency_key='delivery:'||v_delivery_id||':v1'
      ) then
        return jsonb_build_object(
          'journalId',v_sale_result->>'journalId',
          'deliveryJournalId',(
            select id from public.treasury_journals
             where tenant_id=v_tenant
               and idempotency_key='delivery:'||v_delivery_id||':v1'),
          'delivery',(
            select d.source_record from public.deliveries d
            where d.tenant_id=v_tenant and d.legacy_id=v_delivery_id
              and d.source_active is distinct from false),
          'branchId',v_branch,'status','already_posted');
      end if;
      raise exception using errcode='23505',
        message='Existing sale has no delivery treasury posting. Check history.';
    end if;
    v_sale_journal := nullif(v_sale_result->>'journalId','')::uuid;
    if not exists(
      select 1 from public.treasury_journals j
      where j.id=v_sale_journal and j.tenant_id=v_tenant
        and j.currency=v_account.currency
        and j.source_type='sale' and j.source_id=v_sale_id
    ) then
      raise exception using errcode='23514',
        message='Sale and delivery currencies must match.';
    end if;
  else
    -- Credit/unpaid products still create a delivery that is deemed PAID;
    -- only the product balance stays under customer debt.
    if coalesce((p_sale->>'amountPaid')::numeric,0)<>0 then
      raise exception using errcode='23514',message='Unpaid products cannot post sale cash.';
    end if;
    if exists(
      select 1 from public.sales where tenant_id=v_tenant and legacy_id=v_sale_id
    ) then
      raise exception using errcode='23505',message='This sale already exists.';
    end if;
    v_saved := public.save_current_branch_sales(
      jsonb_build_array(p_sale||jsonb_build_object(
        'branchId',v_branch::text,
        'paymentStatus','unpaid','amountDue',v_product_total
      )), '{}'::jsonb,null,null);
    if not exists (
      select 1 from jsonb_array_elements(coalesce(v_saved->'sales','[]'::jsonb)) entry
      where entry->>'id'=v_sale_id
    ) then
      raise exception using errcode='23514',message='Unpaid product sale could not be saved.';
    end if;
  end if;

  select id into v_sale_uuid from public.sales
  where tenant_id=v_tenant and legacy_id=v_sale_id and source_active is distinct from false;
  if v_sale_uuid is null then
    raise exception using errcode='23514',message='Normalized product sale is missing.';
  end if;
  if exists(select 1 from public.deliveries
            where tenant_id=v_tenant and legacy_id=v_delivery_id) then
    raise exception using errcode='23505',message='Delivery already exists.';
  end if;

  -- Acquire the payment-account lock AFTER the sale/workspace lock, using
  -- the same order as other sale and collection writers to avoid deadlocks.
  -- Revalidate that the selected delivery account was not disabled mid-sale.
  select * into v_account from public.branch_payment_accounts
    where id=p_delivery_account_id and tenant_id=v_tenant
      and branch_id=v_branch and status='active' and not is_locked
    for update;
  if v_account.id is null then
    raise exception using errcode='23514',message='Delivery payment account was disabled during checkout.';
  end if;

  -- Accounting classification: Delivery only. The "paid" assumption is
  -- documented for audit, including Cash On Delivery, without another prompt.
  insert into public.treasury_journals(
    id,tenant_id,journal_type,source_type,source_id,idempotency_key,
    currency,description,external_cash_flow,posted_by,metadata
  ) values (
    v_delivery_journal,v_tenant,'money_in','delivery',v_delivery_id,
    'delivery:'||v_delivery_id||':v1',v_account.currency,
    'Delivery fee from POS '||left(v_sale_id,140),
    true,v_actor,
    jsonb_build_object('saleId',v_sale_id,'assumedPaidAtCheckout',true,
      'deliveryPaymentMethod',v_delivery_method,
      'sourceAccountKey',v_account.source_key)
  );
  insert into public.branch_account_balances(
    tenant_id,branch_id,account_id,currency,current_balance,row_version
  ) values (v_tenant,v_branch,v_account.id,v_account.currency,0,0)
  on conflict (tenant_id,account_id,currency) do nothing;

  update public.branch_account_balances
    set current_balance=current_balance+v_fee,
      row_version=row_version+1,updated_at=v_now
  where tenant_id=v_tenant and account_id=v_account.id and currency=v_account.currency
  returning current_balance into v_balance;
  if not found then
    raise exception using errcode='23514',message='Delivery treasury account balance is unavailable.';
  end if;
  insert into public.treasury_journal_lines(
    tenant_id,journal_id,branch_id,account_id,currency,signed_amount,balance_after
  ) values (v_tenant,v_delivery_journal,v_branch,v_account.id,v_account.currency,v_fee,v_balance);

  v_delivery := jsonb_build_object(
    'id',v_delivery_id,'saleId',v_sale_id,
    'customerName',coalesce(nullif(p_sale->>'customerName',''),'Walk-In Customer'),
    'customerPhone',coalesce(p_sale->>'customerPhone',''),
    'items',p_sale->'items','totalAmount',(p_sale->>'total')::numeric,
    'deliveryCost',v_fee,'deliveryPaymentMethod',v_delivery_method,
    'deliveryPaymentAccountId',v_account.source_key,
    'deliveryPaymentStatus','collected','paymentCollectedAt',v_now,
    'assumedPaidAtCheckout',true,
    'treasuryJournalId',v_delivery_journal::text,
    'status','Pending Dispatch',
    'timestamp',coalesce(nullif(p_sale->>'timestamp','')::timestamptz,v_now),
    'tenantId',v_tenant::text,'branchId',v_branch::text,
    'syncUpdatedAt',v_now
  );
  insert into public.deliveries(
    tenant_id,legacy_id,sale_id,customer_name,customer_phone,
    total_amount,delivery_cost,delivery_payment_method,status,"timestamp",
    branch_id,source_updated_at,source_payload_hash,source_record,source_active
  ) values (
    v_tenant,v_delivery_id,v_sale_uuid,
    v_delivery->>'customerName',v_delivery->>'customerPhone',
    (p_sale->>'total')::numeric,v_fee,v_delivery_method,'Pending Dispatch',
    (v_delivery->>'timestamp')::timestamptz,
    v_branch,v_now,md5(v_delivery::text),v_delivery,true
  );
  return jsonb_build_object(
    'journalId',v_sale_journal,'deliveryJournalId',v_delivery_journal,
    'delivery',v_delivery,'branchId',v_branch,'status','posted'
  );
end;
$function$;
revoke all on function public.post_current_branch_pos_sale_with_delivery(jsonb,jsonb,uuid)
  from public,anon;
grant execute on function public.post_current_branch_pos_sale_with_delivery(jsonb,jsonb,uuid)
  to authenticated;
commit;
