do $$
begin
  if to_regclass('public.platform_notification_events') is null then
    raise exception 'platform notification events table is missing';
  end if;
  if to_regclass('public.platform_notification_reads') is null then
    raise exception 'platform notification reads table is missing';
  end if;
  if not exists (
    select 1 from pg_class where oid = 'public.platform_notification_events'::regclass and relrowsecurity and relforcerowsecurity
  ) then
    raise exception 'platform notification events must force RLS';
  end if;
  if has_table_privilege('anon', 'public.platform_notification_events', 'select')
     or has_table_privilege('authenticated', 'public.platform_notification_events', 'select') then
    raise exception 'platform notifications must not be directly readable through the Data API';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'platform_payment_proof_notification' and not tgisinternal) then
    raise exception 'payment proof notification trigger is missing';
  end if;
end;
$$;
