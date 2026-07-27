-- Multi-branch Phase 3D: evolve the existing inventory-transfer table into a
-- multi-item workflow header and add receipts, discrepancies, attachments, and
-- immutable status history.
--
-- No transfer, product, stock, warehouse, branch, or tenant row is inserted,
-- updated, deleted, or backfilled. Atomic stock posting remains disabled until
-- the later stock-transfer implementation phase installs audited RPCs.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Keep legacy product_id/quantity columns readable while allowing new headers
-- to store their products in normalized line items.
alter table public.branch_inventory_transfers
  alter column product_id drop not null,
  alter column quantity drop not null;

alter table public.branch_inventory_transfers
  add column if not exists transfer_number text,
  add column if not exists source_warehouse_id uuid,
  add column if not exists destination_warehouse_id uuid,
  add column if not exists transfer_date timestamptz,
  add column if not exists expected_delivery_date timestamptz,
  add column if not exists requested_by uuid references public.users(id) on delete set null,
  add column if not exists rejected_by uuid references public.users(id) on delete set null,
  add column if not exists dispatched_by uuid references public.users(id) on delete set null,
  add column if not exists cancelled_by uuid references public.users(id) on delete set null,
  add column if not exists requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists dispatched_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists supporting_document_url text,
  add column if not exists idempotency_key text;

alter table public.branch_inventory_transfers
  alter column transfer_date set default now();

