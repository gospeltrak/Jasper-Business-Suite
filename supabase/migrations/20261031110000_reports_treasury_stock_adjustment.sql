-- Read-only reporting APIs plus an atomic manual-adjustment audit.
-- Existing treasury journals, branch stocks, products and tenant workspaces
-- are never updated/deleted/backfilled by this migration.
begin;

create table if not exists public.stock_adjustments (
  tenant_id uuid not null,
  id text not null,
  branch_id uuid,
  product_id text not null,
  product_name text not null,
  sku text,
  direction text not null check (direction in ('add','deduct')),
  qty numeric(14,4) not null check (qty > 0),
  previous_stock numeric(14,4) not null check (previous_stock >= 0),
  new_stock numeric(14,4) not null check (new_stock >= 0),
  reason text not null default '',
  performed_by uuid not null,
  performed_at timestamptz not null default now(),
  primary key (tenant_id,id)
);
create index if not exists stock_adjustments_tenant_branch_time
  on public.stock_adjustments (tenant_id,branch_id,performed_at desc);
alter table public.stock_adjustments enable row level security;
-- No direct Data API SELECT/INSERT/UPDATE/DELETE grants. All read/writes
-- use SECURITY DEFINER RPCs that check the current tenant + branch roles.
revoke all on public.stock_adjustments from public,anon,authenticated;

create or replace function public.get_current_tenant_treasury_report(
  p_from timestamptz, p_to timestamptz, p_branch_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = ''
as $body$
declare
  v_tenant uuid := (select private.current_tenant_id());
  v_accounts jsonb;
  v_entries jsonb;
begin
  if v_tenant is null or (select auth.uid()) is null then
    raise exception using errcode='42501', message='An active tenant session is required.';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode='22023', message='Choose a valid reporting date range.';
  end if;
  if p_branch_id is not null
    and (not private.can_read_branch(v_tenant,p_branch_id)
      or not private.has_branch_permission(v_tenant,p_branch_id,'cashandbank.read')) then
    raise exception using errcode='42501', message='You cannot view this branch money report.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'accountId',a.id, 'sourceKey',a.source_key,
    'branchId',a.branch_id, 'name',a.account_name,
    'accountType',a.account_type, 'provider',a.provider_name,
    'maskedReference',a.masked_reference,
    'currency',a.currency, 'status',a.status,
    'currentBalance',b.current_balance
  ) order by a.account_name,a.id), '[]'::jsonb)
  into v_accounts
  from public.branch_payment_accounts a
  left join public.branch_account_balances b on
    b.tenant_id=a.tenant_id and b.branch_id=a.branch_id
    and b.account_id=a.id and b.currency=a.currency
  where a.tenant_id=v_tenant
    and (p_branch_id is null or a.branch_id=p_branch_id)
    and private.can_read_branch(v_tenant,a.branch_id)
    and private.has_branch_permission(v_tenant,a.branch_id,'cashandbank.read');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id, 'journalId',j.id, 'accountId',l.account_id,
    'branchId',l.branch_id, 'amount',l.signed_amount,
    'balanceAfter',l.balance_after, 'currency',l.currency,
    'description',j.description,'sourceType',j.source_type,
    'referenceId',j.source_id,'journalType',j.journal_type,
    'postedAt',j.posted_at, 'externalCashFlow',j.external_cash_flow,
    'reversalOfJournalId',j.reversal_of_journal_id
  ) order by j.posted_at desc,l.id), '[]'::jsonb)
  into v_entries
  from public.treasury_journal_lines l
  join public.treasury_journals j
    on j.id=l.journal_id and j.tenant_id=l.tenant_id
  join public.branch_payment_accounts a
    on a.id=l.account_id and a.tenant_id=l.tenant_id and a.branch_id=l.branch_id
  where l.tenant_id=v_tenant
    and j.posted_at >= p_from and j.posted_at <= p_to
    and (p_branch_id is null or l.branch_id=p_branch_id)
    and private.can_read_branch(v_tenant,l.branch_id)
    and private.has_branch_permission(v_tenant,l.branch_id,'cashandbank.read');

  return jsonb_build_object('accounts',v_accounts,'entries',v_entries);
