-- Per-key tenant cache for secondary modules (for example payment channels).
create table if not exists public.tenant_data (
  id bigserial primary key,
  tenant_id text not null,
  data_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint tenant_data_unique unique (tenant_id, data_key)
);

create index if not exists tenant_data_tenant_idx on public.tenant_data (tenant_id);

alter table public.tenant_data enable row level security;
alter table public.tenant_data force row level security;

drop policy if exists tenant_data_read_own on public.tenant_data;
drop policy if exists tenant_data_insert_own on public.tenant_data;
drop policy if exists tenant_data_update_own on public.tenant_data;
drop policy if exists tenant_data_delete_own on public.tenant_data;

create policy tenant_data_read_own on public.tenant_data
  for select to authenticated using (tenant_id = private.current_tenant_id()::text);
create policy tenant_data_insert_own on public.tenant_data
  for insert to authenticated with check (tenant_id = private.current_tenant_id()::text);
create policy tenant_data_update_own on public.tenant_data
  for update to authenticated
  using (tenant_id = private.current_tenant_id()::text)
  with check (tenant_id = private.current_tenant_id()::text);
create policy tenant_data_delete_own on public.tenant_data
  for delete to authenticated using (tenant_id = private.current_tenant_id()::text);
