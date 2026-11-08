-- Validate that the actual 20261107123941 migration restores service-role
-- tenant workspace trigger writes WITHOUT exposing private schema to API roles.
DO $guard_post$
DECLARE rows_inserted integer;
BEGIN
  IF has_schema_privilege('anon','private','USAGE')
     OR has_schema_privilege('authenticated','private','USAGE')
     OR has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'private schema USAGE was exposed';
  END IF;
  IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid='private.guard_normalized_workspace_storage()'::regprocedure) THEN
    RAISE EXCEPTION 'guard must be SECURITY DEFINER';
  END IF;
  IF has_function_privilege('anon','private.guard_normalized_workspace_storage()','EXECUTE')
     OR has_function_privilege('authenticated','private.guard_normalized_workspace_storage()','EXECUTE')
     OR has_function_privilege('service_role','private.guard_normalized_workspace_storage()','EXECUTE') THEN
    RAISE EXCEPTION 'private guard direct EXECUTE was exposed';
  END IF;
  SET LOCAL ROLE service_role;
  INSERT INTO public.registration_guard_fixture(tenant_id,payload)
  VALUES ('22222222-2222-4222-8222-222222222222','{}'::jsonb);
  UPDATE public.registration_guard_fixture SET payload='{"settings":{}}'::jsonb
  WHERE tenant_id='22222222-2222-4222-8222-222222222222';
  RESET ROLE;
  SELECT count(*) INTO rows_inserted FROM public.registration_guard_fixture;
  IF rows_inserted <> 1 THEN RAISE EXCEPTION 'expected one mock registration row, got %',rows_inserted; END IF;
  RAISE NOTICE 'Registration private guard passes under restricted service_role';
END
$guard_post$;
