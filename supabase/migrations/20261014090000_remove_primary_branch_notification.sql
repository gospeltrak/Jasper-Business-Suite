-- Stop sending the "Primary Branch ready" notification when a legacy
-- single-branch tenant's compatibility Primary Branch is auto-activated.
-- This event is invisible/meaningless to the tenant (it just mirrors their
-- existing single-store setup), so it was removed from the notification
-- list rather than reworded. Everything else in the function is unchanged
-- from 20260731000100_fix_branch_switcher_default_names.sql.

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
  v_default_name text;
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

  v_default_name := coalesce(nullif(btrim(v_tenant_name), ''), 'Business');

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
    v_default_name,
    'PRIMARY',
    v_default_name,
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

  return v_primary_id;
end;
$$;
