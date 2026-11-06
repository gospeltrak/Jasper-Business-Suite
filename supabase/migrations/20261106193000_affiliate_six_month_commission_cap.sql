-- Orvix Affiliate V2: commission only for the first six paid monthly billing cycles
-- AND only inside the first six elapsed calendar months of a referred tenant.
-- Preserves existing affiliate_reward_entries, approved payouts, referral bonuses,
-- existing tenant data and the existing idempotent payment proof source key.
-- No backfills, deletes, or edits to existing financial entries.
begin;

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
  v_cycle_start timestamptz;
  v_first_cycle_start timestamptz;
  v_cycle_number bigint;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using errcode='42501',message='Service role only.';
  end if;
  select proof.amount,proof.currency into v_amount,v_currency
    from public.tenant_payment_proofs proof
    where proof.id=p_payment_proof_id and proof.tenant_id=p_tenant_id
      and proof.status='approved' and proof.amount>0;
  if not found or upper(coalesce(v_currency,'TZS')) not in ('TZS','TSH') then return false; end if;
  -- Serialize competing payment approvals for the same tenant.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,43));
  -- Rank verified, paid monthly subscription cycles across the tenant's ENTIRE
  -- history (not merely the six latest renewals or the six newest V2 rewards).
  -- This means rejoining, changing an affiliate, or retrying cannot restart
  -- the six-month clock or award a seventh paid billing cycle.
  with approved_cycles as (
    select distinct on (r.payment_proof_id)
      r.payment_proof_id,
      coalesce(r.base_at,r.created_at) as cycle_start,
      r.created_at as recorded_at,
      r.id
    from public.tenant_subscription_renewals r
    join public.tenant_payment_proofs proof
      on proof.id=r.payment_proof_id and proof.tenant_id=r.tenant_id
    where r.tenant_id=p_tenant_id
      and r.renewal_source='payment_approval'
      and proof.status='approved' and proof.amount>0
      and upper(coalesce(proof.currency,'TZS')) in ('TZS','TSH')
    order by r.payment_proof_id, coalesce(r.base_at,r.created_at), r.created_at, r.id
  ), ranked_cycles as (
    select payment_proof_id, cycle_start,
      min(cycle_start) over () as first_cycle_start,
      row_number() over (order by cycle_start, recorded_at, id) as cycle_number
    from approved_cycles
  )
  select cycle_start,first_cycle_start,cycle_number
    into v_cycle_start,v_first_cycle_start,v_cycle_number
    from ranked_cycles where payment_proof_id=p_payment_proof_id;
  -- Both boundaries matter: no more than six paid billing cycles, and no
  -- payments outside the first six elapsed calendar months. Even prepaid
  -- consecutive 30-day cycles cannot create a seventh reward.
  if not found or v_cycle_number > 6
    or v_cycle_start >= v_first_cycle_start + interval '6 months' then
    return false;
  end if;
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

commit;
