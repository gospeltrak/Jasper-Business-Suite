-- Least-privilege hardening: public Primary Branch provisioning is backend-only.
-- Only the trusted server's service_role may invoke this existing RPC.
-- No row modifications, RLS changes, private schema grants or function body changes.
-- Existing tenant registration uses supabaseAdmin (service_role).
REVOKE ALL ON FUNCTION public.provision_primary_branch_for_new_tenant(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_primary_branch_for_new_tenant(uuid, uuid)
  TO service_role;
