import { RealtimeChannel } from '@supabase/supabase-js';
import { Branch, BranchStaffAssignment, BranchStock, Delivery, Expense, Product, Purchase, SystemSettings } from '../types';
import { getSecureDataBridgeClient } from '../secureDataBridge';
import { getProductPayloadQualityScore, isProductPayloadDestructiveShrink, isProductPayloadQualityDowngrade } from './dataSafety';
import {
  mergeProductsForSync,
  mergeProductTombstones,
  readLocalProductTombstones,
  writeLocalProductTombstones,
} from './productSync';
import { mergeRecordsById } from './recordSync';
import { mergeSettingsForSync } from './settingsSync';
import { canWriteBusinessDataOnline, isBrowserOnline, warnOfflineWriteBlocked } from './onlineOnly';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TenantWorkspace {
  branches?: Branch[];
  branchStocks?: BranchStock[];
  branchStaffAssignments?: BranchStaffAssignment[];
  products: Product[];
  sales: any[];
  expenses: Expense[];
  settings: SystemSettings;
  deliveries: Delivery[];
  pendingDeliveryNotes: any[];
  purchases: Purchase[];
  productTombstones?: Record<string, string>;
}

// ─── Runtime state helpers ──────────────────────────────────────────────────

const runtimeWorkspaces = new Map<string, TenantWorkspace>();
const runtimeProductsUpdatedAt = new Map<string, string>();

// Guards against an out-of-order-completion race: saveTenantWorkspace fires
// immediately (no debounce) on every salesMap/expensesMap/productsMap/etc.
// change. A single user action (e.g. delete sale, which also adjusts stock)
// can trigger two overlapping save calls a few ms apart — one with the
// pre-change data, one with the post-change (correct) data. On a slow or
// jittery connection (mobile data), the OLDER call can finish its network
// round-trip AFTER the newer one, silently overwriting the correct save
// with stale data — e.g. a deleted sale reappearing "after a while".
// Fix: every call grabs a per-tenant sequence number; only the call that is
// still the latest issued for that tenant when it reaches the actual write
// is allowed to write. Older, superseded calls skip their write entirely.
const workspaceSaveSeq = new Map<string, number>();

export const readCachedWorkspace = (tenantId: string): TenantWorkspace | null => {
  return runtimeWorkspaces.get(tenantId) || null;
};

const cacheWorkspace = (tenantId: string, workspace: TenantWorkspace) => {
  runtimeWorkspaces.set(tenantId, workspace);
};

const normalizeWorkspace = (workspace: Partial<TenantWorkspace> | null | undefined): TenantWorkspace | null => {
  if (!workspace) return null;
  return {
    branches:            workspace.branches            || [],
    branchStocks:        workspace.branchStocks        || [],
    branchStaffAssignments: workspace.branchStaffAssignments || [],
    products:            workspace.products            || [],
    sales:               workspace.sales               || [],
    expenses:            workspace.expenses            || [],
    settings:            workspace.settings            || ({} as SystemSettings),
    deliveries:          workspace.deliveries          || [],
    pendingDeliveryNotes:workspace.pendingDeliveryNotes|| [],
    purchases:           workspace.purchases           || [],
    productTombstones:   workspace.productTombstones   || {},
  };
};

const scopedArray = (payload: any, tenantId: string): any[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload[tenantId])) return payload[tenantId];
  return [];
};

const readLocalProductsUpdatedAt = (tenantId: string): string | null => {
  return runtimeProductsUpdatedAt.get(tenantId) || null;
};

export const markTenantProductsUpdated = (tenantId: string, updatedAt = new Date().toISOString()) => {
  if (!tenantId) return;
  runtimeProductsUpdatedAt.set(tenantId, updatedAt);
};

const isNewerTimestamp = (candidate?: string | null, baseline?: string | null): boolean => {
  if (!candidate) return false;
  if (!baseline) return true;
  const candidateTime = new Date(candidate).getTime();
  const baselineTime = new Date(baseline).getTime();
  return Number.isFinite(candidateTime) && (!Number.isFinite(baselineTime) || candidateTime > baselineTime);
};

export const workspaceHasBusinessData = (workspace: Partial<TenantWorkspace> | null | undefined): boolean => {
  if (!workspace) return false;
  return [
    workspace.products,
    workspace.sales,
    workspace.expenses,
    workspace.deliveries,
    workspace.pendingDeliveryNotes,
    workspace.purchases,
    workspace.branches,
    workspace.branchStocks,
    workspace.branchStaffAssignments,
  ].some((entry) => Array.isArray(entry) && entry.length > 0);
};

