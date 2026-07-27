-- Canonical, append-only treasury ledger and audited atomic posting RPCs.
-- Additive only: no existing tenant, account, balance, transfer, or JSON data is
-- modified or deleted by this migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.treasury_journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journal_type text not null,
  source_type text not null,
  source_id text not null,
  idempotency_key text not null,
  reversal_of_journal_id uuid,
  currency text not null,
  description text not null,
  external_cash_flow boolean not null default true,
  posted_by uuid references public.users(id) on delete set null,
  posted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint treasury_journals_type_check
    check (journal_type in ('money_in', 'money_out', 'transfer', 'reversal')),
  constraint treasury_journals_source_check
    check (source_type in (
      'opening_balance', 'sale', 'delivery', 'purchase', 'expense', 'payroll',
      'customer_payment', 'supplier_payment', 'refund', 'owner_capital',
      'owner_withdrawal', 'loan', 'bank_charge', 'manual', 'transfer'
    )),
  constraint treasury_journals_reversal_check
    check (
      (journal_type = 'reversal' and reversal_of_journal_id is not null)
      or (journal_type <> 'reversal' and reversal_of_journal_id is null)
    ),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);

alter table public.treasury_journals
  drop constraint if exists treasury_journals_reversal_fkey;
alter table public.treasury_journals
  add constraint treasury_journals_reversal_fkey
  foreign key (tenant_id, reversal_of_journal_id)
  references public.treasury_journals(tenant_id, id)
  on delete restrict;

create unique index if not exists treasury_journals_source_uidx
  on public.treasury_journals (tenant_id, source_type, source_id)
  where journal_type <> 'reversal';

create unique index if not exists treasury_journals_one_reversal_uidx
  on public.treasury_journals (tenant_id, reversal_of_journal_id)
  where reversal_of_journal_id is not null;

create index if not exists treasury_journals_tenant_posted_idx
  on public.treasury_journals (tenant_id, posted_at desc, id);

create table if not exists public.treasury_journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journal_id uuid not null,
  branch_id uuid not null,
  account_id uuid not null,
  currency text not null,
  signed_amount numeric(18, 2) not null,
  balance_after numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  constraint treasury_lines_journal_fkey
    foreign key (tenant_id, journal_id)
    references public.treasury_journals(tenant_id, id)
    on delete restrict,
  constraint treasury_lines_account_fkey
    foreign key (tenant_id, account_id, branch_id, currency)
    references public.branch_payment_accounts(tenant_id, id, branch_id, currency)
    on delete restrict,
  constraint treasury_lines_amount_check check (signed_amount <> 0),
  constraint treasury_lines_balance_check check (balance_after >= 0),
  unique (tenant_id, journal_id, account_id)
);

create index if not exists treasury_lines_account_history_idx
  on public.treasury_journal_lines (
    tenant_id, branch_id, account_id, created_at desc, id
  );

create or replace function private.validate_treasury_journal_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal public.treasury_journals%rowtype;
begin
  select * into v_journal
  from public.treasury_journals
  where tenant_id = new.tenant_id and id = new.journal_id;

  if v_journal.id is null or v_journal.currency <> new.currency then
    raise exception using errcode = '23514', message = 'Treasury line does not match its journal.';
  end if;
  return new;
end;
$$;

drop trigger if exists treasury_lines_validate on public.treasury_journal_lines;
create trigger treasury_lines_validate
before insert on public.treasury_journal_lines
for each row execute function private.validate_treasury_journal_balance();

drop trigger if exists treasury_journals_immutable on public.treasury_journals;
create trigger treasury_journals_immutable
before update or delete on public.treasury_journals
for each row execute function private.prevent_immutable_multibranch_event_change();

drop trigger if exists treasury_lines_immutable on public.treasury_journal_lines;
create trigger treasury_lines_immutable
before update or delete on public.treasury_journal_lines
for each row execute function private.prevent_immutable_multibranch_event_change();

