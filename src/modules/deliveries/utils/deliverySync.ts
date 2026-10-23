export type DeliveryTombstones = Record<string, string>;

// Runtime-only mirror, same pattern as saleSync.ts/purchaseSync.ts: the
// durable copy lives in tenant_workspaces.payload.deliveryTombstones on the
// server, merged in by save_current_branch_deliveries on every write.
const runtimeTombstones = new Map<string, DeliveryTombstones>();

export const readLocalDeliveryTombstones = (tenantId: string): DeliveryTombstones => ({
  ...(runtimeTombstones.get(tenantId) || {}),
});

export const writeLocalDeliveryTombstones = (
  tenantId: string,
  tombstones: DeliveryTombstones,
): void => {
  runtimeTombstones.set(tenantId, { ...(tombstones || {}) });
};

export const markLocalDeliveryTombstone = (
  tenantId: string,
  deliveryId: string,
  deletedAt = new Date().toISOString(),
): DeliveryTombstones => {
  const next = readLocalDeliveryTombstones(tenantId);
  if (deliveryId) next[deliveryId] = deletedAt;
  writeLocalDeliveryTombstones(tenantId, next);
  return next;
};
