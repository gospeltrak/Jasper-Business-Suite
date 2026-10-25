/**
 * Conservative offline reconciliation rules for Android/iOS.
 *
 * This module is pure: it NEVER writes a snapshot into cloud inventory,
 * deletes a local operation or trusts the device clock as a server revision.
 * Server-allocated stock grants and server acknowledgements are prerequisites.
 * Pending operations must remain stored until a validated receipt is committed.
 */
export type OperationKind = 'sale' | 'purchase' | 'expense';
export type SyncOutcome = 'complete' | 'retry_wait' | 'needs_review' | 'blocked';
export type Permission = 'pos.write' | 'products.write' | 'expenses.write';

export interface OfflineIdentity {
  tenantId: string;
  branchId: string;
  actorId: string;
  deviceId: string;
}
export interface OperationIdentity extends OfflineIdentity {
  operationId: string;
  idempotencyKey: string;
  payloadDigest: string;
  type: OperationKind;
  baseSnapshotRevision: string;
  createdAt: string;
}
export interface ServerReceipt {
  tenantId: string;
  branchId: string;
  actorId: string;
  deviceId: string;
  payloadDigest: string;
  operationId: string;
  idempotencyKey: string;
  type: OperationKind;
  status: 'committed' | 'already_committed' | 'conflict' | 'rejected';
  // A server response must report the actual ledger effects. Mere HTTP 200
  // or a repeated operation id does not prove stock or treasury was applied.
  inventoryCommitted: boolean;
  treasuryCommitted: boolean;
  serverRevision: string;
  serverCommittedAt: string;
  conflictCode?: string;
}
export interface SyncResponse {
  receipt?: ServerReceipt | null;
  httpStatus?: number;
  networkFailed?: boolean;
}
export interface SyncDecision {
  outcome: SyncOutcome;
  code: string;
  retryAfterMs?: number;
}

/** Deterministic bounded retry. Devices won't all hammer the server at once. */
export function retryDelayMs(attempt: number, operationKey: string): number {
  const step = Math.min(9, Math.max(0, Math.floor(Number.isFinite(attempt) ? attempt : 0)));
  let hash = 2166136261;
  for (const ch of operationKey) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const jitter = (hash >>> 0) % 997;
  return Math.min(30 * 60_000, 1000 * 2 ** step + jitter);
}

/**
 * Never retry 401/403 with an old offline session and never permanently
 * abandon an operation because of network loss or an ambiguous timeout.
 */
export function evaluateServerResponse(
  op: OperationIdentity,
  result: SyncResponse,
  attempt = 0,
): SyncDecision {
  const status = result.httpStatus;
  const receipt = result.receipt;
  if (status === 401 || status === 403) return { outcome: 'blocked', code: 'access_revoked_or_session_expired' };
  if (result.networkFailed || !status || status >= 500 || status === 408 || status === 425 || status === 429) {
    return { outcome: 'retry_wait', code: 'network_or_server_unavailable', retryAfterMs: retryDelayMs(attempt, op.idempotencyKey) };
  }
  if (status === 409 || status === 410 || status === 412 || status === 422) {
    return { outcome: 'needs_review', code: 'server_conflict_or_tombstone' };
  }
  if (status < 200 || status >= 300) return { outcome: 'needs_review', code: 'unexpected_server_rejection' };
  if (!receipt) return { outcome: 'retry_wait', code: 'missing_server_receipt', retryAfterMs: retryDelayMs(attempt, op.idempotencyKey) };
  if (receipt.tenantId !== op.tenantId || receipt.branchId !== op.branchId
    || receipt.actorId !== op.actorId || receipt.deviceId !== op.deviceId
    || !op.payloadDigest || receipt.payloadDigest !== op.payloadDigest
    || receipt.operationId !== op.operationId || receipt.idempotencyKey !== op.idempotencyKey || receipt.type !== op.type) {
    return { outcome: 'blocked', code: 'receipt_identity_mismatch' };
  }
  if (receipt.status === 'conflict' || receipt.status === 'rejected') {
    return { outcome: 'needs_review', code: receipt.conflictCode || 'server_rejected_operation' };
  }
  if (!receipt.serverRevision || !receipt.serverCommittedAt || !Number.isFinite(Date.parse(receipt.serverCommittedAt))) {
    return { outcome: 'retry_wait', code: 'incomplete_server_receipt', retryAfterMs: retryDelayMs(attempt, op.idempotencyKey) };
  }
  // Purchases and sales touch stock; all financial transactions touch ledger.
  if ((op.type !== 'expense' && !receipt.inventoryCommitted) || !receipt.treasuryCommitted) {
    return { outcome: 'retry_wait', code: 'incomplete_stock_or_treasury_posting', retryAfterMs: retryDelayMs(attempt, op.idempotencyKey) };
  }
  return { outcome: 'complete', code: receipt.status };
}

export interface StockGrant extends OfflineIdentity {
  grantId: string;
  productId: string;
  // Fixed-point integer micro-units, not floating-point quantities. For
  // example 0.25 kg = "250000" when the base unit is kg.
  allowedMicros: string;
  remainingMicros: string;
  snapshotRevision: string;
  expiresAtServer: string;
  revoked?: boolean;
}
export interface StockLine { productId: string; grantId: string; quantityMicros: string }
export interface OfflineSaleIntent extends OperationIdentity {
  type: 'sale';
  lines: StockLine[];
}
export interface LocalStockBudget {
  // The caller must load the budget + journal from a single durable store and
  // persist the returned budget + operation in one ACID transaction.
  grants: StockGrant[];
  appliedOperationIds: string[];
}
/**
 * Time proof must originate from an authenticated server handshake plus a
 * trusted native monotonic clock (not Date.now()). A fake/old proof is unsafe.
 * The native clock adapter + server signature verification are release gates.
 */
