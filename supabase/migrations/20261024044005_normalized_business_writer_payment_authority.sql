create or replace function private.persist_normalized_business_snapshot(p_tenant_id uuid,p_snapshot jsonb)
returns void language plpgsql security definer set search_path='' as $writer$
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
  v_ordinal bigint;
  v_batch_id uuid;
  v_metadata jsonb;
  v_current jsonb;
  v_merged jsonb;
  v_existing_record jsonb;
  v_stock_updates jsonb;
  v_context jsonb;
  v_active_branch uuid;
  v_key text;
  v_tombstone_key text;


begin
  if not private.normalized_writes_enabled(p_tenant_id) then raise exception 'Normalized writes are not enabled'; end if;
  -- Serialize tenant operations in the established lock order without storing its business arrays.
  perform 1 from public.tenant_workspaces where tenant_id=p_tenant_id for update;
  v_workspace.payload:=p_snapshot;
  v_workspace.updated_at:=statement_timestamp();
  v_current:=private.normalized_business_snapshot(p_tenant_id);
  if current_setting('app.jasper_explicit_settings_tenant',true) is distinct from p_tenant_id::text and v_workspace.payload ? 'settings' then
    v_workspace.payload:=jsonb_set(v_workspace.payload,'{settings}',coalesce(v_current->'settings','{}'::jsonb),true);
  end if;
  -- Background snapshots merge by identity/version; absence alone never deletes a normalized record.
  for v_key in select unnest(array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes']) loop
    if not v_workspace.payload ? v_key then continue;end if;
    v_merged:=private.merge_workspace_products_by_id(v_current->v_key,v_workspace.payload->v_key);
    v_workspace.payload:=jsonb_set(v_workspace.payload,array[v_key],v_merged,true);
  end loop;
  -- Treasury reversals and deletion commit in the same transaction. The existing client retry uses this key too.
  for v_key,v_tombstone_key in select * from (values
    ('sales','saleTombstones'),('expenses','expenseTombstones'),('deliveries','deliveryTombstones'),('purchases','purchaseTombstones')
  ) as ledgers(payload_key,tombstone_key) loop
    for v_existing_record in select item from jsonb_array_elements(coalesce(v_current->v_key,'[]'::jsonb)) as item
      where coalesce(v_workspace.payload->v_tombstone_key,'{}'::jsonb) ? (item->>'id') loop
      if v_key='purchases' and jsonb_array_length(coalesce(v_existing_record->'payments','[]'::jsonb))>0 then
        raise exception using errcode='23514',message='Purchases with installments must remain in the payment audit history.';
      end if;
      if nullif(v_existing_record->>'treasuryJournalId','') is not null then
        perform public.reverse_current_tenant_treasury_journal((v_existing_record->>'treasuryJournalId')::uuid,
          'reversal:'||(v_existing_record->>'id')||':v1','Voided '||v_key||' record '||(v_existing_record->>'id'));
      end if;
    end loop;
  end loop;

  for v_key,v_tombstone_key in select * from (values
    ('products','productTombstones'),('sales','saleTombstones'),('expenses','expenseTombstones'),
    ('deliveries','deliveryTombstones'),('purchases','purchaseTombstones')
  ) as ledgers(payload_key,tombstone_key) loop
    if v_workspace.payload ? v_key then
      v_workspace.payload:=jsonb_set(v_workspace.payload,array[v_key],(
        select coalesce(jsonb_agg(item order by ordinal),'[]'::jsonb)
        from jsonb_array_elements(v_workspace.payload->v_key) with ordinality as records(item,ordinal)
        where not coalesce(v_workspace.payload->v_tombstone_key,'{}'::jsonb) ? (item->>'id')
      ),true);
    end if;
  end loop;
  if not exists(select 1 from jsonb_each(v_workspace.payload) as incoming(key,value)
    where incoming.value is distinct from v_current->incoming.key) then return;end if;

  -- Products: attach an existing row only when the business-key candidate is
  -- unique. Ambiguous rows get a new internal UUID and retain their legacy ID.
  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'products', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    if exists(select 1 from public.products where tenant_id=p_tenant_id and legacy_id=v_legacy_id and source_active and source_record=v_item) then continue;end if;
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
        source_record = excluded.source_record,
        updated_at = excluded.updated_at;
  end loop;

  -- Sales and immutable sale-item snapshots.
  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    if exists(select 1 from public.sales where tenant_id=p_tenant_id and legacy_id=v_legacy_id and source_active and source_record=v_item) then continue;end if;
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
          source_record = excluded.source_record;
    end loop;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    if exists(select 1 from public.expenses where tenant_id=p_tenant_id and legacy_id=v_legacy_id and source_active and source_record=v_item) then continue;end if;
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
        source_record = excluded.source_record;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    if exists(select 1 from public.deliveries where tenant_id=p_tenant_id and legacy_id=v_legacy_id and source_active and source_record=v_item) then continue;end if;
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
        source_record = excluded.source_record;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb))
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    if exists(select 1 from public.purchases where tenant_id=p_tenant_id and legacy_id=v_legacy_id and source_active and source_record=v_item) then continue;end if;
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
          source_record = excluded.source_record;
    end loop;
  end loop;

  -- Refuse to certify a moving source.

  for v_item, v_ordinal in
    select item, ordinal::bigint
    from jsonb_array_elements(coalesce(v_workspace.payload -> 'branchStocks', '[]'::jsonb))
      with ordinality as source(item, ordinal)
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    if exists(select 1 from public.branch_stock where tenant_id=p_tenant_id and legacy_id=v_legacy_id and source_active and source_record=v_item) then continue;end if;
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
        updated_at = excluded.updated_at;
  end loop;


  for v_item,v_ordinal in select item,ordinal from jsonb_array_elements(coalesce(v_workspace.payload->'pendingDeliveryNotes','[]'::jsonb)) with ordinality as records(item,ordinal) loop
    v_legacy_id:=coalesce(nullif(btrim(v_item->>'id'),''),'hash:'||md5(v_item::text));
    insert into public.pending_delivery_notes(tenant_id,branch_id,legacy_id,status,reference,source_record,source_ordinal,source_updated_at)
    values(p_tenant_id,private.safe_uuid(v_item->>'branchId'),v_legacy_id,v_item->>'status',v_item->>'reference',v_item,v_ordinal,statement_timestamp())
    on conflict(tenant_id,legacy_id) do update set branch_id=excluded.branch_id,status=excluded.status,reference=excluded.reference,
      source_record=excluded.source_record,source_ordinal=excluded.source_ordinal,source_updated_at=excluded.source_updated_at,source_active=true,updated_at=statement_timestamp();
  end loop;
  perform private.refresh_direct_source_activity(p_tenant_id,v_workspace.payload);
  perform private.refresh_direct_source_ordinals(p_tenant_id,v_workspace.payload);
  select payload-array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes'] into v_metadata from public.tenant_workspaces where tenant_id=p_tenant_id;
  v_metadata:=coalesce(v_metadata,'{}'::jsonb)||(v_workspace.payload-array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes'])||jsonb_build_object('businessStorage','normalized');
  update public.tenant_workspaces set payload=v_metadata,updated_at=statement_timestamp(),updated_by=(select auth.uid()) where tenant_id=p_tenant_id;
end;
$writer$;
revoke all on function private.persist_normalized_business_snapshot(uuid,jsonb) from public,anon,authenticated;

