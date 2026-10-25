import type { NativeJournalEntry, NativeJournalScope, NativeJournalStatus } from './offlineJournal';
import {
  evaluateServerResponse,
  type ServerReceipt,
  type SyncResponse,
} from './offlineConflictEngine';

/**
 * Injectable sync boundary for native-only offline operations.
 *
 * The default implementation deliberately has NO production transport: the
 * server still needs an authoritative idempotency ledger, stock grants and
 * atomic Treasury integration. No business transaction is uploaded by merely
 * importing this file.
 *
 * A store must use transactional, durable writes. commitReceipt MUST verify
 * the receipt against the exact stored entry atomically (no ordinary JS flag).
 */
export interface NativeSyncStore {
  list(scope: NativeJournalScope): Promise<NativeJournalEntry[]>;
  transition(entry: NativeJournalEntry, status: Exclude<NativeJournalStatus, 'complete'>, reason?: string): Promise<void>;
  commitReceipt(entry: NativeJournalEntry, receipt: ServerReceipt): Promise<void>;
}
export interface NativeSyncTransport {
  submit(entry: Readonly<NativeJournalEntry>): Promise<SyncResponse>;
}
export interface NativeSyncPreconditions {
  online(): boolean;
  /** Fetch a fresh, currently valid server session for this exact staff/tenant.
   * Cached local credentials must never authorize uploading business writes.
   */
  verifyOnlineSession(scope: NativeJournalScope): Promise<boolean>;
}
export interface NativeSyncDependencies {
  store: NativeSyncStore;
  transport: NativeSyncTransport;
  checks: NativeSyncPreconditions;
}
export interface NativeSyncSummary {
  scanned: number;
  completed: number;
  retrying: number;
  needsReview: number;
  blocked: number;
  skipped: number;
  interrupted: boolean;
  reason?: string;
}

const activeScopes = new Set<string>();
const scopeKey = (scope: NativeJournalScope) =>
  [scope.tenantId, scope.branchId, scope.actorId, scope.deviceId].join('\u001f');

function sameScope(scope: NativeJournalScope, op: NativeJournalEntry): boolean {
  return scope.tenantId === op.tenantId && scope.branchId === op.branchId
    && scope.actorId === op.actorId && scope.deviceId === op.deviceId;
}
function isQueued(status: NativeJournalStatus): boolean {
  // "syncing" may mean a crashed previous process or a lost response.
  // Retry safely with the SAME idempotency key and immutable payload.
  return status === 'pending' || status === 'syncing' ||
    status === 'retry_wait' || status === 'cloud_committed';
}
const emptySummary = (): NativeSyncSummary => ({
  scanned: 0, completed: 0, retrying: 0, needsReview: 0,
  blocked: 0, skipped: 0, interrupted: false,
});

/**
 * Execute only a single bounded pass. Scheduling, authentication refresh and
 * connectivity events belong to the native app integration.
 *
 * Never clears a pending operation. Never applies cached stock balances.
 * Failure to persist a receipt after a server commit is recoverable through
 * the server's immutable idempotency key on the next pass.
 */
export async function syncNativeOperations(
  scope: NativeJournalScope,
  { store, transport, checks }: NativeSyncDependencies,
): Promise<NativeSyncSummary> {
  const result = emptySummary();
  if (![scope.tenantId, scope.branchId, scope.actorId, scope.deviceId].every(Boolean)) {
    return { ...result, interrupted: true, reason: 'missing_scope' };
  }
  const lock = scopeKey(scope);
  if (activeScopes.has(lock)) {
    return { ...result, interrupted: true, reason: 'sync_already_running' };
  }
  activeScopes.add(lock);
  try {
    if (!checks.online()) return { ...result, interrupted: true, reason: 'offline' };
    // Explicitly require fresh authorization before any network upload.
    if (!await checks.verifyOnlineSession(scope)) {
      return { ...result, interrupted: true, reason: 'session_not_verified' };
    }
    const entries = await store.list(scope);
    const pending = entries
      .filter(e => isQueued(e.status))
      .sort((a, b) => a.clientSequence - b.clientSequence ||
        a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key));

    for (const entry of pending) {
      result.scanned++;
      if (!sameScope(scope, entry)) {
        // A badly scoped or corrupted journal index is a SECURITY failure.
        // Never upload it using another cashier's or tenant's credentials.
        result.blocked++;
        result.interrupted = true;
        result.reason = 'journal_scope_mismatch';
        break;
      }
      if (!checks.online()) {
        result.interrupted = true;
        result.reason = 'offline_during_sync';
        break;
      }
      if (!await checks.verifyOnlineSession(scope)) {
        result.interrupted = true;
        result.reason = 'session_expired_during_sync';
        break;
      }

      // If this write fails, no POST occurs; the operation remains unchanged.
      await store.transition(entry, 'syncing');
      let response: SyncResponse;
      try {
        response = await transport.submit(entry);
      } catch {
        // A request may have committed on the server before the response was
        // lost. Retrying the same idempotency key is the only safe recovery.
        response = { networkFailed: true };
      }
      const decision = evaluateServerResponse(entry, response, entry.attempts);
      if (decision.outcome === 'complete') {
        // If this durable acknowledgement fails, surface the error; DO NOT
        // delete/clear the row and DO NOT generate a fresh operation ID.
        await store.commitReceipt(entry, response.receipt!);
        result.completed++;
      } else if (decision.outcome === 'retry_wait') {
        await store.transition(entry, 'retry_wait', decision.code);
        result.retrying++;
      } else if (decision.outcome === 'needs_review') {
        await store.transition(entry, 'needs_review', decision.code);
        result.needsReview++;
      } else {
        await store.transition(entry, 'blocked', decision.code);
        result.blocked++;
        if (decision.code === 'access_revoked_or_session_expired' ||
            decision.code === 'receipt_identity_mismatch') {
          result.interrupted = true;
          result.reason = decision.code;
          break;
        }
      }
    }
    result.skipped = entries.length - result.scanned;
    return result;
  } finally {
    activeScopes.delete(lock);
  }
}
