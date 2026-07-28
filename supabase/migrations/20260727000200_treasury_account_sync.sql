-- Connect tenant Payment Methods to the canonical append-only treasury ledger.
-- This migration does not create accounts, branches, balances, or journals by
-- itself. Authenticated tenant administrators create/sync them explicitly
-- through the RPC after reviewing their payment methods and opening balances.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.branch_payment_accounts
  add column if not exists source_key text;

create unique index if not exists branch_payment_accounts_source_key_uidx
  on public.branch_payment_accounts (tenant_id, branch_id, source_key, currency)
  where source_key is not null;

create or replace function public.sync_current_tenant_treasury_accounts(
  p_accounts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_branch_id uuid;
  v_item jsonb;
  v_source_key text;
  v_name text;
  v_type text;
  v_currency text;
  v_provider text;
  v_masked_reference text;
  v_opening_balance numeric(18, 2);
  v_account_id uuid;
  v_is_new boolean;
  v_journal_id uuid;
  v_results jsonb := '[]'::jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'Tenant authentication is required.';
  end if;
  if not private.is_tenant_branch_administrator(v_tenant_id) then
    raise exception using errcode = '42501', message = 'A tenant administrator must synchronize payment accounts.';
  end if;
  if p_accounts is null or jsonb_typeof(p_accounts) <> 'array'
    or jsonb_array_length(p_accounts) > 50
  then
    raise exception using errcode = '22023', message = 'Payment accounts must be a JSON array with at most 50 items.';
  end if;

  select preference.active_branch_id
  into v_branch_id
  from public.branch_user_preferences as preference
  where preference.tenant_id = v_tenant_id
    and preference.user_id = v_actor_id
    and preference.active_scope = 'branch';

  if v_branch_id is null then
    select branch.id
    into v_branch_id
    from public.branches as branch
    where branch.tenant_id = v_tenant_id
      and branch.is_default
      and branch.archived_at is null
      and branch.status = 'active'
      and not branch.is_locked
    order by branch.created_at, branch.id
    limit 1;
  end if;

  -- Legacy tenants created before physical-primary provisioning receive their
  -- one compatibility Primary only when an administrator first enables the
  -- canonical treasury. This is an insert-only compatibility action.
  if v_branch_id is null then
    v_branch_id := private.ensure_physical_primary_branch(
      v_tenant_id,
      v_actor_id,
      'treasury_compatibility'
    );
  end if;

  if not private.can_write_branch(v_tenant_id, v_branch_id, 'money_bank.post') then
    raise exception using errcode = '42501', message = 'Money and Bank posting permission is required.';
  end if;

  update public.branch_payment_accounts as account
  set status = 'inactive',
      is_default = false,
      updated_by = v_actor_id,
      updated_at = now()
  where account.tenant_id = v_tenant_id
    and account.branch_id = v_branch_id
    and account.source_key is not null
    and not exists (
      select 1
      from jsonb_array_elements(p_accounts) as supplied(item)
      where nullif(btrim(supplied.item ->> 'sourceKey'), '') = account.source_key
    );

  for v_item in select value from jsonb_array_elements(p_accounts)
  loop
    v_source_key := nullif(btrim(v_item ->> 'sourceKey'), '');
    v_name := nullif(btrim(v_item ->> 'name'), '');
    v_type := lower(coalesce(nullif(btrim(v_item ->> 'type'), ''), 'other'));
    v_currency := upper(coalesce(nullif(btrim(v_item ->> 'currency'), ''), 'TZS'));
    v_provider := nullif(btrim(v_item ->> 'provider'), '');
    v_masked_reference := nullif(btrim(v_item ->> 'maskedReference'), '');
    v_opening_balance := greatest(0, coalesce((v_item ->> 'openingBalance')::numeric, 0));

    if v_source_key is null or v_name is null
      or v_type not in ('cash', 'bank', 'mobile_money', 'card', 'other')
      or length(v_source_key) > 160 or length(v_name) > 160
      or length(v_currency) > 8 or v_opening_balance > 9999999999999999.99
    then
      raise exception using errcode = '22023', message = 'A payment account contains invalid fields.';
    end if;
    if v_masked_reference is not null
      and v_masked_reference !~ '^[*•Xx-]*[A-Za-z0-9]{0,4}$'
    then
      raise exception using errcode = '22023', message = 'Only a masked account reference may be stored.';
    end if;

    select account.id
    into v_account_id
    from public.branch_payment_accounts as account
    where account.tenant_id = v_tenant_id
      and account.branch_id = v_branch_id
      and account.source_key = v_source_key
      and account.currency = v_currency;
    v_is_new := v_account_id is null;

    insert into public.branch_payment_accounts (
      tenant_id, branch_id, source_key, account_name, account_type, currency,
      provider_name, masked_reference, status, is_default, created_by, updated_by
    ) values (
      v_tenant_id, v_branch_id, v_source_key, v_name, v_type, v_currency,
      v_provider, v_masked_reference, 'active',
      coalesce((v_item ->> 'isDefault')::boolean, false),
      v_actor_id, v_actor_id
    )
    on conflict (tenant_id, branch_id, source_key, currency)
      where source_key is not null
    do update set
      account_name = excluded.account_name,
      account_type = excluded.account_type,
      provider_name = excluded.provider_name,
      masked_reference = excluded.masked_reference,
      status = 'active',
      is_default = excluded.is_default,
      updated_by = v_actor_id,
      updated_at = now()
    returning id into v_account_id;

    insert into public.branch_account_balances (
      tenant_id, branch_id, account_id, currency, current_balance, row_version
    ) values (
      v_tenant_id, v_branch_id, v_account_id, v_currency, 0, 0
    ) on conflict (tenant_id, account_id, currency) do nothing;

    if v_is_new and v_opening_balance > 0 then
      insert into public.treasury_journals (
        tenant_id, journal_type, source_type, source_id, idempotency_key,
        currency, description, external_cash_flow, posted_by, metadata
      ) values (
        v_tenant_id, 'money_in', 'opening_balance',
        'account:' || v_account_id::text, 'opening:' || v_account_id::text,
        v_currency, 'Verified opening balance for ' || v_name,
        false, v_actor_id,
        jsonb_build_object('accountSourceKey', v_source_key)
      ) returning id into v_journal_id;

      update public.branch_account_balances
      set current_balance = v_opening_balance,
          row_version = row_version + 1,
          updated_at = now()
      where tenant_id = v_tenant_id
        and account_id = v_account_id
        and currency = v_currency;

      insert into public.treasury_journal_lines (
        tenant_id, journal_id, branch_id, account_id, currency,
        signed_amount, balance_after
      ) values (
        v_tenant_id, v_journal_id, v_branch_id, v_account_id, v_currency,
        v_opening_balance, v_opening_balance
      );
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'sourceKey', v_source_key,
      'accountId', v_account_id,
      'branchId', v_branch_id,
      'currency', v_currency
    ));
  end loop;

  return jsonb_build_object('branchId', v_branch_id, 'accounts', v_results);
