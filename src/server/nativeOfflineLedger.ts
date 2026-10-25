import type { ServerReceipt, OperationKind } from '../native/offlineConflictEngine';
import { canonicalOfflinePayload, offlinePayloadDigest } from '../native/offlinePayloadDigest';

/**
 * Server-only database transaction boundary. NEVER import this file from Vite
 * code and never give database credentials to the Capacitor/web app.
 */
export interface OfflineSqlClient {
  query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
  release(): void;
}
export interface OfflineSqlPool { connect(): Promise<OfflineSqlClient> }

export interface VerifiedOfflineCaller {
  // All fields must be derived from a freshly verified server-side session
  // and DB membership, NOT copied from a client-provided JSON payload.
  tenantId: string;
  branchId: string;
  actorId: string;
}
export interface OfflineCommand {
  tenantId: string;
  branchId: string;
  actorId: string;
  deviceId: string;
  operationId: string;
  type: OperationKind;
  idempotencyKey: string;
  payloadDigest: string;
  baseSnapshotRevision: string;
  clientSequence: number;
  createdAt: string;
  payload: Record<string, unknown>;
}

export type OfflineBusinessEffects = {
  inventoryCommitted: boolean;
  treasuryCommitted: boolean;
};
export interface OfflineServerCallbacks {
  /** Authorize this exact actor/branch/device/type from CURRENT DB records.
   * A revoked account, removed branch, expired device or absent permission
   * must throw. Called on EVERY retry, even after an earlier commit.
   */
  verifyFreshPermissions(
    tx: OfflineSqlClient,
    caller: VerifiedOfflineCaller,
    command: OfflineCommand,
  ): Promise<void>;
  /** MUST write normalized business rows, stock-grant consumption AND
   * Treasury journal lines via THIS SAME tx; never a separate Supabase RPC,
   * HTTP call, or background queue. Throw on any business rule failure.
   * Stock reservations must include online writes as well.
   */
  applyAtomicEffects(tx: OfflineSqlClient, command: OfflineCommand): Promise<OfflineBusinessEffects>;
}
export class OfflineLedgerConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineLedgerConflict';
  }
}

const validUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function validateEnvelope(caller: VerifiedOfflineCaller, op: OfflineCommand): Promise<void> {
  if (!validUuid(caller.tenantId) || !validUuid(caller.branchId) || !validUuid(caller.actorId) ||
    caller.tenantId !== op.tenantId || caller.branchId !== op.branchId || caller.actorId !== op.actorId) {
    throw new OfflineLedgerConflict('Transaction scope does not match the authenticated account.');
  }
  if (!['sale', 'purchase', 'expense'].includes(op.type) || !validUuid(op.operationId)
    || !validUuid(op.deviceId) || !op.baseSnapshotRevision
    || !Number.isSafeInteger(op.clientSequence) || op.clientSequence <= 0) {
    throw new OfflineLedgerConflict('Offline transaction has invalid immutable metadata.');
  }
  const expectedKey = [op.tenantId, op.branchId, op.deviceId, op.type, op.operationId].join(':');
  if (op.idempotencyKey !== expectedKey ||
      !op.payload || typeof op.payload !== 'object' || Array.isArray(op.payload) ||
      op.payload.id !== op.operationId ||
      (op.payload.tenantId !== undefined && op.payload.tenantId !== op.tenantId) ||
      (op.payload.branchId !== undefined && op.payload.branchId !== op.branchId) ||
      !Number.isFinite(Date.parse(op.createdAt))) {
    throw new OfflineLedgerConflict('Offline transaction has a malformed idempotency key or payload.');
  }
  const computedDigest = await offlinePayloadDigest(op.payload);
  if (computedDigest !== op.payloadDigest) {
    throw new OfflineLedgerConflict('Offline transaction content changed after signing its digest.');
  }
}

export async function withOfflineLedgerTransaction<T>(
  pool: OfflineSqlPool,
  fn: (tx: OfflineSqlClient) => Promise<T>,
): Promise<T> {
  const tx = await pool.connect();
  let began = false;
  try {
    await tx.query('BEGIN');
    began = true;
    const value = await fn(tx);
    await tx.query('COMMIT');
    return value;
  } catch (error) {
    if (began) {
      try { await tx.query('ROLLBACK'); }
      catch (rollbackError) {
        // Unknown commit outcome: replay the SAME immutable key; the unique
        // ledger will answer from the first durable transaction if it landed.
        console.error('[native-ledger] rollback could not be verified', rollbackError);
      }
    }
    throw error;
  } finally {
    tx.release();
  }
}

function assertImmutableMatch(saved: any, incoming: OfflineCommand): void {
  const storedPayload = canonicalOfflinePayload(saved.payload);
  const incomingPayload = canonicalOfflinePayload(incoming.payload);
  if (saved.tenant_id !== incoming.tenantId ||
    saved.branch_id !== incoming.branchId ||
    saved.actor_id !== incoming.actorId ||
    saved.device_id !== incoming.deviceId ||
    saved.operation_id !== incoming.operationId ||
    saved.operation_type !== incoming.type ||
    saved.idempotency_key !== incoming.idempotencyKey ||
    saved.payload_digest !== incoming.payloadDigest ||
    saved.base_snapshot_revision !== incoming.baseSnapshotRevision ||
    Number(saved.client_sequence) !== incoming.clientSequence ||
    storedPayload !== incomingPayload) {
    throw new OfflineLedgerConflict('Duplicate operation id with different content or scope.');
  }
}

