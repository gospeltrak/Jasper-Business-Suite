-- Multi-branch Phase 3E: payment accounts, branch fund requests, inter-branch
-- fund-transfer workflow, immutable histories, and reversal-ready journals.
--
-- This migration creates no account balance, fund request, transfer, journal,
-- revenue, expense, or tenant data. Atomic balance posting remains disabled
-- until the later fund-transfer implementation phase installs audited RPCs.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.branch_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  account_name text not null,
  account_type text not null,
  currency text not null default 'TZS',
  provider_name text,
  masked_reference text,
  status text not null default 'active',
  is_default boolean not null default false,
  is_locked boolean not null default false,
  lock_reason text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_payment_accounts_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_payment_accounts_type_check
    check (account_type in ('cash', 'bank', 'mobile_money', 'card', 'other')),
  constraint branch_payment_accounts_status_check
    check (status in ('active', 'inactive', 'archived')),
  constraint branch_payment_accounts_lock_check
    check ((not is_locked) or nullif(btrim(lock_reason), '') is not null),
  unique (tenant_id, branch_id, account_name, currency)
);

comment on column public.branch_payment_accounts.masked_reference is
  'Display-only masked account reference; credentials and full account secrets stay server-side.';

create unique index if not exists branch_payment_accounts_tenant_id_id_uidx
  on public.branch_payment_accounts (tenant_id, id);

create unique index if not exists branch_payment_accounts_branch_id_uidx
  on public.branch_payment_accounts (tenant_id, id, branch_id);

create unique index if not exists branch_payment_accounts_branch_currency_uidx
  on public.branch_payment_accounts (tenant_id, id, branch_id, currency);

create unique index if not exists branch_payment_accounts_one_default_idx
  on public.branch_payment_accounts (
    tenant_id,
    branch_id,
    currency,
    account_type
  )
  where is_default and status = 'active';

create index if not exists branch_payment_accounts_branch_status_idx
  on public.branch_payment_accounts (
    tenant_id,
    branch_id,
    status,
    account_type
  );

create table if not exists public.branch_account_balances (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  account_id uuid not null,
  currency text not null,
  current_balance numeric(18, 2) not null default 0,
  row_version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, account_id, currency),
  constraint branch_account_balances_account_fkey
    foreign key (tenant_id, account_id, branch_id, currency)
    references public.branch_payment_accounts(tenant_id, id, branch_id, currency)
    on delete restrict,
  constraint branch_account_balances_values_check
    check (current_balance >= 0 and row_version >= 0)
);

create index if not exists branch_account_balances_branch_idx
  on public.branch_account_balances (tenant_id, branch_id, currency, account_id);

