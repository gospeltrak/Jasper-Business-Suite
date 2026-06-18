-- ==========================================
-- 1. ENABLE ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. HELPER FUNCTIONS
-- ==========================================
-- Securely fetch the current user's tenant_id and role from the custom users table based on auth.uid()
CREATE OR REPLACE FUNCTION get_user_tenant_id() RETURNS uuid AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==========================================
-- 3. CORE TABLE POLICIES
-- ==========================================

-- Tenants
DROP POLICY IF EXISTS "Users can read own tenant" ON public.tenants;
CREATE POLICY "Users can read own tenant" ON public.tenants
  FOR SELECT USING (id = get_user_tenant_id());

DROP POLICY IF EXISTS "Admins can update own tenant" ON public.tenants;
CREATE POLICY "Admins can update own tenant" ON public.tenants
  FOR UPDATE USING (id = get_user_tenant_id() AND get_user_role() = 'Admin');

-- Users
DROP POLICY IF EXISTS "Users isolation policy" ON public.users;
CREATE POLICY "Users isolation policy" ON public.users
  FOR ALL USING (
    id = auth.uid() 
    OR (tenant_id = get_user_tenant_id() AND get_user_role() = 'Admin')
  ) WITH CHECK (
    id = auth.uid() 
    OR (tenant_id = get_user_tenant_id() AND get_user_role() = 'Admin')
  );

-- ==========================================
-- 4. TENANT-ID BASED POLICIES
-- ==========================================
-- Applying to all standard tables with a 'tenant_id' column

DROP POLICY IF EXISTS "Tenant isolation for custom_roles" ON public.custom_roles;
CREATE POLICY "Tenant isolation for custom_roles" ON public.custom_roles
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for products" ON public.products;
CREATE POLICY "Tenant isolation for products" ON public.products
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for sales" ON public.sales;
CREATE POLICY "Tenant isolation for sales" ON public.sales
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for expenses" ON public.expenses;
CREATE POLICY "Tenant isolation for expenses" ON public.expenses
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for suppliers" ON public.suppliers;
CREATE POLICY "Tenant isolation for suppliers" ON public.suppliers
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for purchases" ON public.purchases;
CREATE POLICY "Tenant isolation for purchases" ON public.purchases
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for delivery_riders" ON public.delivery_riders;
CREATE POLICY "Tenant isolation for delivery_riders" ON public.delivery_riders
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for deliveries" ON public.deliveries;
CREATE POLICY "Tenant isolation for deliveries" ON public.deliveries
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for sales_documents" ON public.sales_documents;
CREATE POLICY "Tenant isolation for sales_documents" ON public.sales_documents
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for payment_channels" ON public.payment_channels;
CREATE POLICY "Tenant isolation for payment_channels" ON public.payment_channels
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for ledger_entries" ON public.ledger_entries;
CREATE POLICY "Tenant isolation for ledger_entries" ON public.ledger_entries
  FOR ALL USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

-- ==========================================
-- 5. CASCADING POLICIES (No direct tenant_id)
-- ==========================================
-- These tables rely on parent table ownership

DROP POLICY IF EXISTS "Tenant isolation for sale_items" ON public.sale_items;
CREATE POLICY "Tenant isolation for sale_items" ON public.sale_items
  FOR ALL USING (sale_id IN (SELECT id FROM public.sales WHERE tenant_id = get_user_tenant_id()))
  WITH CHECK (sale_id IN (SELECT id FROM public.sales WHERE tenant_id = get_user_tenant_id()));

DROP POLICY IF EXISTS "Tenant isolation for purchase_items" ON public.purchase_items;
CREATE POLICY "Tenant isolation for purchase_items" ON public.purchase_items
  FOR ALL USING (purchase_id IN (SELECT id FROM public.purchases WHERE tenant_id = get_user_tenant_id()))
  WITH CHECK (purchase_id IN (SELECT id FROM public.purchases WHERE tenant_id = get_user_tenant_id()));

DROP POLICY IF EXISTS "Tenant isolation for sales_document_items" ON public.sales_document_items;
CREATE POLICY "Tenant isolation for sales_document_items" ON public.sales_document_items
  FOR ALL USING (sales_document_id IN (SELECT id FROM public.sales_documents WHERE tenant_id = get_user_tenant_id()))
  WITH CHECK (sales_document_id IN (SELECT id FROM public.sales_documents WHERE tenant_id = get_user_tenant_id()));