end;
$$;

create or replace function public.get_current_tenant_treasury_accounts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'sourceKey', account.source_key,
      'accountId', account.id,
      'branchId', account.branch_id,
      'currency', account.currency
    ) order by account.account_name, account.id),
    '[]'::jsonb
  )
  from public.branch_payment_accounts as account
  where account.tenant_id = (select private.current_tenant_id())
    and account.source_key is not null
    and account.status = 'active'
    and not account.is_locked
    and private.can_read_branch(account.tenant_id, account.branch_id);
$$;

create or replace function public.post_current_tenant_treasury_split_entry(
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
    v_tenant_id, 'money_in', lower(btrim(p_source_type)), btrim(p_source_id),
    btrim(p_idempotency_key), v_currency, btrim(p_description), true,
    v_actor_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_journal_id;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
    order by value ->> 'accountId'
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

    update public.branch_account_balances
    set current_balance = current_balance + v_amount,
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
      v_amount, v_balance
    );
  end loop;

  return jsonb_build_object('journalId', v_journal_id, 'status', 'posted');
end;
$$;

revoke all on function public.sync_current_tenant_treasury_accounts(jsonb)
  from public, anon;
grant execute on function public.sync_current_tenant_treasury_accounts(jsonb)
  to authenticated;
revoke all on function public.get_current_tenant_treasury_accounts()
  from public, anon;
grant execute on function public.get_current_tenant_treasury_accounts()
  to authenticated;
revoke all on function public.post_current_tenant_treasury_split_entry(uuid, jsonb, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.post_current_tenant_treasury_split_entry(uuid, jsonb, text, text, text, text, jsonb)
  to authenticated;

commit;