create table if not exists public.branch_fund_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_number text,
  requesting_branch_id uuid not null,
  requested_from_branch_id uuid,
  destination_account_id uuid,
  amount_requested numeric(18, 2) not null,
  amount_approved numeric(18, 2),
  currency text not null default 'TZS',
  purpose text not null,
  expense_category text,
  required_date date,
  notes text,
  supporting_document_url text,
  status text not null default 'draft',
  idempotency_key text,
  requested_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  rejected_by uuid references public.users(id) on delete set null,
  closed_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  funded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_fund_requests_requesting_branch_fkey
    foreign key (tenant_id, requesting_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_fund_requests_source_branch_fkey
    foreign key (tenant_id, requested_from_branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint branch_fund_requests_destination_account_fkey
    foreign key (
      tenant_id,
      destination_account_id,
      requesting_branch_id,
      currency
    )
    references public.branch_payment_accounts(
      tenant_id,
      id,
      branch_id,
      currency
    )
    on delete restrict,
  constraint branch_fund_requests_status_check
    check (status in ('draft', 'submitted', 'approved', 'partially_approved', 'rejected', 'funded', 'closed', 'cancelled')),
  constraint branch_fund_requests_amount_check
    check (
      amount_requested > 0
      and (amount_approved is null or amount_approved > 0)
      and (amount_approved is null or amount_approved <= amount_requested)
    ),
  constraint branch_fund_requests_approval_amount_check
    check (
      status not in ('approved', 'partially_approved', 'funded', 'closed')
      or (
        amount_approved is not null
        and (
          (status = 'approved' and amount_approved = amount_requested)
          or
          (status = 'partially_approved' and amount_approved < amount_requested)
          or (status in ('funded', 'closed') and amount_approved <= amount_requested)
        )
      )
    ),
  constraint branch_fund_requests_distinct_branches_check
    check (
      requested_from_branch_id is null
      or requested_from_branch_id <> requesting_branch_id
    ),
  constraint branch_fund_requests_workflow_fields_check
    check (
      status = 'draft'
      or (
        nullif(btrim(request_number), '') is not null
        and nullif(btrim(idempotency_key), '') is not null
      )
    )
);

create unique index if not exists branch_fund_requests_tenant_id_id_uidx
  on public.branch_fund_requests (tenant_id, id);

create unique index if not exists branch_fund_requests_number_uidx
  on public.branch_fund_requests (tenant_id, request_number)
  where request_number is not null;

create unique index if not exists branch_fund_requests_idempotency_uidx
  on public.branch_fund_requests (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists branch_fund_requests_requesting_queue_idx
  on public.branch_fund_requests (
    tenant_id,
    requesting_branch_id,
    status,
    created_at desc
  );

create index if not exists branch_fund_requests_source_queue_idx
  on public.branch_fund_requests (
    tenant_id,
    requested_from_branch_id,
    status,
    created_at desc
  )
  where requested_from_branch_id is not null;

-- Evolve the existing equivalent transfer table instead of creating a second
-- transfer ledger.
alter table public.branch_money_transfers
  add column if not exists transfer_number text,
  add column if not exists fund_request_id uuid,
  add column if not exists source_account_id uuid,
  add column if not exists destination_account_id uuid,
  add column if not exists currency text,
  add column if not exists purpose text,
  add column if not exists transfer_date timestamptz,
  add column if not exists expected_receipt_date timestamptz,
  add column if not exists requested_by uuid references public.users(id) on delete set null,
  add column if not exists rejected_by uuid references public.users(id) on delete set null,
  add column if not exists sent_by uuid references public.users(id) on delete set null,
  add column if not exists cancelled_by uuid references public.users(id) on delete set null,
  add column if not exists reversed_by uuid references public.users(id) on delete set null,
  add column if not exists requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists reversed_at timestamptz,
  add column if not exists proof_of_payment_url text,
  add column if not exists receipt_attachment_url text,
  add column if not exists linked_expense_ref text,
  add column if not exists idempotency_key text;

alter table public.branch_money_transfers
  alter column currency set default 'TZS',
  alter column transfer_date set default now();

create unique index if not exists branch_money_transfers_tenant_id_id_uidx
  on public.branch_money_transfers (tenant_id, id);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'branch_money_transfers_status_check'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      drop constraint branch_money_transfers_status_check;
  end if;

  alter table public.branch_money_transfers
    add constraint branch_money_transfers_status_check
    check (
      status in (
        'draft',
        'pending',
        'requested',
        'approved',
        'rejected',
        'sent',
        'in_transit',
        'received',
        'cancelled',
        'reversed'
      )
    ) not valid;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_money_transfers_source_tenant_fkey'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      add constraint branch_money_transfers_source_tenant_fkey
      foreign key (tenant_id, from_branch_id)
      references public.branches(tenant_id, id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_money_transfers_destination_tenant_fkey'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      add constraint branch_money_transfers_destination_tenant_fkey
      foreign key (tenant_id, to_branch_id)
      references public.branches(tenant_id, id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_money_transfers_request_fkey'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      add constraint branch_money_transfers_request_fkey
      foreign key (tenant_id, fund_request_id)
      references public.branch_fund_requests(tenant_id, id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_money_transfers_source_account_fkey'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      add constraint branch_money_transfers_source_account_fkey
      foreign key (tenant_id, source_account_id, from_branch_id, currency)
      references public.branch_payment_accounts(
        tenant_id,
        id,
        branch_id,
        currency
      )
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_money_transfers_destination_account_fkey'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      add constraint branch_money_transfers_destination_account_fkey
      foreign key (tenant_id, destination_account_id, to_branch_id, currency)
      references public.branch_payment_accounts(
        tenant_id,
        id,
        branch_id,
        currency
      )
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_money_transfers_distinct_branches_check'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      add constraint branch_money_transfers_distinct_branches_check
      check (from_branch_id <> to_branch_id) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_money_transfers_workflow_fields_check'
      and conrelid = 'public.branch_money_transfers'::regclass
  ) then
    alter table public.branch_money_transfers
      add constraint branch_money_transfers_workflow_fields_check
      check (
        status = 'draft'
        or (
          nullif(btrim(transfer_number), '') is not null
          and nullif(btrim(idempotency_key), '') is not null
          and nullif(btrim(currency), '') is not null
          and source_account_id is not null
          and destination_account_id is not null
          and transfer_date is not null
        )
      ) not valid;
  end if;
end;
$$;

create unique index if not exists branch_money_transfers_number_uidx
  on public.branch_money_transfers (tenant_id, transfer_number)
  where transfer_number is not null;

create unique index if not exists branch_money_transfers_idempotency_uidx
  on public.branch_money_transfers (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists branch_money_transfers_source_queue_idx
  on public.branch_money_transfers (
    tenant_id,
    from_branch_id,
    status,
    created_at desc
  );

create index if not exists branch_money_transfers_destination_queue_idx
  on public.branch_money_transfers (
    tenant_id,
    to_branch_id,
    status,
    created_at desc
  );

create table if not exists public.branch_fund_request_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint branch_fund_request_history_request_fkey
    foreign key (tenant_id, request_id)
    references public.branch_fund_requests(tenant_id, id)
    on delete restrict
);

create index if not exists branch_fund_request_history_request_idx
  on public.branch_fund_request_status_history (
    tenant_id,
    request_id,
    created_at
  );

create table if not exists public.branch_money_transfer_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint branch_money_transfer_history_transfer_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_money_transfers(tenant_id, id)
    on delete restrict
);

create index if not exists branch_money_transfer_history_transfer_idx
  on public.branch_money_transfer_status_history (
    tenant_id,
    transfer_id,
    created_at
  );

create table if not exists public.branch_fund_transfer_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid,
  request_id uuid,
  attachment_type text not null,
  file_url text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint branch_fund_attachments_transfer_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_money_transfers(tenant_id, id)
    on delete restrict,
  constraint branch_fund_attachments_request_fkey
    foreign key (tenant_id, request_id)
    references public.branch_fund_requests(tenant_id, id)
    on delete restrict,
  constraint branch_fund_attachments_target_check
    check ((transfer_id is not null) <> (request_id is not null)),
  constraint branch_fund_attachments_type_check
    check (attachment_type in ('supporting_document', 'payment_proof', 'receipt', 'voucher', 'other')),
  constraint branch_fund_attachments_size_check
    check (size_bytes is null or size_bytes >= 0)
);

create index if not exists branch_fund_attachments_transfer_idx
  on public.branch_fund_transfer_attachments (tenant_id, transfer_id, created_at desc)
  where transfer_id is not null;

create index if not exists branch_fund_attachments_request_idx
  on public.branch_fund_transfer_attachments (tenant_id, request_id, created_at desc)
  where request_id is not null;

create table if not exists public.branch_fund_transfer_journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid not null,
  journal_type text not null,
  reversal_of_journal_id uuid,
  amount numeric(18, 2) not null,
  currency text not null,
  idempotency_key text not null,
  posted_by uuid references public.users(id) on delete set null,
  posted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint branch_fund_journals_transfer_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_money_transfers(tenant_id, id)
    on delete restrict,
  constraint branch_fund_journals_type_check
    check (journal_type in ('transfer', 'reversal')),
  constraint branch_fund_journals_amount_check
    check (amount > 0),
  constraint branch_fund_journals_reversal_check
    check (
      (journal_type = 'transfer' and reversal_of_journal_id is null)
      or (journal_type = 'reversal' and reversal_of_journal_id is not null)
    ),
  unique (tenant_id, idempotency_key)
);

create unique index if not exists branch_fund_journals_tenant_id_id_uidx
  on public.branch_fund_transfer_journals (tenant_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'branch_fund_journals_reversal_journal_fkey'
      and conrelid = 'public.branch_fund_transfer_journals'::regclass
  ) then
    alter table public.branch_fund_transfer_journals
      add constraint branch_fund_journals_reversal_journal_fkey
      foreign key (tenant_id, reversal_of_journal_id)
      references public.branch_fund_transfer_journals(tenant_id, id)
      on delete restrict not valid;
  end if;
end;
$$;

create unique index if not exists branch_fund_journals_original_uidx
  on public.branch_fund_transfer_journals (tenant_id, transfer_id)
  where journal_type = 'transfer';

create unique index if not exists branch_fund_journals_reversal_uidx
  on public.branch_fund_transfer_journals (tenant_id, reversal_of_journal_id)
  where reversal_of_journal_id is not null;

create table if not exists public.branch_fund_transfer_journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journal_id uuid not null,
  branch_id uuid not null,
  account_id uuid not null,
  line_type text not null,
  amount numeric(18, 2) not null,
  currency text not null,
  created_at timestamptz not null default now(),
  constraint branch_fund_journal_lines_journal_fkey
    foreign key (tenant_id, journal_id)
    references public.branch_fund_transfer_journals(tenant_id, id)
    on delete restrict,
  constraint branch_fund_journal_lines_account_fkey
    foreign key (tenant_id, account_id, branch_id, currency)
    references public.branch_payment_accounts(tenant_id, id, branch_id, currency)
    on delete restrict,
  constraint branch_fund_journal_lines_type_check
    check (line_type in ('transfer_out', 'transfer_in', 'reversal_out', 'reversal_in')),
  constraint branch_fund_journal_lines_amount_check
    check (amount > 0),
  unique (tenant_id, journal_id, account_id, line_type)
);