do $$
begin
  -- Broaden the legacy status vocabulary without invalidating old statuses.
  if exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_status_check'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      drop constraint branch_inventory_transfers_status_check;
  end if;

  alter table public.branch_inventory_transfers
    add constraint branch_inventory_transfers_status_check
    check (
      status in (
        'draft',
        'pending',
        'requested',
        'approved',
        'rejected',
        'dispatched',
        'in_transit',
        'partially_received',
        'received',
        'cancelled'
      )
    ) not valid;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_route_tenant_fkey'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      add constraint branch_inventory_transfers_route_tenant_fkey
      foreign key (tenant_id, from_branch_id)
      references public.branches(tenant_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_destination_tenant_fkey'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      add constraint branch_inventory_transfers_destination_tenant_fkey
      foreign key (tenant_id, to_branch_id)
      references public.branches(tenant_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_source_warehouse_fkey'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      add constraint branch_inventory_transfers_source_warehouse_fkey
      foreign key (tenant_id, source_warehouse_id)
      references public.warehouses(tenant_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_destination_warehouse_fkey'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      add constraint branch_inventory_transfers_destination_warehouse_fkey
      foreign key (tenant_id, destination_warehouse_id)
      references public.warehouses(tenant_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_distinct_branches_check'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      add constraint branch_inventory_transfers_distinct_branches_check
      check (from_branch_id <> to_branch_id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_legacy_item_check'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      add constraint branch_inventory_transfers_legacy_item_check
      check (
        (product_id is null and quantity is null)
        or (product_id is not null and quantity > 0)
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_inventory_transfers_workflow_fields_check'
      and conrelid = 'public.branch_inventory_transfers'::regclass
  ) then
    alter table public.branch_inventory_transfers
      add constraint branch_inventory_transfers_workflow_fields_check
      check (
        status = 'draft'
        or (
          nullif(btrim(transfer_number), '') is not null
          and nullif(btrim(idempotency_key), '') is not null
          and transfer_date is not null
          and source_warehouse_id is not null
          and destination_warehouse_id is not null
        )
      )
      not valid;
  end if;
end;
$$;

create unique index if not exists branch_inventory_transfers_tenant_id_id_uidx
  on public.branch_inventory_transfers (tenant_id, id);

create unique index if not exists branch_inventory_transfers_number_uidx
  on public.branch_inventory_transfers (tenant_id, transfer_number)
  where transfer_number is not null;

create unique index if not exists branch_inventory_transfers_idempotency_uidx
  on public.branch_inventory_transfers (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists branch_inventory_transfers_source_queue_idx
  on public.branch_inventory_transfers (
    tenant_id,
    from_branch_id,
    status,
    created_at desc
  );

create index if not exists branch_inventory_transfers_destination_queue_idx
  on public.branch_inventory_transfers (
    tenant_id,
    to_branch_id,
    status,
    created_at desc
  );

create table if not exists public.branch_inventory_transfer_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid not null,
  line_number integer not null,
  product_id text not null,
  variant_ref text,
  batch_ref text,
  quantity_requested numeric(14, 4) not null,
  quantity_approved numeric(14, 4) not null default 0,
  quantity_dispatched numeric(14, 4) not null default 0,
  quantity_received numeric(14, 4) not null default 0,
  quantity_damaged numeric(14, 4) not null default 0,
  quantity_missing numeric(14, 4) not null default 0,
  unit text,
  unit_cost numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_inventory_transfer_items_header_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_inventory_transfers(tenant_id, id)
    on delete restrict,
  constraint branch_inventory_transfer_items_line_check
    check (line_number > 0),
  constraint branch_inventory_transfer_items_quantities_check
    check (
      quantity_requested > 0
      and quantity_approved >= 0
      and quantity_dispatched >= 0
      and quantity_received >= 0
      and quantity_damaged >= 0
      and quantity_missing >= 0
      and quantity_approved <= quantity_requested
      and quantity_dispatched <= quantity_approved
      and (
        quantity_received + quantity_damaged + quantity_missing
      ) <= quantity_dispatched
      and (unit_cost is null or unit_cost >= 0)
    ),
  unique (tenant_id, transfer_id, line_number)
);

create unique index if not exists branch_inventory_transfer_items_tenant_id_id_uidx
  on public.branch_inventory_transfer_items (tenant_id, id);

create unique index if not exists branch_inventory_transfer_items_header_id_uidx
  on public.branch_inventory_transfer_items (tenant_id, id, transfer_id);

create index if not exists branch_inventory_transfer_items_product_idx
  on public.branch_inventory_transfer_items (
    tenant_id,
    product_id,
    transfer_id
  );

create table if not exists public.branch_inventory_transfer_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid not null,
  receipt_number text not null,
  received_by uuid references public.users(id) on delete set null,
  received_at timestamptz not null default now(),
  notes text,
  attachment_url text,
  signature_url text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint branch_inventory_transfer_receipts_header_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_inventory_transfers(tenant_id, id)
    on delete restrict,
  unique (tenant_id, receipt_number),
  unique (tenant_id, idempotency_key)
);

create unique index if not exists branch_inventory_transfer_receipts_tenant_id_id_uidx
  on public.branch_inventory_transfer_receipts (tenant_id, id);

create unique index if not exists branch_inventory_transfer_receipts_header_id_uidx
  on public.branch_inventory_transfer_receipts (tenant_id, id, transfer_id);

create index if not exists branch_inventory_transfer_receipts_header_idx
  on public.branch_inventory_transfer_receipts (
    tenant_id,
    transfer_id,
    received_at desc
  );

create table if not exists public.branch_inventory_transfer_receipt_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  receipt_id uuid not null,
  transfer_id uuid not null,
  transfer_item_id uuid not null,
  quantity_received numeric(14, 4) not null default 0,
  quantity_damaged numeric(14, 4) not null default 0,
  quantity_missing numeric(14, 4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint branch_inventory_receipt_items_receipt_fkey
    foreign key (tenant_id, receipt_id, transfer_id)
    references public.branch_inventory_transfer_receipts(tenant_id, id, transfer_id)
    on delete restrict,
  constraint branch_inventory_receipt_items_transfer_item_fkey
    foreign key (tenant_id, transfer_item_id, transfer_id)
    references public.branch_inventory_transfer_items(tenant_id, id, transfer_id)
    on delete restrict,
  constraint branch_inventory_receipt_items_quantity_check
    check (
      quantity_received >= 0
      and quantity_damaged >= 0
      and quantity_missing >= 0
      and (
        quantity_received + quantity_damaged + quantity_missing
      ) > 0
    ),
  unique (tenant_id, receipt_id, transfer_item_id)
);

create index if not exists branch_inventory_receipt_items_transfer_idx
  on public.branch_inventory_transfer_receipt_items (
    tenant_id,
    transfer_id,
    transfer_item_id,
    receipt_id
  );

create unique index if not exists branch_inventory_receipt_items_transfer_id_uidx
  on public.branch_inventory_transfer_receipt_items (
    tenant_id,
    id,
    transfer_id
  );

create table if not exists public.branch_inventory_transfer_discrepancies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid not null,
  transfer_item_id uuid,
  receipt_item_id uuid,
  discrepancy_type text not null,
  quantity numeric(14, 4) not null,
  resolution_status text not null default 'open',
  notes text,
  reported_by uuid references public.users(id) on delete set null,
  resolved_by uuid references public.users(id) on delete set null,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branch_inventory_discrepancies_header_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_inventory_transfers(tenant_id, id)
    on delete restrict,
  constraint branch_inventory_discrepancies_item_fkey
    foreign key (tenant_id, transfer_item_id, transfer_id)
    references public.branch_inventory_transfer_items(tenant_id, id, transfer_id)
    on delete restrict,
  constraint branch_inventory_discrepancies_receipt_item_fkey
    foreign key (tenant_id, receipt_item_id, transfer_id)
    references public.branch_inventory_transfer_receipt_items(tenant_id, id, transfer_id)
    on delete restrict,
  constraint branch_inventory_discrepancies_type_check
    check (discrepancy_type in ('damaged', 'missing', 'overage', 'wrong_item', 'other')),
  constraint branch_inventory_discrepancies_status_check
    check (resolution_status in ('open', 'investigating', 'resolved', 'rejected')),
  constraint branch_inventory_discrepancies_values_check
    check (
      quantity > 0
      and (transfer_item_id is not null or receipt_item_id is not null)
      and (
        (resolution_status in ('open', 'investigating') and resolved_at is null)
        or (resolution_status in ('resolved', 'rejected') and resolved_at is not null)
      )
    )
);

create index if not exists branch_inventory_discrepancies_queue_idx
  on public.branch_inventory_transfer_discrepancies (
    tenant_id,
    resolution_status,
    reported_at desc
  );

create table if not exists public.branch_inventory_transfer_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid not null,
  attachment_type text not null default 'supporting_document',
  file_url text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint branch_inventory_transfer_attachments_header_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_inventory_transfers(tenant_id, id)
    on delete restrict,
  constraint branch_inventory_transfer_attachments_type_check
    check (attachment_type in ('supporting_document', 'dispatch_proof', 'receipt_proof', 'signature', 'other')),
  constraint branch_inventory_transfer_attachments_size_check
    check (size_bytes is null or size_bytes >= 0)
);

create index if not exists branch_inventory_transfer_attachments_header_idx
  on public.branch_inventory_transfer_attachments (
    tenant_id,
    transfer_id,
    created_at desc
  );

create table if not exists public.branch_inventory_transfer_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transfer_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint branch_inventory_transfer_history_header_fkey
    foreign key (tenant_id, transfer_id)
    references public.branch_inventory_transfers(tenant_id, id)
    on delete restrict
);

create index if not exists branch_inventory_transfer_history_header_idx
  on public.branch_inventory_transfer_status_history (
    tenant_id,
    transfer_id,
    created_at
  );

create or replace function private.validate_inventory_transfer_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_branch_sharing_allowed(
    new.tenant_id,
    new.to_branch_id,
    new.from_branch_id
  );

  if (new.source_warehouse_id is null) <> (new.destination_warehouse_id is null) then
    raise exception 'Source and destination warehouses must be supplied together.'
      using errcode = '23514';
  end if;

  if new.source_warehouse_id is not null and not exists (
    select 1
    from public.branch_warehouse_links as warehouse_link
    where warehouse_link.tenant_id = new.tenant_id
      and warehouse_link.branch_id = new.from_branch_id
      and warehouse_link.warehouse_id = new.source_warehouse_id
  ) then
    raise exception 'Source warehouse is not linked to the source branch.'
      using errcode = '23514';
  end if;

  if new.destination_warehouse_id is not null and not exists (
    select 1
    from public.branch_warehouse_links as warehouse_link
    where warehouse_link.tenant_id = new.tenant_id
      and warehouse_link.branch_id = new.to_branch_id
      and warehouse_link.warehouse_id = new.destination_warehouse_id
  ) then
    raise exception 'Destination warehouse is not linked to the destination branch.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_inventory_transfer_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('pending', 'requested', 'cancelled'))
    or (old.status in ('pending', 'requested') and new.status in ('approved', 'rejected', 'cancelled'))
    or (old.status = 'approved' and new.status in ('dispatched', 'in_transit', 'cancelled'))
    or (old.status = 'dispatched' and new.status in ('in_transit', 'partially_received', 'received'))
    or (old.status = 'in_transit' and new.status in ('partially_received', 'received'))
    or (old.status = 'partially_received' and new.status = 'received')
  ) then
    raise exception 'Invalid inventory-transfer status transition: % -> %',
      old.status,
      new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.record_inventory_transfer_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.branch_inventory_transfer_status_history (
      tenant_id,
      transfer_id,
      from_status,
      to_status,
      changed_by,
      metadata
    )
    values (
      new.tenant_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      coalesce((select auth.uid()), new.created_by),
      jsonb_build_object('source', 'database_trigger')
    );
  end if;

  return new;
