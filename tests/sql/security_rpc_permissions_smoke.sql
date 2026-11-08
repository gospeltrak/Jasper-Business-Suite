-- Assert all 20 privileged RPCs lose anonymous EXECUTE without breaking signed-in clients.
DO $$
DECLARE count_all integer; count_anon integer; count_authenticated integer; count_service integer; count_backend_only integer; fixed_path text[];
BEGIN
 SELECT count(*),
        count(*) FILTER (WHERE has_function_privilege('anon',p.oid,'EXECUTE')),
        count(*) FILTER (WHERE has_function_privilege('authenticated',p.oid,'EXECUTE')),
        count(*) FILTER (WHERE has_function_privilege('service_role',p.oid,'EXECUTE'))
 INTO count_all,count_anon,count_authenticated,count_service
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef;
 IF count_all <> 20 THEN RAISE EXCEPTION 'Expected exactly 20 test SECURITY DEFINER functions, got %',count_all; END IF;
 IF count_anon <> 0 THEN RAISE EXCEPTION 'Anonymous EXECUTE remains on % RPC(s)',count_anon; END IF;
 IF count_authenticated <> 19 THEN RAISE EXCEPTION 'Expected 19 authenticated RPCs, got %',count_authenticated; END IF;
 IF count_service <> 20 THEN RAISE EXCEPTION 'Expected 20 service_role RPCs, got %',count_service; END IF;
 SELECT count(*) INTO count_backend_only
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='provision_primary_branch_for_new_tenant'
   AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE');
 IF count_backend_only <> 1 THEN RAISE EXCEPTION 'Backend-only provisioning RPC is exposed'; END IF;
 SELECT p.proconfig INTO fixed_path
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='set_updated_at';
 IF NOT ('search_path=""'=ANY(fixed_path)) THEN
   RAISE EXCEPTION 'Mutable set_updated_at search_path: %',fixed_path;
 END IF;
 RAISE NOTICE 'Security RPC permissions smoke test passed';
END $$;
