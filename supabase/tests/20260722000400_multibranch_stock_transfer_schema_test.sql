-- Read-only structural verification for the Phase 3D stock-transfer migration.

begin;

set local statement_timeout = '15s';

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
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'required Phase 3D table is missing: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class
      where oid = to_regclass(format('public.%I', v_table))
        and relrowsecurity
        and relforcerowsecurity
    ) then
      raise exception 'RLS is not enabled and forced for %', v_table;
    end if;

    if has_table_privilege(
      'authenticated',
      format('public.%I', v_table),
      'SELECT,INSERT,UPDATE,DELETE'
    ) then
      raise exception 'dark-rollout transfer table is exposed: %', v_table;
    end if;
  end loop;

  if to_regprocedure('private.validate_inventory_transfer_route()') is null
    or to_regprocedure(
      'private.validate_inventory_transfer_status_transition()'
    ) is null
    or to_regprocedure(
      'private.record_inventory_transfer_status_history()'
    ) is null
    or to_regprocedure(
      'private.prevent_immutable_multibranch_event_change()'
    ) is null
  then
    raise exception 'one or more stock-transfer guard functions are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_inventory_transfers'::regclass
      and conname = 'branch_inventory_transfers_route_tenant_fkey'
      and contype = 'f'
  ) then
    raise exception 'tenant-safe source-branch FK is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_inventory_transfer_receipt_items'::regclass
      and conname = 'branch_inventory_receipt_items_transfer_item_fkey'
      and contype = 'f'
  ) then
    raise exception 'same-transfer receipt-item FK is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.branch_inventory_transfers'::regclass
      and tgname = 'branch_inventory_transfers_status_guard'
      and not tgisinternal
  ) then
    raise exception 'stock-transfer status transition guard is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.branch_inventory_transfer_status_history'::regclass
      and tgname = 'branch_inventory_transfer_history_immutable'
      and not tgisinternal
  ) then
    raise exception 'immutable transfer-history guard is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'branch_inventory_transfers'
      and indexname = 'branch_inventory_transfers_idempotency_uidx'
  ) then
    raise exception 'transfer idempotency index is missing';
  end if;
end;
$$;

rollback;
