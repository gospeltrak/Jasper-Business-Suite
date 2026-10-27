-- Real PostgreSQL 17 roundtrip checks on disposable synthetic data.
DO $assert_sale_breakdown$
DECLARE n bigint;
BEGIN
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_headers;
 IF n<>4 THEN RAISE EXCEPTION 'Expected 4 active sale headers, found %',n; END IF;
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_lines;
 IF n<>4 THEN RAISE EXCEPTION 'Expected 4 payment lines, found %',n; END IF;

 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_headers
 WHERE sale_id='sale-mixed' AND field_present AND entry_count=3;
 IF n<>1 THEN RAISE EXCEPTION 'Multi-payment sale header missing'; END IF;
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_headers
 WHERE sale_id='sale-explicit-empty' AND field_present AND entry_count=0;
 IF n<>1 THEN RAISE EXCEPTION 'Explicit [] payment array not retained'; END IF;
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_headers
 WHERE sale_id='sale-no-breakdown' AND NOT field_present AND entry_count=0
 AND source_array_hash IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Absent JSON key must not become empty array'; END IF;
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_headers
 WHERE sale_id='sale-inactive-archive';
 IF n<>0 THEN RAISE EXCEPTION 'Inactive sale must remain historical only'; END IF;

 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_lines
 WHERE sale_id='sale-mixed' AND source_ordinal=0 AND payment_method='Mpesa'
 AND amount=540000 AND reference_present AND payment_reference='TX-ABC';
 IF n<>1 THEN RAISE EXCEPTION 'Mpesa payment amount/reference lost'; END IF;
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_lines
 WHERE sale_id='sale-mixed' AND source_ordinal=1 AND payment_method='Cash'
 AND amount=0 AND NOT reference_present;
 IF n<>1 THEN RAISE EXCEPTION 'Zero payment or absent reference lost'; END IF;
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_breakdown_lines
 WHERE sale_id='sale-mixed' AND source_ordinal=2 AND amount=1250.50
 AND reference_present AND payment_reference IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Explicit null reference not retained'; END IF;

 SELECT COUNT(*) INTO n
 FROM public.sales s JOIN public.ci_original_sale_hashes old
 ON old.tenant_id=s.tenant_id AND old.legacy_id=s.legacy_id
 WHERE md5(s.source_record::text) IS DISTINCT FROM old.expected_hash
 OR s.source_active IS DISTINCT FROM old.source_active;
 IF n<>0 THEN RAISE EXCEPTION 'Sales source_record was changed'; END IF;

 SELECT COUNT(*) INTO n FROM pg_class c
 WHERE c.oid IN (
  'public.orvix_sale_payment_breakdown_headers'::regclass,
  'public.orvix_sale_payment_breakdown_lines'::regclass
 ) AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n<>2 THEN RAISE EXCEPTION 'Sale payment shadow tables must force RLS'; END IF;

 IF has_table_privilege('anon','public.orvix_sale_payment_breakdown_headers','SELECT')
 OR has_table_privilege('anon','public.orvix_sale_payment_breakdown_lines','SELECT') THEN
 RAISE EXCEPTION 'Anonymous read on payment details must never be allowed';
 END IF;
END $assert_sale_breakdown$;

SELECT set_config('app.test_tenant_id','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $verify_tenant_a$
DECLARE heads bigint; lines bigint;
BEGIN
 SELECT count(*) INTO heads FROM public.orvix_sale_payment_breakdown_headers;
 SELECT count(*) INTO lines FROM public.orvix_sale_payment_breakdown_lines;
 IF heads<>3 OR lines<>3 THEN
 RAISE EXCEPTION 'Tenant A payment isolation failed headers % lines %',heads,lines;
 END IF;
END $verify_tenant_a$;
-- Being signed in must not allow users to mutate payment history via REST.
DO $reject_mutation$
DECLARE was_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.orvix_sale_payment_breakdown_lines
      (tenant_id,sale_id,source_ordinal,payment_method,amount)
    VALUES ('11111111-1111-1111-1111-111111111111','sale-mixed',99,'Mpesa',999999);
  EXCEPTION WHEN insufficient_privilege THEN
    was_denied := true;
  END;
  IF NOT was_denied THEN
    RAISE EXCEPTION 'Authenticated user must not be able to forge typed payment rows';
  END IF;
END $reject_mutation$;
RESET ROLE;

SELECT set_config('app.test_tenant_id','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $verify_tenant_b$
DECLARE heads bigint; lines bigint;
BEGIN
 SELECT count(*) INTO heads FROM public.orvix_sale_payment_breakdown_headers;
 SELECT count(*) INTO lines FROM public.orvix_sale_payment_breakdown_lines;
 IF heads<>1 OR lines<>1 THEN
 RAISE EXCEPTION 'Tenant B payment isolation failed headers % lines %',heads,lines;
 END IF;
END $verify_tenant_b$;
RESET ROLE;
SELECT 'sale_payment_breakdown_synthetic_roundtrip_passed' AS result;
