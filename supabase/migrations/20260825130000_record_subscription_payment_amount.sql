-- Record the real amount paid for a subscription renewal, so genuinely
-- paid activations can be distinguished from free admin grants in revenue
-- reporting. The amount is read server-side from the payment proof itself
-- (never accepted as a raw parameter), so it cannot be spoofed by the
-- client. Free/emergency grants (p_payment_proof_id is null) always leave
-- amount_paid null -- they must never appear in revenue figures.

begin;

alter table public.tenant_subscription_renewals
  add column if not exists amount_paid numeric(14, 2),
  add column if not exists currency text;

create or replace function public.activate_tenant_package_period(
  p_tenant_id uuid,
  p_package_id text,
  p_duration_days integer,
  p_reason text,
  p_enable_branches boolean,
  p_payment_proof_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_now timestamptz := transaction_timestamp();
  v_package_id text := lower(nullif(btrim(p_package_id), ''));
  v_reason text := nullif(btrim(p_reason), '');
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_current public.tenants%rowtype;
  v_existing public.tenant_subscription_renewals%rowtype;
  v_previous_end_at timestamptz;
  v_base_at timestamptz;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_additional_slots integer := 0;
  v_tenant jsonb;
  v_amount_paid numeric(14, 2);
  v_currency text;
begin
  if v_actor_id is null or not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform administrator access is required.';
  end if;
  if v_package_id not in ('ruby', 'diamond', 'tanzanite') then
    raise exception using errcode = '22023', message = 'Ruby, Diamond, or Tanzanite package is required.';
  end if;
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 366 then
    raise exception using errcode = '22023', message = 'Package duration must be between 1 and 366 days.';
  end if;
  if v_reason is null or v_idempotency_key is null then
    raise exception using errcode = '22023', message = 'A reason and idempotency key are required.';
  end if;

  select renewal.*
  into v_existing
  from public.tenant_subscription_renewals as renewal
  where renewal.tenant_id = p_tenant_id
    and renewal.idempotency_key = v_idempotency_key;
  if found then
    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'renewalId', v_existing.id,
      'startAt', v_existing.base_at,
      'previousEndAt', v_existing.previous_end_at,
      'endAt', v_existing.new_end_at,
      'durationDays', v_existing.duration_days
    );
  end if;

  select tenant.*
  into v_current
  from public.tenants as tenant
  where tenant.id = p_tenant_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Tenant was not found.';
  end if;

  -- Recheck after obtaining the tenant lock. This closes the race between two
  -- tabs or duplicate callbacks that arrived before the first transaction committed.
  select renewal.*
  into v_existing
  from public.tenant_subscription_renewals as renewal
  where renewal.tenant_id = p_tenant_id
    and renewal.idempotency_key = v_idempotency_key;
  if found then
    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'renewalId', v_existing.id,
      'startAt', v_existing.base_at,
      'previousEndAt', v_existing.previous_end_at,
      'endAt', v_existing.new_end_at,
      'durationDays', v_existing.duration_days
    );
  end if;

  if p_payment_proof_id is not null then
    select proof.amount, proof.currency
    into v_amount_paid, v_currency
    from public.tenant_payment_proofs as proof
    where proof.id = p_payment_proof_id
      and proof.tenant_id = p_tenant_id
      and proof.status = 'pending'
    for update;
    if not found then
      raise exception using
        errcode = '22023',
        message = 'The payment proof is not pending for the selected tenant.';
    end if;
  end if;

  v_previous_end_at := v_current.subscription_end_date;
  if lower(coalesce(v_current.active_package_id, v_current.subscription_plan, '')) = v_package_id
    and v_current.subscription_status = 'active'
    and v_current.subscription_end_date > v_now
  then
    v_base_at := v_current.subscription_end_date;
    v_start_at := coalesce(v_current.subscription_start_date, v_now);
  else
    v_base_at := v_now;
    v_start_at := v_now;
  end if;
  v_end_at := v_base_at + make_interval(days => p_duration_days);

  insert into public.tenant_subscription_renewals (
    tenant_id,
    package_id,
    duration_days,
    previous_end_at,
    base_at,
    new_end_at,
    renewal_source,
    idempotency_key,
    payment_proof_id,
    reason,
    granted_by,
    created_at,
    amount_paid,
    currency
  ) values (
    p_tenant_id,
    v_package_id,
    p_duration_days,
    v_previous_end_at,
    v_base_at,
    v_end_at,
    case when p_payment_proof_id is null then 'super_admin_grant' else 'payment_approval' end,
    v_idempotency_key,
    p_payment_proof_id,
    v_reason,
    v_actor_id,
    v_now,
    v_amount_paid,
    v_currency
  )
  returning * into v_existing;

  update public.tenants as tenant
  set subscription_plan = v_package_id,
      selected_package_id = v_package_id,
      active_package_id = v_package_id,
      subscription_status = 'active',
      subscription_start_date = v_start_at,
      subscription_end_date = v_end_at,
      package_updated_at = v_now,
      package_change_type = case
        when p_payment_proof_id is null then 'super_admin_grant'
        else 'payment_approved'
      end,
      package_change_note = v_reason
  where tenant.id = p_tenant_id;

  select greatest(0, coalesce(entitlement.additional_branch_slots, 0))
  into v_additional_slots
  from public.tenant_branch_entitlements as entitlement
  where entitlement.tenant_id = p_tenant_id;

  insert into public.tenant_branch_entitlements (
    tenant_id, feature_enabled, additional_branch_slots, grant_reason,
    granted_by, granted_at, updated_at
  ) values (
    p_tenant_id,
    v_package_id = 'tanzanite' and coalesce(p_enable_branches, false),
    coalesce(v_additional_slots, 0),
    v_reason,
    v_actor_id,
    v_now,
    v_now
  )
  on conflict (tenant_id) do update
  set feature_enabled = excluded.feature_enabled,
      additional_branch_slots = greatest(
        0,
        public.tenant_branch_entitlements.additional_branch_slots
      ),
      grant_reason = excluded.grant_reason,
      granted_by = excluded.granted_by,
      granted_at = excluded.granted_at,
      updated_at = excluded.updated_at;

  if p_payment_proof_id is not null then
    update public.tenant_payment_proofs as proof
    set status = 'approved',
        admin_note = v_reason,
        reviewed_by = v_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    where proof.id = p_payment_proof_id
      and proof.tenant_id = p_tenant_id
      and proof.status = 'pending';
  end if;

  insert into public.super_admin_audit_logs (
    actor_user_id, target_tenant_id, action, metadata
  ) values (
    v_actor_id,
    p_tenant_id,
    'tenant_package_renewed',
    jsonb_build_object(
      'renewalId', v_existing.id,
      'packageId', v_package_id,
      'durationDays', p_duration_days,
      'previousEndAt', v_previous_end_at,
      'baseAt', v_base_at,
      'newEndAt', v_end_at,
      'idempotencyKey', v_idempotency_key,
      'paymentProofId', p_payment_proof_id,
      'amountPaid', v_amount_paid,
      'currency', v_currency
    )
  );

  select jsonb_build_object(
    'id', tenant.id,
    'name', tenant.name,
    'subscription_plan', tenant.subscription_plan,
    'selected_package_id', tenant.selected_package_id,
    'active_package_id', tenant.active_package_id,
    'subscription_status', tenant.subscription_status,
    'subscription_start_date', tenant.subscription_start_date,
    'subscription_end_date', tenant.subscription_end_date
  )
  into v_tenant
  from public.tenants as tenant
  where tenant.id = p_tenant_id;

  return jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'renewalId', v_existing.id,
    'tenant', v_tenant,
    'serverNow', v_now,
    'startAt', v_start_at,
    'previousEndAt', v_previous_end_at,
    'baseAt', v_base_at,
    'endAt', v_end_at,
    'durationDays', p_duration_days,
    'branchesEnabled', v_package_id = 'tanzanite' and coalesce(p_enable_branches, false),
    'additionalGrantedSlots', coalesce(v_additional_slots, 0),
    'amountPaid', v_amount_paid,
    'currency', v_currency
  );
end;
$$;

revoke all on function public.activate_tenant_package_period(uuid, text, integer, text, boolean, uuid, text)
  from public, anon;
grant execute on function public.activate_tenant_package_period(uuid, text, integer, text, boolean, uuid, text)
  to authenticated;

commit;
