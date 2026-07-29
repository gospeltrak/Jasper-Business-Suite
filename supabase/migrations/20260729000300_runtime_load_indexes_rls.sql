-- Additive runtime-load optimization.
-- No tenant data is updated or deleted and authorization rules stay unchanged.

create index concurrently if not exists branches_directory_active_idx
  on public.branches (tenant_id, is_default desc, branch_name, id)
  where archived_at is null;

-- UPDATE events only need the primary key from the old row. The new row remains
-- available to the existing tenant_workspaces Realtime subscriber.
alter table public.tenant_workspaces replica identity default;

drop policy if exists tenant_workspace_admin_isolation on public.tenant_workspaces;
create policy tenant_workspace_admin_isolation on public.tenant_workspaces
  for all
  to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (
      select private.is_tenant_branch_administrator(
        private.current_tenant_id()
      )
    )
  )
  with check (
    tenant_id = (select private.current_tenant_id())
    and (
      select private.is_tenant_branch_administrator(
        private.current_tenant_id()
      )
    )
  );

drop policy if exists tenant_data_admin_read on public.tenant_data;
drop policy if exists tenant_data_admin_insert on public.tenant_data;
drop policy if exists tenant_data_admin_update on public.tenant_data;
drop policy if exists tenant_data_admin_delete on public.tenant_data;

create policy tenant_data_admin_read on public.tenant_data
  for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())::text
    and (
      select private.is_tenant_branch_administrator(
        private.current_tenant_id()
      )
    )
  );

create policy tenant_data_admin_insert on public.tenant_data
  for insert to authenticated
  with check (
    tenant_id = (select private.current_tenant_id())::text
    and (
      select private.is_tenant_branch_administrator(
        private.current_tenant_id()
      )
    )
  );

create policy tenant_data_admin_update on public.tenant_data
  for update to authenticated
  using (
    tenant_id = (select private.current_tenant_id())::text
    and (
      select private.is_tenant_branch_administrator(
        private.current_tenant_id()
      )
    )
  )
  with check (
    tenant_id = (select private.current_tenant_id())::text
    and (
      select private.is_tenant_branch_administrator(
        private.current_tenant_id()
      )
    )
  );

create policy tenant_data_admin_delete on public.tenant_data
  for delete to authenticated
  using (
    tenant_id = (select private.current_tenant_id())::text
    and (
      select private.is_tenant_branch_administrator(
        private.current_tenant_id()
      )
    )
  );
