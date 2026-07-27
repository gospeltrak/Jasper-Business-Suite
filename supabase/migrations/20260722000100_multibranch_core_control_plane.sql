-- Multi-branch Phase 3A: additive core control plane.
--
-- Safety properties:
--   * No tenant, workspace, product, stock, sale, balance, or document row is
--     inserted, updated, deleted, or backfilled by this migration.
--   * No Primary Branch is created for an existing tenant.
--   * Multi-branch rollout is disabled unless BOTH the global platform flag
--     and the tenant-specific entitlement are explicitly enabled later.
--   * Existing branch columns and policies remain backward compatible.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Extend the existing Branch foundation without renaming or replacing it.
alter table public.branches
  add column if not exists business_name text,
  add column if not exists relationship_type text,
  add column if not exists region text,
  add column if not exists district text,
  add column if not exists country text,
  add column if not exists opening_date date,
  add column if not exists logo_light_url text,
  add column if not exists logo_dark_url text,
  add column if not exists is_locked boolean not null default false,
  add column if not exists lock_reason text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists setup_status text not null default 'draft',
  add column if not exists setup_completed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS. Use catalog checks so the
-- migration remains safe to retry. NOT VALID avoids scanning existing rows;
-- the checks still apply to all rows written after this migration.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'branches_relationship_type_check'
      and conrelid = 'public.branches'::regclass
  ) then
    alter table public.branches
      add constraint branches_relationship_type_check
      check (
        relationship_type is null
        or relationship_type in ('same_business', 'independent_business')
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branches_setup_status_check'
      and conrelid = 'public.branches'::regclass
  ) then
    alter table public.branches
      add constraint branches_setup_status_check
      check (setup_status in ('draft', 'in_progress', 'complete')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branches_lock_metadata_check'
      and conrelid = 'public.branches'::regclass
  ) then
    alter table public.branches
      add constraint branches_lock_metadata_check
      check (
        (not is_locked)
        or (locked_at is not null and nullif(btrim(lock_reason), '') is not null)
      ) not valid;
  end if;
end;
$$;

create index if not exists branches_tenant_locked_status_idx
  on public.branches (tenant_id, is_locked, status, branch_name)
  where archived_at is null;

create index if not exists branches_tenant_created_idx
  on public.branches (tenant_id, created_at desc);

-- Supports composite tenant/branch foreign keys so a branch from another
-- tenant can never be selected accidentally in new branch-aware tables.
create unique index if not exists branches_tenant_id_id_uidx
  on public.branches (tenant_id, id);

-- No entitlement rows are seeded. Absence means tenant rollout is disabled.
create table if not exists public.tenant_branch_entitlements (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  feature_enabled boolean not null default false,
  additional_branch_slots integer not null default 0,
  grant_reason text,
  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_branch_entitlements_slots_check
    check (additional_branch_slots >= 0),
  constraint tenant_branch_entitlements_grant_check
    check (
      (not feature_enabled)
      or (
        granted_at is not null
        and granted_by is not null
        and nullif(btrim(grant_reason), '') is not null
      )
    )
);

create index if not exists tenant_branch_entitlements_enabled_idx
  on public.tenant_branch_entitlements (feature_enabled, updated_at desc)
  where feature_enabled;

-- Selected branch is optional. NULL means the compatibility Primary Branch,
-- allowing all existing records without branch_id to keep working untouched.
create table if not exists public.branch_user_preferences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  active_branch_id uuid,
  recent_branch_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint branch_user_preferences_active_branch_fkey
    foreign key (tenant_id, active_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict
);

create index if not exists branch_user_preferences_user_idx
  on public.branch_user_preferences (user_id, updated_at desc);

-- Keep the stronger branch-capacity admin identity separate from the legacy
-- platform helper: tenant users with an "Admin" business role must never be
-- able to grant their own additional branch capacity.
create or replace function private.is_branch_capacity_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users as app_user
    where app_user.id = (select auth.uid())
      and app_user.is_active
      and app_user.tenant_id is null
      and lower(coalesce(app_user.account_type, '')) = 'super_admin'
  );
$$;

-- The flag lives in the existing generic Super Admin platform-record store.
-- No flag row is inserted here, therefore the result is false after migration.
create or replace function private.is_multibranch_globally_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (record.payload ->> 'enabled')::boolean
      from public.super_admin_platform_records as record
      where record.record_type = 'feature_flag'
        and record.scope_id = 'multi_branch'
      limit 1
    ),
    false
  );
