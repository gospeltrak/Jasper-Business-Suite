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

-- Original Cash=0 and removed NMB=1250.50 must both survive as exact
-- audit versions instead of being overwritten at their original ordinals.
DO $check_audit_1$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.orvix_sale_payment_line_history
 WHERE sale_id='sale-mixed';
 IF n<>2 THEN RAISE EXCEPTION 'Expected 2 original payment audit versions, got %',n; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.orvix_sale_payment_line_history
   WHERE sale_id='sale-mixed' AND source_ordinal=1
     AND payment_method='Cash' AND amount=0 AND was_current
 ) OR NOT EXISTS (
   SELECT 1 FROM public.orvix_sale_payment_line_history
   WHERE sale_id='sale-mixed' AND source_ordinal=2
     AND payment_method='NMB' AND amount=1250.50 AND was_current
 ) THEN RAISE EXCEPTION 'Original payment amount/reference history was lost'; END IF;
END $check_audit_1$;

-- Editing the FIRST payment replaces the typed current value while an
-- append-only historical copy retains its original TSh 540,000 amount.
UPDATE public.sales
 SET source_record=jsonb_set(source_record,'{paymentBreakdown,0,amount}','500000'::jsonb)
 WHERE legacy_id='sale-mixed';

DO $check_audit_2$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.orvix_sale_payment_line_history
 WHERE sale_id='sale-mixed';
 IF n<>3 THEN RAISE EXCEPTION 'Second edit should append one history version, found %',n; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.orvix_sale_payment_line_history
   WHERE sale_id='sale-mixed' AND source_ordinal=0
     AND payment_method='Mpesa' AND amount=540000
     AND payment_reference='TX-ABC' AND was_current
 ) OR NOT EXISTS (
   SELECT 1 FROM public.orvix_sale_payment_breakdown_lines
   WHERE sale_id='sale-mixed' AND source_ordinal=0
     AND amount=500000 AND is_current
 ) THEN RAISE EXCEPTION 'Changed Mpesa payment overwrote history or lost current value'; END IF;
END $check_audit_2$;

-- Unrelated sale metadata updates and identical breakdown replays
-- must not churn financial shadow records or generate fake audit events.
UPDATE public.sales
 SET source_record=jsonb_set(source_record,'{note}','"unrelated customer note"'::jsonb)
 WHERE legacy_id='sale-mixed';
UPDATE public.sales
 SET source_record=jsonb_set(source_record,'{paymentBreakdown}',source_record->'paymentBreakdown')
 WHERE legacy_id='sale-mixed';
DO $check_no_audit_churn$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.orvix_sale_payment_line_history
 WHERE sale_id='sale-mixed';
 IF n<>3 THEN RAISE EXCEPTION 'Unrelated or identical writes generated % history events',n; END IF;
END $check_no_audit_churn$;

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

DO $check_tombstone_history$
DECLARE n bigint;
BEGIN
 SELECT COUNT(*) INTO n FROM public.orvix_sale_payment_line_history
 WHERE sale_id='sale-mixed';
 IF n<>5 THEN RAISE EXCEPTION 'Tombstone should append two more audit rows, found %',n; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.orvix_sale_payment_line_history
    WHERE sale_id='sale-mixed' AND source_ordinal=0
      AND amount=500000 AND was_current
 ) OR NOT EXISTS (
   SELECT 1 FROM public.orvix_sale_payment_line_history
    WHERE sale_id='sale-mixed' AND source_ordinal=1
      AND amount=9000 AND was_current
 ) THEN RAISE EXCEPTION 'Tombstone lost latest current payment versions'; END IF;
END $check_tombstone_history$;

SELECT set_config('app.test_tenant_id','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $history_tenant_a$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.orvix_sale_payment_line_history;
 IF n<>5 THEN RAISE EXCEPTION 'Tenant A audit history not visible correctly: %',n; END IF;
 IF has_table_privilege('authenticated',
       'public.orvix_sale_payment_line_history','INSERT')
   OR has_table_privilege('authenticated',
       'public.orvix_sale_payment_line_history','DELETE') THEN
  RAISE EXCEPTION 'Tenant staff must not forge or erase payment history';
 END IF;
END $history_tenant_a$;
RESET ROLE;
SELECT set_config('app.test_tenant_id','22222222-2222-2222-2222-222222222222',false);
SET ROLE authenticated;
DO $history_tenant_b$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.orvix_sale_payment_line_history;
 IF n<>0 THEN RAISE EXCEPTION 'Tenant B can see another tenant payment history (%).',n; END IF;
END $history_tenant_b$;
RESET ROLE;

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
