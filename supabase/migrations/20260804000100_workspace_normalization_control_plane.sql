-- Additive control plane for migrating legacy tenant workspace JSON into
-- normalized tables. This migration intentionally does not update or delete
-- tenant data, change application reads, or enable dual-write.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create table if not exists public.workspace_migration_batches (
  id uuid primary key default gen_random_uuid(),
  migration_version text not null,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  source_updated_at timestamptz,
  source_payload_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'verified', 'failed', 'rolled_back')),
  started_at timestamptz,
  completed_at timestamptz,
  row_counts jsonb not null default '{}'::jsonb,
  financial_totals jsonb not null default '{}'::jsonb,
  error_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, migration_version, source_payload_hash)
);

create table if not exists public.workspace_migration_state (
  tenant_id uuid primary key references public.tenants(id) on delete restrict,
  migration_version text not null,
  phase text not null default 'inventory'
    check (phase in (
      'inventory',
      'schema_ready',
      'dual_write',
      'backfill',
      'shadow_read',
      'cohort_cutover',
      'normalized',
      'rolled_back'
    )),
  read_mode text not null default 'legacy'
    check (read_mode in ('legacy', 'shadow', 'normalized')),
  dual_write_enabled boolean not null default false,
  backfill_cursor jsonb not null default '{}'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  target_counts jsonb not null default '{}'::jsonb,
  source_totals jsonb not null default '{}'::jsonb,
  target_totals jsonb not null default '{}'::jsonb,
  last_source_hash text,
  last_verified_at timestamptz,
  last_error jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.workspace_migration_batches(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  migration_version text not null,
  source_updated_at timestamptz,
  source_payload_hash text,
  source_counts jsonb not null default '{}'::jsonb,
  target_counts jsonb not null default '{}'::jsonb,
  source_totals jsonb not null default '{}'::jsonb,
  target_totals jsonb not null default '{}'::jsonb,
  mismatch_details jsonb not null default '{}'::jsonb,
  is_match boolean not null default false,
  checked_at timestamptz not null default now()
);

-- Preserve arbitrary legacy identifiers while normalized tables retain stable
-- UUID primary keys. Columns stay nullable until a verified backfill finishes.
alter table public.products
  add column if not exists legacy_id text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_payload_hash text,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

alter table public.sales
  add column if not exists legacy_id text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_payload_hash text,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

alter table public.sale_items
  add column if not exists tenant_id uuid references public.tenants(id) on delete restrict,
  add column if not exists legacy_id text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

alter table public.expenses
  add column if not exists legacy_id text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_payload_hash text,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

alter table public.deliveries
  add column if not exists branch_id uuid,
  add column if not exists legacy_id text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_payload_hash text,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

alter table public.purchases
  add column if not exists legacy_id text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_payload_hash text,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

alter table public.purchase_items
  add column if not exists tenant_id uuid references public.tenants(id) on delete restrict,
  add column if not exists legacy_id text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

-- Idempotent backfills and tenant-scoped runtime access.
create unique index if not exists products_tenant_legacy_id_uidx
  on public.products (tenant_id, legacy_id)
  where legacy_id is not null;
create index if not exists products_tenant_updated_idx
  on public.products (tenant_id, updated_at desc, id);

create unique index if not exists sales_tenant_legacy_id_uidx
  on public.sales (tenant_id, legacy_id)
  where legacy_id is not null;
create index if not exists sales_tenant_branch_time_idx
  on public.sales (tenant_id, branch_id, "timestamp" desc, id);
create index if not exists sales_tenant_time_idx
  on public.sales (tenant_id, "timestamp" desc, id);

create unique index if not exists sale_items_tenant_legacy_id_uidx
  on public.sale_items (tenant_id, legacy_id)
  where tenant_id is not null and legacy_id is not null;
create index if not exists sale_items_tenant_sale_idx
  on public.sale_items (tenant_id, sale_id, id);

create unique index if not exists expenses_tenant_legacy_id_uidx
  on public.expenses (tenant_id, legacy_id)
  where legacy_id is not null;
create index if not exists expenses_tenant_branch_time_idx
  on public.expenses (tenant_id, branch_id, "timestamp" desc, id);

create unique index if not exists deliveries_tenant_legacy_id_uidx
  on public.deliveries (tenant_id, legacy_id)
  where legacy_id is not null;
create index if not exists deliveries_tenant_branch_time_idx
  on public.deliveries (tenant_id, branch_id, "timestamp" desc, id);
create index if not exists deliveries_tenant_status_time_idx
  on public.deliveries (tenant_id, status, "timestamp" desc, id);

create unique index if not exists purchases_tenant_legacy_id_uidx
  on public.purchases (tenant_id, legacy_id)
  where legacy_id is not null;
create index if not exists purchases_tenant_branch_time_idx
  on public.purchases (tenant_id, branch_id, "timestamp" desc, id);

create unique index if not exists purchase_items_tenant_legacy_id_uidx
  on public.purchase_items (tenant_id, legacy_id)
  where tenant_id is not null and legacy_id is not null;
create index if not exists purchase_items_tenant_purchase_idx
  on public.purchase_items (tenant_id, purchase_id, id);

create index if not exists migration_batches_tenant_status_idx
  on public.workspace_migration_batches (tenant_id, status, created_at desc);
create index if not exists reconciliation_tenant_checked_idx
  on public.workspace_reconciliation_runs (tenant_id, checked_at desc);
create index if not exists reconciliation_mismatches_idx
  on public.workspace_reconciliation_runs (tenant_id, checked_at desc)
  where not is_match;

alter table public.workspace_migration_batches enable row level security;
alter table public.workspace_migration_batches force row level security;
alter table public.workspace_migration_state enable row level security;
alter table public.workspace_migration_state force row level security;
alter table public.workspace_reconciliation_runs enable row level security;
alter table public.workspace_reconciliation_runs force row level security;

-- Migration control data is backend-only. The service role bypasses RLS;
-- browser roles receive no direct privileges or policies.
revoke all on table public.workspace_migration_batches from public, anon, authenticated;
revoke all on table public.workspace_migration_state from public, anon, authenticated;
revoke all on table public.workspace_reconciliation_runs from public, anon, authenticated;
revoke all on table public.workspace_migration_batches from service_role;
revoke all on table public.workspace_migration_state from service_role;
revoke all on table public.workspace_reconciliation_runs from service_role;
grant select, insert, update on table public.workspace_migration_batches to service_role;
grant select, insert, update on table public.workspace_migration_state to service_role;
grant select, insert on table public.workspace_reconciliation_runs to service_role;

comment on table public.workspace_migration_state is
  'Per-tenant reversible cutover flags. Defaults keep every tenant on legacy reads with dual-write disabled.';
comment on table public.workspace_reconciliation_runs is
  'Append-only reconciliation evidence captured before any tenant read cutover.';

commit;
