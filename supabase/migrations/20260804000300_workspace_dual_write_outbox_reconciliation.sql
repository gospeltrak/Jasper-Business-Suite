-- Dormant dual-write outbox and exact reconciliation metrics.
-- No tenant is enrolled and no production read path changes in this migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create table if not exists public.workspace_normalization_outbox (
  tenant_id uuid primary key references public.tenants(id) on delete restrict,
  workspace_updated_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_normalization_outbox_ready_idx
  on public.workspace_normalization_outbox (available_at, requested_at, tenant_id)
  where status in ('pending', 'failed');

alter table public.workspace_normalization_outbox enable row level security;
alter table public.workspace_normalization_outbox force row level security;
revoke all on table public.workspace_normalization_outbox
  from public, anon, authenticated, service_role;
grant select, insert, update
  on table public.workspace_normalization_outbox
  to service_role;

create or replace function private.safe_numeric(p_value text)
returns numeric
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  return p_value::numeric;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return 0;
end;
$$;

create or replace function private.queue_workspace_normalization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.workspace_migration_state state
    where state.tenant_id = new.tenant_id
      and state.dual_write_enabled
      and state.read_mode in ('legacy', 'shadow')
  ) then
    insert into public.workspace_normalization_outbox (
      tenant_id,
      workspace_updated_at,
      status,
      attempts,
      available_at,
      locked_at,
      locked_by,
      last_error,
      requested_at,
      updated_at
    )
    values (
      new.tenant_id,
      new.updated_at,
      'pending',
      0,
      statement_timestamp(),
      null,
      null,
      '{}'::jsonb,
      statement_timestamp(),
      statement_timestamp()
    )
    on conflict (tenant_id) do update
    set workspace_updated_at = excluded.workspace_updated_at,
        status = 'pending',
        attempts = 0,
        available_at = excluded.available_at,
        locked_at = null,
        locked_by = null,
        last_error = '{}'::jsonb,
        requested_at = excluded.requested_at,
        updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_workspace_normalization_after_write
  on public.tenant_workspaces;
create trigger queue_workspace_normalization_after_write
after insert or update of payload, updated_at
on public.tenant_workspaces
for each row
execute function private.queue_workspace_normalization();

create or replace function public.reconcile_workspace_normalization(
  p_tenant_id uuid,
  p_batch_id uuid default null
)
returns public.workspace_reconciliation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace public.tenant_workspaces%rowtype;
  v_version text;
  v_source_counts jsonb;
  v_target_counts jsonb;
  v_source_totals jsonb;
  v_target_totals jsonb;
  v_mismatches jsonb;
  v_is_match boolean;
  v_result public.workspace_reconciliation_runs%rowtype;
