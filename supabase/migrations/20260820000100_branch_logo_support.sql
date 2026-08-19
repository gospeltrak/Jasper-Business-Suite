-- Wire up the `branches.logo_light_url` / `logo_dark_url` columns added in
-- 20260722000100_multibranch_core_control_plane.sql. Those columns have sat
-- unused since then: no RPC has ever selected or written them, so documents
-- (POS receipts, sales documents, reports, delivery notes) have had no way
-- to brand themselves with a real branch's own logo. This migration is
-- additive only — no existing row, RLS policy, or RPC behavior changes for
-- any request that doesn't touch a branch logo.

begin;

-- Expose logoLightUrl/logoDarkUrl on every branch returned by the branch
-- directory RPC, so the client can read (and switch on) a branch's logo the
-- same way it already reads branchName/address/etc. `create or replace`
-- fully replaces the previous body (from 20260731000100), so every existing
-- field is carried forward unchanged aside from the two additions.
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
        'includesUnassignedHistoricalRecords', branch.is_default,
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

-- Update a branch's own logo. Deliberately narrow (logo only, not a general
-- "edit branch" RPC) to keep this change's surface area small. Reuses the
-- same admin-or-branches.manage authorization shape as branch creation and
-- other branch-scoped writes.
create or replace function public.update_current_tenant_branch_logo(
  p_branch_id uuid,
  p_logo_light_url text,
  p_logo_dark_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_light text := nullif(btrim(coalesce(p_logo_light_url, '')), '');
  v_dark text := nullif(btrim(coalesce(p_logo_dark_url, '')), '');
  v_branch public.branches%rowtype;
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

  if p_branch_id is null then
    raise exception 'A branch ID is required.'
      using errcode = '22023';
  end if;

  if v_light is not null and (char_length(v_light) > 2048 or v_light !~ '^https?://') then
    raise exception 'A valid light logo URL is required.'
      using errcode = '22023';
  end if;
  if v_dark is not null and (char_length(v_dark) > 2048 or v_dark !~ '^https?://') then
    raise exception 'A valid dark logo URL is required.'
      using errcode = '22023';
  end if;

  if not (
    private.is_tenant_branch_administrator(v_tenant_id)
    or private.can_write_branch(v_tenant_id, p_branch_id, 'branches.manage')
  ) then
    raise exception 'Branch management permission is required.'
      using errcode = '42501';
  end if;

  update public.branches
  set logo_light_url = v_light,
      logo_dark_url = v_dark
  where tenant_id = v_tenant_id
    and id = p_branch_id
    and archived_at is null
  returning * into v_branch;

  if v_branch.id is null then
    raise exception 'Branch record was not found.'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_branch.id,
    'logoLightUrl', v_branch.logo_light_url,
    'logoDarkUrl', v_branch.logo_dark_url
  );
end;
$$;

revoke all on function
  public.update_current_tenant_branch_logo(uuid, text, text)
  from public, anon;
grant execute on function
  public.update_current_tenant_branch_logo(uuid, text, text)
  to authenticated;

commit;
