begin;

create or replace function private.is_platform_admin()
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
      and app_user.account_type = 'super_admin'
      and app_user.tenant_id is null
      and app_user.active_tenant is null
      and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  );
$$;

comment on function private.is_platform_admin() is
  'Returns true only for an active tenantless platform super administrator with an AAL2 session. Tenant Admin roles never qualify.';

revoke all on function private.is_platform_admin() from public;
revoke all on function private.is_platform_admin() from anon;
revoke all on function private.is_platform_admin() from authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_platform_admin() to service_role;

commit;
