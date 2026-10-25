import {
  listNativeOperations, updateNativeOperationStatus, completeNativeOperationFromReceipt,
  type NativeJournalScope,
} from './offlineJournal';
import type { NativeSyncStore } from './offlineSyncCoordinator';

/**
 * Durable storage adapter for the sync state machine. This is deliberately
 * NOT an initialized background service and cannot call production APIs:
 * server-side idempotency ledger/grant issuance is not deployed yet.
 */
export const createNativeJournalSyncStore = (): NativeSyncStore => ({
  list: (scope: NativeJournalScope) => listNativeOperations(scope),
  transition: (entry, status, reason) => updateNativeOperationStatus({
    tenantId: entry.tenantId,
    branchId: entry.branchId,
    actorId: entry.actorId,
    deviceId: entry.deviceId,
  }, entry.type, entry.operationId, status, reason),
  commitReceipt: (entry, receipt) => completeNativeOperationFromReceipt(entry, receipt),
});
