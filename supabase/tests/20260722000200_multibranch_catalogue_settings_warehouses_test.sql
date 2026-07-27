-- Read-only structural verification for the Phase 3B migration.
-- Run only after the Phase 3A and Phase 3B migrations.

begin;

set local statement_timeout = '15s';

do $$
declare
  v_table text;
  v_required_tables constant text[] := array[
    'branch_settings',
    'branch_product_links',
    'branch_product_prices',
    'warehouses',
    'branch_warehouse_links',
    'warehouse_stock',
    'branch_supplier_links',
    'branch_customer_links',
    'branch_payment_channel_configs'
  ];
begin
  foreach v_table in array v_required_tables
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'required Phase 3B table is missing: %', v_table;
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

    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
      or has_table_privilege(
        'authenticated',
        format('public.%I', v_table),
        'SELECT,INSERT,UPDATE,DELETE'
      )
    then
      raise exception 'dark-rollout table is exposed to browser roles: %', v_table;
    end if;
  end loop;

  if to_regprocedure('private.set_multibranch_updated_at()') is null
    or to_regprocedure(
      'private.assert_branch_sharing_allowed(uuid,uuid,uuid)'
    ) is null
    or to_regprocedure('private.validate_branch_source_sharing()') is null
    or to_regprocedure('private.validate_branch_warehouse_sharing()') is null
  then
    raise exception 'one or more Phase 3B guard functions are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_product_links'::regclass
      and conname = 'branch_product_links_branch_fkey'
      and contype = 'f'
  ) then
    raise exception 'tenant-safe product-link branch FK is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_warehouse_links'::regclass
      and conname = 'branch_warehouse_links_warehouse_fkey'
      and contype = 'f'
  ) then
    raise exception 'tenant-safe branch/warehouse FK is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'branch_warehouse_links'
      and indexname = 'branch_warehouse_one_primary_idx'
  ) then
    raise exception 'one-primary-warehouse-per-branch index is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.branch_product_links'::regclass
      and tgname = 'branch_product_links_sharing_guard'
      and not tgisinternal
  ) then
    raise exception 'product-sharing database guard is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.branch_warehouse_links'::regclass
      and tgname = 'branch_warehouse_links_sharing_guard'
      and not tgisinternal
  ) then
    raise exception 'warehouse-sharing database guard is missing';
  end if;
end;
$$;

rollback;
