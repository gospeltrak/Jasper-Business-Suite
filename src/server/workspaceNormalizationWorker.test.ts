import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() };
  const client = { $transaction: vi.fn(async (run: (transaction: typeof tx) => unknown) => run(tx)), $executeRaw: vi.fn() };
  return { tx, client };
});
vi.mock('@prisma/client', () => ({ Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join('?'), values }) } }));
vi.mock('./prisma.js', () => ({ getPrismaClient: () => db.client }));

import { processWorkspaceNormalizationQueue } from './workspaceNormalizationWorker';

describe('normalized tenant background synchronization', () => {
  beforeEach(() => {
    db.tx.$queryRaw.mockReset();
    db.tx.$executeRaw.mockReset();
    db.client.$executeRaw.mockReset();
    db.client.$transaction.mockClear();
  });

  function queueJob(stockMatch: boolean) {
    db.tx.$queryRaw
      .mockResolvedValueOnce([{ tenant_id: 'tenant', workspace_updated_at: new Date('2026-10-24T00:00:00Z') }])
      .mockResolvedValueOnce([{ id: 'batch' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ is_match: true }])
      .mockResolvedValueOnce([{ validation: { allMatch: true } }])
      .mockResolvedValueOnce([{ validation: { allMatch: stockMatch } }]);
  }

  it('synchronizes branch stock and keeps a normalized tenant on normalized reads', async () => {
    queueJob(true);
    expect(await processWorkspaceNormalizationQueue()).toEqual({ status: 'completed', tenantId: 'tenant' });
    const statements = db.tx.$queryRaw.mock.calls.map(([sql]) => sql.text).join('\n');
    expect(statements).toContain("state.read_mode in ('legacy', 'shadow', 'normalized')");
    expect(statements).toContain('normalize_branch_stock_snapshot');
    expect(statements).toContain('validate_branch_stock_shadow');
    expect(db.tx.$executeRaw.mock.calls[0][0].text).toContain("case when state.read_mode = 'normalized' then 'normalized'");
    expect(db.client.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects stock drift even when counts and other contents match', async () => {
    queueJob(false);
    expect(await processWorkspaceNormalizationQueue()).toEqual({ status: 'failed', tenantId: 'tenant' });
    expect(db.tx.$executeRaw).not.toHaveBeenCalled();
    expect(db.client.$executeRaw.mock.calls[0][0].text).toContain("status = 'failed'");
  });

  it('leaves the database unchanged when no tenant is queued', async () => {
    db.tx.$queryRaw.mockResolvedValueOnce([]);
    expect(await processWorkspaceNormalizationQueue()).toEqual({ status: 'idle' });
    expect(db.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.tx.$executeRaw).not.toHaveBeenCalled();
    expect(db.client.$executeRaw).not.toHaveBeenCalled();
  });
});
