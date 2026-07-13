/**
 * superAdminPlatformRecords.ts
 * 
 * Stores SaaS platform data (hardware inventory, POS products, sales, etc.)
 * directly in Supabase tenant_data table using 'saas-global' as the tenant_id.
 * Online-only writes: localStorage is read/cache only and offline queues are
 * preserved for manual audit instead of replayed automatically.
 */

import { getSecureDataBridgeClient } from '../secureDataBridge';
import { ONLINE_ONLY_WRITE_MESSAGE, canWriteBusinessDataOnline, warnOfflineWriteBlocked } from './onlineOnly';

const GLOBAL_SCOPE = 'saas-global';

// ─── localStorage cache key ─────────────────────────────────────────────────
function localKey(recordType: string, scopeId: string): string {
  return `jasper_platform_${recordType}_${scopeId}`;
}

const safeRecordToken = (value: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(value);

async function getAccessToken(): Promise<string | null> {
  try {
    const client: any = await getSecureDataBridgeClient();
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

async function fetchPublicPlatformRecord<T>(recordType: string, scopeId: string): Promise<T | undefined> {
  if (!safeRecordToken(recordType) || !safeRecordToken(scopeId)) return undefined;
  try {
    const res = await fetch(`/api/platform-records/${encodeURIComponent(recordType)}/${encodeURIComponent(scopeId)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.payload as T;
  } catch {
    return undefined;
  }
}

async function fetchSuperAdminPlatformRecord<T>(recordType: string, scopeId: string): Promise<T | undefined> {
  if (!safeRecordToken(recordType) || !safeRecordToken(scopeId)) return undefined;
  const token = await getAccessToken();
  if (!token) return undefined;
  try {
    const res = await fetch(`/api/super-admin/platform-records?type=${encodeURIComponent(recordType)}&scope=${encodeURIComponent(scopeId)}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.records?.[0]?.payload as T;
  } catch {
    return undefined;
  }
}

// ─── Load from Supabase, fallback to localStorage cache ─────────────────────
export async function loadPlatformRecord<T>(
  recordType: string,
  scopeId = GLOBAL_SCOPE,
  fallback: T
): Promise<T> {
  const scope = scopeId || GLOBAL_SCOPE;

  const serverRecord = await fetchPublicPlatformRecord<T>(recordType, scope)
    ?? await fetchSuperAdminPlatformRecord<T>(recordType, scope);
  if (serverRecord !== undefined && serverRecord !== null) {
    try {
      localStorage.setItem(localKey(recordType, scope), JSON.stringify(serverRecord));
    } catch { /* storage full */ }
    return serverRecord as T;
  }

  // Legacy fallback for older deployments/data before platform records moved
  // behind protected server APIs.
  try {
    const client: any = await getSecureDataBridgeClient();
    const { data, error } = await client
      .from('tenant_data')
      .select('payload')
      .eq('tenant_id', GLOBAL_SCOPE)
      .eq('data_key', `${recordType}__${scope}`)
      .maybeSingle();

    if (!error && data?.payload !== undefined) {
      // Cache to localStorage for fast reads only.
      try {
        localStorage.setItem(localKey(recordType, scope), JSON.stringify(data.payload));
      } catch { /* storage full */ }
      return data.payload as T;
    }
  } catch { /* offline */ }

  // Read-only fallback to existing localStorage cache.
  try {
    const cached = localStorage.getItem(localKey(recordType, scope));
    if (cached) return JSON.parse(cached) as T;
  } catch { /* parse error */ }

  return fallback;
}

// ─── Save to Supabase, then refresh localStorage cache ──────────────────────
export async function savePlatformRecord<T>(
  recordType: string,
  scopeId: string,
  value: T
): Promise<T> {
  const scope = scopeId || GLOBAL_SCOPE;
  if (!safeRecordToken(recordType) || !safeRecordToken(scope)) {
    throw new Error('Invalid platform record key.');
  }

  if (!canWriteBusinessDataOnline()) {
    warnOfflineWriteBlocked(`savePlatformRecord:${recordType}/${scope}`);
    throw new Error(ONLINE_ONLY_WRITE_MESSAGE);
  }

  // Save through the protected Super Admin API. Browser clients must never
  // write global platform records directly into tenant_data.
  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Super Admin login is required.');
    const res = await fetch(`/api/super-admin/platform-records/${encodeURIComponent(recordType)}/${encodeURIComponent(scope)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ payload: value })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Platform record could not be saved.');
    const saved = (data?.record?.payload ?? value) as T;
    try {
      localStorage.setItem(localKey(recordType, scope), JSON.stringify(saved));
    } catch { /* storage full */ }
    return saved;
  } catch (error) {
    console.warn('[platform-records] secure save failed:', error);
    throw error instanceof Error ? error : new Error('Platform record could not be saved securely.');
  }

  return value;
}

// ─── Delete from Supabase and localStorage ────────────────────────────────
export async function deletePlatformRecord(
  recordType: string,
  scopeId = GLOBAL_SCOPE
): Promise<void> {
  if (!safeRecordToken(recordType) || !safeRecordToken(scopeId)) {
    throw new Error('Invalid platform record key.');
  }

  try {
    if (!canWriteBusinessDataOnline()) {
      warnOfflineWriteBlocked(`deletePlatformRecord:${recordType}/${scopeId}`);
      throw new Error(ONLINE_ONLY_WRITE_MESSAGE);
    }
    const token = await getAccessToken();
    if (!token) throw new Error('Super Admin login is required.');
    const res = await fetch(`/api/super-admin/platform-records/${encodeURIComponent(recordType)}/${encodeURIComponent(scopeId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Platform record could not be deleted securely.');
    localStorage.removeItem(localKey(recordType, scopeId));
  } catch (error) {
    console.warn('[platform-records] secure delete failed:', error);
    throw error instanceof Error ? error : new Error('Platform record could not be deleted securely.');
  }
}

// ─── Preserve legacy offline queue without replaying it ─────────────────────
export async function flushPlatformRecordQueue(): Promise<void> {
  warnOfflineWriteBlocked('flushPlatformRecordQueue:legacy-queue');
}

// Attach online listener once
let _listenerAttached = false;
export function initPlatformSync(): void {
  if (_listenerAttached) return;
  _listenerAttached = true;
  window.addEventListener('online', () => flushPlatformRecordQueue());
  window.addEventListener('focus', () => { if (navigator.onLine) flushPlatformRecordQueue(); });
}

// ─── Default hardware inventory ───────────────────────────────────────────
export const defaultHardwareInventory = [
  { id: 'item-1', name: 'Ndiva POS Thermal Printer', category: 'Printer',  stock: 0, price: 150000 },
  { id: 'item-2', name: 'Barcode Scanner',            category: 'Scanner',  stock: 0, price: 80000  },
  { id: 'item-3', name: 'Tablet + Standing Set',      category: 'Tablet',   stock: 0, price: 250000 },
  { id: 'item-4', name: 'Complete System Set',        category: 'Bundle',   stock: 0, price: 450000 },
];
