-- Additive pharmacy normalization. Preserve source_record for backward compatibility.
-- No product deletion, no tenant-wide rewrites and no stock quantity changes.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pharmacy_product_type text,
  ADD COLUMN IF NOT EXISTS pharmacy_hierarchy_start text,
  ADD COLUMN IF NOT EXISTS pharmacy_base_unit text,
  ADD COLUMN IF NOT EXISTS doses_per_packet numeric,
  ADD COLUMN IF NOT EXISTS tabs_per_dose numeric,
  ADD COLUMN IF NOT EXISTS packet_price numeric,
  ADD COLUMN IF NOT EXISTS strip_price numeric,
  ADD COLUMN IF NOT EXISTS full_dose_price numeric,
  ADD COLUMN IF NOT EXISTS half_dose_price numeric,
  ADD COLUMN IF NOT EXISTS tab_price numeric;

-- One hierarchy level per row; linked by internal product UUID, not legacy IDs.
CREATE TABLE IF NOT EXISTS public.product_pharmacy_unit_levels (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  level_id text NOT NULL,
  ordinal integer NOT NULL,
  label text NOT NULL,
  unit text NOT NULL,
  quantity_to_base_unit numeric NOT NULL CHECK (quantity_to_base_unit > 0),
  PRIMARY KEY (product_id, level_id),
  UNIQUE (product_id, ordinal)
);
CREATE INDEX IF NOT EXISTS product_pharmacy_unit_levels_product_idx
  ON public.product_pharmacy_unit_levels(product_id);
ALTER TABLE public.product_pharmacy_unit_levels ENABLE ROW LEVEL SECURITY;
-- No direct client grants or policies. Access remains through tenant-scoped RPCs.

-- Keep scalar columns synchronized with the existing authenticated product-save RPC.
-- This is an additive bridge while reads migrate to typed columns.
CREATE OR REPLACE FUNCTION private.sync_pharmacy_product_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v jsonb := coalesce(NEW.source_record, '{}'::jsonb);
BEGIN
  NEW.pharmacy_product_type := nullif(v->>'pharmacyProductType','');
  NEW.pharmacy_hierarchy_start := nullif(v->>'pharmacyHierarchyStart','');
  NEW.pharmacy_base_unit := nullif(v->>'pharmacyBaseUnit','');
  NEW.doses_per_packet := CASE WHEN (v->>'dosesPerPacket') ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'dosesPerPacket')::numeric ELSE NULL END;
  NEW.tabs_per_dose := CASE WHEN (v->>'tabsPerDose') ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'tabsPerDose')::numeric ELSE NULL END;
  NEW.tabs_per_pack := CASE WHEN (v->>'tabsPerPack') ~ '^[0-9]+$' THEN (v->>'tabsPerPack')::integer ELSE NEW.tabs_per_pack END;
  NEW.packet_price := CASE WHEN (v->>'packetPrice') ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'packetPrice')::numeric ELSE NULL END;
  NEW.strip_price := CASE WHEN (v->>'stripPrice') ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'stripPrice')::numeric ELSE NULL END;
  NEW.full_dose_price := CASE WHEN (v->>'fullDosePrice') ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'fullDosePrice')::numeric ELSE NULL END;
  NEW.half_dose_price := CASE WHEN (v->>'halfDosePrice') ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'halfDosePrice')::numeric ELSE NULL END;
  NEW.tab_price := CASE WHEN (v->>'tabPrice') ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'tabPrice')::numeric ELSE NULL END;
  NEW.allows_dosage_dividing := CASE WHEN v ? 'allowsDosageDividing' THEN (v->>'allowsDosageDividing')::boolean ELSE NEW.allows_dosage_dividing END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_pharmacy_product_columns ON public.products;
CREATE TRIGGER sync_pharmacy_product_columns
  BEFORE INSERT OR UPDATE OF source_record ON public.products
  FOR EACH ROW EXECUTE FUNCTION private.sync_pharmacy_product_columns();

