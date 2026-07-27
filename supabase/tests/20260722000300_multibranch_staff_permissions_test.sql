-- Read-only structural verification for the Phase 3C migration.

begin;

set local statement_timeout = '15s';

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
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'required Phase 3C table is missing: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class
      where oid = to_regclass(format('public.%I', v_table))
        and relrowsecurity
        and relforcerowsecurity
    ) then
      raise exception 'RLS is not enabled and forced for %', v_table;
    end if;

    if has_table_privilege(
      'authenticated',
      format('public.%I', v_table),
      'SELECT,INSERT,UPDATE,DELETE'
    ) then
      raise exception 'dark-rollout staff table is exposed: %', v_table;
    end if;
  end loop;

  if to_regprocedure('private.is_active_tenant_member(uuid)') is null
    or to_regprocedure(
      'private.is_tenant_branch_administrator(uuid)'
    ) is null
    or to_regprocedure('private.is_branch_assigned(uuid,uuid)') is null
    or to_regprocedure(
      'private.has_branch_permission(uuid,uuid,text)'
    ) is null
    or to_regprocedure('private.can_read_branch(uuid,uuid)') is null
    or to_regprocedure('private.can_write_branch(uuid,uuid,text)') is null
  then
    raise exception 'one or more branch-security helpers are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_staff_assignments'::regclass
      and conname = 'branch_staff_assignments_branch_tenant_fkey'
      and contype = 'f'
  ) then
    raise exception 'tenant-safe assignment/branch FK is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_staff_assignments'::regclass
      and conname = 'branch_staff_assignments_staff_tenant_fkey'
      and contype = 'f'
  ) then
    raise exception 'tenant-safe assignment/staff FK is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branch_staff_assignments'
      and column_name = 'branch_role_id'
  ) then
    raise exception 'branch_role_id was not added to assignments';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'branch_permission_grants'
      and indexname = 'branch_permission_grants_branch_uidx'
  ) then
    raise exception 'branch-specific permission uniqueness index is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'branch_permission_grants'
      and indexname = 'branch_permission_grants_tenant_uidx'
  ) then
    raise exception 'tenant-wide permission uniqueness index is missing';
  end if;
end;
$$;

rollback;