create index if not exists branch_fund_journal_lines_account_idx
  on public.branch_fund_transfer_journal_lines (
    tenant_id,
    account_id,
    created_at desc
  );

create or replace function private.validate_fund_request_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.branches as branch
    where branch.tenant_id = new.tenant_id
      and branch.id = new.requesting_branch_id
      and branch.archived_at is null
      and branch.status = 'active'
      and not branch.is_locked
  ) then
    raise exception 'Requesting branch must be active, unlocked, and belong to the tenant.'
      using errcode = '23514';
  end if;

  if new.requested_from_branch_id is not null and not exists (
    select 1 from public.branches as branch
    where branch.tenant_id = new.tenant_id
      and branch.id = new.requested_from_branch_id
      and branch.archived_at is null
      and branch.status = 'active'
      and not branch.is_locked
  ) then
    raise exception 'Requested source branch must be active, unlocked, and belong to the tenant.'
      using errcode = '23514';
  end if;

  if new.destination_account_id is not null and not exists (
    select 1
    from public.branch_payment_accounts as account
    where account.tenant_id = new.tenant_id
      and account.id = new.destination_account_id
      and account.branch_id = new.requesting_branch_id
      and account.currency = new.currency
      and account.status = 'active'
      and not account.is_locked
  ) then
    raise exception 'Destination account must be active, unlocked, and match the requesting branch currency.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_money_transfer_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.branches as source_branch
    where source_branch.tenant_id = new.tenant_id
      and source_branch.id = new.from_branch_id
      and source_branch.archived_at is null
      and source_branch.status = 'active'
      and not source_branch.is_locked
  ) or not exists (
    select 1 from public.branches as destination_branch
    where destination_branch.tenant_id = new.tenant_id
      and destination_branch.id = new.to_branch_id
      and destination_branch.archived_at is null
      and destination_branch.status = 'active'
      and not destination_branch.is_locked
  ) then
    raise exception 'Fund transfers require active, unlocked branches in one tenant.'
      using errcode = '23514';
  end if;

  if (new.source_account_id is null) <> (new.destination_account_id is null) then
    raise exception 'Source and destination accounts must be supplied together.'
      using errcode = '23514';
  end if;

  if new.source_account_id is not null and not exists (
    select 1 from public.branch_payment_accounts as account
    where account.tenant_id = new.tenant_id
      and account.id = new.source_account_id
      and account.branch_id = new.from_branch_id
      and account.currency = new.currency
      and account.status = 'active'
      and not account.is_locked
  ) then
    raise exception 'Source payment account is invalid, locked, inactive, or uses another currency.'
      using errcode = '23514';
  end if;

  if new.destination_account_id is not null and not exists (
    select 1 from public.branch_payment_accounts as account
    where account.tenant_id = new.tenant_id
      and account.id = new.destination_account_id
      and account.branch_id = new.to_branch_id
      and account.currency = new.currency
      and account.status = 'active'
      and not account.is_locked
  ) then
    raise exception 'Destination payment account is invalid, locked, inactive, or uses another currency.'
      using errcode = '23514';
  end if;

  if new.fund_request_id is not null and not exists (
    select 1
    from public.branch_fund_requests as fund_request
    where fund_request.tenant_id = new.tenant_id
      and fund_request.id = new.fund_request_id
      and fund_request.requesting_branch_id = new.to_branch_id
      and (
        fund_request.requested_from_branch_id is null
        or fund_request.requested_from_branch_id = new.from_branch_id
      )
      and fund_request.currency = new.currency
      and fund_request.status in ('approved', 'partially_approved', 'funded')
      and fund_request.amount_approved >= new.amount
  ) then
    raise exception 'Linked fund request is not approved or does not match the transfer route, currency, or amount.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_fund_request_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then return new; end if;

  if not (
    (old.status = 'draft' and new.status in ('submitted', 'cancelled'))
    or (old.status = 'submitted' and new.status in ('approved', 'partially_approved', 'rejected', 'cancelled'))
    or (old.status in ('approved', 'partially_approved') and new.status in ('funded', 'cancelled'))
    or (old.status = 'funded' and new.status = 'closed')
  ) then
    raise exception 'Invalid fund-request status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_money_transfer_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then return new; end if;

  if not (
    (old.status = 'draft' and new.status in ('pending', 'requested', 'cancelled'))
    or (old.status in ('pending', 'requested') and new.status in ('approved', 'rejected', 'cancelled'))
    or (old.status = 'approved' and new.status in ('sent', 'in_transit', 'cancelled'))
    or (old.status in ('sent', 'in_transit') and new.status = 'received')
    or (old.status = 'received' and new.status = 'reversed')
  ) then
    raise exception 'Invalid money-transfer status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.record_fund_request_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.branch_fund_request_status_history (
      tenant_id, request_id, from_status, to_status, changed_by, metadata
    ) values (
      new.tenant_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      coalesce((select auth.uid()), new.requested_by),
      jsonb_build_object('source', 'database_trigger')
    );
  end if;
  return new;
