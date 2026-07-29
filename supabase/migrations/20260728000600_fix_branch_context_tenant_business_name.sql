-- Migration-history record of the already-applied fix for
-- list_current_user_branches() and ensure_physical_primary_branch().
-- (introduced in 20260722000700_multibranch_primary_compatibility_rpcs.sql)
-- reference tenant.business_name, a column that only exists on
-- public.branches, not on public.tenants. Every call raised Postgres error
-- 42703 (undefined column), which the API's error classifier does not
-- recognize, surfacing as a generic 500 "Branch request could not be
-- completed." on both /api/branches and /api/branches/context.
--
-- Repair: stop reading the nonexistent tenant.business_name column and use
-- tenant.name directly, matching the fallback behavior these functions
-- already had. No schema change, no table change, no other function or
-- endpoint touched.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private.ensure_physical_primary_branch(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_activation_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primary_id uuid;
  v_existing_branch_count integer;
  v_tenant_name text;
  v_tenant_city text;
  v_tenant_country text;
  v_audit_id uuid;
begin
  if p_activation_source not in ('tenant_opt_in', 'new_tenant_provisioning') then
    raise exception 'Invalid Primary Branch activation source.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users as app_user
    where app_user.id = p_actor_user_id
      and app_user.tenant_id = p_tenant_id
      and app_user.is_active
  ) then
    raise exception 'Primary Branch actor must be an active tenant user.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('jasper_primary_branch'),
    hashtext(p_tenant_id::text)
  );

  select branch.id
  into v_primary_id
  from public.branches as branch
  where branch.tenant_id = p_tenant_id
    and branch.is_default
    and branch.archived_at is null
  order by branch.created_at, branch.id
  limit 1;

  if v_primary_id is not null then
    return v_primary_id;
  end if;

  select count(*)::integer
  into v_existing_branch_count
  from public.branches as branch
  where branch.tenant_id = p_tenant_id
    and branch.archived_at is null;

  if v_existing_branch_count > 0 then
    raise exception 'Tenant has branches but no Primary Branch; explicit branch selection is required.'
      using errcode = '23514';
  end if;

  select
    tenant.name,
    tenant.city,
    tenant.country
  into
    v_tenant_name,
    v_tenant_city,
    v_tenant_country
  from public.tenants as tenant
  where tenant.id = p_tenant_id;

  if not found then
    raise exception 'Tenant not found.' using errcode = 'P0002';
  end if;

  insert into public.branches (
    tenant_id,
    branch_name,
    branch_code,
    business_name,
    relationship_type,
    city,
    country,
    opening_date,
    manager_id,
    status,
    is_default,
    setup_status,
    setup_completed_at,
    created_by,
    metadata
  )
  values (
    p_tenant_id,
    'Primary Branch',
    'PRIMARY',
    coalesce(
      nullif(btrim(v_tenant_name), ''),
      'Business'
    ),
    'same_business',
    v_tenant_city,
    v_tenant_country,
    current_date,
    p_actor_user_id,
    'active',
    true,
    'complete',
    now(),
    p_actor_user_id,
    jsonb_build_object(
      'activationSource', p_activation_source,
      'compatibilityPrimary', true,
      'historicalRecordsRemainUnassigned', true
    )
  )
  returning id into v_primary_id;

  v_audit_id := private.append_branch_audit_event(
    p_tenant_id,
    v_primary_id,
    p_actor_user_id,
    'branch.primary_activated',
    'branch',
    v_primary_id::text,
    'database_rpc',
    null,
    'primary-branch-activation:' || p_tenant_id::text,
    null,
    jsonb_build_object(
      'branchId', v_primary_id,
      'isDefault', true,
      'status', 'active'
    ),
    jsonb_build_object(
      'activationSource', p_activation_source,
      'historicalRecordsRewritten', false
    )
  );

  perform private.enqueue_branch_notification(
    p_tenant_id,
    v_primary_id,
    v_audit_id,
    p_actor_user_id,
    'branch_created',
    'Primary Branch ready',
    'Your Primary Branch is ready. Existing business records remain unchanged.',
    'branch',
    v_primary_id::text,
    'normal',
    'primary-branch-notification:' || p_tenant_id::text,
    jsonb_build_object(
      'moduleName', 'branches',
      'branchId', v_primary_id,
      'compatibilityPrimary', true
    ),
    array[p_actor_user_id]
  );

  return v_primary_id;