begin
  select *
  into v_workspace
  from public.tenant_workspaces
  where tenant_id = p_tenant_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.';
  end if;

  select coalesce(state.migration_version, 'workspace-normalization-v1')
  into v_version
  from public.workspace_migration_state state
  where state.tenant_id = p_tenant_id;
  v_version := coalesce(v_version, 'workspace-normalization-v1');

  select jsonb_build_object(
    'products', jsonb_array_length(coalesce(v_workspace.payload -> 'products', '[]'::jsonb)),
    'sales', jsonb_array_length(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)),
    'saleItems', coalesce((
      select sum(jsonb_array_length(coalesce(item -> 'items', '[]'::jsonb)))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item
    ), 0),
    'expenses', jsonb_array_length(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb)),
    'deliveries', jsonb_array_length(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)),
    'purchases', jsonb_array_length(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)),
    'purchaseItems', coalesce((
      select sum(jsonb_array_length(coalesce(item -> 'items', '[]'::jsonb)))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item
    ), 0)
  )
  into v_source_counts;

  select jsonb_build_object(
    'products', (select count(*) from public.products where tenant_id = p_tenant_id),
    'sales', (select count(*) from public.sales where tenant_id = p_tenant_id),
    'saleItems', (select count(*) from public.sale_items where tenant_id = p_tenant_id),
    'expenses', (select count(*) from public.expenses where tenant_id = p_tenant_id),
    'deliveries', (select count(*) from public.deliveries where tenant_id = p_tenant_id),
    'purchases', (select count(*) from public.purchases where tenant_id = p_tenant_id),
    'purchaseItems', (select count(*) from public.purchase_items where tenant_id = p_tenant_id)
  )
  into v_target_counts;

  select jsonb_build_object(
    'salesTotal', coalesce((
      select sum(private.safe_numeric(item ->> 'total'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item
    ), 0),
    'salesTax', coalesce((
      select sum(private.safe_numeric(item ->> 'tax'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item
    ), 0),
    'salesPaid', coalesce((
      select sum(private.safe_numeric(item ->> 'amountPaid'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item
    ), 0),
    'salesDue', coalesce((
      select sum(private.safe_numeric(item ->> 'amountDue'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item
    ), 0),
    'expenseAmount', coalesce((
      select sum(private.safe_numeric(item ->> 'amount'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb)) item
    ), 0),
    'deliveryTotal', coalesce((
      select sum(private.safe_numeric(item ->> 'totalAmount'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)) item
    ), 0),
    'deliveryCost', coalesce((
      select sum(private.safe_numeric(item ->> 'deliveryCost'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)) item
    ), 0),
    'purchaseTotal', coalesce((
      select sum(private.safe_numeric(item ->> 'totalAmount'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item
    ), 0),
    'purchasePaid', coalesce((
      select sum(private.safe_numeric(item ->> 'amountPaid'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item
    ), 0),
    'purchaseDue', coalesce((
      select sum(private.safe_numeric(item ->> 'amountDue'))
      from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item
    ), 0)
  )
  into v_source_totals;

  select jsonb_build_object(
    'salesTotal', coalesce((select sum(total) from public.sales where tenant_id = p_tenant_id), 0),
    'salesTax', coalesce((select sum(tax) from public.sales where tenant_id = p_tenant_id), 0),
    'salesPaid', coalesce((select sum(amount_paid) from public.sales where tenant_id = p_tenant_id), 0),
    'salesDue', coalesce((select sum(amount_due) from public.sales where tenant_id = p_tenant_id), 0),
    'expenseAmount', coalesce((select sum(amount) from public.expenses where tenant_id = p_tenant_id), 0),
    'deliveryTotal', coalesce((select sum(total_amount) from public.deliveries where tenant_id = p_tenant_id), 0),
    'deliveryCost', coalesce((select sum(delivery_cost) from public.deliveries where tenant_id = p_tenant_id), 0),
    'purchaseTotal', coalesce((select sum(total_amount) from public.purchases where tenant_id = p_tenant_id), 0),
    'purchasePaid', coalesce((select sum(amount_paid) from public.purchases where tenant_id = p_tenant_id), 0),
    'purchaseDue', coalesce((select sum(amount_due) from public.purchases where tenant_id = p_tenant_id), 0)
  )
  into v_target_totals;

  v_mismatches := jsonb_strip_nulls(jsonb_build_object(
    'counts', case when v_source_counts is distinct from v_target_counts
      then jsonb_build_object('source', v_source_counts, 'target', v_target_counts) end,
    'totals', case when v_source_totals is distinct from v_target_totals
      then jsonb_build_object('source', v_source_totals, 'target', v_target_totals) end
  ));
  v_is_match := v_mismatches = '{}'::jsonb;

  insert into public.workspace_reconciliation_runs (
    batch_id,
    tenant_id,
    migration_version,
    source_updated_at,
    source_counts,
    target_counts,
    source_totals,
    target_totals,
    mismatch_details,
    is_match
  )
  values (
    p_batch_id,
    p_tenant_id,
    v_version,
    v_workspace.updated_at,
    v_source_counts,
    v_target_counts,
    v_source_totals,
    v_target_totals,
    v_mismatches,
    v_is_match
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.reconcile_workspace_normalization(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reconcile_workspace_normalization(uuid, uuid)
  to service_role;

commit;
