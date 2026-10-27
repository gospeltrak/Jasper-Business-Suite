-- STAGING ONLY. Move *active* sales.paymentBreakdown array members from
-- source_record JSONB to typed tenant-scoped parent/child tables.
-- Zero amounts are legitimate historical records: do NOT drop them.
-- Preserve absent vs explicitly empty paymentBreakdown and missing/null
-- optional reference. Do not infer cash flow or post new treasury journals.
--
-- On independently restored STAGING only (never on production), in the
-- SAME SQL session:
--   SET app.orvix_inventory_backfill_permission = 'STAGING_ONLY_RESTORE_TESTED';
-- This is a shadow backfill and NOT a live read/write cutover.
BEGIN;

DO $staging_only$
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission',true)
     IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Refusing payment breakdown migration outside verified staging.';
  END IF;
END $staging_only$;

-- Each active sale, including one with no paymentBreakdown key, has a
-- header so that absent/[] cannot be confused after future cutover.
CREATE TABLE IF NOT EXISTS public.orvix_sale_payment_breakdown_headers (
  tenant_id uuid NOT NULL,
  sale_id text NOT NULL,
  field_present boolean NOT NULL,
  entry_count integer NOT NULL CHECK (entry_count >= 0),
  source_array_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,sale_id)
);

CREATE TABLE IF NOT EXISTS public.orvix_sale_payment_breakdown_lines (
  tenant_id uuid NOT NULL,
  sale_id text NOT NULL,
  source_ordinal integer NOT NULL CHECK (source_ordinal >= 0),
  payment_method text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  reference_present boolean NOT NULL DEFAULT false,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,sale_id,source_ordinal),
  FOREIGN KEY (tenant_id,sale_id)
    REFERENCES public.orvix_sale_payment_breakdown_headers(tenant_id,sale_id)
    ON DELETE RESTRICT
);

-- Defensive boundary: tenant authentication is NOT authorization on its
-- own, so the SELECT policy verifies actual tenant membership.
ALTER TABLE public.orvix_sale_payment_breakdown_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_sale_payment_breakdown_headers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_sale_payment_breakdown_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_sale_payment_breakdown_lines FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.orvix_sale_payment_breakdown_headers FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.orvix_sale_payment_breakdown_lines FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.orvix_sale_payment_breakdown_headers TO authenticated;
GRANT SELECT ON public.orvix_sale_payment_breakdown_lines TO authenticated;

-- Stop rather than override any pre-existing RLS policies. No INSERT,
-- UPDATE or DELETE policy for ordinary users.
DO $create_rls$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('orvix_sale_payment_breakdown_headers',
                      'orvix_sale_payment_breakdown_lines')) THEN
    RAISE EXCEPTION 'Payment breakdown staging tables already have policies. Inspect manually.';
  END IF;
  EXECUTE 'CREATE POLICY orvix_sale_breakdown_header_tenant_select
    ON public.orvix_sale_payment_breakdown_headers
    FOR SELECT TO authenticated
    USING (tenant_id = (select private.current_tenant_id()))';
  EXECUTE 'CREATE POLICY orvix_sale_breakdown_line_tenant_select
    ON public.orvix_sale_payment_breakdown_lines
    FOR SELECT TO authenticated
    USING (tenant_id = (select private.current_tenant_id()))';
END $create_rls$;

-- Validate all active sales *before* inserting any shadow data. Rejecting
-- malformed arrays, unexpected keys, or precision loss is safer than quietly
-- deleting customers' payment information.
DO $validate_source$
DECLARE v_bad bigint;
BEGIN
  WITH src AS (
    SELECT s.tenant_id,s.legacy_id,s.source_record AS j
    FROM public.sales s WHERE s.source_active
  ),
  lines AS (
    SELECT s.tenant_id,s.legacy_id,l.value AS j
    FROM src s CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(s.j->'paymentBreakdown')='array'
        THEN s.j->'paymentBreakdown' ELSE '[]'::jsonb END) l
  ), invalid AS (
    SELECT 1 FROM src WHERE legacy_id IS NULL OR btrim(legacy_id)=''
      OR (j ? 'paymentBreakdown' AND
          jsonb_typeof(j->'paymentBreakdown') IS DISTINCT FROM 'array')
    UNION ALL
    SELECT 1 FROM lines WHERE
         jsonb_typeof(j) IS DISTINCT FROM 'object'
      OR jsonb_typeof(j->'method') IS DISTINCT FROM 'string'
      OR btrim(j->>'method')=''
      OR jsonb_typeof(j->'amount') IS DISTINCT FROM 'number'
      OR (j->>'amount')::numeric < 0
      OR (j->>'amount')::numeric IS DISTINCT FROM round((j->>'amount')::numeric,2)
      OR (j ? 'reference' AND
          jsonb_typeof(j->'reference') NOT IN ('string','null'))
      OR (j - 'method' - 'amount' - 'reference') <> '{}'::jsonb
    UNION ALL
    SELECT 1 FROM src GROUP BY tenant_id,legacy_id HAVING count(*)>1
  )
  SELECT count(*) INTO v_bad FROM invalid;
  IF v_bad>0 THEN
    RAISE EXCEPTION 'Refusing payment JSON backfill: % invalid active records.',v_bad;
  END IF;
