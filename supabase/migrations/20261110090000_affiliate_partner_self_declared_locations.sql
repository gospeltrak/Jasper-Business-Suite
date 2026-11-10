-- Additive, non-destructive location fields shared by affiliate and agent onboarding.
-- Existing profiles remain valid; their locations can be completed in Settings.
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS district text;

ALTER TABLE public.affiliate_partners
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN public.affiliates.location IS 'Self-declared affiliate neighborhood or operating location';
COMMENT ON COLUMN public.affiliate_partners.location IS 'Self-declared partner or agent neighborhood or operating location';
