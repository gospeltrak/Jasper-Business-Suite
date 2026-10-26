CREATE OR REPLACE FUNCTION private.post_current_tenant_treasury_entry_authorized(p_branch_id uuid, p_account_id uuid, p_amount numeric, p_direction text, p_source_type text, p_source_id text, p_idempotency_key text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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

  select * into v_existing
  from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if exists(select 1 from public.treasury_journals where tenant_id=v_tenant_id and reversal_of_journal_id=v_existing.id) then
      raise exception using errcode='23505',message='This payment was reversed. Check payment history before retrying.';
    end if;

    select * into v_existing_line
    from public.treasury_journal_lines
    where tenant_id = v_tenant_id and journal_id = v_existing.id;
    if v_existing_line.id is null
      or v_existing_line.branch_id <> p_branch_id
      or (select count(*) from public.treasury_journal_lines where tenant_id=v_tenant_id and journal_id=v_existing.id)<>1
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
$function$
;
CREATE OR REPLACE FUNCTION private.post_current_tenant_treasury_split_outgoing_entry_authorized(p_branch_id uuid, p_lines jsonb, p_source_type text, p_source_id text, p_idempotency_key text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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

  select * into v_existing
  from public.treasury_journals
  where tenant_id = v_tenant_id and idempotency_key = btrim(p_idempotency_key);
  if found then
    if exists(select 1 from public.treasury_journals where tenant_id=v_tenant_id and reversal_of_journal_id=v_existing.id) then
      raise exception using errcode='23505',message='This payment was reversed. Check payment history before retrying.';
    end if;

    if v_existing.source_type <> lower(btrim(p_source_type))
      or v_existing.source_id <> btrim(p_source_id)
      or v_existing.journal_type <> 'money_out'
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used for another operation.';
    end if;
    if (select count(*) from public.treasury_journal_lines where tenant_id=v_tenant_id and journal_id=v_existing.id)<>jsonb_array_length(p_lines)
      or exists(select 1 from jsonb_array_elements(p_lines) supplied where not exists(
        select 1 from public.treasury_journal_lines l where l.tenant_id=v_tenant_id and l.journal_id=v_existing.id
          and l.branch_id=p_branch_id and l.account_id=(supplied->>'accountId')::uuid and l.signed_amount=-(supplied->>'amount')::numeric)) then
      raise exception using errcode='23505',message='Payment reference was already used for different account allocations.';
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
$function$
;

