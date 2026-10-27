-- STAGING ONLY: represent historic inventory batches without truncating
-- price-change percentage or silently replacing legacy product stock.
-- Run only on an ISOLATED, independently restorable, non-production staging
-- database, after the base inventorySettings staging backfill has passed.
-- No live table is changed by merely committing this file.
--
-- In the SAME staging SQL session:
--   SET app.orvix_inventory_backfill_permission = 'STAGING_ONLY_RESTORE_TESTED';
-- Existing products/source_record/stock/expenses/sales/backups remain untouched.
BEGIN;

DO $guard$
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission',true)
      IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Unverified staging session: refusing historical batch migration.';
  END IF;
  IF (
    SELECT count(*) FROM public.jasper_product_inventory_settings
  ) < (
    SELECT count(*) FROM public.products
    WHERE source_active AND legacy_id IS NOT NULL
      AND jsonb_typeof(source_record->'inventorySettings')='object'
  ) THEN
    RAISE EXCEPTION 'Product inventory settings staging prerequisite has not passed.';
  END IF;
END;
$guard$;

-- Critical: a real 2026-10-27 source batch uses 15 decimal places for its
-- historic price-change percentage, while the old type was numeric(12,4).
-- Use unrestricted numeric rather than a silent rounding/truncation.
ALTER TABLE public.jasper_inventory_batches
  ALTER COLUMN price_change_percentage TYPE numeric;

ALTER TABLE public.jasper_inventory_batches
  ADD COLUMN IF NOT EXISTS legacy_batch_id text,
  ADD COLUMN IF NOT EXISTS source_product_id text,
  ADD COLUMN IF NOT EXISTS source_ordinal bigint,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS quantity_purchased_base numeric,
  ADD COLUMN IF NOT EXISTS quantity_remaining_base numeric,
  ADD COLUMN IF NOT EXISTS base_unit_explicit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz,
  ADD COLUMN IF NOT EXISTS manufacturing_date timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS
  jasper_inventory_batches_tenant_product_legacy_batch_uidx
  ON public.jasper_inventory_batches (tenant_id,product_id,legacy_batch_id)
  WHERE legacy_batch_id IS NOT NULL;

