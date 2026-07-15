import { getSecureDataBridgeClient } from '../secureDataBridge';

const DATA_KEY = 'application_state';
const values = new Map<string, string>();
let tenantId: string | null = null;
let hydrated = false;
let saveTimer: number | null = null;
let saveChain = Promise.resolve();

const snapshot = () => Object.fromEntries(values.entries());

const persist = async () => {
  if (!tenantId || !hydrated || !navigator.onLine) return;
  const currentTenantId = tenantId;
  const payload = snapshot();
  const client: any = await getSecureDataBridgeClient();
  const { error } = await client.from('tenant_data').upsert({
    tenant_id: currentTenantId,
    data_key: DATA_KEY,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,data_key' });
  if (error) throw error;
};

const schedulePersist = () => {
  if (!tenantId || !hydrated) return;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveChain = saveChain.then(persist).catch((error) => {
      console.warn('[onlineStorage] database save failed:', error?.message || error);
    });
  }, 300);
};

export const onlineStorage: Storage = {
  get length() { return values.size; },
  clear() {
    values.clear();
    schedulePersist();
  },
  getItem(key: string) {
    return values.has(key) ? values.get(key)! : null;
  },
  key(index: number) {
    return Array.from(values.keys())[index] ?? null;
  },
  removeItem(key: string) {
    values.delete(key);
    schedulePersist();
  },
  setItem(key: string, value: string) {
    values.set(key, String(value));
    schedulePersist();
  },
};

export async function configureOnlineStorage(nextTenantId: string): Promise<void> {
  if (!nextTenantId) return;
  if (tenantId === nextTenantId && hydrated) return;

  tenantId = nextTenantId;
  hydrated = false;
  values.clear();

  const client: any = await getSecureDataBridgeClient();
  const { data, error } = await client
    .from('tenant_data')
    .select('payload')
    .eq('tenant_id', nextTenantId)
    .eq('data_key', DATA_KEY)
    .maybeSingle();

  if (error) {
    console.warn('[onlineStorage] database load failed:', error.message);
  } else if (data?.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
    for (const [key, value] of Object.entries(data.payload)) {
      if (typeof value === 'string') values.set(key, value);
    }
  }
  hydrated = true;
}

export function resetOnlineStorage(): void {
  tenantId = null;
  hydrated = false;
  values.clear();
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = null;
}

declare global {
  var onlineStorage: Storage;
}

globalThis.onlineStorage = onlineStorage;

