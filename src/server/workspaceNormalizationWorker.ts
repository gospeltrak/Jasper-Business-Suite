import { Prisma } from '@prisma/client';
import { getPrismaClient } from './prisma.js';

type ClaimedWorkspace = { tenant_id: string; workspace_updated_at: Date };
type ReconciliationResult = { is_match: boolean };
type ValidationResult = { validation: { allMatch?: boolean } | null };

export type WorkspaceNormalizationResult =
  | { status: 'idle' }
  | { status: 'completed'; tenantId: string }
  | { status: 'failed'; tenantId: string };

export async function processWorkspaceNormalizationQueue(): Promise<WorkspaceNormalizationResult> {
  const prisma = getPrismaClient();
  let claimedTenantId: string | null = null;

  try {
    return await prisma.$transaction(async (tx) => {
      const rawTx = tx as unknown as {
        $queryRaw<T>(query: Prisma.Sql): Promise<T>;
        $executeRaw(query: Prisma.Sql): Promise<number>;
      };
      const claimed = await rawTx.$queryRaw<ClaimedWorkspace[]>(Prisma.sql`
        with candidate as (
          select outbox.tenant_id
          from public.workspace_normalization_outbox outbox
          join public.workspace_migration_state state using (tenant_id)
          where outbox.status in ('pending', 'failed')
            and outbox.available_at <= statement_timestamp()
            and state.dual_write_enabled
            and state.read_mode in ('legacy', 'shadow')
          order by outbox.available_at, outbox.requested_at, outbox.tenant_id
          limit 1
          for update of outbox skip locked
        )
        update public.workspace_normalization_outbox outbox
        set status = 'running', attempts = outbox.attempts + 1,
            locked_at = statement_timestamp(), locked_by = 'prisma-worker',
            updated_at = statement_timestamp()
        from candidate
        where outbox.tenant_id = candidate.tenant_id
        returning outbox.tenant_id, outbox.workspace_updated_at
      `);

      const job = claimed[0];
      if (!job) return { status: 'idle' as const };
      claimedTenantId = job.tenant_id;

      const batches = await rawTx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        select (public.normalize_workspace_snapshot(
          ${job.tenant_id}::uuid, ${job.workspace_updated_at}::timestamptz
        )).id
      `);
      const batchId = batches[0]?.id;
      if (!batchId) throw new Error('Normalization did not return a migration batch.');

      await rawTx.$queryRaw(Prisma.sql`
        select public.refresh_workspace_source_ordinals(${job.tenant_id}::uuid)
      `);
      const reconciliations = await rawTx.$queryRaw<ReconciliationResult[]>(Prisma.sql`
        select (public.reconcile_workspace_normalization(
          ${job.tenant_id}::uuid, ${batchId}::uuid
        )).is_match
      `);
      const validations = await rawTx.$queryRaw<ValidationResult[]>(Prisma.sql`
        select public.validate_workspace_shadow_content(${job.tenant_id}::uuid) as validation
      `);
      const exactMatch = reconciliations[0]?.is_match === true
        && validations[0]?.validation?.allMatch === true;
      if (!exactMatch) throw new Error('Normalization reconciliation or content validation failed.');

      await rawTx.$executeRaw(Prisma.sql`
        update public.workspace_migration_state state
        set phase = 'shadow_read', read_mode = 'shadow',
            source_counts = reconciliation.source_counts,
            target_counts = reconciliation.target_counts,
            source_totals = reconciliation.source_totals,
            target_totals = reconciliation.target_totals,
            last_source_hash = md5(workspace.payload::text),
            last_verified_at = statement_timestamp(), last_error = '{}'::jsonb,
            updated_at = statement_timestamp()
        from public.workspace_reconciliation_runs reconciliation
        join public.tenant_workspaces workspace
          on workspace.tenant_id = reconciliation.tenant_id
        where state.tenant_id = ${job.tenant_id}::uuid
          and reconciliation.batch_id = ${batchId}::uuid
          and reconciliation.tenant_id = state.tenant_id
          and reconciliation.is_match
      `);

      return { status: 'completed' as const, tenantId: job.tenant_id };
    }, { maxWait: 5_000, timeout: 120_000 });
  } catch {
    if (claimedTenantId) {
      await prisma.$executeRaw(Prisma.sql`
        update public.workspace_normalization_outbox
        set status = 'failed', available_at = statement_timestamp() + interval '5 minutes',
            locked_at = null, locked_by = null,
            last_error = jsonb_build_object('code', 'NORMALIZATION_VALIDATION_FAILED'),
            updated_at = statement_timestamp()
        where tenant_id = ${claimedTenantId}::uuid
      `);
      return { status: 'failed', tenantId: claimedTenantId };
    }
    throw new Error('Workspace normalization worker failed before claiming a job.');
  }
}
