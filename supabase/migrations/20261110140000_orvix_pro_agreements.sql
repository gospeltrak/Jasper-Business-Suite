-- Private individualized Pro agreements. No payment capture or entitlement activation.
create table if not exists public.orvix_pro_agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','accepted','cancelled')),
  till_count integer not null default 1 check (till_count between 1 and 1000),
  currency_code text not null default 'TZS' check (currency_code='TZS'),
  fee_per_till numeric(18,2) not null default 120000 check (fee_per_till >= 0 and fee_per_till <= 1000000000000),
  monthly_amount numeric(20,2) generated always as (till_count * fee_per_till) stored,
  effective_date date,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orvix_pro_agreements_status on public.orvix_pro_agreements(status);
alter table public.orvix_pro_agreements enable row level security;
alter table public.orvix_pro_agreements force row level security;
revoke all on public.orvix_pro_agreements from public,anon,authenticated;
grant select,insert,update on public.orvix_pro_agreements to service_role;
comment on table public.orvix_pro_agreements is 'Orvix Pro per-tenant till subscription terms only, not billing charges or activation.';
