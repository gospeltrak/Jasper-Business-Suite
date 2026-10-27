-- Synthetic disposable PostgreSQL 17 fixture. NEVER run in production.
CREATE SCHEMA IF NOT EXISTS private;
DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $roles$;
CREATE OR REPLACE FUNCTION private.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT NULLIF(current_setting('app.test_tenant_id',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO authenticated;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,legacy_id text,source_record jsonb,
  source_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.tenant_workspaces (tenant_id uuid PRIMARY KEY,payload jsonb NOT NULL);
CREATE TABLE public.tenant_data (tenant_id text NOT NULL,data_key text NOT NULL,payload jsonb,
  PRIMARY KEY(tenant_id,data_key));
\ir ../../supabase_inventory_costing.sql

INSERT INTO public.tenant_workspaces VALUES
 ('11111111-1111-1111-1111-111111111111','{"settings":{"businessName":"Synthetic Store"}}');
INSERT INTO public.tenant_data VALUES
 ('11111111-1111-1111-1111-111111111111','data_backup_protected_ci',
  '{"historicSales":[{"id":"s-original","amount":2500}],"stock":99}');
INSERT INTO public.products (tenant_id,legacy_id,source_record,source_active) VALUES
('11111111-1111-1111-1111-111111111111','p-retail','{"id":"p-retail","name":"Synthetic Sack of rice","unit":"kg","inventorySettings":{"costingMethod":"weighted_average","allowPosMethodOverride":false,"allowScaleSelling":true,"purchaseUnit":"Sack","baseUnit":"kg","conversionToBaseUnit":100,"allowCustomQuantity":true,"defaultPricePerBaseUnit":2500,"packageUnitPrice":245000,"wholePackagePrice":245000,"halfPackagePrice":123000,"packageBuyingCost":220000,"fractionSaleEnabled":true,"fractionSaleOptions":[{"id":"quarter","label":"1/4 kg","quantityInBaseUnit":0.25,"price":625,"isDefault":true},{"id":"half","label":"1/2 kg","quantityInBaseUnit":0.5,"price":1250,"isDefault":true}]},"packageLevels":[{"id":"sack","label":"Sack","quantityInBaseUnit":100},{"id":"level-base","label":"Kg","quantityInBaseUnit":1}],"sellingUnits":[{"id":"unit-kg","packageLevelId":"base","label":"Kg","price":2500,"isDefault":true},{"id":"unit-sack","packageLevelId":"sack","label":"Sack","price":245000}],"batches":[{"id":"batch-one","productId":"p-retail","batchNumber":"BR-1","purchaseDate":"2026-01-01T08:00:00Z","quantityPurchased":100,"quantityRemaining":42,"baseUnit":"kg","buyingPrice":2200,"previousBuyingPrice":2100,"priceChangePercentage":12.123456789012344,"suggestedSellingPrice":2500,"finalSellingPrice":2450,"costingMethodAtCreation":"weighted_average","status":"active","createdBy":"Admin","createdAt":"2026-01-01T08:00:00Z","destination":"store","quantityPurchasedBase":100,"quantityRemainingBase":42,"supplierName":"Supplier A"},{"id":"batch-two","productId":"p-retail","batchNumber":"BR-2","purchaseDate":"2026-01-05T08:00:00Z","quantityPurchased":25,"quantityRemaining":0,"buyingPrice":2300,"previousBuyingPrice":2200,"priceChangePercentage":0,"suggestedSellingPrice":2600,"finalSellingPrice":2600,"costingMethodAtCreation":"fifo","status":"finished","createdBy":"Admin","createdAt":"2026-01-05T08:00:00Z","quantityPurchasedBase":25,"quantityRemainingBase":0}]}'::jsonb,true),
('11111111-1111-1111-1111-111111111111','p-pharmacy','{"id":"p-pharmacy","name":"Synthetic Capsules","unit":"Tablet","inventorySettings":{"costingMethod":"fifo","allowPosMethodOverride":false,"allowScaleSelling":false,"purchaseUnit":"Box","baseUnit":"Tablet","conversionToBaseUnit":100,"pharmacyUnitBreakdown":{"purchaseUnit":"Box","stripUnit":"Blister","baseUnit":"Tablet","stripsPerBox":10,"tabletsPerStrip":10}},"pharmacyUnitLevels":[{"id":"box","label":"Box","unit":"Box","quantityToBaseUnit":100},{"id":"blister","label":"Blister","unit":"Blister","quantityToBaseUnit":10},{"id":"tablet","label":"Tablet","unit":"Tablet","quantityToBaseUnit":1}]}'::jsonb,true),
('22222222-2222-2222-2222-222222222222','p-other-tenant','{"id":"p-other-tenant","name":"Synthetic Coffee","unit":"kg","inventorySettings":{"costingMethod":"average_price","allowPosMethodOverride":false,"allowScaleSelling":true,"purchaseUnit":"Sack","baseUnit":"kg","conversionToBaseUnit":25},"packageLevels":[{"id":"sack","label":"Sack","quantityInBaseUnit":25}],"sellingUnits":[{"id":"kg","label":"Kg","packageLevelId":"base","price":7200}]}'::jsonb,true),
('11111111-1111-1111-1111-111111111111','p-inactive','{"id":"p-inactive","inventorySettings":{"costingMethod":"fifo"}}'::jsonb,false);

CREATE TABLE public.ci_original_product_hashes AS
SELECT tenant_id,legacy_id,md5(source_record::text) expected_hash,source_active
FROM public.products;
CREATE TABLE public.ci_original_workspaces AS
SELECT tenant_id,md5(payload::text) expected_hash FROM public.tenant_workspaces;
CREATE TABLE public.ci_original_backups AS
SELECT tenant_id,data_key,md5(payload::text) expected_hash FROM public.tenant_data;
