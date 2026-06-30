-- ============================================================
-- Jasper Affiliate System Migration
-- Safe: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- Does NOT touch existing tables or data
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Add TIN fields to affiliates table ─────────────────────
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS account_type      TEXT DEFAULT 'affiliate'
    CHECK (account_type IN ('affiliate','sub_affiliate','partner','super_agent')),
  ADD COLUMN IF NOT EXISTS parent_super_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS tin_number        TEXT,
  ADD COLUMN IF NOT EXISTS tin_status        TEXT DEFAULT 'not_submitted'
    CHECK (tin_status IN ('not_submitted','submitted','verified','rejected')),
  ADD COLUMN IF NOT EXISTS tin_submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tin_verified_by   TEXT,
  ADD COLUMN IF NOT EXISTS tin_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tin_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS nida_number       TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone    TEXT,
  ADD COLUMN IF NOT EXISTS payout_phone      TEXT,
  ADD COLUMN IF NOT EXISTS location          TEXT,
  ADD COLUMN IF NOT EXISTS is_disabled       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_code        TEXT,
  ADD COLUMN IF NOT EXISTS total_revenue     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_commission  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholding_tax   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_payout        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_payout    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customers_count   INTEGER DEFAULT 0;

-- ── 2. referred_customers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referred_customers (
  id                    TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id           TEXT,
  tenant_id             TEXT,
  customer_name         TEXT,
  phone_number          TEXT,
  location              TEXT,
  source_type           TEXT DEFAULT 'organic'
    CHECK (source_type IN ('organic','organic_affiliate','sub_affiliate','agent_network')),
  affiliate_id          TEXT,
  sub_affiliate_id      TEXT,
  parent_super_agent_id TEXT,
  referral_code_used    TEXT,
  promo_code_used       TEXT,
  package_id            TEXT,
  package_name          TEXT,
  package_price         NUMERIC DEFAULT 0,
  amount_paid           NUMERIC DEFAULT 0,
  payment_status        TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('paid','pending','failed','refunded')),
  commission_status     TEXT DEFAULT 'pending'
    CHECK (commission_status IN ('pending','approved','paid','rejected','on_hold')),
  commission_amount     NUMERIC DEFAULT 0,
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS referred_customers_affiliate_idx ON public.referred_customers (affiliate_id);
CREATE INDEX IF NOT EXISTS referred_customers_sub_affiliate_idx ON public.referred_customers (sub_affiliate_id);
CREATE INDEX IF NOT EXISTS referred_customers_super_agent_idx ON public.referred_customers (parent_super_agent_id);
ALTER TABLE public.referred_customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referred_customers' AND policyname='rc_select') THEN
    EXECUTE 'CREATE POLICY rc_select ON public.referred_customers FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referred_customers' AND policyname='rc_insert') THEN
    EXECUTE 'CREATE POLICY rc_insert ON public.referred_customers FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referred_customers' AND policyname='rc_update') THEN
    EXECUTE 'CREATE POLICY rc_update ON public.referred_customers FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── 3. commission_ledger ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id                              TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  revenue_source_id               TEXT,
  customer_id                     TEXT,
  source_type                     TEXT,
  affiliate_id                    TEXT,
  sub_affiliate_id                TEXT,
  parent_super_agent_id           TEXT,
  revenue_amount                  NUMERIC DEFAULT 0,
  network_pool_20                 NUMERIC DEFAULT 0,
  manager_commission_5            NUMERIC DEFAULT 0,
  sub_affiliate_gross_commission_15 NUMERIC DEFAULT 0,
  withholding_tax_rate            NUMERIC DEFAULT 0.05,
  withholding_tax_amount          NUMERIC DEFAULT 0,
  sub_affiliate_net_payout        NUMERIC DEFAULT 0,
  tin_number_available            BOOLEAN DEFAULT false,
  withholding_status              TEXT DEFAULT 'not_active'
    CHECK (withholding_status IN ('not_active','pending_tin','deducted','exempted')),
  status                          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','paid')),
  payout_batch_id                 TEXT,
  currency                        TEXT DEFAULT 'TZS',
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at                     TIMESTAMPTZ,
  paid_at                         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS commission_ledger_affiliate_idx ON public.commission_ledger (affiliate_id);