end;
$$;

create or replace function private.prevent_immutable_multibranch_event_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'This finalized branch workflow record is immutable.'
    using errcode = '55000';
end;
$$;

drop trigger if exists branch_inventory_transfers_updated_at
  on public.branch_inventory_transfers;
create trigger branch_inventory_transfers_updated_at
before update on public.branch_inventory_transfers
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_inventory_transfer_items_updated_at
  on public.branch_inventory_transfer_items;
create trigger branch_inventory_transfer_items_updated_at
before update on public.branch_inventory_transfer_items
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_inventory_discrepancies_updated_at
  on public.branch_inventory_transfer_discrepancies;
create trigger branch_inventory_discrepancies_updated_at
before update on public.branch_inventory_transfer_discrepancies
for each row execute function private.set_multibranch_updated_at();

drop trigger if exists branch_inventory_transfers_route_guard
  on public.branch_inventory_transfers;
create trigger branch_inventory_transfers_route_guard
before insert or update of tenant_id, from_branch_id, to_branch_id,
  source_warehouse_id, destination_warehouse_id, status
on public.branch_inventory_transfers
for each row execute function private.validate_inventory_transfer_route();

drop trigger if exists branch_inventory_transfers_status_guard
  on public.branch_inventory_transfers;
create trigger branch_inventory_transfers_status_guard
before update of status on public.branch_inventory_transfers
for each row execute function private.validate_inventory_transfer_status_transition();

