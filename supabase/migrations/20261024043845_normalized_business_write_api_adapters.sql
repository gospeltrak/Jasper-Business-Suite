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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
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
    v_product := jsonb_set(v_product, '{syncUpdatedAt}', to_jsonb(now()));
    v_next_products := jsonb_set(v_next_products, array[v_idx::text], v_product);
  end loop;

  v_next_purchases := v_existing_purchases || jsonb_build_array(p_purchase);

  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['sales','products','deliveries']);
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
    v_product := jsonb_set(v_product, '{syncUpdatedAt}', to_jsonb(now()));
    v_next_products := jsonb_set(v_next_products, array[v_idx::text], v_product);
  end loop;

  v_next_sales := v_existing_sales || jsonb_build_array(p_sale);

  v_next_payload := jsonb_set(v_existing, '{sales}', v_next_sales, true);
  v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['deliveries']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['deliveries']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['expenses']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['expenses']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['products']);
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
  v_result := public.save_current_branch_products(p_products,p_product_tombstones);
  if private.normalized_writes_enabled(v_tenant) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
    v_existing:=private.normalized_business_snapshot(v_tenant,array['products','branchStocks']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,array['sales','products','deliveries']);
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
    v_existing := private.normalized_business_snapshot(v_tenant_id,null);
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

