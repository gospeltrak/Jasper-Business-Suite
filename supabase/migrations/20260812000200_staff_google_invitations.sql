create table if not exists public.staff_google_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash) = 64),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_workspace_id text not null,
  email text not null,
  staff_name text not null,
  phone text not null,
  role_key text not null,
  permissions jsonb not null default '{}'::jsonb,
  branch_id uuid references public.branches(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null,
  created_by uuid not null references public.users(id) on delete restrict,
  accepted_by uuid references public.users(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_google_invitations_tenant_staff_idx
  on public.staff_google_invitations (tenant_id, staff_workspace_id, status);
create index if not exists staff_google_invitations_expiry_idx
  on public.staff_google_invitations (expires_at) where status = 'pending';

alter table public.staff_google_invitations enable row level security;
alter table public.staff_google_invitations force row level security;
revoke all on public.staff_google_invitations from anon, authenticated;
comment on table public.staff_google_invitations is
  'Server-only, single-use Google invitations for pre-authorized tenant staff. Raw tokens are never stored.';
