-- Tenant isolation and clean-workspace guardrail.
-- Run through `supabase db push` before enabling production registration.

begin;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.users
  where id = auth.uid()
  limit 1;
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where id = auth.uid()
  limit 1;
$$;

revoke all on function private.current_tenant_id() from public;
revoke all on function private.current_user_role() from public;
grant execute on function private.current_tenant_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;

-- A tenant is never created by an anonymous browser session. The backend service
-- role provisions it with empty JSON/settings fields and creates the first admin.
alter table public.tenants enable row level security;
alter table public.tenants force row level security;
drop policy if exists tenant_read_own_workspace on public.tenants;
drop policy if exists tenant_admin_update_own_workspace on public.tenants;
create policy tenant_read_own_workspace on public.tenants
  for select to authenticated
  using (id = private.current_tenant_id());
create policy tenant_admin_update_own_workspace on public.tenants
  for update to authenticated
  using (id = private.current_tenant_id() and private.current_user_role() = 'Admin')
  with check (id = private.current_tenant_id() and private.current_user_role() = 'Admin');

alter table public.users enable row level security;
alter table public.users force row level security;
drop policy if exists user_read_self_or_admin_tenant_member on public.users;
drop policy if exists admin_manage_tenant_members on public.users;
create policy user_read_self_or_admin_tenant_member on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or (tenant_id = private.current_tenant_id() and private.current_user_role() = 'Admin')
  );
create policy admin_manage_tenant_members on public.users
  for all to authenticated
  using (tenant_id = private.current_tenant_id() and private.current_user_role() = 'Admin')
  with check (tenant_id = private.current_tenant_id() and private.current_user_role() = 'Admin');

-- Cover every current public business table that carries a tenant_id. New tenant
-- tables must use tenant_id and receive this policy in their own migration too.
do $$
declare
  target_table record;
begin
  for target_table in
    select c.table_name, c.data_type, c.udt_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and c.table_name not in ('users')
      and t.table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', target_table.table_name);
    execute format('alter table public.%I force row level security', target_table.table_name);
    execute format('drop policy if exists tenant_isolation on public.%I', target_table.table_name);
    if target_table.data_type = 'uuid' or target_table.udt_name = 'uuid' then
      execute format(
        'create policy tenant_isolation on public.%I for all to authenticated using (tenant_id = private.current_tenant_id()) with check (tenant_id = private.current_tenant_id())',
        target_table.table_name
      );
    else
      execute format(
        'create policy tenant_isolation on public.%I for all to authenticated using (tenant_id = private.current_tenant_id()::text) with check (tenant_id = private.current_tenant_id()::text)',
        target_table.table_name
      );
    end if;
  end loop;
end;
$$;

-- Child rows inherit tenant access only through their tenant-owned parent.
alter table public.sale_items enable row level security;
alter table public.sale_items force row level security;
drop policy if exists sale_items_tenant_isolation on public.sale_items;
create policy sale_items_tenant_isolation on public.sale_items
  for all to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and s.tenant_id::text = private.current_tenant_id()::text))
  with check (exists (select 1 from public.sales s where s.id = sale_id and s.tenant_id::text = private.current_tenant_id()::text));

alter table public.purchase_items enable row level security;
alter table public.purchase_items force row level security;
drop policy if exists purchase_items_tenant_isolation on public.purchase_items;
create policy purchase_items_tenant_isolation on public.purchase_items
  for all to authenticated
  using (exists (select 1 from public.purchases p where p.id = purchase_id and p.tenant_id::text = private.current_tenant_id()::text))
  with check (exists (select 1 from public.purchases p where p.id = purchase_id and p.tenant_id::text = private.current_tenant_id()::text));

alter table public.sales_document_items enable row level security;
alter table public.sales_document_items force row level security;
drop policy if exists sales_document_items_tenant_isolation on public.sales_document_items;
create policy sales_document_items_tenant_isolation on public.sales_document_items
  for all to authenticated
  using (exists (select 1 from public.sales_documents d where d.id = sales_document_id and d.tenant_id::text = private.current_tenant_id()::text))
  with check (exists (select 1 from public.sales_documents d where d.id = sales_document_id and d.tenant_id::text = private.current_tenant_id()::text));

commit;
