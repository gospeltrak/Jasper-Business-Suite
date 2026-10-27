-- STAGING-ONLY. Extend EXISTING typed tables for remaining inventorySettings
-- optional scalar fields; backfill fraction-sale and medicine-unit children.
-- This script NEVER changes products, their source_record, stock, financials,
-- legacy backups, settings, permissions, tenant_workspaces, or auth.users.
--
-- Prerequisite (isolated restore-tested staging, NOT live):
-- Run staging_backfill_product_inventory_settings.sql first, then run this
-- script in the SAME SESSION as the staging permission marker:
-- SET app.orvix_inventory_backfill_permission = 'STAGING_ONLY_RESTORE_TESTED';
--
-- Only AFTER full parity can application reads/writes be switched transactionally.
-- SQL is intentionally NOT a production auto-applied Supabase migration.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission', true)
     IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Staging restore/approval marker missing; extension denied.';
  END IF;
  IF (SELECT COUNT(*) FROM public.jasper_product_inventory_settings)
      < (SELECT COUNT(*) FROM public.products
         WHERE source_active AND legacy_id IS NOT NULL
           AND jsonb_typeof(source_record->'inventorySettings')='object') THEN
    RAISE EXCEPTION 'Base settings shadow backfill must be reconciled first.';
  END IF;
END;
$guard$;

ALTER TABLE public.jasper_product_inventory_settings
  ADD COLUMN IF NOT EXISTS package_unit_price numeric(18,2),
  ADD COLUMN IF NOT EXISTS whole_package_price numeric(18,2),
  ADD COLUMN IF NOT EXISTS half_package_price numeric(18,2),
  ADD COLUMN IF NOT EXISTS package_buying_cost numeric(18,2),
  ADD COLUMN IF NOT EXISTS fraction_sale_enabled boolean,
  ADD COLUMN IF NOT EXISTS packet_price_overridden boolean;

-- Existing child table omits the source option identifier; keep it to
-- faithfully reconstruct 1/4, 1/2 and custom options in their original order.
ALTER TABLE public.jasper_fraction_sale_options
  ADD COLUMN IF NOT EXISTS legacy_option_id text;

CREATE UNIQUE INDEX IF NOT EXISTS
  jasper_fraction_sale_options_tenant_product_legacy_option_uidx
ON public.jasper_fraction_sale_options (tenant_id, product_id, legacy_option_id)
WHERE legacy_option_id IS NOT NULL;