end;
$$;

create or replace function private.record_money_transfer_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.branch_money_transfer_status_history (
      tenant_id, transfer_id, from_status, to_status, changed_by, metadata
    ) values (
      new.tenant_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      coalesce((select auth.uid()), new.created_by),
      jsonb_build_object('source', 'database_trigger')
    );
  end if;
  return new;
end;
$$;

create or replace function private.validate_fund_transfer_journal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer public.branch_money_transfers%rowtype;
  v_original public.branch_fund_transfer_journals%rowtype;
begin
  select *
  into v_transfer
  from public.branch_money_transfers
  where tenant_id = new.tenant_id
    and id = new.transfer_id;

  if v_transfer.id is null
    or v_transfer.amount <> new.amount
    or v_transfer.currency <> new.currency
  then
    raise exception 'Journal amount and currency must match its fund transfer.'
      using errcode = '23514';
  end if;

  if new.journal_type = 'transfer' then
    if v_transfer.status not in ('sent', 'in_transit', 'received', 'reversed') then
      raise exception 'A transfer journal requires a sent or received transfer.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select *
  into v_original
  from public.branch_fund_transfer_journals
  where tenant_id = new.tenant_id
    and id = new.reversal_of_journal_id
    and transfer_id = new.transfer_id
    and journal_type = 'transfer';

  if v_original.id is null
    or v_original.amount <> new.amount
    or v_original.currency <> new.currency
    or v_transfer.status <> 'reversed'
  then
    raise exception 'A reversal must match the original journal and a reversed transfer.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_fund_transfer_journal_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal public.branch_fund_transfer_journals%rowtype;
  v_transfer public.branch_money_transfers%rowtype;
