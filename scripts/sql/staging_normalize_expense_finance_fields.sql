-- STAGING ONLY. Shift the three missing expense-finance source_record
-- fields into explicit typed columns on the EXISTING public.expenses table.
-- Preserve receipt_image and every original JSON/treasury journal/backup.
-- THIS IS NOT A PRODUCTION MIGRATION or permission to drop source_record.
--
-- Only on independent RESTORE-TESTED STAGING, in the same SQL session:
--   SET app.orvix_inventory_backfill_permission='STAGING_ONLY_RESTORE_TESTED';
BEGIN;
DO $guard$
BEGIN
 IF current_setting('app.orvix_inventory_backfill_permission',true)
    IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
  RAISE EXCEPTION 'Expense finance normalization refused outside staging.';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.expenses'::regclass
   AND tgname='orvix_expense_finance_typed_fields_trigger'
   AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'Expense finance staging mirror trigger already exists.';
 END IF;
END $guard$;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid_from_account_id text,
  ADD COLUMN IF NOT EXISTS payment_method_normalized text,
  ADD COLUMN IF NOT EXISTS treasury_journal_id uuid;

-- The existing business expense RPC already validates tenant/branch and
-- permissions. This private SECURITY INVOKER trigger only changes NEW's
-- typed columns, never posts/changes real Money & Bank journal records.
CREATE OR REPLACE FUNCTION private.orvix_sync_expense_typed_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $fn$
DECLARE
  v_account text;
  v_method text;
  v_journal text;
BEGIN
  IF TG_OP='UPDATE' AND (
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
  ) THEN
    RAISE EXCEPTION 'Expense tenant or source identity is immutable.';
  END IF;
  -- Preserve tombstones and all historical financial values.
  IF NOT NEW.source_active THEN RETURN NEW; END IF;

  IF TG_OP='UPDATE'
    AND NEW.source_record IS NOT DISTINCT FROM OLD.source_record
    AND NEW.source_active IS NOT DISTINCT FROM OLD.source_active THEN
    RETURN NEW;
  END IF;

  v_account := NEW.source_record->>'paidFromAccountId';
  v_method := NEW.source_record->>'paymentMethod';
  v_journal := NEW.source_record->>'treasuryJournalId';

  IF coalesce(jsonb_typeof(NEW.source_record->'paidFromAccountId'),'missing') <> 'string'
    OR coalesce(jsonb_typeof(NEW.source_record->'paymentMethod'),'missing') <> 'string'
    OR coalesce(jsonb_typeof(NEW.source_record->'treasuryJournalId'),'missing') <> 'string'
    OR nullif(btrim(v_account),'') IS NULL
    OR nullif(btrim(v_method),'') IS NULL
    OR v_journal !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid expense finance source fields; rejecting entire operation.';
  END IF;
  NEW.paid_from_account_id := v_account;
  NEW.payment_method_normalized := v_method;
  NEW.treasury_journal_id := v_journal::uuid;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION private.orvix_sync_expense_typed_finance()
FROM PUBLIC,anon,authenticated;

-- Preflight before any typed UPDATE; incompatible data aborts the transaction.
DO $validate$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.expenses e
 WHERE e.source_active AND (
    coalesce(jsonb_typeof(e.source_record->'paidFromAccountId'),'missing') <> 'string'
    OR coalesce(jsonb_typeof(e.source_record->'paymentMethod'),'missing') <> 'string'
    OR coalesce(jsonb_typeof(e.source_record->'treasuryJournalId'),'missing') <> 'string'
    OR nullif(btrim(e.source_record->>'paidFromAccountId'),'') IS NULL
    OR nullif(btrim(e.source_record->>'paymentMethod'),'') IS NULL
    OR (e.source_record->>'treasuryJournalId') !~*
      '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 );
 IF n<>0 THEN RAISE EXCEPTION 'Expense finance preflight rejected % source rows.',n; END IF;

 -- An existing typed edit cannot be overwritten by source migration
 -- without a manual reconciliation.
 SELECT count(*) INTO n FROM public.expenses e
 WHERE e.source_active AND (
    (e.paid_from_account_id IS NOT NULL AND
      e.paid_from_account_id IS DISTINCT FROM e.source_record->>'paidFromAccountId')
    OR (e.payment_method_normalized IS NOT NULL AND
      e.payment_method_normalized IS DISTINCT FROM e.source_record->>'paymentMethod')
    OR (e.treasury_journal_id IS NOT NULL AND
      e.treasury_journal_id IS DISTINCT FROM (e.source_record->>'treasuryJournalId')::uuid)
 );
 IF n<>0 THEN RAISE EXCEPTION 'Expense finance typed drift on % source rows.',n; END IF;
END $validate$;

UPDATE public.expenses e SET
   paid_from_account_id = e.source_record->>'paidFromAccountId',
   payment_method_normalized = e.source_record->>'paymentMethod',
   treasury_journal_id = (e.source_record->>'treasuryJournalId')::uuid
WHERE e.source_active
  AND (e.paid_from_account_id IS DISTINCT FROM e.source_record->>'paidFromAccountId'
    OR e.payment_method_normalized IS DISTINCT FROM e.source_record->>'paymentMethod'
    OR e.treasury_journal_id IS DISTINCT FROM (e.source_record->>'treasuryJournalId')::uuid);

DO $parity$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.expenses e WHERE e.source_active AND (
    e.paid_from_account_id IS DISTINCT FROM e.source_record->>'paidFromAccountId'
    OR e.payment_method_normalized IS DISTINCT FROM e.source_record->>'paymentMethod'
    OR e.treasury_journal_id IS DISTINCT FROM (e.source_record->>'treasuryJournalId')::uuid
 );
 IF n<>0 THEN RAISE EXCEPTION 'Expense typed finance parity failed for % rows.',n; END IF;
END $parity$;

CREATE TRIGGER orvix_expense_finance_typed_fields_trigger
BEFORE INSERT OR UPDATE OF source_record,source_active
ON public.expenses
FOR EACH ROW EXECUTE FUNCTION private.orvix_sync_expense_typed_finance();
COMMIT;
-- Keep receiptImage evidence in both source/typed until exact byte verified
-- private Storage migration. Do not drop source_record or historic expenses.
