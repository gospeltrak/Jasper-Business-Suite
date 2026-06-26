import { RealtimeChannel } from '@supabase/supabase-js';
import { Delivery, Expense, Product, SystemSettings } from '../types';
import { getDynamicSupabaseClient } from '../supabaseClient';

export interface TenantWorkspace {
  products: Product[];
  sales: any[];
  expenses: Expense[];
  settings: SystemSettings;
  deliveries: Delivery[];
  pendingDeliveryNotes: any[];
}

const cacheKey = (tenantId: string) => `jasper_workspace_cache_${tenantId}`;
const pendingKey = (tenantId: string) => `jasper_workspace_pending_sync_${tenantId}`;

export const readCachedWorkspace = (tenantId: string): TenantWorkspace | null => {
  try {
    const stored = localStorage.getItem(cacheKey(tenantId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const cacheWorkspace = (tenantId: string, workspace: TenantWorkspace) => {
  localStorage.setItem(cacheKey(tenantId), JSON.stringify(workspace));
};

export async function loadTenantWorkspace(tenantId: string): Promise<TenantWorkspace | null> {
  const fallback = readCachedWorkspace(tenantId);
  try {
    const client: any = await getDynamicSupabaseClient();
    const { data, error } = await client
      .from('tenant_workspaces')
      .select('payload')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;
    const workspace = data?.payload as TenantWorkspace | undefined;
    if (workspace) cacheWorkspace(tenantId, workspace);
    return workspace || fallback;
  } catch {
    return fallback;
  }
}

export async function saveTenantWorkspace(tenantId: string, workspace: TenantWorkspace) {
  cacheWorkspace(tenantId, workspace);
  try {
    const client: any = await getDynamicSupabaseClient();
    const { error } = await client
      .from('tenant_workspaces')
      .upsert({ tenant_id: tenantId, payload: workspace, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
    if (error) throw error;
    localStorage.removeItem(pendingKey(tenantId));
  } catch {
    localStorage.setItem(pendingKey(tenantId), JSON.stringify(workspace));
  }
}

export async function flushPendingTenantWorkspace(tenantId: string) {
  const pending = readCachedWorkspace(tenantId);
  if (!pending) return;
  await saveTenantWorkspace(tenantId, pending);
}

export async function subscribeToTenantWorkspace(
  tenantId: string,
  onWorkspace: (workspace: TenantWorkspace) => void
): Promise<() => void> {
  try {
    const client: any = await getDynamicSupabaseClient();
    const channel: RealtimeChannel = client
      .channel(`tenant-workspace:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_workspaces', filter: `tenant_id=eq.${tenantId}` }, (event: any) => {
        const workspace = event.new?.payload as TenantWorkspace | undefined;
        if (workspace) {
          cacheWorkspace(tenantId, workspace);
          onWorkspace(workspace);
        }
      })
      .subscribe();
    return () => { client.removeChannel(channel); };
  } catch {
    return () => undefined;
  }
}