begin
  select *
  into v_journal
  from public.branch_fund_transfer_journals
  where tenant_id = new.tenant_id
    and id = new.journal_id;

  select *
  into v_transfer
  from public.branch_money_transfers
  where tenant_id = new.tenant_id
    and id = v_journal.transfer_id;

  if v_journal.id is null
    or v_transfer.id is null
    or new.amount <> v_journal.amount
    or new.currency <> v_journal.currency
  then
    raise exception 'Journal line must match its journal amount and currency.'
      using errcode = '23514';
  end if;

  if not (
    (v_journal.journal_type = 'transfer'
      and new.line_type = 'transfer_out'
      and new.branch_id = v_transfer.from_branch_id
      and new.account_id = v_transfer.source_account_id)
    or (v_journal.journal_type = 'transfer'
      and new.line_type = 'transfer_in'
      and new.branch_id = v_transfer.to_branch_id
      and new.account_id = v_transfer.destination_account_id)
    or (v_journal.journal_type = 'reversal'
      and new.line_type = 'reversal_out'
      and new.branch_id = v_transfer.to_branch_id
      and new.account_id = v_transfer.destination_account_id)
    or (v_journal.journal_type = 'reversal'
      and new.line_type = 'reversal_in'
      and new.branch_id = v_transfer.from_branch_id
      and new.account_id = v_transfer.source_account_id)
  ) then
    raise exception 'Journal line account/direction does not match its transfer.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists branch_payment_accounts_updated_at on public.branch_payment_accounts;
