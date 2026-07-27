-- Multi-branch Phase 3B: branch settings, catalogue/pricing links, warehouses,
-- supplier/customer links, and payment-channel configuration.
--
-- This migration is additive and dark by default:
--   * It does not seed, copy, move, or rewrite tenant business data.
--   * It does not convert registeredStores, Store, Product Location, or the
--     existing workspace inventory into Branches or Warehouses.
--   * It does not grant browser roles direct access to the new control tables.
--   * Existing products and suppliers are not backfilled into branch links.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Composite tenant/entity keys let new branch tables enforce tenant identity
-- in foreign keys rather than trusting IDs supplied by a client.
create unique index if not exists products_tenant_id_id_uidx
  on public.products (tenant_id, id);

create unique index if not exists suppliers_tenant_id_id_uidx
  on public.suppliers (tenant_id, id);

create table if not exists public.branch_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  setting_scope text not null,
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  inheritance_mode text not null default 'tenant_inherited',
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_settings_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_settings_scope_check
    check (
      setting_scope in (
        'business',
        'pos',
        'documents',
        'tax',
        'notifications',
        'branding',
        'inventory',
        'accounting'
      )
    ),
  constraint branch_settings_inheritance_check
    check (inheritance_mode in ('tenant_inherited', 'branch_override')),
  unique (tenant_id, branch_id, setting_scope, setting_key)
);

create index if not exists branch_settings_lookup_idx
  on public.branch_settings (tenant_id, branch_id, setting_scope, setting_key);

-- product_id remains text to match the existing branch_stock/workspace bridge.
-- relational_product_id is populated when a matching public.products row is
-- authoritative and enforces that the product belongs to the same tenant.
create table if not exists public.branch_product_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  product_id text not null,
  relational_product_id uuid,
  source_branch_id uuid,
  catalogue_mode text not null default 'independent',
  price_mode text not null default 'independent',
  is_active boolean not null default true,
  copied_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_product_links_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_product_links_source_branch_fkey
    foreign key (tenant_id, source_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_product_links_relational_product_fkey
    foreign key (tenant_id, relational_product_id)
    references public.products(tenant_id, id)
    on delete restrict,
  constraint branch_product_links_catalogue_mode_check
    check (catalogue_mode in ('independent', 'copied', 'shared')),
  constraint branch_product_links_price_mode_check
    check (price_mode in ('independent', 'copy_once', 'shared')),
  constraint branch_product_links_price_source_compatibility_check
    check (
      price_mode = 'independent'
      or catalogue_mode in ('copied', 'shared')
    ),
  constraint branch_product_links_source_check
    check (
      (
        catalogue_mode = 'independent'
        and source_branch_id is null
      )
      or (
        catalogue_mode in ('copied', 'shared')
        and source_branch_id is not null
        and source_branch_id <> branch_id
      )
    ),
  unique (tenant_id, branch_id, product_id)
);

create index if not exists branch_product_links_branch_active_idx
  on public.branch_product_links (tenant_id, branch_id, is_active, product_id);

create index if not exists branch_product_links_source_idx
  on public.branch_product_links (tenant_id, source_branch_id, catalogue_mode)
  where source_branch_id is not null;

create index if not exists branch_product_links_relational_product_idx
  on public.branch_product_links (tenant_id, relational_product_id)
  where relational_product_id is not null;

create table if not exists public.branch_product_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  product_id text not null,
  pricing_mode text not null default 'independent',
  source_branch_id uuid,
  retail_price numeric(14, 2),
  wholesale_price numeric(14, 2),
  minimum_wholesale_quantity numeric(14, 4),
  currency text not null default 'TZS',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_product_prices_product_link_fkey
    foreign key (tenant_id, branch_id, product_id)
    references public.branch_product_links(tenant_id, branch_id, product_id)
    on delete restrict,
  constraint branch_product_prices_source_branch_fkey
    foreign key (tenant_id, source_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_product_prices_mode_check
    check (pricing_mode in ('independent', 'copy_once', 'shared')),
  constraint branch_product_prices_source_check
    check (
      (
        pricing_mode in ('independent', 'copy_once')
        and source_branch_id is null
      )
      or (
        pricing_mode = 'shared'
        and source_branch_id is not null
        and source_branch_id <> branch_id
      )
    ),
  constraint branch_product_prices_values_check
    check (
      (retail_price is null or retail_price >= 0)
      and (wholesale_price is null or wholesale_price >= 0)
      and (
        minimum_wholesale_quantity is null
        or minimum_wholesale_quantity > 0
      )
      and (effective_to is null or effective_to > effective_from)
    ),
  unique (tenant_id, branch_id, product_id)
);

