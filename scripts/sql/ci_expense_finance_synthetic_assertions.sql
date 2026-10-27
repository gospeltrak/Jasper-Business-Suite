-- Disposable Postgres17 expense financing typed shadow checks.
DO $expense_parity$
DECLARE n bigint;
BEGIN
 SELECT COUNT(*) INTO n FROM public.expenses
 WHERE source_active
 AND paid_from_account_id=source_record->>'paidFromAccountId'
 AND payment_method_normalized=source_record->>'paymentMethod'
 AND treasury_journal_id=(source_record->>'treasuryJournalId')::uuid;
 IF n<>2 THEN RAISE EXCEPTION 'Typed expense finance backfill lost active rows: %',n; END IF;

 SELECT COUNT(*) INTO n FROM public.expenses
 WHERE legacy_id='expense-archived' AND NOT source_active
   AND paid_from_account_id IS NULL AND payment_method_normalized IS NULL
   AND treasury_journal_id IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Inactive expense history was modified'; END IF;

 SELECT COUNT(*) INTO n FROM public.expenses e
 JOIN public.ci_original_expense_hashes h
  ON h.tenant_id=e.tenant_id AND h.legacy_id=e.legacy_id
 WHERE md5(e.source_record::text) IS DISTINCT FROM h.source_hash
 OR md5(coalesce(e.receipt_image,'')) IS DISTINCT FROM h.receipt_hash;
 IF n<>0 THEN RAISE EXCEPTION 'Expense source JSON or payment receipt changed during backfill'; END IF;
END $expense_parity$;

-- A new ordinary expense mirrors all three typed fields immediately.
INSERT INTO public.expenses (tenant_id,legacy_id,source_record,source_active) VALUES
 ('11111111-1111-1111-1111-111111111111','expense-after-backfill',
 '{"id":"expense-after-backfill","paidFromAccountId":"nmb-source",
   "paymentMethod":"NMB",
   "treasuryJournalId":"dddddddd-dddd-dddd-dddd-dddddddddddd"}'::jsonb,true);

DO $new_expense$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.expenses
  WHERE legacy_id='expense-after-backfill'
   AND paid_from_account_id='nmb-source'
   AND payment_method_normalized='NMB'
   AND treasury_journal_id='dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid) THEN
  RAISE EXCEPTION 'New expense was not atomically normalized';
 END IF;
END $new_expense$;

-- Changes to finance JSON and typed columns must occur in one transaction.
UPDATE public.expenses
 SET source_record=jsonb_set(source_record,'{paidFromAccountId}','"nmb-replacement"'::jsonb)
 WHERE legacy_id='expense-after-backfill';
DO $updated_expense$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.expenses
 WHERE legacy_id='expense-after-backfill'
 AND paid_from_account_id='nmb-replacement'
 AND payment_method_normalized='NMB') THEN
 RAISE EXCEPTION 'Expense finance typed column failed to sync';
 END IF;
END $updated_expense$;

-- A malformed change aborts in the trigger with no partial write.
DO $bad_expense$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  UPDATE public.expenses SET source_record=jsonb_set(
    source_record,'{treasuryJournalId}','"not-a-uuid"'::jsonb
  ) WHERE legacy_id='expense-after-backfill';
 EXCEPTION WHEN others THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invalid treasury journal id was accepted'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.expenses
  WHERE legacy_id='expense-after-backfill'
    AND paid_from_account_id='nmb-replacement'
    AND treasury_journal_id='dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
    AND source_record->>'treasuryJournalId'='dddddddd-dddd-dddd-dddd-dddddddddddd') THEN
  RAISE EXCEPTION 'Invalid treasury journal partially changed expense data';
 END IF;
END $bad_expense$;

-- Edits to other fields must not overwrite the typed payment source.
UPDATE public.expenses
 SET source_record=jsonb_set(source_record,'{notes}','"something else"'::jsonb)
 WHERE legacy_id='expense-after-backfill';
DO $unrelated_edit$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.expenses WHERE legacy_id='expense-after-backfill'
  AND paid_from_account_id='nmb-replacement') THEN
  RAISE EXCEPTION 'Unrelated expense update lost financial typed account';
 END IF;
END $unrelated_edit$;

-- Inactive expenses preserve finance and original expense proof.
UPDATE public.expenses SET source_active=false WHERE legacy_id='expense-1';
DO $expense_tombstone$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.expenses
 WHERE legacy_id='expense-1' AND NOT source_active
 AND paid_from_account_id='mpesa-source'
 AND receipt_image='data:image/png;base64,AAE='
 AND treasury_journal_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) THEN
  RAISE EXCEPTION 'Expense tombstone erased original receipt or finance';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.tenant_data
  WHERE data_key='data_backup_protected_ci') THEN
  RAISE EXCEPTION 'Expense normalization lost a protected backup';
 END IF;
END $expense_tombstone$;
SELECT 'staging_expense_finance_typed_mirror_passed' result;
