-- Orvix Pro: opt-in tenant entitlement, not a paid package yet.
-- No existing tenant/package/payment/data rows are modified.
-- Feature flags must be granted through a trusted platform-admin process only.
create table if not exists public.orvix_pro_entitlements (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  tier text not null default 'pro' check (tier = 'pro'),
  status text not null default 'inactive' check (status in ('inactive', 'trial', 'active', 'suspended', 'expired')),
  settle_enabled boolean not null default false,
  shift_reports_enabled boolean not null default false,
  cashier_accountability_enabled boolean not null default false,
  park_sale_enabled boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  activated_at timestamptz,
  activated_by uuid,
  notes text,
  updated_at timestamptz not null default now(),
  constraint orvix_pro_dates_check check (expires_at is null or starts_at is null or expires_at > starts_at),
  constraint orvix_pro_trial_window_check check (status <> 'trial' or (starts_at is not null and expires_at is not null))
);

alter table public.orvix_pro_entitlements enable row level security;
alter table public.orvix_pro_entitlements force row level security;
revoke all on public.orvix_pro_entitlements from public, anon, authenticated;
grant select, insert, update, delete on public.orvix_pro_entitlements to service_role;

comment on table public.orvix_pro_entitlements is
  'Private, admin-managed Orvix Pro entitlements. No automatic purchases, renewals or grants. Missing rows deny all Pro capabilities.';

-- Never seed existing Tanzanite tenants. A new test tenant can be granted
-- status='trial' with bounded starts_at/expires_at after owner approval.