create index if not exists branch_product_prices_effective_idx
  on public.branch_product_prices (
    tenant_id,
    branch_id,
    effective_from desc,
    product_id
  );

create index if not exists branch_product_prices_source_idx
  on public.branch_product_prices (tenant_id, source_branch_id, product_id)
  where source_branch_id is not null;

-- No current relational warehouse equivalent exists. This table is separate
-- from registeredStores and is left empty by this migration.
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  warehouse_name text not null,
  warehouse_code text not null,
  address text,
  region text,
  district text,
  country text,
  status text not null default 'active',
  is_locked boolean not null default false,
  lock_reason text,
  archived_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_status_check
    check (status in ('active', 'inactive')),
  constraint warehouses_lock_reason_check
    check (
      (not is_locked)
      or nullif(btrim(lock_reason), '') is not null
    ),
  unique (tenant_id, warehouse_code)
);

create unique index if not exists warehouses_tenant_id_id_uidx
  on public.warehouses (tenant_id, id);

create index if not exists warehouses_tenant_status_idx
  on public.warehouses (tenant_id, status, warehouse_name)
  where archived_at is null;

create table if not exists public.branch_warehouse_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  warehouse_id uuid not null,
  sharing_mode text not null default 'separate',
  is_primary boolean not null default false,
  can_sell boolean not null default true,
  can_receive boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_warehouse_links_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_warehouse_links_warehouse_fkey
    foreign key (tenant_id, warehouse_id)
    references public.warehouses(tenant_id, id)
    on delete restrict,
  constraint branch_warehouse_links_mode_check
    check (sharing_mode in ('separate', 'shared')),
  unique (tenant_id, branch_id, warehouse_id)
);

create unique index if not exists branch_warehouse_one_primary_idx
  on public.branch_warehouse_links (tenant_id, branch_id)
  where is_primary;

create index if not exists branch_warehouse_links_warehouse_idx
  on public.branch_warehouse_links (tenant_id, warehouse_id, sharing_mode);

-- Shared Warehouse inventory has one warehouse-level balance, never one copy
-- per linked branch. Branch attribution belongs in the movement ledger added in
-- the stock-transfer phase.
create table if not exists public.warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  warehouse_id uuid not null,
  product_id text not null,
  quantity numeric(14, 4) not null default 0,
  reserved_quantity numeric(14, 4) not null default 0,
  average_cost numeric(14, 2),
  low_stock_alert numeric(14, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_stock_warehouse_fkey
    foreign key (tenant_id, warehouse_id)
    references public.warehouses(tenant_id, id)
    on delete restrict,
  constraint warehouse_stock_quantities_check
    check (
      quantity >= 0
      and reserved_quantity >= 0
      and reserved_quantity <= quantity
      and (average_cost is null or average_cost >= 0)
      and (low_stock_alert is null or low_stock_alert >= 0)
    ),
  unique (tenant_id, warehouse_id, product_id)
);

create index if not exists warehouse_stock_product_idx
  on public.warehouse_stock (tenant_id, product_id, warehouse_id);

create table if not exists public.branch_supplier_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  supplier_id uuid not null,
  source_branch_id uuid,
  sharing_mode text not null default 'independent',
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_supplier_links_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_supplier_links_supplier_fkey
    foreign key (tenant_id, supplier_id)
    references public.suppliers(tenant_id, id)
    on delete restrict,
  constraint branch_supplier_links_source_branch_fkey
    foreign key (tenant_id, source_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_supplier_links_mode_check
    check (sharing_mode in ('independent', 'copied', 'shared')),
  constraint branch_supplier_links_source_check
    check (
      (sharing_mode = 'independent' and source_branch_id is null)
      or (
        sharing_mode in ('copied', 'shared')
        and source_branch_id is not null
        and source_branch_id <> branch_id
      )
    ),
  unique (tenant_id, branch_id, supplier_id)
);

create index if not exists branch_supplier_links_source_idx
  on public.branch_supplier_links (tenant_id, source_branch_id, sharing_mode)
  where source_branch_id is not null;

