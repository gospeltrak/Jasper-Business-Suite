/**
 * Pure native offline conflict policy.
 *
 * IMPORTANT: This module does NOT grant stock. Only a server-issued,
 * transactionally reserved per-device lease can grant offline capacity.
 * A cached global quantity is NEVER an offline allowance. No UI should
 * enable offline checkout until server grant/verification is implemented.
 */

export type OfflineKind = 'sale' | 'purchase' | 'expense';
export type SyncResolution = 'complete' | 'retry' | 'needs_review' | 'blocked';

export interface OfflineIdentity {
  tenantId: string;
  branchId: string;
  actorId: string;
  deviceId: string;
}

export interface OfflineStockGrant extends OfflineIdentity {
  leaseId: string;
  productId: string;
  sourceStockRevision: string;
  reservedQuantity: number;
  issuedAt: string;
  expiresAt: string;
}

export interface NativeOperation extends OfflineIdentity {
  operationId: string;
  idempotencyKey: string;
  kind: OfflineKind;
  clientCreatedAt: string;
  clientSequence: number;
  baseSnapshotRevision: string;
  productDeltas?: Array<{ productId: string; quantity: number }>;
}

export type OfflineAdmission = {
  allowed: boolean;
  reason: string;
  category: 'ready' | 'missing_snapshot' | 'wrong_identity' | 'lease_expired'
    | 'insufficient_allowance' | 'bad_operation' | 'removed_product';
};

export interface ProductTombstone {
  productId: string;
  branchId: string;
  deletedAt: string;
  revision: string;
}

export interface ServerSyncReceipt {
  operationId: string;
  idempotencyKey: string;
  tenantId: string;
  branchId: string;
  actorId: string;
  deviceId: string;
  committedAt: string;
  stockCommitted: boolean;
  treasuryCommitted: boolean;
}

export type SyncResponse =
  | { state: 'confirmed'; receipt: ServerSyncReceipt }
  | { state: 'duplicate'; receipt: ServerSyncReceipt }
  | { state: 'network_failure'; reason?: string }
  | { state: 'timeout'; reason?: string }
  | { state: 'rate_limited'; reason?: string }
  | { state: 'unauthorized'; reason?: string }
  | { state: 'conflict'; reason: string; type: 'stock' | 'tombstone' | 'price' | 'credit' | 'branch' | 'duplicate_payload' | 'lease_expired' }
  | { state: 'server_error'; reason?: string };

const validCount = (value: number) => Number.isFinite(value) && value >= 0;
const sameIdentity = (a: OfflineIdentity, b: OfflineIdentity) =>
  Boolean(a.tenantId && a.branchId && a.actorId && a.deviceId)
  && a.tenantId === b.tenantId && a.branchId === b.branchId
  && a.actorId === b.actorId && a.deviceId === b.deviceId;

export const operationIdempotencyKey = (op: NativeOperation) => [
  op.tenantId, op.branchId, op.deviceId, op.kind, op.operationId,
].join(':');

/**
 * Admission is local/preliminary. It never implies the cloud accepted the
 * operation. Only a *server reserved* allowance can prevent two devices
 * from both spending the same stock. Timestamp is audit data, NOT a
 * last-write-wins field.
 */
