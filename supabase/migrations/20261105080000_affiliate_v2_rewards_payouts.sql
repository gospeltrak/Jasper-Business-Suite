-- Orvix Affiliate V2: one verified registration bonus, recurring paid 10%,
-- one month-end payout request. Additive: historical commission/payout records unchanged.
-- AzamPay external disbursement is deliberately NOT auto-triggered.
begin;

create table if not exists public.affiliate_reward_entries (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  source_key text not null unique,
  reward_type text not null check (reward_type in ('registration_bonus','subscription_commission')),
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  source_revenue numeric(14,2) not null default 0,
  withholding_tax numeric(14,2) not null default 0 check (withholding_tax >= 0),
  net_amount numeric(14,2) not null check (net_amount > 0),
  currency text not null default 'TZS' check (currency = 'TZS'),
  status text not null default 'available' check (status in ('available','reserved','paid','void')),
  payout_id uuid references public.affiliate_payouts(id) on delete set null,
  source_reference text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint reward_net_amount_consistent check (net_amount = gross_amount - withholding_tax)
);
create index if not exists affiliate_reward_affiliate_balance_idx
  on public.affiliate_reward_entries(affiliate_id,status,created_at desc);
create index if not exists affiliate_reward_tenant_idx
  on public.affiliate_reward_entries(tenant_id,reward_type);

alter table public.affiliate_reward_entries enable row level security;
create policy affiliate_rewards_own_read on public.affiliate_reward_entries
  for select to authenticated
  using (affiliate_id = private.current_affiliate_id() or private.is_platform_admin());
revoke all on public.affiliate_reward_entries from public,anon,authenticated;
grant select on public.affiliate_reward_entries to authenticated;
grant all on public.affiliate_reward_entries to service_role;

alter table public.affiliate_payouts
  add column if not exists payout_month date,
  add column if not exists provider_fee_tzs numeric(14,2),
  add column if not exists registration_component numeric(14,2),
  add column if not exists commission_component numeric(14,2);
create unique index if not exists affiliate_payouts_one_request_per_month_v2
  on public.affiliate_payouts(affiliate_id,payout_month)
  where payout_month is not null;

-- Direct client inserts must never bypass the date, threshold, balance, or single-payout rules.
drop policy if exists affiliate_payouts_self_request on public.affiliate_payouts;

