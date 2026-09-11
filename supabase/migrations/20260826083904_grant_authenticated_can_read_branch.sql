-- The branches SELECT policy invokes this security-definer predicate for
-- each row. PostgreSQL still requires the policy role to have EXECUTE on the
-- referenced function; an earlier blanket revoke made every authenticated
-- branch read fail before the tenant/assignment checks could run.
--
-- The function itself remains the authorization boundary: it derives the
-- actor from auth.uid(), requires active tenant membership, an unarchived
-- branch, and an active branch assignment. No table privilege or cross-tenant
-- access is added here.
revoke all on function private.can_read_branch(uuid, uuid) from public, anon;
grant execute on function private.can_read_branch(uuid, uuid) to authenticated;