DO $validate$
DECLARE v_bad bigint;
BEGIN
  -- The existence of a non-array batches property is a hard error; never
  -- skip an unrecognized data shape and then claim reconciliation succeeded.
  SELECT COUNT(*) INTO v_bad
  FROM public.products p
  WHERE p.source_active AND p.source_record ? 'batches'
    AND jsonb_typeof(p.source_record->'batches') IS DISTINCT FROM 'array';
  IF v_bad<>0 THEN
    RAISE EXCEPTION 'Malformed product batches arrays: % source rows.',v_bad;
  END IF;

  WITH batches AS (
    SELECT p.tenant_id::text AS tenant_id,p.legacy_id AS product_id,
      p.source_record AS product_json,
      b.value AS j,(b.ord-1)::bigint AS ordinal
    FROM public.products p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.source_record->'batches')='array'
           THEN p.source_record->'batches' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS b(value,ord)
    WHERE p.source_active
  ), malformed AS (
    SELECT 1 FROM batches b
    WHERE b.product_id IS NULL
       OR jsonb_typeof(b.j) IS DISTINCT FROM 'object'
       OR jsonb_typeof(b.j->'id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(b.j->'productId') IS DISTINCT FROM 'string'
       OR b.j->>'productId' IS DISTINCT FROM b.product_id
       OR jsonb_typeof(b.j->'batchNumber') IS DISTINCT FROM 'string'
       OR jsonb_typeof(b.j->'purchaseDate') IS DISTINCT FROM 'string'
       OR jsonb_typeof(b.j->'createdAt') IS DISTINCT FROM 'string'
       OR jsonb_typeof(b.j->'quantityPurchased') IS DISTINCT FROM 'number'
       OR jsonb_typeof(b.j->'quantityRemaining') IS DISTINCT FROM 'number'
       OR jsonb_typeof(b.j->'buyingPrice') IS DISTINCT FROM 'number'
       OR jsonb_typeof(b.j->'costingMethodAtCreation') IS DISTINCT FROM 'string'
       OR b.j->>'costingMethodAtCreation' NOT IN
           ('fifo','average_price','batch_price','weighted_average')
       OR b.j->>'status' NOT IN ('active','finished')
       OR coalesce((b.j->>'quantityPurchased')::numeric,0)<=0
       OR coalesce((b.j->>'quantityRemaining')::numeric,-1)<0
       OR coalesce((b.j->>'buyingPrice')::numeric,-1)<0
       OR (b.j->>'quantityPurchased')::numeric IS DISTINCT FROM
           round((b.j->>'quantityPurchased')::numeric,6)
       OR (b.j->>'quantityRemaining')::numeric IS DISTINCT FROM
           round((b.j->>'quantityRemaining')::numeric,6)
       OR (b.j->>'buyingPrice')::numeric IS DISTINCT FROM
           round((b.j->>'buyingPrice')::numeric,2)
       OR (b.j ? 'baseUnit' AND jsonb_typeof(b.j->'baseUnit') IS DISTINCT FROM 'string')
       OR nullif(coalesce(b.j->>'baseUnit',
            b.product_json#>>'{inventorySettings,baseUnit}',
            b.product_json->>'baseUnit',b.product_json->>'unit'),'') IS NULL
       OR (b.j ? 'destination' AND jsonb_typeof(b.j->'destination') IS DISTINCT FROM 'string')
       OR (b.j ? 'quantityPurchasedBase'
           AND jsonb_typeof(b.j->'quantityPurchasedBase') IS DISTINCT FROM 'number')
       OR (b.j ? 'quantityRemainingBase'
           AND jsonb_typeof(b.j->'quantityRemainingBase') IS DISTINCT FROM 'number')
       OR (b.j ? 'quantityPurchasedBase' AND
          (b.j->>'quantityPurchasedBase')::numeric IS DISTINCT FROM
          round((b.j->>'quantityPurchasedBase')::numeric,6))
       OR (b.j ? 'quantityRemainingBase' AND
          (b.j->>'quantityRemainingBase')::numeric IS DISTINCT FROM
          round((b.j->>'quantityRemainingBase')::numeric,6))
       OR (b.j ? 'previousBuyingPrice' AND
          (b.j->>'previousBuyingPrice')::numeric IS DISTINCT FROM
          round((b.j->>'previousBuyingPrice')::numeric,2))
       OR (b.j ? 'suggestedSellingPrice' AND
          (b.j->>'suggestedSellingPrice')::numeric IS DISTINCT FROM
          round((b.j->>'suggestedSellingPrice')::numeric,2))
       OR (b.j ? 'finalSellingPrice' AND
          (b.j->>'finalSellingPrice')::numeric IS DISTINCT FROM
          round((b.j->>'finalSellingPrice')::numeric,2))
       OR (b.j ? 'priceChangePercentage'
           AND jsonb_typeof(b.j->'priceChangePercentage') IS DISTINCT FROM 'number')
       OR (b.j ? 'previousBuyingPrice'
           AND jsonb_typeof(b.j->'previousBuyingPrice') IS DISTINCT FROM 'number')
       OR (b.j ? 'suggestedSellingPrice'
           AND jsonb_typeof(b.j->'suggestedSellingPrice') IS DISTINCT FROM 'number')
       OR (b.j ? 'finalSellingPrice'
           AND jsonb_typeof(b.j->'finalSellingPrice') IS DISTINCT FROM 'number')
  ), duplicate_keys AS (
    SELECT 1
    FROM batches
    GROUP BY tenant_id,product_id,j->>'id'
    HAVING count(*)>1
  )
  SELECT count(*) INTO v_bad FROM
  (SELECT 1 FROM malformed UNION ALL SELECT 1 FROM duplicate_keys) errors;
  IF v_bad<>0 THEN
    RAISE EXCEPTION 'Historical batch validation failed for % objects, rolling back.',v_bad;
  END IF;
END;
$validate$;

-- Snapshot source rows are read under the same transaction as the shadow
-- inserts; shadow tables remain an UNCONNECTED representation until a
-- separately reviewed same-transaction dual-write and read feature gate.
INSERT INTO public.jasper_inventory_batches (
  tenant_id,product_id,legacy_batch_id,source_product_id,source_ordinal,
  batch_number,purchase_id,purchase_date,quantity_purchased,
  quantity_remaining,base_unit,base_unit_explicit,buying_price,
  previous_buying_price,price_change_percentage,suggested_selling_price,
  final_selling_price,costing_method_at_creation,status,created_by,
  created_at,supplier_name,destination,quantity_purchased_base,
  quantity_remaining_base,expiry_date,manufacturing_date
)
SELECT p.tenant_id::text,p.legacy_id,j->>'id',j->>'productId',
  (v.ord-1)::bigint,
  j->>'batchNumber',j->>'purchaseId',(j->>'purchaseDate')::timestamptz,
  (j->>'quantityPurchased')::numeric,(j->>'quantityRemaining')::numeric,
  coalesce(j->>'baseUnit',p.source_record#>>'{inventorySettings,baseUnit}',
           p.source_record->>'baseUnit',p.source_record->>'unit'),
  j ? 'baseUnit',(j->>'buyingPrice')::numeric,
  (j->>'previousBuyingPrice')::numeric,(j->>'priceChangePercentage')::numeric,
  (j->>'suggestedSellingPrice')::numeric,(j->>'finalSellingPrice')::numeric,
  CASE j->>'costingMethodAtCreation'
    WHEN 'weighted_average' THEN 'average_price'
    ELSE j->>'costingMethodAtCreation' END,
  j->>'status',j->>'createdBy',(j->>'createdAt')::timestamptz,
  j->>'supplierName',j->>'destination',
  (j->>'quantityPurchasedBase')::numeric,
  (j->>'quantityRemainingBase')::numeric,
  (j->>'expiryDate')::timestamptz,(j->>'manufacturingDate')::timestamptz
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'batches')='array'
       THEN p.source_record->'batches' ELSE '[]'::jsonb END
) WITH ORDINALITY v(j,ord)
WHERE p.source_active AND p.legacy_id IS NOT NULL
ON CONFLICT (tenant_id,product_id,legacy_batch_id)
  WHERE legacy_batch_id IS NOT NULL DO NOTHING;