END $validate_source$;

INSERT INTO public.orvix_sale_payment_breakdown_headers
  (tenant_id,sale_id,field_present,entry_count,source_array_hash)
SELECT s.tenant_id,s.legacy_id,
  (s.source_record ? 'paymentBreakdown'),
  CASE WHEN jsonb_typeof(s.source_record->'paymentBreakdown')='array'
    THEN jsonb_array_length(s.source_record->'paymentBreakdown') ELSE 0 END,
  CASE WHEN s.source_record ? 'paymentBreakdown'
    THEN md5((s.source_record->'paymentBreakdown')::text)
    ELSE NULL END
FROM public.sales s
WHERE s.source_active
ON CONFLICT (tenant_id,sale_id) DO NOTHING;

INSERT INTO public.orvix_sale_payment_breakdown_lines
  (tenant_id,sale_id,source_ordinal,payment_method,amount,
   reference_present,payment_reference)
SELECT s.tenant_id,s.legacy_id,(l.ord-1)::integer,
  l.item->>'method',(l.item->>'amount')::numeric,
  (l.item ? 'reference'),l.item->>'reference'
FROM public.sales s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.source_record->'paymentBreakdown')='array'
    THEN s.source_record->'paymentBreakdown' ELSE '[]'::jsonb END
) WITH ORDINALITY AS l(item,ord)
WHERE s.source_active
ON CONFLICT (tenant_id,sale_id,source_ordinal) DO NOTHING;

-- Validate *exact reconstructed JSONB* in addition to entry counts/hash.
-- This catches drift or extra shadow rows as well as missing ones.
DO $parity$
DECLARE v_bad bigint;
BEGIN
  SELECT count(*) INTO v_bad
  FROM public.sales s
  LEFT JOIN public.orvix_sale_payment_breakdown_headers h
    ON h.tenant_id=s.tenant_id AND h.sale_id=s.legacy_id
  WHERE s.source_active
    AND (
      h.sale_id IS NULL
      OR h.field_present IS DISTINCT FROM (s.source_record ? 'paymentBreakdown')
      OR h.entry_count IS DISTINCT FROM
        CASE WHEN jsonb_typeof(s.source_record->'paymentBreakdown')='array'
          THEN jsonb_array_length(s.source_record->'paymentBreakdown') ELSE 0 END
      OR h.source_array_hash IS DISTINCT FROM
        CASE WHEN s.source_record ? 'paymentBreakdown'
          THEN md5((s.source_record->'paymentBreakdown')::text) ELSE NULL END
      OR (
        SELECT count(*) FROM public.orvix_sale_payment_breakdown_lines l
        WHERE l.tenant_id=s.tenant_id AND l.sale_id=s.legacy_id
      ) IS DISTINCT FROM h.entry_count::bigint
      OR (
        CASE WHEN s.source_record ? 'paymentBreakdown'
        THEN (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object('method', l.payment_method, 'amount',l.amount) ||
            CASE WHEN l.reference_present
              THEN jsonb_build_object('reference',l.payment_reference)
              ELSE '{}'::jsonb END
            ORDER BY l.source_ordinal),'[]'::jsonb)
          FROM public.orvix_sale_payment_breakdown_lines l
          WHERE l.tenant_id=s.tenant_id AND l.sale_id=s.legacy_id
        ) IS DISTINCT FROM (s.source_record->'paymentBreakdown')
        ELSE false END
      )
    );
  IF v_bad<>0 THEN
    RAISE EXCEPTION 'Sale payment breakdown JSON parity failed on % records; all shadow inserts rolled back.',v_bad;
  END IF;
END $parity$;
COMMIT;

-- Do not DELETE/UPDATE public.sales or touch Money & Bank transactions.
-- A validated shadow backfill is NOT a completed transactional cutover.