-- Current customer identity is embedded in existing sales/workspace records.
-- customer_ref preserves that real identifier without creating fake customers.
create table if not exists public.branch_customer_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  customer_ref text not null,
  source_branch_id uuid,
  sharing_mode text not null default 'independent',
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_customer_links_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_customer_links_source_branch_fkey
    foreign key (tenant_id, source_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_customer_links_mode_check
    check (sharing_mode in ('independent', 'copied', 'shared')),
  constraint branch_customer_links_source_check
    check (
      (sharing_mode = 'independent' and source_branch_id is null)
      or (
        sharing_mode in ('copied', 'shared')
        and source_branch_id is not null
        and source_branch_id <> branch_id
      )
    ),
  unique (tenant_id, branch_id, customer_ref)
);

create index if not exists branch_customer_links_source_idx
  on public.branch_customer_links (tenant_id, source_branch_id, sharing_mode)
  where source_branch_id is not null;

create table if not exists public.branch_payment_channel_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  channel_key text not null,
  display_name text,
  source_branch_id uuid,
  sharing_mode text not null default 'independent',
  is_enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_payment_channels_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_payment_channels_source_branch_fkey
    foreign key (tenant_id, source_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_payment_channels_mode_check
    check (sharing_mode in ('independent', 'copied', 'shared')),
  constraint branch_payment_channels_source_check
    check (
      (sharing_mode = 'independent' and source_branch_id is null)
      or (
        sharing_mode in ('copied', 'shared')
        and source_branch_id is not null
        and source_branch_id <> branch_id
      )
    ),
  unique (tenant_id, branch_id, channel_key)
);

comment on column public.branch_payment_channel_configs.configuration is
  'Non-secret branch payment-channel settings only; credentials remain server-side.';

create index if not exists branch_payment_channels_source_idx
  on public.branch_payment_channel_configs (
    tenant_id,
    source_branch_id,
    sharing_mode
  )
  where source_branch_id is not null;

-- Reusable timestamp trigger for new control-plane tables only.
create or replace function private.set_multibranch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Database-level guardrail: copied/shared data is allowed only between active,
-- unlocked Same Business branches belonging to the same tenant.
create or replace function private.assert_branch_sharing_allowed(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_source_branch_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.branches%rowtype;
  v_source public.branches%rowtype;
begin
  select *
  into v_target
  from public.branches
  where tenant_id = p_tenant_id
    and id = p_branch_id
    and archived_at is null;

  select *
  into v_source
  from public.branches
  where tenant_id = p_tenant_id
    and id = p_source_branch_id
    and archived_at is null;

  if v_target.id is null or v_source.id is null then
    raise exception 'Both branches must belong to the tenant and be available.'
      using errcode = '23514';
  end if;

  if v_target.is_locked or v_source.is_locked then
    raise exception 'Locked branches cannot start or change sharing.'
      using errcode = '23514';
  end if;

  if v_target.status <> 'active' or v_source.status <> 'active' then
    raise exception 'Inactive branches cannot start or change sharing.'
      using errcode = '23514';
  end if;

  if v_target.relationship_type <> 'same_business'
    or v_source.relationship_type <> 'same_business'
  then
    raise exception 'Sharing is available only between Same Business branches.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.validate_branch_source_sharing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_branch_id is not null then
    perform private.assert_branch_sharing_allowed(
      new.tenant_id,
      new.branch_id,
      new.source_branch_id
    );
  end if;

  return new;
end;
$$;

create or replace function private.validate_branch_warehouse_sharing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_relationship_type text;
  v_is_locked boolean;
  v_status text;
begin
  select relationship_type, is_locked, status
  into v_relationship_type, v_is_locked, v_status
  from public.branches
  where tenant_id = new.tenant_id
    and id = new.branch_id
    and archived_at is null;

  if not found or v_is_locked or v_status <> 'active' then
    raise exception 'Warehouse links require an active, unlocked branch.'
      using errcode = '23514';
  end if;

  if new.sharing_mode = 'separate' then
    if exists (
      select 1
      from public.branch_warehouse_links as existing_link
      where existing_link.tenant_id = new.tenant_id
        and existing_link.warehouse_id = new.warehouse_id
        and existing_link.id <> new.id
    ) then
      raise exception 'A Separate Warehouse may belong to only one branch.'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if v_relationship_type <> 'same_business' then
    raise exception 'Shared warehouses require a Same Business branch.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.branch_warehouse_links as existing_link
    join public.branches as existing_branch
      on existing_branch.tenant_id = existing_link.tenant_id
      and existing_branch.id = existing_link.branch_id
    where existing_link.tenant_id = new.tenant_id
      and existing_link.warehouse_id = new.warehouse_id
      and existing_link.id <> new.id
      and (
        existing_link.sharing_mode <> 'shared'
        or existing_branch.relationship_type <> 'same_business'
        or existing_branch.is_locked
        or existing_branch.status <> 'active'
        or existing_branch.archived_at is not null
      )
  ) then
    raise exception 'Warehouse sharing conflicts with an existing branch link.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists branch_settings_updated_at
  on public.branch_settings;
