-- STAGING ONLY — normalize universal retail/pharmacy unit hierarchy from
-- product source_record arrays into typed, tenant-isolated child tables.
-- Prerequisite: an isolated, independently restore-tested staging database.
--   SET app.orvix_inventory_backfill_permission = 'STAGING_ONLY_RESTORE_TESTED';
-- NO production SQL, live cutover, source JSON removal, or backup deletion.
BEGIN;
DO $permission$
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission',true)
     IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Missing staged restore approval; no unit hierarchy backfill.';
  END IF;
END $permission$;

CREATE TABLE IF NOT EXISTS public.orvix_product_package_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id text NOT NULL,
  legacy_level_id text NOT NULL,
  sort_order integer NOT NULL,
  label text NOT NULL,
  quantity_in_base_unit numeric NOT NULL CHECK(quantity_in_base_unit>0),
  is_purchase_unit boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,product_id,legacy_level_id)
);
CREATE TABLE IF NOT EXISTS public.orvix_product_selling_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id text NOT NULL,
  legacy_unit_id text NOT NULL,
  sort_order integer NOT NULL,
  package_level_id text NOT NULL,
  label text NOT NULL,
  price numeric NOT NULL CHECK(price>=0),
  is_default boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,product_id,legacy_unit_id)
);
CREATE TABLE IF NOT EXISTS public.orvix_product_pharmacy_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id text NOT NULL,
  legacy_level_id text NOT NULL,
  sort_order integer NOT NULL,
  label text NOT NULL,
  unit text NOT NULL,
  quantity_to_base_unit numeric NOT NULL CHECK(quantity_to_base_unit>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,product_id,legacy_level_id)
);
-- Public-schema tenant data MUST have RLS. Only authenticated reads are
-- granted; all writes go through privileged, audited staging operation.
ALTER TABLE public.orvix_product_package_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_product_package_levels FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_product_selling_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_product_selling_units FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_product_pharmacy_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_product_pharmacy_levels FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.orvix_product_package_levels FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.orvix_product_selling_units FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.orvix_product_pharmacy_levels FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.orvix_product_package_levels TO authenticated;
GRANT SELECT ON public.orvix_product_selling_units TO authenticated;
GRANT SELECT ON public.orvix_product_pharmacy_levels TO authenticated;
DROP POLICY IF EXISTS unit_package_tenant_read ON public.orvix_product_package_levels;
CREATE POLICY unit_package_tenant_read ON public.orvix_product_package_levels
FOR SELECT TO authenticated USING (tenant_id=private.current_tenant_id()::text);
DROP POLICY IF EXISTS unit_selling_tenant_read ON public.orvix_product_selling_units;
CREATE POLICY unit_selling_tenant_read ON public.orvix_product_selling_units
FOR SELECT TO authenticated USING (tenant_id=private.current_tenant_id()::text);
DROP POLICY IF EXISTS unit_pharmacy_tenant_read ON public.orvix_product_pharmacy_levels;
CREATE POLICY unit_pharmacy_tenant_read ON public.orvix_product_pharmacy_levels
FOR SELECT TO authenticated USING (tenant_id=private.current_tenant_id()::text);