export function admitOfflineSale(
  op: NativeOperation,
  snapshot: { revision: string; scope: OfflineIdentity; capturedAt: string } | null,
  grants: OfflineStockGrant[],
  pendingOnThisDevice: NativeOperation[],
  tombstones: ProductTombstone[],
  now: string,
): OfflineAdmission {
  const reject = (category: OfflineAdmission['category'], reason: string): OfflineAdmission =>
    ({ allowed: false, category, reason });
  if (!snapshot?.revision || !Number.isFinite(Date.parse(snapshot.capturedAt))) {
    return reject('missing_snapshot', 'A confirmed online stock snapshot is required.');
  }
  if (!sameIdentity(op, snapshot.scope)) {
    return reject('wrong_identity', 'Tenant, branch, staff and device must match the snapshot.');
  }
  if (op.kind !== 'sale' || !op.operationId || !op.idempotencyKey ||
      op.idempotencyKey !== operationIdempotencyKey(op) ||
      !op.clientSequence || op.clientSequence < 1 ||
      op.baseSnapshotRevision !== snapshot.revision ||
      !Array.isArray(op.productDeltas) || op.productDeltas.length === 0 ||
      !Number.isFinite(Date.parse(op.clientCreatedAt)) || !Number.isFinite(Date.parse(now))) {
    return reject('bad_operation', 'Sale metadata, snapshot revision or item quantities are invalid.');
  }
  if (pendingOnThisDevice.some(p =>
    sameIdentity(p, op) && p.operationId === op.operationId)) {
    return reject('bad_operation', 'Transaction ID already staged; never overwrite it.');
  }
  const totals = new Map<string, number>();
  for (const line of op.productDeltas) {
    if (!line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      return reject('bad_operation', 'Offline quantities must be positive and finite.');
    }
    totals.set(line.productId, (totals.get(line.productId) || 0) + line.quantity);
  }
  for (const [productId, requiredQty] of totals) {
    if (tombstones.some(t => t.productId === productId && t.branchId === op.branchId)) {
      return reject('removed_product', 'A removed/archived product must not be sold offline.');
    }
    const validGrants = grants.filter(g => sameIdentity(g, op)
      && g.productId === productId && g.sourceStockRevision
      && validCount(g.reservedQuantity) && g.reservedQuantity > 0
      && Number.isFinite(Date.parse(g.issuedAt)) && Number.isFinite(Date.parse(g.expiresAt))
      && Date.parse(g.issuedAt) <= Date.parse(now)
      && Date.parse(now) < Date.parse(g.expiresAt));
    if (validGrants.length === 0) {
      return reject('lease_expired', 'No valid server-reserved stock allowance for this product.');
    }
    // Deduplicate the same lease across multiple cached copies. Lease IDs
    // must be immutable, enforced server-side with uniqueness constraints.
    const unique = new Map(validGrants.map(g => [g.leaseId, g]));
    let alreadyAllocated = 0;
    for (const pending of pendingOnThisDevice) {
      if (!sameIdentity(pending, op) || pending.kind !== 'sale') continue;
      for (const item of pending.productDeltas || []) {
        if (item.productId === productId) {
          if (!Number.isFinite(item.quantity) || item.quantity < 0) {
            return reject('bad_operation', 'Corrupt pending stock record requires manual recovery.');
          }
          alreadyAllocated += item.quantity;
        }
      }
    }
    const grantedQty = [...unique.values()].reduce((sum, grant) => sum + grant.reservedQuantity, 0);
    if (alreadyAllocated + requiredQty > grantedQty + 1e-9) {
      return reject('insufficient_allowance', 'Offline reserved stock is insufficient; reconnect before selling more.');
    }
  }
  return { allowed: true, category: 'ready', reason: 'Within server-reserved offline allowance.' };
}

/**
 * A cloud response only finishes local sync when all bookkeeping is
 * acknowledged by the server. Transport failures keep the original payload
 * intact. Never delete a local event because an HTTP request was sent.
 */
export function resolveOfflineSync(op: NativeOperation, response: SyncResponse): {
  resolution: SyncResolution; reason: string; serverCommittedAt?: string;
} {
  if (response.state === 'network_failure' || response.state === 'timeout' ||
      response.state === 'rate_limited' || response.state === 'server_error') {
    return { resolution: 'retry', reason: response.reason || 'Keep the original event and retry idempotently.' };
  }
  if (response.state === 'unauthorized') {
    return { resolution: 'blocked', reason: response.reason || 'Staff/branch permission must be revalidated.' };
  }
  if (response.state === 'conflict') {
    return { resolution: 'needs_review', reason: response.reason };
  }
  const r = response.receipt;
  if (!sameIdentity(op, r) || r.operationId !== op.operationId ||
      r.idempotencyKey !== op.idempotencyKey || !Number.isFinite(Date.parse(r.committedAt))) {
    return { resolution: 'needs_review', reason: 'Cloud acknowledgement does not match the original transaction identity.' };
  }
  if (!r.stockCommitted || !r.treasuryCommitted) {
    return { resolution: 'retry', reason: 'Stock and treasury confirmation must both finish before acknowledging sync.' };
  }
  return { resolution: 'complete', reason: 'Confirmed by authoritative server; retain immutable audit record.', serverCommittedAt: r.committedAt };
}

/**
 * Tombstones ALWAYS win over stale cached records. A fresh server-created
 * entity must have a fresh immutable ID; it must not reuse a removed ID.
 */
export function filterTombstonedProducts<T extends { id: string; branchId?: string }>(
  items: T[], tombstones: ProductTombstone[], branchId: string,
): T[] {
  const deleted = new Set(tombstones.filter(t => t.branchId === branchId).map(t => t.productId));
  return items.filter(item => !deleted.has(item.id));
}
