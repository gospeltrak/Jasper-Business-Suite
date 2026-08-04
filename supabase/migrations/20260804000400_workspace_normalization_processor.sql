-- Idempotent workspace-to-normalized processor. Legacy JSON remains the source
-- of truth and no target rows are deleted.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function private.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function private.safe_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  return p_value::timestamptz;
exception
  when invalid_datetime_format or datetime_field_overflow then
    return null;
end;
$$;

create or replace function private.safe_boolean(p_value text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  return p_value::boolean;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function private.safe_integer(p_value text)
returns integer
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  return p_value::integer;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return null;
end;
$$;

alter table public.products add column if not exists source_record jsonb;
alter table public.sales add column if not exists source_record jsonb;
alter table public.sale_items add column if not exists source_record jsonb;
alter table public.expenses add column if not exists source_record jsonb;
alter table public.deliveries add column if not exists source_record jsonb;
alter table public.purchases add column if not exists source_record jsonb;
alter table public.purchase_items add column if not exists source_record jsonb;

alter table public.workspace_normalization_outbox
  drop constraint if exists workspace_normalization_outbox_status_check;
alter table public.workspace_normalization_outbox
  add constraint workspace_normalization_outbox_status_check
  check (status in ('pending', 'running', 'completed', 'failed'));

alter table public.workspace_migration_batches
  drop constraint if exists workspace_migration_batches_status_check;
alter table public.workspace_migration_batches
  add constraint workspace_migration_batches_status_check
  check (status in ('pending', 'running', 'processed', 'verified', 'failed', 'rolled_back'));

create or replace function public.normalize_workspace_snapshot(
  p_tenant_id uuid,
  p_expected_updated_at timestamptz default null
)
returns public.workspace_migration_batches
language plpgsql
security definer
set search_path = ''
as $$
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
    set name = excluded.name,
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
    set reference = excluded.reference,
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
      set sale_id = excluded.sale_id,
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
    set category = excluded.category, amount = excluded.amount,
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
    set sale_id = excluded.sale_id, customer_name = excluded.customer_name,
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
    set supplier_id = excluded.supplier_id, supplier_name = excluded.supplier_name,
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
      set purchase_id = excluded.purchase_id, product_id = excluded.product_id,
          product_name = excluded.product_name, qty = excluded.qty,
          cost_price = excluded.cost_price, branch_id = excluded.branch_id,
          source_updated_at = excluded.source_updated_at,
          migration_batch_id = excluded.migration_batch_id,
          source_record = excluded.source_record;
    end loop;
  end loop;

  -- Refuse to certify a moving source.
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
    select 'products' table_name from public.products where tenant_id = p_tenant_id and legacy_id is not null
    union all select 'sales' from public.sales where tenant_id = p_tenant_id and legacy_id is not null
    union all select 'sale_items' from public.sale_items where tenant_id = p_tenant_id and legacy_id is not null
    union all select 'expenses' from public.expenses where tenant_id = p_tenant_id and legacy_id is not null
    union all select 'deliveries' from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null
    union all select 'purchases' from public.purchases where tenant_id = p_tenant_id and legacy_id is not null
    union all select 'purchase_items' from public.purchase_items where tenant_id = p_tenant_id and legacy_id is not null
  ) tracked;

  select jsonb_build_object(
    'salesTotal', coalesce((select sum(total) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'salesTax', coalesce((select sum(tax) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'salesPaid', coalesce((select sum(amount_paid) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'salesDue', coalesce((select sum(amount_due) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'expenseAmount', coalesce((select sum(amount) from public.expenses where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'deliveryTotal', coalesce((select sum(total_amount) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'deliveryCost', coalesce((select sum(delivery_cost) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'purchaseTotal', coalesce((select sum(total_amount) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'purchasePaid', coalesce((select sum(amount_paid) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'purchaseDue', coalesce((select sum(amount_due) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null), 0)
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
$$;

revoke all on function public.normalize_workspace_snapshot(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.normalize_workspace_snapshot(uuid, timestamptz)
  to service_role;

-- Reconciliation compares only migration-tracked target rows. Pre-existing
-- unlinked rows remain preserved and visible for separate audit.
create or replace function public.reconcile_workspace_normalization(
  p_tenant_id uuid,
  p_batch_id uuid default null
)
returns public.workspace_reconciliation_runs
language plpgsql
security definer
set search_path = ''
as $$
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
    'products', (select count(*) from public.products where tenant_id = p_tenant_id and legacy_id is not null),
    'sales', (select count(*) from public.sales where tenant_id = p_tenant_id and legacy_id is not null),
    'saleItems', (select count(*) from public.sale_items where tenant_id = p_tenant_id and legacy_id is not null),
    'expenses', (select count(*) from public.expenses where tenant_id = p_tenant_id and legacy_id is not null),
    'deliveries', (select count(*) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null),
    'purchases', (select count(*) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null),
    'purchaseItems', (select count(*) from public.purchase_items where tenant_id = p_tenant_id and legacy_id is not null)
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
    'salesTotal', coalesce((select sum(total) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'salesTax', coalesce((select sum(tax) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'salesPaid', coalesce((select sum(amount_paid) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'salesDue', coalesce((select sum(amount_due) from public.sales where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'expenseAmount', coalesce((select sum(amount) from public.expenses where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'deliveryTotal', coalesce((select sum(total_amount) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'deliveryCost', coalesce((select sum(delivery_cost) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'purchaseTotal', coalesce((select sum(total_amount) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'purchasePaid', coalesce((select sum(amount_paid) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null), 0),
    'purchaseDue', coalesce((select sum(amount_due) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null), 0)
  ) into v_target_totals;

  v_mismatches := jsonb_strip_nulls(jsonb_build_object(
    'counts', case when v_source_counts is distinct from v_target_counts then jsonb_build_object('source', v_source_counts, 'target', v_target_counts) end,
    'totals', case when v_source_totals is distinct from v_target_totals then jsonb_build_object('source', v_source_totals, 'target', v_target_totals) end
  ));
  v_is_match := v_mismatches = '{}'::jsonb;
  insert into public.workspace_reconciliation_runs(batch_id, tenant_id, migration_version, source_updated_at, source_counts, target_counts, source_totals, target_totals, mismatch_details, is_match)
  values(p_batch_id, p_tenant_id, v_version, v_workspace.updated_at, v_source_counts, v_target_counts, v_source_totals, v_target_totals, v_mismatches, v_is_match)
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
$$;

revoke all on function public.reconcile_workspace_normalization(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reconcile_workspace_normalization(uuid, uuid)
  to service_role;

commit;