DO $validate$
DECLARE n bigint;
BEGIN
  -- A type change, malformed item, non-positive quantity or duplicate
  -- source ID must abort: never silently discard a product configuration.
  SELECT count(*) INTO n
  FROM public.products p CROSS JOIN LATERAL
    (VALUES('packageLevels'),('sellingUnits'),('pharmacyUnitLevels')) f(key)
  WHERE p.source_active AND p.source_record ? f.key
    AND jsonb_typeof(p.source_record->f.key) IS DISTINCT FROM 'array';
  IF n>0 THEN RAISE EXCEPTION 'Malformed unit-level source arrays (%).',n; END IF;

  WITH levels AS (
    SELECT p.tenant_id::text tid,p.legacy_id pid,f.key kind,v.item,v.ord
    FROM public.products p
    CROSS JOIN (VALUES('packageLevels'),('sellingUnits'),('pharmacyUnitLevels')) f(key)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.source_record->f.key)='array'
        THEN p.source_record->f.key ELSE '[]'::jsonb END
    ) WITH ORDINALITY v(item,ord)
    WHERE p.source_active
  ), invalid AS (
    SELECT 1 FROM levels x WHERE x.pid IS NULL
       OR jsonb_typeof(x.item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(x.item->'id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(x.item->'label') IS DISTINCT FROM 'string'
       OR (x.kind='packageLevels' AND (
          jsonb_typeof(x.item->'quantityInBaseUnit') IS DISTINCT FROM 'number'
          OR coalesce((x.item->>'quantityInBaseUnit')::numeric,0)<=0
          OR (x.item ? 'isPurchaseUnit' AND
            jsonb_typeof(x.item->'isPurchaseUnit') IS DISTINCT FROM 'boolean')
       ))
       OR (x.kind='sellingUnits' AND (
          jsonb_typeof(x.item->'packageLevelId') IS DISTINCT FROM 'string'
          OR jsonb_typeof(x.item->'price') IS DISTINCT FROM 'number'
          OR coalesce((x.item->>'price')::numeric,-1)<0
          OR (x.item ? 'isDefault' AND
              jsonb_typeof(x.item->'isDefault') IS DISTINCT FROM 'boolean')
       ))
       OR (x.kind='pharmacyUnitLevels' AND (
          jsonb_typeof(x.item->'unit') IS DISTINCT FROM 'string'
          OR jsonb_typeof(x.item->'quantityToBaseUnit') IS DISTINCT FROM 'number'
          OR coalesce((x.item->>'quantityToBaseUnit')::numeric,0)<=0
       ))
  ), duplicate_keys AS (
    SELECT 1 FROM levels
    GROUP BY tid,pid,kind,item->>'id'
    HAVING COUNT(*)>1
  )
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM invalid UNION ALL SELECT 1 FROM duplicate_keys
  ) errors;
  IF n>0 THEN RAISE EXCEPTION 'Unit level validation failed for % entries.',n; END IF;

  -- Cross-check every selling unit's package reference before insert.
  SELECT count(*) INTO n
  FROM public.products p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.source_record->'sellingUnits')='array'
      THEN p.source_record->'sellingUnits' ELSE '[]'::jsonb END
  ) AS unit_item(value)
  WHERE p.source_active AND unit_item.value->>'packageLevelId' <> 'base'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p.source_record->'packageLevels')='array'
          THEN p.source_record->'packageLevels' ELSE '[]'::jsonb END
      ) package_item
      WHERE package_item->>'id'=unit_item.value->>'packageLevelId'
    );
  IF n>0 THEN RAISE EXCEPTION 'Selling units reference % missing package levels.',n; END IF;
END $validate$;

INSERT INTO public.orvix_product_package_levels
  (tenant_id,product_id,legacy_level_id,sort_order,label,quantity_in_base_unit,is_purchase_unit)
SELECT p.tenant_id::text,p.legacy_id,e.item->>'id',(e.ord-1)::integer,
  e.item->>'label',(e.item->>'quantityInBaseUnit')::numeric,(e.item->>'isPurchaseUnit')::boolean
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'packageLevels')='array'
    THEN p.source_record->'packageLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY e(item,ord)
WHERE p.source_active AND p.legacy_id IS NOT NULL
ON CONFLICT (tenant_id,product_id,legacy_level_id) DO NOTHING;

INSERT INTO public.orvix_product_selling_units
  (tenant_id,product_id,legacy_unit_id,sort_order,label,package_level_id,price,is_default)
SELECT p.tenant_id::text,p.legacy_id,e.item->>'id',(e.ord-1)::integer,
  e.item->>'label',e.item->>'packageLevelId',(e.item->>'price')::numeric,(e.item->>'isDefault')::boolean
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'sellingUnits')='array'
    THEN p.source_record->'sellingUnits' ELSE '[]'::jsonb END
) WITH ORDINALITY e(item,ord)
WHERE p.source_active AND p.legacy_id IS NOT NULL
ON CONFLICT (tenant_id,product_id,legacy_unit_id) DO NOTHING;

