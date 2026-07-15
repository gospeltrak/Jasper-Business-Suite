/**
 * offlineSync.ts — Secure online-only data layer
 *
 * DESIGN:
 * 1. ALL registrations must go online first (block if offline)
 * 2. Offline business mutations are preserved only for manual audit/recovery
 *    and are never replayed automatically.
 * 3. onlineStorage is keyed per-account to prevent data mixing
 * 4. Sensitive data is namespaced so different accounts on the
 *    same browser never see each other's data
 */

import { getSecureDataBridgeClient } from '../secureDataBridge';
import { ONLINE_ONLY_WRITE_MESSAGE, warnOfflineWriteBlocked } from './onlineOnly';

// ─── Network status ────────────────────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine;
}

export function requireOnline(): void {
  if (!isOnline()) {
    throw new Error('Mtandao haupatikani. Tafadhali unganisha intaneti ili kuendelea na usajili. / No internet connection. Registration requires an internet connection.');
  }
}

// ─── Per-account secure storage keys ──────────────────────────────────────
// Each account gets its own namespace so different users on the
// same browser never see each other's data

export function accountKey(accountId: string, dataType: string): string {
  // e.g. 'aff_data_aff-123_profile'
  return `aff_data_${accountId}_${dataType}`;
}

export function getAccountData<T>(accountId: string, dataType: string): T | null {
  try {
    const raw = onlineStorage.getItem(accountKey(accountId, dataType));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setAccountData(accountId: string, dataType: string, data: any): void {
  try {
    onlineStorage.setItem(accountKey(accountId, dataType), JSON.stringify(data));
  } catch { /* storage full */ }
}

export function clearAccountData(accountId: string): void {
  // Clear only this account's data — leave other accounts untouched
  const prefix = `aff_data_${accountId}_`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < onlineStorage.length; i++) {
    const key = onlineStorage.key(i);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => onlineStorage.removeItem(k));
}

// ─── Legacy offline sync queue ──────────────────────────────────────────────
// Online-only mode preserves legacy queue records but never replays them.

interface SyncQueueItem {
  id: string;
  accountId: string;
  table: string;
  operation: 'insert' | 'update' | 'upsert';
  data: Record<string, any>;
  filter?: { column: string; value: string };
  createdAt: string;
  retries: number;
}

const SYNC_QUEUE_KEY = 'jasper_offline_sync_queue';

export function enqueueSyncItem(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>): void {
  warnOfflineWriteBlocked(`enqueueSyncItem:${item.table}/${item.operation}`);
}

export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  // Online-only mode keeps legacy queued items for manual audit/recovery but
  // never replays stale browser mutations automatically.
  warnOfflineWriteBlocked('flushSyncQueue:legacy-queue');
  return { synced: 0, failed: 0 };
}

// ─── Smart DB write — online writes directly, offline writes are blocked ────

export async function dbWrite(
  table: string,
  operation: 'insert' | 'update' | 'upsert',
  data: Record<string, any>,
  filter?: { column: string; value: string },
  accountId = 'system'
): Promise<{ success: boolean; queued: boolean; error?: string }> {
	  if (isOnline()) {
	    try {
	      const client: any = await getSecureDataBridgeClient();
	      let result: any = null;
	      if (operation === 'insert') {
	        result = await client.from(table).insert(data);
	      } else if (operation === 'update' && filter) {
	        result = await client.from(table).update(data).eq(filter.column, filter.value);
	      } else if (operation === 'upsert') {
	        result = await client.from(table).upsert(data);
	      }
	      if (result?.error) throw result.error;
	      return { success: true, queued: false };
	    } catch (e: any) {
      warnOfflineWriteBlocked(`dbWrite:${table}/${operation}`);
      return { success: false, queued: false, error: e?.message || ONLINE_ONLY_WRITE_MESSAGE };
    }
  } else {
    warnOfflineWriteBlocked(`dbWrite:${table}/${operation}`);
    return { success: false, queued: false, error: ONLINE_ONLY_WRITE_MESSAGE };
  }
}

// ─── Initialize online event listener ─────────────────────────────────────

let syncListenerAttached = false;

export function initOfflineSync(onSynced?: (result: { synced: number; failed: number }) => void): void {
  if (syncListenerAttached) return;
  syncListenerAttached = true;

  window.addEventListener('online', async () => {
    await flushSyncQueue();
  });

  // Also try to flush on page focus (user switches back to tab)
  window.addEventListener('focus', async () => {
    if (isOnline()) {
      await flushSyncQueue();
    }
  });
}

// ─── Affiliate-specific account isolation helpers ─────────────────────────

export interface AffiliateSession {
  id: string;
  name: string;
  phone: string;
  promoCode: string;
  isSuper: boolean;
  paymentMethod: string;
  payoutPhone?: string;
  tinNumber?: string;
  nidaNumber?: string;
  parentSuperId?: string;
  _loggedInAt: string;
  _portalRole: 'partner' | 'affiliate';
}

/** Save the currently logged-in affiliate session — isolated by account ID */
export function saveAffiliateSession(session: AffiliateSession): void {
  // Global key for "who is logged in"
  onlineStorage.setItem('jasper_logged_affiliate', JSON.stringify(session));
  // Per-account key for isolation
  setAccountData(session.id, 'session', session);
}

/** Get the current session — validates it belongs to the right account */
export function getAffiliateSession(expectedId?: string): AffiliateSession | null {
  try {
    const raw = onlineStorage.getItem('jasper_logged_affiliate');
    if (!raw) return null;
    const session: AffiliateSession = JSON.parse(raw);
    // If an expected ID is given, verify it matches (prevents cross-account leakage)
    if (expectedId && session.id !== expectedId) return null;
    return session;
  } catch { return null; }
}

/** Clear session on logout */
export function clearAffiliateSession(): void {
  onlineStorage.removeItem('jasper_logged_affiliate');
}

/** Get the immersive affiliates list — returns only records relevant to current session */
export function getImmersiveAffiliates(currentAccountId?: string): any[] {
  try {
    const raw = onlineStorage.getItem('saas_immersive_affiliates');
    if (!raw) return [];
    const all: any[] = JSON.parse(raw);
    // Super Admin sees all — no filter
    if (!currentAccountId) return all;
    // Partner sees only their sub-affiliates
    return all.filter(a =>
      a.id === currentAccountId ||
      a.parentSuperId === currentAccountId ||
      a.isSuper === true
    );
  } catch { return []; }
}
