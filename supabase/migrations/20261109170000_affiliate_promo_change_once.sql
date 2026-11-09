-- One-time affiliate promo-code change, enforced at the row boundary.
-- Additive only: no existing code, subscriber, reward or tenant record is modified.
alter table public.affiliates
  add column if not exists promo_code_changed_at timestamptz;

create or replace function public.enforce_affiliate_promo_change_once()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  -- Platform backend/service-role administration is separate. Authenticated
  -- affiliates may modify the code exactly once; this cannot be bypassed
  -- by changing the browser UI or sending a direct PostgREST update.
  if auth.uid() is not null and auth.uid() = old.user_id then
    if new.promo_code_changed_at is distinct from old.promo_code_changed_at then
      raise exception 'Promo-code change marker cannot be modified';
    end if;
    if (new.promo_code, new.referral_code, new.referral_slug)
       is distinct from (old.promo_code, old.referral_code, old.referral_slug) then
      if old.promo_code_changed_at is not null then
        raise exception 'Promo code has already been changed once';
      end if;
      if new.promo_code is null
        or new.promo_code !~ '^[A-Z0-9_-]{3,20}$'
        or new.referral_code is distinct from new.promo_code
        or new.referral_slug is distinct from lower(new.promo_code) then
        raise exception 'Invalid promo code format';
      end if;
      new.promo_code_changed_at := now();
    end if;
  end if;
  return new;
end;
$body$;

drop trigger if exists enforce_affiliate_promo_change_once_trigger on public.affiliates;
create trigger enforce_affiliate_promo_change_once_trigger
  before update of promo_code, referral_code, referral_slug, promo_code_changed_at
  on public.affiliates for each row
  execute function public.enforce_affiliate_promo_change_once();
