-- Read-only structural verification for the Phase 3F audit, notification, and
-- reporting-support migration.

begin;

set local statement_timeout = '15s';

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'branch_audit_logs',
    'branch_notification_events',
    'branch_notification_recipients'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'required Phase 3F table is missing: %', v_table;
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
      raise exception 'dark-rollout event table is exposed: %', v_table;
    end if;
  end loop;

  if to_regprocedure(
    'private.append_branch_audit_event(uuid,uuid,uuid,text,text,text,text,uuid,text,jsonb,jsonb,jsonb)'
  ) is null
    or to_regprocedure(
      'private.enqueue_branch_notification(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,uuid[])'
    ) is null
    or to_regprocedure('private.validate_branch_audit_log()') is null
    or to_regprocedure(
      'private.validate_branch_notification_recipient_update()'
    ) is null
  then
    raise exception 'one or more Phase 3F private helpers are missing';
  end if;

  if to_regclass('public.branch_internal_movement_reporting') is null
    or to_regclass('public.branch_account_position_reporting') is null
  then
    raise exception 'one or more Phase 3F reporting views are missing';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.branch_internal_movement_reporting',
    'SELECT'
  ) or has_table_privilege(
    'authenticated',
    'public.branch_account_position_reporting',
    'SELECT'
  ) then
    raise exception 'server-only reporting views are browser accessible';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.branch_audit_logs'::regclass
      and tgname = 'branch_audit_logs_immutable'
      and not tgisinternal
  ) then
    raise exception 'immutable branch-audit guard is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branch_notification_recipients'::regclass
      and conname = 'branch_notification_recipients_user_fkey'
      and contype = 'f'
  ) then
    raise exception 'tenant-safe notification-recipient user FK is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'branch_notification_recipients'
      and indexname = 'branch_notification_recipients_unread_idx'
      and indexdef ilike '%WHERE%read_at IS NULL%'
  ) then
    raise exception 'partial unread notification index is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branch_internal_movement_reporting'
      and column_name = 'include_in_consolidated_revenue'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branch_internal_movement_reporting'
      and column_name = 'include_in_external_cash_flow'
  ) then
    raise exception 'internal-movement consolidation flags are missing';
  end if;
end;
$$;

rollback;
