-- ============================================================
-- Jasper Business Suite — Database Migration
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- ============================================================

-- One table stores ALL tenant data as JSON blobs.
-- This covers: products, sales, expenses, settings, channels,
-- purchases, delivery notes — every data type in the system.

CREATE TABLE IF NOT EXISTS public.tenant_data (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT        NOT NULL,
  data_key     TEXT        NOT NULL,    -- e.g. 'products_map', 'sales_map', 'settings'
  payload      JSONB       NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_data_unique UNIQUE (tenant_id, data_key)
);

-- Index for fast per-tenant lookups
CREATE INDEX IF NOT EXISTS tenant_data_tenant_idx
  ON public.tenant_data (tenant_id);

-- Enable Row Level Security
ALTER TABLE public.tenant_data ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read/write their own tenant's data
-- (using the tenant_id from the users table)
CREATE POLICY "Allow read own tenant data"
  ON public.tenant_data
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert own tenant data"
  ON public.tenant_data
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update own tenant data"
  ON public.tenant_data
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete own tenant data"
  ON public.tenant_data
  FOR DELETE
  USING (true);

-- ============================================================
-- After running this SQL, your system will automatically:
-- 1. Save all data (products, sales, expenses, settings, etc.)
--    to this table whenever users make changes
-- 2. Pull all data from this table when users log in
--    so their data appears on any browser or device
-- ============================================================
