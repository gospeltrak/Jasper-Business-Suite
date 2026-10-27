-- PostgreSQL 17 synthetic staging assertion. No actual Orvix tenant data.
DO $verify$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.jasper_product_inventory_settings;
  IF n<>3 THEN RAISE EXCEPTION 'Expected 3 active typed settings, got %',n; END IF;

  SELECT count(*) INTO n FROM public.jasper_product_inventory_settings
  WHERE product_id='p-retail' AND costing_method='average_price'
    AND purchase_unit='Sack' AND base_unit='kg'
    AND conversion_to_base_unit=100 AND package_unit_price=245000
    AND half_package_price=123000 AND package_buying_cost=220000
    AND fraction_sale_enabled IS TRUE;
  IF n<>1 THEN RAISE EXCEPTION 'Retail costing, price or unit mapping lost'; END IF;

  SELECT count(*) INTO n FROM public.jasper_product_inventory_settings
  WHERE product_id='p-inactive';
  IF n<>0 THEN RAISE EXCEPTION 'Inactive historical product should remain source-only'; END IF;

  SELECT count(*) INTO n FROM public.jasper_fraction_sale_options
  WHERE tenant_id='11111111-1111-1111-1111-111111111111' AND product_id='p-retail';
  IF n<>2 THEN RAISE EXCEPTION 'Expected 2 exact fraction options, got %',n; END IF;

  SELECT count(*) INTO n FROM public.jasper_pharmacy_unit_breakdowns
  WHERE product_id='p-pharmacy' AND strips_per_box=10 AND tablets_per_strip=10;
  IF n<>1 THEN RAISE EXCEPTION 'Pharmacy unit ratio mapping lost'; END IF;

  SELECT count(*) INTO n FROM public.jasper_inventory_batches
  WHERE product_id='p-retail';
  IF n<>2 THEN RAISE EXCEPTION 'Expected 2 historic batches, got %',n; END IF;
  SELECT count(*) INTO n FROM public.jasper_inventory_batches
  WHERE legacy_batch_id='batch-one'
    AND price_change_percentage=12.123456789012345
    AND costing_method_at_creation='average_price'
    AND quantity_remaining_base=42 AND destination='store'
    AND source_ordinal=0 AND base_unit_explicit;
  IF n<>1 THEN RAISE EXCEPTION 'Historic batch lost precision, stock, destination or identity'; END IF;

  SELECT count(*) INTO n FROM public.jasper_inventory_batches
  WHERE legacy_batch_id='batch-two'
    AND base_unit='kg' AND base_unit_explicit IS FALSE
    AND quantity_remaining=0 AND status='finished' AND source_ordinal=1;
  IF n<>1 THEN RAISE EXCEPTION 'Missing-base-unit fallback or finished batch lost'; END IF;

  SELECT count(*) INTO n FROM public.orvix_product_package_levels;
  IF n<>3 THEN RAISE EXCEPTION 'Expected 3 package level records, got %',n; END IF;
  SELECT count(*) INTO n FROM public.orvix_product_selling_units;
  IF n<>3 THEN RAISE EXCEPTION 'Expected 3 selling unit records, got %',n; END IF;
  SELECT count(*) INTO n FROM public.orvix_product_pharmacy_levels;
  IF n<>3 THEN RAISE EXCEPTION 'Expected 3 pharmacy hierarchy levels, got %',n; END IF;

  SELECT count(*) INTO n FROM public.orvix_product_selling_units
  WHERE tenant_id='11111111-1111-1111-1111-111111111111' AND legacy_unit_id='unit-kg'
    AND package_level_id='base' AND price=2500 AND is_default IS TRUE;
  IF n<>1 THEN RAISE EXCEPTION 'Default retail selling unit relation lost'; END IF;

  SELECT count(*) INTO n
  FROM public.products p
  JOIN public.ci_original_product_hashes before ON before.tenant_id=p.tenant_id
    AND before.legacy_id=p.legacy_id
  WHERE md5(p.source_record::text) IS DISTINCT FROM before.expected_hash
    OR p.source_active IS DISTINCT FROM before.source_active;
  IF n<>0 THEN RAISE EXCEPTION 'Product source JSON was overwritten (%).',n; END IF;

  SELECT count(*) INTO n FROM public.tenant_workspaces w
  JOIN public.ci_original_workspaces before ON before.tenant_id=w.tenant_id
  WHERE md5(w.payload::text) IS DISTINCT FROM before.expected_hash;
  IF n<>0 THEN RAISE EXCEPTION 'Tenant workspace JSON was mutated'; END IF;

  SELECT count(*) INTO n FROM public.tenant_data d
  JOIN public.ci_original_backups before
   ON before.tenant_id=d.tenant_id AND before.data_key=d.data_key
  WHERE md5(d.payload::text) IS DISTINCT FROM before.expected_hash;
  IF n<>0 THEN RAISE EXCEPTION 'Protected legacy backup was mutated'; END IF;

  SELECT count(*) INTO n FROM pg_class c
  WHERE c.oid IN('public.orvix_product_package_levels'::regclass,
    'public.orvix_product_selling_units'::regclass,
    'public.orvix_product_pharmacy_levels'::regclass)
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n<>3 THEN RAISE EXCEPTION 'All three tenant child tables must force RLS'; END IF;

  IF has_table_privilege('anon','public.orvix_product_selling_units','SELECT')
   OR has_table_privilege('anon','public.orvix_product_package_levels','SELECT')
   OR has_table_privilege('anon','public.orvix_product_pharmacy_levels','SELECT') THEN
     RAISE EXCEPTION 'Anonymous access accidentally granted to normalized hierarchy';
  END IF;
END $verify$;

SELECT set_config('app.test_tenant_id','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $rls$
DECLARE packages bigint; selling bigint; pharmacy bigint;
BEGIN
  SELECT COUNT(*) INTO packages FROM public.orvix_product_package_levels;
  SELECT COUNT(*) INTO selling FROM public.orvix_product_selling_units;
  SELECT COUNT(*) INTO pharmacy FROM public.orvix_product_pharmacy_levels;
  IF packages<>2 OR selling<>2 OR pharmacy<>3 THEN
    RAISE EXCEPTION 'Tenant RLS scoped reads are wrong: packages %, selling %, pharmacy %',
      packages,selling,pharmacy;
  END IF;
END $rls$;
RESET ROLE;
SELECT set_config('app.test_tenant_id','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $rls$
DECLARE packages bigint; selling bigint; pharmacy bigint;
BEGIN
  SELECT COUNT(*) INTO packages FROM public.orvix_product_package_levels;
  SELECT COUNT(*) INTO selling FROM public.orvix_product_selling_units;
  SELECT COUNT(*) INTO pharmacy FROM public.orvix_product_pharmacy_levels;
  IF packages<>1 OR selling<>1 OR pharmacy<>0 THEN
    RAISE EXCEPTION 'Cross-tenant RLS leak or missing rows: packages %, selling %, pharmacy %',
      packages,selling,pharmacy;
  END IF;
END $rls$;
RESET ROLE;

SELECT 'synthetic_typed_json_inventory_backfill_passed' AS result;
