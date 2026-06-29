-- ============================================================
-- Jasper Business Suite — Database Migration
-- SAFE: Uses IF NOT EXISTS / DO $$ everywhere
-- Does NOT touch existing tables or data
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Add subscription columns to tenants (if missing) ─────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS subscription_plan         TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at   TIMESTAMPTZ;

-- ── tenant_payment_proofs ─────────────────────────────────────
-- Stores payment receipts submitted by tenants when paying for
-- a subscription package. Super Admin approves → activates plan.
CREATE TABLE IF NOT EXISTS public.tenant_payment_proofs (
  id                    TEXT         PRIMARY KEY,
  tenant_id             TEXT         NOT NULL,
  tenant_name           TEXT,
  requested_package_id  TEXT         NOT NULL,
  requested_package_name TEXT,
  amount                NUMERIC,
  currency              TEXT         DEFAULT 'TSh',
  status                TEXT         NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  receipt_file_name     TEXT,
  receipt_file_type     TEXT,
  receipt_file_size     BIGINT,
  note                  TEXT,
  submitted_by          TEXT,
  submitted_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  approved_at           TIMESTAMPTZ,
  approved_by           TEXT,
  rejected_reason       TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenant_payment_proofs_tenant_idx
  ON public.tenant_payment_proofs (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_payment_proofs_status_idx
  ON public.tenant_payment_proofs (status);

ALTER TABLE public.tenant_payment_proofs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_payment_proofs' AND policyname='proofs_select') THEN
    EXECUTE 'CREATE POLICY proofs_select ON public.tenant_payment_proofs FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_payment_proofs' AND policyname='proofs_insert') THEN
    EXECUTE 'CREATE POLICY proofs_insert ON public.tenant_payment_proofs FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_payment_proofs' AND policyname='proofs_update') THEN
    EXECUTE 'CREATE POLICY proofs_update ON public.tenant_payment_proofs FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── tenant_workspaces ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_workspaces (
  id          BIGSERIAL    PRIMARY KEY,
  tenant_id   TEXT         NOT NULL,
  payload     JSONB        NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_workspaces_tenant_unique UNIQUE (tenant_id)
);
CREATE INDEX IF NOT EXISTS tenant_workspaces_tenant_idx ON public.tenant_workspaces (tenant_id);
ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_workspaces' AND policyname='workspace_select') THEN
    EXECUTE 'CREATE POLICY workspace_select ON public.tenant_workspaces FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_workspaces' AND policyname='workspace_insert') THEN
    EXECUTE 'CREATE POLICY workspace_insert ON public.tenant_workspaces FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_workspaces' AND policyname='workspace_update') THEN
    EXECUTE 'CREATE POLICY workspace_update ON public.tenant_workspaces FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── tenant_data (backup KV store) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_data (
  id          BIGSERIAL    PRIMARY KEY,
  tenant_id   TEXT         NOT NULL,
  data_key    TEXT         NOT NULL,
  payload     JSONB        NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_data_unique UNIQUE (tenant_id, data_key)
);
CREATE INDEX IF NOT EXISTS tenant_data_tenant_idx ON public.tenant_data (tenant_id);
ALTER TABLE public.tenant_data ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_data' AND policyname='tenant_data_select') THEN
    EXECUTE 'CREATE POLICY tenant_data_select ON public.tenant_data FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_data' AND policyname='tenant_data_insert') THEN
    EXECUTE 'CREATE POLICY tenant_data_insert ON public.tenant_data FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_data' AND policyname='tenant_data_update') THEN
    EXECUTE 'CREATE POLICY tenant_data_update ON public.tenant_data FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── Verify ────────────────────────────────────────────────────
SELECT table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('tenants','users','tenant_payment_proofs','tenant_workspaces','tenant_data')
ORDER BY table_name;

-- ── Platform records: ensure unique constraint for upsert ─────────────────
-- This allows savePlatformRecord to use onConflict: 'tenant_id,data_key'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenant_data_unique' AND conrelid = 'public.tenant_data'::regclass
  ) THEN
    ALTER TABLE public.tenant_data
      ADD CONSTRAINT tenant_data_unique UNIQUE (tenant_id, data_key);
  END IF;
END $$;

-- ── Verify tenant_data can store platform records ─────────────────────────
-- tenant_id = 'saas-global' is used for all super admin platform data
-- data_key format: '{recordType}__{scopeId}' e.g. 'hardware_inventory__global'
-- payload is JSONB — stores the full JSON array/object

SELECT table_name, 
  (SELECT count(*) FROM information_schema.columns c 
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_name = 'tenant_data';
