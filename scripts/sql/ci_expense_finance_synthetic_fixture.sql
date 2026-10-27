-- Disposable synthetic expense records. Never run on real tenants.
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legacy_id text,
  source_record jsonb,
  source_active boolean NOT NULL DEFAULT true,
  receipt_image text
);
INSERT INTO public.expenses
  (tenant_id,legacy_id,source_record,source_active,receipt_image)
VALUES (
 '11111111-1111-1111-1111-111111111111','expense-1',
 '{"id":"expense-1","amount":15000,"paidFromAccountId":"mpesa-source",
   "paymentMethod":"Mpesa",
   "treasuryJournalId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
   "receiptImage":"data:image/png;base64,AAE="}'::jsonb,true,
 'data:image/png;base64,AAE='
),(
 '22222222-2222-2222-2222-222222222222','expense-2',
 '{"id":"expense-2","amount":2500,"paidFromAccountId":"cash-register",
   "paymentMethod":"Cash",
   "treasuryJournalId":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}'::jsonb,true,null
),(
 '11111111-1111-1111-1111-111111111111','expense-archived',
 '{"id":"expense-archived","paidFromAccountId":"old-card",
  "paymentMethod":"Card","treasuryJournalId":"cccccccc-cccc-cccc-cccc-cccccccccccc"}'::jsonb,
 false,null
);
CREATE TABLE public.ci_original_expense_hashes AS
SELECT tenant_id,legacy_id,source_active,md5(source_record::text) source_hash,
  md5(coalesce(receipt_image,'')) receipt_hash
FROM public.expenses;
