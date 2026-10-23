export type ExpenseTombstones = Record<string, string>;

// Runtime-only mirror, same pattern as saleSync.ts/purchaseSync.ts/
// deliverySync.ts: the durable copy lives in
// tenant_workspaces.payload.expenseTombstones on the server, merged in by
// save_current_branch_expenses on every write.
const runtimeTombstones = new Map<string, ExpenseTombstones>();

export const readLocalExpenseTombstones = (tenantId: string): ExpenseTombstones => ({
  ...(runtimeTombstones.get(tenantId) || {}),
});

export const writeLocalExpenseTombstones = (
  tenantId: string,
  tombstones: ExpenseTombstones,
): void => {
  runtimeTombstones.set(tenantId, { ...(tombstones || {}) });
};

export const markLocalExpenseTombstone = (
  tenantId: string,
  expenseId: string,
  deletedAt = new Date().toISOString(),
): ExpenseTombstones => {
  const next = readLocalExpenseTombstones(tenantId);
  if (expenseId) next[expenseId] = deletedAt;
  writeLocalExpenseTombstones(tenantId, next);
  return next;
};