end;
$body$;

create or replace function public.get_current_tenant_stock_adjustments(
  p_from timestamptz, p_to timestamptz, p_branch_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = ''
as $body$
declare v_tenant uuid := (select private.current_tenant_id());
begin
  if v_tenant is null or (select auth.uid()) is null then
    raise exception using errcode='42501', message='An active tenant session is required.';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode='22023', message='Choose a valid reporting date range.';
  end if;
  if p_branch_id is not null
    and (not private.can_read_branch(v_tenant,p_branch_id)
      or not private.has_branch_permission(v_tenant,p_branch_id,'products.read')) then
    raise exception using errcode='42501', message='You cannot view this branch stock report.';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id, 'tenantId',s.tenant_id,'branchId',s.branch_id,
      'productId',s.product_id,'productName',s.product_name,'sku',s.sku,
      'type',s.direction,'qty',s.qty,
      'previousStock',s.previous_stock,'newStock',s.new_stock,
      'reason',s.reason,'adjustedAt',s.performed_at,
      'performedBy',s.performed_by, 'performedByName',coalesce(u.name,'')
    ) order by s.performed_at desc,s.id), '[]'::jsonb)
    from public.stock_adjustments s
    left join public.users u on u.id=s.performed_by and u.tenant_id=s.tenant_id
    where s.tenant_id=v_tenant
      and s.performed_at >= p_from and s.performed_at <= p_to
      and (p_branch_id is null or s.branch_id=p_branch_id)
      and (
        (s.branch_id is not null
         and private.can_read_branch(v_tenant,s.branch_id)
         and private.has_branch_permission(v_tenant,s.branch_id,'products.read'))
        or (s.branch_id is null and private.is_tenant_branch_administrator(v_tenant))
      )
  );
end;
$body$;

-- Execute the SAME existing product save inside a transaction as the audit
-- insertion. An audit failure rolls the product save back too. Ordinary
-- product edits keep using the original save_current_branch_products RPC.
create or replace function public.save_current_branch_products_with_adjustment(
  p_products jsonb,
  p_product_tombstones jsonb,
  p_branch_stocks jsonb,
  p_adjustment jsonb
) returns jsonb language plpgsql volatile security definer set search_path = ''
as $body$
declare
  v_tenant uuid := (select private.current_tenant_id());
  v_id text := nullif(btrim(p_adjustment->>'id'),'');
  v_product text := nullif(btrim(p_adjustment->>'productId'),'');
  v_branch uuid;
  v_qty numeric;
  v_previous numeric;
  v_after numeric;
  v_direction text := p_adjustment->>'type';
  v_context jsonb;
  v_snapshot jsonb;
  v_current_product jsonb;
  v_current_shop_qty numeric;
  v_result jsonb;
