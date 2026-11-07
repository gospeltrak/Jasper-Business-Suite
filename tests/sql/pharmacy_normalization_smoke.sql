-- Assertions for isolated Pharmacy normalization migration.
DO $test$
DECLARE
  v jsonb;
  v_count integer;
  v_number numeric;
BEGIN
  SELECT count(*) INTO v_count FROM public.product_pharmacy_unit_levels
    WHERE product_id='11111111-1111-4111-8111-111111111111';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Backfill failed: expected 3 levels, got %', v_count;
  END IF;

  SELECT tabs_per_dose INTO v_number FROM public.products
    WHERE id='11111111-1111-4111-8111-111111111111';
  IF v_number <> 10 THEN
    RAISE EXCEPTION 'Backfill failed: expected tabs_per_dose=10, got %', v_number;
  END IF;
  SELECT stock_qty INTO v_number FROM public.products
    WHERE id='11111111-1111-4111-8111-111111111111';
  IF v_number <> 50 THEN
    RAISE EXCEPTION 'Migration changed stock_qty';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products
    WHERE legacy_id='ordinary-1' AND (tabs_per_pack<>8 OR allows_dosage_dividing<>false OR stock_qty<>15)) THEN
    RAISE EXCEPTION 'Migration changed a non-pharmacy product';
  END IF;

  SELECT public.get_current_branch_product_fresh('medicine-1') INTO v;
  IF v->>'id' IS DISTINCT FROM 'medicine-1'
    OR (v->>'tabsPerDose')::numeric <> 10
    OR jsonb_array_length(v->'pharmacyUnitLevels')<>3 THEN
    RAISE EXCEPTION 'Normalized readback did not return the expected medicine data: %', v;
  END IF;

  -- Replace 3 hierarchy levels with 2; obsolete level must be deleted,
  -- and typed price/dose columns updated in the same product transaction.
  UPDATE public.products SET source_record =
    jsonb_set(jsonb_set(jsonb_set(source_record,
      '{tabsPerDose}','6'::jsonb),
      '{stripPrice}','3000'::jsonb),
      '{pharmacyUnitLevels}',
      '[{"id":"dose","label":"Dose","unit":"Dose","quantityToBaseUnit":6},{"id":"tabs","label":"Tablet","unit":"Tablet","quantityToBaseUnit":1}]'::jsonb)
  WHERE id='11111111-1111-4111-8111-111111111111';
  SELECT public.get_current_branch_product_fresh('medicine-1') INTO v;
  IF (v->>'tabsPerDose')::numeric <> 6
    OR (v->>'stripPrice')::numeric <> 3000
    OR jsonb_array_length(v->'pharmacyUnitLevels')<>2
    OR v->'pharmacyUnitLevels'->0->>'id' <> 'dose' THEN
    RAISE EXCEPTION 'Save/readback mismatch after edit: %', v;
  END IF;
  SELECT count(*) INTO v_count FROM public.product_pharmacy_unit_levels
    WHERE product_id='11111111-1111-4111-8111-111111111111';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Stale hierarchy rows remain after edit';
  END IF;

  -- Tenant isolation: only current tenant's product is readable.
  PERFORM set_config('test.tenant_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
  IF public.get_current_branch_product_fresh('medicine-1') IS NOT NULL THEN
    RAISE EXCEPTION 'Cross-tenant product data leaked';
  END IF;
  PERFORM set_config('test.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);

  -- Branch permission check must reject an authenticated non-admin user.
  PERFORM set_config('test.can_write','false', false);
  BEGIN
    PERFORM public.get_current_branch_product_fresh('medicine-1');
    RAISE EXCEPTION 'Missing products.write permission was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('test.can_write','true', false);

  -- Compatibility primary requires a tenant admin, matching the legacy saver.
  PERFORM set_config('test.scope','compatibility_primary', false);
  BEGIN
    PERFORM public.get_current_branch_product_fresh('medicine-1');
    RAISE EXCEPTION 'Compatibility primary accepted non-admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('test.is_admin','true', false);
  IF public.get_current_branch_product_fresh('medicine-1') IS NULL THEN
    RAISE EXCEPTION 'Tenant admin could not read saved pharmacy product';
  END IF;

  -- Stock quantities remain unchanged following edit.
  SELECT stock_qty INTO v_number FROM public.products
    WHERE id='11111111-1111-4111-8111-111111111111';
  IF v_number <> 50 THEN
    RAISE EXCEPTION 'Product edit mutated stock';
  END IF;
END;
$test$;

DO $security$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.product_pharmacy_unit_levels'::regclass) THEN
    RAISE EXCEPTION 'New normalized table must have RLS';
  END IF;
  IF has_function_privilege('anon','public.get_current_branch_product_fresh(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous caller can execute readback RPC';
  END IF;
  IF NOT has_function_privilege('authenticated','public.get_current_branch_product_fresh(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated tenant cannot execute readback RPC';
  END IF;
END;
$security$;
SELECT 'pharmacy_normalization_smoke_passed' AS result;
