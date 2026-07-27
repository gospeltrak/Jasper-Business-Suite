-- Multi-branch Phase 3F: immutable branch audit records, a durable outbox for
-- the existing Jasper notification centre, and reporting-only internal
-- movement/account-position views.
--
-- Safety properties:
--   * No tenant, user, branch, transaction, notification, audit, or report row
--     is inserted, updated, deleted, backfilled, or recalculated.
--   * Existing browser notification storage remains untouched. Phase 4 will
--     consume this outbox through audited branch-aware RPCs.
--   * Reporting views classify internal movements explicitly; they never turn
--     a fund transfer into revenue/expense or a stock transfer into sale/buying.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.branch_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  source text not null default 'database_rpc',
  correlation_id uuid,
  idempotency_key text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint branch_audit_logs_action_check
    check (action = lower(action) and action ~ '^[a-z0-9][a-z0-9._-]*$'),
  constraint branch_audit_logs_entity_type_check
    check (
      entity_type = lower(entity_type)
      and entity_type ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  constraint branch_audit_logs_source_check
    check (source in ('database_rpc', 'api', 'system', 'background_job')),
  constraint branch_audit_logs_actor_check
    check (
      actor_user_id is not null
      or source in ('system', 'background_job')
    ),
  constraint branch_audit_logs_idempotency_check
    check (
      idempotency_key is null
      or nullif(btrim(idempotency_key), '') is not null
    )
);

comment on table public.branch_audit_logs is
  'Immutable operational audit records. Metadata must never contain passwords, tokens, account secrets, or unmasked payment credentials.';

create unique index if not exists branch_audit_logs_tenant_id_id_uidx
  on public.branch_audit_logs (tenant_id, id);

