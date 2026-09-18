-- Additive purchase funding allocations.
-- Registered account deductions remain treasury-journal backed; External Account
-- is stored as an owner/external funding classification without an account FK.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create unique index if not exists purchases_tenant_id_uidx
  on public.purchases (tenant_id, id);

create table if not exists public.purchase_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  branch_id uuid not null,
  funding_type text not null,
  account_id uuid,
  account_name text not null,
  source_key text,
  currency text not null default 'TZS',
  amount numeric(18, 2) not null,
  reference text,
  treasury_journal_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint purchase_payment_allocations_funding_type_check
    check (funding_type in ('registered', 'external')),
  constraint purchase_payment_allocations_amount_check
    check (amount > 0),
  constraint purchase_payment_allocations_external_account_check
    check (
      (funding_type = 'external' and account_id is null and treasury_journal_id is null)
      or funding_type = 'registered'
    ),
  constraint purchase_payment_allocations_registered_account_check
    check (
      funding_type = 'external'
      or (account_id is not null and nullif(btrim(source_key), '') is not null)
    ),
  constraint purchase_payment_allocations_purchase_tenant_uidx
    unique (tenant_id, id),
  constraint purchase_payment_allocations_purchase_fkey
    foreign key (tenant_id, purchase_id)
    references public.purchases(tenant_id, id)
    on delete cascade,
  constraint purchase_payment_allocations_branch_fkey
    foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id)
    on delete restrict,
  constraint purchase_payment_allocations_account_fkey
    foreign key (tenant_id, account_id, branch_id, currency)
    references public.branch_payment_accounts(tenant_id, id, branch_id, currency)
    on delete restrict
);

create index if not exists purchase_payment_allocations_purchase_idx
  on public.purchase_payment_allocations (tenant_id, purchase_id, created_at, id);

create index if not exists purchase_payment_allocations_account_idx
  on public.purchase_payment_allocations (tenant_id, branch_id, account_id, created_at, id)
  where funding_type = 'registered';

create index if not exists purchase_payment_allocations_funding_type_idx
  on public.purchase_payment_allocations (tenant_id, branch_id, funding_type, created_at, id);

alter table public.purchase_payment_allocations enable row level security;
alter table public.purchase_payment_allocations force row level security;

drop policy if exists purchase_payment_allocations_tenant_branch_isolation
  on public.purchase_payment_allocations;
create policy purchase_payment_allocations_tenant_branch_isolation
  on public.purchase_payment_allocations
  for all to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.can_read_branch(tenant_id, branch_id)
  )
  with check (
    tenant_id = private.current_tenant_id()
    and private.can_write_branch(tenant_id, branch_id, 'products.write')
  );

revoke all on table public.purchase_payment_allocations from public, anon;
grant select, insert, update, delete on table public.purchase_payment_allocations to authenticated;

commit;
