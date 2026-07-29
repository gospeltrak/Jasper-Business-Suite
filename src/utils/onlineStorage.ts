import { getSecureDataBridgeClient } from '../secureDataBridge';

const DATA_KEY = 'application_state';
const values = new Map<string, string>();
let tenantId: string | null = null;
let hydrated = false;
let saveTimer: number | null = null;
let saveChain = Promise.resolve();
let lastPersistedSnapshot = '';
const HYDRATION_TIMEOUT_MS = 4000;
const PERSIST_DEBOUNCE_MS = 1000;

const snapshot = () => Object.fromEntries(values.entries());

const persist = async () => {
  if (!tenantId || !hydrated || !navigator.onLine) return;
  const currentTenantId = tenantId;
  const payload = snapshot();
  const serialized = JSON.stringify(payload);
  if (serialized === lastPersistedSnapshot) return;
  const client: any = await getSecureDataBridgeClient();
  const { error } = await client.from('tenant_data').upsert({
    tenant_id: currentTenantId,
    data_key: DATA_KEY,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,data_key' });
  if (error) throw error;
  if (tenantId === currentTenantId) lastPersistedSnapshot = serialized;
};

const schedulePersist = () => {
  if (!tenantId || !hydrated) return;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveChain = saveChain.then(persist).catch((error) => {
      console.warn('[onlineStorage] database save failed:', error?.message || error);
    });
  }, PERSIST_DEBOUNCE_MS);
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
  lastPersistedSnapshot = '';

  try {
    const client: any = await getSecureDataBridgeClient();
    const result: any = await Promise.race([
      Promise.resolve(
        client
          .from('tenant_data')
          .select('payload')
          .eq('tenant_id', nextTenantId)
          .eq('data_key', DATA_KEY)
          .maybeSingle()
      ),
      new Promise((_, reject) => window.setTimeout(
        () => reject(new Error('Online storage hydration timed out.')),
        HYDRATION_TIMEOUT_MS,
      )),
    ]);
    const { data, error } = result || {};
    if (error) {
      console.warn('[onlineStorage] database load failed:', error.message);
    } else if (data?.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
      for (const [key, value] of Object.entries(data.payload)) {
        if (typeof value === 'string') values.set(key, value);
      }
    }
  } catch (error: any) {
    // Authentication must never remain on a loading screen because optional
    // workspace hydration is slow or temporarily unavailable.
    console.warn('[onlineStorage] continuing without preloaded data:', error?.message || error);
  } finally {
    lastPersistedSnapshot = JSON.stringify(snapshot());
    hydrated = true;
  }
}

export function resetOnlineStorage(): void {
  tenantId = null;
  hydrated = false;
  values.clear();
  lastPersistedSnapshot = '';
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = null;
}

declare global {
  var onlineStorage: Storage;
}

globalThis.onlineStorage = onlineStorage;