create trigger branch_settings_updated_at
before update on public.branch_settings
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_product_links_updated_at
  on public.branch_product_links;
create trigger branch_product_links_updated_at
before update on public.branch_product_links
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_product_prices_updated_at
  on public.branch_product_prices;
create trigger branch_product_prices_updated_at
before update on public.branch_product_prices
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists warehouses_updated_at
  on public.warehouses;
create trigger warehouses_updated_at
before update on public.warehouses
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_warehouse_links_updated_at
  on public.branch_warehouse_links;
create trigger branch_warehouse_links_updated_at
before update on public.branch_warehouse_links
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists warehouse_stock_updated_at
  on public.warehouse_stock;
create trigger warehouse_stock_updated_at
before update on public.warehouse_stock
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_supplier_links_updated_at
  on public.branch_supplier_links;
create trigger branch_supplier_links_updated_at
before update on public.branch_supplier_links
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_customer_links_updated_at
  on public.branch_customer_links;
create trigger branch_customer_links_updated_at
before update on public.branch_customer_links
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_payment_channels_updated_at
  on public.branch_payment_channel_configs;
create trigger branch_payment_channels_updated_at
before update on public.branch_payment_channel_configs
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_product_links_sharing_guard
  on public.branch_product_links;
create trigger branch_product_links_sharing_guard
before insert or update of tenant_id, branch_id, source_branch_id, catalogue_mode
on public.branch_product_links
for each row execute function private.validate_branch_source_sharing();

drop trigger if exists branch_product_prices_sharing_guard
  on public.branch_product_prices;
create trigger branch_product_prices_sharing_guard
before insert or update of tenant_id, branch_id, source_branch_id, pricing_mode
on public.branch_product_prices
for each row execute function private.validate_branch_source_sharing();

drop trigger if exists branch_supplier_links_sharing_guard
  on public.branch_supplier_links;
create trigger branch_supplier_links_sharing_guard
before insert or update of tenant_id, branch_id, source_branch_id, sharing_mode
on public.branch_supplier_links
for each row execute function private.validate_branch_source_sharing();

drop trigger if exists branch_customer_links_sharing_guard
  on public.branch_customer_links;
create trigger branch_customer_links_sharing_guard
before insert or update of tenant_id, branch_id, source_branch_id, sharing_mode
on public.branch_customer_links
for each row execute function private.validate_branch_source_sharing();

drop trigger if exists branch_payment_channels_sharing_guard
  on public.branch_payment_channel_configs;
create trigger branch_payment_channels_sharing_guard
before insert or update of tenant_id, branch_id, source_branch_id, sharing_mode
on public.branch_payment_channel_configs
for each row execute function private.validate_branch_source_sharing();

drop trigger if exists branch_warehouse_links_sharing_guard
  on public.branch_warehouse_links;
create trigger branch_warehouse_links_sharing_guard
before insert or update of tenant_id, branch_id, warehouse_id, sharing_mode
on public.branch_warehouse_links
for each row execute function private.validate_branch_warehouse_sharing();

-- New tables stay server/RPC-only until Phase 4 installs branch-aware access
-- functions and policies. This prevents a direct browser/API bypass during the
-- dark rollout while leaving every existing table and policy unchanged.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'branch_settings',
    'branch_product_links',
    'branch_product_prices',
    'warehouses',
    'branch_warehouse_links',
    'warehouse_stock',
    'branch_supplier_links',
    'branch_customer_links',
    'branch_payment_channel_configs'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

revoke all on function private.set_multibranch_updated_at() from public;
revoke all on function private.assert_branch_sharing_allowed(uuid, uuid, uuid) from public;
revoke all on function private.validate_branch_source_sharing() from public;
revoke all on function private.validate_branch_warehouse_sharing() from public;

commit;
