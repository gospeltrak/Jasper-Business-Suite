-- Branch management foundation.
-- One tenant can operate many branches while data remains scoped by tenant_id
-- first, then branch_id. This migration is additive and does not insert demo
-- rows or remove existing tenant data.

begin;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_name text not null,
  branch_code text not null,
  phone text,
  email text,
  address text,
  city text,
  manager_id uuid references public.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_default boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_code)
);

create unique index if not exists branches_one_default_per_tenant_idx
  on public.branches (tenant_id)
  where is_default;
create index if not exists branches_tenant_status_idx
  on public.branches (tenant_id, status, branch_name);

create table if not exists public.branch_stock (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id text not null,
  quantity numeric(14, 4) not null default 0,
  shop_stock_qty numeric(14, 4) not null default 0,
  store_stock_qty numeric(14, 4) not null default 0,
  buying_price numeric(14, 2),
  selling_price numeric(14, 2),
  low_stock_alert numeric(14, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, product_id)
);

create index if not exists branch_stock_tenant_branch_idx
  on public.branch_stock (tenant_id, branch_id);
create index if not exists branch_stock_product_idx
  on public.branch_stock (tenant_id, product_id);

create table if not exists public.branch_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_id uuid not null references public.users(id) on delete cascade,
  role text,
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, staff_id)
);

create index if not exists branch_staff_tenant_staff_idx
  on public.branch_staff_assignments (tenant_id, staff_id, status);

create table if not exists public.branch_inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_branch_id uuid not null references public.branches(id) on delete restrict,
  to_branch_id uuid not null references public.branches(id) on delete restrict,
  product_id text not null,
  quantity numeric(14, 4) not null check (quantity > 0),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'in_transit', 'received', 'cancelled')),
  created_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  received_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists public.branch_money_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_branch_id uuid not null references public.branches(id) on delete restrict,
  to_branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method text,
  reason text,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'in_transit', 'received', 'cancelled')),
  created_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  received_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  received_at timestamptz
);

-- Relational tables remain backward compatible: old rows with no branch_id are
-- interpreted by the app and reports as Main Branch.
alter table if exists public.sales add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.sale_items add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.expenses add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.purchases add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.purchase_items add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.sales_documents add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.delivery_notes add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.payments add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table if exists public.stock_adjustments add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.branches enable row level security;
alter table public.branches force row level security;
alter table public.branch_stock enable row level security;
alter table public.branch_stock force row level security;
alter table public.branch_staff_assignments enable row level security;
alter table public.branch_staff_assignments force row level security;
alter table public.branch_inventory_transfers enable row level security;
alter table public.branch_inventory_transfers force row level security;
alter table public.branch_money_transfers enable row level security;
alter table public.branch_money_transfers force row level security;

drop policy if exists branches_tenant_access on public.branches;
create policy branches_tenant_access on public.branches
  for all to authenticated
  using (tenant_id = private.current_tenant_id() or private.is_platform_admin())
  with check (tenant_id = private.current_tenant_id() or private.is_platform_admin());

drop policy if exists branch_stock_tenant_access on public.branch_stock;
create policy branch_stock_tenant_access on public.branch_stock
  for all to authenticated
  using (tenant_id = private.current_tenant_id() or private.is_platform_admin())
  with check (tenant_id = private.current_tenant_id() or private.is_platform_admin());

drop policy if exists branch_staff_tenant_access on public.branch_staff_assignments;
create policy branch_staff_tenant_access on public.branch_staff_assignments
  for all to authenticated
  using (tenant_id = private.current_tenant_id() or private.is_platform_admin())
  with check (tenant_id = private.current_tenant_id() or private.is_platform_admin());

drop policy if exists branch_inventory_transfers_tenant_access on public.branch_inventory_transfers;
create policy branch_inventory_transfers_tenant_access on public.branch_inventory_transfers
  for all to authenticated
  using (tenant_id = private.current_tenant_id() or private.is_platform_admin())
  with check (tenant_id = private.current_tenant_id() or private.is_platform_admin());

drop policy if exists branch_money_transfers_tenant_access on public.branch_money_transfers;
create policy branch_money_transfers_tenant_access on public.branch_money_transfers
  for all to authenticated
  using (tenant_id = private.current_tenant_id() or private.is_platform_admin())
  with check (tenant_id = private.current_tenant_id() or private.is_platform_admin());

commit;
