-- Shared tenant workspace. Payload is intentionally tenant-owned and RLS-protected;
-- the application keeps a local cache only for offline operation.
create table if not exists public.tenant_workspaces (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists tenant_workspaces_updated_at_idx on public.tenant_workspaces (updated_at desc);

alter table public.tenant_workspaces enable row level security;
alter table public.tenant_workspaces force row level security;

drop policy if exists tenant_workspace_isolation on public.tenant_workspaces;
create policy tenant_workspace_isolation on public.tenant_workspaces
  for all to authenticated
  using (tenant_id = private.current_tenant_id())
  with check (tenant_id = private.current_tenant_id());

alter table public.tenant_workspaces replica identity full;
alter publication supabase_realtime add table public.tenant_workspaces;
