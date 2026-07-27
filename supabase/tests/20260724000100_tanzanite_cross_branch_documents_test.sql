-- Read-only structural verification for Tanzanite cross-branch documents.

begin;

set local statement_timeout = '15s';

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'cross_branch_commercial_documents',
    'cross_branch_commercial_document_items',
    'cross_branch_sale_groups',
    'cross_branch_sales',
    'cross_branch_sale_items',
    'cross_branch_stock_movements'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'required Tanzanite table is missing: %', v_table;
    end if;

    if not exists (
      select 1 from pg_class
      where oid = to_regclass(format('public.%I', v_table))
        and relrowsecurity and relforcerowsecurity
    ) then
      raise exception 'RLS is not enabled and forced for %', v_table;
    end if;

    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT,UPDATE,DELETE') then
      raise exception 'direct mutation is exposed on %', v_table;
    end if;
  end loop;

  if to_regprocedure('public.list_cross_branch_document_sources()') is null
    or to_regprocedure('public.create_cross_branch_commercial_document(jsonb)') is null
    or to_regprocedure('public.convert_cross_branch_document_to_sales(uuid,text)') is null
  then
    raise exception 'one or more Tanzanite document RPCs are missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'cross_branch_commercial_documents'
      and indexname = 'cross_branch_documents_conversion_uidx'
  ) then
    raise exception 'conversion idempotency index is missing';
  end if;
end;
$$;

rollback;