-- Only the trusted server service-role may award a signup bonus.
create or replace function public.credit_affiliate_signup_v2(
  p_tenant_id uuid, p_user_id uuid, p_referral_code text
) returns boolean
language plpgsql security definer set search_path = ''
as $function$
declare
  v_code text := upper(btrim(coalesce(p_referral_code,'')));
  v_aff public.affiliates%rowtype;
  v_user public.users%rowtype;
  v_existing_affiliate uuid;
  v_inserted uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using errcode='42501',message='Service role only.';
  end if;
  if v_code !~ '^[A-Z0-9_-]{3,64}$' or p_tenant_id is null or p_user_id is null then return false; end if;
  select * into v_user from public.users
    where id=p_user_id and tenant_id=p_tenant_id and coalesce(is_saas_staff,false)=false;
  if not found then return false; end if;
  select a.* into v_aff from public.affiliates a
    where (upper(a.promo_code)=v_code or upper(a.referral_code)=v_code)
      and a.status='active' and not coalesce(a.is_disabled,false)
    order by a.id limit 1;
  if not found or v_aff.user_id=p_user_id then return false; end if;
  if exists (
    select 1 from public.users refowner
    where refowner.id=v_aff.user_id
      and (lower(coalesce(refowner.email,''))=lower(coalesce(v_user.email,''))
       or (length(regexp_replace(coalesce(refowner.phone,''),'[^0-9]','','g')) >= 9
        and regexp_replace(coalesce(refowner.phone,''),'[^0-9]','','g')=regexp_replace(coalesce(v_user.phone,''),'[^0-9]','','g')))
  ) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,42));
  select affiliate_id into v_existing_affiliate
    from public.affiliate_referrals where registered_tenant_id=p_tenant_id
    and status in ('registered','converted') order by created_at limit 1;
  if v_existing_affiliate is not null and v_existing_affiliate <> v_aff.id then return false; end if;
  insert into public.affiliate_reward_entries(
    affiliate_id,tenant_id,source_key,reward_type,gross_amount,withholding_tax,net_amount,source_reference
  ) values (v_aff.id,p_tenant_id,'registration:'||p_tenant_id::text,'registration_bonus',2000,0,2000,p_user_id::text)
  on conflict(source_key) do nothing returning id into v_inserted;
  if v_inserted is null then return false; end if;

  update public.tenants set registered_via_affiliate_id=v_aff.id
    where id=p_tenant_id and registered_via_affiliate_id is null;
  if not exists(select 1 from public.affiliate_referrals where registered_tenant_id=p_tenant_id) then
    insert into public.affiliate_referrals (
      affiliate_id,referral_code,registered_tenant_id,registered_user_id,status,
      source,promo_code_used,registered_at,registration_source
    ) values (v_aff.id,v_code,p_tenant_id,p_user_id,'registered',
      'verified_registration',v_code,now(),'verified_registration');
  end if;
  if not exists(select 1 from public.subscriber_source_tracking where tenant_id=p_tenant_id) then
    insert into public.subscriber_source_tracking(
      subscriber_user_id,tenant_id,source_type,referral_code_used,promo_code_used,
      affiliate_id,status,registration_source
    ) values (p_user_id,p_tenant_id,
      case when v_aff.affiliate_type='sub_affiliate' then 'sub_affiliate' else 'organic_affiliate' end,
      v_code,v_code,v_aff.id,'registered','verified_registration');
  end if;
  -- Maintain a zero-revenue legacy attribution row for existing administrative reports.
  -- This is independent from, and cannot create, any revenue commission.
  if not exists(select 1 from public.referred_customers where customer_id=p_tenant_id::text) then
    insert into public.referred_customers(
      customer_id,tenant_id,customer_name,source_type,affiliate_id,sub_affiliate_id,
      referral_code_used,promo_code_used,package_name,package_price,amount_paid,
      payment_status,commission_status,commission_amount
    ) values (
      p_tenant_id::text,p_tenant_id::text,
      coalesce((select name from public.tenants where id=p_tenant_id),'New Business'),
      case when v_aff.affiliate_type='sub_affiliate' then 'sub_affiliate' else 'organic_affiliate' end,
      v_aff.id::text,v_aff.id::text,v_code,v_code,'Trial',0,0,'pending','pending',0
    );
  end if;
  if not exists(select 1 from public.commission_ledger where customer_id=p_tenant_id::text) then
    insert into public.commission_ledger(
      customer_id,source_type,affiliate_id,sub_affiliate_id,
      revenue_amount,network_pool_20,manager_commission_5,
      sub_affiliate_gross_commission_15,withholding_tax_rate,
      withholding_tax_amount,sub_affiliate_net_payout,
      tin_number_available,withholding_status,status,currency
    ) values (
      p_tenant_id::text,
      case when v_aff.affiliate_type='sub_affiliate' then 'sub_affiliate' else 'organic_affiliate' end,
      v_aff.id::text,v_aff.id::text,0,0,0,0,0.05,0,0,false,'not_active','pending','TZS'
    );
  end if;
  return true;
