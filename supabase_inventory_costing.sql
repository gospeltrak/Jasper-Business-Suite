-- Jasper Business Suite: global inventory costing, batch costing, fractional sales, and pharmacy breakdowns.
-- Run this in Supabase SQL editor for each deployed project.

create table if not exists public.jasper_product_inventory_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  product_id text not null,
  costing_method text not null default 'fifo' check (costing_method in ('fifo', 'average_price', 'batch_price')),
  allow_pos_method_override boolean not null default false,
  allow_scale_selling boolean not null default false,
  purchase_unit text not null default 'Unit',
  base_unit text not null default 'Unit',
  conversion_to_base_unit numeric(18, 6) not null default 1 check (conversion_to_base_unit > 0),
  allow_custom_quantity boolean not null default true,
  default_price_per_base_unit numeric(18, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id)
);

create table if not exists public.jasper_inventory_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  product_id text not null,
  supplier_id text,
  supplier_name text,
  batch_number text not null,
  purchase_id text,
  purchase_date timestamptz not null default now(),
  quantity_purchased numeric(18, 6) not null check (quantity_purchased > 0),
  quantity_remaining numeric(18, 6) not null check (quantity_remaining >= 0),
  base_unit text not null default 'Unit',
  buying_price numeric(18, 2) not null check (buying_price >= 0),
  previous_buying_price numeric(18, 2),
  price_change_percentage numeric(12, 4),
  suggested_selling_price numeric(18, 2),
  final_selling_price numeric(18, 2),
  costing_method_at_creation text not null default 'fifo' check (costing_method_at_creation in ('fifo', 'average_price', 'batch_price')),
  status text not null default 'active' check (status in ('active', 'finished')),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_jasper_inventory_batches_product_status
  on public.jasper_inventory_batches (tenant_id, product_id, status, purchase_date);

create table if not exists public.jasper_fraction_sale_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  product_id text not null,
  label text not null,
  quantity_in_base_unit numeric(18, 6) not null check (quantity_in_base_unit > 0),
  price numeric(18, 2),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.jasper_sale_batch_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  sale_id text not null,
  product_id text not null,
  batch_id uuid references public.jasper_inventory_batches(id),
  quantity_sold numeric(18, 6) not null check (quantity_sold > 0),
  unit_sold text,
  base_quantity_deducted numeric(18, 6) not null check (base_quantity_deducted > 0),
  buying_cost numeric(18, 2) not null default 0,
  selling_price numeric(18, 2) not null default 0,
  costing_method_used text not null check (costing_method_used in ('fifo', 'average_price', 'batch_price')),
  profit numeric(18, 2) not null default 0,
  remaining_stock numeric(18, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_jasper_sale_batch_items_sale
  on public.jasper_sale_batch_items (tenant_id, sale_id, product_id);

create table if not exists public.jasper_pharmacy_unit_breakdowns (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  product_id text not null,
  purchase_unit text not null default 'Box',
  strip_unit text not null default 'Strip',
  base_unit text not null default 'Tablet',
  strips_per_box numeric(18, 6) not null default 1 check (strips_per_box > 0),
  tablets_per_strip numeric(18, 6) not null default 1 check (tablets_per_strip > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id)
);
