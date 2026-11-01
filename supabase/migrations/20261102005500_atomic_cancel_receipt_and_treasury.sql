-- Receipt cancellation is one PostgreSQL transaction: sale/stock/delivery
-- changes and treasury reversal must either all commit or all roll back.
-- Additive only: no existing rows are changed by applying this migration.
create or replace function public.cancel_current_branch_sale(
  p_sale_id text,
  p_sales jsonb,
  p_sale_tombstones jsonb,
  p_products jsonb,
  p_deliveries jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_actor uuid := auth.uid();
  v_snapshot jsonb;
  v_sale jsonb;
  v_delivery jsonb;
  v_saved jsonb;
  v_journal text;
begin
  if v_actor is null or v_tenant is null then
    raise exception using errcode='42501', message='Sign in before cancelling a receipt.';
  end if;
  if nullif(btrim(p_sale_id), '') is null or length(p_sale_id)>120
    or jsonb_typeof(p_sales) is distinct from 'array'
    or jsonb_typeof(p_sale_tombstones) is distinct from 'object'
    or jsonb_typeof(p_products) is distinct from 'array'
    or jsonb_typeof(p_deliveries) is distinct from 'array'
  then
    raise exception using errcode='22023', message='A valid receipt and complete cancellation changes are required.';
  end if;
  if not (p_sale_tombstones ? p_sale_id)
    or nullif(p_sale_tombstones->>p_sale_id,'') is null
    or exists (select 1 from jsonb_array_elements(p_sales) s where s->>'id'=p_sale_id)
  then
    raise exception using errcode='22023', message='The cancellation must target exactly the selected receipt.';
  end if;

  -- Serialize with POS checkout, payment posting and normal workspace saves.
  perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
  if private.normalized_writes_enabled(v_tenant) then
    v_snapshot:=private.normalized_mutation_snapshot(v_tenant,array['sales','deliveries']);
  else
    select payload into v_snapshot from public.tenant_workspaces where tenant_id=v_tenant;
  end if;
  v_snapshot:=coalesce(v_snapshot,'{}'::jsonb);

  select s.value into v_sale
  from jsonb_array_elements(coalesce(v_snapshot->'sales','[]'::jsonb)) as s(value)
  where s.value->>'id'=p_sale_id
  limit 1;
  if v_sale is null then
    raise exception using errcode='P0002', message='Receipt is no longer present. Refresh Sales before retrying.';
  end if;
  -- Customer installments carry an immutable payment audit trail.
  if jsonb_array_length(coalesce(v_sale->'payments','[]'::jsonb))>0 then
    raise exception using errcode='23514', message='This receipt has recorded customer installments. It must stay in the payment audit history; use an authorized refund or reversal workflow.';
  end if;

  -- Verify the caller is not inadvertently leaving the linked delivery in the
  -- outgoing ledger. The existing save RPC enforces tenant and branch access.
  for v_delivery in
    select d.value from jsonb_array_elements(coalesce(v_snapshot->'deliveries','[]'::jsonb)) d(value)
    where d.value->>'saleId'=p_sale_id
  loop
    if exists (
      select 1 from jsonb_array_elements(p_deliveries) submitted
      where submitted->>'id'=v_delivery->>'id'
    ) then
      raise exception using errcode='22023', message='A linked delivery must be cancelled with its receipt.';
    end if;
  end loop;

  -- Existing RPC validates branch access, applies stock restoration and
  -- tombstones, and persists the selected sales and deliveries atomically.
  v_saved:=public.save_current_branch_sales(
    p_sales,p_sale_tombstones,p_products,p_deliveries
  );
  if jsonb_typeof(v_saved->'sales') is distinct from 'array' or exists (
    select 1 from jsonb_array_elements(v_saved->'sales') saved
    where saved->>'id'=p_sale_id
  ) then
    raise exception using errcode='40001', message='Receipt cancellation was not confirmed. Refresh and retry.';
  end if;

  -- Money & Bank reversals happen INSIDE THE SAME DB TRANSACTION. An account
  -- with insufficient funds or missing reversal permission rolls back stock,
  -- sales and delivery together instead of leaving half-cancelled receipts.
  v_journal:=nullif(v_sale->>'treasuryJournalId','');
  if v_journal is not null then
    perform public.reverse_current_tenant_treasury_journal(
      v_journal::uuid, 'reversal:'||p_sale_id||':v1',
      'Cancelled receipt '||p_sale_id
    );
  end if;

  -- Delivery fees may have a separate treasury posting, especially when
  -- collected at delivery or posted as paid at checkout.
  for v_delivery in
    select d.value from jsonb_array_elements(coalesce(v_snapshot->'deliveries','[]'::jsonb)) d(value)
    where d.value->>'saleId'=p_sale_id
  loop
    v_journal:=nullif(v_delivery->>'treasuryJournalId','');
    if v_journal is not null and v_journal is distinct from nullif(v_sale->>'treasuryJournalId','') then
      perform public.reverse_current_tenant_treasury_journal(
        v_journal::uuid, 'reversal:delivery:'||(v_delivery->>'id')||':v1',
        'Cancelled delivery for receipt '||p_sale_id
      );
    end if;
  end loop;
  return v_saved || jsonb_build_object('status','cancelled','saleId',p_sale_id);
end;
$$;

revoke all on function public.cancel_current_branch_sale(text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.cancel_current_branch_sale(text,jsonb,jsonb,jsonb,jsonb) to authenticated;
