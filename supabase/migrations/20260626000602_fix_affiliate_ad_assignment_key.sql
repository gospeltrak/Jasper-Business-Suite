-- An assignment can target either one affiliate or one group. A composite
-- primary key would force both nullable target columns to be present.
alter table public.affiliate_ad_assignments
  add column if not exists id uuid default gen_random_uuid();

update public.affiliate_ad_assignments
set id = gen_random_uuid()
where id is null;

alter table public.affiliate_ad_assignments
  alter column id set not null;

alter table public.affiliate_ad_assignments
  drop constraint if exists affiliate_ad_assignments_pkey;

alter table public.affiliate_ad_assignments
  add primary key (id);

create unique index if not exists affiliate_ad_assignments_campaign_affiliate_unique
  on public.affiliate_ad_assignments (campaign_id, affiliate_id)
  where affiliate_id is not null;

create unique index if not exists affiliate_ad_assignments_campaign_group_unique
  on public.affiliate_ad_assignments (campaign_id, group_id)
  where group_id is not null;
