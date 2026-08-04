begin;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(proc.oid)
  into v_definition
  from pg_proc as proc
  join pg_namespace as namespace on namespace.oid = proc.pronamespace
  where namespace.nspname = 'private'
    and proc.proname = 'is_platform_admin'
    and pg_get_function_identity_arguments(proc.oid) = '';

  if v_definition is null then
    raise exception 'private.is_platform_admin() is missing';
  end if;

  if position('account_type = ''super_admin''' in v_definition) = 0
     or position('tenant_id is null' in v_definition) = 0
     or position('active_tenant is null' in v_definition) = 0
     or position('auth.jwt()' in v_definition) = 0
     or position('''aal2''' in v_definition) = 0
     or position('role_key' in v_definition) > 0
     or position('app_user.role' in v_definition) > 0 then
    raise exception 'private.is_platform_admin() does not enforce strict tenantless super-admin authorization';
  end if;
end
$$;

rollback;
