-- ============================================================
-- CLEAN REBUILD of affiliate_partners (previous attempt left a
-- broken partial table — drop it and recreate fully in one shot)
-- ============================================================

DROP TABLE IF EXISTS public.affiliate_partners CASCADE;

CREATE TABLE public.affiliate_partners (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
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
  manager_commission  NUMERIC       DEFAULT 0,
  withholding_tax     NUMERIC       DEFAULT 0,
  net_payout          NUMERIC       DEFAULT 0,
  sub_affiliate_count INTEGER       DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX affiliate_partners_user_idx   ON public.affiliate_partners (user_id);
CREATE INDEX affiliate_partners_promo_idx  ON public.affiliate_partners (promo_code);
CREATE INDEX affiliate_partners_status_idx ON public.affiliate_partners (status);

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY ap_select ON public.affiliate_partners FOR SELECT USING (true);
CREATE POLICY ap_insert ON public.affiliate_partners FOR INSERT WITH CHECK (true);
CREATE POLICY ap_update ON public.affiliate_partners FOR UPDATE USING (true);
CREATE POLICY ap_delete ON public.affiliate_partners FOR DELETE USING (true);

-- ============================================================
-- Drop old broken constraint on affiliates (if present)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_require_parent_unless_partner'
    AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates DROP CONSTRAINT affiliates_require_parent_unless_partner;
  END IF;
END $$;

-- ============================================================
-- Migrate any existing partner rows out of affiliates
-- (your affiliates table is currently empty, so this is a no-op
-- now, but safe to keep for future runs / other environments)
-- ============================================================
INSERT INTO public.affiliate_partners (
  id, user_id, display_name, promo_code, referral_slug, status,
  phone_whatsapp, payout_account, payout_method, nida_number,
  tin_number, tin_status, is_disabled, total_revenue,
  manager_commission, withholding_tax, net_payout, created_at
)
SELECT
  id, user_id, display_name,
  COALESCE(NULLIF(promo_code, ''), NULLIF(referral_code, ''), id::text),
  referral_slug, COALESCE(status, 'active'),
  COALESCE(phone_whatsapp, whatsapp_phone),
  COALESCE(payout_account, payout_phone),
  payout_method, nida_number,
  tin_number, COALESCE(tin_status, 'not_submitted'), COALESCE(is_disabled, false),
  COALESCE(total_revenue, 0), COALESCE(gross_commission, 0),
  COALESCE(withholding_tax, 0), COALESCE(net_payout, 0), created_at
FROM public.affiliates
WHERE account_type IN ('partner', 'super_agent')
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.affiliates WHERE account_type IN ('partner', 'super_agent');

-- ============================================================
-- Every remaining row in affiliates must belong to a partner
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_require_partner'
    AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_require_partner
      CHECK (parent_super_agent_id IS NOT NULL AND parent_super_agent_id <> '');
  END IF;
END $$;

-- ============================================================
-- Verify — confirm the full column list this time, not just counts
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'affiliate_partners'
ORDER BY ordinal_position;