create unique index if not exists branch_audit_logs_idempotency_uidx
  on public.branch_audit_logs (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists branch_audit_logs_branch_created_idx
  on public.branch_audit_logs (tenant_id, branch_id, created_at desc, id)
  where branch_id is not null;

create index if not exists branch_audit_logs_entity_created_idx
  on public.branch_audit_logs (
    tenant_id,
    entity_type,
    entity_id,
    created_at desc
  );

create index if not exists branch_audit_logs_actor_created_idx
  on public.branch_audit_logs (tenant_id, actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists branch_audit_logs_action_created_idx
  on public.branch_audit_logs (tenant_id, action, created_at desc);

-- This is the durable server-side source for the existing Jasper notification
-- centre, not a second user-facing notification product. Phase 4 will map its
-- fields to JasperNotification and mark delivery/read state through RPCs.
create table if not exists public.branch_notification_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid,
  audit_log_id uuid,
  event_type text not null,
  module_name text not null default 'branches',
  title text not null,
  message text not null,
  entity_type text not null,
  entity_id text,
  priority text not null default 'normal',
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint branch_notification_events_type_check
    check (
      event_type = lower(event_type)
      and event_type ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  constraint branch_notification_events_module_check
    check (
      module_name = lower(module_name)
      and module_name ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  constraint branch_notification_events_entity_check
    check (
      entity_type = lower(entity_type)
      and entity_type ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  constraint branch_notification_events_priority_check
    check (priority in ('low', 'normal', 'high', 'critical')),
  constraint branch_notification_events_content_check
    check (
      nullif(btrim(title), '') is not null
      and nullif(btrim(message), '') is not null
    ),
  constraint branch_notification_events_idempotency_check
    check (
      idempotency_key is null
      or nullif(btrim(idempotency_key), '') is not null
    )
);

create unique index if not exists branch_notification_events_tenant_id_id_uidx
  on public.branch_notification_events (tenant_id, id);

create unique index if not exists branch_notification_events_idempotency_uidx
  on public.branch_notification_events (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists branch_notification_events_branch_created_idx
  on public.branch_notification_events (
    tenant_id,
    branch_id,
    created_at desc,
    id
  )
  where branch_id is not null;

create index if not exists branch_notification_events_type_created_idx
  on public.branch_notification_events (
    tenant_id,
    event_type,
    created_at desc
  );

create index if not exists branch_notification_events_audit_idx
  on public.branch_notification_events (tenant_id, audit_log_id)
  where audit_log_id is not null;

create table if not exists public.branch_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null,
  recipient_user_id uuid not null,
  delivery_channel text not null default 'in_app',
  delivery_status text not null default 'pending',
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_notification_recipients_event_fkey
    foreign key (tenant_id, event_id)
    references public.branch_notification_events(tenant_id, id)
    on delete cascade,
  constraint branch_notification_recipients_user_fkey
    foreign key (tenant_id, recipient_user_id)
    references public.users(tenant_id, id)
    on delete cascade,
  constraint branch_notification_recipients_channel_check
    check (
      delivery_channel in ('in_app', 'email', 'sms', 'whatsapp', 'push')
    ),
  constraint branch_notification_recipients_status_check
    check (
      delivery_status in (
        'pending',
        'pending_configuration',
        'delivered',
        'failed',
        'skipped'
      )
    ),
  constraint branch_notification_recipients_delivery_check
    check (
      (delivery_status <> 'delivered' or delivered_at is not null)
      and (delivery_status <> 'failed' or nullif(btrim(failure_reason), '') is not null)
      and (read_at is null or delivered_at is not null)
    ),
  unique (tenant_id, event_id, recipient_user_id, delivery_channel)
);

create index if not exists branch_notification_recipients_event_idx
  on public.branch_notification_recipients (
    tenant_id,
    event_id,
    created_at
  );

create index if not exists branch_notification_recipients_unread_idx
  on public.branch_notification_recipients (
    tenant_id,
    recipient_user_id,
    created_at desc,
    event_id
  )
  where delivery_channel = 'in_app'
    and read_at is null
    and delivery_status in ('pending', 'delivered');

create index if not exists branch_notification_recipients_delivery_queue_idx
  on public.branch_notification_recipients (
    delivery_channel,
    delivery_status,
    created_at,
    id
  )
  where delivery_status in ('pending', 'pending_configuration');

create or replace function private.validate_branch_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1
    from public.branches as branch
    where branch.tenant_id = new.tenant_id
      and branch.id = new.branch_id
  ) then
    raise exception 'Audit branch must belong to the audit tenant.'
      using errcode = '23514';
  end if;

  if new.actor_user_id is not null and not exists (
    select 1
    from public.users as app_user
    where app_user.id = new.actor_user_id
      and (
        app_user.tenant_id = new.tenant_id
        or (
          app_user.tenant_id is null
          and lower(coalesce(app_user.account_type, '')) = 'super_admin'
        )
      )
  ) then
    raise exception 'Audit actor must belong to the tenant or be Super Admin.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_branch_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Branch audit records are immutable.' using errcode = '55000';
end;
$$;

create or replace function private.validate_branch_notification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1
    from public.branches as branch
    where branch.tenant_id = new.tenant_id
      and branch.id = new.branch_id
  ) then
    raise exception 'Notification branch must belong to the notification tenant.'
      using errcode = '23514';
  end if;

  if new.audit_log_id is not null and not exists (
    select 1
    from public.branch_audit_logs as audit_log
    where audit_log.tenant_id = new.tenant_id
      and audit_log.id = new.audit_log_id
  ) then
    raise exception 'Notification audit event must belong to the notification tenant.'
      using errcode = '23514';
  end if;

  if new.created_by is not null and not exists (
    select 1
    from public.users as app_user
    where app_user.id = new.created_by
      and (
        app_user.tenant_id = new.tenant_id
        or (
          app_user.tenant_id is null
          and lower(coalesce(app_user.account_type, '')) = 'super_admin'
        )
      )
  ) then
    raise exception 'Notification creator must belong to the tenant or be Super Admin.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_branch_notification_recipient_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.tenant_id is distinct from new.tenant_id
      or old.event_id is distinct from new.event_id
      or old.recipient_user_id is distinct from new.recipient_user_id
      or old.delivery_channel is distinct from new.delivery_channel
    then
      raise exception 'Notification recipient identity cannot be changed.'
        using errcode = '55000';
    end if;

    if old.delivery_status is distinct from new.delivery_status and not (
      (old.delivery_status = 'pending'
        and new.delivery_status in (
          'pending_configuration', 'delivered', 'failed', 'skipped'
        ))
      or (old.delivery_status = 'pending_configuration'
        and new.delivery_status in ('pending', 'failed', 'skipped'))
      or (old.delivery_status = 'failed'
        and new.delivery_status in ('pending', 'skipped'))
    ) then
      raise exception 'Invalid notification delivery transition: % -> %',
        old.delivery_status,
        new.delivery_status
        using errcode = '23514';
    end if;

    if old.read_at is not null and new.read_at is null then
      raise exception 'A read notification cannot be marked unread.'
        using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists branch_audit_logs_context_guard
  on public.branch_audit_logs;
create trigger branch_audit_logs_context_guard
before insert on public.branch_audit_logs
for each row execute function private.validate_branch_audit_log();

drop trigger if exists branch_audit_logs_immutable
  on public.branch_audit_logs;
create trigger branch_audit_logs_immutable
before update or delete on public.branch_audit_logs
for each row execute function private.prevent_branch_audit_mutation();

drop trigger if exists branch_notification_events_context_guard
  on public.branch_notification_events;
create trigger branch_notification_events_context_guard
before insert on public.branch_notification_events
for each row execute function private.validate_branch_notification_event();

drop trigger if exists branch_notification_events_immutable
  on public.branch_notification_events;
create trigger branch_notification_events_immutable
before update on public.branch_notification_events
for each row execute function private.prevent_immutable_multibranch_event_change();

drop trigger if exists branch_notification_recipients_state_guard
  on public.branch_notification_recipients;
create trigger branch_notification_recipients_state_guard
before insert or update on public.branch_notification_recipients
for each row execute function private.validate_branch_notification_recipient_update();

create or replace function private.append_branch_audit_event(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_source text,
  p_correlation_id uuid,
  p_idempotency_key text,
  p_before_state jsonb,
  p_after_state jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit_id uuid;
begin
  insert into public.branch_audit_logs (
    tenant_id,
    branch_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    source,
    correlation_id,
    idempotency_key,
    before_state,
    after_state,
    metadata
  )
  values (
    p_tenant_id,
    p_branch_id,
    p_actor_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_source,
    p_correlation_id,
    p_idempotency_key,
    p_before_state,
    p_after_state,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (tenant_id, idempotency_key)
    where idempotency_key is not null
  do nothing
  returning id into v_audit_id;

  if v_audit_id is null and p_idempotency_key is not null then
    select audit_log.id
    into v_audit_id
    from public.branch_audit_logs as audit_log
    where audit_log.tenant_id = p_tenant_id
      and audit_log.idempotency_key = p_idempotency_key;
  end if;

  if v_audit_id is null then
    raise exception 'Audit event could not be appended.' using errcode = 'P0001';
  end if;

  return v_audit_id;
end;
$$;

create or replace function private.enqueue_branch_notification(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_audit_log_id uuid,
  p_created_by uuid,
  p_event_type text,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id text,
  p_priority text,
  p_idempotency_key text,
  p_payload jsonb,
  p_recipient_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if coalesce(cardinality(p_recipient_user_ids), 0) = 0
    or array_position(p_recipient_user_ids, null) is not null
  then
    raise exception 'At least one valid notification recipient is required.'
      using errcode = '22023';
  end if;

  insert into public.branch_notification_events (
    tenant_id,
    branch_id,
    audit_log_id,
    event_type,
    title,
    message,
    entity_type,
    entity_id,
    priority,
    idempotency_key,
    payload,
    created_by
  )
  values (
    p_tenant_id,
    p_branch_id,
    p_audit_log_id,
    p_event_type,
    p_title,
    p_message,
    p_entity_type,
    p_entity_id,
    p_priority,
    p_idempotency_key,
    coalesce(p_payload, '{}'::jsonb),
    p_created_by
  )
  on conflict (tenant_id, idempotency_key)
    where idempotency_key is not null
  do nothing
  returning id into v_event_id;

  if v_event_id is null and p_idempotency_key is not null then
    select event.id
    into v_event_id
    from public.branch_notification_events as event
    where event.tenant_id = p_tenant_id
      and event.idempotency_key = p_idempotency_key;

    if v_event_id is not null then
      return v_event_id;
    end if;
  end if;

  if v_event_id is null then
    raise exception 'Notification event could not be enqueued.'
      using errcode = 'P0001';
  end if;

  insert into public.branch_notification_recipients (
    tenant_id,
    event_id,
    recipient_user_id,
    delivery_channel,
    delivery_status
  )
  select
    p_tenant_id,
    v_event_id,
    recipient.recipient_user_id,
    'in_app',
    'pending'
  from (
    select distinct unnest(p_recipient_user_ids) as recipient_user_id
  ) as recipient
  on conflict (
    tenant_id,
    event_id,
    recipient_user_id,
    delivery_channel
  ) do nothing;

  return v_event_id;
end;
$$;

-- One canonical register lets report services identify every internal movement
-- without inferring it from free text. All consolidated accounting flags are
-- false by definition, preventing transfer inflation in company totals.
create or replace view public.branch_internal_movement_reporting
with (security_invoker = true)
as
select
  stock_transfer.tenant_id,
  stock_transfer.id as movement_id,
  'stock_transfer'::text as movement_type,
  stock_transfer.transfer_number as movement_number,
  stock_transfer.from_branch_id as source_branch_id,
  stock_transfer.to_branch_id as destination_branch_id,
  stock_transfer.status,
  coalesce(stock_transfer.transfer_date, stock_transfer.created_at)
    as movement_at,
  null::numeric(18, 2) as amount,
  null::text as currency,
  false as include_in_consolidated_revenue,
  false as include_in_consolidated_expenses,
  false as include_in_consolidated_sales,
  false as include_in_consolidated_purchases,
  false as include_in_external_cash_flow,
  stock_transfer.created_at
from public.branch_inventory_transfers as stock_transfer

union all

select
  fund_transfer.tenant_id,
  fund_transfer.id as movement_id,
  'fund_transfer'::text as movement_type,
  fund_transfer.transfer_number as movement_number,
  fund_transfer.from_branch_id as source_branch_id,
  fund_transfer.to_branch_id as destination_branch_id,
  fund_transfer.status,
  coalesce(fund_transfer.transfer_date, fund_transfer.created_at)
    as movement_at,
  fund_transfer.amount::numeric(18, 2) as amount,
  fund_transfer.currency,
  false as include_in_consolidated_revenue,
  false as include_in_consolidated_expenses,
  false as include_in_consolidated_sales,
  false as include_in_consolidated_purchases,
  false as include_in_external_cash_flow,
  fund_transfer.created_at
from public.branch_money_transfers as fund_transfer;

comment on view public.branch_internal_movement_reporting is
  'Server-only reporting register. Internal fund/stock movements are never revenue, expense, sale, purchase, or external cash flow.';

-- Detailed real-balance input for branch and consolidated cash/bank/mobile
-- position reports. It intentionally does not cache or fabricate aggregates.
create or replace view public.branch_account_position_reporting
with (security_invoker = true)
as
select
  balance.tenant_id,
  balance.branch_id,
  balance.account_id,
  account.account_name,
  account.account_type,
  balance.currency,
  balance.current_balance,
  balance.row_version,
  account.status as account_status,
  account.is_locked,
  balance.updated_at
from public.branch_account_balances as balance
join public.branch_payment_accounts as account
  on account.tenant_id = balance.tenant_id
  and account.id = balance.account_id
  and account.branch_id = balance.branch_id
  and account.currency = balance.currency;

comment on view public.branch_account_position_reporting is
  'Server-only real account balances for branch and All Branches reporting; no snapshot or estimated values.';

alter table public.branch_audit_logs enable row level security;
alter table public.branch_audit_logs force row level security;
alter table public.branch_notification_events enable row level security;
alter table public.branch_notification_events force row level security;
alter table public.branch_notification_recipients enable row level security;
alter table public.branch_notification_recipients force row level security;

revoke all on table public.branch_audit_logs from anon, authenticated;
revoke all on table public.branch_notification_events from anon, authenticated;
revoke all on table public.branch_notification_recipients from anon, authenticated;
revoke all on table public.branch_internal_movement_reporting
  from anon, authenticated;
revoke all on table public.branch_account_position_reporting
  from anon, authenticated;

revoke all on function private.validate_branch_audit_log() from public;
revoke all on function private.prevent_branch_audit_mutation() from public;
revoke all on function private.validate_branch_notification_event() from public;
revoke all on function private.validate_branch_notification_recipient_update()
  from public;
revoke all on function private.append_branch_audit_event(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb
) from public;
revoke all on function private.enqueue_branch_notification(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  uuid[]
) from public;

commit;
