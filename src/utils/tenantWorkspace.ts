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

// ─── Local cache helpers ────────────────────────────────────────────────────

const cacheKey   = (tid: string) => `jasper_workspace_cache_${tid}`;
const pendingKey = (tid: string) => `jasper_workspace_pending_sync_${tid}`;
const productsUpdatedAtKey = (tid: string) => `jasper_products_map_updated_at_${tid}`;
const backupIndexKey = (tid: string) => `jasper_workspace_backups_${tid}`;
const backupItemKey = (tid: string, stamp: string) => `jasper_workspace_backup_${tid}_${stamp}`;
const backupLastKey = (tid: string, reason: string) => `jasper_workspace_backup_last_${tid}_${reason}`;

const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine;

export const readCachedWorkspace = (tenantId: string): TenantWorkspace | null => {
  try {
    const stored = localStorage.getItem(cacheKey(tenantId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const cacheWorkspace = (tenantId: string, workspace: TenantWorkspace) => {
  try {
    const current = readCachedWorkspace(tenantId);
    if (workspaceHasBusinessData(current)) writeLocalWorkspaceBackup(tenantId, current as TenantWorkspace, 'local-cache');
    localStorage.setItem(cacheKey(tenantId), JSON.stringify(workspace));
  } catch { /* storage full — ignore */ }
};

const writeLocalWorkspaceBackup = (tenantId: string, workspace: TenantWorkspace, reason: string) => {
  try {
    const lastKey = backupLastKey(tenantId, reason);
    const last = Number(localStorage.getItem(lastKey) || 0);
    if (Date.now() - last < 10 * 60 * 1000) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = backupItemKey(tenantId, stamp);
    localStorage.setItem(key, JSON.stringify({ reason, createdAt: new Date().toISOString(), workspace }));
    localStorage.setItem(lastKey, String(Date.now()));

    const rawIndex = localStorage.getItem(backupIndexKey(tenantId));
    const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    const next = [key, ...index.filter((entry) => entry !== key)].slice(0, 12);
    localStorage.setItem(backupIndexKey(tenantId), JSON.stringify(next));

    for (const oldKey of index.slice(12)) localStorage.removeItem(oldKey);
  } catch { /* storage full or unavailable — skip backup */ }
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

const readLocalProductsMap = (tenantId: string): Product[] => {
  try {
    const raw = localStorage.getItem('jasper_products_map');
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.[tenantId]) ? parsed[tenantId] : [];
  } catch {
    return [];
  }
};

const readLocalProductsUpdatedAt = (tenantId: string): string | null => {
  try {
    return localStorage.getItem(productsUpdatedAtKey(tenantId));
  } catch {
    return null;
  }
};

export const markTenantProductsUpdated = (tenantId: string, updatedAt = new Date().toISOString()) => {
  if (!tenantId) return;
  try {
    localStorage.setItem(productsUpdatedAtKey(tenantId), updatedAt);
  } catch {
    // Local metadata must never block the actual product save.
  }
};

const isNewerTimestamp = (candidate?: string | null, baseline?: string | null): boolean => {
  if (!candidate) return false;
  if (!baseline) return true;
  const candidateTime = new Date(candidate).getTime();
  const baselineTime = new Date(baseline).getTime();
  return Number.isFinite(candidateTime) && (!Number.isFinite(baselineTime) || candidateTime > baselineTime);
};

const reconcileLocalProductCache = (
  tenantId: string,
  workspace: TenantWorkspace,
  cloudUpdatedAt?: string | null,
): TenantWorkspace => {
  const localProducts = readLocalProductsMap(tenantId);
  const localProductsUpdatedAt = readLocalProductsUpdatedAt(tenantId);
  const tombstones = mergeProductTombstones(workspace.productTombstones, readLocalProductTombstones(tenantId));
  const mergedProducts = mergeProductsForSync(localProducts, workspace.products || [], tombstones);
  const productsChanged = JSON.stringify(mergedProducts) !== JSON.stringify(workspace.products || []);
  const tombstonesChanged = JSON.stringify(tombstones) !== JSON.stringify(workspace.productTombstones || {});
  if (!productsChanged && !tombstonesChanged) return workspace;

  if (
    localProducts.length > 0
    && isNewerTimestamp(localProductsUpdatedAt, cloudUpdatedAt)
    && !isProductPayloadQualityDowngrade(localProducts, workspace.products || [])
    && !isProductPayloadDestructiveShrink(localProducts, workspace.products || [])
  ) {
    return {
      ...workspace,
      products: mergedProducts,
      productTombstones: tombstones,
    };
  }
  return { ...workspace, products: mergedProducts, productTombstones: tombstones };
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
  const fallback = readCachedWorkspace(tenantId);

  if (!browserOnline()) return fallback;

  const client = await getConfiguredClient();
  if (!client) return fallback;

  try {
    const { data, error } = await client
      .from('tenant_workspaces')
      .select('payload, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      console.warn('[workspace] load error:', error.message);
      return fallback;
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
      return fallback;
    }

    const safe = normalizeWorkspace(data.payload as TenantWorkspace);
    if (!safe) return fallback;
    const safeWithLocalProducts = reconcileLocalProductCache(tenantId, safe, data.updated_at);
    if (safeWithLocalProducts !== safe) {
      await client
        .from('tenant_workspaces')
        .upsert(
          { tenant_id: tenantId, payload: safeWithLocalProducts, updated_at: new Date().toISOString() },
          { onConflict: 'tenant_id' }
        );
      cacheWorkspace(tenantId, safeWithLocalProducts);
      return safeWithLocalProducts;
    }
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
    if (!workspaceHasBusinessData(safe) && workspaceHasBusinessData(fallback)) {
      client
        .from('tenant_workspaces')
        .upsert(
          { tenant_id: tenantId, payload: fallback, updated_at: new Date().toISOString() },
          { onConflict: 'tenant_id' }
        )
        .then(({ error }: any) => {
          if (error) console.warn('[workspace] recovery save error:', error.message);
        })
        .catch((error: any) => console.warn('[workspace] recovery save exception:', error?.message || error));
      return fallback;
    }
    cacheWorkspace(tenantId, safe);
    return safe;
  } catch (e) {
    console.warn('[workspace] load exception:', e);
    return fallback;
  }
}

// ─── Save to DB ────────────────────────────────────────────────────────────

export async function saveTenantWorkspace(tenantId: string, workspace: TenantWorkspace): Promise<boolean> {
  if (!tenantId) return false;

  // Always write to local cache immediately
  cacheWorkspace(tenantId, workspace);

  if (!browserOnline()) {
    localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
    return false;
  }

  const client = await getConfiguredClient();
  if (!client) {
    // Queue for when we come online
    localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
    return false;
  }

  try {
    const currentSafe = readCachedWorkspace(tenantId);
    let remoteSafe: TenantWorkspace | null = null;
    try {
      const { data: remoteData, error: remoteError } = await client
        .from('tenant_workspaces')
        .select('payload, updated_at')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!remoteError && remoteData?.payload) {
        remoteSafe = normalizeWorkspace(remoteData.payload as TenantWorkspace);
      }
    } catch (error: any) {
      console.warn('[workspace] remote guard load exception:', error?.message || error);
    }

    if (!workspaceHasBusinessData(workspace)) {
      if (workspaceHasBusinessData(currentSafe)) {
        cacheWorkspace(tenantId, currentSafe as TenantWorkspace);
        return false;
      }
      const legacy = await loadLegacyTenantWorkspace(client, tenantId);
      if (legacy && workspaceHasBusinessData(legacy)) {
        cacheWorkspace(tenantId, legacy);
        await client
          .from('tenant_workspaces')
          .upsert(
            { tenant_id: tenantId, payload: legacy, updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id' }
          );
        return true;
      }
    }

    const protection = reconcileProtectedWorkspace(workspace, remoteSafe || currentSafe);
    let workspaceToSave = protection.workspace;
    const mergedTombstones = mergeProductTombstones(
      remoteSafe?.productTombstones,
      currentSafe?.productTombstones,
      workspaceToSave.productTombstones,
      readLocalProductTombstones(tenantId),
    );
    const mergedProducts = mergeProductsForSync(
      workspaceToSave.products || [],
      remoteSafe?.products || currentSafe?.products || [],
      mergedTombstones,
    );
    workspaceToSave = {
      ...workspaceToSave,
      products: mergedProducts,
      productTombstones: mergedTombstones,
    };

    if (protection.protectedKeys.length > 0) {
      console.warn(
        '[workspace] prevented destructive workspace overwrite for:',
        protection.protectedKeys.join(', ')
      );
      const backupSource = remoteSafe || currentSafe;
      if (backupSource) {
        saveRemoteWorkspaceBackup(client, tenantId, backupSource, `prevented-empty-overwrite:${protection.protectedKeys.join(',')}`).catch(() => {});
      }
      cacheWorkspace(tenantId, workspaceToSave);
    } else if (protection.shrank) {
      const backupSource = remoteSafe || currentSafe;
      if (backupSource) saveRemoteWorkspaceBackup(client, tenantId, backupSource, 'pre-shrink-save').catch(() => {});
    }

    const { error } = await client
      .from('tenant_workspaces')
      .upsert(
        { tenant_id: tenantId, payload: workspaceToSave, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      );

    if (error) {
      console.warn('[workspace] save error:', error.message, '| code:', (error as any).code);
      localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
      return false;
    }
    localStorage.removeItem(pendingKey(tenantId));
    writeLocalProductTombstones(tenantId, mergedTombstones);
    cacheWorkspace(tenantId, workspaceToSave);
    return true;
  } catch (e) {
    console.warn('[workspace] save exception:', (e as any)?.message || e);
    localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
    return false;
  }
}

// ─── Flush pending (called when going online) ──────────────────────────────

export async function flushPendingTenantWorkspace(tenantId: string): Promise<void> {
  if (!tenantId) return;
  if (!browserOnline()) return;
  const pendingRaw = localStorage.getItem(pendingKey(tenantId));
  if (!pendingRaw) return;
  try {
    const pending = JSON.parse(pendingRaw) as TenantWorkspace;
    await saveTenantWorkspace(tenantId, pending);
  } catch { /* ignore */ }
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
            const safeWithLocalProducts = reconcileLocalProductCache(tenantId, safe, event.new?.updated_at);
            if (safeWithLocalProducts !== safe) {
              client
                .from('tenant_workspaces')
                .upsert(
                  { tenant_id: tenantId, payload: safeWithLocalProducts, updated_at: new Date().toISOString() },
                  { onConflict: 'tenant_id' }
                )
                .then(({ error }: any) => {
                  if (error) console.warn('[workspace] realtime product reconciliation save error:', error.message);
                })
                .catch((error: any) => console.warn('[workspace] realtime product reconciliation exception:', error?.message || error));
              writeLocalProductTombstones(tenantId, safeWithLocalProducts.productTombstones || {});
              cacheWorkspace(tenantId, safeWithLocalProducts);
              onWorkspace(safeWithLocalProducts);
              return;
            }
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
