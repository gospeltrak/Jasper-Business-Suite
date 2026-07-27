-- Tanzanite cross-branch quotations/proforma and atomic split-sale conversion.
-- Additive only: no existing tenant, document, product, stock, or sale row is
-- updated by this migration. Stock changes occur only through the explicit
-- conversion RPC after a tenant user confirms conversion.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.cross_branch_commercial_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  issuing_branch_id uuid not null,
  document_type text not null,
  document_number text not null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  issue_date date not null default current_date,
  currency text not null default 'TZS',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  delivery_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  notes text,
  branding_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  conversion_idempotency_key text,
  converted_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cross_branch_documents_branch_fkey
    foreign key (tenant_id, issuing_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint cross_branch_documents_type_check
    check (document_type in ('price_quote', 'proforma_invoice')),
  constraint cross_branch_documents_status_check
    check (status in ('pending', 'converted', 'cancelled')),
  constraint cross_branch_documents_amounts_check
    check (
      subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0
      and delivery_amount >= 0 and total_amount >= 0
      and discount_amount <= subtotal
    ),
  unique (tenant_id, document_number),
  unique (tenant_id, id)
);

create unique index if not exists cross_branch_documents_conversion_uidx
  on public.cross_branch_commercial_documents (tenant_id, conversion_idempotency_key)
  where conversion_idempotency_key is not null;

create index if not exists cross_branch_documents_branch_status_idx
  on public.cross_branch_commercial_documents
  (tenant_id, issuing_branch_id, status, created_at desc);

create table if not exists public.cross_branch_commercial_document_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null,
  line_number integer not null,
  source_branch_id uuid not null,
  product_id text not null,
  product_name_snapshot text not null,
  unit_snapshot text,
  quantity numeric(14,4) not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  internal_source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cross_branch_document_items_document_fkey
    foreign key (tenant_id, document_id)
    references public.cross_branch_commercial_documents(tenant_id, id)
    on delete restrict,
  constraint cross_branch_document_items_branch_fkey
    foreign key (tenant_id, source_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint cross_branch_document_items_values_check
    check (
      line_number > 0 and quantity > 0 and unit_price >= 0
      and line_total = round(quantity * unit_price, 2)
    ),
  unique (tenant_id, document_id, line_number),
  unique (tenant_id, id)
);

create index if not exists cross_branch_document_items_source_idx
  on public.cross_branch_commercial_document_items
  (tenant_id, source_branch_id, document_id);

create table if not exists public.cross_branch_sale_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null,
  consolidated_reference text not null,
  customer_name text not null,
  customer_phone text,
  currency text not null,
  total_amount numeric(14,2) not null,
  payment_status text not null default 'unpaid',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cross_branch_sale_groups_document_fkey
    foreign key (tenant_id, document_id)
    references public.cross_branch_commercial_documents(tenant_id, id)
    on delete restrict,
  constraint cross_branch_sale_groups_payment_check
    check (payment_status in ('unpaid', 'partial', 'paid')),
  unique (tenant_id, document_id),
  unique (tenant_id, consolidated_reference),
  unique (tenant_id, id)
);

