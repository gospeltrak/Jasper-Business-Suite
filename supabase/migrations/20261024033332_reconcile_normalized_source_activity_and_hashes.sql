set local lock_timeout='5s';
set local statement_timeout='60s';

-- Existing business rows and legacy IDs are retained, including native non-legacy products.
alter table public.products add column if not exists source_active boolean not null default true;
alter table public.sales add column if not exists source_active boolean not null default true;
alter table public.sale_items add column if not exists source_active boolean not null default true;
alter table public.expenses add column if not exists source_active boolean not null default true;
alter table public.deliveries add column if not exists source_active boolean not null default true;
alter table public.purchases add column if not exists source_active boolean not null default true;
alter table public.purchase_items add column if not exists source_active boolean not null default true;
alter table public.branch_stock add column if not exists source_active boolean not null default true;

-- Retain migration-managed historical rows and their immutable identifiers.
-- Only rows present in the current authoritative workspace participate in live reads.
create or replace function private.refresh_workspace_source_activity(p_tenant_id uuid,p_payload jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_table text; v_key text;
begin
  for v_table,v_key in select * from (values
    ('products','products'),('sales','sales'),('expenses','expenses'),
    ('deliveries','deliveries'),('purchases','purchases'),('branch_stock','branchStocks')
  ) as collections(table_name,payload_key) loop
    execute format($sql$
      with live as (
        select coalesce(nullif(btrim(item->>'id'),''),'hash:'||md5(item::text)) as legacy_id
        from jsonb_array_elements(coalesce($2->$3,'[]'::jsonb)) as item
      ), decisions as (
        select target.id,exists(select 1 from live where live.legacy_id=target.legacy_id) as active
        from public.%I as target where target.tenant_id=$1 and target.legacy_id is not null
      )
      update public.%I as target set source_active=decisions.active from decisions
      where target.id=decisions.id and target.tenant_id=$1 and target.source_active is distinct from decisions.active
    $sql$,v_table,v_table) using p_tenant_id,p_payload,v_key;
  end loop;
  for v_table,v_key in select * from (values ('sale_items','sales'),('purchase_items','purchases')) as children(table_name,payload_key) loop
    execute format($sql$
      with live as (
        select coalesce(nullif(btrim(parent->>'id'),''),'hash:'||md5(parent::text))||':item:'||ordinal::text as legacy_id
        from jsonb_array_elements(coalesce($2->$3,'[]'::jsonb)) as parent
        cross join lateral jsonb_array_elements(coalesce(parent->'items','[]'::jsonb)) with ordinality as children(item,ordinal)
      ), decisions as (
        select target.id,exists(select 1 from live where live.legacy_id=target.legacy_id) as active
        from public.%I as target where target.tenant_id=$1 and target.legacy_id is not null
      )
      update public.%I as target set source_active=decisions.active from decisions
      where target.id=decisions.id and target.tenant_id=$1 and target.source_active is distinct from decisions.active
    $sql$,v_table,v_table) using p_tenant_id,p_payload,v_key;
  end loop;
end;
$$;
revoke all on function private.refresh_workspace_source_activity(uuid,jsonb) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION public.get_current_branch_workspace_page(p_collection text, p_limit integer DEFAULT 100, p_cursor_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid)
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
  v_all_branches boolean := false;
  v_table regclass;
  v_page_size integer := least(greatest(coalesce(p_limit, 100), 1), 1000);
  v_wrapped jsonb := '[]'::jsonb;
  v_records jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_next_cursor jsonb := null;
begin
  if v_tenant_id is null or (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  if (p_cursor_timestamp is null) <> (p_cursor_id is null) then
    raise exception using errcode = '22023', message = 'Both cursor fields are required.';
  end if;

  v_table := case p_collection
    when 'sales' then 'public.sales'::regclass
    when 'expenses' then 'public.expenses'::regclass
    when 'deliveries' then 'public.deliveries'::regclass
    when 'purchases' then 'public.purchases'::regclass
    else null
  end;
  if v_table is null then
    raise exception using errcode = '22023', message = 'Unsupported workspace collection.';
  end if;

  if not private.workspace_normalized_reads_ready(v_tenant_id) then
    return jsonb_build_object(
      'collection', p_collection,
      'records', '[]'::jsonb,
      'hasMore', false,
      'nextCursor', null,
      'readSource', 'legacy_fallback',
      'fallbackRequired', true
    );
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
  then
    v_all_branches := true;
    v_include_unassigned := true;
    v_branch_id := null;
  elsif v_scope = 'compatibility_primary' then
    v_include_unassigned := true;
    v_branch_id := null;
  elsif v_scope = 'branch' and v_branch_id is not null then
    v_include_unassigned := coalesce(
      (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
      false
    );
  else
    return jsonb_build_object(
      'collection', p_collection,
      'records', '[]'::jsonb,
      'hasMore', false,
      'nextCursor', null,
      'readSource', 'normalized',
      'fallbackRequired', false
    );
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(
       ''record'', page.source_record,
       ''cursorTimestamp'', page.sort_time,
       ''cursorId'', page.id
     ) order by page.sort_time desc, page.id), ''[]''::jsonb)
     from (
       select row_data.id, row_data."timestamp" as sort_time, row_data.source_record
       from %s as target_data
       where row_data.tenant_id = $1
         and row_data.legacy_id is not null and row_data.source_active
         and row_data.source_record is not null
         and ($2
           or row_data.branch_id = $3
           or ($4 and row_data.branch_id is null))
         and ($5::timestamptz is null
           or row_data."timestamp" < $5
           or (row_data."timestamp" = $5 and row_data.id > $6))
       order by row_data."timestamp" desc, row_data.id
       limit $7
     ) as page',
    v_table
  )
  into v_wrapped
  using v_tenant_id, v_all_branches, v_branch_id, v_include_unassigned,
        p_cursor_timestamp, p_cursor_id, v_page_size + 1;

  v_has_more := jsonb_array_length(v_wrapped) > v_page_size;
  if v_has_more then
    v_wrapped := v_wrapped - v_page_size;
  end if;

  select coalesce(jsonb_agg(item -> 'record' order by ordinal), '[]'::jsonb)
  into v_records
  from jsonb_array_elements(v_wrapped) with ordinality as page(item, ordinal);

  if v_has_more and jsonb_array_length(v_wrapped) > 0 then
    v_next_cursor := jsonb_build_object(
      'timestamp', v_wrapped -> (jsonb_array_length(v_wrapped) - 1) ->> 'cursorTimestamp',
      'id', v_wrapped -> (jsonb_array_length(v_wrapped) - 1) ->> 'cursorId'
    );
  end if;

  return jsonb_build_object(
    'collection', p_collection,
    'records', v_records,
    'hasMore', v_has_more,
    'nextCursor', v_next_cursor,
    'readSource', 'normalized',
    'fallbackRequired', false
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

CREATE OR REPLACE FUNCTION public.reconcile_workspace_normalization(p_tenant_id uuid, p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS workspace_reconciliation_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_workspace public.tenant_workspaces%rowtype;
  v_version text;
  v_source_counts jsonb;
  v_target_counts jsonb;
  v_source_totals jsonb;
  v_target_totals jsonb;
  v_mismatches jsonb;
  v_is_match boolean;
  v_result public.workspace_reconciliation_runs%rowtype;
begin
  select * into v_workspace from public.tenant_workspaces where tenant_id = p_tenant_id;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;
  select coalesce(state.migration_version, 'workspace-normalization-v1')
    into v_version from public.workspace_migration_state state where state.tenant_id = p_tenant_id;
  v_version := coalesce(v_version, 'workspace-normalization-v1');

  select jsonb_build_object(
    'products', jsonb_array_length(coalesce(v_workspace.payload -> 'products', '[]'::jsonb)),
    'sales', jsonb_array_length(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)),
    'saleItems', coalesce((select sum(jsonb_array_length(coalesce(item -> 'items', '[]'::jsonb))) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'expenses', jsonb_array_length(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb)),
    'deliveries', jsonb_array_length(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)),
    'purchases', jsonb_array_length(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)),
    'purchaseItems', coalesce((select sum(jsonb_array_length(coalesce(item -> 'items', '[]'::jsonb))) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0)
  ) into v_source_counts;

  select jsonb_build_object(
    'products', (select count(*) from public.products where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'sales', (select count(*) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'saleItems', (select count(*) from public.sale_items where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'expenses', (select count(*) from public.expenses where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'deliveries', (select count(*) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'purchases', (select count(*) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'purchaseItems', (select count(*) from public.purchase_items where tenant_id = p_tenant_id and legacy_id is not null and source_active)
  ) into v_target_counts;

  select jsonb_build_object(
    'salesTotal', coalesce((select sum(private.safe_numeric(item ->> 'total')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'salesTax', coalesce((select sum(private.safe_numeric(item ->> 'tax')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'salesPaid', coalesce((select sum(private.safe_numeric(item ->> 'amountPaid')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'salesDue', coalesce((select sum(private.safe_numeric(item ->> 'amountDue')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'expenseAmount', coalesce((select sum(private.safe_numeric(item ->> 'amount')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb)) item), 0),
    'deliveryTotal', coalesce((select sum(private.safe_numeric(item ->> 'totalAmount')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)) item), 0),
    'deliveryCost', coalesce((select sum(private.safe_numeric(item ->> 'deliveryCost')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)) item), 0),
    'purchaseTotal', coalesce((select sum(private.safe_numeric(item ->> 'totalAmount')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0),
    'purchasePaid', coalesce((select sum(private.safe_numeric(item ->> 'amountPaid')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0),
    'purchaseDue', coalesce((select sum(private.safe_numeric(item ->> 'amountDue')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0)
  ) into v_source_totals;

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
  ) into v_target_totals;

  v_mismatches := jsonb_strip_nulls(jsonb_build_object(
    'counts', case when v_source_counts is distinct from v_target_counts then jsonb_build_object('source', v_source_counts, 'target', v_target_counts) end,
    'totals', case when v_source_totals is distinct from v_target_totals then jsonb_build_object('source', v_source_totals, 'target', v_target_totals) end
  ));
  v_is_match := v_mismatches = '{}'::jsonb;
  insert into public.workspace_reconciliation_runs(batch_id, tenant_id, migration_version, source_updated_at, source_payload_hash, source_counts, target_counts, source_totals, target_totals, mismatch_details, is_match)
  values(p_batch_id, p_tenant_id, v_version, v_workspace.updated_at, md5(v_workspace.payload::text), v_source_counts, v_target_counts, v_source_totals, v_target_totals, v_mismatches, v_is_match)
  returning * into v_result;
  if p_batch_id is not null then
    update public.workspace_migration_batches
    set status = case when v_is_match then 'verified' else 'processed' end,
        completed_at = case when v_is_match then statement_timestamp() else completed_at end,
        error_details = case when v_is_match then '{}'::jsonb else v_mismatches end,
        updated_at = statement_timestamp()
    where id = p_batch_id
      and tenant_id = p_tenant_id;
  end if;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_branch_stock_shadow(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source jsonb;
  v_target jsonb;
  v_source_count bigint;
  v_target_count bigint;
  v_source_quantity numeric;
  v_target_quantity numeric;
begin
  select coalesce(payload -> 'branchStocks', '[]'::jsonb)
  into v_source from public.tenant_workspaces where tenant_id = p_tenant_id;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;
  select coalesce(jsonb_agg(source_record order by source_ordinal), '[]'::jsonb),
         count(*), coalesce(sum(quantity), 0)
  into v_target, v_target_count, v_target_quantity
  from public.branch_stock where tenant_id = p_tenant_id and legacy_id is not null and source_active;
  select jsonb_array_length(v_source),
         coalesce(sum(private.safe_numeric(item ->> 'quantity')), 0)
  into v_source_count, v_source_quantity
  from jsonb_array_elements(v_source) item;
  return jsonb_build_object(
    'allMatch', v_source = v_target
      and v_source_count = v_target_count
      and v_source_quantity = v_target_quantity,
    'contentMatch', v_source = v_target,
    'sourceCount', v_source_count,
    'targetCount', v_target_count,
    'sourceQuantity', v_source_quantity,
    'targetQuantity', v_target_quantity
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_workspace_shadow_content(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payload jsonb;
  v_products boolean;
  v_sales boolean;
  v_sale_items boolean;
  v_expenses boolean;
  v_deliveries boolean;
  v_purchases boolean;
  v_purchase_items boolean;
begin
  select payload into v_payload
  from public.tenant_workspaces where tenant_id = p_tenant_id;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;

  v_products := coalesce(v_payload -> 'products', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.products where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_sales := coalesce(v_payload -> 'sales', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_sale_items := coalesce((
    select jsonb_agg(item order by sale_ordinal, item_ordinal)
    from jsonb_array_elements(coalesce(v_payload -> 'sales', '[]'::jsonb))
      with ordinality as sales(sale, sale_ordinal)
    cross join lateral jsonb_array_elements(coalesce(sale -> 'items', '[]'::jsonb))
      with ordinality as items(item, item_ordinal)
  ), '[]'::jsonb) = coalesce((
    select jsonb_agg(child.source_record order by parent.source_ordinal, child.source_ordinal)
    from public.sale_items child
    join public.sales parent on parent.id = child.sale_id and parent.tenant_id = child.tenant_id
    where child.tenant_id = p_tenant_id and child.legacy_id is not null and child.source_active
  ), '[]'::jsonb);
  v_expenses := coalesce(v_payload -> 'expenses', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.expenses where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_deliveries := coalesce(v_payload -> 'deliveries', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_purchases := coalesce(v_payload -> 'purchases', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_purchase_items := coalesce((
    select jsonb_agg(item order by purchase_ordinal, item_ordinal)
    from jsonb_array_elements(coalesce(v_payload -> 'purchases', '[]'::jsonb))
      with ordinality as purchases(purchase, purchase_ordinal)
    cross join lateral jsonb_array_elements(coalesce(purchase -> 'items', '[]'::jsonb))
      with ordinality as items(item, item_ordinal)
  ), '[]'::jsonb) = coalesce((
    select jsonb_agg(child.source_record order by parent.source_ordinal, child.source_ordinal)
    from public.purchase_items child
    join public.purchases parent on parent.id = child.purchase_id and parent.tenant_id = child.tenant_id
    where child.tenant_id = p_tenant_id and child.legacy_id is not null and child.source_active
  ), '[]'::jsonb);

  return jsonb_build_object(
    'allMatch', v_products and v_sales and v_sale_items and v_expenses
      and v_deliveries and v_purchases and v_purchase_items,
    'products', v_products,
    'sales', v_sales,
    'saleItems', v_sale_items,
    'expenses', v_expenses,
    'deliveries', v_deliveries,
    'purchases', v_purchases,
    'purchaseItems', v_purchase_items
  );
end;
$function$
;

notify pgrst,'reload schema';

