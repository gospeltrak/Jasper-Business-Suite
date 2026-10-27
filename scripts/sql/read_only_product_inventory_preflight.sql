-- READ ONLY: verify safe inventory-settings migration eligibility.
-- Returns aggregate counts; never exposes tenant or product identities/JSON.
BEGIN TRANSACTION READ ONLY;

WITH candidates AS (
  SELECT p.source_active,
         p.legacy_id,
         p.source_record->'inventorySettings' AS settings
  FROM public.products p
  WHERE jsonb_typeof(p.source_record->'inventorySettings') = 'object'
), expected AS (
  SELECT source_active,legacy_id,settings,
         CASE settings->>'costingMethod'
           WHEN 'weighted_average' THEN 'average_price'
           ELSE settings->>'costingMethod'
         END AS canonical_costing_method
  FROM candidates
)
SELECT count(*) AS historical_with_inventory_settings,
       count(*) FILTER (WHERE source_active) AS active_for_shadow_backfill,
       count(*) FILTER (WHERE NOT source_active) AS inactive_preserve_only,
       count(*) FILTER (WHERE source_active AND canonical_costing_method='average_price' AND settings->>'costingMethod'='weighted_average')
         AS legacy_weighted_average_preserved_as_canonical,
       count(*) FILTER (WHERE source_active AND (
         legacy_id IS NULL
         OR canonical_costing_method NOT IN ('fifo','average_price','batch_price')
         OR jsonb_typeof(settings->'allowPosMethodOverride') IS DISTINCT FROM 'boolean'
         OR jsonb_typeof(settings->'allowScaleSelling') IS DISTINCT FROM 'boolean'
         OR jsonb_typeof(settings->'purchaseUnit') IS DISTINCT FROM 'string'
         OR jsonb_typeof(settings->'baseUnit') IS DISTINCT FROM 'string'
         OR jsonb_typeof(settings->'conversionToBaseUnit') IS DISTINCT FROM 'number'
         OR (jsonb_typeof(settings->'conversionToBaseUnit')='number'
             AND (settings->>'conversionToBaseUnit')::numeric <= 0)
         OR (jsonb_typeof(settings->'conversionToBaseUnit')='number'
             AND (settings->>'conversionToBaseUnit')::numeric IS DISTINCT FROM
                 round((settings->>'conversionToBaseUnit')::numeric,6))
         OR (settings ? 'defaultPricePerBaseUnit'
             AND jsonb_typeof(settings->'defaultPricePerBaseUnit') NOT IN ('number','null'))
         OR (jsonb_typeof(settings->'defaultPricePerBaseUnit')='number'
             AND (settings->>'defaultPricePerBaseUnit')::numeric IS DISTINCT FROM
                 round((settings->>'defaultPricePerBaseUnit')::numeric,2))
         OR (settings ? 'allowCustomQuantity'
             AND jsonb_typeof(settings->'allowCustomQuantity') NOT IN('boolean','null'))
       )) AS blocked_incompatible_rows
FROM expected;

SELECT count(*) AS existing_typed_settings FROM public.jasper_product_inventory_settings;

-- Never use these metrics to authorize dropping source_record or tenant_data.
SELECT count(*) AS products, count(*) FILTER(WHERE source_record IS NOT NULL) products_with_legacy_source,
       count(*) FILTER(WHERE source_active) active_products FROM public.products;

COMMIT;
