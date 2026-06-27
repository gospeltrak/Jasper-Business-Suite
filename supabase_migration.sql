-- ============================================================
-- Jasper Business Suite — Database Migration
-- 
-- SAFE TO RUN: Uses CREATE TABLE IF NOT EXISTS and
-- CREATE POLICY IF NOT EXISTS — will not affect any
-- existing tables, data, or policies.
--
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── tenant_workspaces ────────────────────────────────────────
-- Stores ALL business data for each tenant as a single JSON blob.
-- Products, sales, expenses, settings, deliveries, purchases —
-- everything lives here. One row per tenant, upserted on every save.

CREATE TABLE IF NOT EXISTS public.tenant_workspaces (
  id          BIGSERIAL    PRIMARY KEY,
  tenant_id   TEXT         NOT NULL,
  payload     JSONB        NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_workspaces_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS tenant_workspaces_tenant_idx
  ON public.tenant_workspaces (tenant_id);

ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anonymous reads/writes
-- (auth is handled at the application level via tenant_id scoping)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_workspaces' AND policyname = 'workspace_select'
  ) THEN
    EXECUTE 'CREATE POLICY workspace_select ON public.tenant_workspaces FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_workspaces' AND policyname = 'workspace_insert'
  ) THEN
    EXECUTE 'CREATE POLICY workspace_insert ON public.tenant_workspaces FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_workspaces' AND policyname = 'workspace_update'
  ) THEN
    EXECUTE 'CREATE POLICY workspace_update ON public.tenant_workspaces FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── tenant_data (backup key-value store) ─────────────────────
-- Secondary table for individual data keys. Kept for backward
-- compatibility with the dbSync.ts utility.

CREATE TABLE IF NOT EXISTS public.tenant_data (
  id          BIGSERIAL    PRIMARY KEY,
  tenant_id   TEXT         NOT NULL,
  data_key    TEXT         NOT NULL,
  payload     JSONB        NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_data_unique UNIQUE (tenant_id, data_key)
);

CREATE INDEX IF NOT EXISTS tenant_data_tenant_idx
  ON public.tenant_data (tenant_id);

ALTER TABLE public.tenant_data ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_data' AND policyname = 'tenant_data_select'
  ) THEN
    EXECUTE 'CREATE POLICY tenant_data_select ON public.tenant_data FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_data' AND policyname = 'tenant_data_insert'
  ) THEN
    EXECUTE 'CREATE POLICY tenant_data_insert ON public.tenant_data FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_data' AND policyname = 'tenant_data_update'
  ) THEN
    EXECUTE 'CREATE POLICY tenant_data_update ON public.tenant_data FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────
SELECT 
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('tenant_workspaces', 'tenant_data', 'tenants', 'users')
ORDER BY table_name;
