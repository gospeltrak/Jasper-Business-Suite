/**
 * dbSync.ts — Central database synchronisation layer
 *
 * Strategy: localStorage is the IMMEDIATE source of truth (fast, offline-capable).
 * Supabase is the PERSISTENT source of truth (syncs across devices/browsers).
 *
 * On login:      Pull from Supabase → write to localStorage
 * On save:       Write to localStorage immediately → push to Supabase async
 * On conflict:   Supabase wins (server-side timestamp comparison)
 */

import { getDynamicSupabaseClient } from '../supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncRecord {
  tenant_id: string;
  data_key: string;      // e.g. 'products', 'sales', 'settings', 'channels'
  payload: any;          // the full JSON blob
  updated_at: string;    // ISO timestamp
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function localKey(tenantId: string, dataKey: string): string {
  return `jasper_${dataKey}_${tenantId}`;
}

// ─── Core push/pull ──────────────────────────────────────────────────────────

/**
 * Push one data key to Supabase. Fails silently — localStorage already has the data.
 */
export async function pushToCloud(tenantId: string, dataKey: string, payload: any): Promise<void> {
  try {
    const client: any = await getDynamicSupabaseClient();
    const { error } = await client
      .from('tenant_data')
      .upsert({
        tenant_id: tenantId,
        data_key: dataKey,
        payload: payload,
        updated_at: now(),
      }, { onConflict: 'tenant_id,data_key' });

    if (error) {
      console.warn(`[dbSync] push failed for ${dataKey}:`, error.message);
    }
  } catch (e) {
    console.warn(`[dbSync] push exception for ${dataKey}:`, e);
  }
}

/**
 * Pull one data key from Supabase. Returns null if not found or offline.
 */
export async function pullFromCloud(tenantId: string, dataKey: string): Promise<any | null> {
  try {
    const client: any = await getDynamicSupabaseClient();
    const { data, error } = await client
      .from('tenant_data')
      .select('payload, updated_at')
      .eq('tenant_id', tenantId)
      .eq('data_key', dataKey)
      .single();

    if (error || !data) return null;
    return data.payload;
  } catch (e) {
    console.warn(`[dbSync] pull exception for ${dataKey}:`, e);
    return null;
  }
}

/**
 * Pull ALL data keys for a tenant in one query. Used on login.
 */
export async function pullAllFromCloud(tenantId: string): Promise<Record<string, any>> {
  try {
    const client: any = await getDynamicSupabaseClient();
    const { data, error } = await client
      .from('tenant_data')
      .select('data_key, payload')
      .eq('tenant_id', tenantId);

    if (error || !data) return {};
    const result: Record<string, any> = {};
    for (const row of data) {
      result[row.data_key] = row.payload;
    }
    return result;
  } catch (e) {
    console.warn(`[dbSync] pullAll exception:`, e);
    return {};
  }
}

// ─── Save helpers (localStorage + cloud) ─────────────────────────────────────

/**
 * Save any data blob — writes to localStorage immediately,
 * then pushes to Supabase in the background.
 */
export function saveData(tenantId: string, dataKey: string, payload: any): void {
  if (!tenantId) return;
  // 1. Write to localStorage immediately (instant, offline-safe)
  try {
    localStorage.setItem(localKey(tenantId, dataKey), JSON.stringify(payload));
  } catch (e) {
    console.warn(`[dbSync] localStorage write failed for ${dataKey}:`, e);
  }
  // 2. Push to cloud asynchronously (don't await — never blocks the UI)
  pushToCloud(tenantId, dataKey, payload).catch(() => {});
}

/**
 * Load data — reads localStorage first (fast), falls back to cloud.
 */
export async function loadData(tenantId: string, dataKey: string): Promise<any | null> {
  if (!tenantId) return null;
  // Try localStorage first
  try {
    const raw = localStorage.getItem(localKey(tenantId, dataKey));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // Fall back to cloud
  return pullFromCloud(tenantId, dataKey);
}

// ─── Sync on login ───────────────────────────────────────────────────────────

/**
 * Called immediately after the user logs in.
 * Pulls all tenant data from Supabase and writes it to localStorage.
 * This ensures data is available even after cache clear.
 */
export async function syncOnLogin(tenantId: string): Promise<void> {
  if (!tenantId) return;
  const cloudData = await pullAllFromCloud(tenantId);
  if (!cloudData || Object.keys(cloudData).length === 0) {
    // No cloud data yet — push whatever is in localStorage to cloud
    await syncLocalToCloud(tenantId);
    return;
  }
  // Write all cloud data to localStorage
  for (const [dataKey, payload] of Object.entries(cloudData)) {
    try {
      localStorage.setItem(localKey(tenantId, dataKey), JSON.stringify(payload));
    } catch (e) {}
  }
}

/**
 * Pushes all local data to cloud (used when user has local data but no cloud data yet).
 */
async function syncLocalToCloud(tenantId: string): Promise<void> {
  const dataKeys = [
    'settings', 'products_map', 'sales_map', 'expenses_map',
    'channels', 'pending_delivery_notes_map', 'purchases_map'
  ];
  for (const dataKey of dataKeys) {
    try {
      const raw = localStorage.getItem(localKey(tenantId, dataKey));
      if (raw) {
        const payload = JSON.parse(raw);
        await pushToCloud(tenantId, dataKey, payload);
      }
    } catch (e) {}
  }
}

// ─── SQL to create the table ─────────────────────────────────────────────────
// Run this in Supabase Dashboard → SQL Editor once:
//
// CREATE TABLE IF NOT EXISTS public.tenant_data (
//   id           BIGSERIAL PRIMARY KEY,
//   tenant_id    TEXT NOT NULL,
//   data_key     TEXT NOT NULL,
//   payload      JSONB NOT NULL DEFAULT '{}',
//   updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   CONSTRAINT   tenant_data_unique UNIQUE (tenant_id, data_key)
// );
// CREATE INDEX IF NOT EXISTS tenant_data_tenant_idx ON public.tenant_data (tenant_id);
// ALTER TABLE public.tenant_data ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "tenant_data_select" ON public.tenant_data
//   FOR SELECT USING (true);
// CREATE POLICY "tenant_data_insert" ON public.tenant_data
//   FOR INSERT WITH CHECK (true);
// CREATE POLICY "tenant_data_update" ON public.tenant_data
//   FOR UPDATE USING (true);
