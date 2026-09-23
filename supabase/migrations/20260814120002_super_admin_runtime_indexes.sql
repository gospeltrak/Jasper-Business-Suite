-- Additive indexes for the Super Admin overview, live device presence,
-- affiliate monitoring, and referral reporting hot paths.
-- Non-concurrent: the Supabase CLI pipelines migration statements together,
-- which CREATE INDEX CONCURRENTLY cannot run inside. These auxiliary admin
-- tables are small, so the brief lock during creation is not a concern.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '10min';

create index if not exists user_sessions_activity_idx
  on public.user_sessions (last_activity_at desc);

create index if not exists user_sessions_online_activity_idx
  on public.user_sessions (last_activity_at desc)
  include (user_id, tenant_id, device_id, account_type, role_key, device_label)
  where is_active = true and logout_at is null;

create index if not exists affiliates_created_at_idx
  on public.affiliates (created_at desc);

create index if not exists affiliate_partners_created_at_idx
  on public.affiliate_partners (created_at desc);

create index if not exists affiliate_referrals_created_at_idx
  on public.affiliate_referrals (created_at desc);

create index if not exists subscriber_source_created_at_idx
  on public.subscriber_source_tracking (created_at desc);

create index if not exists referred_customers_created_at_idx
  on public.referred_customers (created_at desc);

create index if not exists referred_customers_affiliate_created_idx
  on public.referred_customers (affiliate_id, created_at desc)
  where affiliate_id is not null;

create index if not exists referred_customers_sub_affiliate_created_idx
  on public.referred_customers (sub_affiliate_id, created_at desc)
  where sub_affiliate_id is not null;

create index if not exists referred_customers_partner_created_idx
  on public.referred_customers (parent_super_agent_id, created_at desc)
  where parent_super_agent_id is not null;

create index if not exists referred_customers_promo_created_idx
  on public.referred_customers (promo_code_used, created_at desc)
  where promo_code_used is not null;

create index if not exists commission_ledger_affiliate_idx
  on public.commission_ledger (affiliate_id)
  where affiliate_id is not null;

create index if not exists commission_ledger_sub_affiliate_idx
  on public.commission_ledger (sub_affiliate_id)
  where sub_affiliate_id is not null;

create index if not exists commission_ledger_partner_idx
  on public.commission_ledger (parent_super_agent_id)
  where parent_super_agent_id is not null;

commit;