create table if not exists public.cross_branch_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_group_id uuid not null,
  document_id uuid not null,
  branch_id uuid not null,
  branch_reference text not null,
  currency text not null,
  product_subtotal numeric(14,2) not null,
  allocated_discount numeric(14,2) not null default 0,
  allocated_tax numeric(14,2) not null default 0,
  allocated_delivery numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null,
  amount_paid numeric(14,2) not null default 0,
  amount_due numeric(14,2) not null,
  payment_status text not null default 'unpaid',
  sale_status text not null default 'open',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cross_branch_sales_group_fkey
    foreign key (tenant_id, sale_group_id)
    references public.cross_branch_sale_groups(tenant_id, id)
    on delete restrict,
  constraint cross_branch_sales_document_fkey
    foreign key (tenant_id, document_id)
    references public.cross_branch_commercial_documents(tenant_id, id)
    on delete restrict,
  constraint cross_branch_sales_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint cross_branch_sales_payment_check
    check (payment_status in ('unpaid', 'partial', 'paid')),
  constraint cross_branch_sales_status_check
    check (sale_status in ('open', 'completed', 'cancelled')),
  constraint cross_branch_sales_amounts_check
    check (
      product_subtotal >= 0 and allocated_discount >= 0
      and allocated_tax >= 0 and allocated_delivery >= 0
      and total_amount >= 0 and amount_paid >= 0 and amount_due >= 0
      and amount_paid + amount_due = total_amount
    ),
  unique (tenant_id, sale_group_id, branch_id),
  unique (tenant_id, branch_reference),
  unique (tenant_id, id)
);

create index if not exists cross_branch_sales_branch_queue_idx
  on public.cross_branch_sales
  (tenant_id, branch_id, payment_status, created_at desc);

create table if not exists public.cross_branch_sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_sale_id uuid not null,
  source_document_item_id uuid not null,
  branch_id uuid not null,
  product_id text not null,
  product_name_snapshot text not null,
  unit_snapshot text,
  quantity numeric(14,4) not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint cross_branch_sale_items_sale_fkey
    foreign key (tenant_id, branch_sale_id)
    references public.cross_branch_sales(tenant_id, id)
    on delete restrict,
  constraint cross_branch_sale_items_document_item_fkey
    foreign key (tenant_id, source_document_item_id)
    references public.cross_branch_commercial_document_items(tenant_id, id)
    on delete restrict,
  constraint cross_branch_sale_items_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint cross_branch_sale_items_values_check
    check (quantity > 0 and unit_price >= 0 and line_total >= 0),
  unique (tenant_id, branch_sale_id, source_document_item_id)
);

create table if not exists public.cross_branch_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  product_id text not null,
  branch_sale_id uuid not null,
  quantity_before numeric(14,4) not null,
  quantity_delta numeric(14,4) not null,
  quantity_after numeric(14,4) not null,
  movement_type text not null default 'cross_branch_document_sale',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cross_branch_stock_movements_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint cross_branch_stock_movements_sale_fkey
    foreign key (tenant_id, branch_sale_id)
    references public.cross_branch_sales(tenant_id, id)
    on delete restrict,
  constraint cross_branch_stock_movements_values_check
    check (
      quantity_delta < 0 and quantity_before >= 0 and quantity_after >= 0
      and quantity_after = quantity_before + quantity_delta
    )
);

create index if not exists cross_branch_stock_movements_lookup_idx
  on public.cross_branch_stock_movements
  (tenant_id, branch_id, product_id, created_at desc);

create or replace function public.list_cross_branch_document_sources()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := (select private.current_tenant_id());
begin
  if v_tenant_id is null or not coalesce(private.can_view_consolidated_branches(v_tenant_id), false) then
    raise exception 'Consolidated branch documents require active Tanzanite access.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', branch.id,
        'branchName', branch.branch_name,
        'branchCode', branch.branch_code,
        'businessName', branch.business_name,
        'isDefault', branch.is_default,
        'address', branch.address,
        'city', branch.city,
        'region', branch.region,
        'country', branch.country,
        'phone', branch.phone,
        'email', branch.email,
        'branding', coalesce((
          select jsonb_object_agg(
            setting.setting_scope || '.' || setting.setting_key,
            setting.setting_value
          )
          from public.branch_settings as setting
          where setting.tenant_id = branch.tenant_id
            and setting.branch_id = branch.id
            and setting.setting_scope in ('business', 'branding', 'documents', 'tax')
        ), '{}'::jsonb)
      ) order by branch.is_default desc, branch.branch_name)
      from public.branches as branch
      where branch.tenant_id = v_tenant_id
        and branch.status = 'active'
        and branch.archived_at is null
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'branchId', stock.branch_id,
        'productId', stock.product_id,
        'quantity', stock.quantity,
        'sellingPrice', coalesce(price.retail_price, stock.selling_price),
        'wholesalePrice', price.wholesale_price
      ) order by stock.branch_id, stock.product_id)
      from public.branch_stock as stock
      left join public.branch_product_prices as price
        on price.tenant_id = stock.tenant_id
       and price.branch_id = stock.branch_id
       and price.product_id = stock.product_id
       and price.effective_from <= now()
       and (price.effective_to is null or price.effective_to > now())
      where stock.tenant_id = v_tenant_id
        and stock.quantity > 0
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_cross_branch_commercial_document(
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_document_id uuid;
  v_issuing_branch_id uuid;
  v_document_type text;
  v_document_number text;
  v_item jsonb;
  v_line_number integer := 0;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2);
  v_tax numeric(14,2);
  v_delivery numeric(14,2);
  v_total numeric(14,2);
  v_branding jsonb;
