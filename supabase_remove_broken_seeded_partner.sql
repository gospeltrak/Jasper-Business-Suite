-- ============================================================
-- Remove the broken seeded partner account (auth + profile)
-- Root cause: the password hash was generated via Postgres crypt()
-- in raw SQL, which is not reliably compatible with Supabase's
-- actual auth service (GoTrue uses its own bcrypt implementation).
-- The account exists and looks correct in the database, but
-- signInWithPassword fails every time with "Invalid login credentials".
--
-- This script removes BOTH the auth identity and the affiliate_partners
-- profile row, so the phone number / promo code are completely free to
-- re-register fresh through the real /partner signup form.
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
  v_email   TEXT := 'affiliate-255655746552@jasper.local';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth user found for %, nothing to remove.', v_email;
  ELSE
    -- Remove the affiliate_partners profile row first
    DELETE FROM public.affiliate_partners WHERE user_id = v_user_id;

    -- Remove the auth identity, then the auth user itself
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;

    RAISE NOTICE 'Removed broken seeded account for % (user_id %).', v_email, v_user_id;
  END IF;
END $$;

-- ============================================================
-- Verify — both should return zero rows
-- ============================================================
SELECT * FROM auth.users WHERE email = 'affiliate-255655746552@jasper.local';
SELECT * FROM public.affiliate_partners WHERE promo_code = 'JASPER';
