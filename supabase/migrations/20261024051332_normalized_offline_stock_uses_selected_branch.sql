create or replace function private.offline_normalized_branch_stock(p_tenant_id uuid,p_record jsonb,p_direction text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_context jsonb;v_branch uuid;v_stocks jsonb;v_product jsonb;v_stock jsonb;v_item jsonb;v_qty numeric;v_store boolean;
begin
 v_context:=public.get_current_branch_context();v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
 if v_context->>'activeScope'<>'branch' or v_branch is null then raise exception using errcode='42501',message='Select the branch for offline sync.';end if;
 v_stocks:=private.normalized_business_snapshot(p_tenant_id,array['branchStocks'])->'branchStocks';
 for v_item in select value from jsonb_array_elements(coalesce(p_record->'items','[]'::jsonb)) loop
  v_qty:=coalesce(private.safe_numeric(v_item->>'baseQty'),private.safe_numeric(v_item->>'qty'),0);
  if v_qty<=0 then continue;end if;
  select source_record into v_product from public.products where tenant_id=p_tenant_id and legacy_id=v_item->>'productId' and source_active;
  if v_product is null then raise exception using errcode='23503',message='An offline item references an unavailable product.';end if;
  select value into v_stock from jsonb_array_elements(v_stocks) where value->>'productId'=v_item->>'productId' and value->>'branchId'=v_branch::text;
  if v_stock is null then
   if not (coalesce(v_product->>'branchId','')=v_branch::text or coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false)) then
    raise exception using errcode='42501',message='This product has no stock in the selected branch.';
   end if;
   v_stock:=jsonb_build_object('id','branch-stock-'||v_branch::text||'-'||(v_item->>'productId'),'tenantId',p_tenant_id,'branchId',v_branch,'productId',v_item->>'productId',
    'quantity',coalesce(private.safe_numeric(v_product->>'stockQty'),0),'shopStockQty',coalesce(private.safe_numeric(v_product->>'shopStockQty'),0),
    'storeStockQty',coalesce(private.safe_numeric(v_product->>'storeStockQty'),0),'buyingPrice',v_product->'costPrice','sellingPrice',v_product->'sellingPrice','createdAt',clock_timestamp());
  end if;
  v_store:=case when p_direction='purchase' then coalesce(p_record->>'destination','shop')='store'
    else lower(coalesce(v_item->>'channel',p_record->>'channel','retail'))='wholesale' end;
  if p_direction='sale' then
   if coalesce(private.safe_numeric(v_stock->>case when v_store then 'storeStockQty' else 'shopStockQty' end),0)<v_qty then
    raise exception using errcode='23514',message='Offline sale quantity exceeds the selected branch stock.';
   end if;
   v_qty:=-v_qty;
  end if;
  v_stock:=v_stock||jsonb_build_object('quantity',coalesce(private.safe_numeric(v_stock->>'quantity'),0)+v_qty,
    'shopStockQty',coalesce(private.safe_numeric(v_stock->>'shopStockQty'),0)+case when v_store then 0 else v_qty end,
    'storeStockQty',coalesce(private.safe_numeric(v_stock->>'storeStockQty'),0)+case when v_store then v_qty else 0 end,'updatedAt',clock_timestamp());
  v_stocks:=private.merge_workspace_products_by_id(v_stocks,jsonb_build_array(v_stock));
 end loop;
 return v_stocks;