end;
$function$;
revoke all on function public.credit_affiliate_signup_v2(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.credit_affiliate_signup_v2(uuid,uuid,text) to service_role;

-- Credit once per independently verified paid subscription (including renewals).
-- Pre-existing rows retain their historical rates; no backfill or rewrite.
create or replace function public.credit_affiliate_subscription_v2(
  p_tenant_id uuid, p_payment_proof_id uuid
) returns boolean
language plpgsql security definer set search_path = ''
as $function$
declare
  v_amount numeric(14,2);
  v_currency text;
  v_aff uuid;
  v_gross numeric(14,2);
  v_inserted uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using errcode='42501',message='Service role only.';
  end if;
  select proof.amount,proof.currency into v_amount,v_currency
    from public.tenant_payment_proofs proof
    where proof.id=p_payment_proof_id and proof.tenant_id=p_tenant_id
      and proof.status='approved' and proof.amount>0;
  if not found or upper(coalesce(v_currency,'TZS')) not in ('TZS','TSH') then return false; end if;
  if not exists(select 1 from public.tenant_subscription_renewals r
    where r.tenant_id=p_tenant_id and r.payment_proof_id=p_payment_proof_id
      and r.renewal_source='payment_approval') then return false; end if;
  select coalesce(t.registered_via_affiliate_id,
    (select s.affiliate_id from public.subscriber_source_tracking s
     where s.tenant_id=p_tenant_id and s.affiliate_id is not null
     order by s.created_at limit 1))
    into v_aff from public.tenants t where t.id=p_tenant_id;
  if v_aff is null or not exists(select 1 from public.affiliates a where a.id=v_aff
    and a.status='active' and not coalesce(a.is_disabled,false)) then return false; end if;
  v_gross:=round(v_amount*0.10,2);
  if v_gross<=0 then return false; end if;
  insert into public.affiliate_reward_entries(
    affiliate_id,tenant_id,source_key,reward_type,gross_amount,source_revenue,withholding_tax,net_amount,source_reference
  ) values (v_aff,p_tenant_id,'payment:'||p_payment_proof_id::text,'subscription_commission',
      v_gross,v_amount,0,v_gross,p_payment_proof_id::text)
  on conflict(source_key) do nothing returning id into v_inserted;
  if v_inserted is not null then
    -- Legacy first-payment summaries remain numerically consistent with V2.
    -- Never rewrite previously approved or paid historical rows.
    update public.referred_customers set
      amount_paid=v_amount,payment_status='paid',
      commission_status='approved',commission_amount=v_gross,
      package_price=v_amount
      where customer_id=p_tenant_id::text and payment_status='pending';
    update public.commission_ledger set
      revenue_amount=v_amount,network_pool_20=round(v_amount*0.15,2),
      manager_commission_5=round(v_amount*0.05,2),
      sub_affiliate_gross_commission_15=v_gross,
      withholding_tax_amount=0,withholding_status='not_active',
      sub_affiliate_net_payout=v_gross,status='approved',approved_at=now()
      where customer_id=p_tenant_id::text and status='pending';
  end if;
  return v_inserted is not null;
end;
$function$;
revoke all on function public.credit_affiliate_subscription_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.credit_affiliate_subscription_v2(uuid,uuid) to service_role;

-- One atomic withdrawal request on the last Friday (Tanzania local date).
-- Server-side selected full available balance; no trust in a client-supplied sum.
create or replace function public.request_affiliate_month_end_withdrawal_v2(
  p_recipient_name text, p_recipient_phone text, p_provider text
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_aff public.affiliates%rowtype;
  v_today date := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_month_end date;
  v_last_friday date;
  v_bonus numeric(14,2);
  v_commission numeric(14,2);
  v_gross numeric(14,2);
  v_fee numeric(14,2);
  v_net numeric(14,2);
  v_payout_id uuid;
  v_phone text := regexp_replace(coalesce(p_recipient_phone,''),'[^0-9+]','','g');
  v_provider text := lower(btrim(coalesce(p_provider,'')));
begin
  if (select auth.uid()) is null then raise exception using errcode='42501',message='Login required.'; end if;
  select * into v_aff from public.affiliates where user_id=(select auth.uid()) for update;
  if not found or v_aff.status<>'active' or coalesce(v_aff.is_disabled,false) then
    raise exception using errcode='42501',message='Affiliate account is not active.';
  end if;
  -- The wallet provider comes from the verified affiliate profile, not
  -- from an arbitrary request claiming the zero-fee AzamPesa channel.
  if v_provider <> lower(btrim(coalesce(v_aff.payout_method,''))) then
    raise exception using errcode='22023',message='Payout provider does not match the saved affiliate account.';
  end if;
  v_month_end:=(date_trunc('month',v_today::timestamp)+interval '1 month - 1 day')::date;
  v_last_friday:=v_month_end-((extract(dow from v_month_end)::int-5+7)%7);
  if v_today<>v_last_friday then
    raise exception using errcode='22023',message='Withdrawal is available only on the last Friday of the month (Tanzania time).';
  end if;
  if length(v_phone)<10 or length(v_phone)>16 or length(btrim(coalesce(p_recipient_name,'')))<2 then
    raise exception using errcode='22023',message='A valid payee name and phone number are required.';
  end if;
  if exists(select 1 from public.affiliate_payouts where affiliate_id=v_aff.id and payout_month=date_trunc('month',v_today::timestamp)::date) then
    raise exception using errcode='23505',message='Only one withdrawal request is allowed per month.';
  end if;
  select coalesce(sum(net_amount) filter(where reward_type='registration_bonus'),0),
         coalesce(sum(net_amount) filter(where reward_type='subscription_commission'),0)
    into v_bonus,v_commission from public.affiliate_reward_entries
    where affiliate_id=v_aff.id and status='available';
  v_gross:=v_bonus+v_commission;
  if v_gross<10000 then
    raise exception using errcode='22023',message='Minimum withdrawal balance is TZS 10,000.';
  end if;
  v_fee:=case when v_provider in ('azampesa','azam pesa','azam-pesa') then 0 else 200 end;
  v_net:=v_gross-v_fee;
  insert into public.affiliate_payouts(
    affiliate_id,amount,net_payout,currency,payout_method,payout_reference,payout_phone,
    payout_provider,status,requested_at,notes,account_type,payout_month,provider_fee_tzs,
    registration_component,commission_component,gross_commission,withholding_tax
  ) values (
    v_aff.id,v_gross,v_net,'TZS','AzamPay',v_phone,v_phone,v_provider,'requested',now(),
    'Affiliate V2: awaiting admin approval and verified AzamPay disbursement.',
    case when v_aff.affiliate_type='sub_affiliate' then 'sub_affiliate' else 'organic_affiliate' end,
    date_trunc('month',v_today::timestamp)::date,v_fee,v_bonus,v_commission,v_gross,0
  ) returning id into v_payout_id;
  update public.affiliate_reward_entries
    set payout_id=v_payout_id,status='reserved'
    where affiliate_id=v_aff.id and status='available';
  return jsonb_build_object('payoutId',v_payout_id,'gross',v_gross,'bonus',v_bonus,
    'commission',v_commission,'providerFee',v_fee,'net',v_net,
    'status','requested','payoutDate',v_today);
end;
$function$;
revoke all on function public.request_affiliate_month_end_withdrawal_v2(text,text,text) from public,anon;
grant execute on function public.request_affiliate_month_end_withdrawal_v2(text,text,text) to authenticated;

create or replace function private.sync_affiliate_reward_payout_status_v2()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if old.payout_month is null or old.status=new.status then return new; end if;
  if new.status='paid' then
    update public.affiliate_reward_entries set status='paid',paid_at=now()
     where payout_id=new.id and status='reserved';
  elsif new.status in ('rejected','cancelled') then
    update public.affiliate_reward_entries set status='available',payout_id=null
     where payout_id=new.id and status='reserved';
  end if;
  return new;
end;
$function$;
drop trigger if exists sync_affiliate_reward_payout_status_v2 on public.affiliate_payouts;
create trigger sync_affiliate_reward_payout_status_v2
after update of status on public.affiliate_payouts
for each row execute function private.sync_affiliate_reward_payout_status_v2();

commit;
