-- One tenant-owner notification per newly saved POS sale, including the
-- separately-accounted delivery fee. Reuses the EXISTING branch inbox tables.
-- No additional client API calls, no financial writes and no legacy backfill.
begin;

create or replace function private.enqueue_pos_sale_owner_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_recipients uuid[];
  v_event_id uuid;
  v_product_amount numeric;
  v_delivery_amount numeric;
  v_total numeric;
  v_message text;
  v_sale_key text;
  v_delivery_method text;
  v_sales_method text;
  v_ref text;
begin
  -- This is for new POS checkouts only, not historical migrations,
  -- quotations, manual documents or normalization replays.
  if new.migration_batch_id is not null
     or coalesce(new.source_record->>'isManualPayment','false') <> 'true'
     or coalesce(new.legacy_id,'') not like 'sl-%' then
    return new;
  end if;

  select array_agg(u.id)
  into v_recipients
  from public.users u
  where u.tenant_id=new.tenant_id
    and u.is_active is distinct from false
    and (
      lower(coalesce(u.role,'')) in ('admin','owner','tenant_admin')
      or lower(coalesce(u.role_key,'')) in ('admin','owner','tenant_admin')
    );
  if coalesce(cardinality(v_recipients),0)=0 then
    return new;
  end if;

  v_total := greatest(coalesce(new.total,0),0);
  v_delivery_amount := greatest(coalesce(new.delivery_cost,0),0);
  v_product_amount := greatest(v_total-v_delivery_amount,0);
  v_sale_key := 'pos-sale-owner-summary:' || coalesce(new.legacy_id,new.id::text);
  v_ref := coalesce(nullif(new.reference,''),new.legacy_id,new.id::text);
  v_sales_method := coalesce(nullif(new.payment_method,''),'Not specified');
  v_delivery_method := coalesce(nullif(new.delivery_payment_method,''),'Not specified');

  v_message := 'Rejea: ' || v_ref
    || E'\nSales (bidhaa): TSh ' || trim(to_char(v_product_amount,'FM999G999G999G999G990'))
    || E'\nMalipo ya bidhaa: ' || v_sales_method;

  if v_delivery_amount>0 then
    v_message := v_message
      || E'\nDelivery (ada): TSh ' || trim(to_char(v_delivery_amount,'FM999G999G999G999G990'))
      || E'\nNjia ya malipo ya delivery: ' || v_delivery_method
      || E'\nHali ya delivery: Pending Dispatch'
      || E'\nMalipo ya delivery: hayajathibitishwa kwenye treasury';
  end if;
  v_message := v_message
    || E'\nJumla ya agizo: TSh ' || trim(to_char(v_total,'FM999G999G999G999G990'))
    || E'\nMuuzaji: ' || coalesce(nullif(new.cashier_name,''),'—');

  -- The existing per-tenant idempotency index prevents duplicate notices
  -- when the same POS sale is replayed. These inserts are in the same SQL
  -- transaction as the sale: if checkout rolls back, its notice rolls back.
  insert into public.branch_notification_events(
    tenant_id,branch_id,event_type,module_name,title,message,
    entity_type,entity_id,priority,idempotency_key,payload
  ) values (
    new.tenant_id,null,'sale','sales',
    'Mauzo yamekamilika na kuhifadhiwa',v_message,
    'sale',coalesce(new.legacy_id,new.id::text),'normal',v_sale_key,
    jsonb_build_object(
      'saleId',coalesce(new.legacy_id,new.id::text),
      'productAmount',v_product_amount,
      'deliveryAmount',v_delivery_amount,
      'checkoutTotal',v_total,
      'productPaymentMethod',v_sales_method,
      'deliveryPaymentMethod',v_delivery_method,
      'deliveryStatus',case when v_delivery_amount>0 then 'Pending Dispatch' else null end
    )
  )
  on conflict (tenant_id,idempotency_key)
    where idempotency_key is not null do nothing
  returning id into v_event_id;

  if v_event_id is null then return new; end if;

  insert into public.branch_notification_recipients(
    tenant_id,event_id,recipient_user_id,delivery_channel,delivery_status
  )
  select new.tenant_id,v_event_id,r.recipient_id,'in_app','pending'
  from (select distinct unnest(v_recipients) recipient_id) r
  on conflict (tenant_id,event_id,recipient_user_id,delivery_channel) do nothing;

  return new;
end;
$function$;

drop trigger if exists pos_sale_owner_summary_notice on public.sales;
create trigger pos_sale_owner_summary_notice
after insert on public.sales
for each row execute function private.enqueue_pos_sale_owner_summary();

commit;
