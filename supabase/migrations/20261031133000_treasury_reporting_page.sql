-- A bounded, read-only reporting endpoint. No new finance ledger/table.
-- Existing treasury journals and account balances remain the source of truth.
begin;
create or replace function public.get_current_tenant_treasury_report_page(
  p_from timestamptz,
  p_to timestamptz,
  p_branch_id uuid default null,
  p_account_id uuid default null,
  p_after_at timestamptz default null,
  p_after_line_id uuid default null,
  p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path = ''
as $body$
declare
  v_tenant uuid := private.current_tenant_id();
  v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
  v_accounts jsonb;
  v_summary jsonb;
  v_by_account jsonb;
  v_entries jsonb;
  v_fetched integer := 0;
  v_cursor jsonb;
begin
  if v_tenant is null or auth.uid() is null then
    raise exception using errcode='42501',message='Active tenant session required.';
  end if;
  if p_from is null or p_to is null or p_from>p_to
    or (p_after_at is null) <> (p_after_line_id is null) then
    raise exception using errcode='22023',message='Invalid treasury report range or cursor.';
  end if;
  if p_branch_id is not null
    and (not private.can_read_branch(v_tenant,p_branch_id)
      or not private.has_branch_permission(v_tenant,p_branch_id,'cashandbank.read')) then
    raise exception using errcode='42501',message='Cannot read this branch cash report.';
  end if;
  if p_account_id is not null and not exists(
    select 1 from public.branch_payment_accounts a
    where a.tenant_id=v_tenant and a.id=p_account_id
      and (p_branch_id is null or a.branch_id=p_branch_id)
      and private.can_read_branch(v_tenant,a.branch_id)
      and private.has_branch_permission(v_tenant,a.branch_id,'cashandbank.read')
  ) then
    raise exception using errcode='42501',message='Cannot read this payment account.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'accountId',a.id, 'sourceKey',a.source_key, 'branchId',a.branch_id,
    'name',a.account_name, 'accountType',a.account_type,
    'provider',a.provider_name,'maskedReference',a.masked_reference,
    'currency',a.currency,'status',a.status,'currentBalance',b.current_balance
  ) order by a.account_name,a.id),'[]'::jsonb)
  into v_accounts
  from public.branch_payment_accounts a
  left join public.branch_account_balances b
    on b.tenant_id=a.tenant_id and b.branch_id=a.branch_id
    and b.account_id=a.id and b.currency=a.currency
  where a.tenant_id=v_tenant
    and (p_branch_id is null or a.branch_id=p_branch_id)
    and private.can_read_branch(v_tenant,a.branch_id)
    and private.has_branch_permission(v_tenant,a.branch_id,'cashandbank.read');

  -- Totals are computed on the server across ALL matching journal lines,
  -- independently of page size. Internal transfers are NOT external income.
  select jsonb_build_object(
    'moneyIn',coalesce(sum(l.signed_amount) filter(
      where j.external_cash_flow is true and l.signed_amount>0),0),
    'moneyOut',coalesce(sum(-l.signed_amount) filter(
      where j.external_cash_flow is true and l.signed_amount<0),0),
    'count',count(*),
    'inCount',count(*) filter(where j.external_cash_flow is true and l.signed_amount>0),
    'outCount',count(*) filter(where j.external_cash_flow is true and l.signed_amount<0)
  )
  into v_summary
  from public.treasury_journal_lines l
  join public.treasury_journals j
    on j.id=l.journal_id and j.tenant_id=l.tenant_id
  join public.branch_payment_accounts a
    on a.id=l.account_id and a.tenant_id=l.tenant_id and a.branch_id=l.branch_id
  where l.tenant_id=v_tenant
    and j.posted_at between p_from and p_to
    and (p_branch_id is null or l.branch_id=p_branch_id)
    and (p_account_id is null or l.account_id=p_account_id)
    and private.can_read_branch(v_tenant,l.branch_id)
    and private.has_branch_permission(v_tenant,l.branch_id,'cashandbank.read');

  select coalesce(jsonb_agg(jsonb_build_object(
    'accountId',d.account_id,'moneyIn',d.money_in,'moneyOut',d.money_out
  )),'[]'::jsonb)
  into v_by_account
  from (
    select l.account_id,
      coalesce(sum(l.signed_amount) filter(
        where j.external_cash_flow is true and l.signed_amount>0),0) as money_in,
      coalesce(sum(-l.signed_amount) filter(
        where j.external_cash_flow is true and l.signed_amount<0),0) as money_out
    from public.treasury_journal_lines l
    join public.treasury_journals j
      on j.id=l.journal_id and j.tenant_id=l.tenant_id
    join public.branch_payment_accounts a
      on a.id=l.account_id and a.tenant_id=l.tenant_id and a.branch_id=l.branch_id
    where l.tenant_id=v_tenant
      and j.posted_at between p_from and p_to
      and (p_branch_id is null or l.branch_id=p_branch_id)
      and (p_account_id is null or l.account_id=p_account_id)
      and private.can_read_branch(v_tenant,l.branch_id)
      and private.has_branch_permission(v_tenant,l.branch_id,'cashandbank.read')
    group by l.account_id
  ) d;

  -- Stable keyset pagination: exactly <= 50 lines normally, <= 100 maximum.
  -- The extra line is used only to signal hasMore, never sent to the client.
  with matched as (
    select l.id,l.account_id,l.branch_id,l.signed_amount,l.balance_after,
      l.currency,j.id journal_id,j.description,j.source_type,j.source_id,
      j.journal_type,j.posted_at,j.external_cash_flow,j.reversal_of_journal_id
    from public.treasury_journal_lines l
    join public.treasury_journals j
      on j.id=l.journal_id and j.tenant_id=l.tenant_id
    join public.branch_payment_accounts a
      on a.id=l.account_id and a.tenant_id=l.tenant_id and a.branch_id=l.branch_id
    where l.tenant_id=v_tenant
      and j.posted_at between p_from and p_to
      and (p_branch_id is null or l.branch_id=p_branch_id)
      and (p_account_id is null or l.account_id=p_account_id)
      and (p_after_at is null or (j.posted_at,l.id)<(p_after_at,p_after_line_id))
      and private.can_read_branch(v_tenant,l.branch_id)
      and private.has_branch_permission(v_tenant,l.branch_id,'cashandbank.read')
    order by j.posted_at desc,l.id desc
    limit v_limit+1
  )
  select count(*)::integer,
    coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'journalId',m.journal_id,
      'accountId',m.account_id,'branchId',m.branch_id,
      'amount',m.signed_amount,'balanceAfter',m.balance_after,
      'currency',m.currency,'description',m.description,
      'sourceType',m.source_type,'referenceId',m.source_id,
      'journalType',m.journal_type,'postedAt',m.posted_at,
      'externalCashFlow',m.external_cash_flow,
      'reversalOfJournalId',m.reversal_of_journal_id
    ) order by m.posted_at desc,m.id desc)
    filter(where m.row_idx<=v_limit),'[]'::jsonb)
  into v_fetched,v_entries
  from (
    select matched.*,row_number() over(order by posted_at desc,id desc) row_idx
    from matched
  ) m;

  if jsonb_array_length(v_entries)>0 and v_fetched>v_limit then
    select jsonb_build_object(
      'postedAt',v_entries->(jsonb_array_length(v_entries)-1)->>'postedAt',
      'lineId',v_entries->(jsonb_array_length(v_entries)-1)->>'id'
    ) into v_cursor;
  end if;
  return jsonb_build_object(
    'accounts',v_accounts,'entries',v_entries,'summary',v_summary,
    'accountBreakdown',v_by_account,
    'hasMore',v_fetched>v_limit,'nextCursor',v_cursor
  );
end;
$body$;
revoke all on function public.get_current_tenant_treasury_report_page(timestamptz,timestamptz,uuid,uuid,timestamptz,uuid,integer)
  from public,anon;
grant execute on function public.get_current_tenant_treasury_report_page(timestamptz,timestamptz,uuid,uuid,timestamptz,uuid,integer)
  to authenticated;
commit;
