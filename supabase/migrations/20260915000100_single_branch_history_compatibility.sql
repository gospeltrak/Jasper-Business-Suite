-- Preserve legacy history visibility for tenants with exactly one physical branch.
-- Legacy rows may have a null branch_id because they predate branch activation.

begin;

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
  v_default_name text;
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

  select tenant.name, tenant.city, tenant.country
  into v_tenant_name, v_city, v_country
  from public.tenants as tenant
  where tenant.id = v_tenant_id;

  select count(*)::integer
  into v_physical_count
  from public.branches as branch
  where branch.tenant_id = v_tenant_id
    and branch.archived_at is null;

  select preference.active_branch_id, preference.active_scope
  into v_active_branch_id, v_active_scope
  from public.branch_user_preferences as preference
  where preference.tenant_id = v_tenant_id
    and preference.user_id = v_actor_id;

  if v_physical_count = 0 then
    v_default_name := coalesce(nullif(btrim(v_tenant_name), ''), 'Business');

    v_branches := jsonb_build_array(
      jsonb_build_object(
        'id', null,
        'tenantId', v_tenant_id,
        'branchName', v_default_name,
        'branchCode', 'PRIMARY',
        'businessName', v_default_name,
        'city', v_city,
        'country', v_country,
        'status', 'active',
        'isDefault', true,
        'isLocked', false,
        'isCompatibilityPrimary', true,
        'isPhysical', false,
        'includesUnassignedHistoricalRecords', true,
        'isSelected', true,
        'canWrite', true,
        'logoLightUrl', null,
        'logoDarkUrl', null
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
        'includesUnassignedHistoricalRecords', branch.is_default or v_physical_count = 1,
        'isSelected', branch.id = v_active_branch_id,
        'canWrite', private.can_write_branch(
          v_tenant_id,
          branch.id,
          'branches.manage'
        ),
        'logoLightUrl', branch.logo_light_url,
        'logoDarkUrl', branch.logo_dark_url
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
