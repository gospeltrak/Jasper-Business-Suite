-- Delivery Treasury reporting, sourced solely from EXISTING normalized tables.
-- Delivery financial postings remain in treasury_journals / treasury_journal_lines.
-- No new ledger, account, or background sync process is introduced.
begin;
create or replace function public.get_current_tenant_delivery_treasury_report(
  p_from timestamptz,
  p_to timestamptz,
  p_branch_id uuid default null,
  p_after_at timestamptz default null,
  p_after_line_id uuid default null,
  p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_tenant uuid := private.current_tenant_id();
  v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
  v_delivery_stats jsonb;
  v_money_stats jsonb;
  v_accounts jsonb;
  v_entries jsonb;
  v_row_count integer := 0;
  v_cursor jsonb := null;
begin
  if auth.uid() is null or v_tenant is null then
    raise exception using errcode='42501',message='Active tenant session required.';
  end if;
  if p_from is null or p_to is null or p_from>p_to
     or (p_after_at is null) <> (p_after_line_id is null) then
    raise exception using errcode='22023',message='Invalid delivery report range or cursor.';
  end if;
  if p_branch_id is not null
    and (not private.can_read_branch(v_tenant,p_branch_id)
       or not private.has_branch_permission(v_tenant,p_branch_id,'cashandbank.read')) then
    raise exception using errcode='42501',message='Cannot view this branch delivery treasury.';
  end if;

  -- Operational fees are scoped by DELIVERY creation time. Payment collection
  -- is intentionally independent and scoped by treasury POSTING time below.
  -- No assumption that "Delivered" means "Paid".
  select jsonb_build_object(
    'orders',count(*),
    'quotedFees',coalesce(sum(d.delivery_cost),0),
    'pendingDispatch',count(*) filter(where d.status='Pending Dispatch'),
    'dispatched',count(*) filter(where d.status='Dispatched'),
    'delivered',count(*) filter(where d.status='Delivered'),
    'uncollectedFees',coalesce(sum(d.delivery_cost) filter(
       where coalesce(paid.net_paid,0)<=0),0),
    'uncollectedCount',count(*) filter(
       where d.delivery_cost>0 and coalesce(paid.net_paid,0)<=0)
  ) into v_delivery_stats
  from public.deliveries d
  left join lateral (
    select coalesce(sum(l.signed_amount),0) as net_paid
    from public.treasury_journals j
    join public.treasury_journal_lines l
      on l.tenant_id=j.tenant_id and l.journal_id=j.id
    where j.tenant_id=d.tenant_id and j.source_type='delivery'
      and j.source_id=coalesce(d.legacy_id,d.id::text)
      and j.external_cash_flow is true
  ) paid on true
  where d.tenant_id=v_tenant
    and d.source_active is distinct from false
    and d.status<>'Cancelled'
    and d."timestamp" between p_from and p_to
    and (p_branch_id is null or d.branch_id=p_branch_id)
    and private.can_read_branch(v_tenant,d.branch_id)
    and private.has_branch_permission(v_tenant,d.branch_id,'cashandbank.read');

  -- Dedicated delivery financial lines, plus spending whose normalized
  -- expense category explicitly identifies delivery. Both are existing
  -- treasury postings, including reversals. No joins to sales revenue.
  with movements as (
    select l.id,l.account_id,l.branch_id,l.currency,l.signed_amount,
      j.id as journal_id,j.source_id,j.source_type,j.journal_type,
      j.posted_at,j.description,j.external_cash_flow,
      a.account_name,
      case when j.source_type='delivery' then 'delivery'
           else 'delivery_expense' end as kind
    from public.treasury_journal_lines l
    join public.treasury_journals j
      on j.tenant_id=l.tenant_id and j.id=l.journal_id
    join public.branch_payment_accounts a
      on a.tenant_id=l.tenant_id and a.branch_id=l.branch_id and a.id=l.account_id
    left join public.expenses e
      on e.tenant_id=j.tenant_id
      and (e.legacy_id=j.source_id or e.id::text=j.source_id)
    where l.tenant_id=v_tenant and j.posted_at between p_from and p_to
      and j.external_cash_flow is true
      and (
        j.source_type='delivery' or
        (j.source_type='expense' and lower(btrim(coalesce(e.category,''))) in
          ('delivery expense','delivery maintainance','delivery maintenance'))
      )
      and (p_branch_id is null or l.branch_id=p_branch_id)
      and private.can_read_branch(v_tenant,l.branch_id)
      and private.has_branch_permission(v_tenant,l.branch_id,'cashandbank.read')
  )
  select jsonb_build_object(
    'collections',coalesce(sum(signed_amount) filter(
       where kind='delivery' and signed_amount>0),0),
    'refunds',coalesce(sum(-signed_amount) filter(
       where kind='delivery' and signed_amount<0),0),
    'collectedNet',coalesce(sum(signed_amount) filter(
       where kind='delivery'),0),
    'expensesPaid',coalesce(sum(-signed_amount) filter(
       where kind='delivery_expense' and signed_amount<0),0),
    'expensesReversed',coalesce(sum(signed_amount) filter(
       where kind='delivery_expense' and signed_amount>0),0),
    'netCashFlow',coalesce(sum(signed_amount),0),
    'collectionEntries',count(*) filter(
       where kind='delivery' and signed_amount>0)
  ) into v_money_stats from movements;

  with movements as (
    select l.account_id,l.currency,l.signed_amount,a.account_name,
      case when j.source_type='delivery' then 'delivery'
           else 'delivery_expense' end as kind
    from public.treasury_journal_lines l
    join public.treasury_journals j
      on j.tenant_id=l.tenant_id and j.id=l.journal_id
    join public.branch_payment_accounts a
      on a.tenant_id=l.tenant_id and a.branch_id=l.branch_id and a.id=l.account_id
    left join public.expenses e
      on e.tenant_id=j.tenant_id
      and (e.legacy_id=j.source_id or e.id::text=j.source_id)
    where l.tenant_id=v_tenant and j.posted_at between p_from and p_to
      and j.external_cash_flow is true
      and (j.source_type='delivery'
        or (j.source_type='expense' and lower(btrim(coalesce(e.category,''))) in
          ('delivery expense','delivery maintainance','delivery maintenance')))
      and (p_branch_id is null or l.branch_id=p_branch_id)
      and private.can_read_branch(v_tenant,l.branch_id)
      and private.has_branch_permission(v_tenant,l.branch_id,'cashandbank.read')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'accountId',x.account_id,'accountName',x.account_name,'currency',x.currency,
    'collections',x.collections,'refunds',x.refunds,'expenses',x.expenses,
    'net',x.net) order by x.account_name,x.account_id),'[]'::jsonb)
  into v_accounts
  from (
    select account_id,account_name,currency,
      coalesce(sum(signed_amount) filter(
        where kind='delivery' and signed_amount>0),0) collections,
      coalesce(sum(-signed_amount) filter(
        where kind='delivery' and signed_amount<0),0) refunds,
      coalesce(sum(-signed_amount) filter(
        where kind='delivery_expense'),0) expenses,
      coalesce(sum(signed_amount),0) net
    from movements
    group by account_id,account_name,currency
  ) x;

  with matched as (
    select l.id,l.account_id,l.branch_id,l.currency,l.signed_amount,
      j.id as journal_id,j.source_id,j.journal_type,j.posted_at,
      j.description,a.account_name,
      case when j.source_type='delivery' then 'delivery'
           else 'delivery_expense' end as kind
    from public.treasury_journal_lines l
    join public.treasury_journals j
      on j.tenant_id=l.tenant_id and j.id=l.journal_id
    join public.branch_payment_accounts a
      on a.tenant_id=l.tenant_id and a.branch_id=l.branch_id and a.id=l.account_id
    left join public.expenses e
      on e.tenant_id=j.tenant_id
      and (e.legacy_id=j.source_id or e.id::text=j.source_id)
    where l.tenant_id=v_tenant and j.posted_at between p_from and p_to
      and j.external_cash_flow is true
      and (j.source_type='delivery'
        or (j.source_type='expense' and lower(btrim(coalesce(e.category,''))) in
          ('delivery expense','delivery maintainance','delivery maintenance')))
      and (p_branch_id is null or l.branch_id=p_branch_id)
      and (p_after_at is null or (j.posted_at,l.id)<(p_after_at,p_after_line_id))
      and private.can_read_branch(v_tenant,l.branch_id)
      and private.has_branch_permission(v_tenant,l.branch_id,'cashandbank.read')
    order by j.posted_at desc,l.id desc
    limit v_limit+1
  )
  select count(*)::integer,coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'journalId',m.journal_id,'deliveryOrExpenseId',m.source_id,
    'kind',m.kind,'accountId',m.account_id,'accountName',m.account_name,
    'branchId',m.branch_id,'currency',m.currency,'amount',m.signed_amount,
    'postedAt',m.posted_at,'description',m.description,
    'journalType',m.journal_type) order by m.posted_at desc,m.id desc)
    filter(where m.row_idx<=v_limit),'[]'::jsonb)
  into v_row_count,v_entries
  from (select matched.*,row_number() over(order by posted_at desc,id desc) row_idx
        from matched) m;

  if v_row_count>v_limit and jsonb_array_length(v_entries)>0 then
    select jsonb_build_object(
      'postedAt',v_entries->(jsonb_array_length(v_entries)-1)->>'postedAt',
      'lineId',v_entries->(jsonb_array_length(v_entries)-1)->>'id')
    into v_cursor;
  end if;

  return jsonb_build_object(
    'operations',v_delivery_stats,'treasury',v_money_stats,
    'accounts',v_accounts,'entries',v_entries,
    'hasMore',v_row_count>v_limit,'nextCursor',v_cursor
  );
end;
$function$;
revoke all on function public.get_current_tenant_delivery_treasury_report(timestamptz,timestamptz,uuid,timestamptz,uuid,integer)
 from public,anon;
grant execute on function public.get_current_tenant_delivery_treasury_report(timestamptz,timestamptz,uuid,timestamptz,uuid,integer)
 to authenticated;
commit;