export interface TrustedOfflineClock {
  serverTimeAtHandshake: string;
  monotonicElapsedMs: number;
  continuityVerified: boolean;
  serverProofId: string;
  maxOfflineMs: number;
}
function verifiedServerNow(clock: TrustedOfflineClock): number | null {
  if (!clock || !clock.continuityVerified || !clock.serverProofId ||
      !Number.isFinite(clock.monotonicElapsedMs) || clock.monotonicElapsedMs < 0 ||
      !Number.isFinite(clock.maxOfflineMs) || clock.maxOfflineMs <= 0 ||
      clock.maxOfflineMs > 24 * 60 * 60_000 || clock.monotonicElapsedMs > clock.maxOfflineMs) return null;
  const handshake = Date.parse(clock.serverTimeAtHandshake);
  return Number.isFinite(handshake) ? handshake + clock.monotonicElapsedMs : null;
}

export interface StockAdmission {
  outcome: 'accepted' | 'duplicate' | 'needs_review' | 'blocked';
  code: string;
  next?: LocalStockBudget;
}
const MAX_MICROS = 10n ** 24n;
function parseMicros(raw: string): bigint | null {
  if (typeof raw !== 'string' || !/^(?:0|[1-9][0-9]{0,23})$/.test(raw)) return null;
  const amount = BigInt(raw);
  return amount <= MAX_MICROS ? amount : null;
}
function sameScope(a: OfflineIdentity, b: OfflineIdentity): boolean {
  return a.tenantId === b.tenantId && a.branchId === b.branchId
    && a.actorId === b.actorId && a.deviceId === b.deviceId;
}

/**
 * A snapshot of total warehouse stock is NOT a device reservation.
 * Admit a sale only against an explicitly server-issued, scoped stock grant.
 * Two devices require disjoint grants, allocated atomically on the SERVER.
 *
 * Do not pass client time here. Expiry and revocation are checked by server on
 * replay; native devices must also block expired grants using trusted sync time.
 */
export function simulateStockAdmission(
  intent: OfflineSaleIntent,
  budget: LocalStockBudget,
  clock: TrustedOfflineClock,
): StockAdmission {
  if (!intent.tenantId || !intent.branchId || !intent.actorId || !intent.deviceId
    || !intent.operationId || !intent.idempotencyKey || !intent.baseSnapshotRevision) {
    return { outcome: 'blocked', code: 'missing_identity_or_snapshot_revision' };
  }
  if (budget.appliedOperationIds.includes(intent.idempotencyKey)) {
    return { outcome: 'duplicate', code: 'already_queued', next: budget };
  }
  if (!Array.isArray(intent.lines) || intent.lines.length === 0) {
    return { outcome: 'blocked', code: 'sale_has_no_lines' };
  }
  const verifiedNow = verifiedServerNow(clock);
  if (verifiedNow === null) return { outcome: 'blocked', code: 'trusted_native_clock_required' };
  const nextGrants = budget.grants.map(g => ({ ...g }));
  for (const line of intent.lines) {
    const qty = parseMicros(line.quantityMicros);
    if (!qty || qty <= 0n) return { outcome: 'blocked', code: 'invalid_quantity' };
    const grant = nextGrants.find(g => g.grantId === line.grantId && g.productId === line.productId);
    if (!grant || !sameScope(intent, grant)) return { outcome: 'blocked', code: 'no_scoped_server_stock_grant' };
    if (grant.revoked) return { outcome: 'needs_review', code: 'stock_grant_revoked' };
    if (grant.snapshotRevision !== intent.baseSnapshotRevision) {
      return { outcome: 'needs_review', code: 'stock_snapshot_changed' };
    }
    if (!grant.expiresAtServer || !Number.isFinite(Date.parse(grant.expiresAtServer))) {
      return { outcome: 'blocked', code: 'unverifiable_stock_grant' };
    }
    if (verifiedNow >= Date.parse(grant.expiresAtServer)) {
      return { outcome: 'needs_review', code: 'stock_grant_expired' };
    }
    const remaining = parseMicros(grant.remainingMicros);
    const allowed = parseMicros(grant.allowedMicros);
    if (remaining === null || allowed === null || remaining > allowed) {
      return { outcome: 'blocked', code: 'invalid_grant_balance' };
    }
    if (remaining < qty) return { outcome: 'needs_review', code: 'insufficient_reserved_stock' };
    grant.remainingMicros = (remaining - qty).toString();
  }
  return {
    outcome: 'accepted',
    code: 'admitted_against_reserved_stock',
    next: {
      grants: nextGrants,
      appliedOperationIds: [...budget.appliedOperationIds, intent.idempotencyKey],
    },
  };
}

/** Tombstones always outrank older snapshots, irrespective of device wall time. */
export function mayRestoreDeletedRecord(
  deletedOnServer: boolean,
  explicitServerRestoreAuthorized: boolean,
): boolean {
  return !deletedOnServer || explicitServerRestoreAuthorized;
}
