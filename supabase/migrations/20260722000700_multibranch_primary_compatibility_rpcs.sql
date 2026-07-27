-- Multi-branch Phase 4A: backward-compatible Primary Branch context, explicit
-- activation, secure branch selection, and capacity-controlled branch creation.
--
-- Safety properties:
--   * Existing tenants are not bulk-provisioned and no historical business row
--     receives a branch_id.
--   * A missing physical branch resolves to a virtual compatibility Primary
--     with branchId = NULL, matching all existing unassigned records.
--   * An existing tenant receives a physical Primary only after an explicit,
--     authorized activation call. New-tenant provisioning is service-role only.
--   * Additional creation is serialized per tenant and enforced against the
--     Tanzanite default of 2 total branches plus Super Admin granted slots.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.branch_user_preferences
  add column if not exists active_scope text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_user_preferences'::regclass
      and conname = 'branch_user_preferences_active_scope_check'
  ) then
    alter table public.branch_user_preferences
      add constraint branch_user_preferences_active_scope_check
      check (
        active_scope is null
        or active_scope in ('branch', 'all_branches', 'compatibility_primary')
      ) not valid;
  end if;
end;
$$;

-- Existing staff keep compatibility access to the Primary Branch. This avoids
-- cutting off users whose legacy tenant-wide workspace has no branch IDs and
-- whose branch assignment rows intentionally remain unbackfilled.
create or replace function private.is_branch_assigned(
  p_tenant_id uuid,
  p_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_tenant_branch_administrator(p_tenant_id)
    or exists (
      select 1
      from public.branches as primary_branch
      where primary_branch.tenant_id = p_tenant_id
        and primary_branch.id = p_branch_id
        and primary_branch.is_default
        and primary_branch.archived_at is null
        and private.is_active_tenant_member(p_tenant_id)
    )
    or exists (
      select 1
      from public.branches as branch
      where branch.tenant_id = p_tenant_id
        and branch.id = p_branch_id
        and branch.archived_at is null
        and branch.manager_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.branch_staff_access_profiles as profile
      where profile.tenant_id = p_tenant_id
        and profile.staff_id = (select auth.uid())
        and profile.status = 'active'
        and profile.access_scope = 'all_branches'
    )
    or exists (
      select 1
      from public.branch_staff_assignments as assignment
      where assignment.tenant_id = p_tenant_id
        and assignment.branch_id = p_branch_id
        and assignment.staff_id = (select auth.uid())
        and assignment.status = 'active'
        and (assignment.starts_at is null or assignment.starts_at <= now())
        and (assignment.ends_at is null or assignment.ends_at > now())
    );
$$;

create or replace function private.can_view_consolidated_branches(
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(private.can_operate_additional_branches(p_tenant_id), false)
    and (
      private.is_tenant_branch_administrator(p_tenant_id)
      or exists (
        select 1
        from public.branch_staff_access_profiles as profile
        where profile.tenant_id = p_tenant_id
          and profile.staff_id = (select auth.uid())
          and profile.status = 'active'
          and profile.access_scope = 'all_branches'
          and profile.can_view_consolidated
      )
    );
$$;

-- Internal provisioning primitive. It never rewrites or adopts an existing
-- non-default branch automatically because that choice requires tenant input.
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
  v_tenant_business_name text;
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
    tenant.business_name,
    tenant.city,
    tenant.country
  into
    v_tenant_name,
    v_tenant_business_name,
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
      nullif(btrim(v_tenant_business_name), ''),
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
  v_business_name text;
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
    tenant.business_name,
    tenant.city,
    tenant.country
  into v_tenant_name, v_business_name, v_city, v_country
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
          nullif(btrim(v_business_name), ''),
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

create or replace function public.get_current_branch_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_list jsonb;
  v_scope text;
  v_active_branch_id uuid;
  v_selected jsonb;
begin
  v_list := public.list_current_user_branches();
  v_scope := coalesce(v_list ->> 'activeScope', 'compatibility_primary');
  v_active_branch_id := nullif(v_list ->> 'activeBranchId', '')::uuid;

  if (v_list ->> 'usesCompatibilityPrimary')::boolean then
    v_selected := v_list -> 'branches' -> 0;
    return v_list || jsonb_build_object('selectedBranch', v_selected);
  end if;

  if v_scope = 'all_branches'
    and (v_list ->> 'canViewAllBranches')::boolean
  then
    return v_list || jsonb_build_object(
      'selectedBranch', null,
      'activeBranchId', null
    );
  end if;

  if v_active_branch_id is not null then
    select item
    into v_selected
    from jsonb_array_elements(v_list -> 'branches') as item
    where item ->> 'id' = v_active_branch_id::text
    limit 1;
  end if;

  if v_selected is null then
    select item
    into v_selected
    from jsonb_array_elements(v_list -> 'branches') as item
    order by (item ->> 'isDefault')::boolean desc, item ->> 'branchName'
    limit 1;
  end if;

  return v_list || jsonb_build_object(
    'activeScope', case when v_selected is null then 'no_branch_access' else 'branch' end,
    'activeBranchId', case when v_selected is null then null else v_selected -> 'id' end,
    'selectedBranch', v_selected
  );
end;
$$;

create or replace function public.select_current_branch(
  p_branch_id uuid,
  p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_scope text := lower(nullif(btrim(p_scope), ''));
  v_branch_id uuid := p_branch_id;
  v_recent uuid[];
  v_physical_count integer;
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

  if v_scope not in ('branch', 'all_branches', 'compatibility_primary') then
    raise exception 'Invalid branch selection scope.' using errcode = '22023';
  end if;

  select count(*)::integer
  into v_physical_count
  from public.branches as branch
  where branch.tenant_id = v_tenant_id
    and branch.archived_at is null;

  if v_scope = 'all_branches' then
    if not private.can_view_consolidated_branches(v_tenant_id) then
      raise exception 'All Branches access is not permitted.'
        using errcode = '42501';
    end if;
    v_branch_id := null;
  elsif v_scope = 'compatibility_primary' then
    if v_physical_count = 0 then
      v_branch_id := null;
    else
      select branch.id
      into v_branch_id
      from public.branches as branch
      where branch.tenant_id = v_tenant_id
        and branch.is_default
        and branch.archived_at is null
        and private.can_read_branch(v_tenant_id, branch.id)
      order by branch.created_at, branch.id
      limit 1;

      if v_branch_id is null then
        raise exception 'Physical Primary Branch is not accessible.'
          using errcode = '42501';
      end if;
      v_scope := 'branch';
    end if;
  else
    if v_branch_id is null
      or not private.can_read_branch(v_tenant_id, v_branch_id)
    then
      raise exception 'Selected branch is not accessible.'
        using errcode = '42501';
    end if;
  end if;

  select coalesce(preference.recent_branch_ids, '{}'::uuid[])
  into v_recent
  from public.branch_user_preferences as preference
  where preference.tenant_id = v_tenant_id
    and preference.user_id = v_actor_id;

  if v_branch_id is not null then
    v_recent := (
      array_prepend(
        v_branch_id,
        array_remove(coalesce(v_recent, '{}'::uuid[]), v_branch_id)
      )
    )[1:5];
  end if;

  insert into public.branch_user_preferences (
    tenant_id,
    user_id,
    active_branch_id,
    active_scope,
    recent_branch_ids,
    updated_at
  ) values (
    v_tenant_id,
    v_actor_id,
    v_branch_id,
    v_scope,
    coalesce(v_recent, '{}'::uuid[]),
    now()
  )
  on conflict (tenant_id, user_id) do update
  set active_branch_id = excluded.active_branch_id,
      active_scope = excluded.active_scope,
      recent_branch_ids = excluded.recent_branch_ids,
      updated_at = excluded.updated_at;

  return public.get_current_branch_context();
end;
$$;

create or replace function public.activate_current_tenant_primary_branch()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_primary_id uuid;
begin
  select app_user.tenant_id
  into v_tenant_id
  from public.users as app_user
  where app_user.id = v_actor_id
    and app_user.is_active
  limit 1;

  if v_tenant_id is null
    or not private.is_tenant_branch_administrator(v_tenant_id)
  then
    raise exception 'Only an active tenant administrator may activate Branches.'
      using errcode = '42501';
  end if;

  if not coalesce(
    private.can_operate_additional_branches(v_tenant_id),
    false
  ) then
    raise exception 'Branches requires enabled active Tanzanite access.'
      using errcode = '42501';
  end if;

  v_primary_id := private.ensure_physical_primary_branch(
    v_tenant_id,
    v_actor_id,
    'tenant_opt_in'
  );

  perform public.select_current_branch(v_primary_id, 'branch');
  return public.get_current_branch_context();
end;
$$;

-- Registration calls this only after both tenant and creator rows exist. It is
-- intentionally unavailable to browser roles and does not depend on package or
-- rollout state because every newly provisioned tenant needs one Primary.
create or replace function public.provision_primary_branch_for_new_tenant(
  p_tenant_id uuid,
  p_actor_user_id uuid
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.ensure_physical_primary_branch(
    p_tenant_id,
    p_actor_user_id,
    'new_tenant_provisioning'
  );
$$;

create or replace function public.create_current_tenant_branch(
  p_branch_name text,
  p_branch_code text,
  p_relationship_type text,
  p_business_name text,
  p_address text,
  p_city text,
  p_region text,
  p_district text,
  p_country text,
  p_phone text,
  p_email text,
  p_opening_date date,
  p_manager_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_branch_id uuid;
  v_branch_name text := nullif(btrim(p_branch_name), '');
  v_branch_code text;
  v_code_base text;
  v_code_suffix integer := 1;
  v_relationship_type text := lower(nullif(btrim(p_relationship_type), ''));
  v_current_count integer;
  v_effective_limit integer;
  v_audit_id uuid;
begin
  select app_user.tenant_id
  into v_tenant_id
  from public.users as app_user
  where app_user.id = v_actor_id
    and app_user.is_active
  limit 1;

  if v_tenant_id is null
    or not private.is_tenant_branch_administrator(v_tenant_id)
  then
    raise exception 'Only an active tenant administrator may create a branch.'
      using errcode = '42501';
  end if;

  if v_branch_name is null or char_length(v_branch_name) > 120 then
    raise exception 'Branch name is required and must be 120 characters or fewer.'
      using errcode = '22023';
  end if;

  if v_relationship_type not in ('same_business', 'independent_business') then
    raise exception 'A valid branch relationship type is required.'
      using errcode = '22023';
  end if;

  if char_length(coalesce(btrim(p_business_name), '')) > 160
    or char_length(coalesce(btrim(p_address), '')) > 500
    or char_length(coalesce(btrim(p_city), '')) > 100
    or char_length(coalesce(btrim(p_region), '')) > 100
    or char_length(coalesce(btrim(p_district), '')) > 100
    or char_length(coalesce(btrim(p_country), '')) > 100
    or char_length(coalesce(btrim(p_phone), '')) > 40
    or char_length(coalesce(btrim(p_email), '')) > 254
  then
    raise exception 'One or more branch details exceed the allowed length.'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_email), '') is not null
    and lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'A valid branch email address is required.'
      using errcode = '22023';
  end if;

  if not coalesce(private.can_operate_additional_branches(v_tenant_id), false) then
    raise exception 'Additional branches require enabled active Tanzanite access.'
      using errcode = '42501';
  end if;

  if p_manager_id is not null and not exists (
    select 1
    from public.users as manager
    where manager.id = p_manager_id
      and manager.tenant_id = v_tenant_id
      and manager.is_active
  ) then
    raise exception 'Branch manager must be an active user in this tenant.'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('jasper_branch_capacity'),
    hashtext(v_tenant_id::text)
  );

  -- Synchronize with Super Admin capacity changes, which lock the same tenant
  -- row before modifying the entitlement.
  perform 1
  from public.tenants as tenant
  where tenant.id = v_tenant_id
  for update;

  if not coalesce(private.can_operate_additional_branches(v_tenant_id), false) then
    raise exception 'Additional branches require enabled active Tanzanite access.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.branches as primary_branch
    where primary_branch.tenant_id = v_tenant_id
      and primary_branch.is_default
      and primary_branch.archived_at is null
  ) then
    raise exception 'Activate the Primary Branch before adding another branch.'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into v_current_count
  from public.branches as branch
  where branch.tenant_id = v_tenant_id
    and branch.archived_at is null;

  v_effective_limit := coalesce(
    private.effective_branch_limit(v_tenant_id),
    1
  );

  if v_current_count >= v_effective_limit then
    raise exception 'Branch capacity reached (% of %).',
      v_current_count,
      v_effective_limit
      using errcode = '23514';
  end if;

  if nullif(btrim(p_branch_code), '') is not null then
    v_branch_code := upper(btrim(p_branch_code));
    if v_branch_code !~ '^[A-Z0-9][A-Z0-9_-]{1,19}$' then
      raise exception 'Branch code must use 2-20 letters, numbers, hyphens, or underscores.'
        using errcode = '22023';
    end if;
  else
    v_code_base := upper(regexp_replace(v_branch_name, '[^a-zA-Z0-9]+', '', 'g'));
    v_code_base := substr(coalesce(nullif(v_code_base, ''), 'BRANCH'), 1, 12);
    v_branch_code := v_code_base;

    while exists (
      select 1
      from public.branches as branch
      where branch.tenant_id = v_tenant_id
        and branch.branch_code = v_branch_code
    ) loop
      v_code_suffix := v_code_suffix + 1;
      v_branch_code := substr(v_code_base, 1, 16 - char_length(v_code_suffix::text))
        || '-' || v_code_suffix::text;
    end loop;
  end if;

  if exists (
    select 1
    from public.branches as branch
    where branch.tenant_id = v_tenant_id
      and branch.branch_code = v_branch_code
  ) then
    raise exception 'Branch code already exists for this tenant.'
      using errcode = '23505';
  end if;

  insert into public.branches (
    tenant_id,
    branch_name,
    branch_code,
    business_name,
    relationship_type,
    address,
    city,
    region,
    district,
    country,
    phone,
    email,
    opening_date,
    manager_id,
    status,
    is_default,
    setup_status,
    created_by,
    metadata
  ) values (
    v_tenant_id,
    v_branch_name,
    v_branch_code,
    coalesce(nullif(btrim(p_business_name), ''), v_branch_name),
    v_relationship_type,
    nullif(btrim(p_address), ''),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_region), ''),
    nullif(btrim(p_district), ''),
    nullif(btrim(p_country), ''),
    nullif(btrim(p_phone), ''),
    nullif(lower(btrim(p_email)), ''),
    p_opening_date,
    p_manager_id,
    'active',
    false,
    'draft',
    v_actor_id,
    jsonb_build_object(
      'createdThrough', 'branch_creation_wizard',
      'sharingConfigured', false
    )
  )
  returning id into v_branch_id;

  v_audit_id := private.append_branch_audit_event(
    v_tenant_id,
    v_branch_id,
    v_actor_id,
    'branch.created',
    'branch',
    v_branch_id::text,
    'database_rpc',
    null,
    'branch-created:' || v_branch_id::text,
    null,
    jsonb_build_object(
      'branchId', v_branch_id,
      'branchCode', v_branch_code,
      'relationshipType', v_relationship_type,
      'status', 'active'
    ),
    jsonb_build_object(
      'currentBranchCount', v_current_count + 1,
      'effectiveBranchLimit', v_effective_limit
    )
  );

  perform private.enqueue_branch_notification(
    v_tenant_id,
    v_branch_id,
    v_audit_id,
    v_actor_id,
    'branch_created',
    'Branch created',
    v_branch_name || ' has been created and is ready for setup.',
    'branch',
    v_branch_id::text,
    'normal',
    'branch-created-notification:' || v_branch_id::text,
    jsonb_build_object(
      'moduleName', 'branches',
      'branchId', v_branch_id,
      'branchCode', v_branch_code
    ),
    array[v_actor_id]
  );

  return jsonb_build_object(
    'id', v_branch_id,
    'tenantId', v_tenant_id,
    'branchName', v_branch_name,
    'branchCode', v_branch_code,
    'relationshipType', v_relationship_type,
    'status', 'active',
    'isDefault', false,
    'setupStatus', 'draft',
    'currentBranchCount', v_current_count + 1,
    'effectiveBranchLimit', v_effective_limit
  );
