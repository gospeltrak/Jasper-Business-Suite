-- Atomic outgoing treasury posting for purchases funded by multiple registered accounts.
-- External funding is intentionally excluded from p_lines by the caller.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.post_current_tenant_treasury_split_outgoing_entry(
  p_branch_id uuid,
  p_lines jsonb,
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
  v_existing public.treasury_journals%rowtype;
  v_currency text;
  v_journal_id uuid;
  v_line jsonb;
  v_account_id uuid;
  v_amount numeric(18, 2);
  v_balance numeric(18, 2);
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'Tenant authentication is required.';
  end if;
  if p_branch_id is null or p_lines is null or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 20
    or nullif(btrim(p_source_type), '') is null
    or nullif(btrim(p_source_id), '') is null
    or nullif(btrim(p_idempotency_key), '') is null
    or nullif(btrim(p_description), '') is null
  then
    raise exception using errcode = '22023', message = 'A branch, payment lines, source, idempotency key, and description are required.';
  end if;
  if not private.can_write_branch(v_tenant_id, p_branch_id, 'money_bank.post') then
    raise exception using errcode = '42501', message = 'Money and Bank posting permission is required.';
  end if;

  select * into v_existing
  from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.source_type <> lower(btrim(p_source_type))
      or v_existing.source_id <> btrim(p_source_id)
      or v_existing.journal_type <> 'money_out'
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used for another operation.';
    end if;
    return jsonb_build_object('journalId', v_existing.id, 'status', 'already_posted');
  end if;

  select min(account.currency)
  into v_currency
  from jsonb_array_elements(p_lines) as supplied(item)
  join public.branch_payment_accounts as account
    on account.id = (supplied.item ->> 'accountId')::uuid
    and account.tenant_id = v_tenant_id
    and account.branch_id = p_branch_id
    and account.status = 'active'
    and not account.is_locked;

  if v_currency is null or exists (
    select 1
    from jsonb_array_elements(p_lines) as supplied(item)
    left join public.branch_payment_accounts as account
      on account.id = (supplied.item ->> 'accountId')::uuid
      and account.tenant_id = v_tenant_id
      and account.branch_id = p_branch_id
      and account.status = 'active'
      and not account.is_locked
    where account.id is null
      or account.currency <> v_currency
      or coalesce((supplied.item ->> 'amount')::numeric, 0) <= 0
  ) then
    raise exception using errcode = '23514', message = 'Every payment line must use an active account, one currency, and a positive amount.';
  end if;
  if (
    select count(distinct supplied.item ->> 'accountId')
    from jsonb_array_elements(p_lines) as supplied(item)
  ) <> jsonb_array_length(p_lines) then
    raise exception using errcode = '22023', message = 'Split payment accounts must be unique.';
  end if;

  insert into public.treasury_journals (
    tenant_id, journal_type, source_type, source_id, idempotency_key,
    currency, description, external_cash_flow, posted_by, metadata
  ) values (
    v_tenant_id, 'money_out', lower(btrim(p_source_type)), btrim(p_source_id),
    btrim(p_idempotency_key), v_currency, btrim(p_description), true,
    v_actor_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_journal_id;

  for v_line in
    select value from jsonb_array_elements(p_lines) order by value ->> 'accountId'
  loop
    v_account_id := (v_line ->> 'accountId')::uuid;
    v_amount := (v_line ->> 'amount')::numeric;

    insert into public.branch_account_balances (
      tenant_id, branch_id, account_id, currency, current_balance, row_version
    ) values (
      v_tenant_id, p_branch_id, v_account_id, v_currency, 0, 0
    ) on conflict (tenant_id, account_id, currency) do nothing;

    select current_balance into v_balance
    from public.branch_account_balances
    where tenant_id = v_tenant_id
      and account_id = v_account_id
      and currency = v_currency
    for update;

    if v_balance < v_amount then
      raise exception using errcode = '23514', message = 'Insufficient account balance for purchase funding.';
    end if;

    update public.branch_account_balances
    set current_balance = current_balance - v_amount,
        row_version = row_version + 1,
        updated_at = now()
    where tenant_id = v_tenant_id
      and account_id = v_account_id
      and currency = v_currency
    returning current_balance into v_balance;

    insert into public.treasury_journal_lines (
      tenant_id, journal_id, branch_id, account_id, currency,
      signed_amount, balance_after
    ) values (
      v_tenant_id, v_journal_id, p_branch_id, v_account_id, v_currency,
      -v_amount, v_balance
    );
  end loop;

  return jsonb_build_object('journalId', v_journal_id, 'status', 'posted');
end;
$$;

revoke all on function public.post_current_tenant_treasury_split_outgoing_entry(uuid, jsonb, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.post_current_tenant_treasury_split_outgoing_entry(uuid, jsonb, text, text, text, text, jsonb)
  to authenticated;

commit;
