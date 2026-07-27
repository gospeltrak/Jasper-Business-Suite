-- Atomic same-tenant branch stock posting for enabled multi-branch tenants.
-- Additive only: no existing tenant, product, stock, sale, or transfer row is deleted.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.transfer_stock_between_current_tenant_branches(
  p_from_branch_id uuid,
  p_to_branch_id uuid,
  p_product_id text,
  p_quantity numeric,
  p_idempotency_key text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_source public.branch_stock%rowtype;
  v_destination public.branch_stock%rowtype;
  v_transfer_id uuid;
  v_source_warehouse uuid;
  v_destination_warehouse uuid;
  v_from_store numeric;
  v_from_shop numeric;
begin
  if v_actor_id is null then raise exception using errcode = '42501', message = 'Sign in is required.'; end if;
  if p_from_branch_id is null or p_to_branch_id is null or p_from_branch_id = p_to_branch_id then
    raise exception using errcode = '22023', message = 'Choose two different branches.';
  end if;
  if nullif(btrim(p_product_id), '') is null or coalesce(p_quantity, 0) <= 0 then
    raise exception using errcode = '22023', message = 'A product and positive quantity are required.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;

  select app_user.tenant_id into v_tenant_id
  from public.users app_user
  where app_user.id = v_actor_id;
  if v_tenant_id is null then raise exception using errcode = '42501', message = 'Tenant access was not found.'; end if;
  if not coalesce(private.can_operate_additional_branches(v_tenant_id), false) then
    raise exception using errcode = '42501', message = 'Tanzanite multi-branch stock transfer is not enabled for this tenant.';
  end if;

  perform 1 from public.branches
  where tenant_id = v_tenant_id and id in (p_from_branch_id, p_to_branch_id) and status = 'active';
  if (select count(*) from public.branches where tenant_id = v_tenant_id and id in (p_from_branch_id, p_to_branch_id) and status = 'active') <> 2 then
    raise exception using errcode = '42501', message = 'Both branches must belong to the active tenant.';
  end if;

  select * into v_source from public.branch_stock
  where tenant_id = v_tenant_id and branch_id = p_from_branch_id and product_id = p_product_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Source branch stock was not found.'; end if;
  if v_source.quantity < p_quantity then
    raise exception using errcode = '23514', message = format('Insufficient stock. Available: %s.', v_source.quantity);
  end if;

  select * into v_destination from public.branch_stock
  where tenant_id = v_tenant_id and branch_id = p_to_branch_id and product_id = p_product_id
  for update;
  if not found then
    insert into public.branch_stock (
      tenant_id, branch_id, product_id, quantity, shop_stock_qty, store_stock_qty,
      buying_price, selling_price, low_stock_alert
    ) values (
      v_tenant_id, p_to_branch_id, p_product_id, 0, 0, 0,
      v_source.buying_price, v_source.selling_price, v_source.low_stock_alert
    )
    returning * into v_destination;
  end if;

  select link.warehouse_id into v_source_warehouse
  from public.branch_warehouse_links link
  join public.warehouses warehouse on warehouse.id = link.warehouse_id and warehouse.tenant_id = link.tenant_id
  where link.tenant_id = v_tenant_id and link.branch_id = p_from_branch_id
    and warehouse.status = 'active' and warehouse.archived_at is null
  order by link.is_primary desc, link.created_at asc limit 1;
  select link.warehouse_id into v_destination_warehouse
  from public.branch_warehouse_links link
  join public.warehouses warehouse on warehouse.id = link.warehouse_id and warehouse.tenant_id = link.tenant_id
  where link.tenant_id = v_tenant_id and link.branch_id = p_to_branch_id
    and warehouse.status = 'active' and warehouse.archived_at is null
  order by link.is_primary desc, link.created_at asc limit 1;
  if v_source_warehouse is null or v_destination_warehouse is null then
    raise exception using errcode = '23514', message = 'Both branches require an active warehouse before stock can be transferred.';
  end if;

  v_from_store := least(v_source.store_stock_qty, p_quantity);
  v_from_shop := p_quantity - v_from_store;

  update public.branch_stock
  set quantity = quantity - p_quantity,
      store_stock_qty = store_stock_qty - v_from_store,
      shop_stock_qty = shop_stock_qty - v_from_shop,
      updated_at = now()
  where id = v_source.id;
  update public.branch_stock
  set quantity = quantity + p_quantity,
      store_stock_qty = store_stock_qty + p_quantity,
      updated_at = now()
  where id = v_destination.id;

  insert into public.branch_inventory_transfers (
    tenant_id, from_branch_id, to_branch_id, product_id, quantity, notes,
    status, created_by, approved_by, received_by, transfer_number,
    source_warehouse_id, destination_warehouse_id, transfer_date,
    requested_at, approved_at, dispatched_at, received_at, finalized_at,
    idempotency_key
  ) values (
    v_tenant_id, p_from_branch_id, p_to_branch_id, p_product_id, p_quantity, nullif(btrim(p_notes), ''),
    'received', v_actor_id, v_actor_id, v_actor_id,
    'TRF-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    v_source_warehouse, v_destination_warehouse, now(),
    now(), now(), now(), now(), now(), btrim(p_idempotency_key)
  )
  on conflict (tenant_id, idempotency_key) where idempotency_key is not null
  do update set idempotency_key = excluded.idempotency_key
  returning id into v_transfer_id;

  return jsonb_build_object(
    'transferId', v_transfer_id,
    'fromBranchId', p_from_branch_id,
    'toBranchId', p_to_branch_id,
    'productId', p_product_id,
    'quantity', p_quantity,
    'status', 'received'
  );
end;
$$;

revoke all on function public.transfer_stock_between_current_tenant_branches(uuid, uuid, text, numeric, text, text) from public, anon;
grant execute on function public.transfer_stock_between_current_tenant_branches(uuid, uuid, text, numeric, text, text) to authenticated;

commit;