/**
 * "Exactly once" is achieved by a tenant-level database lock + unique ledger
 * key + one database transaction containing BOTH stock and Treasury effects.
 *
 * No production endpoint calls this until the schema and callback implementation
 * have been reviewed on staging and all branch/role cases have passed.
 */
export async function acceptNativeOfflineCommand(
  pool: OfflineSqlPool,
  caller: VerifiedOfflineCaller,
  op: OfflineCommand,
  callbacks: OfflineServerCallbacks,
): Promise<ServerReceipt> {
  await validateEnvelope(caller, op);
  return withOfflineLedgerTransaction(pool, async tx => {
    await callbacks.verifyFreshPermissions(tx, caller, op);

    // Existing online Sales/Purchases RPCs lock this exact workspace first.
    // Lock order MUST remain tenant workspace -> operation -> stock/Treasury
    // in every competing command to avoid deadlocks or stale snapshots.
    const lock = await tx.query(
      'SELECT tenant_id FROM public.tenant_workspaces WHERE tenant_id = $1::uuid FOR UPDATE',
      [caller.tenantId],
    );
    if (lock.rows.length !== 1) {
      throw new OfflineLedgerConflict('Tenant workspace is unavailable.');
    }

    await tx.query(
      `INSERT INTO private.native_offline_operation_ledger
         (tenant_id, branch_id, actor_id, device_id, operation_id, operation_type,
          idempotency_key, payload_digest, payload, base_snapshot_revision,
          client_sequence, client_created_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,
               $7::text,$8::text,$9::jsonb,$10::text,$11::bigint,$12::timestamptz)
       ON CONFLICT DO NOTHING`,
      [op.tenantId,op.branchId,op.actorId,op.deviceId,op.operationId,op.type,
       op.idempotencyKey,op.payloadDigest,JSON.stringify(op.payload),
       op.baseSnapshotRevision,op.clientSequence,op.createdAt],
    );
    const found = await tx.query(
      `SELECT tenant_id::text, branch_id::text, actor_id::text, device_id,
              operation_id, operation_type, idempotency_key, payload_digest,
              payload, base_snapshot_revision, client_sequence, status, receipt
         FROM private.native_offline_operation_ledger
        WHERE tenant_id=$1::uuid AND idempotency_key=$2::text FOR UPDATE`,
      [op.tenantId,op.idempotencyKey],
    );
    if (found.rows.length !== 1) {
      // Another idempotency key may have claimed the same (tenant,type,ID).
      throw new OfflineLedgerConflict('Transaction id is already used by another operation.');
    }
    const saved = found.rows[0];
    assertImmutableMatch(saved, op);
    if (saved.status === 'committed') {
      // Return the original immutable receipt. Even if the HTTP response was
      // lost, no second inventory or cash posting occurs.
      if (!saved.receipt) throw new OfflineLedgerConflict('Committed row has no durable receipt.');
      return saved.receipt as ServerReceipt;
    }
    if (saved.status !== 'claimed') {
      throw new OfflineLedgerConflict('Unknown server operation state.');
    }

    const effects = await callbacks.applyAtomicEffects(tx, op);
    if (!effects.treasuryCommitted || (op.type !== 'expense' && !effects.inventoryCommitted)) {
      // This error aborts the WHOLE transaction. No "business successful but
      // money failed" row can be committed by this command.
      throw new OfflineLedgerConflict('Financial or inventory side effects not completed.');
    }

    const revision = await tx.query(
      'SELECT gen_random_uuid()::text AS server_revision, clock_timestamp() AS server_committed_at',
    );
    const metadata = revision.rows[0];
    if (!metadata?.server_revision || !metadata?.server_committed_at) {
      throw new OfflineLedgerConflict('Could not obtain authoritative server receipt metadata.');
    }
    const receipt: ServerReceipt = {
      tenantId: op.tenantId,
      branchId: op.branchId,
      actorId: op.actorId,
      deviceId: op.deviceId,
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      payloadDigest: op.payloadDigest,
      type: op.type,
      status: 'committed',
      inventoryCommitted: op.type === 'expense' ? false : effects.inventoryCommitted,
      treasuryCommitted: effects.treasuryCommitted,
      serverRevision: String(metadata.server_revision),
      serverCommittedAt: new Date(metadata.server_committed_at).toISOString(),
    };
    const updated = await tx.query(
      `UPDATE private.native_offline_operation_ledger
          SET status='committed', committed_at=$3::timestamptz, receipt=$4::jsonb
        WHERE tenant_id=$1::uuid AND idempotency_key=$2::text AND status='claimed'
        RETURNING idempotency_key`,
      [op.tenantId,op.idempotencyKey,receipt.serverCommittedAt,JSON.stringify(receipt)],
    );
    if (updated.rows.length !== 1) throw new OfflineLedgerConflict('Could not store committed server receipt.');
    return receipt;
  });
}
