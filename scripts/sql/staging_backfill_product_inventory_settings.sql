-- STAGING ONLY — additive shadow backfill of already-existing inventory settings table.
-- DOES NOT edit products, source_record, source_active, stock, receipts or backups.
--
-- BEFORE RUNNING:
-- 1. Restore a verified tenant-scoped backup to ISOLATED STAGING (never production).
-- 2. Read scripts/sql/read_only_product_inventory_preflight.sql.
-- 3. Manually set the session parameter on staging only:
--       SET app.orvix_inventory_backfill_permission = 'STAGING_ONLY_RESTORE_TESTED';
-- 4. Execute this file on the SAME session. The guard fails closed otherwise.
-- 5. Run the read-only consistency check and POS regression suite.
--
-- Note: weighted_average is a historical alias of average_price; app code
-- normalizes only at runtime. This INSERT stores canonical costing_method in
-- a typed shadow table but DOES NOT rewrite the original source_record.
-- Values with >2dp pricing / >6dp conversion must be rejected rather than
-- rounded. `source_active=false` legacy records remain untouched.
BEGIN;

DO $preflight$
DECLARE v_invalid bigint;
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission', true)
       IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Refusing inventory backfill: isolated staging approval marker is missing.';
  END IF;

  SELECT count(*) INTO v_invalid
  FROM public.products p
  WHERE p.source_active
    AND jsonb_typeof(p.source_record->'inventorySettings') = 'object'
    AND (
      p.legacy_id IS NULL
      OR coalesce(p.source_record#>>'{inventorySettings,costingMethod}','') NOT IN
         ('fifo','average_price','batch_price','weighted_average')
      OR jsonb_typeof(p.source_record#>'{inventorySettings,allowPosMethodOverride}') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(p.source_record#>'{inventorySettings,allowScaleSelling}') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(p.source_record#>'{inventorySettings,purchaseUnit}') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p.source_record#>'{inventorySettings,baseUnit}') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p.source_record#>'{inventorySettings,conversionToBaseUnit}') IS DISTINCT FROM 'number'
      OR (
        jsonb_typeof(p.source_record#>'{inventorySettings,conversionToBaseUnit}') = 'number'
        AND (p.source_record#>>'{inventorySettings,conversionToBaseUnit}')::numeric <= 0
      )
      OR (
        jsonb_typeof(p.source_record#>'{inventorySettings,conversionToBaseUnit}') = 'number'
        AND (p.source_record#>>'{inventorySettings,conversionToBaseUnit}')::numeric
          IS DISTINCT FROM round((p.source_record#>>'{inventorySettings,conversionToBaseUnit}')::numeric, 6)
      )
      OR (
        p.source_record#>'{inventorySettings,defaultPricePerBaseUnit}' IS NOT NULL
        AND jsonb_typeof(p.source_record#>'{inventorySettings,defaultPricePerBaseUnit}') NOT IN ('null','number')
      )
      OR (
        jsonb_typeof(p.source_record#>'{inventorySettings,defaultPricePerBaseUnit}') = 'number'
        AND (p.source_record#>>'{inventorySettings,defaultPricePerBaseUnit}')::numeric
          IS DISTINCT FROM round((p.source_record#>>'{inventorySettings,defaultPricePerBaseUnit}')::numeric, 2)
      )
      OR (
        p.source_record->'inventorySettings' ? 'allowCustomQuantity'
        AND jsonb_typeof(p.source_record#>'{inventorySettings,allowCustomQuantity}') NOT IN ('null','boolean')
      )
    );
  IF v_invalid <> 0 THEN
    RAISE EXCEPTION 'Refusing inventory backfill: % incompatible source records; inspect read-only audit.', v_invalid;
  END IF;
END;
$preflight$;

-- Only active, backed-by-source records enter the shadow representation.
-- A repeated run inserts only missing records: NEVER overwrite a concurrent
-- typed edit. The verification below raises and rolls back on any mismatch.
INSERT INTO public.jasper_product_inventory_settings
  (tenant_id, product_id, costing_method, allow_pos_method_override,
   allow_scale_selling, purchase_unit, base_unit, conversion_to_base_unit,
   allow_custom_quantity, default_price_per_base_unit)
SELECT p.tenant_id::text, p.legacy_id,
  CASE p.source_record#>>'{inventorySettings,costingMethod}'
    WHEN 'weighted_average' THEN 'average_price'
    ELSE p.source_record#>>'{inventorySettings,costingMethod}'
  END,
  (p.source_record#>>'{inventorySettings,allowPosMethodOverride}')::boolean,
  (p.source_record#>>'{inventorySettings,allowScaleSelling}')::boolean,
  p.source_record#>>'{inventorySettings,purchaseUnit}',
  p.source_record#>>'{inventorySettings,baseUnit}',
  (p.source_record#>>'{inventorySettings,conversionToBaseUnit}')::numeric,
  coalesce((p.source_record#>>'{inventorySettings,allowCustomQuantity}')::boolean,false),
  (p.source_record#>>'{inventorySettings,defaultPricePerBaseUnit}')::numeric
FROM public.products AS p
WHERE p.source_active
  AND p.legacy_id IS NOT NULL
  AND jsonb_typeof(p.source_record->'inventorySettings') = 'object'
ON CONFLICT (tenant_id, product_id) DO NOTHING;

-- Full attribute parity, not merely row-count equality.
DO $verify$
DECLARE v_missing_or_mismatched bigint;
BEGIN
  WITH src AS (
    SELECT p.tenant_id::text AS tenant_id, p.legacy_id AS product_id,
      p.source_record->'inventorySettings' AS s
    FROM public.products AS p
    WHERE p.source_active AND p.legacy_id IS NOT NULL
      AND jsonb_typeof(p.source_record->'inventorySettings')='object'
  )
  SELECT COUNT(*) INTO v_missing_or_mismatched
  FROM src
  LEFT JOIN public.jasper_product_inventory_settings AS tgt
    ON tgt.tenant_id=src.tenant_id AND tgt.product_id=src.product_id
  WHERE tgt.id IS NULL
     OR tgt.costing_method IS DISTINCT FROM
        CASE src.s->>'costingMethod' WHEN 'weighted_average' THEN 'average_price'
             ELSE src.s->>'costingMethod' END
     OR tgt.allow_pos_method_override IS DISTINCT FROM (src.s->>'allowPosMethodOverride')::boolean
     OR tgt.allow_scale_selling IS DISTINCT FROM (src.s->>'allowScaleSelling')::boolean
     OR tgt.purchase_unit IS DISTINCT FROM src.s->>'purchaseUnit'
     OR tgt.base_unit IS DISTINCT FROM src.s->>'baseUnit'
     OR tgt.conversion_to_base_unit IS DISTINCT FROM (src.s->>'conversionToBaseUnit')::numeric
     OR tgt.allow_custom_quantity IS DISTINCT FROM coalesce((src.s->>'allowCustomQuantity')::boolean,false)
     OR tgt.default_price_per_base_unit IS DISTINCT FROM (src.s->>'defaultPricePerBaseUnit')::numeric;

  IF v_missing_or_mismatched <> 0 THEN
    RAISE EXCEPTION
      'Rolling back shadow settings backfill: % missing or nonmatching active source records.',
      v_missing_or_mismatched;
  END IF;
END;
$verify$;

COMMIT;
-- Shadow records are NOT wired to POS reads/writes until a separately tested
-- transactional dual-write and parity-checked tenant feature gate is added.
