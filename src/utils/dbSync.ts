/**
 * dbSync.ts — Central database synchronisation layer
 *
 * Strategy: Supabase/cloud is the source of truth for business data.
 * Browser persistence is not used. Business data lives in Supabase only.
 *
 * On login:      Pull from Supabase
 * On save:       Require internet → push to Supabase
 * On conflict:   Supabase wins (server-side timestamp comparison)
 */

import { getSecureDataBridgeClient } from '../secureDataBridge';
import {
  getTenantArray,
  isProtectedDataKey,
  payloadHasRecords,
  protectTenantPayload,
} from './dataSafety';
import {
  attachPayloadProductTombstones,
  extractPayloadProductTombstones,
  mergeProductsForSync,
  mergeProductTombstones,
  readLocalProductTombstones,
  writeLocalProductTombstones,
} from './productSync';
import { APPEND_MERGE_DATA_KEYS, mergeRecordsById } from './recordSync';
import { mergeSettingsForSync } from './settingsSync';
import { ONLINE_ONLY_WRITE_MESSAGE, canWriteBusinessDataOnline, warnOfflineWriteBlocked } from './onlineOnly';

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

const isProductDataKey = (dataKey: string) => dataKey === 'products' || dataKey === 'products_map';

async function saveRemoteDataBackup(client: any, tenantId: string, dataKey: string, payload: any, reason: string): Promise<void> {
  if (!payloadHasRecords(payload, tenantId)) return;
  try {
    const currentItems = getTenantArray(payload, tenantId);
    await client
      .from('tenant_data')
      .upsert({
        tenant_id: tenantId,
        // Keep one rolling safety snapshot per key. Timestamped keys caused
        // unbounded tenant_data growth on active workspaces.
        data_key: `data_backup_latest_${dataKey}`,
        payload: {
          reason,
          sourceDataKey: dataKey,
          createdAt: now(),
          count: currentItems ? currentItems.length : undefined,
          value: payload,
        },
        updated_at: now(),
      }, { onConflict: 'tenant_id,data_key' });
  } catch (error) {
    console.warn(`[dbSync] backup failed for ${dataKey}:`, error);
  }
}

// ─── Core push/pull ──────────────────────────────────────────────────────────

/**
 * Push one data key to Supabase and return the payload that was accepted.
 */
