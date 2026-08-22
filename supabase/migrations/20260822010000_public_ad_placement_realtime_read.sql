-- Lets any authenticated tenant/affiliate browser read (SELECT only) the
-- global ad-placement record directly, so the client can subscribe to it
-- over Supabase Realtime instead of polling a REST endpoint on a timer.
-- This record is already served to anyone, unauthenticated, via
-- GET /api/platform-records/global_ad_placement/global -- this policy does
-- not expose anything that wasn't already public. Writes remain restricted
-- to platform admins by the existing policy; no other record_type is
-- affected.

begin;

drop policy if exists super_admin_platform_records_public_ad_read on public.super_admin_platform_records;
create policy super_admin_platform_records_public_ad_read on public.super_admin_platform_records
  for select
  to authenticated
  using (record_type = 'global_ad_placement');

commit;
