-- ============================================================
-- DEDICATED PARTNER TABLE: affiliate_partners
-- Separate from 'affiliates' table — partners are now their own entity.
-- Safe migration: does not touch existing affiliates/sub-affiliate data.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id                  TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             UUID          UNIQUE,
  display_name        TEXT          NOT NULL,
  promo_code          TEXT          NOT NULL UNIQUE,
  referral_slug       TEXT,
  status              TEXT          NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','inactive','under_review')),
  phone_whatsapp      TEXT,
  payout_account      TEXT,
  payout_method       TEXT,
  nida_number         TEXT,
  tin_number          TEXT,
  tin_status          TEXT          DEFAULT 'not_submitted'
                        CHECK (tin_status IN ('not_submitted','submitted','verified','rejected')),
  tin_submitted_at    TIMESTAMPTZ,
  tin_verified_by     TEXT,
  tin_verified_at     TIMESTAMPTZ,
  tin_rejection_reason TEXT,
  is_disabled         BOOLEAN       DEFAULT false,
  total_revenue       NUMERIC       DEFAULT 0,
  manager_commission  NUMERIC       DEFAULT 0,   -- accumulated 5% cut
  withholding_tax     NUMERIC       DEFAULT 0,
  net_payout          NUMERIC       DEFAULT 0,
  sub_affiliate_count INTEGER       DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS affiliate_partners_user_idx   ON public.affiliate_partners (user_id);
CREATE INDEX IF NOT EXISTS affiliate_partners_promo_idx  ON public.affiliate_partners (promo_code);
CREATE INDEX IF NOT EXISTS affiliate_partners_status_idx ON public.affiliate_partners (status);

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_partners' AND policyname='ap_select') THEN
    EXECUTE 'CREATE POLICY ap_select ON public.affiliate_partners FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_partners' AND policyname='ap_insert') THEN
    EXECUTE 'CREATE POLICY ap_insert ON public.affiliate_partners FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_partners' AND policyname='ap_update') THEN
    EXECUTE 'CREATE POLICY ap_update ON public.affiliate_partners FOR UPDATE USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='affiliate_partners' AND policyname='ap_delete') THEN
    EXECUTE 'CREATE POLICY ap_delete ON public.affiliate_partners FOR DELETE USING (true)';
  END IF;
END $$;

-- ============================================================
-- RE-WIRE: affiliates.parent_super_agent_id now points to
-- affiliate_partners.id instead of affiliates.id
-- ============================================================

-- Drop the old constraint that required either account_type='partner'
-- or a parent — that rule no longer applies since partners live
-- in their own table now and affiliates table only ever holds sub-affiliates.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_require_parent_unless_partner'
    AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates DROP CONSTRAINT affiliates_require_parent_unless_partner;
  END IF;
END $$;

-- Every row in 'affiliates' is now ALWAYS a sub-affiliate — must have a partner.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_require_partner'
    AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_require_partner
      CHECK (parent_super_agent_id IS NOT NULL);
  END IF;
END $$;

-- Add foreign key from affiliates.parent_super_agent_id -> affiliate_partners.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_parent_fk'
    AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_parent_fk
      FOREIGN KEY (parent_super_agent_id)
      REFERENCES public.affiliate_partners(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ============================================================
-- RE-WIRE: referred_customers + commission_ledger
-- parent_super_agent_id columns now reference affiliate_partners.id
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referred_customers_parent_fk'
    AND conrelid = 'public.referred_customers'::regclass
  ) THEN
    ALTER TABLE public.referred_customers
      ADD CONSTRAINT referred_customers_parent_fk
      FOREIGN KEY (parent_super_agent_id)
      REFERENCES public.affiliate_partners(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commission_ledger_parent_fk'
    AND conrelid = 'public.commission_ledger'::regclass
  ) THEN
    ALTER TABLE public.commission_ledger
      ADD CONSTRAINT commission_ledger_parent_fk
      FOREIGN KEY (parent_super_agent_id)
      REFERENCES public.affiliate_partners(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- MIGRATE: move any existing account_type='partner' rows from
-- affiliates -> affiliate_partners, then delete them from affiliates
-- ============================================================

INSERT INTO public.affiliate_partners (
  id, user_id, display_name, promo_code, referral_slug, status,
  phone_whatsapp, payout_account, payout_method, nida_number,
  tin_number, tin_status, is_disabled, total_revenue,
  manager_commission, withholding_tax, net_payout, created_at
)
SELECT
  id, user_id, display_name,
  COALESCE(promo_code, referral_code, id),
  referral_slug, status,
  phone_whatsapp, payout_account, payout_method, nida_number,
  tin_number, tin_status, COALESCE(is_disabled, false),
  COALESCE(total_revenue, 0), COALESCE(gross_commission, 0),
  COALESCE(withholding_tax, 0), COALESCE(net_payout, 0), created_at
FROM public.affiliates
WHERE account_type IN ('partner', 'super_agent')
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.affiliates WHERE account_type IN ('partner', 'super_agent');

-- ============================================================
-- Verify
-- ============================================================
SELECT 'affiliate_partners' AS table_name, count(*) AS row_count FROM public.affiliate_partners
UNION ALL
SELECT 'affiliates', count(*) FROM public.affiliates;