begin
  if v_tenant is null or (select auth.uid()) is null then
    raise exception using errcode='42501', message='An active tenant session is required.';
  end if;
  if p_adjustment is null or jsonb_typeof(p_adjustment)<>'object'
    or v_id is null or length(v_id)>128 or v_product is null
    or v_direction is null or v_direction not in ('add','deduct') then
    raise exception using errcode='22023', message='A valid manual stock adjustment is required.';
  end if;
  if nullif(p_adjustment->>'tenantId','') is not null
    and (p_adjustment->>'tenantId')::uuid<>v_tenant then
    raise exception using errcode='42501', message='Stock adjustment tenant mismatch.';
  end if;
  v_branch := nullif(p_adjustment->>'branchId','')::uuid;
  if v_branch is not null
    and not private.can_write_branch(v_tenant,v_branch,'products.write') then
    raise exception using errcode='42501',message='You cannot adjust stock in this branch.';
  end if;
  v_qty := (p_adjustment->>'qty')::numeric;
  v_previous := (p_adjustment->>'previousStock')::numeric;
  v_after := (p_adjustment->>'newStock')::numeric;
  if v_qty is null or v_qty<=0 or v_previous is null or v_previous<0
    or v_after is null or v_after<0
    or abs(v_after - v_previous - (case when v_direction='add' then v_qty else -v_qty end))>0.0001 then
    raise exception using errcode='22023', message='Stock adjustment quantities do not reconcile.';
  end if;
  -- Compare the submitted prior stock against the durable, branch-scoped
  -- snapshot WHILE holding the tenant workspace row lock. This protects
  -- against a stale tablet overwriting another staff member's newer stock.
  v_context := public.get_current_branch_context();
  if v_branch is distinct from nullif(v_context->>'activeBranchId','')::uuid then
    raise exception using errcode='42501',
      message='The stock adjustment branch must match the selected workspace.';
  end if;
  perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
  if private.normalized_writes_enabled(v_tenant) then
    v_snapshot := private.normalized_mutation_snapshot(v_tenant,array['products']);
  else
    select payload into v_snapshot from public.tenant_workspaces where tenant_id=v_tenant;
  end if;
  select item into v_current_product
  from jsonb_array_elements(coalesce(v_snapshot->'products','[]'::jsonb)) source(item)
  where item->>'id'=v_product
  limit 1;
  if v_current_product is null then
    raise exception using errcode='23514',
      message='The selected product is not in the active branch. Refresh and try again.';
  end if;
  v_current_shop_qty := coalesce(
    nullif(v_current_product->>'shopStockQty','')::numeric,
    coalesce(nullif(v_current_product->>'stockQty','')::numeric,0)
      - coalesce(nullif(v_current_product->>'storeStockQty','')::numeric,0)
  );
  if v_current_shop_qty is null or abs(v_current_shop_qty-v_previous)>0.0001 then
    raise exception using errcode='40001',
      message='Stock changed since this adjustment started. Refresh and try again.';
  end if;

  -- A repeated request key must never write stock twice.
  if exists(select 1 from public.stock_adjustments
    where tenant_id=v_tenant and id=v_id) then
    raise exception using errcode='23505',message='This stock adjustment has already been recorded.';
  end if;

  if p_branch_stocks is null then
    v_result := public.save_current_branch_products(p_products,p_product_tombstones);
  else
    v_result := public.save_current_branch_products(p_products,p_product_tombstones,p_branch_stocks);
  end if;
  if jsonb_typeof(v_result->'products')<>'array'
    or not exists(
      select 1 from jsonb_array_elements(v_result->'products') p
      where p->>'id'=v_product
      and nullif(p->>'shopStockQty','')::numeric=v_after
    ) then
    raise exception using errcode='23514',message='Stock save and audit quantities did not match.';
  end if;

  insert into public.stock_adjustments (
    tenant_id,id,branch_id,product_id,product_name,sku,direction,qty,
    previous_stock,new_stock,reason,performed_by
  ) values (
    v_tenant,v_id,v_branch,v_product,
    coalesce(nullif(btrim(p_adjustment->>'productName'),''),'Unknown Product'),
    nullif(p_adjustment->>'sku',''),v_direction,v_qty,v_previous,v_after,
    left(coalesce(p_adjustment->>'reason',''),1000),(select auth.uid())
  );
  return v_result;
end;
$body$;

revoke all on function public.get_current_tenant_treasury_report(timestamptz,timestamptz,uuid)
 from public,anon;
grant execute on function public.get_current_tenant_treasury_report(timestamptz,timestamptz,uuid)
 to authenticated;
revoke all on function public.get_current_tenant_stock_adjustments(timestamptz,timestamptz,uuid)
 from public,anon;
grant execute on function public.get_current_tenant_stock_adjustments(timestamptz,timestamptz,uuid)
 to authenticated;
revoke all on function public.save_current_branch_products_with_adjustment(jsonb,jsonb,jsonb,jsonb)
 from public,anon;
grant execute on function public.save_current_branch_products_with_adjustment(jsonb,jsonb,jsonb,jsonb)
 to authenticated;
commit;