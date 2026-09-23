-- Notification inbox for affiliates and partners (super agents), mirroring
-- the tenant notification centre (branch_notification_events) so a Super
-- Admin message reaches these two account types too, not just tenants.

begin;

create table if not exists public.affiliate_notification_events (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  partner_id uuid references public.affiliate_partners(id) on delete cascade,
  title text not null,
  message text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint affiliate_notification_events_single_recipient check (
    (affiliate_id is not null and partner_id is null)
    or (affiliate_id is null and partner_id is not null)
  )
);

create index if not exists affiliate_notification_events_affiliate_idx
  on public.affiliate_notification_events (affiliate_id, created_at desc)
  where affiliate_id is not null;
create index if not exists affiliate_notification_events_partner_idx
  on public.affiliate_notification_events (partner_id, created_at desc)
  where partner_id is not null;

alter table public.affiliate_notification_events enable row level security;
alter table public.affiliate_notification_events force row level security;

drop policy if exists affiliate_notification_events_recipient_read on public.affiliate_notification_events;
create policy affiliate_notification_events_recipient_read
  on public.affiliate_notification_events for select to authenticated
  using (
    affiliate_id = (select private.current_affiliate_id())
    or partner_id in (select id from public.affiliate_partners where user_id = (select auth.uid()))
    or (select private.is_platform_admin())
  );

drop policy if exists affiliate_notification_events_recipient_mark_read on public.affiliate_notification_events;
create policy affiliate_notification_events_recipient_mark_read
  on public.affiliate_notification_events for update to authenticated
  using (
    affiliate_id = (select private.current_affiliate_id())
    or partner_id in (select id from public.affiliate_partners where user_id = (select auth.uid()))
  )
  with check (
    affiliate_id = (select private.current_affiliate_id())
    or partner_id in (select id from public.affiliate_partners where user_id = (select auth.uid()))
  );

revoke all on table public.affiliate_notification_events from anon;

drop function if exists public.super_admin_send_affiliate_notification(uuid[], uuid[], text, text, text);
create function public.super_admin_send_affiliate_notification(
  p_affiliate_ids uuid[],
  p_partner_ids uuid[],
  p_title text,
  p_message text,
  p_priority text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_title text := nullif(btrim(p_title), '');
  v_message text := nullif(btrim(p_message), '');
  v_priority text := lower(coalesce(nullif(btrim(p_priority), ''), 'normal'));
  v_affiliate_id uuid;
  v_partner_id uuid;
  v_affiliate_count integer := 0;
  v_partner_count integer := 0;
begin
  if v_actor_id is null or not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform administrator access is required.';
  end if;
  if coalesce(array_length(p_affiliate_ids, 1), 0) = 0 and coalesce(array_length(p_partner_ids, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'At least one target affiliate or partner is required.';
  end if;
  if coalesce(array_length(p_affiliate_ids, 1), 0) + coalesce(array_length(p_partner_ids, 1), 0) > 5000 then
    raise exception using errcode = '22023', message = 'Too many target recipients in a single request.';
  end if;
  if v_title is null or v_message is null then
    raise exception using errcode = '22023', message = 'A title and message are required.';
  end if;
  if v_priority not in ('low', 'normal', 'high', 'critical') then
    v_priority := 'normal';
  end if;

  for v_affiliate_id in select distinct a from unnest(coalesce(p_affiliate_ids, '{}'::uuid[])) as a loop
    if exists (select 1 from public.affiliates where id = v_affiliate_id) then
      insert into public.affiliate_notification_events (affiliate_id, title, message, priority, created_by)
      values (v_affiliate_id, v_title, v_message, v_priority, v_actor_id);
      v_affiliate_count := v_affiliate_count + 1;
    end if;
  end loop;

  for v_partner_id in select distinct p from unnest(coalesce(p_partner_ids, '{}'::uuid[])) as p loop
    if exists (select 1 from public.affiliate_partners where id = v_partner_id) then
      insert into public.affiliate_notification_events (partner_id, title, message, priority, created_by)
      values (v_partner_id, v_title, v_message, v_priority, v_actor_id);
      v_partner_count := v_partner_count + 1;
    end if;
  end loop;

  return jsonb_build_object('affiliatesSent', v_affiliate_count, 'partnersSent', v_partner_count);
end;
$$;

revoke all on function public.super_admin_send_affiliate_notification(uuid[], uuid[], text, text, text)
  from public, anon;
grant execute on function public.super_admin_send_affiliate_notification(uuid[], uuid[], text, text, text)
  to authenticated;

commit;
