-- Affiliate program source-of-truth fields for organic affiliates, agent networks,
-- payout exports, and referral attribution. This migration is additive and does
-- not insert demo data.

alter table public.affiliates
  add column if not exists phone_whatsapp text,
  add column if not exists mobile_money_number text,
  add column if not exists mobile_money_provider text,
  add column if not exists affiliate_type text not null default 'organic',
  add column if not exists parent_agent_id uuid references public.users(id) on delete set null,
  add column if not exists promo_code text,
  add column if not exists referral_link text;

alter table public.affiliates
  drop constraint if exists affiliates_affiliate_type_check;
alter table public.affiliates
  add constraint affiliates_affiliate_type_check
  check (affiliate_type in ('organic', 'sub_affiliate'));

update public.affiliates
set
  promo_code = coalesce(nullif(promo_code, ''), referral_code),
  referral_link = coalesce(nullif(referral_link, ''), '/signup?ref=' || lower(referral_slug)),
  mobile_money_number = coalesce(nullif(mobile_money_number, ''), payout_account),
  mobile_money_provider = coalesce(nullif(mobile_money_provider, ''), payout_method)
where promo_code is null
   or referral_link is null
   or mobile_money_number is null
   or mobile_money_provider is null;

update public.affiliates affiliate
set
  affiliate_type = 'sub_affiliate',
  parent_agent_id = assignment.agent_user_id
from public.affiliate_agent_assignments assignment
where assignment.affiliate_id = affiliate.id
  and assignment.ended_at is null
  and assignment.is_primary
  and affiliate.parent_agent_id is null;

create index if not exists affiliates_type_idx
  on public.affiliates (affiliate_type, status, created_at desc);
create index if not exists affiliates_parent_agent_idx
  on public.affiliates (parent_agent_id, created_at desc)
  where parent_agent_id is not null;
create unique index if not exists affiliates_promo_code_unique
  on public.affiliates (promo_code)
  where promo_code is not null;

alter table public.affiliate_referrals
  add column if not exists agent_id uuid references public.users(id) on delete set null,
  add column if not exists sub_affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists promo_code_used text,
  add column if not exists registration_source text,
  add column if not exists revenue_generated numeric(14, 2) not null default 0;

update public.affiliate_referrals referral
set
  promo_code_used = coalesce(referral.promo_code_used, referral.referral_code),
  registration_source = coalesce(referral.registration_source, referral.source),
  sub_affiliate_id = case when affiliate.affiliate_type = 'sub_affiliate' then referral.affiliate_id else referral.sub_affiliate_id end,
  agent_id = coalesce(referral.agent_id, affiliate.parent_agent_id)
from public.affiliates affiliate
where affiliate.id = referral.affiliate_id;

create index if not exists affiliate_referrals_agent_idx
  on public.affiliate_referrals (agent_id, created_at desc)
  where agent_id is not null;
create index if not exists affiliate_referrals_sub_affiliate_idx
  on public.affiliate_referrals (sub_affiliate_id, created_at desc)
  where sub_affiliate_id is not null;
create index if not exists affiliate_referrals_promo_code_idx
  on public.affiliate_referrals (promo_code_used);

alter table public.affiliate_commissions
  add column if not exists account_type text,
  add column if not exists agent_id uuid references public.users(id) on delete set null,
  add column if not exists withholding_tax_rate numeric(7, 4) not null default 0.05,
  add column if not exists payout_responsibility text not null default 'platform',
  add column if not exists payout_status text not null default 'pending';

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_account_type_check;
alter table public.affiliate_commissions
  add constraint affiliate_commissions_account_type_check
  check (account_type in ('organic_affiliate', 'agent', 'sub_affiliate'));

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_payout_responsibility_check;
alter table public.affiliate_commissions
  add constraint affiliate_commissions_payout_responsibility_check
  check (payout_responsibility in ('platform', 'agent'));

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_payout_status_check;
alter table public.affiliate_commissions
  add constraint affiliate_commissions_payout_status_check
  check (payout_status in ('pending', 'available', 'approved', 'paid', 'void'));

update public.affiliate_commissions commission
set
  account_type = coalesce(
    commission.account_type,
    case when affiliate.affiliate_type = 'sub_affiliate' then 'sub_affiliate' else 'organic_affiliate' end
  ),
  agent_id = coalesce(commission.agent_id, affiliate.parent_agent_id),
  commission_rate = coalesce(commission.commission_rate, 0.15),
  withholding_tax_rate = coalesce(commission.withholding_tax_rate, 0.05),
  payout_responsibility = coalesce(
    commission.payout_responsibility,
    case when affiliate.affiliate_type = 'sub_affiliate' then 'agent' else 'platform' end
  ),
  payout_status = coalesce(commission.payout_status, commission.status)
from public.affiliates affiliate
where affiliate.id = commission.affiliate_id;

alter table public.affiliate_commissions
  alter column account_type set not null;

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_formula_check;
alter table public.affiliate_commissions
  add constraint affiliate_commissions_formula_check check (
    gross_commission = round(gross_revenue * commission_rate, 2)
    and withholding_tax = round(gross_commission * withholding_tax_rate, 2)
    and net_payout = round(gross_commission - withholding_tax, 2)
  );

create index if not exists affiliate_commissions_account_type_idx
  on public.affiliate_commissions (account_type, payout_status, created_at desc);
create index if not exists affiliate_commissions_agent_idx
  on public.affiliate_commissions (agent_id, created_at desc)
  where agent_id is not null;

alter table public.affiliate_payouts
  add column if not exists account_type text,
  add column if not exists agent_id uuid references public.users(id) on delete set null,
  add column if not exists payout_phone text,
  add column if not exists payout_provider text,
  add column if not exists gross_revenue numeric(14, 2) not null default 0,
  add column if not exists gross_commission numeric(14, 2) not null default 0,
  add column if not exists withholding_tax numeric(14, 2) not null default 0,
  add column if not exists net_payout numeric(14, 2) not null default 0,
  add column if not exists approved_by_super_admin uuid references public.users(id) on delete set null;

alter table public.affiliate_payouts
  drop constraint if exists affiliate_payouts_account_type_check;
alter table public.affiliate_payouts
  add constraint affiliate_payouts_account_type_check
  check (account_type in ('organic_affiliate', 'agent', 'sub_affiliate'));

update public.affiliate_payouts payout
set
  account_type = coalesce(
    payout.account_type,
    case when affiliate.affiliate_type = 'sub_affiliate' then 'sub_affiliate' else 'organic_affiliate' end
  ),
  agent_id = coalesce(payout.agent_id, affiliate.parent_agent_id),
  payout_phone = coalesce(payout.payout_phone, affiliate.mobile_money_number, affiliate.payout_account),
  payout_provider = coalesce(payout.payout_provider, affiliate.mobile_money_provider, affiliate.payout_method),
  net_payout = case when payout.net_payout = 0 then payout.amount else payout.net_payout end,
  gross_commission = case when payout.gross_commission = 0 then payout.amount else payout.gross_commission end
from public.affiliates affiliate
where affiliate.id = payout.affiliate_id;

alter table public.affiliate_payouts
  alter column account_type set not null;

create index if not exists affiliate_payouts_account_type_idx
  on public.affiliate_payouts (account_type, status, requested_at desc);
create index if not exists affiliate_payouts_agent_idx
  on public.affiliate_payouts (agent_id, requested_at desc)
  where agent_id is not null;
