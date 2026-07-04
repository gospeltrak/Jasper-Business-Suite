/**
 * offlineSync.ts — Secure offline-first data layer
 *
 * DESIGN:
 * 1. ALL registrations must go online first (block if offline)
 * 2. Operational data (promo edits, tasks, meetings) work offline
 *    and sync when network returns
 * 3. localStorage is keyed per-account to prevent data mixing
 * 4. Sensitive data is namespaced so different accounts on the
 *    same browser never see each other's data
 */

import { getSecureDataBridgeClient } from '../secureDataBridge';

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
    const raw = localStorage.getItem(accountKey(accountId, dataType));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setAccountData(accountId: string, dataType: string, data: any): void {
  try {
    localStorage.setItem(accountKey(accountId, dataType), JSON.stringify(data));
  } catch { /* storage full */ }
}

export function clearAccountData(accountId: string): void {
  // Clear only this account's data — leave other accounts untouched
  const prefix = `aff_data_${accountId}_`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

// ─── Offline sync queue ────────────────────────────────────────────────────
// When offline, mutations are queued per-account and replayed when online

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
  try {
    const queue: SyncQueueItem[] = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    queue.push({
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      createdAt: new Date().toISOString(),
      retries: 0,
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* storage full */ }
}

export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 };

  const queue: SyncQueueItem[] = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: SyncQueueItem[] = [];

  try {
    const client: any = await getSecureDataBridgeClient();

    for (const item of queue) {
      try {
        if (item.operation === 'insert') {
          await client.from(item.table).insert(item.data);
        } else if (item.operation === 'update' && item.filter) {
          await client.from(item.table).update(item.data).eq(item.filter.column, item.filter.value);
        } else if (item.operation === 'upsert') {
          await client.from(item.table).upsert(item.data);
        }
        synced++;
      } catch {
        item.retries++;
        if (item.retries < 5) {
          remaining.push(item); // retry up to 5 times
        } else {
          failed++; // discard after 5 retries
        }
      }
    }
  } catch {
    // Supabase unavailable — keep all items in queue
    return { synced: 0, failed: 0 };
  }

  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
  return { synced, failed };
}

// ─── Smart DB write — online writes directly, offline queues ──────────────

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
      if (operation === 'insert') {
        await client.from(table).insert(data);
      } else if (operation === 'update' && filter) {
        await client.from(table).update(data).eq(filter.column, filter.value);
      } else if (operation === 'upsert') {
        await client.from(table).upsert(data);
      }
      return { success: true, queued: false };
    } catch (e: any) {
      // DB write failed even though online — queue it
      enqueueSyncItem({ table, operation, data, filter, accountId });
      return { success: false, queued: true, error: e?.message };
    }
  } else {
    // Offline — queue for later
    enqueueSyncItem({ table, operation, data, filter, accountId });
    return { success: false, queued: true };
  }
}

// ─── Initialize online event listener ─────────────────────────────────────

let syncListenerAttached = false;

export function initOfflineSync(onSynced?: (result: { synced: number; failed: number }) => void): void {
  if (syncListenerAttached) return;
  syncListenerAttached = true;

  window.addEventListener('online', async () => {
    const result = await flushSyncQueue();
    if (result.synced > 0 && onSynced) {
      onSynced(result);
    }
  });

  // Also try to flush on page focus (user switches back to tab)
  window.addEventListener('focus', async () => {
    if (isOnline()) {
      const result = await flushSyncQueue();
      if (result.synced > 0 && onSynced) {
        onSynced(result);
      }
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
  localStorage.setItem('jasper_logged_affiliate', JSON.stringify(session));
  // Per-account key for isolation
  setAccountData(session.id, 'session', session);
}

/** Get the current session — validates it belongs to the right account */
export function getAffiliateSession(expectedId?: string): AffiliateSession | null {
  try {
    const raw = localStorage.getItem('jasper_logged_affiliate');
    if (!raw) return null;
    const session: AffiliateSession = JSON.parse(raw);
    // If an expected ID is given, verify it matches (prevents cross-account leakage)
    if (expectedId && session.id !== expectedId) return null;
    return session;
  } catch { return null; }
}

/** Clear session on logout */
export function clearAffiliateSession(): void {
  localStorage.removeItem('jasper_logged_affiliate');
}

/** Get the immersive affiliates list — returns only records relevant to current session */
export function getImmersiveAffiliates(currentAccountId?: string): any[] {
  try {
    const raw = localStorage.getItem('saas_immersive_affiliates');
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
