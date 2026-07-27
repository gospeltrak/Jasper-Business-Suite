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
import {
  extractPayloadSaleTombstones,
  mergeSalesForSync,
  mergeSaleTombstones,
  readLocalSaleTombstones,
  writeLocalSaleTombstones,
  type SaleTombstones,
} from './saleSync';
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
  saleTombstones?: SaleTombstones;
}

// ─── Runtime state helpers ──────────────────────────────────────────────────

const runtimeWorkspaces = new Map<string, TenantWorkspace>();
const runtimeProductsUpdatedAt = new Map<string, string>();
const workspaceSaveQueue = new Map<string, Promise<boolean>>();

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
    sales:               mergeSalesForSync(workspace.sales || [], [], workspace.saleTombstones || {}),
    expenses:            workspace.expenses            || [],
    settings:            workspace.settings            || ({} as SystemSettings),
    deliveries:          workspace.deliveries          || [],
    pendingDeliveryNotes:workspace.pendingDeliveryNotes|| [],
    purchases:           workspace.purchases           || [],
    productTombstones:   workspace.productTombstones   || {},
    saleTombstones:      workspace.saleTombstones      || {},
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
    saleTombstones: mergeSaleTombstones(
      extractPayloadSaleTombstones(byKey.get('sales'), tenantId),
      extractPayloadSaleTombstones(byKey.get('sales_map'), tenantId),
    ),
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
    writeLocalSaleTombstones(tenantId, safe.saleTombstones || {});
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
        writeLocalSaleTombstones(tenantId, reconciled.saleTombstones || {});
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

async function saveTenantWorkspaceNow(tenantId: string, workspace: TenantWorkspace): Promise<boolean> {
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

    const hasSaleDeletionIntent = Object.keys(workspace.saleTombstones || {}).length > 0;
    if (!workspaceHasBusinessData(workspace) && !hasSaleDeletionIntent) {
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

    const mergeBase = remoteSafe || currentSafe;
    const mergedSaleTombstones = mergeSaleTombstones(
      remoteSafe?.saleTombstones,
      currentSafe?.saleTombstones,
      workspaceToSave.saleTombstones,
      readLocalSaleTombstones(tenantId),
    );
    workspaceToSave = {
      ...workspaceToSave,
      sales: mergeSalesForSync(
        workspaceToSave.sales,
        [],
        mergedSaleTombstones,
      ),
      saleTombstones: mergedSaleTombstones,
    };
    if (mergeBase) {
      for (const key of appendMergeWorkspaceKeys) {
        (workspaceToSave as any)[key] = mergeRecordsById(
          (workspaceToSave as any)[key],
          (mergeBase as any)[key],
        );
      }
      workspaceToSave.settings = mergeSettingsForSync(workspaceToSave.settings, mergeBase.settings);
    }

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
      return false;
    }
    // Preserve any legacy pending workspace payloads for manual audit/recovery.
    // Online-only mode must not silently delete local records, even after a
    // successful cloud save.
    writeLocalProductTombstones(tenantId, mergedTombstones);
    writeLocalSaleTombstones(tenantId, mergedSaleTombstones);
    cacheWorkspace(tenantId, workspaceToSave);
    return true;
  } catch (e) {
    console.warn('[workspace] save exception:', (e as any)?.message || e);
    return false;
  }
}

export function saveTenantWorkspace(tenantId: string, workspace: TenantWorkspace): Promise<boolean> {
  if (!tenantId) return Promise.resolve(false);
  const previous = workspaceSaveQueue.get(tenantId) || Promise.resolve(true);
  const next = previous
    .catch(() => false)
    .then(() => saveTenantWorkspaceNow(tenantId, workspace));
  workspaceSaveQueue.set(tenantId, next);
  void next.finally(() => {
    if (workspaceSaveQueue.get(tenantId) === next) workspaceSaveQueue.delete(tenantId);
  });
  return next;
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
    const channelId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const channel: RealtimeChannel = client
      .channel(`tenant-workspace:${tenantId}:${channelId}`)
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
            writeLocalSaleTombstones(tenantId, safe.saleTombstones || {});
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
    saleTombstones: {},
  };
}

export async function initializeNewTenantWorkspace(tenantId: string, settings?: Partial<SystemSettings>): Promise<void> {
  const workspace = emptyWorkspace(settings);
  await saveTenantWorkspace(tenantId, workspace);
}