end;
$$;
revoke all on function private.offline_normalized_branch_stock(uuid,jsonb,text) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.append_offline_sale_to_branch(p_sale jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_existing jsonb;
  v_existing_sales jsonb;
  v_existing_products jsonb;
  v_sale_id text;
  v_already_present boolean;
  v_next_sales jsonb;
  v_next_products jsonb;
  v_next_payload jsonb;
  v_item jsonb;
  v_product_id text;
  v_deduct numeric;
  v_channel text;
  v_product jsonb;
  v_idx int;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_sale is null or jsonb_typeof(p_sale) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid sale object is required.';
  end if;
  v_sale_id := nullif(p_sale ->> 'id', '');
  if v_sale_id is null then
    raise exception using errcode = '22023', message = 'A sale id is required.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;
  if v_scope = 'compatibility_primary' then
    v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
  elsif v_scope = 'branch' then
    if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
      raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
    end if;
  else
    raise exception using errcode = '42501', message = 'A single writable branch must be selected to sync an offline sale.';
  end if;
  if not private.is_tenant_branch_administrator(v_tenant_id)
    and not private.can_write_branch(v_tenant_id, v_branch_id, 'pos.write')
  then
    raise exception using errcode = '42501', message = 'Write permission is required for sales.';
  end if;

  -- Lock this tenant's workspace row for the whole operation -- the same
  -- "for update" pattern save_current_branch_sales already uses, so this
  -- can never interleave with a normal online save for the same tenant.
  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['sales','products','deliveries']);
  else
    select workspace.payload into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_sales := coalesce(v_existing -> 'sales', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);

  -- Idempotency: a sale id already present means this is a retried sync.
  -- Return success without touching stock again.
  select exists(
    select 1 from jsonb_array_elements(v_existing_sales) as item
    where item.value ->> 'id' = v_sale_id
  ) into v_already_present;

  if v_already_present then
    return jsonb_build_object('status', 'already_synced', 'sales', v_existing_sales, 'products', v_existing_products);
  end if;

  v_next_products := v_existing_products;
  for v_item in
    select value from jsonb_array_elements(coalesce(p_sale -> 'items', '[]'::jsonb))
    order by (value ->> 'productId')
  loop
    v_product_id := nullif(v_item ->> 'productId', '');
    if v_product_id is null then continue; end if;
    v_deduct := coalesce((v_item ->> 'baseQuantityDeducted')::numeric, (v_item ->> 'qty')::numeric, 0);
    if v_deduct <= 0 then continue; end if;
    v_channel := coalesce(nullif(v_item ->> 'channel', ''), 'shop');

    select (arr.idx - 1), arr.value into v_idx, v_product
    from jsonb_array_elements(v_next_products) with ordinality as arr(value, idx)
    where arr.value ->> 'id' = v_product_id
    limit 1;
    if v_product is null then continue; end if;

    if v_channel = 'store' then
      v_product := jsonb_set(
        v_product, '{storeStockQty}',
        to_jsonb(greatest(0, coalesce((v_product ->> 'storeStockQty')::numeric, 0) - v_deduct))
      );
    else
      v_product := jsonb_set(
        v_product, '{shopStockQty}',
        to_jsonb(greatest(0, coalesce((v_product ->> 'shopStockQty')::numeric, 0) - v_deduct))
      );
    end if;
    v_product := jsonb_set(
      v_product, '{stockQty}',
      to_jsonb(
        greatest(0, coalesce((v_product ->> 'shopStockQty')::numeric, 0))
        + greatest(0, coalesce((v_product ->> 'storeStockQty')::numeric, 0))
      )
    );
    v_product := jsonb_set(v_product, '{syncUpdatedAt}', to_jsonb(clock_timestamp()));
    v_next_products := jsonb_set(v_next_products, array[v_idx::text], v_product);
  end loop;

  v_next_sales := v_existing_sales || jsonb_build_array(p_sale);

  v_next_payload := jsonb_set(v_existing, '{sales}', v_next_sales, true);
  v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);

  if private.normalized_writes_enabled(v_tenant_id) then
    v_next_payload:=jsonb_set(v_next_payload,'{branchStocks}',private.offline_normalized_branch_stock(v_tenant_id,p_sale,'sale'),true);
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
    return private.normalized_mutation_result(array['sales','saleTombstones','deliveries','products','branchStocks'])||jsonb_build_object('status','synced');
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object('status', 'synced', 'sales', v_next_sales, 'products', v_next_products);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.append_offline_purchase_to_branch(p_purchase jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_existing jsonb;
  v_existing_purchases jsonb;
  v_existing_products jsonb;
  v_purchase_id text;
  v_already_present boolean;
  v_destination text;
  v_next_purchases jsonb;
  v_next_products jsonb;
  v_next_payload jsonb;
  v_item jsonb;
  v_product_id text;
  v_add numeric;
  v_product jsonb;
  v_idx int;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_purchase is null or jsonb_typeof(p_purchase) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid purchase object is required.';
  end if;
  v_purchase_id := nullif(p_purchase ->> 'id', '');
  if v_purchase_id is null then
    raise exception using errcode = '22023', message = 'A purchase id is required.';
  end if;
  v_destination := coalesce(nullif(p_purchase ->> 'destination', ''), 'shop');

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;
  if v_scope = 'compatibility_primary' then
    v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
  elsif v_scope = 'branch' then
    if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
      raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
    end if;
  else
    raise exception using errcode = '42501', message = 'A single writable branch must be selected to sync an offline purchase.';
  end if;
  if not private.is_tenant_branch_administrator(v_tenant_id)
    and not private.can_write_branch(v_tenant_id, v_branch_id, 'products.write')
  then
    raise exception using errcode = '42501', message = 'Write permission is required for purchases.';
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
  else
    select workspace.payload into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_purchases := coalesce(v_existing -> 'purchases', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);

  select exists(
    select 1 from jsonb_array_elements(v_existing_purchases) as item
    where item.value ->> 'id' = v_purchase_id
  ) into v_already_present;

  if v_already_present then
    return jsonb_build_object('status', 'already_synced', 'purchases', v_existing_purchases, 'products', v_existing_products);
  end if;

  v_next_products := v_existing_products;
  for v_item in
    select value from jsonb_array_elements(coalesce(p_purchase -> 'items', '[]'::jsonb))
    order by (value ->> 'productId')
  loop
    v_product_id := nullif(v_item ->> 'productId', '');
    if v_product_id is null then continue; end if;
    v_add := coalesce((v_item ->> 'baseQty')::numeric, (v_item ->> 'qty')::numeric, 0);
    if v_add <= 0 then continue; end if;

    select (arr.idx - 1), arr.value into v_idx, v_product
    from jsonb_array_elements(v_next_products) with ordinality as arr(value, idx)
    where arr.value ->> 'id' = v_product_id
    limit 1;
    if v_product is null then continue; end if;

    if v_destination = 'store' then
      v_product := jsonb_set(
        v_product, '{storeStockQty}',
        to_jsonb(coalesce((v_product ->> 'storeStockQty')::numeric, 0) + v_add)
      );
    else
      v_product := jsonb_set(
        v_product, '{shopStockQty}',
        to_jsonb(coalesce((v_product ->> 'shopStockQty')::numeric, 0) + v_add)
      );
    end if;
    v_product := jsonb_set(
      v_product, '{stockQty}',
      to_jsonb(
        greatest(0, coalesce((v_product ->> 'shopStockQty')::numeric, 0))
        + greatest(0, coalesce((v_product ->> 'storeStockQty')::numeric, 0))
      )
    );
    v_product := jsonb_set(v_product, '{syncUpdatedAt}', to_jsonb(clock_timestamp()));
    v_next_products := jsonb_set(v_next_products, array[v_idx::text], v_product);
  end loop;

  v_next_purchases := v_existing_purchases || jsonb_build_array(p_purchase);

  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);

  if private.normalized_writes_enabled(v_tenant_id) then
    v_next_payload:=jsonb_set(v_next_payload,'{branchStocks}',private.offline_normalized_branch_stock(v_tenant_id,p_purchase,'purchase'),true);
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
    return private.normalized_mutation_result(array['purchases','purchaseTombstones','products','branchStocks'])||jsonb_build_object('status','synced');
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object('status', 'synced', 'purchases', v_next_purchases, 'products', v_next_products);
end;
$function$
;

