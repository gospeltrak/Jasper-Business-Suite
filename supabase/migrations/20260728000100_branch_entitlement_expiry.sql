-- Stage 1: derive Branch eligibility from the authoritative subscription period.
-- Function-only migration: no tenant rows or historical data are changed.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private.normalized_tenant_package_id(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case lower(coalesce(
    nullif(btrim(tenant.active_package_id), ''),
    nullif(btrim(tenant.selected_package_id), ''),
    nullif(btrim(tenant.subscription_plan), ''),
    ''
  ))
    when 'wholesale' then 'tanzanite'
    when 'premium' then 'tanzanite'
    when 'jasper' then 'tanzanite'
    when 'business' then 'diamond'
    when 'standard business' then 'diamond'
    when 'standard' then 'diamond'
    when 'essential' then 'ruby'
    when 'basic' then 'ruby'
    else lower(coalesce(
      nullif(btrim(tenant.active_package_id), ''),
      nullif(btrim(tenant.selected_package_id), ''),
      nullif(btrim(tenant.subscription_plan), ''),
      ''
    ))
  end
  from public.tenants as tenant
  where tenant.id = p_tenant_id;
$$;

create or replace function private.is_tenant_subscription_current(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select tenant.subscription_status = 'active'
        and tenant.subscription_end_date is not null
        and tenant.subscription_end_date > now()
      from public.tenants as tenant
      where tenant.id = p_tenant_id
    ),
    false
  );
$$;

create or replace function private.effective_branch_limit(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.normalized_tenant_package_id(p_tenant_id) = 'tanzanite'
      and private.is_tenant_subscription_current(p_tenant_id)
    then 2 + coalesce(entitlement.additional_branch_slots, 0)
    else 1
  end
  from public.tenants as tenant
  left join public.tenant_branch_entitlements as entitlement
    on entitlement.tenant_id = tenant.id
  where tenant.id = p_tenant_id;
$$;

create or replace function private.can_operate_additional_branches(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.is_multibranch_globally_enabled()
    and private.normalized_tenant_package_id(p_tenant_id) = 'tanzanite'
    and private.is_tenant_subscription_current(p_tenant_id)
    and entitlement.feature_enabled,
    false
  )
  from public.tenants as tenant
  left join public.tenant_branch_entitlements as entitlement
    on entitlement.tenant_id = tenant.id
  where tenant.id = p_tenant_id;
$$;

create or replace function public.get_current_branch_entitlement()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_package_id text;
  v_subscription_status text;
  v_subscription_end_at timestamptz;
  v_subscription_current boolean := false;
  v_additional_slots integer := 0;
  v_tenant_enabled boolean := false;
  v_current_branch_count integer := 0;
  v_effective_limit integer := 1;
  v_global_enabled boolean := false;
  v_can_operate boolean := false;
  v_can_manage boolean := false;
begin
  select app_user.tenant_id
  into v_tenant_id
  from public.users as app_user
  where app_user.id = (select auth.uid())
    and app_user.is_active
  limit 1;

  if v_tenant_id is null then
    raise exception 'An active tenant account is required.'
      using errcode = '42501';
  end if;

  select
    private.normalized_tenant_package_id(v_tenant_id),
    tenant.subscription_status,
    tenant.subscription_end_date,
    coalesce(entitlement.additional_branch_slots, 0),
    coalesce(entitlement.feature_enabled, false)
  into
    v_package_id,
    v_subscription_status,
    v_subscription_end_at,
    v_additional_slots,
    v_tenant_enabled
  from public.tenants as tenant
  left join public.tenant_branch_entitlements as entitlement
    on entitlement.tenant_id = tenant.id
  where tenant.id = v_tenant_id;

  select count(*)::integer
  into v_current_branch_count
  from public.branches as branch
  where branch.tenant_id = v_tenant_id
    and branch.archived_at is null;

  v_subscription_current := private.is_tenant_subscription_current(v_tenant_id);
  v_global_enabled := private.is_multibranch_globally_enabled();
  v_effective_limit := coalesce(private.effective_branch_limit(v_tenant_id), 1);
  v_can_operate := coalesce(private.can_operate_additional_branches(v_tenant_id), false);
  v_can_manage := coalesce(private.is_tenant_branch_administrator(v_tenant_id), false);

  return jsonb_build_object(
    'tenantId', v_tenant_id,
    'packageId', nullif(v_package_id, ''),
    'subscriptionStatus', v_subscription_status,
    'subscriptionEndAt', v_subscription_end_at,
    'subscriptionCurrent', v_subscription_current,
    'globalFeatureEnabled', v_global_enabled,
    'tenantFeatureEnabled', v_tenant_enabled,
    'defaultTotalBranches',
      case when v_package_id = 'tanzanite' and v_subscription_current then 2 else 1 end,
    'additionalGrantedSlots', v_additional_slots,
    'effectiveTotalBranches', v_effective_limit,
    'currentPhysicalBranchCount', v_current_branch_count,
    'canOperateAdditionalBranches', v_can_operate,
    'canManageBranches', v_can_manage,
    'usesCompatibilityPrimary', v_current_branch_count = 0
  );
end;
$$;

revoke all on function private.normalized_tenant_package_id(uuid) from public;
revoke all on function private.is_tenant_subscription_current(uuid) from public;
revoke all on function private.effective_branch_limit(uuid) from public;
revoke all on function private.can_operate_additional_branches(uuid) from public;
revoke all on function public.get_current_branch_entitlement() from public;
grant execute on function public.get_current_branch_entitlement() to authenticated;

commit;
