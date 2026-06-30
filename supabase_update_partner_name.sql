-- ============================================================
-- Update display name for the seeded Jasper partner account
-- ============================================================

UPDATE public.affiliate_partners
SET display_name = 'Magreth Kenneth'
WHERE promo_code = 'JASPER';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{display_name}', '"Magreth Kenneth"')
WHERE email = 'affiliate-255655746552@jasper.local';

-- Verify
SELECT u.email, u.phone, p.display_name, p.promo_code, p.status, p.is_disabled
FROM auth.users u
JOIN public.affiliate_partners p ON p.user_id = u.id
WHERE p.promo_code = 'JASPER';
