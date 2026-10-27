-- Synthetic multi-tenant sales only. Database MUST be disposable local CI.
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legacy_id text,
  source_record jsonb,
  source_active boolean NOT NULL DEFAULT true
);
INSERT INTO public.sales (tenant_id,legacy_id,source_record,source_active) VALUES
('11111111-1111-1111-1111-111111111111','sale-mixed',
 '{"id":"sale-mixed","amountPaid":541250.50,"paymentBreakdown":[
  {"method":"Mpesa","amount":540000,"reference":"TX-ABC"},
  {"method":"Cash","amount":0},
  {"method":"NMB","amount":1250.50,"reference":null}
 ]}'::jsonb,true),
('11111111-1111-1111-1111-111111111111','sale-explicit-empty',
 '{"id":"sale-explicit-empty","paymentBreakdown":[],"total":7500}'::jsonb,true),
('11111111-1111-1111-1111-111111111111','sale-no-breakdown',
 '{"id":"sale-no-breakdown","total":2500}'::jsonb,true),
('22222222-2222-2222-2222-222222222222','sale-other-tenant',
 '{"id":"sale-other-tenant","paymentBreakdown":[{"method":"Airtel Money","amount":1500}]}'::jsonb,true),
('11111111-1111-1111-1111-111111111111','sale-inactive-archive',
 '{"id":"sale-inactive-archive","paymentBreakdown":[{"method":"Cash","amount":990}]}'::jsonb,false);

CREATE TABLE public.ci_original_sale_hashes AS
SELECT tenant_id,legacy_id,source_active,md5(source_record::text) expected_hash
FROM public.sales;
