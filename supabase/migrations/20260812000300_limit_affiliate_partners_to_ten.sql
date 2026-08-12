create or replace function public.enforce_affiliate_partner_capacity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('affiliate_partners_capacity'));
  if (select count(*) from public.affiliate_partners) >= 10 then
    raise exception using errcode = '23514', message = 'The maximum of 10 Partner accounts has been reached.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_affiliate_partner_capacity() from public, anon, authenticated;
drop trigger if exists enforce_affiliate_partner_capacity_before_insert on public.affiliate_partners;
create trigger enforce_affiliate_partner_capacity_before_insert
before insert on public.affiliate_partners
for each row execute function public.enforce_affiliate_partner_capacity();
