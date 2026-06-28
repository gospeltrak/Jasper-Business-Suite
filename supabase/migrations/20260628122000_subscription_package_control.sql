begin;

alter table public.tenants
  add column if not exists selected_package_id text,
  add column if not exists active_package_id text,
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists subscription_start_date timestamptz,
  add column if not exists subscription_end_date timestamptz,
  add column if not exists package_updated_at timestamptz,
  add column if not exists package_change_type text,
  add column if not exists package_change_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_selected_package_check'
  ) then
    alter table public.tenants
      add constraint tenants_selected_package_check
      check (selected_package_id is null or selected_package_id in ('ruby', 'diamond', 'tanzanite'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_active_package_check'
  ) then
    alter table public.tenants
      add constraint tenants_active_package_check
      check (active_package_id is null or active_package_id in ('ruby', 'diamond', 'tanzanite'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_subscription_status_check'
  ) then
    alter table public.tenants
      add constraint tenants_subscription_status_check
      check (subscription_status in ('trial', 'pending', 'active', 'expired', 'suspended'));
  end if;
end $$;

create table if not exists public.tenant_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_package_id text not null check (requested_package_id in ('ruby', 'diamond', 'tanzanite')),
  requested_package_name text not null,
  amount numeric(14,2),
  currency text not null default 'TSh',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  receipt_file_name text,
  receipt_file_type text,
  receipt_file_size bigint,
  receipt_file_url text,
  note text,
  admin_note text,
  submitted_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_payment_proofs_tenant_idx
  on public.tenant_payment_proofs (tenant_id, submitted_at desc);

create index if not exists tenant_payment_proofs_status_idx
  on public.tenant_payment_proofs (status, submitted_at desc);

alter table public.tenant_payment_proofs enable row level security;
alter table public.tenant_payment_proofs force row level security;

drop policy if exists tenant_payment_proofs_tenant_access on public.tenant_payment_proofs;
create policy tenant_payment_proofs_tenant_access on public.tenant_payment_proofs
  for all to authenticated
  using (tenant_id = private.current_tenant_id())
  with check (tenant_id = private.current_tenant_id());

drop policy if exists tenant_payment_proofs_platform_admin_access on public.tenant_payment_proofs;
create policy tenant_payment_proofs_platform_admin_access on public.tenant_payment_proofs
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

alter table public.tenant_payment_proofs replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.tenant_payment_proofs;
  exception
    when duplicate_object then null;
  end;
end $$;

commit;
