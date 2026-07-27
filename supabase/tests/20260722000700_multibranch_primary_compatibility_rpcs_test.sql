-- Read-only structural verification for Phase 4A Primary compatibility and
-- branch lifecycle RPCs.

begin;

set local statement_timeout = '15s';

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branch_user_preferences'
      and column_name = 'active_scope'
  ) then
    raise exception 'branch preference active_scope is missing';
  end if;

  if to_regprocedure('private.can_view_consolidated_branches(uuid)') is null
    or to_regprocedure(
      'private.ensure_physical_primary_branch(uuid,uuid,text)'
    ) is null
    or to_regprocedure('public.list_current_user_branches()') is null
    or to_regprocedure('public.get_current_branch_context()') is null
    or to_regprocedure('public.select_current_branch(uuid,text)') is null
    or to_regprocedure(
      'public.activate_current_tenant_primary_branch()'
    ) is null
    or to_regprocedure(
      'public.provision_primary_branch_for_new_tenant(uuid,uuid)'
    ) is null
    or to_regprocedure(
      'public.create_current_tenant_branch(text,text,text,text,text,text,text,text,text,text,text,date,uuid)'
    ) is null
  then
    raise exception 'one or more Phase 4A branch RPCs are missing';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.branches',
    'INSERT,UPDATE,DELETE,TRUNCATE'
  ) then
    raise exception 'authenticated users can still mutate branches directly';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.branches',
    'SELECT'
  ) then
    raise exception 'authenticated users cannot read scoped branches';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.branch_user_preferences',
    'INSERT,UPDATE,DELETE,TRUNCATE'
  ) then
    raise exception 'authenticated users can mutate branch preferences directly';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'branches'
      and policyname = 'branches_scoped_read'
      and cmd = 'SELECT'
  ) or exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'branches'
      and policyname = 'branches_tenant_access'
  ) then
    raise exception 'legacy branch-wide policy was not replaced safely';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_current_branch_context()',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.select_current_branch(uuid,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.create_current_tenant_branch(text,text,text,text,text,text,text,text,text,text,text,date,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated branch RPC execution grant is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_current_branch_context()',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.activate_current_tenant_primary_branch()',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.create_current_tenant_branch(text,text,text,text,text,text,text,text,text,text,text,date,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anonymous role can execute a protected branch RPC';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.provision_primary_branch_for_new_tenant(uuid,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.provision_primary_branch_for_new_tenant(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'new-tenant Primary provisioning privilege is unsafe';
  end if;
end;
$$;

rollback;