drop trigger if exists branch_inventory_transfers_status_history
  on public.branch_inventory_transfers;
create trigger branch_inventory_transfers_status_history
after insert or update of status on public.branch_inventory_transfers
for each row execute function private.record_inventory_transfer_status_history();

drop trigger if exists branch_inventory_transfer_history_immutable
  on public.branch_inventory_transfer_status_history;
create trigger branch_inventory_transfer_history_immutable
before update on public.branch_inventory_transfer_status_history
for each row execute function private.prevent_immutable_multibranch_event_change();

drop trigger if exists branch_inventory_transfer_receipts_immutable
  on public.branch_inventory_transfer_receipts;
create trigger branch_inventory_transfer_receipts_immutable
before update on public.branch_inventory_transfer_receipts
for each row execute function private.prevent_immutable_multibranch_event_change();

drop trigger if exists branch_inventory_receipt_items_immutable
  on public.branch_inventory_transfer_receipt_items;
create trigger branch_inventory_receipt_items_immutable
before update on public.branch_inventory_transfer_receipt_items
for each row execute function private.prevent_immutable_multibranch_event_change();

-- New workflow child tables are server/RPC-only until the Phase 7 atomic
-- posting functions and Phase 4 branch-aware APIs are ready.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'branch_inventory_transfer_items',
    'branch_inventory_transfer_receipts',
    'branch_inventory_transfer_receipt_items',
    'branch_inventory_transfer_discrepancies',
    'branch_inventory_transfer_attachments',
    'branch_inventory_transfer_status_history'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

revoke all on function private.validate_inventory_transfer_route() from public;
revoke all on function private.validate_inventory_transfer_status_transition() from public;
revoke all on function private.record_inventory_transfer_status_history() from public;
revoke all on function private.prevent_immutable_multibranch_event_change() from public;

commit;