INSERT INTO public.orvix_product_pharmacy_levels
  (tenant_id,product_id,legacy_level_id,sort_order,label,unit,quantity_to_base_unit)
SELECT p.tenant_id::text,p.legacy_id,e.item->>'id',(e.ord-1)::integer,
  e.item->>'label',e.item->>'unit',(e.item->>'quantityToBaseUnit')::numeric
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels')='array'
    THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
) WITH ORDINALITY e(item,ord)
WHERE p.source_active AND p.legacy_id IS NOT NULL
ON CONFLICT (tenant_id,product_id,legacy_level_id) DO NOTHING;

DO $parity$
DECLARE n bigint;
BEGIN

  SELECT count(*) INTO n
  FROM public.products p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.source_record->'packageLevels')='array'
      THEN p.source_record->'packageLevels' ELSE '[]'::jsonb END
  ) WITH ORDINALITY e(item,ord)
  LEFT JOIN public.orvix_product_package_levels t
    ON t.tenant_id=p.tenant_id::text AND t.product_id=p.legacy_id
       AND t.legacy_level_id=e.item->>'id'
  WHERE p.source_active AND (
    t.id IS NULL OR t.sort_order IS DISTINCT FROM (e.ord-1)::integer
    OR t.label IS DISTINCT FROM e.item->>'label'
    OR t.quantity_in_base_unit IS DISTINCT FROM (e.item->>'quantityInBaseUnit')::numeric
    OR t.is_purchase_unit IS DISTINCT FROM (e.item->>'isPurchaseUnit')::boolean
  );
  IF n>0 THEN
    RAISE EXCEPTION 'Unit hierarchy packageLevels shadow mismatch: % entries.',n;
  END IF;

  SELECT count(*) INTO n
  FROM public.products p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.source_record->'sellingUnits')='array'
      THEN p.source_record->'sellingUnits' ELSE '[]'::jsonb END
  ) WITH ORDINALITY e(item,ord)
  LEFT JOIN public.orvix_product_selling_units t
    ON t.tenant_id=p.tenant_id::text AND t.product_id=p.legacy_id
       AND t.legacy_unit_id=e.item->>'id'
  WHERE p.source_active AND (
    t.id IS NULL OR t.sort_order IS DISTINCT FROM (e.ord-1)::integer
    OR t.label IS DISTINCT FROM e.item->>'label'
    OR t.package_level_id IS DISTINCT FROM e.item->>'packageLevelId'
    OR t.price IS DISTINCT FROM (e.item->>'price')::numeric
    OR t.is_default IS DISTINCT FROM (e.item->>'isDefault')::boolean
  );
  IF n>0 THEN
    RAISE EXCEPTION 'Unit hierarchy sellingUnits shadow mismatch: % entries.',n;
  END IF;

  SELECT count(*) INTO n
  FROM public.products p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.source_record->'pharmacyUnitLevels')='array'
      THEN p.source_record->'pharmacyUnitLevels' ELSE '[]'::jsonb END
  ) WITH ORDINALITY e(item,ord)
  LEFT JOIN public.orvix_product_pharmacy_levels t
    ON t.tenant_id=p.tenant_id::text AND t.product_id=p.legacy_id
       AND t.legacy_level_id=e.item->>'id'
  WHERE p.source_active AND (
    t.id IS NULL OR t.sort_order IS DISTINCT FROM (e.ord-1)::integer
    OR t.label IS DISTINCT FROM e.item->>'label'
    OR t.unit IS DISTINCT FROM e.item->>'unit'
    OR t.quantity_to_base_unit IS DISTINCT FROM (e.item->>'quantityToBaseUnit')::numeric
  );
  IF n>0 THEN
    RAISE EXCEPTION 'Unit hierarchy pharmacyUnitLevels shadow mismatch: % entries.',n;
  END IF;

END $parity$;
COMMIT;
-- Do not turn on typed reads until same-transaction writes and complete
-- parity checking cover all further product edits and offline replay.
