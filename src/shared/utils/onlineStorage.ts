import { getSecureDataBridgeClient } from '../dataBridge/secureDataBridge';

const DATA_KEY = 'application_state';
const values = new Map<string, string>();
let tenantId: string | null = null;
let hydrated = false;
let saveTimer: number | null = null;
let saveChain = Promise.resolve();
let lastPersistedSnapshot = '';
let persistenceNeeded = false;
const HYDRATION_TIMEOUT_MS = 4000;
const PERSIST_DEBOUNCE_MS = 1000;

const snapshot = () => Object.fromEntries(values.entries());

const persist = async () => {
  if (!tenantId || !hydrated || !navigator.onLine) return;
  const currentTenantId = tenantId;
  const payload = snapshot();
  const serialized = JSON.stringify(payload);
  if (serialized === lastPersistedSnapshot) {
    persistenceNeeded = false;
    return;
  }
  const client: any = await getSecureDataBridgeClient();
  const { error } = await client.from('tenant_data').upsert({
    tenant_id: currentTenantId,
    data_key: DATA_KEY,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,data_key' });
  if (error) throw error;
  if (tenantId === currentTenantId) {
    lastPersistedSnapshot = serialized;
    persistenceNeeded = serialized !== JSON.stringify(snapshot());
  }
};

const schedulePersist = () => {
  if (!tenantId || !hydrated) return;
  persistenceNeeded = true;
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
    if (!values.size) {
      if (persistenceNeeded && saveTimer === null) schedulePersist();
      return;
    }
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
    if (!values.has(key)) {
      if (persistenceNeeded && saveTimer === null) schedulePersist();
      return;
    }
    values.delete(key);
    schedulePersist();
  },
  setItem(key: string, value: string) {
    const nextValue = String(value);
    if (values.get(key) === nextValue) {
      if (persistenceNeeded && saveTimer === null) schedulePersist();
      return;
    }
    values.set(key, nextValue);
    schedulePersist();
  },
};

// The debounce above means a write made just before the tenant backgrounds
// the app, closes the tab, or loses connectivity can be silently lost --
// nothing else ever flushes it to the database, so the next load reads the
// last-persisted (older) snapshot and whatever was just created or edited
// appears to have vanished. Firing an immediate (non-debounced) persist as
// soon as the page is hidden closes that window -- it can't guarantee the
// async save finishes before an outright tab kill, but 'visibilitychange'
// fires while the page is still alive (unlike 'beforeunload'/'pagehide',
// which iOS Safari and backgrounded mobile browsers can skip entirely),
// giving the request a real chance to complete.
const flushPendingPersist = () => {
  if (saveTimer === null) return;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  saveChain = saveChain.then(persist).catch((error) => {
    console.warn('[onlineStorage] database save failed:', error?.message || error);
  });
};

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingPersist();
  });
  window.addEventListener('pagehide', flushPendingPersist);
}

export async function configureOnlineStorage(nextTenantId: string): Promise<void> {
  if (!nextTenantId) return;
  if (tenantId === nextTenantId && hydrated) return;

  tenantId = nextTenantId;
  hydrated = false;
  values.clear();
  lastPersistedSnapshot = '';
  persistenceNeeded = false;

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
  persistenceNeeded = false;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = null;
}

declare global {
  var onlineStorage: Storage;
}

globalThis.onlineStorage = onlineStorage;

