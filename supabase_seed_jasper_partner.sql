-- ============================================================
-- Seed the single Super Affiliate Agent (Partner) account
--   Phone:     +255655746552
--   Password:  madewithLove01JB
--   Promo:     JASPER
--   Status:    active
-- This account is the ONLY recruiter — every sub-affiliate must
-- register using promo code JASPER.
-- ============================================================

DO $$
DECLARE
  v_user_id   UUID := gen_random_uuid();
  v_email     TEXT := 'affiliate-255655746552@jasper.local';
  v_password  TEXT := 'madewithLove01JB';
  v_phone     TEXT := '+255655746552';
BEGIN

  -- Skip entirely if this email already exists (idempotent — safe to re-run)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'Auth user already exists for %, skipping creation.', v_email;
  ELSE

    -- 1. Create the auth user
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Jasper Partner', 'is_affiliate', true),
      NOW(),
      NOW(),
      false,
      false
    );

    -- 2. Create the matching identity row (required for password login to work)
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

  END IF;

  -- 3. Create or update the affiliate_partners profile row
  --    (idempotent — re-running this script just refreshes the profile)
  INSERT INTO public.affiliate_partners (
    user_id, display_name, promo_code, referral_slug, status,
    phone_whatsapp, payout_account, payout_method,
    is_disabled, promo_code_locked
  )
  SELECT
    v_user_id, 'Jasper Partner', 'JASPER', 'jasper', 'active',
    v_phone, v_phone, 'm-pesa',
    false, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.affiliate_partners WHERE promo_code = 'JASPER'
  );

END $$;

-- ============================================================
-- Verify
-- ============================================================
SELECT u.id AS user_id, u.email, u.phone, u.email_confirmed_at,
       p.display_name, p.promo_code, p.status, p.is_disabled, p.promo_code_locked
FROM auth.users u
JOIN public.affiliate_partners p ON p.user_id = u.id
WHERE u.email = 'affiliate-255655746552@jasper.local';
