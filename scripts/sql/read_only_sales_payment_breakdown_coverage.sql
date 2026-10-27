-- READ ONLY: sale paymentBreakdown status for a JSON retirement release gate.
-- Counts only, no sale IDs, tenant names, receipts, methods or references.
BEGIN TRANSACTION READ ONLY;
WITH active AS (
  SELECT s.tenant_id,s.legacy_id,s.source_record AS j
  FROM public.sales s WHERE s.source_active
),
rows AS (
  SELECT s.tenant_id,s.legacy_id,
    l.item
  FROM active s
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(s.j->'paymentBreakdown')='array'
      THEN s.j->'paymentBreakdown' ELSE '[]'::jsonb END
  ) AS l(item)
)
SELECT
  (SELECT COUNT(*) FROM active) active_sales,
  (SELECT COUNT(*) FROM active WHERE j ? 'paymentBreakdown') with_payment_breakdown,
  (SELECT COUNT(*) FROM active WHERE j ? 'paymentBreakdown'
     AND jsonb_typeof(j->'paymentBreakdown')='array'
     AND jsonb_array_length(j->'paymentBreakdown')=0) explicitly_empty_breakdowns,
  (SELECT COUNT(*) FROM active WHERE NOT j ? 'paymentBreakdown') missing_breakdown_field,
  (SELECT COUNT(*) FROM rows) source_payment_lines,
  (SELECT COUNT(*) FROM rows WHERE (item->>'amount')::numeric=0) historical_zero_amount_lines,
  (SELECT COUNT(*) FROM rows WHERE item ? 'reference') with_explicit_reference_field,
  to_regclass('public.orvix_sale_payment_breakdown_headers') IS NOT NULL
    AS typed_sale_payment_header_exists,
  to_regclass('public.orvix_sale_payment_breakdown_lines') IS NOT NULL
    AS typed_sale_payment_lines_exists,
  FALSE AS approved_for_source_record_deletion;
COMMIT;