begin
  if v_tenant_id is null or not coalesce(private.can_view_consolidated_branches(v_tenant_id), false) then
    raise exception 'Cross-branch documents require active Tanzanite access.'
      using errcode = '42501';
  end if;

  v_issuing_branch_id := nullif(p_document ->> 'issuingBranchId', '')::uuid;
  v_document_type := lower(coalesce(p_document ->> 'documentType', ''));
  v_document_number := btrim(coalesce(p_document ->> 'documentNumber', ''));
  v_discount := greatest(0, coalesce((p_document ->> 'discountAmount')::numeric, 0));
  v_tax := greatest(0, coalesce((p_document ->> 'taxAmount')::numeric, 0));
  v_delivery := greatest(0, coalesce((p_document ->> 'deliveryAmount')::numeric, 0));

  if v_document_type not in ('price_quote', 'proforma_invoice') then
    raise exception 'Invalid commercial document type.' using errcode = '22023';
  end if;
  if v_document_number = '' or jsonb_array_length(coalesce(p_document -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Document number and at least one item are required.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_document -> 'items') > 500 then
    raise exception 'A document may contain at most 500 items.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.branches
    where tenant_id = v_tenant_id and id = v_issuing_branch_id
      and status = 'active' and archived_at is null
  ) then
    raise exception 'Issuing branch is unavailable.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'branchId', branch.id,
    'branchName', branch.branch_name,
    'businessName', branch.business_name,
    'address', branch.address,
    'city', branch.city,
    'region', branch.region,
    'country', branch.country,
    'phone', branch.phone,
    'email', branch.email,
    'settings', coalesce(jsonb_object_agg(
      setting.setting_scope || '.' || setting.setting_key,
      setting.setting_value
    ) filter (where setting.id is not null), '{}'::jsonb)
  )
  into v_branding
  from public.branches as branch
  left join public.branch_settings as setting
    on setting.tenant_id = branch.tenant_id
   and setting.branch_id = branch.id
   and setting.setting_scope in ('business', 'branding', 'documents', 'tax')
  where branch.tenant_id = v_tenant_id and branch.id = v_issuing_branch_id
  group by branch.id, branch.branch_name, branch.business_name, branch.address,
    branch.city, branch.region, branch.country, branch.phone, branch.email;

  insert into public.cross_branch_commercial_documents (
    tenant_id, issuing_branch_id, document_type, document_number,
    customer_name, customer_phone, customer_address, issue_date, currency,
    discount_amount, tax_amount, delivery_amount, notes, branding_snapshot,
    created_by
  )
  values (
    v_tenant_id, v_issuing_branch_id, v_document_type, v_document_number,
    coalesce(nullif(btrim(p_document ->> 'customerName'), ''), 'General Customer'),
    nullif(btrim(p_document ->> 'customerPhone'), ''),
    nullif(btrim(p_document ->> 'customerAddress'), ''),
    coalesce(nullif(p_document ->> 'issueDate', '')::date, current_date),
    coalesce(nullif(btrim(p_document ->> 'currency'), ''), 'TZS'),
    v_discount, v_tax, v_delivery, nullif(btrim(p_document ->> 'notes'), ''),
    coalesce(v_branding, '{}'::jsonb), v_actor_id
  )
  returning id into v_document_id;

  for v_item in select value from jsonb_array_elements(p_document -> 'items')
  loop
    v_line_number := v_line_number + 1;
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0
      or coalesce((v_item ->> 'unitPrice')::numeric, -1) < 0 then
      raise exception 'Every item requires a positive quantity and non-negative price.'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.branch_stock as stock
      join public.branches as branch
        on branch.tenant_id = stock.tenant_id and branch.id = stock.branch_id
      where stock.tenant_id = v_tenant_id
        and stock.branch_id = nullif(v_item ->> 'sourceBranchId', '')::uuid
        and stock.product_id = btrim(v_item ->> 'productId')
        and branch.status = 'active' and branch.archived_at is null
    ) then
      raise exception 'A selected product is not available in its source branch.'
        using errcode = '22023';
    end if;

    insert into public.cross_branch_commercial_document_items (
      tenant_id, document_id, line_number, source_branch_id, product_id,
      product_name_snapshot, unit_snapshot, quantity, unit_price, line_total,
      internal_source_metadata
    )
    values (
      v_tenant_id, v_document_id, v_line_number,
      nullif(v_item ->> 'sourceBranchId', '')::uuid,
      btrim(v_item ->> 'productId'),
      coalesce(nullif(btrim(v_item ->> 'productName'), ''), 'Item'),
      nullif(btrim(v_item ->> 'unit'), ''),
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unitPrice')::numeric,
      round((v_item ->> 'quantity')::numeric * (v_item ->> 'unitPrice')::numeric, 2),
      jsonb_build_object('sourceBranchHiddenFromCustomer', true)
    );
    v_subtotal := v_subtotal
      + round((v_item ->> 'quantity')::numeric * (v_item ->> 'unitPrice')::numeric, 2);
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Document discount cannot exceed subtotal.' using errcode = '22023';
  end if;
  v_total := v_subtotal - v_discount + v_tax + v_delivery;

  update public.cross_branch_commercial_documents
  set subtotal = v_subtotal, total_amount = v_total, updated_at = now()
  where tenant_id = v_tenant_id and id = v_document_id;

  return jsonb_build_object(
    'documentId', v_document_id,
    'documentNumber', v_document_number,
    'subtotal', v_subtotal,
    'total', v_total,
    'itemCount', v_line_number,
    'brandingSnapshot', coalesce(v_branding, '{}'::jsonb)
  );
