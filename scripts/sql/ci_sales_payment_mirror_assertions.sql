-- Disposable PostgreSQL 17 tests AFTER the backfill and mirror trigger.
-- Verify same-transaction updates, shortening without DELETE and failed edits
-- never corrupt the source sale or typed shadow.
UPDATE public.sales
SET source_record=jsonb_set(source_record,'{paymentBreakdown}',
 '[{"method":"Mpesa","amount":540000,"reference":"TX-ABC"},
   {"method":"Cash","amount":9000,"reference":null}]'::jsonb)
WHERE legacy_id='sale-mixed';

DO $check_updates$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.orvix_sale_payment_breakdown_lines
 WHERE sale_id='sale-mixed' AND is_current;
 IF n<>2 THEN RAISE EXCEPTION 'Mirror must show 2 current payments, got %',n; END IF;
 SELECT count(*) INTO n FROM public.orvix_sale_payment_breakdown_lines
 WHERE sale_id='sale-mixed' AND NOT is_current AND source_ordinal=2;
 IF n<>1 THEN RAISE EXCEPTION 'Superseded shadow row was deleted instead of marked inactive'; END IF;
 SELECT count(*) INTO n FROM public.orvix_sale_payment_breakdown_headers
 WHERE sale_id='sale-mixed' AND field_present AND entry_count=2 AND source_active;
 IF n<>1 THEN RAISE EXCEPTION 'Header was not synchronized in same transaction'; END IF;
 SELECT count(*) INTO n FROM public.orvix_sale_payment_breakdown_lines
 WHERE sale_id='sale-mixed' AND source_ordinal=1 AND is_current
 AND amount=9000 AND payment_reference IS NULL AND reference_present;
 IF n<>1 THEN RAISE EXCEPTION 'A changed payment field was not updated accurately'; END IF;
END $check_updates$;

-- Missing JSON key must remain missing, rather than empty [].
UPDATE public.sales
SET source_record=source_record-'paymentBreakdown'
WHERE legacy_id='sale-explicit-empty';
DO $check_missing$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.orvix_sale_payment_breakdown_headers
  WHERE sale_id='sale-explicit-empty' AND NOT field_present AND entry_count=0
    AND source_array_hash IS NULL) THEN
   RAISE EXCEPTION 'Missing paymentBreakdown state lost after removing array field';
 END IF;
END $check_missing$;

-- New valid source sale is mirrored without another staging import.
INSERT INTO public.sales(tenant_id,legacy_id,source_record,source_active) VALUES
('22222222-2222-2222-2222-222222222222','sale-after-backfill',
 '{"id":"sale-after-backfill","paymentBreakdown":[{"method":"Cash","amount":7200}]}'::jsonb,true);
DO $check_insert$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.orvix_sale_payment_breakdown_headers
  WHERE sale_id='sale-after-backfill' AND source_active AND entry_count=1)
 OR NOT EXISTS (SELECT 1 FROM public.orvix_sale_payment_breakdown_lines
  WHERE sale_id='sale-after-backfill' AND source_ordinal=0
    AND payment_method='Cash' AND amount=7200 AND is_current) THEN
   RAISE EXCEPTION 'New sale was not mirrored transactionally';
 END IF;
END $check_insert$;

-- Incorrect payment edits must roll back and keep BOTH tables consistent.
DO $reject_invalid$
DECLARE was_denied boolean:=false;
BEGIN
  BEGIN
    UPDATE public.sales
      SET source_record=jsonb_set(source_record,'{paymentBreakdown}',
        '[{"method":"Mpesa","amount":-500}]'::jsonb)
    WHERE legacy_id='sale-after-backfill';
  EXCEPTION WHEN others THEN was_denied:=true;
  END;
  IF NOT was_denied THEN
    RAISE EXCEPTION 'Negative payment update should have failed inside trigger';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orvix_sale_payment_breakdown_lines
    WHERE sale_id='sale-after-backfill' AND amount=7200 AND is_current)
     OR NOT EXISTS (SELECT 1 FROM public.sales
       WHERE legacy_id='sale-after-backfill'
         AND (source_record#>>'{paymentBreakdown,0,amount}')::numeric=7200) THEN
    RAISE EXCEPTION 'Rejected payment unexpectedly mutated the source or mirror';
  END IF;
END $reject_invalid$;

-- Tombstoning a sale keeps its source record and shadow history, but makes
-- current payment lines invisible to future typed readers.
UPDATE public.sales SET source_active=false WHERE legacy_id='sale-mixed';
DO $check_tombstone$
BEGIN
 IF EXISTS (SELECT 1 FROM public.orvix_sale_payment_breakdown_lines
    WHERE sale_id='sale-mixed' AND is_current)
 OR NOT EXISTS (SELECT 1 FROM public.orvix_sale_payment_breakdown_headers
    WHERE sale_id='sale-mixed' AND source_active=false)
 OR NOT EXISTS (SELECT 1 FROM public.sales
    WHERE legacy_id='sale-mixed' AND source_record ? 'paymentBreakdown') THEN
   RAISE EXCEPTION 'Inactive sale tombstone erased payment evidence or left live mirror lines';
 END IF;
END $check_tombstone$;

-- No unrelated user data or protected backup changed during these edits.
DO $backup_verify$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.tenant_workspaces w
   JOIN public.ci_original_workspaces o ON o.tenant_id=w.tenant_id
   WHERE md5(w.payload::text) IS DISTINCT FROM o.expected_hash
 ) OR EXISTS (
  SELECT 1 FROM public.tenant_data t
   JOIN public.ci_original_backups o
    ON o.tenant_id=t.tenant_id AND o.data_key=t.data_key
   WHERE md5(t.payload::text) IS DISTINCT FROM o.expected_hash
 ) THEN
   RAISE EXCEPTION 'Workspace or protected backup changed during mirror tests';
 END IF;
END $backup_verify$;
SELECT 'sales_payment_breakdown_transactional_shadow_sync_passed' AS result;