CREATE OR REPLACE FUNCTION public.save_current_tenant_settings(p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch_id uuid;
  v_existing jsonb;
  v_merged_settings jsonb;
  v_updated_at timestamptz := statement_timestamp();
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'An active tenant account is required.';
  end if;
  if p_settings is null
    or jsonb_typeof(p_settings) <> 'object'
    or p_settings = '{}'::jsonb
  then
    raise exception using
      errcode = '22023',
      message = 'A non-empty settings object is required.';
  end if;

  if not private.is_tenant_branch_administrator(v_tenant_id) then
    v_context := public.get_current_branch_context();
    v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;
    if v_branch_id is null
      or not private.can_write_branch(
        v_tenant_id,
        v_branch_id,
        'settings.write'
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Settings write permission is required.';
    end if;
  end if;

  perform set_config(
    'app.jasper_explicit_settings_tenant',
    v_tenant_id::text,
    true
  );

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_business_snapshot(v_tenant_id,array[]::text[]);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;

  v_merged_settings := private.merge_settings_by_path(
    coalesce(v_existing -> 'settings', '{}'::jsonb),
    p_settings,
    v_updated_at
  );

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_set(coalesce(v_existing, '{}'::jsonb), '{settings}', v_merged_settings, true));
  else
  insert into public.tenant_workspaces (
    tenant_id,
    payload,
    updated_at,
    updated_by
  )
  values (
    v_tenant_id,
    jsonb_set(coalesce(v_existing, '{}'::jsonb), '{settings}', v_merged_settings, true),
    v_updated_at,
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        coalesce(public.tenant_workspaces.payload, '{}'::jsonb),
        '{settings}',
        excluded.payload -> 'settings',
        true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  insert into public.tenant_data (
    tenant_id,
    data_key,
    payload,
    updated_at
  )
  values (
    v_tenant_id::text,
    'settings',
    v_merged_settings,
    v_updated_at
  )
  on conflict (tenant_id, data_key) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'settings', v_merged_settings,
    'updatedAt', v_updated_at
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_current_branch_purchase_payment(p_purchase_id text, p_payment_id uuid, p_amount numeric, p_funding_type text, p_source_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_context->>'activeScope' <> 'branch' or v_branch is null
    or not private.can_write_branch(v_tenant,v_branch,'products.write')
    or not private.can_write_branch(v_tenant,v_branch,'money_bank.post') then
    raise exception using errcode='42501', message='Select a writable purchase branch with Money and Bank permission.';
  end if;
  if private.normalized_writes_enabled(v_tenant) then
      perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
      v_payload:=private.normalized_business_snapshot(v_tenant,array['purchases']);
    else select payload into v_payload from public.tenant_workspaces where tenant_id=v_tenant for update; end if;
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
      'supplier_payment',p_purchase_id||':payment:'||p_payment_id::text,'purchase-installment:'||p_payment_id::text,
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
  if private.normalized_writes_enabled(v_tenant) then
      perform private.persist_normalized_business_snapshot(v_tenant,jsonb_set(v_payload,'{purchases}',(
    select jsonb_agg(case when item->>'id'=p_purchase_id then v_purchase else item end order by ord)
    from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
  ),true));
    else update public.tenant_workspaces set payload=jsonb_set(v_payload,'{purchases}',(
    select jsonb_agg(case when item->>'id'=p_purchase_id then v_purchase else item end order by ord)
    from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
  ),true),updated_at=v_now,updated_by=v_actor where tenant_id=v_tenant; end if;
  return jsonb_build_object('purchase',v_purchase,'status','recorded');
end;
$function$
;

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
    if private.normalized_writes_enabled(v_tenant_id) then
      perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
      v_payload:=private.normalized_business_snapshot(v_tenant_id,array['purchases']);
    else select payload into v_payload from public.tenant_workspaces where tenant_id=v_tenant_id for update; end if;
    select item into v_purchase from jsonb_array_elements(v_payload->'purchases') as item where item->>'id'=v_original.metadata->>'purchaseId';
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
    if private.normalized_writes_enabled(v_tenant_id) then
      perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_set(v_payload,'{purchases}',(
      select jsonb_agg(case when item->>'id'=v_original.metadata->>'purchaseId' then v_purchase else item end order by ord)
      from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
    ),true));
    else update public.tenant_workspaces set payload=jsonb_set(v_payload,'{purchases}',(
      select jsonb_agg(case when item->>'id'=v_original.metadata->>'purchaseId' then v_purchase else item end order by ord)
      from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
    ),true),updated_at=v_now,updated_by=v_actor_id where tenant_id=v_tenant_id; end if;
  end if;

  return jsonb_build_object(
    'journalId', v_reversal_id, 'reversalOfJournalId', v_original.id, 'status', 'reversed'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_branch_workspace()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean := false;
  v_payload jsonb;
  v_settings jsonb;
  v_branch_stocks jsonb;
  v_product_ids text[];
  v_products jsonb;
  v_updated_at timestamptz;
begin
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  select case when private.normalized_writes_enabled(v_tenant_id) then private.normalized_business_snapshot(v_tenant_id) else workspace.payload end, workspace.updated_at
  into v_payload, v_updated_at
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id;
  if not found then
    return jsonb_build_object(
      'payload', null,
      'updatedAt', null,
      'accessMode', 'empty'
    );
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
  then
    return jsonb_build_object(
      'payload', v_payload,
      'updatedAt', v_updated_at,
      'accessMode', 'all_branches'
    );
  end if;

  if v_scope = 'compatibility_primary' then
    v_include_unassigned := true;
  elsif v_scope = 'branch' and v_branch_id is not null then
    v_include_unassigned := coalesce(
      (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
      false
    );
  else
    v_payload := v_payload
      || jsonb_build_object(
        'products', '[]'::jsonb,
        'sales', '[]'::jsonb,
        'expenses', '[]'::jsonb,
        'deliveries', '[]'::jsonb,
        'pendingDeliveryNotes', '[]'::jsonb,
        'purchases', '[]'::jsonb,
        'branches', '[]'::jsonb,
        'branchStocks', '[]'::jsonb,
        'branchStaffAssignments', '[]'::jsonb
      );
    v_settings := coalesce(v_payload -> 'settings', '{}'::jsonb)
      || jsonb_build_object(
        'staffs', '[]'::jsonb,
        'paymentChannels', '[]'::jsonb
      );
    return jsonb_build_object(
      'payload', v_payload || jsonb_build_object('settings', v_settings),
      'updatedAt', v_updated_at,
      'accessMode', 'no_branch_access'
    );
  end if;

  if v_branch_id is null then
    -- Compatibility mode before physical Primary Branch provisioning.
    v_branch_stocks := '[]'::jsonb;
  else
    v_branch_stocks := private.filter_branch_json_array(
      v_payload -> 'branchStocks',
      v_branch_id,
      false
    );
  end if;

  select coalesce(array_agg(stock.value ->> 'productId'), '{}'::text[])
  into v_product_ids
  from jsonb_array_elements(v_branch_stocks) as stock(value)
  where nullif(stock.value ->> 'productId', '') is not null;

  select coalesce(jsonb_agg(product.value), '[]'::jsonb)
  into v_products
  from jsonb_array_elements(
    case
      when jsonb_typeof(v_payload -> 'products') = 'array' then v_payload -> 'products'
      else '[]'::jsonb
    end
  ) as product(value)
  where (
    v_branch_id is not null
    and coalesce(product.value ->> 'branchId', product.value ->> 'branch_id') = v_branch_id::text
  )
  or (
    v_include_unassigned
    and nullif(coalesce(product.value ->> 'branchId', product.value ->> 'branch_id'), '') is null
  )
  or product.value ->> 'id' = any(v_product_ids);

  v_settings := coalesce(v_payload -> 'settings', '{}'::jsonb)
    || jsonb_build_object(
      'staffs',
      case
        when v_branch_id is null then private.filter_branch_json_array(
          v_payload -> 'settings' -> 'staffs',
          '00000000-0000-0000-0000-000000000000'::uuid,
          true
        )
        else private.filter_branch_json_array(
          v_payload -> 'settings' -> 'staffs',
          v_branch_id,
          v_include_unassigned
        )
      end,
      'paymentChannels',
      private.filter_branch_json_array(
        v_payload -> 'settings' -> 'paymentChannels',
        coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        v_include_unassigned
      )
    );

  v_payload := v_payload || jsonb_build_object(
    'products', v_products,
    'sales', private.filter_branch_json_array(v_payload -> 'sales', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'expenses', private.filter_branch_json_array(v_payload -> 'expenses', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'deliveries', private.filter_branch_json_array(v_payload -> 'deliveries', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'pendingDeliveryNotes', private.filter_branch_json_array(v_payload -> 'pendingDeliveryNotes', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'purchases', private.filter_branch_json_array(v_payload -> 'purchases', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'branches', coalesce(v_context -> 'branches', '[]'::jsonb),
    'branchStocks', v_branch_stocks,
    'branchStaffAssignments', case
      when v_branch_id is null then '[]'::jsonb
      else private.filter_branch_json_array(v_payload -> 'branchStaffAssignments', v_branch_id, false)
    end,
    'settings', v_settings
  );

  return jsonb_build_object(
    'payload', v_payload,
    'updatedAt', v_updated_at,
    'accessMode', case when v_branch_id is null then 'compatibility_primary' else 'branch' end
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_branch_workspace_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_scoped jsonb; v_payload jsonb; v_state public.workspace_migration_state%rowtype;
  v_content jsonb; v_stock jsonb; v_latest_match boolean := false;
  v_latest_hash text; v_current_hash text; v_key text; v_table regclass; v_records jsonb;
begin
  if v_tenant_id is null or (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  v_scoped := public.get_current_branch_workspace();
  v_payload := v_scoped -> 'payload';
  if private.normalized_writes_enabled(v_tenant_id) then return v_scoped||jsonb_build_object('readSource','normalized');end if;
  if v_payload is null then return v_scoped || jsonb_build_object('readSource', 'legacy_empty'); end if;

  select * into v_state from public.workspace_migration_state where tenant_id = v_tenant_id;
  if not found or v_state.read_mode <> 'normalized' then
    return v_scoped || jsonb_build_object('readSource', 'legacy');
  end if;

  select md5(payload::text) into v_current_hash
  from public.tenant_workspaces where tenant_id = v_tenant_id;
  select is_match, source_payload_hash into v_latest_match, v_latest_hash
  from public.workspace_reconciliation_runs where tenant_id = v_tenant_id
  order by checked_at desc, id desc limit 1;
  v_content := public.validate_workspace_shadow_content(v_tenant_id);
  v_stock := public.validate_branch_stock_shadow(v_tenant_id);
  if not coalesce(v_state.dual_write_enabled, false)
    or v_state.last_verified_at is null
    or v_state.last_source_hash is distinct from v_current_hash
    or not coalesce(v_latest_match, false) or v_latest_hash is distinct from v_current_hash
    or not coalesce((v_content ->> 'allMatch')::boolean, false)
    or not coalesce((v_stock ->> 'allMatch')::boolean, false)
    or exists (select 1 from public.workspace_normalization_outbox
               where tenant_id = v_tenant_id and status in ('pending', 'running', 'processing', 'failed'))
  then return v_scoped || jsonb_build_object('readSource', 'legacy_fallback'); end if;

  -- Keep the established branch/permission scope: only replace rows already
  -- present in the scoped legacy result. Protected non-legacy rows stay intact.
  for v_key, v_table in select * from (values
    ('products', 'public.products'::regclass), ('sales', 'public.sales'::regclass),
    ('expenses', 'public.expenses'::regclass), ('deliveries', 'public.deliveries'::regclass),
    ('purchases', 'public.purchases'::regclass), ('branchStocks', 'public.branch_stock'::regclass)
  ) x(payload_key, source_table) loop
    execute format(
      'select coalesce(jsonb_agg(r.source_record order by r.source_ordinal), ''[]''::jsonb)
       from %s r where r.tenant_id = $1 and r.legacy_id is not null and r.source_active
       and r.legacy_id in (select coalesce(nullif(btrim(i ->> ''id''), ''''), ''hash:'' || md5(i::text))
                           from jsonb_array_elements(coalesce($2 -> $3, ''[]''::jsonb)) i)', v_table)
      into v_records using v_tenant_id, v_payload, v_key;
    v_payload := jsonb_set(v_payload, array[v_key], v_records, true);
  end loop;
  return jsonb_set(v_scoped, '{payload}', v_payload, true) || jsonb_build_object('readSource', 'normalized');
end; $function$
;

CREATE OR REPLACE FUNCTION private.workspace_normalized_reads_ready(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_state public.workspace_migration_state%rowtype;
  v_current_hash text;
  v_latest_hash text;
  v_latest_match boolean := false;
begin
  if private.normalized_writes_enabled(p_tenant_id) then return true;end if;
  select * into v_state
  from public.workspace_migration_state
  where tenant_id = p_tenant_id;

  if not found
    or v_state.read_mode <> 'normalized'
    or not coalesce(v_state.dual_write_enabled, false)
    or v_state.last_verified_at is null
  then
    return false;
  end if;

  select md5(workspace.payload::text)
  into v_current_hash
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = p_tenant_id;

  select run.is_match, run.source_payload_hash
  into v_latest_match, v_latest_hash
  from public.workspace_reconciliation_runs as run
  where run.tenant_id = p_tenant_id
  order by run.checked_at desc, run.id desc
  limit 1;

  return v_state.last_source_hash is not distinct from v_current_hash
    and coalesce(v_latest_match, false)
    and v_latest_hash is not distinct from v_current_hash
    and not exists (
      select 1
      from public.workspace_normalization_outbox as outbox
      where outbox.tenant_id = p_tenant_id
        and outbox.status in ('pending', 'running', 'processing', 'failed')
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.queue_workspace_normalization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.normalized_writes_enabled(new.tenant_id) then return new;end if;
  if exists (
    select 1
    from public.workspace_migration_state state
    where state.tenant_id = new.tenant_id
      and state.dual_write_enabled
      and state.read_mode in ('legacy', 'shadow', 'normalized')
  ) then
    insert into public.workspace_normalization_outbox (
      tenant_id,
      workspace_updated_at,
      status,
      attempts,
      available_at,
      locked_at,
      locked_by,
      last_error,
      requested_at,
      updated_at
    )
    values (
      new.tenant_id,
      new.updated_at,
      'pending',
      0,
      statement_timestamp(),
      null,
      null,
      '{}'::jsonb,
      statement_timestamp(),
      statement_timestamp()
    )
    on conflict (tenant_id) do update
    set workspace_updated_at = excluded.workspace_updated_at,
        status = 'pending',
        attempts = 0,
        available_at = excluded.available_at,
        locked_at = null,
        locked_by = null,
        last_error = '{}'::jsonb,
        requested_at = excluded.requested_at,
        updated_at = excluded.updated_at;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_workspace_snapshot(p_tenant_id uuid, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS workspace_migration_batches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_workspace public.tenant_workspaces%rowtype;
  v_batch public.workspace_migration_batches%rowtype;
  v_item jsonb;
  v_child jsonb;
  v_legacy_id text;
  v_child_legacy_id text;
  v_row_id uuid;
  v_parent_id uuid;
  v_product_id uuid;
  v_supplier_id uuid;
  v_branch_id uuid;
  v_candidates uuid[];
  v_index bigint;
  v_counts jsonb;
  v_totals jsonb;
begin
  if private.normalized_writes_enabled(p_tenant_id) then raise exception using errcode='55000',message='A normalized-write tenant cannot be overwritten from its legacy snapshot.';end if;
  select *
  into v_workspace
  from public.tenant_workspaces
  where tenant_id = p_tenant_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.';
  end if;
  if p_expected_updated_at is not null
    and v_workspace.updated_at is distinct from p_expected_updated_at
  then
    raise exception using errcode = '40001', message = 'Workspace changed before normalization started.';
  end if;

  insert into public.workspace_migration_batches (
    migration_version,
    tenant_id,
    source_updated_at,
    source_payload_hash,
    status,
    started_at
  )
  values (
    'workspace-normalization-v1',
    p_tenant_id,
    v_workspace.updated_at,
    md5(v_workspace.payload::text),
    'running',
    statement_timestamp()
  )
  on conflict (tenant_id, migration_version, source_payload_hash) do update
  set status = 'running',
      started_at = statement_timestamp(),
      completed_at = null,
      error_details = '{}'::jsonb,
      updated_at = statement_timestamp()
  returning * into v_batch;

  -- Products: attach an existing row only when the business-key candidate is
  -- unique. Ambiguous rows get a new internal UUID and retain their legacy ID.
  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'products', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    select array_agg(candidate.id order by candidate.id)
    into v_candidates
    from (
      select product.id
      from public.products product
      where product.tenant_id = p_tenant_id
        and product.legacy_id is null
        and (
          (nullif(btrim(v_item ->> 'barcode'), '') is not null
            and product.barcode = nullif(btrim(v_item ->> 'barcode'), ''))
          or (nullif(btrim(v_item ->> 'sku'), '') is not null
            and product.sku = nullif(btrim(v_item ->> 'sku'), ''))
          or lower(btrim(product.name)) = lower(btrim(v_item ->> 'name'))
        )
      limit 2
    ) candidate;

    if cardinality(v_candidates) = 1
      and not exists (
        select 1 from public.products
        where tenant_id = p_tenant_id and legacy_id = v_legacy_id
      )
    then
      update public.products
      set legacy_id = v_legacy_id
      where id = v_candidates[1]
        and tenant_id = p_tenant_id
        and legacy_id is null;
    end if;

    insert into public.products (
      tenant_id, legacy_id, name, sku, barcode, category, unit,
      cost_price, selling_price, stock_qty, shop_stock_qty, store_stock_qty,
      alert_qty, image, brand, sell_in_retail, sell_in_wholesale,
      wholesale_price, min_wholesale_qty, source_updated_at,
      source_payload_hash, migration_batch_id, source_record, updated_at
    )
    values (
      p_tenant_id, v_legacy_id, coalesce(nullif(v_item ->> 'name', ''), 'Unnamed product'),
      nullif(v_item ->> 'sku', ''), nullif(v_item ->> 'barcode', ''),
      nullif(v_item ->> 'category', ''), nullif(v_item ->> 'unit', ''),
      private.safe_numeric(v_item ->> 'costPrice'),
      private.safe_numeric(v_item ->> 'sellingPrice'),
      private.safe_numeric(v_item ->> 'stockQty'),
      private.safe_numeric(v_item ->> 'shopStockQty'),
      private.safe_numeric(v_item ->> 'storeStockQty'),
      private.safe_numeric(v_item ->> 'alertQty'),
      nullif(v_item ->> 'image', ''), nullif(v_item ->> 'brand', ''),
      coalesce(private.safe_boolean(v_item ->> 'sellInRetail'), true),
      coalesce(private.safe_boolean(v_item ->> 'sellInWholesale'), false),
      private.safe_numeric(v_item ->> 'wholesalePrice'),
      private.safe_numeric(v_item ->> 'minWholesaleQty'),
      coalesce(
        private.safe_timestamptz(v_item ->> 'syncUpdatedAt'),
        private.safe_timestamptz(v_item ->> 'updatedAt'),
        v_workspace.updated_at
      ),
      md5(v_item::text), v_batch.id, v_item, statement_timestamp()
    )
    on conflict (tenant_id, legacy_id) where legacy_id is not null do update
    set source_active = true,
        name = excluded.name,
        sku = excluded.sku,
        barcode = excluded.barcode,
        category = excluded.category,
        unit = excluded.unit,
        cost_price = excluded.cost_price,
        selling_price = excluded.selling_price,
        stock_qty = excluded.stock_qty,
        shop_stock_qty = excluded.shop_stock_qty,
        store_stock_qty = excluded.store_stock_qty,
        alert_qty = excluded.alert_qty,
        image = excluded.image,
        brand = excluded.brand,
        sell_in_retail = excluded.sell_in_retail,
        sell_in_wholesale = excluded.sell_in_wholesale,
        wholesale_price = excluded.wholesale_price,
        min_wholesale_qty = excluded.min_wholesale_qty,
        source_updated_at = excluded.source_updated_at,
        source_payload_hash = excluded.source_payload_hash,
        migration_batch_id = excluded.migration_batch_id,
        source_record = excluded.source_record,
        updated_at = excluded.updated_at;
  end loop;

  -- Sales and immutable sale-item snapshots.
  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    v_branch_id := private.safe_uuid(v_item ->> 'branchId');
    if v_branch_id is not null and not exists (
      select 1 from public.branches where id = v_branch_id and tenant_id = p_tenant_id
    ) then
      v_branch_id := null;
    end if;

    insert into public.sales (
      tenant_id, legacy_id, reference, total, tax, delivery_cost,
      delivery_payment_method, discount, discount_type, payment_method,
      customer_name, customer_phone, staff_name, cashier_name, amount_paid,
      amount_due, vat_status, multi_cash_amount, multi_bank_amount, channel,
      approvals, sync_status, "timestamp", actual_timestamp, branch_id,
      source_updated_at, source_payload_hash, migration_batch_id, source_record
    )
    values (
      p_tenant_id, v_legacy_id, nullif(v_item ->> 'reference', ''),
      private.safe_numeric(v_item ->> 'total'), private.safe_numeric(v_item ->> 'tax'),
      private.safe_numeric(v_item ->> 'deliveryCost'), nullif(v_item ->> 'deliveryPaymentMethod', ''),
      private.safe_numeric(v_item ->> 'discount'), nullif(v_item ->> 'discountType', ''),
      nullif(v_item ->> 'paymentMethod', ''), nullif(v_item ->> 'customerName', ''),
      nullif(v_item ->> 'customerPhone', ''), nullif(v_item ->> 'staffName', ''),
      nullif(v_item ->> 'cashierName', ''), private.safe_numeric(v_item ->> 'amountPaid'),
      private.safe_numeric(v_item ->> 'amountDue'), nullif(v_item ->> 'vatStatus', ''),
      private.safe_numeric(v_item ->> 'multiCashAmount'),
      private.safe_numeric(v_item ->> 'multiBankAmount'),
      coalesce(nullif(v_item ->> 'channel', ''), 'retail'),
      coalesce(v_item -> 'approvals', '[]'::jsonb),
      coalesce(nullif(v_item ->> 'syncStatus', ''), 'synced'),
      coalesce(private.safe_timestamptz(v_item ->> 'timestamp'), v_workspace.updated_at),
      private.safe_timestamptz(v_item ->> 'actualTimestamp'), v_branch_id,
      coalesce(private.safe_timestamptz(v_item ->> 'syncUpdatedAt'), v_workspace.updated_at),
      md5(v_item::text), v_batch.id, v_item
    )
    on conflict (tenant_id, legacy_id) where legacy_id is not null do update
    set source_active = true,
        reference = excluded.reference,
        total = excluded.total,
        tax = excluded.tax,
        delivery_cost = excluded.delivery_cost,
        delivery_payment_method = excluded.delivery_payment_method,
        discount = excluded.discount,
        discount_type = excluded.discount_type,
        payment_method = excluded.payment_method,
        customer_name = excluded.customer_name,
        customer_phone = excluded.customer_phone,
        staff_name = excluded.staff_name,
        cashier_name = excluded.cashier_name,
        amount_paid = excluded.amount_paid,
        amount_due = excluded.amount_due,
        vat_status = excluded.vat_status,
        multi_cash_amount = excluded.multi_cash_amount,
        multi_bank_amount = excluded.multi_bank_amount,
        channel = excluded.channel,
        approvals = excluded.approvals,
        sync_status = excluded.sync_status,
        "timestamp" = excluded."timestamp",
        actual_timestamp = excluded.actual_timestamp,
        branch_id = excluded.branch_id,
        source_updated_at = excluded.source_updated_at,
        source_payload_hash = excluded.source_payload_hash,
        migration_batch_id = excluded.migration_batch_id,
        source_record = excluded.source_record
    returning id into v_parent_id;

    v_index := 0;
    for v_child in
      select value from jsonb_array_elements(coalesce(v_item -> 'items', '[]'::jsonb))
    loop
      v_index := v_index + 1;
      v_child_legacy_id := v_legacy_id || ':item:' || v_index::text;
      select id into v_product_id
      from public.products
      where tenant_id = p_tenant_id and legacy_id = nullif(v_child ->> 'productId', '')
      limit 1;
      insert into public.sale_items (
        tenant_id, legacy_id, sale_id, product_id, product_name, qty, price,
        discount, discount_type, dosage_type, tabs_selected, tabs_per_pack,
        channel, branch_id, source_updated_at, migration_batch_id, source_record
      )
      values (
        p_tenant_id, v_child_legacy_id, v_parent_id, v_product_id,
        nullif(v_child ->> 'productName', ''), private.safe_numeric(v_child ->> 'qty'),
        private.safe_numeric(v_child ->> 'price'), private.safe_numeric(v_child ->> 'discount'),
        nullif(v_child ->> 'discountType', ''), nullif(v_child ->> 'dosageType', ''),
        private.safe_integer(v_child ->> 'tabsSelected'),
        private.safe_integer(v_child ->> 'tabsPerPack'),
        nullif(v_child ->> 'channel', ''), v_branch_id,
        coalesce(private.safe_timestamptz(v_item ->> 'syncUpdatedAt'), v_workspace.updated_at),
        v_batch.id, v_child
      )
      on conflict (tenant_id, legacy_id) where tenant_id is not null and legacy_id is not null do update
      set source_active = true,
        sale_id = excluded.sale_id,
          product_id = excluded.product_id,
          product_name = excluded.product_name,
          qty = excluded.qty,
          price = excluded.price,
          discount = excluded.discount,
          discount_type = excluded.discount_type,
          dosage_type = excluded.dosage_type,
          tabs_selected = excluded.tabs_selected,
          tabs_per_pack = excluded.tabs_per_pack,
          channel = excluded.channel,
          branch_id = excluded.branch_id,
          source_updated_at = excluded.source_updated_at,
          migration_batch_id = excluded.migration_batch_id,
          source_record = excluded.source_record;
    end loop;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    v_branch_id := private.safe_uuid(v_item ->> 'branchId');
    if v_branch_id is not null and not exists (
      select 1 from public.branches where id = v_branch_id and tenant_id = p_tenant_id
    ) then v_branch_id := null; end if;
    insert into public.expenses (
      tenant_id, legacy_id, category, amount, description, staff_name,
      receipt_ref, receipt_image, transaction_message, note, "timestamp",
      branch_id, source_updated_at, source_payload_hash, migration_batch_id, source_record
    )
    values (
      p_tenant_id, v_legacy_id, nullif(v_item ->> 'category', ''),
      private.safe_numeric(v_item ->> 'amount'), nullif(v_item ->> 'description', ''),
      nullif(v_item ->> 'staffName', ''), nullif(v_item ->> 'receiptRef', ''),
      nullif(v_item ->> 'receiptImage', ''), nullif(v_item ->> 'transactionMessage', ''),
      nullif(v_item ->> 'note', ''),
      coalesce(private.safe_timestamptz(v_item ->> 'timestamp'), v_workspace.updated_at),
      v_branch_id, v_workspace.updated_at, md5(v_item::text), v_batch.id, v_item
    )
    on conflict (tenant_id, legacy_id) where legacy_id is not null do update
    set source_active = true,
        category = excluded.category, amount = excluded.amount,
        description = excluded.description, staff_name = excluded.staff_name,
        receipt_ref = excluded.receipt_ref, receipt_image = excluded.receipt_image,
        transaction_message = excluded.transaction_message, note = excluded.note,
        "timestamp" = excluded."timestamp", branch_id = excluded.branch_id,
        source_updated_at = excluded.source_updated_at,
        source_payload_hash = excluded.source_payload_hash,
        migration_batch_id = excluded.migration_batch_id,
        source_record = excluded.source_record;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    v_branch_id := private.safe_uuid(v_item ->> 'branchId');
    if v_branch_id is not null and not exists (
      select 1 from public.branches where id = v_branch_id and tenant_id = p_tenant_id
    ) then v_branch_id := null; end if;
    select id into v_parent_id from public.sales
      where tenant_id = p_tenant_id and legacy_id = nullif(v_item ->> 'saleId', '') limit 1;
    insert into public.deliveries (
      tenant_id, legacy_id, sale_id, customer_name, customer_phone, total_amount,
      delivery_cost, delivery_payment_method, status, rider_details, notes,
      "timestamp", dispatched_at, delivered_at, branch_id, source_updated_at,
      source_payload_hash, migration_batch_id, source_record
    )
    values (
      p_tenant_id, v_legacy_id, v_parent_id, nullif(v_item ->> 'customerName', ''),
      nullif(v_item ->> 'customerPhone', ''), private.safe_numeric(v_item ->> 'totalAmount'),
      private.safe_numeric(v_item ->> 'deliveryCost'),
      nullif(v_item ->> 'deliveryPaymentMethod', ''), nullif(v_item ->> 'status', ''),
      coalesce(v_item -> 'riderDetails', '{}'::jsonb), nullif(v_item ->> 'notes', ''),
      coalesce(private.safe_timestamptz(v_item ->> 'timestamp'), v_workspace.updated_at),
      private.safe_timestamptz(v_item ->> 'dispatchedAt'),
      private.safe_timestamptz(v_item ->> 'deliveredAt'), v_branch_id,
      v_workspace.updated_at, md5(v_item::text), v_batch.id, v_item
    )
    on conflict (tenant_id, legacy_id) where legacy_id is not null do update
    set source_active = true,
        sale_id = excluded.sale_id, customer_name = excluded.customer_name,
        customer_phone = excluded.customer_phone, total_amount = excluded.total_amount,
        delivery_cost = excluded.delivery_cost,
        delivery_payment_method = excluded.delivery_payment_method,
        status = excluded.status, rider_details = excluded.rider_details,
        notes = excluded.notes, "timestamp" = excluded."timestamp",
        dispatched_at = excluded.dispatched_at, delivered_at = excluded.delivered_at,
        branch_id = excluded.branch_id, source_updated_at = excluded.source_updated_at,
        source_payload_hash = excluded.source_payload_hash,
        migration_batch_id = excluded.migration_batch_id,
        source_record = excluded.source_record;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    v_branch_id := private.safe_uuid(v_item ->> 'branchId');
    if v_branch_id is not null and not exists (
      select 1 from public.branches where id = v_branch_id and tenant_id = p_tenant_id
    ) then v_branch_id := null; end if;
    v_supplier_id := private.safe_uuid(v_item ->> 'supplierId');
    if v_supplier_id is not null and not exists (
      select 1 from public.suppliers where id = v_supplier_id and tenant_id = p_tenant_id
    ) then v_supplier_id := null; end if;
    insert into public.purchases (
      tenant_id, legacy_id, supplier_id, supplier_name, total_amount, amount_paid,
      amount_due, destination, delivery_status, discount, discount_type,
      delivery_fee, "timestamp", branch_id, source_updated_at,
      source_payload_hash, migration_batch_id, source_record
    )
    values (
      p_tenant_id, v_legacy_id, v_supplier_id,
      nullif(v_item ->> 'supplierName', ''), private.safe_numeric(v_item ->> 'totalAmount'),
      private.safe_numeric(v_item ->> 'amountPaid'), private.safe_numeric(v_item ->> 'amountDue'),
      nullif(v_item ->> 'destination', ''), nullif(v_item ->> 'deliveryStatus', ''),
      private.safe_numeric(v_item ->> 'discount'), nullif(v_item ->> 'discountType', ''),
      private.safe_numeric(v_item ->> 'deliveryFee'),
      coalesce(private.safe_timestamptz(v_item ->> 'timestamp'), v_workspace.updated_at),
      v_branch_id, v_workspace.updated_at, md5(v_item::text), v_batch.id, v_item
    )
    on conflict (tenant_id, legacy_id) where legacy_id is not null do update
    set source_active = true,
        supplier_id = excluded.supplier_id, supplier_name = excluded.supplier_name,
        total_amount = excluded.total_amount, amount_paid = excluded.amount_paid,
        amount_due = excluded.amount_due, destination = excluded.destination,
        delivery_status = excluded.delivery_status, discount = excluded.discount,
        discount_type = excluded.discount_type, delivery_fee = excluded.delivery_fee,
        "timestamp" = excluded."timestamp", branch_id = excluded.branch_id,
        source_updated_at = excluded.source_updated_at,
        source_payload_hash = excluded.source_payload_hash,
        migration_batch_id = excluded.migration_batch_id,
        source_record = excluded.source_record
    returning id into v_parent_id;

    v_index := 0;
    for v_child in
      select value from jsonb_array_elements(coalesce(v_item -> 'items', '[]'::jsonb))
    loop
      v_index := v_index + 1;
      v_child_legacy_id := v_legacy_id || ':item:' || v_index::text;
      select id into v_product_id from public.products
        where tenant_id = p_tenant_id and legacy_id = nullif(v_child ->> 'productId', '') limit 1;
      insert into public.purchase_items (
        tenant_id, legacy_id, purchase_id, product_id, product_name, qty,
        cost_price, branch_id, source_updated_at, migration_batch_id, source_record
      )
      values (
        p_tenant_id, v_child_legacy_id, v_parent_id, v_product_id,
        nullif(v_child ->> 'productName', ''), private.safe_numeric(v_child ->> 'qty'),
        private.safe_numeric(v_child ->> 'costPrice'), v_branch_id,
        v_workspace.updated_at, v_batch.id, v_child
      )
      on conflict (tenant_id, legacy_id) where tenant_id is not null and legacy_id is not null do update
      set source_active = true,
        purchase_id = excluded.purchase_id, product_id = excluded.product_id,
          product_name = excluded.product_name, qty = excluded.qty,
          cost_price = excluded.cost_price, branch_id = excluded.branch_id,
          source_updated_at = excluded.source_updated_at,
          migration_batch_id = excluded.migration_batch_id,
          source_record = excluded.source_record;
    end loop;
  end loop;

  -- Refuse to certify a moving source.
  perform private.refresh_workspace_source_activity(p_tenant_id,v_workspace.payload);

  if not exists (
    select 1 from public.tenant_workspaces
    where tenant_id = p_tenant_id and updated_at = v_workspace.updated_at
  ) then
    raise exception using errcode = '40001', message = 'Workspace changed during normalization.';
  end if;

  select jsonb_build_object(
    'products', count(*) filter (where table_name = 'products'),
    'sales', count(*) filter (where table_name = 'sales'),
    'saleItems', count(*) filter (where table_name = 'sale_items'),
    'expenses', count(*) filter (where table_name = 'expenses'),
    'deliveries', count(*) filter (where table_name = 'deliveries'),
    'purchases', count(*) filter (where table_name = 'purchases'),
    'purchaseItems', count(*) filter (where table_name = 'purchase_items')
  )
  into v_counts
  from (
    select 'products' table_name from public.products where tenant_id = p_tenant_id and legacy_id is not null and source_active
    union all select 'sales' from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active
    union all select 'sale_items' from public.sale_items where tenant_id = p_tenant_id and legacy_id is not null and source_active
    union all select 'expenses' from public.expenses where tenant_id = p_tenant_id and legacy_id is not null and source_active
    union all select 'deliveries' from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active
    union all select 'purchases' from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active
    union all select 'purchase_items' from public.purchase_items where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ) tracked;

  select jsonb_build_object(
    'salesTotal', coalesce((select sum(total) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'salesTax', coalesce((select sum(tax) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'salesPaid', coalesce((select sum(amount_paid) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'salesDue', coalesce((select sum(amount_due) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'expenseAmount', coalesce((select sum(amount) from public.expenses where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'deliveryTotal', coalesce((select sum(total_amount) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'deliveryCost', coalesce((select sum(delivery_cost) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'purchaseTotal', coalesce((select sum(total_amount) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'purchasePaid', coalesce((select sum(amount_paid) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'purchaseDue', coalesce((select sum(amount_due) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0)
  ) into v_totals;

  update public.workspace_migration_batches
  set status = 'processed',
      completed_at = statement_timestamp(),
      row_counts = v_counts,
      financial_totals = v_totals,
      updated_at = statement_timestamp()
  where id = v_batch.id
  returning * into v_batch;

  update public.workspace_normalization_outbox
  set status = 'completed',
      locked_at = null,
      locked_by = null,
      last_error = '{}'::jsonb,
      updated_at = statement_timestamp()
  where tenant_id = p_tenant_id
    and workspace_updated_at = v_workspace.updated_at;

  return v_batch;
exception
  when others then
    update public.workspace_normalization_outbox
    set status = 'failed',
        attempts = attempts + 1,
        available_at = statement_timestamp() + interval '5 minutes',
        locked_at = null,
        locked_by = null,
        last_error = jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm),
        updated_at = statement_timestamp()
    where tenant_id = p_tenant_id;
    raise;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_branch_stock_snapshot(p_tenant_id uuid, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_workspace public.tenant_workspaces%rowtype;
  v_batch_id uuid;
  v_item jsonb;
  v_ordinal bigint;
  v_legacy_id text;
  v_branch_id uuid;
  v_count bigint;
  v_quantity numeric;
  v_shop_quantity numeric;
  v_store_quantity numeric;
begin
  if private.normalized_writes_enabled(p_tenant_id) then raise exception using errcode='55000',message='A normalized-write tenant cannot be overwritten from its legacy snapshot.';end if;
  select * into v_workspace
  from public.tenant_workspaces
  where tenant_id = p_tenant_id
  for share;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;
  if v_workspace.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Workspace changed before branch stock normalization.';
  end if;

  select id into v_batch_id
  from public.workspace_migration_batches
  where tenant_id = p_tenant_id
    and source_updated_at = v_workspace.updated_at
  order by created_at desc
  limit 1;

  for v_item, v_ordinal in
    select item, ordinal::bigint
    from jsonb_array_elements(coalesce(v_workspace.payload -> 'branchStocks', '[]'::jsonb))
      with ordinality as source(item, ordinal)
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    v_branch_id := private.safe_uuid(v_item ->> 'branchId');
    if v_branch_id is null or not exists (
      select 1 from public.branches where id = v_branch_id and tenant_id = p_tenant_id
    ) then
      raise exception using errcode = '23503', message = 'Branch stock references an invalid tenant branch.';
    end if;
    if nullif(btrim(v_item ->> 'productId'), '') is null then
      raise exception using errcode = '23502', message = 'Branch stock is missing its product identifier.';
    end if;

    insert into public.branch_stock (
      tenant_id, branch_id, product_id, quantity, shop_stock_qty,
      store_stock_qty, buying_price, selling_price, low_stock_alert,
      legacy_id, source_record, source_ordinal, source_updated_at,
      migration_batch_id, updated_at
    )
    values (
      p_tenant_id, v_branch_id, btrim(v_item ->> 'productId'),
      private.safe_numeric(v_item ->> 'quantity'),
      private.safe_numeric(v_item ->> 'shopStockQty'),
      private.safe_numeric(v_item ->> 'storeStockQty'),
      private.safe_numeric(v_item ->> 'buyingPrice'),
      private.safe_numeric(v_item ->> 'sellingPrice'),
      private.safe_numeric(v_item ->> 'lowStockAlert'),
      v_legacy_id, v_item, v_ordinal,
      coalesce(private.safe_timestamptz(v_item ->> 'updatedAt'), v_workspace.updated_at),
      v_batch_id, statement_timestamp()
    )
    on conflict (tenant_id, branch_id, product_id) do update
    set source_active = true,
        quantity = excluded.quantity,
        shop_stock_qty = excluded.shop_stock_qty,
        store_stock_qty = excluded.store_stock_qty,
        buying_price = excluded.buying_price,
        selling_price = excluded.selling_price,
        low_stock_alert = excluded.low_stock_alert,
        legacy_id = excluded.legacy_id,
        source_record = excluded.source_record,
        source_ordinal = excluded.source_ordinal,
        source_updated_at = excluded.source_updated_at,
        migration_batch_id = excluded.migration_batch_id,
        updated_at = excluded.updated_at;
  end loop;

  perform private.refresh_workspace_source_activity(p_tenant_id,v_workspace.payload);

  if not exists (
    select 1 from public.tenant_workspaces
    where tenant_id = p_tenant_id and updated_at = v_workspace.updated_at
  ) then
    raise exception using errcode = '40001', message = 'Workspace changed during branch stock normalization.';
  end if;

  select count(*), coalesce(sum(quantity), 0), coalesce(sum(shop_stock_qty), 0),
         coalesce(sum(store_stock_qty), 0)
  into v_count, v_quantity, v_shop_quantity, v_store_quantity
  from public.branch_stock
  where tenant_id = p_tenant_id and legacy_id is not null and source_active;

  return jsonb_build_object(
    'count', v_count,
    'quantity', v_quantity,
    'shopStockQty', v_shop_quantity,
    'storeStockQty', v_store_quantity
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.rollback_workspace_normalized_read(p_tenant_id uuid, p_reason text DEFAULT 'manual_rollback'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_snapshot jsonb;
begin
  if private.normalized_writes_enabled(p_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=p_tenant_id for update;
    v_snapshot:=private.normalized_business_snapshot(p_tenant_id);
    update public.workspace_migration_state set normalized_writes_enabled=false where tenant_id=p_tenant_id;
    perform set_config('app.jasper_explicit_settings_tenant',p_tenant_id::text,true);
    update public.tenant_workspaces set payload=v_snapshot-'businessStorage',updated_at=statement_timestamp() where tenant_id=p_tenant_id;
  end if;
  update public.workspace_migration_state
  set phase='rolled_back', read_mode='legacy', dual_write_enabled=true,
      last_error=jsonb_build_object('code','normalized_read_rollback','reason',left(coalesce(p_reason,'manual_rollback'),240),'at',now()), updated_at=now()
  where tenant_id=p_tenant_id;
  if not found then raise exception using errcode='P0002', message='Workspace migration state was not found.'; end if;
end; $function$
;
create or replace function private.guard_normalized_workspace_storage()
returns trigger language plpgsql set search_path='' as $$
begin
  if private.normalized_writes_enabled(new.tenant_id) and new.payload ?| array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes'] then
    raise exception using errcode='55000',message='Business records are stored in normalized tables. Reload and use the current save API.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_normalized_workspace_storage() from public,anon,authenticated;
create trigger guard_normalized_workspace_storage before insert or update of payload on public.tenant_workspaces
for each row execute function private.guard_normalized_workspace_storage();

-- Only a privileged operator can enable this, after tenant-specific gates pass.
create or replace function private.enable_normalized_business_writes(p_tenant_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_workspace public.tenant_workspaces%rowtype;
begin
  select * into strict v_workspace from public.tenant_workspaces where tenant_id=p_tenant_id for update;
  if private.normalized_writes_enabled(p_tenant_id) then return;end if;
  if not private.workspace_normalized_reads_ready(p_tenant_id)
    or not (public.validate_workspace_shadow_content(p_tenant_id)->>'allMatch')::boolean
    or not (public.validate_branch_stock_shadow(p_tenant_id)->>'allMatch')::boolean then
    raise exception using errcode='55000',message='Verified normalized read cutover is required before direct writes.';
  end if;
  insert into private.normalized_write_cutover_archives(tenant_id,payload,source_updated_at,source_payload_hash)
  values(p_tenant_id,v_workspace.payload,v_workspace.updated_at,md5(v_workspace.payload::text)) on conflict(tenant_id) do nothing;
  update public.workspace_migration_state set normalized_writes_enabled=true,normalized_writes_activated_at=statement_timestamp(),
    dual_write_enabled=false,phase='normalized',read_mode='normalized',last_error='{}',updated_at=statement_timestamp() where tenant_id=p_tenant_id;
  perform private.persist_normalized_business_snapshot(p_tenant_id,v_workspace.payload);
  update public.tenant_workspaces set payload=(payload-array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes'])||jsonb_build_object('businessStorage','normalized'),
    updated_at=statement_timestamp() where tenant_id=p_tenant_id;
  update public.workspace_normalization_outbox set status='completed',locked_at=null,locked_by=null,last_error='{}',updated_at=statement_timestamp() where tenant_id=p_tenant_id;
end;
$$;
revoke all on function private.enable_normalized_business_writes(uuid) from public,anon,authenticated;

create or replace function public.get_tenant_workspace_snapshot(p_tenant_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('tenant_id',tenant_id,'payload',case when private.normalized_writes_enabled(tenant_id) then private.normalized_business_snapshot(tenant_id) else payload end,'updated_at',updated_at)
 from public.tenant_workspaces where tenant_id=p_tenant_id;
$$;
revoke all on function public.get_tenant_workspace_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_tenant_workspace_snapshot(uuid) to service_role;

create or replace function private.legacy_business_data_key(p_key text)
returns text language sql immutable set search_path='' as $$
 select case p_key
  when 'products' then 'products' when 'products_map' then 'products'
  when 'sales' then 'sales' when 'sales_map' then 'sales'
  when 'expenses' then 'expenses' when 'expenses_map' then 'expenses'
  when 'deliveries' then 'deliveries' when 'deliveries_map' then 'deliveries'
  when 'purchases' then 'purchases' when 'purchases_map' then 'purchases'
  when 'pendingDeliveryNotes' then 'pendingDeliveryNotes' when 'pendingDeliveryNotes_map' then 'pendingDeliveryNotes'
  when 'pending_delivery_notes_map' then 'pendingDeliveryNotes'
  when 'branchStocks' then 'branchStocks' when 'branch_stocks_map' then 'branchStocks'
  else null end;
$$;
revoke all on function private.legacy_business_data_key(text) from public,anon,authenticated;

create or replace function public.route_current_branch_business_data(p_key text,p_payload jsonb default null,p_write boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tenant uuid:=private.current_tenant_id();v_key text;v_records jsonb;v_result jsonb;v_payload jsonb;
begin
 if (select auth.uid()) is null or v_tenant is null then raise exception using errcode='42501',message='Tenant authentication is required.';end if;
 v_key:=private.legacy_business_data_key(p_key);
 if not private.normalized_writes_enabled(v_tenant) or (v_key is null and p_key<>'__all__') then return jsonb_build_object('handled',false);end if;
 if p_write then
   if v_key is null then raise exception using errcode='22023',message='A supported business collection is required.';end if;
   v_records:=case when jsonb_typeof(p_payload)='array' then p_payload else p_payload->v_tenant::text end;
   if jsonb_typeof(v_records) is distinct from 'array' then raise exception using errcode='22023',message='A records array is required.';end if;
   case v_key
    when 'products' then perform public.save_current_branch_products(v_records,'{}'::jsonb);
    when 'sales' then perform public.save_current_branch_sales(v_records,'{}'::jsonb,null,null);
    when 'expenses' then perform public.save_current_branch_expenses(v_records,'{}'::jsonb);
    when 'deliveries' then perform public.save_current_branch_deliveries(v_records,'{}'::jsonb);
    when 'purchases' then perform public.save_current_branch_purchases(v_records,'{}'::jsonb,null,null);
    else
      v_payload:=public.get_current_branch_workspace()->'payload';
      perform public.save_current_branch_workspace(jsonb_set(v_payload,array[v_key],v_records,true));
   end case;
 end if;
 v_payload:=public.get_current_branch_workspace()->'payload';
 if p_key='__all__' then
   v_result:=v_payload;
   for v_key in select unnest(array['products','sales','expenses','deliveries','purchases','pendingDeliveryNotes','branchStocks']) loop
    v_result:=v_result||jsonb_build_object(v_key||'_map',jsonb_build_object(v_tenant::text,coalesce(v_payload->v_key,'[]'::jsonb)));
   end loop;
 else
   v_result:=case when p_key like '%\_map' escape '\' then jsonb_build_object(v_tenant::text,coalesce(v_payload->v_key,'[]'::jsonb)) else coalesce(v_payload->v_key,'[]'::jsonb) end;
 end if;
 return jsonb_build_object('handled',true,'payload',v_result);
end;
$$;
revoke all on function public.route_current_branch_business_data(text,jsonb,boolean) from public,anon;
grant execute on function public.route_current_branch_business_data(text,jsonb,boolean) to authenticated;

notify pgrst,'reload schema';