type WorkspaceArrayKey =
  | 'products'
  | 'sales'
  | 'expenses'
  | 'deliveries'
  | 'pendingDeliveryNotes'
  | 'purchases'
  | 'branches'
  | 'branchStocks'
  | 'branchStaffAssignments';

const protectedArrayKeys: WorkspaceArrayKey[] = [
  'products',
  'sales',
  'expenses',
  'deliveries',
  'pendingDeliveryNotes',
  'purchases',
  'branches',
  'branchStocks',
  'branchStaffAssignments',
];

const appendMergeWorkspaceKeys: WorkspaceArrayKey[] = [
  'sales',
  'expenses',
  'deliveries',
  'pendingDeliveryNotes',
  'purchases',
  'branches',
  'branchStocks',
  'branchStaffAssignments',
];

const countWorkspaceItems = (workspace: Partial<TenantWorkspace> | null | undefined): Record<WorkspaceArrayKey, number> => {
  return protectedArrayKeys.reduce((acc, key) => {
    acc[key] = Array.isArray(workspace?.[key]) ? (workspace?.[key] as any[]).length : 0;
    return acc;
  }, {} as Record<WorkspaceArrayKey, number>);
};

const reconcileProtectedWorkspace = (
  incoming: TenantWorkspace,
  current: TenantWorkspace | null,
): { workspace: TenantWorkspace; protectedKeys: WorkspaceArrayKey[]; shrank: boolean } => {
  if (!current) return { workspace: incoming, protectedKeys: [], shrank: false };

  const merged: TenantWorkspace = { ...incoming };
  const protectedKeys: WorkspaceArrayKey[] = [];
  let shrank = false;

  for (const key of protectedArrayKeys) {
    const incomingItems = Array.isArray(incoming[key]) ? incoming[key] as any[] : [];
    const currentItems = Array.isArray(current[key]) ? current[key] as any[] : [];

    if (currentItems.length > 0 && incomingItems.length === 0) {
      // Incoming is completely empty but DB has data — protect DB data
      (merged as any)[key] = currentItems;
      protectedKeys.push(key);
    } else if (
      key === 'products'
      && (
        isProductPayloadQualityDowngrade(incomingItems, currentItems)
        || isProductPayloadDestructiveShrink(incomingItems, currentItems)
      )
    ) {
      // Product payloads restored from stale caches can have the same count but
      // lose prices, categories, or real names. Keep the richer local/cloud copy.
      (merged as any)[key] = currentItems;
      protectedKeys.push(key);
      shrank = true;
    } else if (incomingItems.length > 0 && incomingItems.length < currentItems.length) {
      // Incoming has some data but fewer than DB — flag as shrunk for backup,
      // but STILL save incoming (user may have deleted items intentionally)
      shrank = true;
    }
    // If incoming has MORE data than DB → user just added items → always save
  }

  return { workspace: merged, protectedKeys, shrank };
};

// ─── Check if Supabase is configured ───────────────────────────────────────

async function getConfiguredClient(): Promise<any | null> {
  try {
    const client: any = await getSecureDataBridgeClient();
    // If URL is placeholder, Supabase isn't configured — return null
    const url = (client as any).supabaseUrl || '';
    if (!url || url.includes('placeholder-url')) return null;
    return client;
  } catch {
    return null;
  }
}

type LegacyWorkspaceMeta = {
  workspace: TenantWorkspace | null;
  updatedAtByKey: Record<string, string>;
};

