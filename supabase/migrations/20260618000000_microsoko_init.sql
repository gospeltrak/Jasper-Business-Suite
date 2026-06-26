-- STEP 1: ENUMS
CREATE TYPE jasper_module_category AS ENUM ('wholesale_retail', 'pharmacy', 'microsoko');
CREATE TYPE microsoko_item_type AS ENUM ('raw_material', 'packaging_asset', 'label_asset', 'finished_good', 'by_product', 'operational_overhead');
CREATE TYPE tracking_measurement_mode AS ENUM ('metric_standard', 'estimate_visual');
CREATE TYPE microsoko_billing_tier AS ENUM ('soko_siku_daily', 'soko_wiki_weekly', 'soko_mwezi_monthly');

-- STEP 2: TABLE ALTERATIONS & SYSTEM ADDITIONS
-- Alter the existing 'tenants' table
-- We assume "tenants" already exists. We add the new columns if they do not exist.
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS primary_niche jasper_module_category DEFAULT 'wholesale_retail',
ADD COLUMN IF NOT EXISTS registered_via_affiliate_id UUID;

-- The application inventory table is public.products.
ALTER TABLE products
ADD COLUMN IF NOT EXISTS module_owner jasper_module_category DEFAULT 'wholesale_retail',
ADD COLUMN IF NOT EXISTS microsoko_type microsoko_item_type,
ADD COLUMN IF NOT EXISTS tracking_mode tracking_measurement_mode DEFAULT 'metric_standard',
ADD COLUMN IF NOT EXISTS standard_metric_unit VARCHAR(50);

-- STEP 3: NEW CUSTOM STRUCTURAL TABLES

-- Table: container_calibrations
CREATE TABLE IF NOT EXISTS container_calibrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bulk_item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    container_name VARCHAR(100) NOT NULL, -- e.g. 'Ndoo', 'Kibaba'
    units_per_bulk_parent DECIMAL(12, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, bulk_item_id, container_name)
);

-- Table: microsoko_batches
CREATE TABLE IF NOT EXISTS microsoko_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    batch_reference VARCHAR(50) NOT NULL,
    
    -- Phase 1
    raw_material_base_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    -- Phase 2
    inbound_freight_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    -- Phase 3
    packaging_materials_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    labeling_branding_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    processing_overheads_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    -- Phase 4
    outbound_market_freight_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Credit Phase
    by_product_recovered_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Yield Attributes
    primary_output_item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    total_yield_quantity_produced DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
    calculated_true_market_unit_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Table: microsoko_subscriptions
CREATE TABLE IF NOT EXISTS microsoko_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    billing_tier microsoko_billing_tier NOT NULL,
    amount_paid DECIMAL(15, 2) NOT NULL,
    payment_vendor_code VARCHAR(100),
    activation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We assume an affiliates table exists for the FK constraint mentioned.
-- If it doesn't, wait until it does to apply:
-- ALTER TABLE tenants ADD CONSTRAINT fk_affiliate FOREIGN KEY (registered_via_affiliate_id) REFERENCES affiliates(id);

-- STEP 4: PERFORMANCE OPTIMIZATIONS & SECURITY POLICIES

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_module_type ON products (tenant_id, module_owner, microsoko_type);
CREATE INDEX IF NOT EXISTS idx_microsoko_batches_tenant ON microsoko_batches (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_container_calibrations_tenant ON container_calibrations (tenant_id, bulk_item_id);

-- Enable RLS
ALTER TABLE container_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsoko_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsoko_subscriptions ENABLE ROW LEVEL SECURITY;

-- Container Calibrations RLS
CREATE POLICY "Tenant Isolation: Select Container Calibrations" 
    ON container_calibrations FOR SELECT 
    USING (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

CREATE POLICY "Tenant Isolation: Insert Container Calibrations" 
    ON container_calibrations FOR INSERT 
    WITH CHECK (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

CREATE POLICY "Tenant Isolation: Update Container Calibrations" 
    ON container_calibrations FOR UPDATE 
    USING (tenant_id::text = (auth.jwt() ->> 'tenant_id'))
    WITH CHECK (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

CREATE POLICY "Tenant Isolation: Delete Container Calibrations" 
    ON container_calibrations FOR DELETE 
    USING (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

-- MicroSoko Batches RLS
CREATE POLICY "Tenant Isolation: Select MicroSoko Batches" 
    ON microsoko_batches FOR SELECT 
    USING (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

CREATE POLICY "Tenant Isolation: Insert MicroSoko Batches" 
    ON microsoko_batches FOR INSERT 
    WITH CHECK (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

-- MicroSoko Subscriptions RLS
CREATE POLICY "Tenant Isolation: Select MicroSoko Subscriptions" 
    ON microsoko_subscriptions FOR SELECT 
    USING (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

-- Provide ability for specific service role to manage subscriptions
CREATE POLICY "Service Role: Manage MicroSoko Subscriptions"
    ON microsoko_subscriptions FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');
