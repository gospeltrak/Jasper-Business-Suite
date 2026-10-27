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

-- Inactive lines are retained, and every overwritten line version is
-- copied to a separate, append-only typed audit table. Never DELETE rows.
ALTER TABLE public.orvix_sale_payment_breakdown_headers
  ADD COLUMN IF NOT EXISTS source_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.orvix_sale_payment_breakdown_lines
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

-- Append-only relational evidence for an old payment-line version whenever
-- a typed line changes. A (tenant,sale,ordinal) upsert must never overwrite
-- the sole copy of a payment amount or reference.
CREATE TABLE IF NOT EXISTS public.orvix_sale_payment_line_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sale_id text NOT NULL,
  source_ordinal integer NOT NULL,
  payment_method text NOT NULL,
  amount numeric NOT NULL,
  reference_present boolean NOT NULL,
  payment_reference text,
  was_current boolean NOT NULL,
  superseded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orvix_sale_payment_line_history_by_sale
  ON public.orvix_sale_payment_line_history
  (tenant_id,sale_id,superseded_at,history_id);

ALTER TABLE public.orvix_sale_payment_line_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_sale_payment_line_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.orvix_sale_payment_line_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.orvix_sale_payment_line_history TO authenticated;
DO $history_policy$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='orvix_sale_payment_line_history') THEN
    RAISE EXCEPTION 'Existing sale payment audit policy needs review.';
  END IF;
  EXECUTE 'CREATE POLICY orvix_sale_payment_history_tenant_select
    ON public.orvix_sale_payment_line_history
    FOR SELECT TO authenticated
    USING (tenant_id=(select private.current_tenant_id()))';
END $history_policy$;

CREATE OR REPLACE FUNCTION private.orvix_audit_sale_payment_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $audit$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
     OR OLD.sale_id IS DISTINCT FROM NEW.sale_id
     OR OLD.source_ordinal IS DISTINCT FROM NEW.source_ordinal THEN
    RAISE EXCEPTION 'Sale payment audit identity is immutable.';
  END IF;
  IF (OLD.payment_method,OLD.amount,OLD.reference_present,
      OLD.payment_reference,OLD.is_current)
      IS DISTINCT FROM
     (NEW.payment_method,NEW.amount,NEW.reference_present,
      NEW.payment_reference,NEW.is_current)
  THEN
    INSERT INTO public.orvix_sale_payment_line_history
      (tenant_id,sale_id,source_ordinal,payment_method,amount,
       reference_present,payment_reference,was_current)
    VALUES (OLD.tenant_id,OLD.sale_id,OLD.source_ordinal,
      OLD.payment_method,OLD.amount,OLD.reference_present,
      OLD.payment_reference,OLD.is_current);
  END IF;
  RETURN NEW;
END;
$audit$;
REVOKE ALL ON FUNCTION private.orvix_audit_sale_payment_line()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER orvix_sale_payment_line_history_update_trigger
BEFORE UPDATE ON public.orvix_sale_payment_breakdown_lines
FOR EACH ROW EXECUTE FUNCTION private.orvix_audit_sale_payment_line();

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

  -- Only retire lines beyond the new source length; don't toggle every
  -- current line off/on for a normal payment edit. Such toggling increases
  -- writes, temp IO and misleading audit events.
  UPDATE public.orvix_sale_payment_breakdown_lines l
    SET is_current=false
    WHERE l.tenant_id=NEW.tenant_id AND l.sale_id=NEW.legacy_id
      AND l.is_current AND l.source_ordinal >= v_count;

  INSERT INTO public.orvix_sale_payment_breakdown_lines AS current_line
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
    is_current=true
  WHERE (current_line.payment_method,current_line.amount,
         current_line.reference_present,current_line.payment_reference,
         current_line.is_current)
    IS DISTINCT FROM
        (EXCLUDED.payment_method,EXCLUDED.amount,
         EXCLUDED.reference_present,EXCLUDED.payment_reference,true);

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
-- The audit table records every superseded version; do not erase this evidence.
-- Removing the staging trigger for rollback does NOT delete customer sales:
-- DROP TRIGGER orvix_sales_payment_breakdown_shadow_trigger ON public.sales;
