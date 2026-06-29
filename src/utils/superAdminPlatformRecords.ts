/**
 * superAdminPlatformRecords.ts
 * 
 * Stores SaaS platform data (hardware inventory, POS products, sales, etc.)
 * directly in Supabase tenant_data table using 'saas-global' as the tenant_id.
 * Falls back to localStorage when offline and syncs when back online.
 */

import { getDynamicSupabaseClient } from '../supabaseClient';

const GLOBAL_SCOPE = 'saas-global';

// ─── localStorage fallback key ─────────────────────────────────────────────
function localKey(recordType: string, scopeId: string): string {
  return `jasper_platform_${recordType}_${scopeId}`;
}

// ─── Load from Supabase, fallback to localStorage ─────────────────────────
export async function loadPlatformRecord<T>(
  recordType: string,
  scopeId = GLOBAL_SCOPE,
  fallback: T
): Promise<T> {
  // Try Supabase first
  try {
    const client: any = await getDynamicSupabaseClient();
    const { data, error } = await client
      .from('tenant_data')
      .select('payload')
      .eq('tenant_id', GLOBAL_SCOPE)
      .eq('data_key', `${recordType}__${scopeId}`)
      .maybeSingle();

    if (!error && data?.payload !== undefined) {
      // Cache to localStorage for offline use
      try {
        localStorage.setItem(localKey(recordType, scopeId), JSON.stringify(data.payload));
      } catch { /* storage full */ }
      return data.payload as T;
    }
  } catch { /* offline */ }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(localKey(recordType, scopeId));
    if (cached) return JSON.parse(cached) as T;
  } catch { /* parse error */ }

  return fallback;
}

// ─── Save to Supabase AND localStorage ────────────────────────────────────
export async function savePlatformRecord<T>(
  recordType: string,
  scopeId: string,
  value: T
): Promise<T> {
  const key = `${recordType}__${scopeId || GLOBAL_SCOPE}`;
  const scope = scopeId || GLOBAL_SCOPE;

  // Always save to localStorage immediately (works offline)
  try {
    localStorage.setItem(localKey(recordType, scope), JSON.stringify(value));
  } catch { /* storage full */ }

  // Save to Supabase
  try {
    const client: any = await getDynamicSupabaseClient();
    await client
      .from('tenant_data')
      .upsert(
        {
          tenant_id: GLOBAL_SCOPE,
          data_key: key,
          payload: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,data_key' }
      );
  } catch {
    // Offline — queue for sync
    try {
      const queue: any[] = JSON.parse(localStorage.getItem('jasper_offline_sync_queue') || '[]');
      // Remove any existing queued save for same key to avoid duplicates
      const filtered = queue.filter((q: any) => !(q.table === 'tenant_data' && q.data?.data_key === key));
      filtered.push({
        id: `pf_${Date.now()}`,
        table: 'tenant_data',
        operation: 'upsert',
        data: {
          tenant_id: GLOBAL_SCOPE,
          data_key: key,
          payload: value,
          updated_at: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        retries: 0,
      });
      localStorage.setItem('jasper_offline_sync_queue', JSON.stringify(filtered));
    } catch { /* storage full */ }
  }

  return value;
}

// ─── Delete from Supabase and localStorage ────────────────────────────────
export async function deletePlatformRecord(
  recordType: string,
  scopeId = GLOBAL_SCOPE
): Promise<void> {
  const key = `${recordType}__${scopeId}`;

  localStorage.removeItem(localKey(recordType, scopeId));

  try {
    const client: any = await getDynamicSupabaseClient();
    await client
      .from('tenant_data')
      .delete()
      .eq('tenant_id', GLOBAL_SCOPE)
      .eq('data_key', key);
  } catch { /* offline — not queuing delete */ }
}

// ─── Sync queued offline saves when online ────────────────────────────────
export async function flushPlatformRecordQueue(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const queue: any[] = JSON.parse(localStorage.getItem('jasper_offline_sync_queue') || '[]');
    if (!queue.length) return;

    const client: any = await getDynamicSupabaseClient();
    const remaining: any[] = [];

    for (const item of queue) {
      try {
        if (item.operation === 'upsert') {
          await client.from(item.table).upsert(item.data, { onConflict: 'tenant_id,data_key' });
        } else if (item.operation === 'insert') {
          await client.from(item.table).insert(item.data);
        } else if (item.operation === 'update' && item.filter) {
          await client.from(item.table).update(item.data).eq(item.filter.column, item.filter.value);
        }
      } catch {
        item.retries = (item.retries || 0) + 1;
        if (item.retries < 5) remaining.push(item);
      }
    }

    localStorage.setItem('jasper_offline_sync_queue', JSON.stringify(remaining));
  } catch { /* offline */ }
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
  { id: 'item-1', name: 'Jasper POS Thermal Printer', category: 'Printer',  stock: 0, price: 150000 },
  { id: 'item-2', name: 'Barcode Scanner',            category: 'Scanner',  stock: 0, price: 80000  },
  { id: 'item-3', name: 'Tablet + Standing Set',      category: 'Tablet',   stock: 0, price: 250000 },
  { id: 'item-4', name: 'Complete System Set',        category: 'Bundle',   stock: 0, price: 450000 },
];
