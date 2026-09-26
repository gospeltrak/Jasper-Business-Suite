-- Lets a tenant grant a staff member access to every branch (not just the
-- one branch.id already stored on the invitation) instead of only a single
-- branch. Read/switch access is enforced by branch_staff_access_profiles
-- (existing table, never previously written to by application code);
-- matching write access across every branch is enforced by tenant-wide
-- branch_permission_grants rows (branch_id is null). Both are populated by
-- the server at accept-invitation time from this column.

begin;

alter table public.staff_google_invitations
  add column if not exists access_scope text not null default 'assigned_branches'
    check (access_scope in ('assigned_branches', 'all_branches'));

commit;
