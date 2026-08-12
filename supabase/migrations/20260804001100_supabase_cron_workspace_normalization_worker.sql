-- Supabase-native scheduler for the workspace normalization outbox.
-- This replaces the need for a frequent Vercel Cron invocation. It is
-- intentionally dormant for tenants whose dual_write_enabled flag is false.

begin;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.process_workspace_normalization_queue(
  p_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_batch_id uuid;
  v_reconciliation_match boolean;
  v_content_validation jsonb;
  v_branch_validation jsonb;
  v_completed integer := 0;
  v_failed integer := 0;
begin
  if p_limit < 1 or p_limit > 25 then
    raise exception using errcode = '22023', message = 'Queue batch limit must be between 1 and 25.';
  end if;

  for v_job in
    select outbox.tenant_id, outbox.workspace_updated_at
    from public.workspace_normalization_outbox outbox
    join public.workspace_migration_state state using (tenant_id)
    where outbox.status in ('pending', 'failed')
      and outbox.available_at <= statement_timestamp()
      and state.dual_write_enabled
      and state.read_mode in ('legacy', 'shadow')
    order by outbox.available_at, outbox.requested_at, outbox.tenant_id
    limit p_limit
    for update of outbox skip locked
  loop
    update public.workspace_normalization_outbox
    set status = 'running',
        attempts = attempts + 1,
        locked_at = statement_timestamp(),
        locked_by = 'supabase-pg-cron',
        updated_at = statement_timestamp()
    where tenant_id = v_job.tenant_id;

    begin
      select (public.normalize_workspace_snapshot(
        v_job.tenant_id,
        v_job.workspace_updated_at
      )).id into strict v_batch_id;

      perform public.normalize_branch_stock_snapshot(
        v_job.tenant_id,
        v_job.workspace_updated_at
      );
      perform public.refresh_workspace_source_ordinals(v_job.tenant_id);

      select (public.reconcile_workspace_normalization(
        v_job.tenant_id,
        v_batch_id
      )).is_match into v_reconciliation_match;
      select public.validate_workspace_shadow_content(v_job.tenant_id)
        into v_content_validation;
      select public.validate_branch_stock_shadow(v_job.tenant_id)
        into v_branch_validation;

      if not coalesce(v_reconciliation_match, false)
        or not coalesce((v_content_validation ->> 'allMatch')::boolean, false)
        or not coalesce((v_branch_validation ->> 'allMatch')::boolean, false)
      then
        raise exception using
          errcode = 'P0001',
          message = 'Workspace normalization validation failed.';
      end if;

      update public.workspace_migration_state state
      set phase = 'shadow_read',
          read_mode = 'shadow',
          source_counts = reconciliation.source_counts,
          target_counts = reconciliation.target_counts,
          source_totals = reconciliation.source_totals,
          target_totals = reconciliation.target_totals,
          last_source_hash = md5(workspace.payload::text),
          last_verified_at = statement_timestamp(),
          last_error = '{}'::jsonb,
          updated_at = statement_timestamp()
      from public.workspace_reconciliation_runs reconciliation
      join public.tenant_workspaces workspace
        on workspace.tenant_id = reconciliation.tenant_id
      where state.tenant_id = v_job.tenant_id
        and reconciliation.batch_id = v_batch_id
        and reconciliation.tenant_id = state.tenant_id
        and reconciliation.is_match;

      update public.workspace_normalization_outbox
      set status = 'completed',
          locked_at = null,
          locked_by = null,
          last_error = '{}'::jsonb,
          updated_at = statement_timestamp()
      where tenant_id = v_job.tenant_id
        and workspace_updated_at = v_job.workspace_updated_at;

      v_completed := v_completed + 1;
    exception
      when others then
        update public.workspace_normalization_outbox
        set status = 'failed',
            available_at = statement_timestamp() + interval '5 minutes',
            locked_at = null,
            locked_by = null,
            last_error = jsonb_build_object('code', 'NORMALIZATION_VALIDATION_FAILED'),
            updated_at = statement_timestamp()
        where tenant_id = v_job.tenant_id;

        update public.workspace_migration_state
        set last_error = jsonb_build_object('code', 'NORMALIZATION_VALIDATION_FAILED'),
            updated_at = statement_timestamp()
        where tenant_id = v_job.tenant_id;

        v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'completed', v_completed,
    'failed', v_failed,
    'processed', v_completed + v_failed
  );
end;
$$;

revoke all on function private.process_workspace_normalization_queue(integer)
  from public, anon, authenticated, service_role;
grant execute on function private.process_workspace_normalization_queue(integer)
  to postgres;

select cron.schedule(
  'workspace-normalization-worker-v1',
  '*/5 * * * *',
  $command$select private.process_workspace_normalization_queue(5);$command$
);

commit;