-- Keep child hierarchy rows current for every product edit in the same transaction.
CREATE OR REPLACE FUNCTION private.sync_pharmacy_product_levels()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.source_record->'pharmacyUnitLevels'
    IS NOT DISTINCT FROM OLD.source_record->'pharmacyUnitLevels' THEN
    RETURN NEW;
  END IF;
  DELETE FROM public.product_pharmacy_unit_levels WHERE product_id = NEW.id;
  INSERT INTO public.product_pharmacy_unit_levels
    (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
  SELECT NEW.id, level.value->>'id', (level.ordinality - 1)::integer,
    coalesce(level.value->>'label',''), coalesce(level.value->>'unit',''),
    (level.value->>'quantityToBaseUnit')::numeric
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(NEW.source_record->'pharmacyUnitLevels') = 'array'
      THEN NEW.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS level(value, ordinality)
  WHERE nullif(level.value->>'id','') IS NOT NULL
    AND (level.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
    AND (level.value->>'quantityToBaseUnit')::numeric > 0;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS sync_pharmacy_product_levels ON public.products;
CREATE TRIGGER sync_pharmacy_product_levels
  AFTER INSERT OR UPDATE OF source_record ON public.products
  FOR EACH ROW EXECUTE FUNCTION private.sync_pharmacy_product_levels();

-- Backfill only pharmacy-specific columns for existing rows, without touching stock.
UPDATE public.products p SET
  pharmacy_product_type = nullif(p.source_record->>'pharmacyProductType',''),
  pharmacy_hierarchy_start = nullif(p.source_record->>'pharmacyHierarchyStart',''),
  pharmacy_base_unit = nullif(p.source_record->>'pharmacyBaseUnit',''),
  doses_per_packet = CASE WHEN p.source_record->>'dosesPerPacket' ~ '^[0-9]+([.][0-9]+)?

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
 THEN (p.source_record->>'dosesPerPacket')::numeric ELSE NULL END,
  tabs_per_dose = CASE WHEN p.source_record->>'tabsPerDose' ~ '^[0-9]+([.][0-9]+)?

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
 THEN (p.source_record->>'tabsPerDose')::numeric ELSE NULL END,
  packet_price = CASE WHEN p.source_record->>'packetPrice' ~ '^[0-9]+([.][0-9]+)?

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
 THEN (p.source_record->>'packetPrice')::numeric ELSE NULL END,
  strip_price = CASE WHEN p.source_record->>'stripPrice' ~ '^[0-9]+([.][0-9]+)?

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
 THEN (p.source_record->>'stripPrice')::numeric ELSE NULL END,
  full_dose_price = CASE WHEN p.source_record->>'fullDosePrice' ~ '^[0-9]+([.][0-9]+)?

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
 THEN (p.source_record->>'fullDosePrice')::numeric ELSE NULL END,
  half_dose_price = CASE WHEN p.source_record->>'halfDosePrice' ~ '^[0-9]+([.][0-9]+)?

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
 THEN (p.source_record->>'halfDosePrice')::numeric ELSE NULL END,
  tab_price = CASE WHEN p.source_record->>'tabPrice' ~ '^[0-9]+([.][0-9]+)?

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
 THEN (p.source_record->>'tabPrice')::numeric ELSE NULL END
WHERE p.source_active AND (
  p.source_record ? 'pharmacyUnitLevels' OR p.source_record ? 'tabsPerDose'
  OR p.source_record ? 'pharmacyProductType');

-- Insert hierarchy levels only for products with well-formed arrays.
INSERT INTO public.product_pharmacy_unit_levels
  (product_id, level_id, ordinal, label, unit, quantity_to_base_unit)
SELECT p.id, item.value->>'id', (item.ordinality - 1)::integer,
       coalesce(item.value->>'label',''), coalesce(item.value->>'unit',''),
       (item.value->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels') = 'array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY AS item(value, ordinality)
WHERE p.source_active
  AND nullif(item.value->>'id','') IS NOT NULL
  AND (item.value->>'quantityToBaseUnit') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.value->>'quantityToBaseUnit')::numeric > 0
ON CONFLICT (product_id, level_id) DO NOTHING;

-- Single-row authoritative product readback: no whole-workspace download.
-- Permission is checked against the current selected branch and tenant.
CREATE OR REPLACE FUNCTION public.get_current_branch_product_fresh(p_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_product jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_tenant IS NULL OR nullif(p_product_id,'') IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='Active tenant and product required';
  END IF;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  IF v_context->>'activeScope' <> 'branch' OR v_branch IS NULL
    OR NOT private.can_write_branch(v_tenant,v_branch,'products.write') THEN
    RAISE EXCEPTION USING errcode='42501', message='Product permission required';
  END IF;
  SELECT p.source_record || jsonb_strip_nulls(jsonb_build_object(
    'pharmacyProductType', p.pharmacy_product_type,
    'pharmacyHierarchyStart', p.pharmacy_hierarchy_start,
    'pharmacyBaseUnit', p.pharmacy_base_unit,
    'dosesPerPacket', p.doses_per_packet,
    'tabsPerDose', p.tabs_per_dose,
    'tabsPerPack', p.tabs_per_pack,
    'packetPrice', p.packet_price,
    'stripPrice', p.strip_price,
    'fullDosePrice', p.full_dose_price,
    'halfDosePrice', p.half_dose_price,
    'tabPrice', p.tab_price,
    'allowsDosageDividing', p.allows_dosage_dividing,
    'pharmacyUnitLevels', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.level_id, 'label', l.label, 'unit', l.unit,
        'quantityToBaseUnit', l.quantity_to_base_unit) ORDER BY l.ordinal)
      FROM public.product_pharmacy_unit_levels l WHERE l.product_id=p.id
    ),'[]'::jsonb)
  )) INTO v_product
  FROM public.products p
  WHERE p.tenant_id=v_tenant AND p.legacy_id=p_product_id AND p.source_active
  LIMIT 1;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.get_current_branch_product_fresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_branch_product_fresh(text) TO authenticated;
