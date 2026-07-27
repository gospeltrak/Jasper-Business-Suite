-- Read-only structural verification for the Phase 3A migration.
-- Run only after 20260722000100_multibranch_core_control_plane.sql.

begin;

set local statement_timeout = '15s';

do $$
declare
  v_missing_columns text[];
begin
  if to_regclass('public.tenant_branch_entitlements') is null then
    raise exception 'tenant_branch_entitlements table is missing';
  end if;

  if to_regclass('public.branch_user_preferences') is null then
    raise exception 'branch_user_preferences table is missing';
  end if;

  select array_agg(required.column_name order by required.column_name)
  into v_missing_columns
  from (
    values
      ('business_name'),
      ('relationship_type'),
      ('is_locked'),
      ('archived_at'),
      ('setup_status'),
      ('metadata')
  ) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns as existing
    where existing.table_schema = 'public'
      and existing.table_name = 'branches'
      and existing.column_name = required.column_name
  );

  if coalesce(array_length(v_missing_columns, 1), 0) > 0 then
    raise exception 'branches columns are missing: %', v_missing_columns;
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.tenant_branch_entitlements'::regclass
      and relrowsecurity
      and relforcerowsecurity
  ) then
    raise exception 'tenant_branch_entitlements RLS is not enabled and forced';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.branch_user_preferences'::regclass
      and relrowsecurity
      and relforcerowsecurity
  ) then
    raise exception 'branch_user_preferences RLS is not enabled and forced';
  end if;

  if to_regprocedure('private.is_branch_capacity_admin()') is null
    or to_regprocedure('private.is_multibranch_globally_enabled()') is null
    or to_regprocedure('private.effective_branch_limit(uuid)') is null
    or to_regprocedure('private.can_operate_additional_branches(uuid)') is null
    or to_regprocedure('public.get_current_branch_entitlement()') is null
    or to_regprocedure(
      'public.configure_tenant_branch_capacity(uuid,integer,boolean,text)'
    ) is null
    or to_regprocedure('public.configure_multibranch_rollout(boolean,text)') is null
  then
    raise exception 'one or more multi-branch control functions are missing';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.tenant_branch_entitlements',
    'INSERT,UPDATE,DELETE'
  ) then
    raise exception 'authenticated users must not write entitlements directly';
  end if;

  if has_function_privilege(
    'anon',
    'public.configure_tenant_branch_capacity(uuid,integer,boolean,text)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute the branch capacity RPC';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_current_branch_entitlement()',
    'EXECUTE'
  ) then
    raise exception 'authenticated users must be able to read their safe entitlement model';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_branch_entitlements'
      and policyname = 'tenant_branch_entitlements_admin_read'
      and cmd = 'SELECT'
  ) then
    raise exception 'admin-only entitlement read policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'branch_user_preferences'
      and policyname = 'branch_user_preferences_self_access'
  ) then
    raise exception 'self-only branch preference policy is missing';
  end if;
end;
$$;

rollback;