create trigger branch_payment_accounts_updated_at before update on public.branch_payment_accounts
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_account_balances_updated_at on public.branch_account_balances;
create trigger branch_account_balances_updated_at before update on public.branch_account_balances
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_fund_requests_updated_at on public.branch_fund_requests;
create trigger branch_fund_requests_updated_at before update on public.branch_fund_requests
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_money_transfers_updated_at on public.branch_money_transfers;
create trigger branch_money_transfers_updated_at before update on public.branch_money_transfers
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_fund_requests_route_guard on public.branch_fund_requests;
create trigger branch_fund_requests_route_guard
before insert or update of tenant_id, requesting_branch_id, requested_from_branch_id, destination_account_id, currency, status
on public.branch_fund_requests
for each row execute function private.validate_fund_request_route();

drop trigger if exists branch_money_transfers_route_guard on public.branch_money_transfers;
create trigger branch_money_transfers_route_guard
before insert or update of tenant_id, from_branch_id, to_branch_id, fund_request_id, source_account_id, destination_account_id, amount, currency, status
on public.branch_money_transfers
for each row execute function private.validate_money_transfer_route();

drop trigger if exists branch_fund_requests_status_guard on public.branch_fund_requests;
create trigger branch_fund_requests_status_guard before update of status on public.branch_fund_requests
for each row execute function private.validate_fund_request_status_transition();

drop trigger if exists branch_money_transfers_status_guard on public.branch_money_transfers;
create trigger branch_money_transfers_status_guard before update of status on public.branch_money_transfers
for each row execute function private.validate_money_transfer_status_transition();

drop trigger if exists branch_fund_requests_status_history on public.branch_fund_requests;
create trigger branch_fund_requests_status_history after insert or update of status on public.branch_fund_requests
for each row execute function private.record_fund_request_status_history();

drop trigger if exists branch_money_transfers_status_history on public.branch_money_transfers;
create trigger branch_money_transfers_status_history after insert or update of status on public.branch_money_transfers
for each row execute function private.record_money_transfer_status_history();

drop trigger if exists branch_fund_journals_validation on public.branch_fund_transfer_journals;
create trigger branch_fund_journals_validation
before insert on public.branch_fund_transfer_journals
for each row execute function private.validate_fund_transfer_journal();

drop trigger if exists branch_fund_journal_lines_validation on public.branch_fund_transfer_journal_lines;
create trigger branch_fund_journal_lines_validation
before insert on public.branch_fund_transfer_journal_lines
for each row execute function private.validate_fund_transfer_journal_line();

drop trigger if exists branch_fund_request_history_immutable on public.branch_fund_request_status_history;
create trigger branch_fund_request_history_immutable before update on public.branch_fund_request_status_history
for each row execute function private.prevent_immutable_multibranch_event_change();

drop trigger if exists branch_money_transfer_history_immutable on public.branch_money_transfer_status_history;
create trigger branch_money_transfer_history_immutable before update on public.branch_money_transfer_status_history
for each row execute function private.prevent_immutable_multibranch_event_change();

drop trigger if exists branch_fund_journals_immutable on public.branch_fund_transfer_journals;
create trigger branch_fund_journals_immutable before update on public.branch_fund_transfer_journals
for each row execute function private.prevent_immutable_multibranch_event_change();

drop trigger if exists branch_fund_journal_lines_immutable on public.branch_fund_transfer_journal_lines;
create trigger branch_fund_journal_lines_immutable before update on public.branch_fund_transfer_journal_lines
for each row execute function private.prevent_immutable_multibranch_event_change();

-- All financial control tables stay server/RPC-only. No browser role can alter
-- balances, journals, requests, or transfers during the dark rollout.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'branch_payment_accounts',
    'branch_account_balances',
    'branch_fund_requests',
    'branch_fund_request_status_history',
    'branch_money_transfer_status_history',
    'branch_fund_transfer_attachments',
    'branch_fund_transfer_journals',
    'branch_fund_transfer_journal_lines'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

revoke all on function private.validate_fund_request_route() from public;
revoke all on function private.validate_money_transfer_route() from public;
revoke all on function private.validate_fund_request_status_transition() from public;
revoke all on function private.validate_money_transfer_status_transition() from public;
revoke all on function private.record_fund_request_status_history() from public;
revoke all on function private.record_money_transfer_status_history() from public;
revoke all on function private.validate_fund_transfer_journal() from public;
revoke all on function private.validate_fund_transfer_journal_line() from public;

commit;
