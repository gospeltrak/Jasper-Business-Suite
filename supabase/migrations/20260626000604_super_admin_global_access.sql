-- Real Super SaaS Admin access.
-- Normal tenant users remain isolated by tenant policies; platform admins can
-- inspect and manage tenants, users, sessions, and tenant-owned records.

begin;

drop policy if exists tenant_platform_admin_global_access on public.tenants;
create policy tenant_platform_admin_global_access on public.tenants
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

drop policy if exists users_platform_admin_global_access on public.users;
create policy users_platform_admin_global_access on public.users
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

drop policy if exists tenant_workspace_platform_admin_global_access on public.tenant_workspaces;
create policy tenant_workspace_platform_admin_global_access on public.tenant_workspaces
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

drop policy if exists user_sessions_platform_admin_global_access on public.user_sessions;
create policy user_sessions_platform_admin_global_access on public.user_sessions
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

do $$
declare
  target_table record;
begin
  for target_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and c.table_name not in ('users', 'tenants', 'tenant_workspaces', 'user_sessions')
      and t.table_type = 'BASE TABLE'
  loop
    execute format('drop policy if exists platform_admin_global_access on public.%I', target_table.table_name);
    execute format(
      'create policy platform_admin_global_access on public.%I for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin())',
      target_table.table_name
    );
  end loop;
end;
$$;

drop policy if exists sale_items_platform_admin_global_access on public.sale_items;
create policy sale_items_platform_admin_global_access on public.sale_items
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

drop policy if exists purchase_items_platform_admin_global_access on public.purchase_items;
create policy purchase_items_platform_admin_global_access on public.purchase_items
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

drop policy if exists sales_document_items_platform_admin_global_access on public.sales_document_items;
create policy sales_document_items_platform_admin_global_access on public.sales_document_items
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

create table if not exists public.super_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete restrict,
  target_user_id uuid references public.users(id) on delete set null,
  target_tenant_id uuid references public.tenants(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists super_admin_audit_logs_created_idx
  on public.super_admin_audit_logs (created_at desc);
create index if not exists super_admin_audit_logs_actor_idx
  on public.super_admin_audit_logs (actor_user_id, created_at desc);

alter table public.super_admin_audit_logs enable row level security;
alter table public.super_admin_audit_logs force row level security;

drop policy if exists super_admin_audit_logs_platform_admin_access on public.super_admin_audit_logs;
create policy super_admin_audit_logs_platform_admin_access on public.super_admin_audit_logs
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

commit;
