create or replace function private.normalized_mutation_result(p_keys text[])
returns jsonb language plpgsql stable security definer set search_path='' as $result$
declare v_payload jsonb;
begin
 v_payload:=public.get_current_branch_workspace()->'payload';
 return coalesce((select jsonb_object_agg(key,value) from jsonb_each(v_payload) where key=any(p_keys)),'{}'::jsonb);
end;
$result$;
revoke all on function private.normalized_mutation_result(text[]) from public,anon,authenticated;
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

CREATE OR REPLACE FUNCTION public.save_current_branch_deliveries(p_deliveries jsonb)
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
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_deliveries jsonb;
  v_next_deliveries jsonb;
  v_existing_count integer;
  v_incoming_count integer;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_deliveries is null or jsonb_typeof(p_deliveries) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid deliveries array is required.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['deliveries']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_deliveries := coalesce(v_existing -> 'deliveries', '[]'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

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
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_deliveries := p_deliveries;
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
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'deliveries.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for deliveries.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_deliveries, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_deliveries, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=deliveries existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_deliveries := private.replace_branch_json_array(
      v_existing_deliveries,
      p_deliveries,
      v_branch_id,
      v_include_unassigned
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_build_object('deliveries', v_next_deliveries));
    return private.normalized_mutation_result(array['deliveries','deliveryTombstones']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('deliveries', v_next_deliveries),
    statement_timestamp(),
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(public.tenant_workspaces.payload, '{deliveries}', v_next_deliveries, true),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object('deliveries', v_next_deliveries);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_current_branch_deliveries(p_deliveries jsonb, p_delivery_tombstones jsonb DEFAULT '{}'::jsonb)
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
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_deliveries jsonb;
  v_existing_delivery_tombstones jsonb;
  v_next_deliveries jsonb;
  v_next_delivery_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_deliveries is null or jsonb_typeof(p_deliveries) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid deliveries array is required.';
  end if;
  if p_delivery_tombstones is null or jsonb_typeof(p_delivery_tombstones) <> 'object' then
    p_delivery_tombstones := '{}'::jsonb;
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['deliveries']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_deliveries := coalesce(v_existing -> 'deliveries', '[]'::jsonb);
  v_existing_delivery_tombstones := coalesce(v_existing -> 'deliveryTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

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
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_deliveries := p_deliveries;
    end if;

    v_next_delivery_tombstones := coalesce(p_delivery_tombstones, v_existing_delivery_tombstones);
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
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'deliveries.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for deliveries.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_deliveries, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_deliveries, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=deliveries existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_delivery_tombstones := v_existing_delivery_tombstones || p_delivery_tombstones;

    v_next_deliveries := private.merge_branch_json_array_by_id(
      v_existing_deliveries, p_deliveries, v_branch_id, v_include_unassigned, v_next_delivery_tombstones
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_build_object('deliveries', v_next_deliveries, 'deliveryTombstones', v_next_delivery_tombstones));
    return private.normalized_mutation_result(array['deliveries','deliveryTombstones']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('deliveries', v_next_deliveries, 'deliveryTombstones', v_next_delivery_tombstones),
    statement_timestamp(),
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        jsonb_set(public.tenant_workspaces.payload, '{deliveries}', v_next_deliveries, true),
        '{deliveryTombstones}', v_next_delivery_tombstones, true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object('deliveries', v_next_deliveries, 'deliveryTombstones', v_next_delivery_tombstones);
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

    v_next_expense_tombstones := v_existing_expense_tombstones || p_expense_tombstones;

    v_next_expenses := private.merge_branch_json_array_by_id(
      v_existing_expenses, p_expenses, v_branch_id, v_include_unassigned, v_next_expense_tombstones
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
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

CREATE OR REPLACE FUNCTION public.save_current_branch_products(p_products jsonb, p_product_tombstones jsonb DEFAULT '{}'::jsonb)
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
  v_existing_products jsonb;
  v_existing_tombstones jsonb;
  v_merged_products jsonb;
  v_merged_tombstones jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_products is null or jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid products array is required.';
  end if;
  if p_product_tombstones is null or jsonb_typeof(p_product_tombstones) <> 'object' then
    p_product_tombstones := '{}'::jsonb;
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;
  elsif v_scope = 'compatibility_primary' then
    if not private.is_tenant_branch_administrator(v_tenant_id) then
      raise exception using
        errcode = '42501',
        message = 'Only a tenant administrator may write the compatibility workspace.';
    end if;
  elsif v_scope = 'branch' then
    if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
      raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
    end if;
    if not private.is_tenant_branch_administrator(v_tenant_id)
      and not private.can_write_branch(v_tenant_id, v_branch_id, 'products.write')
    then
      raise exception using errcode = '42501', message = 'Write permission is required for products.';
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['products']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);

  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_tombstones := coalesce(v_existing -> 'productTombstones', '{}'::jsonb);

  v_merged_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  v_merged_tombstones := v_existing_tombstones || p_product_tombstones;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_build_object('products', v_merged_products, 'productTombstones', v_merged_tombstones));
    return private.normalized_mutation_result(array['products','productTombstones','branchStocks']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('products', v_merged_products, 'productTombstones', v_merged_tombstones),
    statement_timestamp(),
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        jsonb_set(public.tenant_workspaces.payload, '{products}', v_merged_products, true),
        '{productTombstones}',
        v_merged_tombstones,
        true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object(
    'products', v_merged_products,
    'productTombstones', v_merged_tombstones
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_current_branch_products(p_products jsonb, p_product_tombstones jsonb, p_branch_stocks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant uuid := private.current_tenant_id();
  v_branch uuid;
  v_context jsonb;
  v_result jsonb;
  v_existing jsonb;
  v_updates jsonb;
  v_merged jsonb;
begin
  if (select auth.uid()) is null or v_tenant is null then
    raise exception using errcode='42501', message='An active tenant account is required.';
  end if;
  if p_branch_stocks is null then
    return public.save_current_branch_products(p_products,p_product_tombstones);
  end if;
  if jsonb_typeof(p_branch_stocks) <> 'array' then
    raise exception using errcode='22023',message='A branch stocks array is required.';
  end if;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context ->> 'activeBranchId','')::uuid;
  if v_context ->> 'activeScope' <> 'branch' or v_branch is null
    or not private.can_write_branch(v_tenant,v_branch,'products.write') then
    raise exception using errcode='42501',message='Product write permission in the selected branch is required.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_branch_stocks) supplied(item)
    where jsonb_typeof(item)<>'object'
      or coalesce(item->>'branchId',item->>'branch_id','') <> v_branch::text
      or nullif(item->>'productId','') is null
      or (item ? 'tenantId' and item->>'tenantId' <> v_tenant::text)) then
    raise exception using errcode='42501',message='Stock updates must belong to the selected tenant and branch.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_branch_stocks) supplied(item)
    group by item->>'productId' having count(*)>1) then
    raise exception using errcode='22023',message='Each branch product must have one stock update.';
  end if;

  -- This existing function checks catalogue authorization and locks the workspace.
  -- Any subsequent stock failure rolls its catalogue write back in the same transaction.
  if private.normalized_writes_enabled(v_tenant) then perform set_config('app.jasper_explicit_branch_stock_tenant',v_tenant::text,true);end if;
  v_result := public.save_current_branch_products(p_products,p_product_tombstones);
  if private.normalized_writes_enabled(v_tenant) then perform set_config('app.jasper_explicit_branch_stock_tenant','',true);end if;
  if private.normalized_writes_enabled(v_tenant) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
    v_existing:=private.normalized_mutation_snapshot(v_tenant,array['products','branchStocks']);
  else select payload into v_existing from public.tenant_workspaces where tenant_id=v_tenant for update; end if;
  if exists(select 1 from jsonb_array_elements(p_branch_stocks) supplied(item)
    where not exists(select 1 from jsonb_array_elements(coalesce(v_existing->'products','[]'::jsonb)) product(item)
      where product.item->>'id'=supplied.item->>'productId')) then
    raise exception using errcode='22023',message='A stock update references an unknown product.';
  end if;

  -- Retain the durable stock ID for each (branch, product), even for legacy IDs.
  select coalesce(jsonb_agg(supplied.item || jsonb_build_object('id',
    coalesce(existing.item->>'id',nullif(supplied.item->>'id',''),
      'branch-stock-'||v_branch::text||'-'||(supplied.item->>'productId')))),'[]'::jsonb)
  into v_updates
  from jsonb_array_elements(p_branch_stocks) supplied(item)
  left join lateral (
    select item from jsonb_array_elements(coalesce(v_existing->'branchStocks','[]'::jsonb)) existing(item)
    where coalesce(item->>'branchId',item->>'branch_id')=v_branch::text
      and item->>'productId'=supplied.item->>'productId' limit 1
  ) existing on true;

  if exists(select 1 from jsonb_array_elements(v_updates) supplied(item)
    join jsonb_array_elements(coalesce(v_existing->'branchStocks','[]'::jsonb)) existing(item)
      on supplied.item->>'id'=existing.item->>'id'
    where coalesce(existing.item->>'branchId',existing.item->>'branch_id','')<>v_branch::text
      or existing.item->>'productId'<>supplied.item->>'productId') then
    raise exception using errcode='42501',message='An existing stock ID belongs to another branch or product.';
  end if;
  v_merged := private.merge_workspace_products_by_id(v_existing->'branchStocks',v_updates);
  if private.normalized_writes_enabled(v_tenant) then
    perform private.persist_normalized_business_snapshot(v_tenant,jsonb_build_object('branchStocks',v_merged));
    return private.normalized_mutation_result(array['products','productTombstones','branchStocks']);
  else
  update public.tenant_workspaces
  set payload=jsonb_set(payload,'{branchStocks}',v_merged,true),
      updated_at=statement_timestamp(),updated_by=(select auth.uid())
  where tenant_id=v_tenant;
  end if;
  return v_result || jsonb_build_object('branchStocks',
    private.filter_branch_json_array(v_merged,v_branch,false));
end $function$
;

CREATE OR REPLACE FUNCTION public.save_current_branch_purchases(p_purchases jsonb, p_products jsonb DEFAULT NULL::jsonb, p_branch_stocks jsonb DEFAULT NULL::jsonb)
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
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_purchases jsonb;
  v_existing_products jsonb;
  v_existing_branch_stocks jsonb;
  v_next_purchases jsonb;
  v_next_products jsonb;
  v_next_branch_stocks jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_purchases is null or jsonb_typeof(p_purchases) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid purchases array is required.';
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_branch_stocks is not null and jsonb_typeof(p_branch_stocks) <> 'array' then
    raise exception using errcode = '22023', message = 'branchStocks, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_purchases := coalesce(v_existing -> 'purchases', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_branch_stocks := coalesce(v_existing -> 'branchStocks', '[]'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_purchases);
    v_incoming_count := jsonb_array_length(p_purchases);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_purchases := v_existing_purchases;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=purchases existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_purchases := p_purchases;
    end if;

    -- No shrink guard for branchStocks under all_branches, matching
    -- save_current_branch_workspace (that key is outside its guard loop
    -- for this scope too).
    if p_branch_stocks is not null then
      v_next_branch_stocks := p_branch_stocks;
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
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'products.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for purchases.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_purchases, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_purchases, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=purchases existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;
    v_next_purchases := private.replace_branch_json_array(
      v_existing_purchases, p_purchases, v_branch_id, v_include_unassigned
    );

    if p_branch_stocks is not null then
      v_next_branch_stocks := private.replace_branch_json_array(
        v_existing_branch_stocks, p_branch_stocks, v_branch_id, false
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  v_next_purchases := private.preserve_purchase_payment_state(v_existing_purchases,v_next_purchases);
  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  if v_next_branch_stocks is not null then
    v_next_payload := jsonb_set(v_next_payload, '{branchStocks}', v_next_branch_stocks, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
    return private.normalized_mutation_result(array['purchases','purchaseTombstones','products','branchStocks']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object(
    'purchases', v_next_purchases,
    'branchStocks', v_next_branch_stocks,
    'products', v_next_products
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_current_branch_purchases(p_purchases jsonb, p_purchase_tombstones jsonb DEFAULT '{}'::jsonb, p_products jsonb DEFAULT NULL::jsonb, p_branch_stocks jsonb DEFAULT NULL::jsonb)
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
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_purchases jsonb;
  v_existing_products jsonb;
  v_existing_branch_stocks jsonb;
  v_existing_purchase_tombstones jsonb;
  v_next_purchases jsonb;
  v_next_products jsonb;
  v_next_branch_stocks jsonb;
  v_next_purchase_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_purchases is null or jsonb_typeof(p_purchases) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid purchases array is required.';
  end if;
  if p_purchase_tombstones is null or jsonb_typeof(p_purchase_tombstones) <> 'object' then
    p_purchase_tombstones := '{}'::jsonb;
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_branch_stocks is not null and jsonb_typeof(p_branch_stocks) <> 'array' then
    raise exception using errcode = '22023', message = 'branchStocks, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_purchases := coalesce(v_existing -> 'purchases', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_branch_stocks := coalesce(v_existing -> 'branchStocks', '[]'::jsonb);
  v_existing_purchase_tombstones := coalesce(v_existing -> 'purchaseTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_purchases);
    v_incoming_count := jsonb_array_length(p_purchases);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_purchases := v_existing_purchases;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=purchases existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_purchases := p_purchases;
    end if;

    if p_branch_stocks is not null then
      v_next_branch_stocks := p_branch_stocks;
    end if;

    v_next_purchase_tombstones := coalesce(p_purchase_tombstones, v_existing_purchase_tombstones);
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
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'products.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for purchases.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_purchases, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_purchases, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=purchases existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_purchase_tombstones := v_existing_purchase_tombstones || p_purchase_tombstones;

    v_next_purchases := private.merge_branch_json_array_by_id(
      v_existing_purchases, p_purchases, v_branch_id, v_include_unassigned, v_next_purchase_tombstones
    );

    if p_branch_stocks is not null then
      v_next_branch_stocks := private.replace_branch_json_array(
        v_existing_branch_stocks, p_branch_stocks, v_branch_id, false
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  if exists(select 1 from jsonb_array_elements(v_existing_purchases) as item where jsonb_array_length(coalesce(item->'payments','[]'::jsonb))>0 and v_next_purchase_tombstones ? (item->>'id')) then raise exception using errcode='23514',message='Purchases with recorded installments must be kept for payment audit history.'; end if;
  v_next_purchases := private.preserve_purchase_payment_state(v_existing_purchases,v_next_purchases);
  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  v_next_payload := jsonb_set(v_next_payload, '{purchaseTombstones}', v_next_purchase_tombstones, true);
  if v_next_branch_stocks is not null then
    v_next_payload := jsonb_set(v_next_payload, '{branchStocks}', v_next_branch_stocks, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
    return private.normalized_mutation_result(array['purchases','purchaseTombstones','products','branchStocks']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object(
    'purchases', v_next_purchases,
    'purchaseTombstones', v_next_purchase_tombstones,
    'branchStocks', v_next_branch_stocks,
    'products', v_next_products
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

CREATE OR REPLACE FUNCTION public.save_current_branch_workspace(p_workspace jsonb)
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
  v_include_unassigned boolean := false;
  v_existing jsonb;
  v_existing_scoped jsonb;
  v_next jsonb;
  v_existing_settings jsonb;
  v_incoming_settings jsonb;
  v_next_settings jsonb;
  v_key text;
  v_permission_key text;
  v_next_sale_tombstones jsonb;
  v_next_purchase_tombstones jsonb;
  v_next_delivery_tombstones jsonb;
  v_next_expense_tombstones jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_workspace is null or jsonb_typeof(p_workspace) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid workspace object is required.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,null);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
    and private.is_tenant_branch_administrator(v_tenant_id)
  then
    v_next := p_workspace;
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
    end if;

    v_existing_scoped := coalesce(
      public.get_current_branch_workspace() -> 'payload',
      '{}'::jsonb
    );
    if not private.is_tenant_branch_administrator(v_tenant_id) then
      if v_scope = 'compatibility_primary' then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;

      foreach v_key in array array[
        'products', 'sales', 'expenses', 'deliveries',
        'pendingDeliveryNotes', 'purchases', 'branchStocks',
        'branchStaffAssignments'
      ]
      loop
        v_permission_key := case v_key
          when 'products' then 'products.write'
          when 'sales' then 'pos.write'
          when 'expenses' then 'expenses.write'
          when 'deliveries' then 'deliveries.write'
          when 'pendingDeliveryNotes' then 'deliveries.write'
          when 'purchases' then 'products.write'
          when 'branchStocks' then 'products.write'
          when 'branchStaffAssignments' then 'branches.manage'
        end;
        if coalesce(p_workspace -> v_key, '[]'::jsonb)
          is distinct from coalesce(v_existing_scoped -> v_key, '[]'::jsonb)
          and not private.can_write_branch(v_tenant_id, v_branch_id, v_permission_key)
        then
          raise exception using
            errcode = '42501',
            message = format('Write permission is required for %s.', v_key);
        end if;
      end loop;

      if coalesce(p_workspace -> 'settings', '{}'::jsonb)
        is distinct from coalesce(v_existing_scoped -> 'settings', '{}'::jsonb)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'settings.write')
      then
        raise exception using
          errcode = '42501',
          message = 'Settings write permission is required.';
      end if;
    end if;

    v_next := v_existing;
    foreach v_key in array array[
      'pendingDeliveryNotes', 'branchStocks', 'branchStaffAssignments'
    ]
    loop
      v_next := jsonb_set(
        v_next,
        array[v_key],
        private.replace_branch_json_array(
          v_existing -> v_key,
          p_workspace -> v_key,
          v_branch_id,
          case when v_key in ('branchStocks', 'branchStaffAssignments') then false else v_include_unassigned end
        ),
        true
      );
    end loop;

    v_next_sale_tombstones := coalesce(v_existing -> 'saleTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'saleTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{sales}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'sales', p_workspace -> 'sales', v_branch_id, v_include_unassigned, v_next_sale_tombstones
      ),
      true
    );

    v_next_purchase_tombstones := coalesce(v_existing -> 'purchaseTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'purchaseTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{purchases}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'purchases', p_workspace -> 'purchases', v_branch_id, v_include_unassigned, v_next_purchase_tombstones
      ),
      true
    );

    v_next_delivery_tombstones := coalesce(v_existing -> 'deliveryTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'deliveryTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{deliveries}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'deliveries', p_workspace -> 'deliveries', v_branch_id, v_include_unassigned, v_next_delivery_tombstones
      ),
      true
    );

    v_next_expense_tombstones := coalesce(v_existing -> 'expenseTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'expenseTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{expenses}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'expenses', p_workspace -> 'expenses', v_branch_id, v_include_unassigned, v_next_expense_tombstones
      ),
      true
    );

    v_next := jsonb_set(
      v_next,
      '{products}',
      private.merge_workspace_products_by_id(
        v_existing -> 'products',
        p_workspace -> 'products'
      ),
      true
    );

    v_existing_settings := coalesce(v_existing -> 'settings', '{}'::jsonb);
    v_incoming_settings := coalesce(p_workspace -> 'settings', '{}'::jsonb);
    if private.is_tenant_branch_administrator(v_tenant_id) then
      v_next_settings := v_incoming_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_incoming_settings -> 'staffs',
          v_branch_id,
          v_include_unassigned
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_incoming_settings -> 'paymentChannels',
          v_branch_id,
          v_include_unassigned
        )
      );
    else
      v_next_settings := v_existing_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_incoming_settings -> 'staffs',
          v_branch_id,
          false
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_incoming_settings -> 'paymentChannels',
          v_branch_id,
          false
        )
      );
    end if;
    v_next := jsonb_set(v_next, '{settings}', v_next_settings, true);

    v_next := v_next || jsonb_build_object(
      'productTombstones',
      coalesce(v_existing -> 'productTombstones', '{}'::jsonb)
        || coalesce(p_workspace -> 'productTombstones', '{}'::jsonb),
      'saleTombstones', v_next_sale_tombstones,
      'purchaseTombstones', v_next_purchase_tombstones,
      'deliveryTombstones', v_next_delivery_tombstones,
      'expenseTombstones', v_next_expense_tombstones
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  -- A delayed full autosave must not undo a newer product/branch-stock edit.
  v_next := jsonb_set(v_next, '{products}',
    private.merge_workspace_products_by_id(v_existing -> 'products', v_next -> 'products'), true);
  v_next := jsonb_set(v_next, '{branchStocks}',
    private.merge_workspace_products_by_id(v_existing -> 'branchStocks', v_next -> 'branchStocks'), true);

  if exists(select 1 from jsonb_array_elements(coalesce(v_existing->'purchases','[]'::jsonb)) as item where jsonb_array_length(coalesce(item->'payments','[]'::jsonb))>0 and coalesce(v_next->'purchaseTombstones','{}'::jsonb) ? (item->>'id')) then raise exception using errcode='23514',message='Purchases with recorded installments must be kept for payment audit history.'; end if;
  v_next := jsonb_set(v_next, '{purchases}', private.preserve_purchase_payment_state(v_existing->'purchases',v_next->'purchases'),true);
  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next);
    return public.get_current_branch_workspace();
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return public.get_current_branch_workspace();
end;
$function$
;


