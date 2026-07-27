-- Multi-branch Phase 3C: staff access profiles, branch roles, permission grants,
-- and reusable branch-security helpers.
--
-- Safety properties:
--   * Existing users and branch_staff_assignments rows are not backfilled.
--   * Existing branch RLS policies are not replaced in this migration.
--   * New permission tables are server/RPC-only until Phase 4.
--   * Additional branches stay readable after downgrade but helpers reject new
--     writes unless the branch is active/unlocked and entitlement is valid.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create unique index if not exists users_tenant_id_id_uidx
  on public.users (tenant_id, id);

create table if not exists public.branch_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_key text not null,
  role_name text not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  is_system boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_roles_status_check
    check (status in ('active', 'inactive')),
  constraint branch_roles_key_check
    check (role_key = lower(role_key) and role_key ~ '^[a-z0-9][a-z0-9._-]*$'),
  unique (tenant_id, role_key)
);

create unique index if not exists branch_roles_tenant_id_id_uidx
  on public.branch_roles (tenant_id, id);

create index if not exists branch_roles_tenant_status_idx
  on public.branch_roles (tenant_id, status, role_name);

-- Extend the existing equivalent assignment table; do not replace it.
alter table public.branch_staff_assignments
  add column if not exists branch_role_id uuid,
  add column if not exists is_primary_assignment boolean not null default false,
  add column if not exists can_switch_branch boolean not null default true,
  add column if not exists assigned_by uuid references public.users(id) on delete set null,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_staff_assignments_branch_tenant_fkey'
      and conrelid = 'public.branch_staff_assignments'::regclass
  ) then
    alter table public.branch_staff_assignments
      add constraint branch_staff_assignments_branch_tenant_fkey
      foreign key (tenant_id, branch_id)
      references public.branches(tenant_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_staff_assignments_staff_tenant_fkey'
      and conrelid = 'public.branch_staff_assignments'::regclass
  ) then
    alter table public.branch_staff_assignments
      add constraint branch_staff_assignments_staff_tenant_fkey
      foreign key (tenant_id, staff_id)
      references public.users(tenant_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_staff_assignments_role_tenant_fkey'
      and conrelid = 'public.branch_staff_assignments'::regclass
  ) then
    alter table public.branch_staff_assignments
      add constraint branch_staff_assignments_role_tenant_fkey
      foreign key (tenant_id, branch_role_id)
      references public.branch_roles(tenant_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_staff_assignments_dates_check'
      and conrelid = 'public.branch_staff_assignments'::regclass
  ) then
    alter table public.branch_staff_assignments
      add constraint branch_staff_assignments_dates_check
      check (ends_at is null or starts_at is null or ends_at > starts_at)
      not valid;
  end if;
end;
$$;

create unique index if not exists branch_staff_one_primary_assignment_idx
  on public.branch_staff_assignments (tenant_id, staff_id)
  where is_primary_assignment and status = 'active' and ends_at is null;

create index if not exists branch_staff_branch_status_idx
  on public.branch_staff_assignments (
    tenant_id,
    branch_id,
    status,
    staff_id
  );

create index if not exists branch_staff_role_idx
  on public.branch_staff_assignments (tenant_id, branch_role_id, status)
  where branch_role_id is not null;

-- One/many branch access uses branch_staff_assignments. This profile adds the
-- explicit all-branches scope and a secure home-branch preference.
create table if not exists public.branch_staff_access_profiles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null,
  access_scope text not null default 'assigned_branches',
  home_branch_id uuid,
  can_view_consolidated boolean not null default false,
  status text not null default 'active',
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, staff_id),
  constraint branch_staff_profiles_staff_fkey
    foreign key (tenant_id, staff_id)
    references public.users(tenant_id, id)
    on delete restrict,
  constraint branch_staff_profiles_home_branch_fkey
    foreign key (tenant_id, home_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_staff_profiles_scope_check
    check (access_scope in ('assigned_branches', 'all_branches')),
  constraint branch_staff_profiles_status_check
    check (status in ('active', 'inactive'))
);

create index if not exists branch_staff_profiles_scope_idx
  on public.branch_staff_access_profiles (tenant_id, access_scope, status);

-- Explicit grants/denials override role and legacy assignment permission JSON.
-- NULL branch_id means a tenant-wide permission for branches the staff member
-- is otherwise allowed to access; it does not itself grant branch visibility.
create table if not exists public.branch_permission_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid,
  staff_id uuid not null,
  permission_key text not null,
  effect text not null default 'allow',
  reason text,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_permission_grants_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_permission_grants_staff_fkey
    foreign key (tenant_id, staff_id)
    references public.users(tenant_id, id)
    on delete restrict,
  constraint branch_permission_grants_key_check
    check (
      permission_key = lower(permission_key)
      and permission_key ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  constraint branch_permission_grants_effect_check
    check (effect in ('allow', 'deny'))
);

create unique index if not exists branch_permission_grants_branch_uidx
  on public.branch_permission_grants (
    tenant_id,
    branch_id,
    staff_id,
    permission_key
  )
  where branch_id is not null;

create unique index if not exists branch_permission_grants_tenant_uidx
  on public.branch_permission_grants (tenant_id, staff_id, permission_key)
  where branch_id is null;

