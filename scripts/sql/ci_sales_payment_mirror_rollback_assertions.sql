-- Synthetic disposable PostgreSQL: rollback must detach staging
-- mirroring only, preserving typed audit and every business record.
DO $check_detach$
DECLARE n bigint;
BEGIN
 SELECT COUNT(*) INTO n FROM pg_trigger
 WHERE tgrelid='public.sales'::regclass
   AND tgname='orvix_sales_payment_breakdown_shadow_trigger'
   AND NOT tgisinternal;
 IF n<>0 THEN
   RAISE EXCEPTION 'Staging mirror trigger still active after rollback';
 END IF;
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_line_history
 WHERE sale_id='sale-mixed';
 IF n<>5 THEN
   RAISE EXCEPTION 'Rolling back mirror erased payment audit history';
 END IF;
END $check_detach$;

-- Source sales remain writable after staging mirror rollback, with
-- historical typed shadows retained for later audit/reconciliation.
UPDATE public.sales SET source_record=jsonb_set(
  source_record,'{paymentBreakdown,0,amount}','7300'::jsonb)
WHERE legacy_id='sale-after-backfill';
DO $verify_original$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.sales WHERE legacy_id='sale-after-backfill'
   AND (source_record#>>'{paymentBreakdown,0,amount}')::numeric=7300
 ) OR NOT EXISTS (
   SELECT 1 FROM public.orvix_sale_payment_breakdown_lines
   WHERE sale_id='sale-after-backfill' AND amount=7200 AND is_current
 ) THEN
   RAISE EXCEPTION 'Rollback unexpectedly rewrote the sales ledger or typed history';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.tenant_data
   WHERE data_key='data_backup_protected_ci'
 ) THEN
   RAISE EXCEPTION 'Rollback lost a protected backup record';
 END IF;
END $verify_original$;
SELECT 'sale_payment_shadow_mirror_rollback_non_destructive' AS result;
