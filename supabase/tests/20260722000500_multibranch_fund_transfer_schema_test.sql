-- Read-only structural verification for the Phase 3E fund-transfer migration.

begin;

set local statement_timeout = '15s';

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'branch_payment_accounts',
    'branch_account_balances',
    'branch_fund_requests',
    'branch_fund_request_status_history',
    'branch_money_transfer_status_history',
    'branch_fund_transfer_attachments',
    'branch_fund_transfer_journals',
    'branch_fund_transfer_journal_lines'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'required Phase 3E table is missing: %', v_table;
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
      raise exception 'dark-rollout financial table is exposed: %', v_table;
    end if;
  end loop;

  if to_regprocedure('private.validate_fund_request_route()') is null
    or to_regprocedure('private.validate_money_transfer_route()') is null
    or to_regprocedure(
      'private.validate_fund_request_status_transition()'
    ) is null
    or to_regprocedure(
      'private.validate_money_transfer_status_transition()'
    ) is null
    or to_regprocedure('private.validate_fund_transfer_journal()') is null
    or to_regprocedure(
      'private.validate_fund_transfer_journal_line()'
    ) is null
  then
    raise exception 'one or more Phase 3E financial guards are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_money_transfers'::regclass
      and conname = 'branch_money_transfers_source_account_fkey'
      and contype = 'f'
  ) then
    raise exception 'source branch/account consistency FK is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_fund_transfer_journal_lines'::regclass
      and conname = 'branch_fund_journal_lines_account_fkey'
      and contype = 'f'
  ) then
    raise exception 'journal-line branch/account consistency FK is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'branch_money_transfers'
      and indexname = 'branch_money_transfers_idempotency_uidx'
  ) then
    raise exception 'money-transfer idempotency index is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.branch_money_transfers'::regclass
      and tgname = 'branch_money_transfers_status_guard'
      and not tgisinternal
  ) then
    raise exception 'money-transfer transition guard is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.branch_fund_transfer_journals'::regclass
      and tgname = 'branch_fund_journals_immutable'
      and not tgisinternal
  ) then
    raise exception 'immutable financial-journal guard is missing';
  end if;
end;
$$;

rollback;
