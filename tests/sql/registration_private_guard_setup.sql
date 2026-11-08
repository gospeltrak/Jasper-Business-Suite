-- Representative production trigger regression: no real tenant data and no auth users.
-- The guard body matches the live private.guard_normalized_workspace_storage trigger.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION private.normalized_writes_enabled(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$ SELECT false $fn$;
CREATE TABLE public.registration_guard_fixture (
  tenant_id uuid PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT USAGE ON SCHEMA public TO service_role;
GRANT INSERT, SELECT, UPDATE ON public.registration_guard_fixture TO service_role;

CREATE OR REPLACE FUNCTION private.guard_normalized_workspace_storage()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
BEGIN
  IF private.normalized_writes_enabled(NEW.tenant_id)
     AND NEW.payload ?| ARRAY['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes']
  THEN
    RAISE EXCEPTION USING errcode='55000',
      message='Business records are stored in normalized tables. Reload and use the current save API.';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER guard_normalized_workspace_storage
BEFORE INSERT OR UPDATE OF payload ON public.registration_guard_fixture
FOR EACH ROW EXECUTE FUNCTION private.guard_normalized_workspace_storage();

-- Check that the previously broken invocation is actually denied.
DO $guard_pre$
BEGIN
  BEGIN
    SET LOCAL ROLE service_role;
    INSERT INTO public.registration_guard_fixture(tenant_id,payload)
    VALUES ('11111111-1111-4111-8111-111111111111','{}'::jsonb);
    RESET ROLE;
    RAISE EXCEPTION 'Expected legacy invoker guard to fail when private schema USAGE is denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    -- Expected before the registration hotfix.
  END;
END
$guard_pre$;