async function loadLegacyTenantWorkspaceMeta(client: any, tenantId: string): Promise<LegacyWorkspaceMeta> {
  const { data, error } = await client
    .from('tenant_data')
    .select('data_key, payload, updated_at')
    .eq('tenant_id', tenantId)
    .in('data_key', [
      'products', 'products_map',
      'sales', 'sales_map',
      'expenses', 'expenses_map',
      'settings',
      'deliveries', 'deliveries_map',
      'pendingDeliveryNotes', 'pendingDeliveryNotes_map',
      'purchases', 'purchases_map',
      'branches', 'branches_map',
      'branchStocks', 'branchStocks_map',
      'branchStaffAssignments', 'branchStaffAssignments_map'
    ]);

  if (error || !Array.isArray(data) || data.length === 0) {
    return { workspace: null, updatedAtByKey: {} };
  }

  const byKey = new Map<string, any>(data.map((row: any) => [row.data_key, row.payload]));
  const updatedAtByKey = data.reduce((acc: Record<string, string>, row: any) => {
    if (row.data_key && row.updated_at) acc[row.data_key] = row.updated_at;
    return acc;
  }, {});
  const legacy = normalizeWorkspace({
    products: scopedArray(byKey.get('products_map'), tenantId).length ? scopedArray(byKey.get('products_map'), tenantId) : scopedArray(byKey.get('products'), tenantId),
    sales: scopedArray(byKey.get('sales_map'), tenantId).length ? scopedArray(byKey.get('sales_map'), tenantId) : scopedArray(byKey.get('sales'), tenantId),
    expenses: scopedArray(byKey.get('expenses_map'), tenantId).length ? scopedArray(byKey.get('expenses_map'), tenantId) : scopedArray(byKey.get('expenses'), tenantId),
    deliveries: scopedArray(byKey.get('deliveries_map'), tenantId).length ? scopedArray(byKey.get('deliveries_map'), tenantId) : scopedArray(byKey.get('deliveries'), tenantId),
    pendingDeliveryNotes: scopedArray(byKey.get('pendingDeliveryNotes_map'), tenantId).length ? scopedArray(byKey.get('pendingDeliveryNotes_map'), tenantId) : scopedArray(byKey.get('pendingDeliveryNotes'), tenantId),
    purchases: scopedArray(byKey.get('purchases_map'), tenantId).length ? scopedArray(byKey.get('purchases_map'), tenantId) : scopedArray(byKey.get('purchases'), tenantId),
    branches: scopedArray(byKey.get('branches_map'), tenantId).length ? scopedArray(byKey.get('branches_map'), tenantId) : scopedArray(byKey.get('branches'), tenantId),
    branchStocks: scopedArray(byKey.get('branchStocks_map'), tenantId).length ? scopedArray(byKey.get('branchStocks_map'), tenantId) : scopedArray(byKey.get('branchStocks'), tenantId),
    branchStaffAssignments: scopedArray(byKey.get('branchStaffAssignments_map'), tenantId).length ? scopedArray(byKey.get('branchStaffAssignments_map'), tenantId) : scopedArray(byKey.get('branchStaffAssignments'), tenantId),
    settings: byKey.get('settings') || ({} as SystemSettings),
  });

  return {
    workspace: legacy && (workspaceHasBusinessData(legacy) || Object.keys(legacy.settings || {}).length > 0) ? legacy : null,
    updatedAtByKey,
  };
}

async function loadLegacyTenantWorkspace(client: any, tenantId: string): Promise<TenantWorkspace | null> {
  const legacy = await loadLegacyTenantWorkspaceMeta(client, tenantId);
  return legacy.workspace;
}

