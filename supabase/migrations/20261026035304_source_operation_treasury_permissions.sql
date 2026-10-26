-- Source operations authorize their own module; private posting cores are never RPC accessible.

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
$function$

;

revoke all on function private.post_current_tenant_treasury_entry_authorized(uuid,uuid,numeric,text,text,text,text,text,jsonb) from public,anon,authenticated;

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
$function$

;

revoke all on function private.post_current_tenant_treasury_split_outgoing_entry_authorized(uuid,jsonb,text,text,text,text,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.reverse_current_tenant_treasury_journal_authorized(p_journal_id uuid, p_idempotency_key text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_original public.treasury_journals%rowtype;
  v_existing public.treasury_journals%rowtype;
  v_line public.treasury_journal_lines%rowtype;
  v_reversal_id uuid;
  v_balance numeric(18, 2);
  v_payload jsonb;
  v_purchase jsonb;
  v_payment jsonb;
  v_now timestamptz := clock_timestamp();
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
  end loop;

  -- Lock the purchase before balances, in the same order as installment posting.
  if v_original.source_type='supplier_payment' and v_original.metadata ? 'purchasePaymentId' then
    if private.normalized_writes_enabled(v_tenant_id) then
      perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
      v_payload:=private.normalized_business_snapshot(v_tenant_id,array['purchases']);
    else select payload into v_payload from public.tenant_workspaces where tenant_id=v_tenant_id for update; end if;
    select item into v_purchase from jsonb_array_elements(v_payload->'purchases') as item where item->>'id'=v_original.metadata->>'purchaseId';
    select item into v_payment from jsonb_array_elements(v_purchase->'payments') as item
      where item->>'id'=v_original.metadata->>'purchasePaymentId'
        and item->>'treasuryJournalId'=p_journal_id::text and not item ? 'reversedAt';
    if v_payment is null then raise exception using errcode='23514',message='Purchase installment was not found or was already reversed.'; end if;
  end if;

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

  if v_payment is not null then
    v_purchase := v_purchase || jsonb_build_object(
      'amountPaid',(v_purchase->>'amountPaid')::numeric-(v_payment->>'amount')::numeric,
      'amountDue',(v_purchase->>'totalAmount')::numeric-(v_purchase->>'amountPaid')::numeric+(v_payment->>'amount')::numeric,
      'payments',(select jsonb_agg(case when item->>'id'=v_payment->>'id' then item||jsonb_build_object('reversedAt',v_now,'reversalJournalId',v_reversal_id) else item end order by ord)
        from jsonb_array_elements(v_purchase->'payments') with ordinality as records(item,ord)),
      'paymentAllocations',coalesce((select jsonb_agg(item order by ord) from jsonb_array_elements(v_purchase->'paymentAllocations') with ordinality as records(item,ord) where item->>'id' is distinct from v_payment->>'id'),'[]'::jsonb),
      'syncUpdatedAt',v_now,'updatedAt',v_now);
    if private.normalized_writes_enabled(v_tenant_id) then
      perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_set(v_payload,'{purchases}',(
      select jsonb_agg(case when item->>'id'=v_original.metadata->>'purchaseId' then v_purchase else item end order by ord)
      from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
    ),true));
    else update public.tenant_workspaces set payload=jsonb_set(v_payload,'{purchases}',(
      select jsonb_agg(case when item->>'id'=v_original.metadata->>'purchaseId' then v_purchase else item end order by ord)
      from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
    ),true),updated_at=v_now,updated_by=v_actor_id where tenant_id=v_tenant_id; end if;
  end if;

  return jsonb_build_object(
    'journalId', v_reversal_id, 'reversalOfJournalId', v_original.id, 'status', 'reversed'
  );
end;
$function$

;

revoke all on function private.reverse_current_tenant_treasury_journal_authorized(uuid,text,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.has_branch_permission(p_tenant_id uuid, p_branch_id uuid, p_permission_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_key text := lower(nullif(btrim(p_permission_key), ''));
  v_module text;
  v_action text;
  v_profile_value text;
begin
  if v_key is null or not private.is_active_tenant_member(p_tenant_id) then
    return false;
  end if;
  if private.is_tenant_branch_administrator(p_tenant_id) then
    return true;
  end if;
  if not private.is_branch_assigned(p_tenant_id, p_branch_id) then
    return false;
  end if;
  if exists (
    select 1 from public.branch_permission_grants g
    where g.tenant_id=p_tenant_id and g.staff_id=(select auth.uid())
      and g.permission_key=v_key and g.effect='deny'
      and (g.branch_id is null or g.branch_id=p_branch_id)
  ) then return false; end if;
  if exists (
    select 1 from public.branch_permission_grants g
    where g.tenant_id=p_tenant_id and g.staff_id=(select auth.uid())
      and g.permission_key=v_key and g.effect='allow'
      and (g.branch_id is null or g.branch_id=p_branch_id)
  ) then return true; end if;

  -- The Roles UI and staff provisioning persist { pos: { write: true } },
  -- not { "pos.write": true }. The saved user override is authoritative
  -- for real module read/write/edit permissions, including explicit false.
  v_module := case split_part(v_key,'.',1) when 'fundtransfers' then 'fundTransfers' when 'paymentin' then 'paymentIn' when 'paymentout' then 'paymentOut' when 'cashandbank' then 'cashAndBank' else split_part(v_key,'.',1) end;
  if v_key='money_bank.transfer' then v_module:='fundTransfers'; v_key:='fundtransfers.write'; end if;
  v_action := split_part(v_key,'.',2);
  if v_action in ('read','write','edit') and v_key = lower(v_module) || '.' || v_action then
    select u.role_permissions #>> array[v_module,v_action] into v_profile_value
    from public.users u
    where u.id=(select auth.uid()) and u.tenant_id=p_tenant_id and u.is_active;
    if v_profile_value in ('true','false') then
      return v_profile_value = 'true';
    end if;
  end if;

  if exists (
    select 1 from public.branch_staff_assignments a
    join public.branch_roles r
      on r.tenant_id=a.tenant_id and r.id=a.branch_role_id and r.status='active'
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
      and a.staff_id=(select auth.uid()) and a.status='active'
      and (a.starts_at is null or a.starts_at<=now())
      and (a.ends_at is null or a.ends_at>now())
      and (r.permissions @> jsonb_build_object(v_key,true)
        or (v_action in ('read','write','edit')
          and v_key=lower(v_module)||'.'||v_action
          and r.permissions #>> array[v_module,v_action]='true'))
  ) then return true; end if;
  if exists (
    select 1 from public.branch_staff_assignments a
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
      and a.staff_id=(select auth.uid()) and a.status='active'
      and (a.starts_at is null or a.starts_at<=now())
      and (a.ends_at is null or a.ends_at>now())
      and (a.permissions @> jsonb_build_object(v_key,true)
        or (v_action in ('read','write','edit')
          and v_key=lower(v_module)||'.'||v_action
          and a.permissions #>> array[v_module,v_action]='true'))
  ) then return true; end if;
  -- Delivery UI is a POS workflow. Inherit POS write only when no delivery
  -- override or explicit branch deny resolved above; never inherit money_bank.post.
  if v_key='deliveries.write' then
    if exists (
      select 1 from public.branch_staff_assignments a
      left join public.branch_roles r on r.id=a.branch_role_id and r.tenant_id=a.tenant_id and r.status='active'
      where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.staff_id=(select auth.uid())
        and a.status='active' and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
        and (a.permissions #>> array['deliveries','write']='false' or r.permissions #>> array['deliveries','write']='false')
    ) then return false; end if;
    return private.has_branch_permission(p_tenant_id,p_branch_id,'pos.write');
  end if;
  return false;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.save_current_branch_purchases(p_purchases jsonb, p_products jsonb DEFAULT NULL::jsonb, p_branch_stocks jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_purchases jsonb;
  v_existing_products jsonb;
  v_existing_branch_stocks jsonb;
  v_next_purchases jsonb;
  v_next_products jsonb;
  v_next_branch_stocks jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_purchases is null or jsonb_typeof(p_purchases) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid purchases array is required.';
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_branch_stocks is not null and jsonb_typeof(p_branch_stocks) <> 'array' then
    raise exception using errcode = '22023', message = 'branchStocks, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_purchases := coalesce(v_existing -> 'purchases', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_branch_stocks := coalesce(v_existing -> 'branchStocks', '[]'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_purchases);
    v_incoming_count := jsonb_array_length(p_purchases);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_purchases := v_existing_purchases;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=purchases existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_purchases := p_purchases;
    end if;

    -- No shrink guard for branchStocks under all_branches, matching
    -- save_current_branch_workspace (that key is outside its guard loop
    -- for this scope too).
    if p_branch_stocks is not null then
      v_next_branch_stocks := p_branch_stocks;
    end if;
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
      if not private.is_tenant_branch_administrator(v_tenant_id) then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
      if not private.is_tenant_branch_administrator(v_tenant_id)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'purchases.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for purchases.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_purchases, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_purchases, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=purchases existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;
    v_next_purchases := private.replace_branch_json_array(
      v_existing_purchases, p_purchases, v_branch_id, v_include_unassigned
    );

    if p_branch_stocks is not null then
      v_next_branch_stocks := private.replace_branch_json_array(
        v_existing_branch_stocks, p_branch_stocks, v_branch_id, false
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  v_next_purchases := private.preserve_purchase_payment_state(v_existing_purchases,v_next_purchases);
  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  if v_next_branch_stocks is not null then
    v_next_payload := jsonb_set(v_next_payload, '{branchStocks}', v_next_branch_stocks, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
    return private.normalized_mutation_result(array['purchases','purchaseTombstones','products','branchStocks']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object(
    'purchases', v_next_purchases,
    'branchStocks', v_next_branch_stocks,
    'products', v_next_products
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION public.save_current_branch_purchases(p_purchases jsonb, p_purchase_tombstones jsonb DEFAULT '{}'::jsonb, p_products jsonb DEFAULT NULL::jsonb, p_branch_stocks jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_purchases jsonb;
  v_existing_products jsonb;
  v_existing_branch_stocks jsonb;
  v_existing_purchase_tombstones jsonb;
  v_next_purchases jsonb;
  v_next_products jsonb;
  v_next_branch_stocks jsonb;
  v_next_purchase_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_purchases is null or jsonb_typeof(p_purchases) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid purchases array is required.';
  end if;
  if p_purchase_tombstones is null or jsonb_typeof(p_purchase_tombstones) <> 'object' then
    p_purchase_tombstones := '{}'::jsonb;
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_branch_stocks is not null and jsonb_typeof(p_branch_stocks) <> 'array' then
    raise exception using errcode = '22023', message = 'branchStocks, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array['purchases','products','branchStocks']);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_purchases := coalesce(v_existing -> 'purchases', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_branch_stocks := coalesce(v_existing -> 'branchStocks', '[]'::jsonb);
  v_existing_purchase_tombstones := coalesce(v_existing -> 'purchaseTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_purchases);
    v_incoming_count := jsonb_array_length(p_purchases);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_purchases := v_existing_purchases;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=purchases existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_purchases := p_purchases;
    end if;

    if p_branch_stocks is not null then
      v_next_branch_stocks := p_branch_stocks;
    end if;

    v_next_purchase_tombstones := coalesce(p_purchase_tombstones, v_existing_purchase_tombstones);
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
      if not private.is_tenant_branch_administrator(v_tenant_id) then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
      if not private.is_tenant_branch_administrator(v_tenant_id)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'purchases.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for purchases.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_purchases, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_purchases, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=purchases existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_purchase_tombstones := v_existing_purchase_tombstones || p_purchase_tombstones;

    v_next_purchases := private.merge_branch_json_array_by_id(
      v_existing_purchases, p_purchases, v_branch_id, v_include_unassigned, v_next_purchase_tombstones
    );

    if p_branch_stocks is not null then
      v_next_branch_stocks := private.replace_branch_json_array(
        v_existing_branch_stocks, p_branch_stocks, v_branch_id, false
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  if exists(select 1 from jsonb_array_elements(v_existing_purchases) as item where jsonb_array_length(coalesce(item->'payments','[]'::jsonb))>0 and v_next_purchase_tombstones ? (item->>'id')) then raise exception using errcode='23514',message='Purchases with recorded installments must be kept for payment audit history.'; end if;
  v_next_purchases := private.preserve_purchase_payment_state(v_existing_purchases,v_next_purchases);
  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  v_next_payload := jsonb_set(v_next_payload, '{purchaseTombstones}', v_next_purchase_tombstones, true);
  if v_next_branch_stocks is not null then
    v_next_payload := jsonb_set(v_next_payload, '{branchStocks}', v_next_branch_stocks, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,v_next_payload);
    return private.normalized_mutation_result(array['purchases','purchaseTombstones','products','branchStocks']);
  else
  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  return jsonb_build_object(
    'purchases', v_next_purchases,
    'purchaseTombstones', v_next_purchase_tombstones,
    'branchStocks', v_next_branch_stocks,
    'products', v_next_products
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION public.add_current_branch_purchase_payment(p_purchase_id text, p_payment_id uuid, p_amount numeric, p_funding_type text, p_source_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_tenant uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch uuid;
  v_payload jsonb;
  v_purchase jsonb;
  v_payment jsonb;
  v_previous jsonb;
  v_payments jsonb;
  v_allocations jsonb;
  v_account public.branch_payment_accounts%rowtype;
  v_post jsonb;
  v_total numeric;
  v_paid numeric;
  v_currency text;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or v_tenant is null then
    raise exception using errcode='42501', message='Tenant authentication is required.';
  end if;
  if nullif(btrim(p_purchase_id),'') is null or p_payment_id is null
    or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount <= 0 or p_amount <> round(p_amount,2)
    or p_funding_type is null or p_funding_type not in ('registered','external')
    or (p_funding_type='registered' and nullif(btrim(p_source_key),'') is null)
    or (p_funding_type='external' and p_source_key is not null)
  then
    raise exception using errcode='22023', message='A purchase, payment ID, positive amount and funding account are required.';
  end if;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  if v_context->>'activeScope' <> 'branch' or v_branch is null
    or not private.can_write_branch(v_tenant,v_branch,'purchases.write')
    or not private.can_write_branch(v_tenant,v_branch,'paymentout.write') then
    raise exception using errcode='42501', message='Purchase and supplier payment permission are required.';
  end if;
  if private.normalized_writes_enabled(v_tenant) then
      perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
      v_payload:=private.normalized_business_snapshot(v_tenant,array['purchases']);
    else select payload into v_payload from public.tenant_workspaces where tenant_id=v_tenant for update; end if;
  select item into v_purchase from jsonb_array_elements(coalesce(v_payload->'purchases','[]'::jsonb)) as item
    where item->>'id'=p_purchase_id;
  if v_purchase is null then
    raise exception using errcode='P0002', message='Purchase was not found.';
  end if;
  if (nullif(v_purchase->>'branchId','') is not null and v_purchase->>'branchId'<>v_branch::text)
    or (nullif(v_purchase->>'branchId','') is null and not coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false))
  then
    raise exception using errcode='42501', message='The purchase belongs to another branch.';
  end if;
  v_payments := coalesce(v_purchase->'payments','[]'::jsonb);
  select item into v_previous from jsonb_array_elements(v_payments) as item where item->>'id'=p_payment_id::text;
  if v_previous is not null then
    if (v_previous->>'amount')::numeric <> p_amount or v_previous->>'fundingType'<>p_funding_type
      or (v_previous->>'sourceKey') is distinct from p_source_key then
      raise exception using errcode='23505', message='This payment ID was already used with different payment details.';
    end if;
    return jsonb_build_object('purchase',v_purchase,'status','already_recorded');
  end if;
  v_total := coalesce((v_purchase->>'totalAmount')::numeric,0);
  v_paid := coalesce((v_purchase->>'amountPaid')::numeric,0);
  if v_paid < 0 or v_total < v_paid or p_amount > v_total-v_paid then
    raise exception using errcode='23514', message='Payment exceeds the outstanding purchase amount.';
  end if;
  select currency_code into v_currency from public.tenants where id=v_tenant;
  v_payment := jsonb_build_object('id',p_payment_id,'amount',p_amount,'fundingType',p_funding_type,
    'accountName','External Account','paidAt',v_now,'recordedBy',v_actor,'currency',v_currency);
  if p_funding_type='registered' then
    select * into v_account from public.branch_payment_accounts
      where tenant_id=v_tenant and branch_id=v_branch and source_key=p_source_key
        and status='active' and not is_locked;
    if v_account.id is null or v_account.currency is distinct from v_currency then
      raise exception using errcode='23514', message='Select an active unlocked account in the purchase currency.';
    end if;
    v_post := private.post_current_tenant_treasury_split_outgoing_entry_authorized(
      v_branch,jsonb_build_array(jsonb_build_object('accountId',v_account.id,'amount',p_amount)),
      'supplier_payment',p_purchase_id||':payment:'||p_payment_id::text,'purchase-installment:'||p_payment_id::text,
      'Purchase payment to '||coalesce(v_purchase->>'supplierName','supplier'),
      jsonb_build_object('purchaseId',p_purchase_id,'purchasePaymentId',p_payment_id,'supplierId',v_purchase->>'supplierId'));
    v_payment := v_payment || jsonb_build_object('sourceKey',p_source_key,'accountId',p_source_key,
      'accountName',v_account.account_name,'treasuryJournalId',v_post->>'journalId');
  end if;
  -- Preserve legacy initial funding when the first installment is appended.
  v_allocations := coalesce(v_purchase->'paymentAllocations','[]'::jsonb);
  if jsonb_array_length(v_allocations)=0 and v_paid>0 and nullif(v_purchase->>'paidFromAccountId','') is not null then
    v_allocations := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'fundingType','registered','accountId',v_purchase->>'paidFromAccountId','sourceKey',v_purchase->>'paidFromAccountId',
      'accountName',coalesce(v_purchase->>'paymentMethod','Original payment'),'amount',v_paid,
      'paidAt',v_purchase->>'timestamp','treasuryJournalId',v_purchase->>'treasuryJournalId')));
  end if;
  v_purchase := v_purchase || jsonb_build_object(
    'amountPaid',v_paid+p_amount,'amountDue',v_total-v_paid-p_amount,
    'payments',v_payments||jsonb_build_array(v_payment),
    'paymentAllocations',v_allocations||jsonb_build_array(v_payment),
    'syncUpdatedAt',v_now,'updatedAt',v_now);
  if private.normalized_writes_enabled(v_tenant) then
      perform private.persist_normalized_business_snapshot(v_tenant,jsonb_set(v_payload,'{purchases}',(
    select jsonb_agg(case when item->>'id'=p_purchase_id then v_purchase else item end order by ord)
    from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
  ),true));
    else update public.tenant_workspaces set payload=jsonb_set(v_payload,'{purchases}',(
    select jsonb_agg(case when item->>'id'=p_purchase_id then v_purchase else item end order by ord)
    from jsonb_array_elements(v_payload->'purchases') with ordinality as records(item,ord)
  ),true),updated_at=v_now,updated_by=v_actor where tenant_id=v_tenant; end if;
  return jsonb_build_object('purchase',v_purchase,'status','recorded');
end;
$function$

;

CREATE OR REPLACE FUNCTION public.transfer_current_tenant_treasury_funds(p_source_account_id uuid, p_destination_account_id uuid, p_amount numeric, p_idempotency_key text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
    or p_source_account_id = p_destination_account_id or coalesce(p_amount, 0) <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2)
  then
    raise exception using errcode = '22023', message = 'Two different accounts and a positive amount are required.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or nullif(btrim(p_description), '') is null then
    raise exception using errcode = '22023', message = 'Idempotency key and description are required.';
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
$function$

;

CREATE OR REPLACE FUNCTION public.save_current_tenant_settings(p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_branch_id uuid;
  v_existing jsonb;
  v_merged_settings jsonb;
  v_updated_at timestamptz := statement_timestamp();
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using
      errcode = '42501',
      message = 'An active tenant account is required.';
  end if;
  if p_settings is null
    or jsonb_typeof(p_settings) <> 'object'
    or p_settings = '{}'::jsonb
  then
    raise exception using
      errcode = '22023',
      message = 'A non-empty settings object is required.';
  end if;

  if not private.is_tenant_branch_administrator(v_tenant_id) then
    v_context := public.get_current_branch_context();
    v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;
    if v_branch_id is null
      or not private.can_write_branch(
        v_tenant_id,
        v_branch_id,
        'settings.write'
      )
    then
      raise exception using
        errcode = '42501',
        message = 'Settings write permission is required.';
    end if;
  end if;

  perform set_config(
    'app.jasper_explicit_settings_tenant',
    v_tenant_id::text,
    true
  );

  if p_settings ? 'customRoles' and not private.is_tenant_branch_administrator(v_tenant_id) then
    raise exception using errcode='42501', message='Only the business owner may change staff roles.';
  end if;

  if private.normalized_writes_enabled(v_tenant_id) then
    perform 1 from public.tenant_workspaces where tenant_id=v_tenant_id for update;
    v_existing := private.normalized_mutation_snapshot(v_tenant_id,array[]::text[]);
  else
    select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  end if;

  v_merged_settings := private.merge_settings_by_path(
    coalesce(v_existing -> 'settings', '{}'::jsonb),
    p_settings,
    v_updated_at
  );

  if private.normalized_writes_enabled(v_tenant_id) then
    perform private.persist_normalized_business_snapshot(v_tenant_id,jsonb_set(coalesce(v_existing, '{}'::jsonb), '{settings}', v_merged_settings, true));
  else
  insert into public.tenant_workspaces (
    tenant_id,
    payload,
    updated_at,
    updated_by
  )
  values (
    v_tenant_id,
    jsonb_set(coalesce(v_existing, '{}'::jsonb), '{settings}', v_merged_settings, true),
    v_updated_at,
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        coalesce(public.tenant_workspaces.payload, '{}'::jsonb),
        '{settings}',
        excluded.payload -> 'settings',
        true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
  end if;

  insert into public.tenant_data (
    tenant_id,
    data_key,
    payload,
    updated_at
  )
  values (
    v_tenant_id::text,
    'settings',
    v_merged_settings,
    v_updated_at
  )
  on conflict (tenant_id, data_key) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at;

  -- Apply owner-saved role changes to accounts still using the previous role preset.
  -- Explicit individual overrides remain unchanged.
  if p_settings ? 'customRoles' then
    update public.users u set role_permissions = new_role.item->'permissions',
      role_key = new_role.item->>'name'
    from jsonb_array_elements(coalesce(v_existing->'settings'->'customRoles','[]'::jsonb)) old_role(item)
    join jsonb_array_elements(coalesce(v_merged_settings->'customRoles','[]'::jsonb)) new_role(item)
      on new_role.item->>'id'=old_role.item->>'id'
    where u.tenant_id=v_tenant_id and u.is_active
      and lower(coalesce(u.role_key,u.role))=lower(old_role.item->>'name')
      and u.role_permissions=old_role.item->'permissions'
      and old_role.item is distinct from new_role.item;
  end if;

  return jsonb_build_object(
    'settings', v_merged_settings,
    'updatedAt', v_updated_at
  );
end;
$function$

;

-- Internal record reads lock the workspace before resolving normalized records.
create or replace function private.payment_operation_snapshot(p_tenant uuid,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;
begin
  perform 1 from public.tenant_workspaces where tenant_id=p_tenant for update;
  if private.normalized_writes_enabled(p_tenant) then
    return private.normalized_business_snapshot(p_tenant,array[p_key]);
  end if;
  select payload into v_payload from public.tenant_workspaces where tenant_id=p_tenant;
  return coalesce(v_payload,'{}'::jsonb);
end; $$;
revoke all on function private.payment_operation_snapshot(uuid,text) from public,anon,authenticated;

create or replace function private.persist_payment_operation(p_tenant uuid,p_key text,p_record jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_payload jsonb; v_records jsonb;
begin
  v_payload:=private.payment_operation_snapshot(p_tenant,p_key);
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_records
    from jsonb_array_elements(coalesce(v_payload->p_key,'[]'::jsonb)) item
    where item->>'id'<>p_record->>'id';
  v_records:=v_records||jsonb_build_array(p_record);
  if private.normalized_writes_enabled(p_tenant) then
    perform private.persist_normalized_business_snapshot(p_tenant,jsonb_build_object(p_key,v_records));
  else
    update public.tenant_workspaces set payload=jsonb_set(payload,array[p_key],v_records,true),
      updated_at=clock_timestamp(),updated_by=auth.uid() where tenant_id=p_tenant;
  end if;
end; $$;
revoke all on function private.persist_payment_operation(uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.save_current_branch_expense_payment(p_expense jsonb,p_expected_version text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid:=private.current_tenant_id(); v_actor uuid:=auth.uid();
  v_context jsonb; v_branch uuid; v_payload jsonb; v_old jsonb; v_next jsonb;
  v_account public.branch_payment_accounts%rowtype; v_post jsonb; v_amount numeric;
  v_financial_change boolean; v_version text:=clock_timestamp()::text;
begin
  v_context:=public.get_current_branch_context(); v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
  if v_actor is null or v_tenant is null or v_branch is null or v_context->>'activeScope'<>'branch' then
    raise exception using errcode='42501',message='Select an authorized expense branch.';
  end if;
  if jsonb_typeof(p_expense) is distinct from 'object' or nullif(btrim(p_expense->>'id'),'') is null
    or nullif(btrim(p_expense->>'description'),'') is null or nullif(btrim(p_expense->>'category'),'') is null then
    raise exception using errcode='22023',message='Expense reference, description and category are required.';
  end if;
  v_amount:=(p_expense->>'amount')::numeric;
  if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<>round(v_amount,2) then
    raise exception using errcode='22023',message='A valid positive expense amount is required.';
  end if;
  if nullif(p_expense->>'branchId','') is not null and p_expense->>'branchId'<>v_branch::text then
    raise exception using errcode='42501',message='Expense belongs to another branch.';
  end if;
  v_payload:=private.payment_operation_snapshot(v_tenant,'expenses');
  select item into v_old from jsonb_array_elements(coalesce(v_payload->'expenses','[]'::jsonb)) item where item->>'id'=p_expense->>'id';
  if not private.can_write_branch(v_tenant,v_branch,case when v_old is null then 'expenses.write' else 'expenses.edit' end) then
    -- Retrying the identical create is safe but never permits an edit.
    if v_old is not null and p_expected_version is null and private.can_write_branch(v_tenant,v_branch,'expenses.write')
      and v_old->>'branchId'=v_branch::text
      and (v_old-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId'])=(p_expense-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId']) then
      return jsonb_build_object('expense',v_old,'status','already_recorded');
    end if;
    raise exception using errcode='42501',message='Expense create or edit permission is required.';
  end if;
  if v_old is not null then
    if coalesce(v_old->>'branchId',v_branch::text)<>v_branch::text or
      (nullif(v_old->>'branchId','') is null and not coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false)) then
      raise exception using errcode='42501',message='Expense belongs to another branch.';
    end if;
    if p_expected_version is null then
      if (v_old-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId']) is distinct from (p_expense-array['treasuryJournalId','syncUpdatedAt','updatedAt','branchId']) then
        raise exception using errcode='23505',message='Expense already exists. Refresh before editing.';
      end if;
      return jsonb_build_object('expense',v_old,'status','already_recorded');
    end if;
    if p_expected_version is distinct from coalesce(v_old->>'syncUpdatedAt',v_old->>'updatedAt',v_old->>'timestamp','') then
      raise exception using errcode='40001',message='Expense changed. Refresh before editing.';
    end if;
  end if;
  v_financial_change:=v_old is null or (v_old->>'amount')::numeric is distinct from v_amount
    or (v_old->>'paidFromAccountId') is distinct from (p_expense->>'paidFromAccountId');
  v_next:=(p_expense-'treasuryJournalId')||jsonb_build_object('branchId',v_branch,'syncUpdatedAt',v_version,'updatedAt',v_version);
  if v_old is not null and not v_financial_change then
    if v_old ? 'treasuryJournalId' then v_next:=v_next||jsonb_build_object('treasuryJournalId',v_old->'treasuryJournalId'); end if;
  else
    if v_old is not null then
      if nullif(v_old->>'treasuryJournalId','') is null then
        raise exception using errcode='23514',message='Historical expense funding must be reconciled before changing its amount or account.';
      end if;
      if not exists(select 1 from public.treasury_journals j join public.treasury_journal_lines l
        on l.journal_id=j.id and l.tenant_id=j.tenant_id
        where j.tenant_id=v_tenant and j.id=(v_old->>'treasuryJournalId')::uuid
          and j.source_type in ('expense','payroll') and j.source_id=v_old->>'id'
          and l.branch_id=v_branch and l.signed_amount=-(v_old->>'amount')::numeric
          and (select count(*) from public.treasury_journal_lines where journal_id=j.id and tenant_id=v_tenant)=1) then
        raise exception using errcode='23514',message='The original expense payment could not be verified.';
      end if;
      perform private.reverse_current_tenant_treasury_journal_authorized((v_old->>'treasuryJournalId')::uuid,
        'expense-edit-reversal:'||(v_old->>'treasuryJournalId'),'Corrected expense '||(v_old->>'id'));
    end if;
    select * into v_account from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch
      and source_key=p_expense->>'paidFromAccountId' and status='active' and not is_locked;
    if v_account.id is null then raise exception using errcode='23514',message='Select an active expense payment account in this branch.'; end if;
    v_post:=private.post_current_tenant_treasury_entry_authorized(v_branch,v_account.id,v_amount,'out',
      case when nullif(p_expense->>'payrollPaymentType','') is null then 'expense' else 'payroll' end,
      p_expense->>'id',case when v_old is null then 'expense:'||(p_expense->>'id')||':v1' else 'expense-edit:'||(v_old->>'treasuryJournalId') end,
      p_expense->>'description',jsonb_build_object('expenseId',p_expense->>'id','category',p_expense->>'category','staffId',p_expense->>'staffId'));
    v_next:=v_next||jsonb_build_object('treasuryJournalId',v_post->>'journalId');
  end if;
  perform private.persist_payment_operation(v_tenant,'expenses',v_next);
  return jsonb_build_object('expense',v_next,'status','recorded');
end; $$;
revoke all on function public.save_current_branch_expense_payment(jsonb,text) from public,anon;
grant execute on function public.save_current_branch_expense_payment(jsonb,text) to authenticated;

create or replace function public.save_current_branch_funded_purchase(p_purchase jsonb,p_products jsonb default null,p_branch_stocks jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid:=private.current_tenant_id(); v_branch uuid; v_context jsonb; v_payload jsonb; v_old jsonb;
  v_next jsonb; v_lines jsonb:='[]'; v_allocations jsonb; v_allocation jsonb; v_account public.branch_payment_accounts%rowtype;
  v_total numeric; v_paid numeric; v_funded numeric:=0; v_amount numeric; v_post jsonb; v_result jsonb; v_currency text;
begin
  v_context:=public.get_current_branch_context(); v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
  if auth.uid() is null or v_tenant is null or v_branch is null or v_context->>'activeScope'<>'branch'
    or not private.can_write_branch(v_tenant,v_branch,'purchases.write') then
    raise exception using errcode='42501',message='Purchase write permission is required in the selected branch.';
  end if;
  if jsonb_typeof(p_purchase) is distinct from 'object' or nullif(btrim(p_purchase->>'id'),'') is null
    or (nullif(p_purchase->>'branchId','') is not null and p_purchase->>'branchId'<>v_branch::text) then
    raise exception using errcode='22023',message='A purchase in the selected branch is required.';
  end if;
  v_total:=(p_purchase->>'totalAmount')::numeric; v_paid:=coalesce((p_purchase->>'amountPaid')::numeric,0);
  if v_total is null or v_total<=0 or v_paid<0 or v_paid>v_total or v_total::text in ('NaN','Infinity','-Infinity')
    or v_paid::text in ('NaN','Infinity','-Infinity') or v_paid<>round(v_paid,2) then
    raise exception using errcode='23514',message='Purchase total and paid amount must be valid.';
  end if;
  v_payload:=private.payment_operation_snapshot(v_tenant,'purchases');
  select item into v_old from jsonb_array_elements(coalesce(v_payload->'purchases','[]'::jsonb)) item where item->>'id'=p_purchase->>'id';
  if v_old is not null then
    if v_old->>'branchId' is distinct from v_branch::text or (v_old->>'totalAmount')::numeric<>v_total
      or (v_old->>'amountPaid')::numeric<>v_paid or v_old->'items' is distinct from p_purchase->'items' then
      raise exception using errcode='23505',message='Purchase reference already exists. Refresh Purchases.';
    end if;
    return jsonb_build_object('purchase',v_old,'status','already_recorded');
  end if;
  if nullif(p_purchase->>'treasuryJournalId','') is not null or jsonb_array_length(coalesce(p_purchase->'payments','[]'::jsonb))>0 then
    raise exception using errcode='22023',message='New purchases cannot supply payment journal references.';
  end if;
  v_allocations:=coalesce(p_purchase->'paymentAllocations','[]'::jsonb);
  if jsonb_typeof(v_allocations)<>'array' or jsonb_array_length(v_allocations)>20 then
    raise exception using errcode='22023',message='Valid purchase funding allocations are required.';
  end if;
  select currency_code into v_currency from public.tenants where id=v_tenant;
  for v_allocation in select value from jsonb_array_elements(v_allocations) loop
    v_amount:=(v_allocation->>'amount')::numeric;
    if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<>round(v_amount,2)
      or coalesce(v_allocation->>'fundingType','') not in ('registered','external') then
      raise exception using errcode='23514',message='Every funding allocation must have a valid amount and funding type.';
    end if;
    v_funded:=v_funded+v_amount;
    if v_allocation->>'fundingType'='registered' then
      select * into v_account from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch
        and source_key=coalesce(v_allocation->>'sourceKey',v_allocation->>'accountId') and status='active' and not is_locked;
      if v_account.id is null or v_account.currency is distinct from v_currency then
        raise exception using errcode='23514',message='Purchase funding requires an active account in this branch and currency.';
      end if;
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object('accountId',v_account.id,'amount',v_amount));
    end if;
  end loop;
  if v_funded<>v_paid then raise exception using errcode='23514',message='Funding allocations must equal the purchase amount paid.'; end if;
  v_next:=p_purchase||jsonb_build_object('branchId',v_branch,'amountDue',v_total-v_paid,'syncUpdatedAt',clock_timestamp());
  if jsonb_array_length(v_lines)>0 then
    -- Aggregate repeat account rows so account locks and journal lines remain deterministic.
    select jsonb_agg(jsonb_build_object('accountId',account_id,'amount',amount) order by account_id) into v_lines
      from (select item->>'accountId' account_id,sum((item->>'amount')::numeric) amount from jsonb_array_elements(v_lines) item group by item->>'accountId') grouped;
    v_post:=private.post_current_tenant_treasury_split_outgoing_entry_authorized(v_branch,v_lines,'purchase',p_purchase->>'id',
      'purchase:'||(p_purchase->>'id')||':v1','Purchase payment to '||coalesce(p_purchase->>'supplierName','supplier'),jsonb_build_object('fundingAllocations',v_allocations));
    v_next:=v_next||jsonb_build_object('treasuryJournalId',v_post->>'journalId');
  end if;
  v_result:=public.save_current_branch_purchases(p_purchases=>jsonb_build_array(v_next),p_purchase_tombstones=>'{}'::jsonb,p_products=>p_products,p_branch_stocks=>p_branch_stocks);
  return jsonb_build_object('purchase',v_next,'workspace',v_result,'status','recorded');
end; $$;
revoke all on function public.save_current_branch_funded_purchase(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_current_branch_funded_purchase(jsonb,jsonb,jsonb) to authenticated;

create or replace function public.add_current_branch_sale_payment(p_sale_id text,p_payment_id uuid,p_amount numeric,p_source_key text,p_paid_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid:=private.current_tenant_id(); v_context jsonb; v_branch uuid; v_payload jsonb; v_sale jsonb;
  v_payment jsonb; v_previous jsonb; v_account public.branch_payment_accounts%rowtype; v_post jsonb; v_paid numeric; v_total numeric;
begin
  v_context:=public.get_current_branch_context(); v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
  if auth.uid() is null or v_tenant is null or v_branch is null or v_context->>'activeScope'<>'branch'
    or not private.can_write_branch(v_tenant,v_branch,'paymentin.write') then
    raise exception using errcode='42501',message='Customer payment permission is required in the selected branch.';
  end if;
  if nullif(btrim(p_sale_id),'') is null or p_payment_id is null or p_amount is null or p_amount<=0
    or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2) then
    raise exception using errcode='22023',message='A sale, payment reference and valid positive payment are required.';
  end if;
  v_payload:=private.payment_operation_snapshot(v_tenant,'sales');
  select item into v_sale from jsonb_array_elements(coalesce(v_payload->'sales','[]'::jsonb)) item where item->>'id'=p_sale_id;
  if v_sale is null then raise exception using errcode='P0002',message='Sale was not found.'; end if;
  if coalesce(v_sale->>'branchId',v_branch::text)<>v_branch::text or
    (nullif(v_sale->>'branchId','') is null and not coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false)) then
    raise exception using errcode='42501',message='Sale belongs to another branch.';
  end if;
  select item into v_previous from jsonb_array_elements(coalesce(v_sale->'payments','[]'::jsonb)) item where item->>'id'=p_payment_id::text;
  if v_previous is not null then
    if (v_previous->>'amount')::numeric<>p_amount or v_previous->>'sourceKey' is distinct from p_source_key then
      raise exception using errcode='23505',message='Payment reference was already used with different details.';
    end if;
    return jsonb_build_object('sale',v_sale,'status','already_recorded');
  end if;
  v_total:=(v_sale->>'total')::numeric;
  v_paid:=coalesce((v_sale->>'amountPaid')::numeric,case when v_sale->>'paymentMethod'='Credit' then 0 else v_total end);
  if v_total is null or v_paid<0 or p_amount>v_total-v_paid then
    raise exception using errcode='23514',message='Payment exceeds the outstanding sale amount.';
  end if;
  select * into v_account from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch
    and source_key=p_source_key and status='active' and not is_locked;
  if v_account.id is null then raise exception using errcode='23514',message='Select an active payment account in this branch.'; end if;
  v_post:=private.post_current_tenant_treasury_entry_authorized(v_branch,v_account.id,p_amount,'in','sale_payment',
    p_sale_id||':payment:'||p_payment_id,'sale-installment:'||p_payment_id,'Customer payment for sale '||p_sale_id,
    jsonb_build_object('saleId',p_sale_id,'paymentId',p_payment_id));
  v_payment:=jsonb_build_object('id',p_payment_id,'amount',p_amount,'sourceKey',p_source_key,'accountId',v_account.id,
    'method',v_account.account_name,'date',coalesce(p_paid_at,clock_timestamp()),'recordedAt',clock_timestamp(),
    'recordedBy',auth.uid(),'treasuryJournalId',v_post->>'journalId');
  v_sale:=v_sale||jsonb_build_object('amountPaid',v_paid+p_amount,'payments',coalesce(v_sale->'payments','[]'::jsonb)||jsonb_build_array(v_payment),'syncUpdatedAt',clock_timestamp());
  perform private.persist_payment_operation(v_tenant,'sales',v_sale);
  return jsonb_build_object('sale',v_sale,'status','recorded');
end; $$;
revoke all on function public.add_current_branch_sale_payment(text,uuid,numeric,text,timestamptz) from public,anon;
grant execute on function public.add_current_branch_sale_payment(text,uuid,numeric,text,timestamptz) to authenticated;


