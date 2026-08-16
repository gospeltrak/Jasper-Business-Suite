-- Security threat event log + IP blocklist for the new Super Admin
-- "Security Activity" screen, plus the storage this session's Telegram
-- alerting reads from. Additive only: two new tables, no existing table
-- or column is touched.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.security_threat_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  ip_address text,
  identifier text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_threat_events_created_idx
  on public.security_threat_events (created_at desc);
create index if not exists security_threat_events_ip_idx
  on public.security_threat_events (ip_address);

create table if not exists public.ip_blocklist (
  ip_address text primary key,
  reason text,
  blocked_by uuid references public.users(id) on delete set null,
  blocked_at timestamptz not null default now(),
  unblocked_at timestamptz
);

alter table public.security_threat_events enable row level security;
alter table public.security_threat_events force row level security;
alter table public.ip_blocklist enable row level security;
alter table public.ip_blocklist force row level security;

create policy security_threat_events_platform_admin_read
  on public.security_threat_events for select to authenticated
  using (private.is_platform_admin());
create policy ip_blocklist_platform_admin_read
  on public.ip_blocklist for select to authenticated
  using (private.is_platform_admin());

revoke all on table public.security_threat_events from anon, authenticated;
revoke all on table public.ip_blocklist from anon, authenticated;
grant select on table public.security_threat_events to authenticated;
grant select on table public.ip_blocklist to authenticated;

commit;
