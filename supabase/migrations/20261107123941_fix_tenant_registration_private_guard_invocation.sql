-- Production migration 20261107123941. Restore new tenant registration after
-- private schema EXECUTE/USAGE hardening.
--
-- Existing security-invoker trigger guard runs as service_role during
-- registration's tenant_workspaces INSERT and calls a private function.
-- service_role deliberately has NO USAGE on private schema, causing 42501.
-- Run this one trigger-only checker under postgres, preserving its existing
-- business/normalized-write gate, WITHOUT granting private schema usage.
--
-- The function is a TRIGGER function, not an exposed RPC. It may only be
-- executed by its table trigger; no anonymous or service_role EXECUTE grants.
ALTER FUNCTION private.guard_normalized_workspace_storage() SECURITY DEFINER;
ALTER FUNCTION private.guard_normalized_workspace_storage() SET search_path = '';
REVOKE ALL ON FUNCTION private.guard_normalized_workspace_storage()
  FROM PUBLIC, anon, authenticated, service_role;
