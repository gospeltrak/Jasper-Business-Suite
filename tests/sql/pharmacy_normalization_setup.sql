-- Isolated PostgreSQL fixture for the additive Pharmacy migration.
-- No production credentials, real tenants, or external services.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.auth_uid', true), '')::uuid
$$;
CREATE FUNCTION private.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.tenant_id', true), '')::uuid
$$;
CREATE FUNCTION private.is_tenant_branch_administrator(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.is_admin', true) = 'true'
$$;
CREATE FUNCTION private.can_read_branch(p_tenant_id uuid, p_branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.can_read', true) = 'true'
$$;
CREATE FUNCTION private.can_write_branch(p_tenant_id uuid, p_branch_id uuid, p_permission_key text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.can_write', true) = 'true' AND p_permission_key = 'products.write'
$$;
CREATE FUNCTION public.get_current_branch_context() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'activeScope', coalesce(nullif(current_setting('test.scope', true), ''), 'branch'),
    'activeBranchId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'canViewAllBranches', true
  )
$$;
CREATE TABLE public.products (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  legacy_id text,
  source_active boolean NOT NULL DEFAULT true,
  source_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  tabs_per_pack integer,
  allows_dosage_dividing boolean,
  stock_qty numeric NOT NULL DEFAULT 0
);
INSERT INTO public.products (id,tenant_id,legacy_id,source_active,source_record,tabs_per_pack,allows_dosage_dividing,stock_qty) VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','medicine-1',true,
 '{"id":"medicine-1","productType":"medicine","pharmacyProductType":"pharmaceutical","pharmacyHierarchyStart":"packet","pharmacyBaseUnit":"Tablet","dosesPerPacket":2,"tabsPerDose":10,"tabsPerPack":20,"packetPrice":5000,"stripPrice":2500,"fullDosePrice":2500,"halfDosePrice":1250,"tabPrice":250,"allowsDosageDividing":true,"pharmacyUnitLevels":[{"id":"packet","label":"Packet","unit":"Packet","quantityToBaseUnit":20},{"id":"dose","label":"Dose","unit":"Dose","quantityToBaseUnit":10},{"id":"tabs","label":"Tablet","unit":"Tablet","quantityToBaseUnit":1}]}'::jsonb,20,true,50),
('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ordinary-1',true,
 '{"id":"ordinary-1","productType":"general"}'::jsonb,8,false,15),
('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','other-tenant-1',true,
 '{"id":"other-tenant-1","pharmacyProductType":"pharmaceutical","pharmacyUnitLevels":[{"id":"tabs","label":"Tablet","unit":"Tablet","quantityToBaseUnit":1}]}'::jsonb,1,true,2);
SELECT set_config('test.auth_uid','99999999-9999-4999-8999-999999999999', false);
SELECT set_config('test.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT set_config('test.scope','branch', false);
SELECT set_config('test.is_admin','false', false);
SELECT set_config('test.can_read','true', false);
SELECT set_config('test.can_write','true', false);
