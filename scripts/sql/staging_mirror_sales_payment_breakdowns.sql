-- STAGING ONLY: prove same-transaction typed mirroring for subsequent
-- normalized public.sales writes without ever removing source_record JSON.
-- Run only after staging_backfill_sales_payment_breakdowns.sql on a
-- restore-tested isolated staging database. NO production deployment.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission',true)
     IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Refusing typed sale-payment mirror outside verified staging.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.sales'::regclass
      AND tgname='orvix_sales_payment_breakdown_shadow_trigger'
      AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Existing sale payment shadow trigger must be reviewed before reinstalling.';
  END IF;
END $guard$;

-- Inactive and superseded typed rows are retained as historical shadow
-- entries; no DELETE is used, even if an edited breakdown gets shorter.
ALTER TABLE public.orvix_sale_payment_breakdown_headers
  ADD COLUMN IF NOT EXISTS source_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.orvix_sale_payment_breakdown_lines
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION private.orvix_mirror_sale_payment_breakdown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_is_present boolean;
  v_count integer;
  v_hash text;
BEGIN
  -- Authoritative sale rows are created and permission-checked by their
  -- existing write RPC. Trigger only writes typed shadows with NEW's exact
  -- immutable tenant + sale identity, never takes tenant ID from the client.
  IF TG_OP='UPDATE' AND (
       NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
     ) THEN
    RAISE EXCEPTION 'Sale tenant or legacy payment identity cannot be changed.';
  END IF;

  IF NEW.legacy_id IS NULL OR btrim(NEW.legacy_id)='' THEN
    RETURN NEW;
  END IF;

  IF NOT NEW.source_active THEN
    UPDATE public.orvix_sale_payment_breakdown_headers h
      SET source_active=false
      WHERE h.tenant_id=NEW.tenant_id AND h.sale_id=NEW.legacy_id;
    UPDATE public.orvix_sale_payment_breakdown_lines l
      SET is_current=false
      WHERE l.tenant_id=NEW.tenant_id AND l.sale_id=NEW.legacy_id
        AND l.is_current;
    RETURN NEW;
  END IF;

  IF TG_OP='UPDATE'
     AND NEW.source_active IS NOT DISTINCT FROM OLD.source_active
     AND NEW.source_record IS NOT DISTINCT FROM OLD.source_record THEN
    RETURN NEW;
  END IF;

  v_is_present := coalesce(NEW.source_record ? 'paymentBreakdown',false);
  IF v_is_present
    AND jsonb_typeof(NEW.source_record->'paymentBreakdown') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Sale paymentBreakdown must remain a JSON array.';
  END IF;

  WITH source_lines AS (
    SELECT e.item FROM jsonb_array_elements(CASE
      WHEN jsonb_typeof(NEW.source_record->'paymentBreakdown')='array'
      THEN NEW.source_record->'paymentBreakdown' ELSE '[]'::jsonb END) AS e(item)
  )
  SELECT count(*) INTO v_count FROM source_lines WHERE
       jsonb_typeof(item) IS DISTINCT FROM 'object'
    OR jsonb_typeof(item->'method') IS DISTINCT FROM 'string'
    OR btrim(item->>'method')=''
    OR jsonb_typeof(item->'amount') IS DISTINCT FROM 'number'
    OR (item->>'amount')::numeric < 0
    OR (item->>'amount')::numeric IS DISTINCT FROM round((item->>'amount')::numeric,2)
    OR (item ? 'reference' AND
        jsonb_typeof(item->'reference') NOT IN ('string','null'))
    OR (item - 'method' - 'amount' - 'reference') <> '{}'::jsonb;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'Sale payment breakdown has % incompatible line records.',v_count;
  END IF;

  v_count := CASE WHEN v_is_present
    THEN jsonb_array_length(NEW.source_record->'paymentBreakdown')
    ELSE 0 END;
  v_hash := CASE WHEN v_is_present
    THEN md5((NEW.source_record->'paymentBreakdown')::text) ELSE NULL END;

  INSERT INTO public.orvix_sale_payment_breakdown_headers
    (tenant_id,sale_id,field_present,entry_count,source_array_hash,source_active)
  VALUES (NEW.tenant_id,NEW.legacy_id,v_is_present,v_count,v_hash,true)
  ON CONFLICT (tenant_id,sale_id) DO UPDATE
    SET field_present=EXCLUDED.field_present,
        entry_count=EXCLUDED.entry_count,
        source_array_hash=EXCLUDED.source_array_hash,
        source_active=true;

  -- A line no longer in the current JSON is not deleted; its is_current
  -- flag is reset atomically with the sale's original write.
  UPDATE public.orvix_sale_payment_breakdown_lines l
    SET is_current=false
    WHERE l.tenant_id=NEW.tenant_id AND l.sale_id=NEW.legacy_id
      AND l.is_current;

  INSERT INTO public.orvix_sale_payment_breakdown_lines
    (tenant_id,sale_id,source_ordinal,payment_method,amount,
     reference_present,payment_reference,is_current)
  SELECT NEW.tenant_id,NEW.legacy_id,(x.ord-1)::integer,
    x.item->>'method',(x.item->>'amount')::numeric,
    (x.item ? 'reference'),x.item->>'reference',true
  FROM jsonb_array_elements(
    CASE WHEN v_is_present THEN NEW.source_record->'paymentBreakdown'
    ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS x(item,ord)
  ON CONFLICT (tenant_id,sale_id,source_ordinal) DO UPDATE SET
    payment_method=EXCLUDED.payment_method,
    amount=EXCLUDED.amount,
    reference_present=EXCLUDED.reference_present,
    payment_reference=EXCLUDED.payment_reference,
    is_current=true;

  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION private.orvix_mirror_sale_payment_breakdown()
  FROM PUBLIC,anon,authenticated;

CREATE TRIGGER orvix_sales_payment_breakdown_shadow_trigger
AFTER INSERT OR UPDATE OF source_record,source_active
ON public.sales
FOR EACH ROW EXECUTE FUNCTION private.orvix_mirror_sale_payment_breakdown();
COMMIT;

-- Not a live cutover. Typed reads must filter is_current AND source_active.
-- Removing the staging trigger for rollback does NOT delete customer sales:
-- DROP TRIGGER orvix_sales_payment_breakdown_shadow_trigger ON public.sales;
