import { RealtimeChannel } from '@supabase/supabase-js';
import { Branch, BranchStaffAssignment, BranchStock, Delivery, Expense, Product, Purchase, SystemSettings } from '../types';
import { getDynamicSupabaseClient } from '../supabaseClient';

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
}

// ─── Local cache helpers ────────────────────────────────────────────────────

const cacheKey   = (tid: string) => `jasper_workspace_cache_${tid}`;
const pendingKey = (tid: string) => `jasper_workspace_pending_sync_${tid}`;

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
    localStorage.setItem(cacheKey(tenantId), JSON.stringify(workspace));
  } catch { /* storage full — ignore */ }
};

// ─── Check if Supabase is configured ───────────────────────────────────────

async function getConfiguredClient(): Promise<any | null> {
  try {
    const client: any = await getDynamicSupabaseClient();
    // If URL is placeholder, Supabase isn't configured — return null
    const url = (client as any).supabaseUrl || '';
    if (!url || url.includes('placeholder-url')) return null;
    return client;
  } catch {
    return null;
  }
}

// ─── Load from DB ──────────────────────────────────────────────────────────

export async function loadTenantWorkspace(tenantId: string): Promise<TenantWorkspace | null> {
  if (!tenantId) return null;
  const fallback = readCachedWorkspace(tenantId);

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

    if (!data?.payload) return fallback;

    const workspace = data.payload as TenantWorkspace;
    // Ensure all keys exist (backward compat)
    const safe: TenantWorkspace = {
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
    };
    cacheWorkspace(tenantId, safe);
    return safe;
  } catch (e) {
    console.warn('[workspace] load exception:', e);
    return fallback;
  }
}

// ─── Save to DB ────────────────────────────────────────────────────────────

export async function saveTenantWorkspace(tenantId: string, workspace: TenantWorkspace): Promise<void> {
  if (!tenantId) return;

  // Always write to local cache immediately
  cacheWorkspace(tenantId, workspace);

  const client = await getConfiguredClient();
  if (!client) {
    // Queue for when we come online
    localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
    return;
  }

  try {
    const { error } = await client
      .from('tenant_workspaces')
      .upsert(
        { tenant_id: tenantId, payload: workspace, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      );

    if (error) {
      console.warn('[workspace] save error:', error.message);
      localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
    } else {
      localStorage.removeItem(pendingKey(tenantId));
    }
  } catch (e) {
    console.warn('[workspace] save exception:', e);
    localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
  }
}

// ─── Flush pending (called when going online) ──────────────────────────────

export async function flushPendingTenantWorkspace(tenantId: string): Promise<void> {
  if (!tenantId) return;
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
        { event: 'UPDATE', schema: 'public', table: 'tenant_workspaces', filter: `tenant_id=eq.${tenantId}` },
        (event: any) => {
          const workspace = event.new?.payload as TenantWorkspace | undefined;
          if (workspace) {
            const safe: TenantWorkspace = {
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
            };
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
      business: { allowNegativeStock: false, defaultUnit: 'pcs', requireStockCheck: true, autoGenerateBarcode: false },
      productStore: { showImages: true, compactView: false },
      staffs: [],
      ...(settings || {}),
    } as SystemSettings,
    deliveries: [],
    pendingDeliveryNotes: [],
    purchases: [],
  };
}

export async function initializeNewTenantWorkspace(tenantId: string, settings?: Partial<SystemSettings>): Promise<void> {
  const workspace = emptyWorkspace(settings);
  await saveTenantWorkspace(tenantId, workspace);
}