async function saveRemoteWorkspaceBackup(
  client: any,
  tenantId: string,
  workspace: TenantWorkspace,
  reason: string,
): Promise<void> {
  if (!workspaceHasBusinessData(workspace)) return;

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const counts = countWorkspaceItems(workspace);
    const { error } = await client
      .from('tenant_data')
      .upsert({
        tenant_id: tenantId,
        data_key: `workspace_backup_${stamp}`,
        payload: {
          reason,
          createdAt: new Date().toISOString(),
          counts,
          workspace,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,data_key' });

    if (error) console.warn('[workspace] remote backup error:', error.message);
  } catch (error: any) {
    console.warn('[workspace] remote backup exception:', error?.message || error);
  }
}

// ─── Load from DB ──────────────────────────────────────────────────────────

export async function loadTenantWorkspace(tenantId: string): Promise<TenantWorkspace | null> {
  if (!tenantId) return null;
  if (!isBrowserOnline()) return null;

  const client = await getConfiguredClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('tenant_workspaces')
      .select('payload, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      console.warn('[workspace] load error:', error.message);
      return null;
    }

    if (!data?.payload) {
      const legacy = await loadLegacyTenantWorkspace(client, tenantId);
      if (legacy && workspaceHasBusinessData(legacy)) {
        await client
          .from('tenant_workspaces')
          .upsert(
            { tenant_id: tenantId, payload: legacy, updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id' }
          );
        cacheWorkspace(tenantId, legacy);
        return legacy;
      }
      return null;
    }

    const safe = normalizeWorkspace(data.payload as TenantWorkspace);
    if (!safe) return null;
    // Online-only mode: do not push browser-local product cache into the
    // canonical cloud workspace during load. Cloud remains the source of truth.
    if (!workspaceHasBusinessData(safe)) {
      const legacy = await loadLegacyTenantWorkspace(client, tenantId);
      if (legacy && workspaceHasBusinessData(legacy)) {
        await client
          .from('tenant_workspaces')
          .upsert(
            { tenant_id: tenantId, payload: legacy, updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id' }
          );
        cacheWorkspace(tenantId, legacy);
        return legacy;
      }
    }
    const legacyMeta = await loadLegacyTenantWorkspaceMeta(client, tenantId);
    const legacyProductsUpdatedAt = legacyMeta.updatedAtByKey.products_map || legacyMeta.updatedAtByKey.products;
    const legacyProducts = legacyMeta.workspace?.products || [];
    const legacyProductScore = getProductPayloadQualityScore(legacyProducts);
    const workspaceProductScore = getProductPayloadQualityScore(safe.products || []);
    if (
      legacyProducts.length > 0 &&
      legacyProductScore >= workspaceProductScore &&
      isNewerTimestamp(legacyProductsUpdatedAt, data.updated_at)
    ) {
      const reconciled = normalizeWorkspace({
        ...safe,
        products: legacyProducts,
      });
      if (reconciled) {
        await client
          .from('tenant_workspaces')
          .upsert(
            { tenant_id: tenantId, payload: reconciled, updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id' }
          );
        cacheWorkspace(tenantId, reconciled);
        return reconciled;
      }
    }
    cacheWorkspace(tenantId, safe);
    return safe;
  } catch (e) {
    console.warn('[workspace] load exception:', e);
    return null;
  }
}

// ─── Save to DB ────────────────────────────────────────────────────────────

export async function saveTenantWorkspace(tenantId: string, workspace: TenantWorkspace): Promise<boolean> {
  if (!tenantId) return false;

  if (!canWriteBusinessDataOnline()) {
    warnOfflineWriteBlocked(`saveTenantWorkspace:${tenantId}`);
    return false;
  }

  const client = await getConfiguredClient();
  if (!client) {
    warnOfflineWriteBlocked(`saveTenantWorkspace:no-client:${tenantId}`);
    return false;
  }

  const mySeq = (workspaceSaveSeq.get(tenantId) || 0) + 1;
  workspaceSaveSeq.set(tenantId, mySeq);
  const isStillLatest = () => workspaceSaveSeq.get(tenantId) === mySeq;

  try {
    // Use in-memory cache only — no remote SELECT pre-read.
    // Cache is the source of truth for this session.
    // A remote SELECT causes race conditions: session A reads stale DB,
    // session B saves new data, session A overwrites with stale data.
    const currentSafe = readCachedWorkspace(tenantId);

    // Secondary protection: if incoming workspace has no business data
    // but cache has data, something is wrong — refuse to save.
    if (!workspaceHasBusinessData(workspace)) {
      if (workspaceHasBusinessData(currentSafe)) {
        console.warn('[workspace] blocked: incoming workspace is empty but cache has data');
        return false;
      }
      // Both empty — nothing to save
      return false;
    }

    // Merge products using timestamps (updatedAt/syncUpdatedAt picks newer)
    const mergedTombstones = mergeProductTombstones(
      currentSafe?.productTombstones,
      workspace.productTombstones,
      readLocalProductTombstones(tenantId),
    );
    const mergedProducts = mergeProductsForSync(
      workspace.products || [],
      currentSafe?.products || [],
      mergedTombstones,
    );

    let workspaceToSave: TenantWorkspace = {
      ...workspace,
      products: mergedProducts,
      productTombstones: mergedTombstones,
    };

    // Merge arrays with cache.
    // CRITICAL: sales and expenses support deletion — incoming array is the
    // source of truth. Never union with cache (that would resurrect deleted records).
    // Rule: incoming non-empty → use incoming only.
    //       incoming empty AND cache has data → protect (blank-save guard).
    if (currentSafe) {
      for (const key of appendMergeWorkspaceKeys) {
        const incomingArr = Array.isArray((workspaceToSave as any)[key]) ? (workspaceToSave as any)[key] : [];
        const currentArr  = Array.isArray((currentSafe as any)[key])      ? (currentSafe as any)[key]      : [];

        if (incomingArr.length > 0) {
          // Incoming has data — it is the truth. Do NOT merge with cache.
          (workspaceToSave as any)[key] = incomingArr;
        } else if (currentArr.length > 0) {
          // Incoming is empty but cache has data — blank-save guard.
          (workspaceToSave as any)[key] = currentArr;
        }
      }
      workspaceToSave.settings = mergeSettingsForSync(workspaceToSave.settings, currentSafe.settings);
    }

    // Protection: never wipe arrays that exist in cache but are empty in incoming
    const protection = reconcileProtectedWorkspace(workspaceToSave, currentSafe);
    workspaceToSave = protection.workspace;

    if (protection.protectedKeys.length > 0) {
      console.warn('[workspace] prevented destructive overwrite for:', protection.protectedKeys.join(', '));
    }

    // A newer save for this tenant has been issued since this call started
    // (e.g. a follow-up state change fired another save a few ms later).
    // That newer call has fresher data — let it win. Writing this stale
    // payload now could overwrite the newer save if this network call
    // happens to complete after it (out-of-order completion).
    if (!isStillLatest()) {
      console.warn('[workspace] skipped stale save (superseded by a newer save for this tenant)');
      return false;
    }

    // Direct upsert — no pre-read, instant DB write
    const { error } = await client
      .from('tenant_workspaces')
      .upsert(
        { tenant_id: tenantId, payload: workspaceToSave, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      );

    if (error) {
      console.warn('[workspace] save error:', error.message, '| code:', (error as any).code);
      return false;
    }

    if (!isStillLatest()) {
      // An even newer save started and will also write — its result should
      // win in cache too, so avoid clobbering it with this call's snapshot.
      return true;
    }

    writeLocalProductTombstones(tenantId, mergedTombstones);
    cacheWorkspace(tenantId, workspaceToSave);
    return true;
  } catch (e) {
    console.warn('[workspace] save exception:', (e as any)?.message || e);
    return false;
  }
}
// ─── Flush pending (called when going online) ──────────────────────────────

export async function flushPendingTenantWorkspace(tenantId: string): Promise<void> {
  void tenantId;
}

// ─── Real-time subscription ─────────────────────────────────────────────────

export async function subscribeToTenantWorkspace(
  tenantId: string,
  onWorkspace: (workspace: TenantWorkspace) => void
): Promise<() => void> {
  const client = await getConfiguredClient();
  if (!client) return () => undefined;

  try {
    const channel: RealtimeChannel = client
      .channel(`tenant-workspace:${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenant_workspaces', filter: `tenant_id=eq.${tenantId}` },
        (event: any) => {
          const workspace = event.new?.payload as TenantWorkspace | undefined;
          if (workspace) {
            const safe = normalizeWorkspace(workspace);
            if (!safe) return;
            const cached = readCachedWorkspace(tenantId);
            if (!workspaceHasBusinessData(safe) && workspaceHasBusinessData(cached)) {
              console.warn('[workspace] ignored empty realtime payload because local cache has business data');
              return;
            }
            writeLocalProductTombstones(tenantId, safe.productTombstones || {});
            cacheWorkspace(tenantId, safe);
            onWorkspace(safe);
          }
        }
      )
      .subscribe();

    return () => {
      try { client.removeChannel(channel); } catch { /* ignore */ }
    };
  } catch (e) {
    console.warn('[workspace] subscribe exception:', e);
    return () => undefined;
  }
}

// ─── Initialize empty workspace for new tenants ────────────────────────────

export function emptyWorkspace(settings?: Partial<SystemSettings>): TenantWorkspace {
  return {
    branches: [],
    branchStocks: [],
    branchStaffAssignments: [],
    products: [],
    sales: [],
    expenses: [],
    settings: {
      company: { businessName: '', businessType: '', currency: 'TZS', currencySymbol: 'TSh', country: 'Tanzania', city: '', taxRate: 18, logoUrl: '' },
      business: {
        allowNegativeStock: false,
        defaultUnit: 'pcs',
        requireStockCheck: true,
        autoGenerateBarcode: false,
        paymentModes: [],
        deliveryPaymentModes: [],
        registeredStores: []
      },
      productStore: { showImages: true, compactView: false, categories: [], units: [], brands: [] },
      staffs: [],
      ...(settings || {}),
    } as SystemSettings,
    deliveries: [],
    pendingDeliveryNotes: [],
    purchases: [],
    productTombstones: {},
  };
}

export async function initializeNewTenantWorkspace(tenantId: string, settings?: Partial<SystemSettings>): Promise<void> {
  const workspace = emptyWorkspace(settings);
  await saveTenantWorkspace(tenantId, workspace);
}
