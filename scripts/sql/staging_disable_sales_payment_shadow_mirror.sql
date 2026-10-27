-- STAGING ONLY: safely disable experimental typed sale payment mirroring.
-- Does not drop typed tables, payment evidence, or original sale records.
-- Validate the actual project is an isolated staging clone before execution.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission',true)
     IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Sale mirror rollback refused: staging marker missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.sales'::regclass
      AND tgname='orvix_sales_payment_breakdown_shadow_trigger'
      AND NOT tgisinternal AND tgenabled='O') THEN
    RAISE EXCEPTION 'Expected active sale mirror trigger is missing; inspect before rollback.';
  END IF;
END $guard$;

DROP TRIGGER orvix_sales_payment_breakdown_shadow_trigger ON public.sales;
-- Keep the private function, typed snapshots and append-only audit history
-- for investigation and safe re-application. Never delete financial records.
REVOKE ALL ON FUNCTION private.orvix_mirror_sale_payment_breakdown()
  FROM PUBLIC,anon,authenticated;
COMMIT;