DO $validate$
DECLARE v_invalid bigint;
BEGIN
  WITH raw AS (
    SELECT p.source_record->'inventorySettings' AS settings
    FROM public.products p WHERE p.source_active
      AND jsonb_typeof(p.source_record->'inventorySettings')='object'
  ), scalar_error AS (
    SELECT 1 FROM raw r CROSS JOIN
      (VALUES('packageUnitPrice'),('wholePackagePrice'),('halfPackagePrice'),
             ('packageBuyingCost')) AS fields(k)
    WHERE (r.settings ? fields.k AND jsonb_typeof(r.settings->fields.k) NOT IN('number','null'))
       OR (jsonb_typeof(r.settings->fields.k)='number'
           AND (r.settings->>fields.k)::numeric
               IS DISTINCT FROM round((r.settings->>fields.k)::numeric,2))
    UNION ALL
    SELECT 1 FROM raw r CROSS JOIN
      (VALUES('fractionSaleEnabled'),('packetPriceOverridden')) AS fields(k)
    WHERE r.settings ? fields.k
      AND jsonb_typeof(r.settings->fields.k) NOT IN('boolean','null')
  ), malformed_options AS (
    SELECT 1 FROM raw r
    WHERE r.settings ? 'fractionSaleOptions'
      AND jsonb_typeof(r.settings->'fractionSaleOptions') IS DISTINCT FROM 'array'
  ), invalid_options AS (
    SELECT 1
    FROM raw r CROSS JOIN LATERAL
      jsonb_array_elements(CASE
        WHEN jsonb_typeof(r.settings->'fractionSaleOptions')='array'
          THEN r.settings->'fractionSaleOptions'
        ELSE '[]'::jsonb END) AS opt(value)
    WHERE jsonb_typeof(opt.value) IS DISTINCT FROM 'object'
      OR jsonb_typeof(opt.value->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(opt.value->'label') IS DISTINCT FROM 'string'
      OR jsonb_typeof(opt.value->'quantityInBaseUnit') IS DISTINCT FROM 'number'
      OR coalesce((opt.value->>'quantityInBaseUnit')::numeric,0)<=0
      OR (opt.value->>'quantityInBaseUnit')::numeric
          IS DISTINCT FROM round((opt.value->>'quantityInBaseUnit')::numeric,6)
      OR (opt.value ? 'price' AND jsonb_typeof(opt.value->'price') NOT IN('null','number'))
      OR (jsonb_typeof(opt.value->'price')='number'
          AND (opt.value->>'price')::numeric
              IS DISTINCT FROM round((opt.value->>'price')::numeric,2))
      OR (opt.value ? 'isDefault'
          AND jsonb_typeof(opt.value->'isDefault') NOT IN('boolean','null'))
  ), invalid_pharmacy AS (
    SELECT 1 FROM raw r
    WHERE r.settings ? 'pharmacyUnitBreakdown'
      AND jsonb_typeof(r.settings->'pharmacyUnitBreakdown') IS DISTINCT FROM 'object'
    UNION ALL
    SELECT 1 FROM raw r
    WHERE jsonb_typeof(r.settings->'pharmacyUnitBreakdown')='object'
      AND (
        jsonb_typeof(r.settings#>'{pharmacyUnitBreakdown,purchaseUnit}') IS DISTINCT FROM 'string'
        OR jsonb_typeof(r.settings#>'{pharmacyUnitBreakdown,stripUnit}') IS DISTINCT FROM 'string'
        OR jsonb_typeof(r.settings#>'{pharmacyUnitBreakdown,baseUnit}') IS DISTINCT FROM 'string'
        OR jsonb_typeof(r.settings#>'{pharmacyUnitBreakdown,stripsPerBox}') IS DISTINCT FROM 'number'
        OR jsonb_typeof(r.settings#>'{pharmacyUnitBreakdown,tabletsPerStrip}') IS DISTINCT FROM 'number'
        OR coalesce((r.settings#>>'{pharmacyUnitBreakdown,stripsPerBox}')::numeric,0)<=0
        OR coalesce((r.settings#>>'{pharmacyUnitBreakdown,tabletsPerStrip}')::numeric,0)<=0
        OR (r.settings#>>'{pharmacyUnitBreakdown,stripsPerBox}')::numeric IS DISTINCT FROM round((r.settings#>>'{pharmacyUnitBreakdown,stripsPerBox}')::numeric,6)
        OR (r.settings#>>'{pharmacyUnitBreakdown,tabletsPerStrip}')::numeric IS DISTINCT FROM round((r.settings#>>'{pharmacyUnitBreakdown,tabletsPerStrip}')::numeric,6)
      )
  )
  SELECT COUNT(*) INTO v_invalid FROM (
    SELECT 1 FROM scalar_error UNION ALL
    SELECT 1 FROM malformed_options UNION ALL
    SELECT 1 FROM invalid_options UNION ALL
    SELECT 1 FROM invalid_pharmacy
  ) err;
  IF v_invalid <> 0 THEN
    RAISE EXCEPTION 'Aborting extension: % incompatible extended inventory settings.',v_invalid;
  END IF;
END;
$validate$;

-- Do not overwrite a pre-existing typed business edit. Abort if a populated
-- shadow field would differ from its source value.
DO $no_drift$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n
  FROM public.products p JOIN public.jasper_product_inventory_settings t
    ON t.tenant_id=p.tenant_id::text AND t.product_id=p.legacy_id
  WHERE p.source_active AND jsonb_typeof(p.source_record->'inventorySettings')='object'
    AND (
      (t.package_unit_price IS NOT NULL AND t.package_unit_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packageUnitPrice}')::numeric)
      OR (t.whole_package_price IS NOT NULL AND t.whole_package_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,wholePackagePrice}')::numeric)
      OR (t.half_package_price IS NOT NULL AND t.half_package_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,halfPackagePrice}')::numeric)
      OR (t.package_buying_cost IS NOT NULL AND t.package_buying_cost IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packageBuyingCost}')::numeric)
      OR (t.fraction_sale_enabled IS NOT NULL AND t.fraction_sale_enabled IS DISTINCT FROM (p.source_record#>>'{inventorySettings,fractionSaleEnabled}')::boolean)
      OR (t.packet_price_overridden IS NOT NULL AND t.packet_price_overridden IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packetPriceOverridden}')::boolean)
    );
  IF n > 0 THEN RAISE EXCEPTION 'Shadow settings drift detected: % rows; aborting.',n; END IF;
END;
$no_drift$;

UPDATE public.jasper_product_inventory_settings t
SET package_unit_price=(p.source_record#>>'{inventorySettings,packageUnitPrice}')::numeric,
    whole_package_price=(p.source_record#>>'{inventorySettings,wholePackagePrice}')::numeric,
    half_package_price=(p.source_record#>>'{inventorySettings,halfPackagePrice}')::numeric,
    package_buying_cost=(p.source_record#>>'{inventorySettings,packageBuyingCost}')::numeric,
    fraction_sale_enabled=(p.source_record#>>'{inventorySettings,fractionSaleEnabled}')::boolean,
    packet_price_overridden=(p.source_record#>>'{inventorySettings,packetPriceOverridden}')::boolean
FROM public.products p
WHERE t.tenant_id=p.tenant_id::text AND t.product_id=p.legacy_id
  AND p.source_active
  AND jsonb_typeof(p.source_record->'inventorySettings')='object'
  AND (
    t.package_unit_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packageUnitPrice}')::numeric
    OR t.whole_package_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,wholePackagePrice}')::numeric
    OR t.half_package_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,halfPackagePrice}')::numeric
    OR t.package_buying_cost IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packageBuyingCost}')::numeric
    OR t.fraction_sale_enabled IS DISTINCT FROM (p.source_record#>>'{inventorySettings,fractionSaleEnabled}')::boolean
    OR t.packet_price_overridden IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packetPriceOverridden}')::boolean
  );

INSERT INTO public.jasper_fraction_sale_options
  (tenant_id,product_id,legacy_option_id,label,quantity_in_base_unit,price,is_default,sort_order)
SELECT p.tenant_id::text,p.legacy_id,opt.value->>'id',
  opt.value->>'label',(opt.value->>'quantityInBaseUnit')::numeric,
  (opt.value->>'price')::numeric,
  coalesce((opt.value->>'isDefault')::boolean,false), (opt.ord-1)::integer
FROM public.products p CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record#>'{inventorySettings,fractionSaleOptions}')='array'
       THEN p.source_record#>'{inventorySettings,fractionSaleOptions}'
       ELSE '[]'::jsonb END
) WITH ORDINALITY AS opt(value,ord)
WHERE p.source_active AND p.legacy_id IS NOT NULL
ON CONFLICT (tenant_id,product_id,legacy_option_id)
WHERE legacy_option_id IS NOT NULL DO NOTHING;

INSERT INTO public.jasper_pharmacy_unit_breakdowns
  (tenant_id,product_id,purchase_unit,strip_unit,base_unit,strips_per_box,tablets_per_strip)
SELECT p.tenant_id::text,p.legacy_id,
  p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,purchaseUnit}',
  p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,stripUnit}',
  p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,baseUnit}',
  (p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,stripsPerBox}')::numeric,
  (p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,tabletsPerStrip}')::numeric
FROM public.products p
WHERE p.source_active AND p.legacy_id IS NOT NULL
  AND jsonb_typeof(p.source_record#>'{inventorySettings,pharmacyUnitBreakdown}')='object'
ON CONFLICT (tenant_id,product_id) DO NOTHING;

DO $parity$
DECLARE bad_scalars bigint; bad_options bigint; bad_pharmacy bigint;
BEGIN
  SELECT count(*) INTO bad_scalars
  FROM public.products p LEFT JOIN public.jasper_product_inventory_settings t
    ON t.tenant_id=p.tenant_id::text AND t.product_id=p.legacy_id
  WHERE p.source_active AND jsonb_typeof(p.source_record->'inventorySettings')='object'
    AND (t.id IS NULL
      OR t.package_unit_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packageUnitPrice}')::numeric
      OR t.whole_package_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,wholePackagePrice}')::numeric
      OR t.half_package_price IS DISTINCT FROM (p.source_record#>>'{inventorySettings,halfPackagePrice}')::numeric
      OR t.package_buying_cost IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packageBuyingCost}')::numeric
      OR t.fraction_sale_enabled IS DISTINCT FROM (p.source_record#>>'{inventorySettings,fractionSaleEnabled}')::boolean
      OR t.packet_price_overridden IS DISTINCT FROM (p.source_record#>>'{inventorySettings,packetPriceOverridden}')::boolean);

  WITH options AS (
    SELECT p.tenant_id::text tid,p.legacy_id pid,(opt.ord-1)::integer AS ordinal,opt.value v
    FROM public.products p CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.source_record#>'{inventorySettings,fractionSaleOptions}')='array'
           THEN p.source_record#>'{inventorySettings,fractionSaleOptions}'
           ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS opt(value,ord)
    WHERE p.source_active AND p.legacy_id IS NOT NULL
  )
  SELECT count(*) INTO bad_options
  FROM options o LEFT JOIN public.jasper_fraction_sale_options f
    ON f.tenant_id=o.tid AND f.product_id=o.pid AND f.legacy_option_id=o.v->>'id'
  WHERE f.id IS NULL OR f.sort_order IS DISTINCT FROM o.ordinal
    OR f.label IS DISTINCT FROM o.v->>'label'
    OR f.quantity_in_base_unit IS DISTINCT FROM (o.v->>'quantityInBaseUnit')::numeric
    OR f.price IS DISTINCT FROM (o.v->>'price')::numeric
    OR f.is_default IS DISTINCT FROM coalesce((o.v->>'isDefault')::boolean,false);

  SELECT count(*) INTO bad_pharmacy
  FROM public.products p LEFT JOIN public.jasper_pharmacy_unit_breakdowns d
    ON d.tenant_id=p.tenant_id::text AND d.product_id=p.legacy_id
  WHERE p.source_active
    AND jsonb_typeof(p.source_record#>'{inventorySettings,pharmacyUnitBreakdown}')='object'
    AND (d.id IS NULL
      OR d.purchase_unit IS DISTINCT FROM (p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,purchaseUnit}')
      OR d.strip_unit IS DISTINCT FROM (p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,stripUnit}')
      OR d.base_unit IS DISTINCT FROM (p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,baseUnit}')
      OR d.strips_per_box IS DISTINCT FROM (p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,stripsPerBox}')::numeric
      OR d.tablets_per_strip IS DISTINCT FROM (p.source_record#>>'{inventorySettings,pharmacyUnitBreakdown,tabletsPerStrip}')::numeric);

  IF bad_scalars<>0 OR bad_options<>0 OR bad_pharmacy<>0 THEN
    RAISE EXCEPTION 'Typed inventory parity failure: scalar %, option %, pharmacy %.',
      bad_scalars,bad_options,bad_pharmacy;
  END IF;
END;
$parity$;
COMMIT;
-- No live read cutover, source deletion, receipt change or backup prune here.