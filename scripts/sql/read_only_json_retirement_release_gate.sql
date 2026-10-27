-- Non-invasive release gate for retiring business JSON blobs.
-- Read-only, safe for production or staging. NEVER returns any tenant's
-- personal/financial details or deletes historical source data.
BEGIN TRANSACTION READ ONLY;

WITH
 product_source AS (
   SELECT tenant_id::text tenant_id,legacy_id,source_record
   FROM public.products
   WHERE source_active
 ),
 inventory_source AS (
   SELECT tenant_id,legacy_id,source_record FROM product_source
   WHERE jsonb_typeof(source_record->'inventorySettings')='object'
 ),
 batch_source AS (
   SELECT p.tenant_id,p.legacy_id,b.value
   FROM product_source p
   CROSS JOIN LATERAL jsonb_array_elements(CASE
     WHEN jsonb_typeof(p.source_record->'batches')='array' THEN p.source_record->'batches'
     ELSE '[]'::jsonb END) b
 ),
 package_source AS (
   SELECT p.tenant_id,p.legacy_id,x.value
   FROM product_source p
   CROSS JOIN LATERAL jsonb_array_elements(CASE
     WHEN jsonb_typeof(p.source_record->'packageLevels')='array' THEN p.source_record->'packageLevels'
     ELSE '[]'::jsonb END) x
 ),
 selling_source AS (
   SELECT p.tenant_id,p.legacy_id,x.value
   FROM product_source p
   CROSS JOIN LATERAL jsonb_array_elements(CASE
     WHEN jsonb_typeof(p.source_record->'sellingUnits')='array' THEN p.source_record->'sellingUnits'
     ELSE '[]'::jsonb END) x
 ),
 pharmacy_source AS (
   SELECT p.tenant_id,p.legacy_id,x.value
   FROM product_source p
   CROSS JOIN LATERAL jsonb_array_elements(CASE
     WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels')='array' THEN p.source_record->'pharmacyUnitLevels'
     ELSE '[]'::jsonb END) x
 )
SELECT
 (SELECT COUNT(*) FROM public.tenant_workspaces) AS tenants_with_workspaces,
 (SELECT COUNT(*) FROM public.products WHERE source_active) AS active_normalized_product_rows,
 (SELECT COUNT(*) FROM inventory_source) AS inventory_settings_expected,
 (SELECT COUNT(*) FROM inventory_source s
   LEFT JOIN public.jasper_product_inventory_settings t
   ON t.tenant_id=s.tenant_id AND t.product_id=s.legacy_id
   WHERE t.id IS NULL) AS missing_typed_inventory_settings,
 (SELECT COUNT(*) FROM batch_source) AS historical_batches_expected,
 (SELECT COUNT(*) FROM public.jasper_inventory_batches) AS typed_historical_batches,
 (SELECT COUNT(*) FROM package_source) AS package_levels_expected,
 (SELECT COUNT(*) FROM selling_source) AS selling_units_expected,
 (SELECT COUNT(*) FROM pharmacy_source) AS pharmacy_levels_expected,
 (SELECT COUNT(*) FROM public.expenses WHERE source_active
   AND source_record->>'receiptImage' LIKE 'data:%') AS payment_receipt_images_still_inline,
 (SELECT COUNT(*) FROM public.sales WHERE source_active
   AND source_record ? 'paymentBreakdown') AS sales_payment_breakdowns_still_in_legacy_source,
 (SELECT COUNT(*) FROM public.tenant_data
   WHERE data_key LIKE 'data_backup_%') AS protected_data_backup_rows,
 (SELECT COUNT(*) FROM public.tenant_data
   WHERE data_key LIKE 'workspace_backup_%') AS protected_workspace_backup_rows,
 pg_size_pretty(pg_total_relation_size('public.tenant_data')) AS legacy_relation_disk_footprint,
 FALSE AS safe_to_drop_source_record_now;

-- The always-false final field is deliberate: mere record counts never
-- prove transactional typed writes, row/field parity, receipts or audit
-- history. Only a restore-tested and explicitly approved cutover can make
-- that claim; this query is an inspection, not an approval switch.
COMMIT;