end;
$$;

create or replace function public.convert_cross_branch_document_to_sales(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_document public.cross_branch_commercial_documents%rowtype;
  v_group_id uuid;
  v_branch record;
  v_item record;
  v_branch_sale_id uuid;
  v_branch_count integer;
  v_branch_index integer := 0;
  v_remaining_discount numeric(14,2);
  v_remaining_tax numeric(14,2);
  v_remaining_delivery numeric(14,2);
  v_allocated_discount numeric(14,2);
  v_allocated_tax numeric(14,2);
  v_allocated_delivery numeric(14,2);
  v_branch_total numeric(14,2);
  v_stock public.branch_stock%rowtype;
  v_shortage_product_name text;
  v_shortage_branch_name text;
  v_available_quantity numeric(14,4);
  v_sales jsonb := '[]'::jsonb;
begin
  if v_tenant_id is null or not coalesce(private.can_view_consolidated_branches(v_tenant_id), false) then
    raise exception 'Cross-branch conversion requires active Tanzanite access.'
      using errcode = '42501';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'A conversion idempotency key is required.' using errcode = '22023';
  end if;

  select * into v_document
  from public.cross_branch_commercial_documents
  where tenant_id = v_tenant_id and id = p_document_id
  for update;
  if not found then raise exception 'Commercial document not found.' using errcode = 'P0002'; end if;

  if v_document.status = 'converted' then
    select id into v_group_id from public.cross_branch_sale_groups
    where tenant_id = v_tenant_id and document_id = p_document_id;
    return jsonb_build_object(
      'documentId', p_document_id, 'saleGroupId', v_group_id,
      'alreadyConverted', true
    );
  end if;
  if v_document.status <> 'pending' then
    raise exception 'Only a pending document can be converted.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext('cross_branch_document_sale'), hashtext(p_document_id::text));

  select count(distinct source_branch_id)::integer into v_branch_count
  from public.cross_branch_commercial_document_items
  where tenant_id = v_tenant_id and document_id = p_document_id;
  if v_branch_count = 0 then raise exception 'Document has no sale items.' using errcode = '23514'; end if;

  -- Lock every stock row in deterministic order, then validate the aggregated
  -- required quantity. Any failure rolls back every stock and sale mutation.
  for v_item in
    select source_branch_id, product_id, sum(quantity) as required_quantity
    from public.cross_branch_commercial_document_items
    where tenant_id = v_tenant_id and document_id = p_document_id
    group by source_branch_id, product_id
    order by source_branch_id, product_id
  loop
    v_stock := null;
    select * into v_stock from public.branch_stock
    where tenant_id = v_tenant_id
      and branch_id = v_item.source_branch_id
      and product_id = v_item.product_id
    for update;
    if not found or v_stock.quantity < v_item.required_quantity then
      v_available_quantity := coalesce(v_stock.quantity, 0);
      select
        coalesce(min(item.product_name_snapshot), v_item.product_id),
        coalesce(min(branch.branch_name), 'Selected branch')
      into v_shortage_product_name, v_shortage_branch_name
      from public.cross_branch_commercial_document_items as item
      left join public.branches as branch
        on branch.tenant_id = item.tenant_id
       and branch.id = item.source_branch_id
      where item.tenant_id = v_tenant_id
        and item.document_id = p_document_id
        and item.source_branch_id = v_item.source_branch_id
        and item.product_id = v_item.product_id;
      raise exception 'Cannot complete conversion: "%" is out of stock at "%". Required %, available %. No stock or sale was changed.',
        v_shortage_product_name,
        v_shortage_branch_name,
        v_item.required_quantity,
        v_available_quantity
        using
          errcode = '23514',
          detail = jsonb_build_object(
            'reasonCode', 'branch_product_out_of_stock',
            'productId', v_item.product_id,
            'productName', v_shortage_product_name,
            'branchId', v_item.source_branch_id,
            'branchName', v_shortage_branch_name,
            'requiredQuantity', v_item.required_quantity,
            'availableQuantity', v_available_quantity,
            'atomicRollback', true
          )::text;
    end if;
  end loop;

  insert into public.cross_branch_sale_groups (
    tenant_id, document_id, consolidated_reference, customer_name,
    customer_phone, currency, total_amount, created_by
  )
  values (
    v_tenant_id, p_document_id, v_document.document_number,
    v_document.customer_name, v_document.customer_phone,
    v_document.currency, v_document.total_amount, v_actor_id
  )
  returning id into v_group_id;

  v_remaining_discount := v_document.discount_amount;
  v_remaining_tax := v_document.tax_amount;
  v_remaining_delivery := v_document.delivery_amount;

  for v_branch in
    select item.source_branch_id as branch_id, sum(item.line_total)::numeric(14,2) as branch_subtotal
    from public.cross_branch_commercial_document_items as item
    where item.tenant_id = v_tenant_id and item.document_id = p_document_id
    group by item.source_branch_id
    order by item.source_branch_id
  loop
    v_branch_index := v_branch_index + 1;
    if v_branch_index = v_branch_count then
      v_allocated_discount := v_remaining_discount;
      v_allocated_tax := v_remaining_tax;
      v_allocated_delivery := v_remaining_delivery;
    else
      v_allocated_discount := round(v_document.discount_amount * v_branch.branch_subtotal / nullif(v_document.subtotal, 0), 2);
      v_allocated_tax := round(v_document.tax_amount * v_branch.branch_subtotal / nullif(v_document.subtotal, 0), 2);
      v_allocated_delivery := round(v_document.delivery_amount * v_branch.branch_subtotal / nullif(v_document.subtotal, 0), 2);
      v_remaining_discount := v_remaining_discount - v_allocated_discount;
      v_remaining_tax := v_remaining_tax - v_allocated_tax;
      v_remaining_delivery := v_remaining_delivery - v_allocated_delivery;
    end if;
    v_branch_total := v_branch.branch_subtotal - v_allocated_discount + v_allocated_tax + v_allocated_delivery;

    insert into public.cross_branch_sales (
      tenant_id, sale_group_id, document_id, branch_id, branch_reference,
      currency, product_subtotal, allocated_discount, allocated_tax,
      allocated_delivery, total_amount, amount_due, created_by
    )
    values (
      v_tenant_id, v_group_id, p_document_id, v_branch.branch_id,
      v_document.document_number || '-' || substr(v_branch.branch_id::text, 1, 8),
      v_document.currency, v_branch.branch_subtotal, v_allocated_discount,
      v_allocated_tax, v_allocated_delivery, v_branch_total, v_branch_total,
      v_actor_id
    )
    returning id into v_branch_sale_id;

    for v_item in
      select * from public.cross_branch_commercial_document_items
      where tenant_id = v_tenant_id and document_id = p_document_id
        and source_branch_id = v_branch.branch_id
      order by line_number
    loop
      select * into v_stock from public.branch_stock
      where tenant_id = v_tenant_id
        and branch_id = v_branch.branch_id
        and product_id = v_item.product_id
      for update;

      insert into public.cross_branch_sale_items (
        tenant_id, branch_sale_id, source_document_item_id, branch_id,
        product_id, product_name_snapshot, unit_snapshot, quantity,
        unit_price, line_total
      )
      values (
        v_tenant_id, v_branch_sale_id, v_item.id, v_branch.branch_id,
        v_item.product_id, v_item.product_name_snapshot, v_item.unit_snapshot,
        v_item.quantity, v_item.unit_price, v_item.line_total
      );

      update public.branch_stock
      set quantity = quantity - v_item.quantity,
          shop_stock_qty = greatest(shop_stock_qty - v_item.quantity, 0),
          store_stock_qty = greatest(
            store_stock_qty - greatest(v_item.quantity - shop_stock_qty, 0),
            0
          ),
          updated_at = now()
      where tenant_id = v_tenant_id
        and branch_id = v_branch.branch_id
        and product_id = v_item.product_id;

      insert into public.cross_branch_stock_movements (
        tenant_id, branch_id, product_id, branch_sale_id,
        quantity_before, quantity_delta, quantity_after, created_by
      )
      values (
        v_tenant_id, v_branch.branch_id, v_item.product_id, v_branch_sale_id,
        v_stock.quantity, -v_item.quantity, v_stock.quantity - v_item.quantity,
        v_actor_id
      );
    end loop;

    v_sales := v_sales || jsonb_build_array(jsonb_build_object(
      'saleId', v_branch_sale_id,
      'branchId', v_branch.branch_id,
      'reference', v_document.document_number || '-' || substr(v_branch.branch_id::text, 1, 8),
      'total', v_branch_total,
      'paymentStatus', 'unpaid'
    ));
  end loop;

  update public.cross_branch_commercial_documents
  set status = 'converted',
      conversion_idempotency_key = btrim(p_idempotency_key),
      converted_at = now(),
      updated_at = now()
  where tenant_id = v_tenant_id and id = p_document_id;

  perform private.append_branch_audit_event(
    v_tenant_id, v_document.issuing_branch_id, v_actor_id,
    'commercial_document.converted_to_branch_sales',
    'cross_branch_sale_group', v_group_id::text, 'database_rpc',
    null, 'commercial-document-conversion:' || p_document_id::text,
    null, jsonb_build_object(
      'documentId', p_document_id,
      'documentNumber', v_document.document_number,
      'branchSaleCount', v_branch_count,
      'total', v_document.total_amount
    ), jsonb_build_object('stockDeductedImmediately', true)
  );

  return jsonb_build_object(
    'documentId', p_document_id,
    'saleGroupId', v_group_id,
    'consolidatedReference', v_document.document_number,
    'total', v_document.total_amount,
    'alreadyConverted', false,
    'branchSales', v_sales
  );
end;
$$;

alter table public.cross_branch_commercial_documents enable row level security;
alter table public.cross_branch_commercial_documents force row level security;
alter table public.cross_branch_commercial_document_items enable row level security;
alter table public.cross_branch_commercial_document_items force row level security;
alter table public.cross_branch_sale_groups enable row level security;
alter table public.cross_branch_sale_groups force row level security;
alter table public.cross_branch_sales enable row level security;
alter table public.cross_branch_sales force row level security;
alter table public.cross_branch_sale_items enable row level security;
alter table public.cross_branch_sale_items force row level security;
alter table public.cross_branch_stock_movements enable row level security;
alter table public.cross_branch_stock_movements force row level security;

create policy cross_branch_documents_tenant_read
  on public.cross_branch_commercial_documents for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and private.can_view_consolidated_branches(tenant_id)
  );
