-- Targeted least-privilege hardening for existing production functions.
-- No function bodies, user data, RLS policies, or private-schema grants change.
-- Lock the search path of the trigger-only timestamp setter (it uses NEW and now()).
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- Admin-gated RPCs should not be callable without a signed-in user.
-- Preserve authenticated and service_role execution; functions still enforce their own admin authorization.
REVOKE EXECUTE ON FUNCTION public.configure_multibranch_rollout(boolean, text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.configure_tenant_branch_capacity(uuid, integer, boolean, text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_affiliate_commission_from_revenue(uuid, numeric, uuid, date, date)
  FROM PUBLIC, anon;
