-- Generic platform records for Super SaaS modules that are not tenant-owned:
-- hardware catalog/sales, platform expenses, inbox messages, marketing settings,
-- tutorials, broadcasts, and web editor settings.

begin;

create table if not exists public.super_admin_platform_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  scope_id text not null default 'global',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, scope_id)
);

create index if not exists super_admin_platform_records_type_idx
  on public.super_admin_platform_records (record_type, updated_at desc);

alter table public.super_admin_platform_records enable row level security;
alter table public.super_admin_platform_records force row level security;

drop policy if exists super_admin_platform_records_platform_admin_access on public.super_admin_platform_records;
create policy super_admin_platform_records_platform_admin_access on public.super_admin_platform_records
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

commit;