-- Prove every source batch has the exact matching typed representation.
-- This also rejects conflicting existing shadow edits (ON CONFLICT DO NOTHING
-- is *not* permission to silently replace or ignore different source fields).
DO $parity$
DECLARE bad bigint;
BEGIN
  WITH expected AS (
    SELECT p.tenant_id::text tid,p.legacy_id pid,p.source_record pj,
      v.j,(v.ord-1)::bigint ord
    FROM public.products p CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.source_record->'batches')='array'
           THEN p.source_record->'batches' ELSE '[]'::jsonb END
    ) WITH ORDINALITY v(j,ord)
    WHERE p.source_active AND p.legacy_id IS NOT NULL
  )
  SELECT COUNT(*) INTO bad
  FROM expected e
  LEFT JOIN public.jasper_inventory_batches b
    ON b.tenant_id=e.tid AND b.product_id=e.pid
       AND b.legacy_batch_id=e.j->>'id'
  WHERE b.id IS NULL
    OR b.source_product_id IS DISTINCT FROM e.j->>'productId'
    OR b.source_ordinal IS DISTINCT FROM e.ord
    OR b.batch_number IS DISTINCT FROM e.j->>'batchNumber'
    OR b.purchase_id IS DISTINCT FROM e.j->>'purchaseId'
    OR b.purchase_date IS DISTINCT FROM (e.j->>'purchaseDate')::timestamptz
    OR b.quantity_purchased IS DISTINCT FROM (e.j->>'quantityPurchased')::numeric
    OR b.quantity_remaining IS DISTINCT FROM (e.j->>'quantityRemaining')::numeric
    OR b.base_unit IS DISTINCT FROM
      coalesce(e.j->>'baseUnit',e.pj#>>'{inventorySettings,baseUnit}',
               e.pj->>'baseUnit',e.pj->>'unit')
    OR b.base_unit_explicit IS DISTINCT FROM (e.j ? 'baseUnit')
    OR b.buying_price IS DISTINCT FROM (e.j->>'buyingPrice')::numeric
    OR b.previous_buying_price IS DISTINCT FROM (e.j->>'previousBuyingPrice')::numeric
    OR b.price_change_percentage IS DISTINCT FROM (e.j->>'priceChangePercentage')::numeric
    OR b.suggested_selling_price IS DISTINCT FROM (e.j->>'suggestedSellingPrice')::numeric
    OR b.final_selling_price IS DISTINCT FROM (e.j->>'finalSellingPrice')::numeric
    OR b.costing_method_at_creation IS DISTINCT FROM
      CASE e.j->>'costingMethodAtCreation'
        WHEN 'weighted_average' THEN 'average_price'
        ELSE e.j->>'costingMethodAtCreation' END
    OR b.status IS DISTINCT FROM e.j->>'status'
    OR b.created_by IS DISTINCT FROM e.j->>'createdBy'
    OR b.created_at IS DISTINCT FROM (e.j->>'createdAt')::timestamptz
    OR b.supplier_name IS DISTINCT FROM e.j->>'supplierName'
    OR b.destination IS DISTINCT FROM e.j->>'destination'
    OR b.quantity_purchased_base IS DISTINCT FROM
      (e.j->>'quantityPurchasedBase')::numeric
    OR b.quantity_remaining_base IS DISTINCT FROM
      (e.j->>'quantityRemainingBase')::numeric
    OR b.expiry_date IS DISTINCT FROM (e.j->>'expiryDate')::timestamptz
    OR b.manufacturing_date IS DISTINCT FROM
      (e.j->>'manufacturingDate')::timestamptz;
  IF bad<>0 THEN
    RAISE EXCEPTION 'Historical batch parity failed for % records. All writes rolled back.',bad;
  END IF;
END;
$parity$;

COMMIT;
-- Do not DELETE source_record or enable reads from the shadow table.