create policy cross_branch_document_items_tenant_read
  on public.cross_branch_commercial_document_items for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and private.can_view_consolidated_branches(tenant_id)
  );
create policy cross_branch_sale_groups_tenant_read
  on public.cross_branch_sale_groups for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and private.can_view_consolidated_branches(tenant_id)
  );
create policy cross_branch_sales_branch_read
  on public.cross_branch_sales for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and private.is_branch_assigned(tenant_id, branch_id)
  );
create policy cross_branch_sale_items_branch_read
  on public.cross_branch_sale_items for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and private.is_branch_assigned(tenant_id, branch_id)
  );
create policy cross_branch_stock_movements_branch_read
  on public.cross_branch_stock_movements for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and private.is_branch_assigned(tenant_id, branch_id)
  );

revoke all on table public.cross_branch_commercial_documents from anon, authenticated;
revoke all on table public.cross_branch_commercial_document_items from anon, authenticated;
revoke all on table public.cross_branch_sale_groups from anon, authenticated;
revoke all on table public.cross_branch_sales from anon, authenticated;
revoke all on table public.cross_branch_sale_items from anon, authenticated;
revoke all on table public.cross_branch_stock_movements from anon, authenticated;

grant select on table public.cross_branch_commercial_documents to authenticated;
grant select on table public.cross_branch_commercial_document_items to authenticated;
grant select on table public.cross_branch_sale_groups to authenticated;
grant select on table public.cross_branch_sales to authenticated;
grant select on table public.cross_branch_sale_items to authenticated;
grant select on table public.cross_branch_stock_movements to authenticated;

revoke all on function public.list_cross_branch_document_sources() from public;
revoke all on function public.create_cross_branch_commercial_document(jsonb) from public;
revoke all on function public.convert_cross_branch_document_to_sales(uuid, text) from public;
grant execute on function public.list_cross_branch_document_sources() to authenticated;
grant execute on function public.create_cross_branch_commercial_document(jsonb) to authenticated;
grant execute on function public.convert_cross_branch_document_to_sales(uuid, text) to authenticated;

commit;