create or replace function public.post_current_tenant_treasury_entry(
  p_branch_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_direction text,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_account public.branch_payment_accounts%rowtype;
  v_existing public.treasury_journals%rowtype;
  v_existing_line public.treasury_journal_lines%rowtype;
  v_journal_id uuid;
  v_signed_amount numeric(18, 2);
  v_balance numeric(18, 2);
  v_direction text := lower(nullif(btrim(p_direction), ''));
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'Tenant authentication is required.';
  end if;
  if coalesce(p_amount, 0) <= 0 or v_direction not in ('in', 'out') then
    raise exception using errcode = '22023', message = 'A positive amount and in/out direction are required.';
  end if;
  if nullif(btrim(p_source_type), '') is null
    or nullif(btrim(p_source_id), '') is null
    or nullif(btrim(p_idempotency_key), '') is null
    or nullif(btrim(p_description), '') is null
  then
    raise exception using errcode = '22023', message = 'Source, idempotency key, and description are required.';
  end if;
  if not private.can_write_branch(v_tenant_id, p_branch_id, 'money_bank.post') then
    raise exception using errcode = '42501', message = 'Money and Bank posting permission is required.';
  end if;

  select * into v_existing
  from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    select * into v_existing_line
    from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = v_existing.id;
    if v_existing_line.id is null
      or v_existing.source_type <> lower(btrim(p_source_type))
      or v_existing.source_id <> btrim(p_source_id)
      or v_existing.journal_type <> (
        case when v_direction = 'in' then 'money_in' else 'money_out' end
      )
      or v_existing_line.account_id <> p_account_id
      or abs(v_existing_line.signed_amount) <> p_amount
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used for a different treasury entry.';
    end if;
    return jsonb_build_object('journalId', v_existing.id, 'status', 'already_posted');
  end if;

  select * into v_account
  from public.branch_payment_accounts
  where tenant_id = v_tenant_id
    and id = p_account_id
    and branch_id = p_branch_id
    and status = 'active'
    and not is_locked;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active payment account was not found.';
  end if;

  insert into public.branch_account_balances (
    tenant_id, branch_id, account_id, currency, current_balance, row_version
  ) values (
    v_tenant_id, p_branch_id, p_account_id, v_account.currency, 0, 0
  ) on conflict (tenant_id, account_id, currency) do nothing;

  select current_balance into v_balance
  from public.branch_account_balances
  where tenant_id = v_tenant_id
    and account_id = p_account_id
    and currency = v_account.currency
  for update;

  v_signed_amount := case when v_direction = 'in' then p_amount else -p_amount end;
  if v_balance + v_signed_amount < 0 then
    raise exception using errcode = '23514', message = 'Insufficient account balance.';
  end if;

  insert into public.treasury_journals (
    tenant_id, journal_type, source_type, source_id, idempotency_key,
    currency, description, external_cash_flow, posted_by, metadata
  ) values (
    v_tenant_id,
    case when v_direction = 'in' then 'money_in' else 'money_out' end,
    lower(btrim(p_source_type)), btrim(p_source_id), btrim(p_idempotency_key),
    v_account.currency, btrim(p_description), true, v_actor_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_journal_id;

  update public.branch_account_balances
  set current_balance = current_balance + v_signed_amount,
      row_version = row_version + 1,
      updated_at = now()
  where tenant_id = v_tenant_id
    and account_id = p_account_id
    and currency = v_account.currency
  returning current_balance into v_balance;

  insert into public.treasury_journal_lines (
    tenant_id, journal_id, branch_id, account_id, currency, signed_amount, balance_after
  ) values (
    v_tenant_id, v_journal_id, p_branch_id, p_account_id,
    v_account.currency, v_signed_amount, v_balance
  );

  return jsonb_build_object(
    'journalId', v_journal_id, 'accountId', p_account_id,
    'balance', v_balance, 'status', 'posted'
  );
end;
$$;

create or replace function public.transfer_current_tenant_treasury_funds(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_source public.branch_payment_accounts%rowtype;
  v_destination public.branch_payment_accounts%rowtype;
  v_existing public.treasury_journals%rowtype;
  v_existing_line_count integer;
  v_existing_source_count integer;
  v_existing_destination_count integer;
  v_journal_id uuid;
  v_source_balance numeric(18, 2);
  v_destination_balance numeric(18, 2);
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'Tenant authentication is required.';
  end if;
  if p_source_account_id is null or p_destination_account_id is null
    or p_source_account_id = p_destination_account_id or coalesce(p_amount, 0) <= 0
  then
    raise exception using errcode = '22023', message = 'Two different accounts and a positive amount are required.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or nullif(btrim(p_description), '') is null then
    raise exception using errcode = '22023', message = 'Idempotency key and description are required.';
  end if;

  select * into v_existing from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    select
      count(*),
      count(*) filter (
        where account_id = p_source_account_id and signed_amount = -p_amount
      ),
      count(*) filter (
        where account_id = p_destination_account_id and signed_amount = p_amount
      )
    into v_existing_line_count, v_existing_source_count, v_existing_destination_count
    from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = v_existing.id;
    if v_existing.journal_type <> 'transfer'
      or v_existing_line_count <> 2
      or v_existing_source_count <> 1
      or v_existing_destination_count <> 1
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used for another operation.';
    end if;
    return jsonb_build_object('journalId', v_existing.id, 'status', 'already_posted');
  end if;

  select * into v_source from public.branch_payment_accounts
  where tenant_id = v_tenant_id and id = p_source_account_id
    and status = 'active' and not is_locked;
  select * into v_destination from public.branch_payment_accounts
  where tenant_id = v_tenant_id and id = p_destination_account_id
    and status = 'active' and not is_locked;
  if v_source.id is null or v_destination.id is null or v_source.currency <> v_destination.currency then
    raise exception using errcode = '23514', message = 'Active source and destination accounts must use the same currency.';
  end if;
  if not private.can_write_branch(v_tenant_id, v_source.branch_id, 'money_bank.transfer')
    or not private.can_write_branch(v_tenant_id, v_destination.branch_id, 'money_bank.transfer')
  then
    raise exception using errcode = '42501', message = 'Transfer permission is required for both branches.';
  end if;

  insert into public.branch_account_balances (
    tenant_id, branch_id, account_id, currency, current_balance, row_version
  ) values
    (v_tenant_id, v_source.branch_id, v_source.id, v_source.currency, 0, 0),
    (v_tenant_id, v_destination.branch_id, v_destination.id, v_destination.currency, 0, 0)
  on conflict (tenant_id, account_id, currency) do nothing;

  perform 1
  from public.branch_account_balances
  where tenant_id = v_tenant_id
    and account_id in (v_source.id, v_destination.id)
    and currency = v_source.currency
  order by account_id
  for update;

  select current_balance into v_source_balance from public.branch_account_balances
  where tenant_id = v_tenant_id and account_id = v_source.id and currency = v_source.currency;
  if v_source_balance < p_amount then
    raise exception using errcode = '23514', message = 'Insufficient source account balance.';
  end if;

  insert into public.treasury_journals (
    tenant_id, journal_type, source_type, source_id, idempotency_key,
    currency, description, external_cash_flow, posted_by, metadata
  ) values (
    v_tenant_id, 'transfer', 'transfer', btrim(p_idempotency_key),
    btrim(p_idempotency_key), v_source.currency, btrim(p_description),
    false, v_actor_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_journal_id;

  update public.branch_account_balances
  set current_balance = current_balance - p_amount, row_version = row_version + 1, updated_at = now()
  where tenant_id = v_tenant_id and account_id = v_source.id and currency = v_source.currency
  returning current_balance into v_source_balance;
  update public.branch_account_balances
  set current_balance = current_balance + p_amount, row_version = row_version + 1, updated_at = now()
  where tenant_id = v_tenant_id and account_id = v_destination.id and currency = v_destination.currency
  returning current_balance into v_destination_balance;

  insert into public.treasury_journal_lines (
    tenant_id, journal_id, branch_id, account_id, currency, signed_amount, balance_after
  ) values
    (v_tenant_id, v_journal_id, v_source.branch_id, v_source.id, v_source.currency, -p_amount, v_source_balance),
    (v_tenant_id, v_journal_id, v_destination.branch_id, v_destination.id, v_destination.currency, p_amount, v_destination_balance);

  return jsonb_build_object(
    'journalId', v_journal_id, 'sourceBalance', v_source_balance,
    'destinationBalance', v_destination_balance, 'status', 'posted'
  );
end;
$$;

create or replace function public.reverse_current_tenant_treasury_journal(
  p_journal_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_original public.treasury_journals%rowtype;
  v_existing public.treasury_journals%rowtype;
  v_line public.treasury_journal_lines%rowtype;
  v_reversal_id uuid;
  v_balance numeric(18, 2);
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'Tenant authentication is required.';
  end if;
  if p_journal_id is null or nullif(btrim(p_idempotency_key), '') is null
    or nullif(btrim(p_reason), '') is null
  then
    raise exception using errcode = '22023', message = 'Journal, idempotency key, and reversal reason are required.';
  end if;

  select * into v_existing from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.journal_type <> 'reversal' or v_existing.reversal_of_journal_id <> p_journal_id then
      raise exception using errcode = '23505', message = 'Idempotency key was already used for another operation.';
    end if;
    return jsonb_build_object('journalId', v_existing.id, 'status', 'already_reversed');
  end if;

  select * into v_original from public.treasury_journals
  where tenant_id = v_tenant_id and id = p_journal_id and journal_type <> 'reversal';
  if not found then
    raise exception using errcode = 'P0002', message = 'Original treasury journal was not found.';
  end if;
  if exists (
    select 1 from public.treasury_journals
    where tenant_id = v_tenant_id and reversal_of_journal_id = p_journal_id
  ) then
    raise exception using errcode = '23505', message = 'Treasury journal was already reversed.';
  end if;

  for v_line in
    select * from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = p_journal_id
    order by account_id
  loop
    if not private.can_write_branch(v_tenant_id, v_line.branch_id, 'money_bank.reverse') then
      raise exception using errcode = '42501', message = 'Reversal permission is required for every affected branch.';
    end if;
  end loop;

  perform 1 from public.branch_account_balances
  where tenant_id = v_tenant_id
    and account_id in (
      select account_id from public.treasury_journal_lines
      where tenant_id = v_tenant_id and journal_id = p_journal_id
    )
    and currency = v_original.currency
  order by account_id
  for update;

  if exists (
    select 1
    from public.treasury_journal_lines line
    join public.branch_account_balances balance
      on balance.tenant_id = line.tenant_id
      and balance.account_id = line.account_id
      and balance.currency = line.currency
    where line.tenant_id = v_tenant_id
      and line.journal_id = p_journal_id
      and balance.current_balance - line.signed_amount < 0
  ) then
    raise exception using errcode = '23514', message = 'Reversal would create a negative account balance.';
  end if;

  insert into public.treasury_journals (
    tenant_id, journal_type, source_type, source_id, idempotency_key,
    reversal_of_journal_id, currency, description, external_cash_flow,
    posted_by, metadata
  ) values (
    v_tenant_id, 'reversal', v_original.source_type,
    v_original.source_id || ':reversal', btrim(p_idempotency_key),
    v_original.id, v_original.currency, btrim(p_reason),
    v_original.external_cash_flow, v_actor_id,
    jsonb_build_object('reason', btrim(p_reason), 'originalJournalId', v_original.id)
  ) returning id into v_reversal_id;

  for v_line in
    select * from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = p_journal_id
    order by account_id
  loop
    update public.branch_account_balances
    set current_balance = current_balance - v_line.signed_amount,
        row_version = row_version + 1,
        updated_at = now()
    where tenant_id = v_tenant_id
      and account_id = v_line.account_id
      and currency = v_line.currency
    returning current_balance into v_balance;

    insert into public.treasury_journal_lines (
      tenant_id, journal_id, branch_id, account_id, currency, signed_amount, balance_after
    ) values (
      v_tenant_id, v_reversal_id, v_line.branch_id, v_line.account_id,
      v_line.currency, -v_line.signed_amount, v_balance
    );
  end loop;

  return jsonb_build_object(
    'journalId', v_reversal_id, 'reversalOfJournalId', v_original.id, 'status', 'reversed'
  );
end;
$$;

alter table public.treasury_journals enable row level security;
alter table public.treasury_journals force row level security;
alter table public.treasury_journal_lines enable row level security;
alter table public.treasury_journal_lines force row level security;

revoke all on table public.treasury_journals from public, anon, authenticated;
revoke all on table public.treasury_journal_lines from public, anon, authenticated;
revoke all on function private.validate_treasury_journal_balance() from public;

revoke all on function public.post_current_tenant_treasury_entry(uuid, uuid, numeric, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.transfer_current_tenant_treasury_funds(uuid, uuid, numeric, text, text, jsonb) from public, anon;
revoke all on function public.reverse_current_tenant_treasury_journal(uuid, text, text) from public, anon;

grant execute on function public.post_current_tenant_treasury_entry(uuid, uuid, numeric, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.transfer_current_tenant_treasury_funds(uuid, uuid, numeric, text, text, jsonb) to authenticated;
grant execute on function public.reverse_current_tenant_treasury_journal(uuid, text, text) to authenticated;

commit;