end;
$$;

create or replace function public.list_current_user_branches()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid := (select auth.uid());
  v_tenant_name text;
  v_city text;
  v_country text;
  v_physical_count integer;
  v_branches jsonb;
  v_active_branch_id uuid;
  v_active_scope text;
begin
  select app_user.tenant_id
  into v_tenant_id
  from public.users as app_user
  where app_user.id = v_actor_id
    and app_user.is_active
  limit 1;

  if v_tenant_id is null then
    raise exception 'An active tenant account is required.'
      using errcode = '42501';
  end if;

  select
    tenant.name,
    tenant.city,
    tenant.country
  into v_tenant_name, v_city, v_country
  from public.tenants as tenant
  where tenant.id = v_tenant_id;

  select count(*)::integer
  into v_physical_count
  from public.branches as branch
  where branch.tenant_id = v_tenant_id
    and branch.archived_at is null;

  select
    preference.active_branch_id,
    preference.active_scope
  into v_active_branch_id, v_active_scope
  from public.branch_user_preferences as preference
  where preference.tenant_id = v_tenant_id
    and preference.user_id = v_actor_id;

  if v_physical_count = 0 then
    v_branches := jsonb_build_array(
      jsonb_build_object(
        'id', null,
        'tenantId', v_tenant_id,
        'branchName', 'Primary Branch',
        'branchCode', 'PRIMARY',
        'businessName', coalesce(
          nullif(btrim(v_tenant_name), ''),
          'Business'
        ),
        'city', v_city,
        'country', v_country,
        'status', 'active',
        'isDefault', true,
        'isLocked', false,
        'isCompatibilityPrimary', true,
        'isPhysical', false,
        'includesUnassignedHistoricalRecords', true,
        'isSelected', true,
        'canWrite', true
      )
    );

    return jsonb_build_object(
      'tenantId', v_tenant_id,
      'usesCompatibilityPrimary', true,
      'physicalBranchCount', 0,
      'activeScope', 'compatibility_primary',
      'activeBranchId', null,
      'canViewAllBranches', private.can_view_consolidated_branches(v_tenant_id),
      'branches', v_branches
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', branch.id,
        'tenantId', branch.tenant_id,
        'branchName', branch.branch_name,
        'branchCode', branch.branch_code,
        'businessName', coalesce(branch.business_name, branch.branch_name),
        'address', branch.address,
        'city', branch.city,
        'region', branch.region,
        'district', branch.district,
        'country', branch.country,
        'status', branch.status,
        'isDefault', branch.is_default,
        'isLocked', branch.is_locked,
        'lockReason', branch.lock_reason,
        'relationshipType', branch.relationship_type,
        'setupStatus', branch.setup_status,
        'isCompatibilityPrimary', branch.is_default,
        'isPhysical', true,
        'includesUnassignedHistoricalRecords', branch.is_default,
        'isSelected', branch.id = v_active_branch_id,
        'canWrite', private.can_write_branch(
          v_tenant_id,
          branch.id,
          'branches.manage'
        )
      )
      order by branch.is_default desc, branch.branch_name, branch.id
    ),
    '[]'::jsonb
  )
  into v_branches
  from public.branches as branch
  where branch.tenant_id = v_tenant_id
    and branch.archived_at is null
    and private.can_read_branch(v_tenant_id, branch.id);

  return jsonb_build_object(
    'tenantId', v_tenant_id,
    'usesCompatibilityPrimary', false,
    'physicalBranchCount', v_physical_count,
    'activeScope', coalesce(v_active_scope, 'branch'),
    'activeBranchId', v_active_branch_id,
    'canViewAllBranches', private.can_view_consolidated_branches(v_tenant_id),
    'branches', v_branches
  );
end;
$$;

commit;
