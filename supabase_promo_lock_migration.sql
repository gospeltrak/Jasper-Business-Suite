-- ============================================================
-- One-time promo code edit lock for partners
-- ============================================================

ALTER TABLE public.affiliate_partners
  ADD COLUMN IF NOT EXISTS promo_code_locked BOOLEAN NOT NULL DEFAULT false;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'affiliate_partners' AND column_name = 'promo_code_locked';
