export type PurchaseTombstones = Record<string, string>;

// Runtime-only mirror, same pattern as saleSync.ts's sale tombstones: the
// durable copy lives in tenant_workspaces.payload.purchaseTombstones on the
// server, merged in by save_current_branch_purchases on every write.
const runtimeTombstones = new Map<string, PurchaseTombstones>();

export const readLocalPurchaseTombstones = (tenantId: string): PurchaseTombstones => ({
  ...(runtimeTombstones.get(tenantId) || {}),
});

export const writeLocalPurchaseTombstones = (
  tenantId: string,
  tombstones: PurchaseTombstones,
): void => {
  runtimeTombstones.set(tenantId, { ...(tombstones || {}) });
};

export const markLocalPurchaseTombstone = (
  tenantId: string,
  purchaseId: string,
  deletedAt = new Date().toISOString(),
): PurchaseTombstones => {
  const next = readLocalPurchaseTombstones(tenantId);
  if (purchaseId) next[purchaseId] = deletedAt;
  writeLocalPurchaseTombstones(tenantId, next);
  return next;
};
