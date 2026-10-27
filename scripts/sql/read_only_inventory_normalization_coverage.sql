-- Production-safe READ ONLY. Never reveal customer payloads/tenant IDs.
-- Run once before staging, after staging-only backfill, and before any cutover.
BEGIN TRANSACTION READ ONLY;
WITH active AS (
  SELECT p.tenant_id::text AS tenant_id,p.legacy_id,p.source_record->'inventorySettings' AS settings
  FROM public.products p
  WHERE p.source_active AND jsonb_typeof(p.source_record->'inventorySettings')='object'
)
SELECT count(*) AS active_product_inventory_settings,
       count(*) FILTER(WHERE settings ? 'packageUnitPrice') AS package_unit_prices,
       count(*) FILTER(WHERE settings ? 'halfPackagePrice') AS half_package_prices,
       count(*) FILTER(WHERE settings ? 'wholePackagePrice') AS whole_package_prices,
       count(*) FILTER(WHERE settings ? 'packageBuyingCost') AS package_buying_costs,
       count(*) FILTER(WHERE settings ? 'fractionSaleEnabled') AS fractional_switches,
       count(*) FILTER(WHERE settings ? 'fractionSaleOptions') AS products_with_explicit_fraction_options,
       count(*) FILTER(WHERE settings ? 'pharmacyUnitBreakdown') AS pharmacy_unit_breakdowns,
       count(*) FILTER(WHERE t.id IS NOT NULL) AS typed_base_rows_present,
       count(*) FILTER(WHERE t.id IS NULL) AS typed_base_rows_missing
FROM active a LEFT JOIN public.jasper_product_inventory_settings t
  ON t.tenant_id=a.tenant_id AND t.product_id=a.legacy_id;

SELECT count(*) AS active_explicit_fraction_options
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record#>'{inventorySettings,fractionSaleOptions}')='array'
    THEN p.source_record#>'{inventorySettings,fractionSaleOptions}' ELSE '[]'::jsonb END) AS opt
WHERE p.source_active;

SELECT count(*) AS existing_typed_fraction_rows
FROM public.jasper_fraction_sale_options;
SELECT count(*) AS existing_typed_pharmacy_rows
FROM public.jasper_pharmacy_unit_breakdowns;

-- Empty target before backfill is expected. A read switch is NEVER enabled
-- until per-field parity, branch isolation and transactionally synced writes.
COMMIT;