$$;

-- Capacity is intentionally independent from rollout visibility:
--   lower package / inactive subscription: Primary Branch only (1 total)
--   active Tanzanite: Primary + 1 additional + tenant-specific extra slots
create or replace function private.effective_branch_limit(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when lower(coalesce(tenant.active_package_id, '')) = 'tanzanite'
      and tenant.subscription_status = 'active'
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
  select
    private.is_multibranch_globally_enabled()
    and lower(coalesce(tenant.active_package_id, '')) = 'tanzanite'
    and tenant.subscription_status = 'active'
    and coalesce(entitlement.feature_enabled, false)
  from public.tenants as tenant
  left join public.tenant_branch_entitlements as entitlement
    on entitlement.tenant_id = tenant.id
  where tenant.id = p_tenant_id;
$$;

-- Tenant-facing read model. It exposes capacity/status only, not grant notes or
-- administrator identity.
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
  v_additional_slots integer := 0;
  v_tenant_enabled boolean := false;
  v_current_branch_count integer := 0;
  v_effective_limit integer := 1;
  v_global_enabled boolean := false;
  v_can_operate boolean := false;
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
    lower(coalesce(tenant.active_package_id, '')),
    tenant.subscription_status,
    coalesce(entitlement.additional_branch_slots, 0),
    coalesce(entitlement.feature_enabled, false)
  into
    v_package_id,
    v_subscription_status,
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

  v_global_enabled := private.is_multibranch_globally_enabled();
  v_effective_limit := coalesce(private.effective_branch_limit(v_tenant_id), 1);
  v_can_operate := coalesce(private.can_operate_additional_branches(v_tenant_id), false);

  return jsonb_build_object(
    'tenantId', v_tenant_id,
    'packageId', nullif(v_package_id, ''),
    'subscriptionStatus', v_subscription_status,
    'globalFeatureEnabled', v_global_enabled,
    'tenantFeatureEnabled', v_tenant_enabled,
    'defaultTotalBranches', case when v_package_id = 'tanzanite' then 2 else 1 end,
    'additionalGrantedSlots', v_additional_slots,
    'effectiveTotalBranches', v_effective_limit,
    'currentPhysicalBranchCount', v_current_branch_count,
    'canOperateAdditionalBranches', v_can_operate,
    'usesCompatibilityPrimary', v_current_branch_count = 0
  );
end;
$$;

-- Only Super Admin can grant capacity. A custom allowance is any non-negative
-- whole number, so active Tanzanite capacity is always 2 + granted slots.
create or replace function public.configure_tenant_branch_capacity(
  p_tenant_id uuid,
  p_additional_branch_slots integer,
  p_feature_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_current_branch_count integer;
  v_requested_total integer;
  v_package_id text;
  v_subscription_status text;
begin
  if not private.is_branch_capacity_admin() then
    raise exception 'Only Super Admin may configure branch capacity.'
      using errcode = '42501';
  end if;

  if p_additional_branch_slots is null or p_additional_branch_slots < 0 then
    raise exception 'Additional branch slots must be a non-negative whole number.'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'An administrator reason is required.'
      using errcode = '22023';
  end if;

  select
    lower(coalesce(tenant.active_package_id, '')),
    tenant.subscription_status
  into v_package_id, v_subscription_status
  from public.tenants as tenant
  where tenant.id = p_tenant_id
  for update;

  if not found then
    raise exception 'Tenant not found.' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into v_current_branch_count
  from public.branches as branch
  where branch.tenant_id = p_tenant_id
    and branch.archived_at is null;

  v_requested_total := 2 + p_additional_branch_slots;

  if v_current_branch_count > v_requested_total then
    raise exception 'Capacity cannot be reduced below the tenant current branch count (%).',
      v_current_branch_count
      using errcode = '23514';
  end if;

  insert into public.tenant_branch_entitlements (
    tenant_id,
    feature_enabled,
    additional_branch_slots,
    grant_reason,
    granted_by,
    granted_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_feature_enabled,
    p_additional_branch_slots,
    btrim(p_reason),
    v_actor_id,
    now(),
    now()
  )
  on conflict (tenant_id) do update
  set feature_enabled = excluded.feature_enabled,
      additional_branch_slots = excluded.additional_branch_slots,
      grant_reason = excluded.grant_reason,
      granted_by = excluded.granted_by,
      granted_at = excluded.granted_at,
      updated_at = excluded.updated_at;

  insert into public.super_admin_audit_logs (
    actor_user_id,
    target_tenant_id,
    action,
    metadata
  )
  values (
    v_actor_id,
    p_tenant_id,
    'branch_capacity_updated',
    jsonb_build_object(
      'featureEnabled', p_feature_enabled,
      'additionalBranchSlots', p_additional_branch_slots,
      'effectiveTanzaniteLimit', v_requested_total,
      'currentBranchCount', v_current_branch_count,
      'activePackageId', nullif(v_package_id, ''),
      'subscriptionStatus', v_subscription_status,
      'reason', btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'featureEnabled', p_feature_enabled,
    'additionalGrantedSlots', p_additional_branch_slots,
    'effectiveTanzaniteLimit', v_requested_total,
    'currentPhysicalBranchCount', v_current_branch_count,
    'activePackageId', nullif(v_package_id, ''),
    'subscriptionStatus', v_subscription_status
  );
end;
$$;

-- Global kill switch. Tenant-specific flags still remain required, so turning
-- this on does not expose Branches to every tenant automatically.
create or replace function public.configure_multibranch_rollout(
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if not private.is_branch_capacity_admin() then
    raise exception 'Only Super Admin may configure multi-branch rollout.'
      using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'Rollout enabled state is required.' using errcode = '22023';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'An administrator reason is required.' using errcode = '22023';
  end if;

  insert into public.super_admin_platform_records (
    record_type,
    scope_id,
    payload,
    created_by,
    updated_by,
    updated_at
  )
  values (
    'feature_flag',
    'multi_branch',
    jsonb_build_object('enabled', p_enabled, 'reason', btrim(p_reason)),
    v_actor_id,
    v_actor_id,
    now()
  )
  on conflict (record_type, scope_id) do update
  set payload = excluded.payload,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.super_admin_audit_logs (
    actor_user_id,
    action,
    metadata
  )
  values (
    v_actor_id,
    'multi_branch_rollout_updated',
    jsonb_build_object('enabled', p_enabled, 'reason', btrim(p_reason))
  );

  return jsonb_build_object('enabled', p_enabled);
end;
$$;

-- RLS: entitlement writes are RPC-only and audited. Tenants use the safe read
-- model above. Preferences are accessible only by their owning active user.
alter table public.tenant_branch_entitlements enable row level security;
alter table public.tenant_branch_entitlements force row level security;

drop policy if exists tenant_branch_entitlements_admin_read
  on public.tenant_branch_entitlements;
create policy tenant_branch_entitlements_admin_read
  on public.tenant_branch_entitlements
  for select
  to authenticated
  using ((select private.is_branch_capacity_admin()));

alter table public.branch_user_preferences enable row level security;
alter table public.branch_user_preferences force row level security;

drop policy if exists branch_user_preferences_self_access
  on public.branch_user_preferences;
create policy branch_user_preferences_self_access
  on public.branch_user_preferences
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and tenant_id = (select private.current_tenant_id())
  )
  with check (
    user_id = (select auth.uid())
    and tenant_id = (select private.current_tenant_id())
    and (
      active_branch_id is null
      or exists (
        select 1
        from public.branches as branch
        where branch.id = active_branch_id
          and branch.tenant_id = branch_user_preferences.tenant_id
          and branch.archived_at is null
      )
    )
  );

revoke all on table public.tenant_branch_entitlements from anon, authenticated;
grant select on table public.tenant_branch_entitlements to authenticated;

revoke all on table public.branch_user_preferences from anon, authenticated;
grant select, insert, update, delete
  on table public.branch_user_preferences
  to authenticated;

revoke all on function private.is_branch_capacity_admin() from public;
revoke all on function private.is_multibranch_globally_enabled() from public;
revoke all on function private.effective_branch_limit(uuid) from public;
revoke all on function private.can_operate_additional_branches(uuid) from public;
revoke all on function public.get_current_branch_entitlement() from public;
revoke all on function public.configure_tenant_branch_capacity(uuid, integer, boolean, text) from public;
revoke all on function public.configure_multibranch_rollout(boolean, text) from public;

grant execute on function private.is_branch_capacity_admin() to authenticated;
grant execute on function public.get_current_branch_entitlement() to authenticated;
grant execute on function public.configure_tenant_branch_capacity(uuid, integer, boolean, text) to authenticated;
grant execute on function public.configure_multibranch_rollout(boolean, text) to authenticated;

commit;