export async function pushToCloud(tenantId: string, dataKey: string, payload: any): Promise<any> {
  if (!canWriteBusinessDataOnline()) {
    warnOfflineWriteBlocked(`pushToCloud:${tenantId}/${dataKey}`);
    throw new Error(ONLINE_ONLY_WRITE_MESSAGE);
  }

  try {
    const client: any = await getSecureDataBridgeClient();
    let payloadToPush = payload;

    if (isProtectedDataKey(dataKey)) {
      const { data: currentRow } = await client
        .from('tenant_data')
        .select('payload')
        .eq('tenant_id', tenantId)
        .eq('data_key', dataKey)
        .maybeSingle();
      const currentPayload = currentRow?.payload || null;

      const protection = protectTenantPayload(tenantId, dataKey, payload, currentPayload);
      payloadToPush = protection.payload;

      if (payloadHasRecords(currentPayload, tenantId) && !payloadHasRecords(payloadToPush, tenantId)) {
        saveRemoteDataBackup(client, tenantId, dataKey, currentPayload, 'prevented-empty-overwrite').catch(() => {});
        console.warn(`[dbSync] prevented empty cloud overwrite for ${tenantId}/${dataKey}`);
        payloadToPush = currentPayload;
      } else if (protection.blockedEmptyOverwrite) {
        saveRemoteDataBackup(client, tenantId, dataKey, currentPayload, 'prevented-empty-overwrite').catch(() => {});
        console.warn(`[dbSync] prevented empty cloud overwrite for ${tenantId}/${dataKey}`);
      } else if (protection.shrank) {
        saveRemoteDataBackup(client, tenantId, dataKey, currentPayload, 'pre-shrink-save').catch(() => {});
      }

      if (isProductDataKey(dataKey)) {
        if (currentPayload) {
          const incomingItems = getTenantArray(payloadToPush, tenantId) || [];
          const remoteItems = getTenantArray(currentPayload, tenantId) || [];
          const tombstones = mergeProductTombstones(
            extractPayloadProductTombstones(currentPayload, tenantId),
            extractPayloadProductTombstones(payloadToPush, tenantId),
            readLocalProductTombstones(tenantId),
          );
          const mergedProducts = mergeProductsForSync(incomingItems, remoteItems, tombstones);
          payloadToPush = Array.isArray(payloadToPush)
            ? mergedProducts
            : { ...(payloadToPush || {}), [tenantId]: mergedProducts };
          payloadToPush = attachPayloadProductTombstones(payloadToPush, tenantId, tombstones);
          writeLocalProductTombstones(tenantId, tombstones);

          const remoteProtection = protectTenantPayload(tenantId, dataKey, payloadToPush, currentPayload);
          payloadToPush = remoteProtection.payload;

          if (payloadHasRecords(currentPayload, tenantId) && !payloadHasRecords(payloadToPush, tenantId)) {
            saveRemoteDataBackup(client, tenantId, dataKey, currentPayload, 'prevented-empty-overwrite').catch(() => {});
            console.warn(`[dbSync] prevented destructive cloud overwrite for ${tenantId}/${dataKey} from remote guard`);
            payloadToPush = currentPayload;
          } else if (remoteProtection.blockedEmptyOverwrite) {
            saveRemoteDataBackup(client, tenantId, dataKey, currentPayload, 'prevented-empty-overwrite').catch(() => {});
            console.warn(`[dbSync] prevented destructive cloud overwrite for ${tenantId}/${dataKey} from remote guard`);
          } else if (remoteProtection.shrank) {
            saveRemoteDataBackup(client, tenantId, dataKey, currentPayload, 'pre-remote-guard-save').catch(() => {});
          }
        }
      } else if (dataKey === 'settings') {
        if (currentPayload) {
          payloadToPush = mergeSettingsForSync(payloadToPush, currentPayload);
        }
      } else if (APPEND_MERGE_DATA_KEYS.has(dataKey)) {
        if (currentPayload) {
          const incomingItems = getTenantArray(payloadToPush, tenantId) || [];
          const remoteItems = getTenantArray(currentPayload, tenantId) || [];
          const mergedRecords = mergeRecordsById(incomingItems, remoteItems);
          payloadToPush = Array.isArray(payloadToPush)
            ? mergedRecords
            : { ...(payloadToPush || {}), [tenantId]: mergedRecords };
        }
      }
    }

    const { error } = await client
      .from('tenant_data')
      .upsert({
        tenant_id: tenantId,
        data_key: dataKey,
        payload: payloadToPush,
        updated_at: now(),
      }, { onConflict: 'tenant_id,data_key' });

    if (error) {
      console.warn(`[dbSync] push failed for ${dataKey}:`, error.message);
      throw error;
    }
    return payloadToPush;
  } catch (e) {
    console.warn(`[dbSync] push exception for ${dataKey}:`, e);
    throw e;
  }
}

/**
 * Pull one data key from Supabase. Returns null if not found or offline.
 */
export async function pullFromCloud(tenantId: string, dataKey: string): Promise<any | null> {
  try {
    const client: any = await getSecureDataBridgeClient();
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
    const client: any = await getSecureDataBridgeClient();
    const { data, error } = await client
      .from('tenant_data')
      .select('data_key, payload')
      .eq('tenant_id', tenantId)
      .not('data_key', 'like', 'workspace_backup_%')
      .not('data_key', 'like', 'data_backup_%');

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

// ─── Save helpers (database only) ────────────────────────────────────────────

/**
 * Save any data blob — online-only for business data.
 * No offline browser copy is created.
 */
export function saveData(tenantId: string, dataKey: string, payload: any): void {
  if (!tenantId) return;
  if (!canWriteBusinessDataOnline()) {
    warnOfflineWriteBlocked(`saveData:${tenantId}/${dataKey}`);
    return;
  }

  pushToCloud(tenantId, dataKey, payload)
    .catch((error) => {
      console.warn(`[dbSync] online-only save failed for ${tenantId}/${dataKey}:`, error);
    });
}

/**
 * Load data directly from the database.
 */
export async function loadData(tenantId: string, dataKey: string): Promise<any | null> {
  if (!tenantId) return null;
  if (!canWriteBusinessDataOnline()) return null;
  return pullFromCloud(tenantId, dataKey);
}

// ─── Sync on login ───────────────────────────────────────────────────────────

/**
 * Called immediately after the user logs in.
 * Confirms tenant data can be read from Supabase. The caller owns screen state.
 */
export async function syncOnLogin(tenantId: string): Promise<void> {
  if (!tenantId) return;
  await pullAllFromCloud(tenantId);
}

/**
 * Legacy entry point retained as a no-op. Browser data is never pushed.
 */
async function syncLocalToCloud(tenantId: string, options: { onlyMeaningfulPayloads?: boolean } = {}): Promise<void> {
  if (!canWriteBusinessDataOnline()) {
    warnOfflineWriteBlocked(`syncLocalToCloud:${tenantId}`);
    return;
  }

  void options;
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
