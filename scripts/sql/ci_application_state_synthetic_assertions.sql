-- PostgreSQL17 disposable application-state typed KV tests.
DO $parity$
DECLARE n bigint;
BEGIN
  SELECT COUNT(*) INTO n FROM public.orvix_tenant_application_state_entries;
  IF n<>6 THEN RAISE EXCEPTION 'Expected 6 typed key entries, got %',n; END IF;
  SELECT COUNT(*) INTO n FROM public.orvix_tenant_application_state_status
  WHERE state='shadow';
  IF n<>2 THEN RAISE EXCEPTION 'Expected 2 inactive staging markers, got %',n; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.orvix_tenant_application_state_entries
      WHERE tenant_id='11111111-1111-1111-1111-111111111111'
        AND state_key='demo_empty' AND state_value='') THEN
    RAISE EXCEPTION 'Empty string key was lost';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.orvix_tenant_application_state_entries
      WHERE tenant_id='11111111-1111-1111-1111-111111111111'
        AND state_key='literal_null' AND state_value='null') THEN
    RAISE EXCEPTION 'Literal null text was converted into SQL NULL';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.orvix_tenant_application_state_entries
      WHERE tenant_id='11111111-1111-1111-1111-111111111111'
        AND state_key='jasper_platform_banner'
        AND state_value='data:image/png;base64,AAEC') THEN
    RAISE EXCEPTION 'Original image value must be preserved byte-for-byte';
  END IF;
  SELECT COUNT(*) INTO n FROM public.tenant_data t
  JOIN public.ci_original_app_state original
   ON original.tenant_id=t.tenant_id
  WHERE t.data_key='application_state'
    AND md5(t.payload::text) IS DISTINCT FROM original.payload_hash;
  IF n<>0 THEN RAISE EXCEPTION 'Original application_state blob changed'; END IF;
  SELECT COUNT(*) INTO n FROM pg_class c WHERE c.oid IN
   ('public.orvix_tenant_application_state_entries'::regclass,
    'public.orvix_tenant_application_state_status'::regclass)
   AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n<>2 THEN RAISE EXCEPTION 'Typed state tables must FORCE tenant RLS'; END IF;
  IF has_table_privilege('anon','public.orvix_tenant_application_state_entries','SELECT')
   OR has_table_privilege('anon','public.orvix_tenant_application_state_entries','INSERT')
   OR has_table_privilege('authenticated','public.orvix_tenant_application_state_entries','DELETE') THEN
    RAISE EXCEPTION 'Anonymous access or destructive client DELETE granted';
  END IF;
END $parity$;

SELECT set_config('app.test_tenant_id','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $tenant_a$
DECLARE n bigint;denied boolean:=false;
BEGIN
  SELECT count(*) INTO n FROM public.orvix_tenant_application_state_entries;
  IF n<>4 THEN RAISE EXCEPTION 'Tenant A can see % entries instead of four',n; END IF;
  SELECT count(*) INTO n FROM public.orvix_tenant_application_state_status;
  IF n<>1 THEN RAISE EXCEPTION 'Tenant A status view leaks cross-tenant',n; END IF;
  BEGIN
    UPDATE public.orvix_tenant_application_state_entries
      SET state_value='hacked'
    WHERE tenant_id='22222222-2222-2222-2222-222222222222' AND state_key='draft';
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied AND EXISTS (SELECT 1 FROM public.orvix_tenant_application_state_entries
    WHERE tenant_id='22222222-2222-2222-2222-222222222222'
      AND state_key='draft' AND state_value='hacked') THEN
    RAISE EXCEPTION 'Cross-tenant UPDATE became visible';
  END IF;
  denied:=false;
  BEGIN
    INSERT INTO public.orvix_tenant_application_state_entries
      (tenant_id,state_key,state_value)
    VALUES ('22222222-2222-2222-2222-222222222222','forged','wrong');
  EXCEPTION WHEN check_violation OR insufficient_privilege THEN
    denied:=true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Cross-tenant INSERT must be refused';
  END IF;
END $tenant_a$;
RESET ROLE;

SELECT set_config('app.test_tenant_id','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $tenant_b$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.orvix_tenant_application_state_entries;
  IF n<>2 THEN RAISE EXCEPTION 'Tenant B saw % keys instead of two',n; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.orvix_tenant_application_state_entries
   WHERE state_key='draft' AND state_value='testing') THEN
    RAISE EXCEPTION 'Tenant A changed Tenant B state';
  END IF;
END $tenant_b$;
RESET ROLE;

SELECT 'typed_application_state_key_value_backfill_passed' AS result;
