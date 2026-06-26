-- Partner management, compliance details, and an immutable commission formula.

create or replace function private.is_partner_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and is_active
      and account_type = 'partner'
  );
$$;

revoke all on function private.is_partner_account() from public;
grant execute on function private.is_partner_account() to authenticated;

create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliates
  add column if not exists nida_number text,
  add column if not exists tin_number text;

alter table public.affiliate_commissions
  add column if not exists gross_revenue numeric(14, 2) not null default 0,
  add column if not exists gross_commission numeric(14, 2),
  add column if not exists withholding_tax numeric(14, 2),
  add column if not exists net_payout numeric(14, 2);

-- Preserve historical rows by interpreting their existing amount as the former
-- gross commission amount, then calculate the consistent ledger fields.
update public.affiliate_commissions
set gross_revenue = case when amount > 0 then round(amount / 0.15, 2) else 0 end
where gross_revenue = 0 and amount > 0;

update public.affiliate_commissions
set gross_commission = round(gross_revenue * 0.15, 2),
    withholding_tax = round(round(gross_revenue * 0.15, 2) * 0.05, 2),
    net_payout = round(round(gross_revenue * 0.15, 2) - round(round(gross_revenue * 0.15, 2) * 0.05, 2), 2)
where gross_commission is null or withholding_tax is null or net_payout is null;

alter table public.affiliate_commissions
  alter column gross_commission set not null,
  alter column withholding_tax set not null,
  alter column net_payout set not null;

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_formula_check;
alter table public.affiliate_commissions
  add constraint affiliate_commissions_formula_check check (
    gross_commission = round(gross_revenue * 0.15, 2)
    and withholding_tax = round(gross_commission * 0.05, 2)
    and net_payout = round(gross_commission - withholding_tax, 2)
  );

create table if not exists public.affiliate_audit_logs (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  action text not null check (action in ('profile_viewed', 'mirror_opened', 'profile_updated', 'status_updated', 'task_created', 'meeting_created', 'campaign_assigned', 'payout_requested', 'payout_updated')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_audit_logs_affiliate_idx
  on public.affiliate_audit_logs (affiliate_id, created_at desc);

alter table public.affiliate_partners enable row level security;
alter table public.affiliate_audit_logs enable row level security;

create policy affiliate_partners_self_or_admin_read on public.affiliate_partners for select to authenticated
  using (user_id = auth.uid() or private.is_platform_admin());
create policy affiliate_partners_admin_manage on public.affiliate_partners for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy affiliate_audit_logs_scoped_read on public.affiliate_audit_logs for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_affiliate_agent(affiliate_id));

create or replace function public.record_partner_affiliate_action(
  p_affiliate_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  if not private.is_partner_account() and not private.is_platform_admin() then
    raise exception 'Partner or platform administrator account required';
  end if;
  if not private.is_platform_admin() and not private.is_assigned_affiliate_agent(p_affiliate_id) then
    raise exception 'Affiliate is not assigned to this partner';
  end if;
  insert into public.affiliate_audit_logs (affiliate_id, actor_user_id, action, metadata)
  values (p_affiliate_id, auth.uid(), p_action, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_log_id;
  return v_log_id;
end;
$$;

create or replace function public.create_affiliate_commission_from_revenue(
  p_affiliate_id uuid,
  p_gross_revenue numeric,
  p_referral_id uuid default null,
  p_period_start date default null,
  p_period_end date default null
)
returns public.affiliate_commissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission public.affiliate_commissions%rowtype;
  v_gross_commission numeric(14, 2);
  v_withholding_tax numeric(14, 2);
  v_net_payout numeric(14, 2);
begin
  if not private.is_platform_admin() then
    raise exception 'Only a platform administrator can create a commission ledger entry';
  end if;
  if p_gross_revenue < 0 then
    raise exception 'Gross revenue cannot be negative';
  end if;

  v_gross_commission := round(p_gross_revenue * 0.15, 2);
  v_withholding_tax := round(v_gross_commission * 0.05, 2);
  v_net_payout := round(v_gross_commission - v_withholding_tax, 2);

  insert into public.affiliate_commissions (
    affiliate_id, referral_id, amount, gross_revenue, gross_commission,
    withholding_tax, net_payout, currency, status, period_start, period_end
  ) values (
    p_affiliate_id, p_referral_id, v_net_payout, p_gross_revenue, v_gross_commission,
    v_withholding_tax, v_net_payout, 'TZS', 'available', p_period_start, p_period_end
  ) returning * into v_commission;
  return v_commission;
end;
$$;

revoke all on function public.record_partner_affiliate_action(uuid, text, jsonb) from public;
revoke all on function public.create_affiliate_commission_from_revenue(uuid, numeric, uuid, date, date) from public;
grant execute on function public.record_partner_affiliate_action(uuid, text, jsonb) to authenticated;
grant execute on function public.create_affiliate_commission_from_revenue(uuid, numeric, uuid, date, date) to authenticated;
