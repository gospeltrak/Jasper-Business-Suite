begin;

create table if not exists public.platform_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  module_name text not null default 'platform',
  title text not null,
  message text not null,
  priority text not null default 'normal',
  entity_type text not null,
  entity_id text,
  target_tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_notification_event_type_check check (event_type ~ '^[a-z0-9][a-z0-9._-]*$'),
  constraint platform_notification_module_check check (module_name ~ '^[a-z0-9][a-z0-9._-]*$'),
  constraint platform_notification_priority_check check (priority in ('low', 'normal', 'high', 'critical')),
  constraint platform_notification_content_check check (nullif(btrim(title), '') is not null and nullif(btrim(message), '') is not null)
);

create index if not exists platform_notification_events_created_idx
  on public.platform_notification_events (created_at desc, id);
create index if not exists platform_notification_events_tenant_created_idx
  on public.platform_notification_events (target_tenant_id, created_at desc)
  where target_tenant_id is not null;

create table if not exists public.platform_notification_reads (
  event_id uuid not null references public.platform_notification_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists platform_notification_reads_user_idx
  on public.platform_notification_reads (user_id, read_at desc);

create or replace function private.enqueue_platform_notification(
  p_event_type text,
  p_module_name text,
  p_title text,
  p_message text,
  p_priority text,
  p_entity_type text,
  p_entity_id text,
  p_target_tenant_id uuid,
  p_actor_user_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_id uuid;
begin
  insert into public.platform_notification_events (
    event_type, module_name, title, message, priority, entity_type, entity_id,
    target_tenant_id, actor_user_id, payload
  ) values (
    lower(p_event_type), lower(p_module_name), btrim(p_title), btrim(p_message),
    p_priority, lower(p_entity_type), nullif(btrim(p_entity_id), ''),
    p_target_tenant_id, p_actor_user_id, coalesce(p_payload, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.notify_platform_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'INSERT' then
    perform private.enqueue_platform_notification(
      'tenant.registered', 'subscribers', 'New tenant registered',
      coalesce(new.name, 'A new tenant') || ' created a business account.',
      'normal', 'tenant', new.id::text, new.id, null,
      jsonb_build_object('business_name', new.name, 'subscription_status', new.subscription_status)
    );
  elsif new.active_package_id is distinct from old.active_package_id
     or new.subscription_status is distinct from old.subscription_status then
    perform private.enqueue_platform_notification(
      'tenant.package_activated', 'subscriptions', 'Tenant package updated',
      coalesce(new.name, 'Tenant') || ' is now on ' || coalesce(new.active_package_id, new.subscription_status, 'updated access') || '.',
      'high', 'tenant', new.id::text, new.id, null,
      jsonb_build_object(
        'previous_package_id', old.active_package_id,
        'active_package_id', new.active_package_id,
        'subscription_status', new.subscription_status,
        'change_type', new.package_change_type,
        'change_note', new.package_change_note
      )
    );
  end if;
  return new;
end;
$$;

create or replace function private.notify_platform_payment_proof()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'INSERT' then
    perform private.enqueue_platform_notification(
      'payment.submitted', 'subscriptions', 'Payment receipt submitted',
      coalesce(new.tenant_name, 'Tenant') || ' submitted a receipt for ' || coalesce(new.requested_package_name, 'a package') || '.',
      'high', 'payment_proof', new.id::text, new.tenant_id, new.submitted_by,
      jsonb_build_object('package_id', new.requested_package_id, 'amount', new.amount, 'currency', new.currency, 'status', new.status)
    );
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform private.enqueue_platform_notification(
      'payment.' || new.status, 'subscriptions', 'Payment request ' || new.status,
      coalesce(new.tenant_name, 'Tenant') || ' payment request was ' || new.status || '.',
      case when new.status = 'rejected' then 'high' else 'normal' end,
      'payment_proof', new.id::text, new.tenant_id, null,
      jsonb_build_object('package_id', new.requested_package_id, 'status', new.status, 'rejected_reason', new.rejected_reason)
    );
  end if;
  return new;
end;
$$;

create or replace function private.notify_platform_portal_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_kind text := case when tg_table_name = 'affiliate_partners' then 'partner' else 'affiliate' end;
begin
  perform private.enqueue_platform_notification(
    v_kind || '.registered', 'affiliates', initcap(v_kind) || ' registered',
    coalesce(new.display_name, initcap(v_kind)) || ' created a new ' || v_kind || ' account.',
    'normal', v_kind, new.id::text, null, new.user_id,
    jsonb_build_object('display_name', new.display_name, 'status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists platform_tenant_notification on public.tenants;
create trigger platform_tenant_notification
after insert or update of active_package_id, subscription_status on public.tenants
for each row execute function private.notify_platform_tenant_change();

drop trigger if exists platform_payment_proof_notification on public.tenant_payment_proofs;
create trigger platform_payment_proof_notification
after insert or update of status on public.tenant_payment_proofs
for each row execute function private.notify_platform_payment_proof();

drop trigger if exists platform_affiliate_notification on public.affiliates;
create trigger platform_affiliate_notification
after insert on public.affiliates
for each row execute function private.notify_platform_portal_registration();

drop trigger if exists platform_partner_notification on public.affiliate_partners;
create trigger platform_partner_notification
after insert on public.affiliate_partners
for each row execute function private.notify_platform_portal_registration();

alter table public.platform_notification_events enable row level security;
alter table public.platform_notification_events force row level security;
alter table public.platform_notification_reads enable row level security;
alter table public.platform_notification_reads force row level security;

revoke all on table public.platform_notification_events from anon, authenticated;
revoke all on table public.platform_notification_reads from anon, authenticated;
revoke all on function private.enqueue_platform_notification(text,text,text,text,text,text,text,uuid,uuid,jsonb) from public;
revoke all on function private.notify_platform_tenant_change() from public;
revoke all on function private.notify_platform_payment_proof() from public;
revoke all on function private.notify_platform_portal_registration() from public;

commit;