end;
$$;

-- Close the legacy tenant-wide write policy. Browser clients may read only the
-- branches they are assigned to; every branch mutation now goes through an
-- audited RPC. Existing application screens do not write this relational table.
drop policy if exists branches_tenant_access on public.branches;
drop policy if exists branches_scoped_read on public.branches;
create policy branches_scoped_read on public.branches
  for select
  to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.current_tenant_id())
      and (select private.can_read_branch(tenant_id, id))
    )
  );

revoke all on table public.branches from authenticated;
grant select on table public.branches to authenticated;

drop policy if exists branch_user_preferences_self_access
  on public.branch_user_preferences;
drop policy if exists branch_user_preferences_self_read
  on public.branch_user_preferences;
create policy branch_user_preferences_self_read
  on public.branch_user_preferences
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and tenant_id = (select private.current_tenant_id())
  );

revoke all on table public.branch_user_preferences from authenticated;
grant select on table public.branch_user_preferences to authenticated;

revoke all on function private.is_branch_assigned(uuid, uuid) from public;
revoke all on function private.can_view_consolidated_branches(uuid) from public;
revoke all on function private.ensure_physical_primary_branch(uuid, uuid, text)
  from public;

revoke all on function public.list_current_user_branches() from public;
revoke all on function public.get_current_branch_context() from public;
revoke all on function public.select_current_branch(uuid, text) from public;
revoke all on function public.activate_current_tenant_primary_branch()
  from public;
revoke all on function public.provision_primary_branch_for_new_tenant(uuid, uuid)
  from public;
revoke all on function public.create_current_tenant_branch(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  uuid
) from public;

grant execute on function public.list_current_user_branches()
  to authenticated;
grant execute on function public.get_current_branch_context()
  to authenticated;
grant execute on function public.select_current_branch(uuid, text)
  to authenticated;
grant execute on function public.activate_current_tenant_primary_branch()
  to authenticated;
grant execute on function public.create_current_tenant_branch(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  uuid
) to authenticated;

grant execute on function public.provision_primary_branch_for_new_tenant(uuid, uuid)
  to service_role;

commit;