create index if not exists branch_permission_grants_lookup_idx
  on public.branch_permission_grants (
    tenant_id,
    staff_id,
    branch_id,
    permission_key,
    effect
  );

drop trigger if exists branch_roles_updated_at on public.branch_roles;
create trigger branch_roles_updated_at
before update on public.branch_roles
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_staff_assignments_updated_at
  on public.branch_staff_assignments;
create trigger branch_staff_assignments_updated_at
before update on public.branch_staff_assignments
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_staff_profiles_updated_at
  on public.branch_staff_access_profiles;
create trigger branch_staff_profiles_updated_at
before update on public.branch_staff_access_profiles
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_permission_grants_updated_at
  on public.branch_permission_grants;
create trigger branch_permission_grants_updated_at
before update on public.branch_permission_grants
for each row execute function private.set_multibranch_updated_at();

create or replace function private.is_active_tenant_member(p_tenant_id uuid)
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
      and app_user.tenant_id = p_tenant_id
      and app_user.is_active
  );
$$;

-- Mirrors the current tenant authority model without treating Seller or a
-- branch-level Manager as a tenant-wide administrator.
create or replace function private.is_tenant_branch_administrator(
  p_tenant_id uuid
)
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
      and app_user.tenant_id = p_tenant_id
      and app_user.is_active
      and lower(coalesce(app_user.role_key, app_user.role, '')) in (
        'admin',
        'owner',
        'tenant_owner',
        'business_owner',
        'company_admin'
      )
  );
$$;

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

create or replace function private.has_branch_permission(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permission_key text := lower(nullif(btrim(p_permission_key), ''));
begin
  if v_permission_key is null then
    return false;
  end if;

  if private.is_tenant_branch_administrator(p_tenant_id) then
    return true;
  end if;

  if not private.is_branch_assigned(p_tenant_id, p_branch_id) then
    return false;
  end if;

  if exists (
    select 1
    from public.branch_permission_grants as permission
    where permission.tenant_id = p_tenant_id
      and permission.staff_id = (select auth.uid())
      and permission.permission_key = v_permission_key
      and permission.effect = 'deny'
      and (permission.branch_id is null or permission.branch_id = p_branch_id)
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.branch_permission_grants as permission
    where permission.tenant_id = p_tenant_id
      and permission.staff_id = (select auth.uid())
      and permission.permission_key = v_permission_key
      and permission.effect = 'allow'
      and (permission.branch_id is null or permission.branch_id = p_branch_id)
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.branch_staff_assignments as assignment
    join public.branch_roles as branch_role
      on branch_role.tenant_id = assignment.tenant_id
      and branch_role.id = assignment.branch_role_id
      and branch_role.status = 'active'
    where assignment.tenant_id = p_tenant_id
      and assignment.branch_id = p_branch_id
      and assignment.staff_id = (select auth.uid())
      and assignment.status = 'active'
      and (assignment.starts_at is null or assignment.starts_at <= now())
      and (assignment.ends_at is null or assignment.ends_at > now())
      and branch_role.permissions @> jsonb_build_object(v_permission_key, true)
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.branch_staff_assignments as assignment
    where assignment.tenant_id = p_tenant_id
      and assignment.branch_id = p_branch_id
      and assignment.staff_id = (select auth.uid())
      and assignment.status = 'active'
      and (assignment.starts_at is null or assignment.starts_at <= now())
      and (assignment.ends_at is null or assignment.ends_at > now())
      and assignment.permissions @> jsonb_build_object(v_permission_key, true)
  );
end;
$$;

create or replace function private.can_read_branch(
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
    private.is_active_tenant_member(p_tenant_id)
    and exists (
      select 1
      from public.branches as branch
      where branch.tenant_id = p_tenant_id
        and branch.id = p_branch_id
        and branch.archived_at is null
    )
    and private.is_branch_assigned(p_tenant_id, p_branch_id);
$$;

create or replace function private.can_write_branch(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_branch public.branches%rowtype;
begin
  if not private.can_read_branch(p_tenant_id, p_branch_id) then
    return false;
  end if;

  select *
  into v_branch
  from public.branches
  where tenant_id = p_tenant_id
    and id = p_branch_id
    and archived_at is null;

  if v_branch.id is null
    or v_branch.status <> 'active'
    or v_branch.is_locked
  then
    return false;
  end if;

  -- Primary stays usable on lower packages. Every additional branch requires
  -- the active Tanzanite entitlement plus global and tenant rollout flags.
  if not v_branch.is_default
    and not coalesce(
      private.can_operate_additional_branches(p_tenant_id),
      false
    )
  then
    return false;
  end if;

  return private.has_branch_permission(
    p_tenant_id,
    p_branch_id,
    p_permission_key
  );
end;
$$;

-- New tables are inaccessible directly until Phase 4 adds audited RPCs.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'branch_roles',
    'branch_staff_access_profiles',
    'branch_permission_grants'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

revoke all on function private.is_active_tenant_member(uuid) from public;
revoke all on function private.is_tenant_branch_administrator(uuid) from public;
revoke all on function private.is_branch_assigned(uuid, uuid) from public;
revoke all on function private.has_branch_permission(uuid, uuid, text) from public;
revoke all on function private.can_read_branch(uuid, uuid) from public;
revoke all on function private.can_write_branch(uuid, uuid, text) from public;

commit;
