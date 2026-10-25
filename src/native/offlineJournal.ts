import { Capacitor } from '@capacitor/core';

export type NativeOperationType = 'sale' | 'purchase' | 'expense';
export type NativeJournalStatus = 'pending' | 'syncing' | 'retry_wait' | 'needs_review' | 'blocked' | 'cloud_committed' | 'complete';

export interface NativeJournalScope {
  tenantId: string;
  branchId: string;
  actorId: string;
  deviceId: string;
}
export interface NativeJournalEntry<T = unknown> extends NativeJournalScope {
  key: string;
  operationId: string;
  idempotencyKey: string;
  baseSnapshotRevision: string;
  clientSequence: number;
  type: NativeOperationType;
  createdAt: string;
  status: NativeJournalStatus;
  payload: T;
  attempts: number;
  lastError?: string;
}

const DATABASE = 'orvix-native-operations-v1';
const STORE = 'journal';
const VERSION = 2;

export function assertNativeJournalAccess(scope: NativeJournalScope): void {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Offline business writes are available only in the installed Android/iOS app.');
  }
  // Android can request persistent WebView storage; iOS can silently evict its
  // IndexedDB. Do not claim an iOS transaction is durable until the native
  // SQLite/SQLCipher adapter has been tested on a real device.
  if (Capacitor.getPlatform() === 'ios') {
    throw new Error('Offline entry is disabled on iOS until durable native SQLite storage is verified.');
  }
  if (!scope.tenantId || !scope.branchId || !scope.actorId || !scope.deviceId) {
    throw new Error('A verified user, tenant and selected branch are required for offline writes.');
  }
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Native journal storage is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) {
        // Existing staging journal is never cleared; upgrade the index in place.
        const existing = request.transaction!.objectStore(STORE);
        if (existing.indexNames.contains('scope')) existing.deleteIndex('scope');
        existing.createIndex('scope', ['tenantId', 'actorId', 'branchId', 'deviceId'], { unique: false });
      } else {
        const journal = db.createObjectStore(STORE, { keyPath: 'key' });
        journal.createIndex('scope', ['tenantId', 'actorId', 'branchId', 'deviceId'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open native journal.'));
    request.onblocked = () => reject(new Error('Native journal upgrade is blocked by another app instance.'));
  });
}

function inStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result!: T;
    let settled = false;
    const success = (value: T) => { result = value; };
    tx.oncomplete = () => {
      db.close();
      if (!settled) resolve(result);
      settled = true;
    };
    tx.onabort = () => {
      db.close();
      if (!settled) reject(tx.error || new Error('Offline journal transaction rolled back.'));
      settled = true;
    };
    tx.onerror = () => { /* onabort reports the failure reliably */ };
    try { run(tx.objectStore(STORE), success, reject); }
    catch (error) { tx.abort(); reject(error instanceof Error ? error : new Error(String(error))); }
  }));
}

export function journalKey(scope: NativeJournalScope, type: NativeOperationType, operationId: string): string {
  const safeId = String(operationId || '').trim();
  if (!safeId) throw new Error('Offline transaction id is required.');
  return [scope.tenantId, scope.actorId, scope.branchId, scope.deviceId, type, safeId].join('::');
}

/**
 * The write resolves only after the IndexedDB transaction commits. No UI must
 * display a successful receipt before this promise resolves. A duplicate ID
 * is rejected instead of overwriting the original customer transaction.
 */
export async function stageNativeOperation<T extends { id: string; tenantId?: string; branchId?: string }>(
  scope: NativeJournalScope,
  type: NativeOperationType,
  payload: T,
  metadata: { baseSnapshotRevision: string; clientSequence: number },
): Promise<NativeJournalEntry<T>> {
  assertNativeJournalAccess(scope);
  if (!payload?.id || (payload.tenantId && payload.tenantId !== scope.tenantId)
      || (payload.branchId && payload.branchId !== scope.branchId)) {
    throw new Error('Offline transaction has missing id or belongs to a different tenant/branch.');
  }
  if (!metadata?.baseSnapshotRevision || !Number.isSafeInteger(metadata.clientSequence) || metadata.clientSequence < 1) {
    throw new Error('An authoritative server snapshot revision and device sequence are required.');
  }
  const entry: NativeJournalEntry<T> = {
    ...scope, type, key: journalKey(scope, type, payload.id),
    operationId: payload.id,
    idempotencyKey: [scope.tenantId, scope.branchId, scope.deviceId, type, payload.id].join(':'),
    baseSnapshotRevision: metadata.baseSnapshotRevision,
    clientSequence: metadata.clientSequence, payload,
    createdAt: new Date().toISOString(), status: 'pending', attempts: 0,
  };
  // Best effort to pin storage on Android. Do not treat rejection as success.
  if (navigator.storage?.persist) {
    const persisted = await navigator.storage.persist();
    if (!persisted) {
      throw new Error('Device storage is not persistent. Offline transaction not accepted.');
    }
  } else {
    throw new Error('Device cannot guarantee persistent offline storage.');
  }
  await inStore<void>('readwrite', (store, resolve) => {
    const request = store.add(entry);
    request.onsuccess = () => resolve(undefined);
  });
  return entry;
}

export async function listNativeOperations(scope: NativeJournalScope): Promise<NativeJournalEntry[]> {
  assertNativeJournalAccess(scope);
  return inStore<NativeJournalEntry[]>('readonly', (store, resolve) => {
    const request = store.index('scope').getAll([scope.tenantId, scope.actorId, scope.branchId, scope.deviceId]);
    request.onsuccess = () => {
      resolve((request.result || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    };
  });
}

/** An operation is not deleted from the device when the API first accepts it.
 * Treasury and stock reconciliation must both complete before status=complete.
 */
export async function updateNativeOperationStatus(
  scope: NativeJournalScope,
  type: NativeOperationType,
  operationId: string,
  status: NativeJournalStatus,
  lastError?: string,
): Promise<void> {
  assertNativeJournalAccess(scope);
  if (status === 'complete') {
    throw new Error('Completion requires an independently validated authoritative server receipt.');
  }
  const key = journalKey(scope, type, operationId);
  await inStore<void>('readwrite', (store, resolve) => {
    const request = store.get(key);
    request.onsuccess = () => {
      const old = request.result as NativeJournalEntry | undefined;
      if (!old) {
        store.transaction.abort();
        return;
      }
      if (old.status === 'complete') {
        store.transaction.abort();
        return;
      }
      const updated: NativeJournalEntry = {
        ...old, status, attempts: old.attempts + 1, ...(lastError ? { lastError } : {}),
      };
      const put = store.put(updated);
      put.onsuccess = () => resolve(undefined);
    };
  });
}
