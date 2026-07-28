begin;

-- Authoritative package activation. All timestamps are derived inside one
-- database transaction so browser clocks and partial multi-request updates
-- cannot create conflicting entitlement dates.
create or replace function public.activate_tenant_package_period(
  p_tenant_id uuid,
  p_package_id text,
  p_duration_days integer,
  p_reason text,
  p_enable_branches boolean default false,
  p_payment_proof_id uuid default null
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
  v_end_at timestamptz;
  v_additional_slots integer := 0;
  v_tenant jsonb;
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
  if v_reason is null then
    raise exception using errcode = '22023', message = 'An administrator reason is required.';
  end if;

  perform 1
  from public.tenants as tenant
  where tenant.id = p_tenant_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Tenant was not found.';
  end if;

  v_end_at := v_now + make_interval(days => p_duration_days);

  update public.tenants as tenant
  set subscription_plan = v_package_id,
      selected_package_id = v_package_id,
      active_package_id = v_package_id,
      subscription_status = 'active',
      subscription_start_date = v_now,
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
    tenant_id,
    feature_enabled,
    additional_branch_slots,
    grant_reason,
    granted_by,
    granted_at,
    updated_at
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
    actor_user_id,
    target_tenant_id,
    action,
    metadata
  ) values (
    v_actor_id,
    p_tenant_id,
    'tenant_package_activated',
    jsonb_build_object(
      'packageId', v_package_id,
      'durationDays', p_duration_days,
      'startAt', v_now,
      'endAt', v_end_at,
      'branchesEnabled', v_package_id = 'tanzanite' and coalesce(p_enable_branches, false),
      'paymentProofId', p_payment_proof_id,
      'reason', v_reason
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
    'tenant', v_tenant,
    'serverNow', v_now,
    'startAt', v_now,
    'endAt', v_end_at,
    'durationDays', p_duration_days,
    'branchesEnabled', v_package_id = 'tanzanite' and coalesce(p_enable_branches, false),
    'additionalGrantedSlots', coalesce(v_additional_slots, 0)
  );
end;
$$;

revoke all on function public.activate_tenant_package_period(uuid, text, integer, text, boolean, uuid)
  from public, anon;
grant execute on function public.activate_tenant_package_period(uuid, text, integer, text, boolean, uuid)
  to authenticated;

create or replace function public.get_current_subscription_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_now timestamptz := statement_timestamp();
  v_tenant public.tenants%rowtype;
  v_remaining_seconds numeric;
begin
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  select tenant.*
  into v_tenant
  from public.tenants as tenant
  where tenant.id = v_tenant_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Tenant was not found.';
  end if;

  v_remaining_seconds := greatest(
    0,
    extract(epoch from (coalesce(v_tenant.subscription_end_date, v_now) - v_now))
  );

  return jsonb_build_object(
    'planId', private.normalized_tenant_package_id(v_tenant_id),
    'status', v_tenant.subscription_status,
    'startAt', v_tenant.subscription_start_date,
    'endAt', v_tenant.subscription_end_date,
    'serverNow', v_now,
    'remainingSeconds', v_remaining_seconds,
    'remainingDays', case
      when v_tenant.subscription_end_date is null then 0
      else ceil(v_remaining_seconds / 86400.0)::integer
    end,
    'isCurrent', private.is_tenant_subscription_current(v_tenant_id)
  );
end;
$$;

revoke all on function public.get_current_subscription_status() from public, anon;
grant execute on function public.get_current_subscription_status() to authenticated;

commit;
