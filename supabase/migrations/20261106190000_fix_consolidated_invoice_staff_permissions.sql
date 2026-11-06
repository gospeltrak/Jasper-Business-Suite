-- Consolidated invoices: repair stale all-branch staff grants only when
-- the same tenant explicitly granted quote/invoice write permissions.
-- Do not broaden access to assigned-branch-only staff or another tenant.
begin;

update public.branch_staff_access_profiles as profile
set can_view_consolidated = true,
    updated_at = now()
from public.users as staff
where staff.id = profile.staff_id
  and staff.tenant_id = profile.tenant_id
  and staff.is_active = true
  and profile.status = 'active'
  and profile.access_scope = 'all_branches'
  and profile.can_view_consolidated = false
  and (
    lower(coalesce(staff.role_permissions -> 'price quote' ->> 'write', 'false')) = 'true'
    or lower(coalesce(staff.role_permissions -> 'quotation' ->> 'write', 'false')) = 'true'
    or lower(coalesce(staff.role_permissions -> 'all' ->> 'write', 'false')) = 'true'
  );

-- Permissions are recomputed from the user's current role on EVERY request.
-- Revoking quote.write or all-branch access immediately stops consolidated
-- document access even if the historical profile flag is still true.
create or replace function private.can_view_consolidated_branches(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select coalesce(private.can_operate_additional_branches(p_tenant_id), false)
    and (
      private.is_tenant_branch_administrator(p_tenant_id)
      or exists (
        select 1
        from public.branch_staff_access_profiles as profile
        join public.users as staff
          on staff.id = profile.staff_id and staff.tenant_id = profile.tenant_id
        where profile.tenant_id = p_tenant_id
          and profile.staff_id = (select auth.uid())
          and profile.status = 'active'
          and profile.access_scope = 'all_branches'
          and profile.can_view_consolidated = true
          and staff.is_active = true
          and (
            lower(coalesce(staff.role_permissions -> 'price quote' ->> 'write', 'false')) = 'true'
            or lower(coalesce(staff.role_permissions -> 'quotation' ->> 'write', 'false')) = 'true'
            or lower(coalesce(staff.role_permissions -> 'all' ->> 'write', 'false')) = 'true'
          )
      )
    );
$function$;

commit;