CREATE INDEX IF NOT EXISTS commission_ledger_sub_affiliate_idx ON public.commission_ledger (sub_affiliate_id);
CREATE INDEX IF NOT EXISTS commission_ledger_agent_idx ON public.commission_ledger (parent_super_agent_id);
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commission_ledger' AND policyname='cl_select') THEN
    EXECUTE 'CREATE POLICY cl_select ON public.commission_ledger FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commission_ledger' AND policyname='cl_insert') THEN
    EXECUTE 'CREATE POLICY cl_insert ON public.commission_ledger FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commission_ledger' AND policyname='cl_update') THEN
    EXECUTE 'CREATE POLICY cl_update ON public.commission_ledger FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── 4. monthly_reconciliation ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monthly_reconciliation (
  id                                TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  month                             TEXT         NOT NULL,
  super_agent_id                    TEXT,
  super_agent_name                  TEXT,
  sub_affiliate_id                  TEXT,
  sub_affiliate_name                TEXT,
  customer_count                    INTEGER DEFAULT 0,
  network_revenue                   NUMERIC DEFAULT 0,
  network_pool_20                   NUMERIC DEFAULT 0,
  manager_commission_5              NUMERIC DEFAULT 0,
  sub_affiliate_gross_commission_15 NUMERIC DEFAULT 0,
  withholding_tax_5                 NUMERIC DEFAULT 0,
  sub_affiliate_net_payout          NUMERIC DEFAULT 0,
  tin_status                        TEXT DEFAULT 'not_submitted',
  amount_paid                       NUMERIC DEFAULT 0,
  amount_pending                    NUMERIC DEFAULT 0,
  payout_status                     TEXT DEFAULT 'pending',
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS monthly_recon_month_idx ON public.monthly_reconciliation (month);
CREATE INDEX IF NOT EXISTS monthly_recon_agent_idx ON public.monthly_reconciliation (super_agent_id);
ALTER TABLE public.monthly_reconciliation ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_reconciliation' AND policyname='mr_select') THEN
    EXECUTE 'CREATE POLICY mr_select ON public.monthly_reconciliation FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_reconciliation' AND policyname='mr_insert') THEN
    EXECUTE 'CREATE POLICY mr_insert ON public.monthly_reconciliation FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_reconciliation' AND policyname='mr_update') THEN
    EXECUTE 'CREATE POLICY mr_update ON public.monthly_reconciliation FOR UPDATE USING (true)';
  END IF;
END $$;

-- ── 5. mirror_access_logs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mirror_access_logs (
  id               TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  viewer_user_id   TEXT         NOT NULL,
  viewer_role      TEXT,
  target_user_id   TEXT         NOT NULL,
  target_account_type TEXT,
  action           TEXT,
  fields_changed   JSONB,
  ip_address       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mirror_logs_viewer_idx ON public.mirror_access_logs (viewer_user_id);
ALTER TABLE public.mirror_access_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mirror_access_logs' AND policyname='mal_select') THEN
    EXECUTE 'CREATE POLICY mal_select ON public.mirror_access_logs FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mirror_access_logs' AND policyname='mal_insert') THEN
    EXECUTE 'CREATE POLICY mal_insert ON public.mirror_access_logs FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- ── 6. account_status_logs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_status_logs (
  id          TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id  TEXT         NOT NULL,
  changed_by  TEXT,
  old_status  TEXT,
  new_status  TEXT,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.account_status_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='account_status_logs' AND policyname='asl_select') THEN
    EXECUTE 'CREATE POLICY asl_select ON public.account_status_logs FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='account_status_logs' AND policyname='asl_insert') THEN
    EXECUTE 'CREATE POLICY asl_insert ON public.account_status_logs FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- ── Verify ────────────────────────────────────────────────────
SELECT table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'affiliates','referred_customers','commission_ledger',
    'monthly_reconciliation','mirror_access_logs','account_status_logs'
  )
ORDER BY table_name;

-- ============================================================
-- ENFORCE: Every affiliate must be recruited by a Partner
-- (No more standalone/organic affiliates — only Partners are exempt)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_require_parent_unless_partner'
    AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_require_parent_unless_partner
      CHECK (
        account_type IN ('partner', 'super_agent')
        OR parent_super_agent_id IS NOT NULL
      );
  END IF;
END $$;

-- Verify
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'public.affiliates'::regclass AND contype = 'c';
