import { getSecureDataBridgeClient } from '../dataBridge/secureDataBridge';
import { hydrateTypedOnlineState, makeTypedOnlineStateWrites, type TypedOnlineStateChange } from './normalizedOnlineState';

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
// OFF by default; a tenant must ALSO have an explicitly activated status row.
const USE_TYPED_APP_STATE = import.meta.env.VITE_ORVIX_TYPED_APP_STATE === 'true';
let typedStateActive = false;
let typedStateReadFailed = false;
let hydrationGeneration = 0;
let nextTypedRevision = 0;
const typedPendingChanges = new Map<string, TypedOnlineStateChange>();

const trackTypedChange = (key: string, value: string | null, isDeleted: boolean) => {
  if (!typedStateActive) return;
  typedPendingChanges.set(key, { value, isDeleted, revision: ++nextTypedRevision });
};

const snapshot = () => Object.fromEntries(values.entries());

const persist = async () => {
  if (!tenantId || !hydrated || !navigator.onLine) return;
  const currentTenantId = tenantId;
  // When a tenant has opted in and the DB migration status is active, send
  // *only* keys changed since the last successful commit. This avoids
  // rewriting the 5+ MB promotional image whenever a tiny preference changes.
  if (typedStateActive) {
    const changes = Array.from(typedPendingChanges.entries());
    if (!changes.length) {
      persistenceNeeded = false;
      return;
    }
    const client: any = await getSecureDataBridgeClient();
    const { error } = await client.from('orvix_tenant_application_state_entries')
      .upsert(makeTypedOnlineStateWrites(currentTenantId, changes), {
        onConflict: 'tenant_id,state_key',
      });
    if (error) throw error;
    if (tenantId === currentTenantId && typedStateActive) {
      for (const [key, captured] of changes) {
        if (typedPendingChanges.get(key)?.revision === captured.revision) {
          typedPendingChanges.delete(key);
        }
      }
      persistenceNeeded = typedPendingChanges.size > 0;
      if (!persistenceNeeded) lastPersistedSnapshot = JSON.stringify(snapshot());
      else if (saveTimer === null) schedulePersist();
    }
    return;
  }
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
    if (typedStateActive) {
      for (const [key, value] of values) trackTypedChange(key, value, true);
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
    if (typedStateActive) trackTypedChange(key, values.get(key)!, true);
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
    trackTypedChange(key, nextValue, false);
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

  const generation = ++hydrationGeneration;
  tenantId = nextTenantId;
  hydrated = false;
  values.clear();
  lastPersistedSnapshot = '';
  persistenceNeeded = false;
  typedStateActive = false;
  typedStateReadFailed = false;
  typedPendingChanges.clear();

  try {
    const client: any = await getSecureDataBridgeClient();
    if (USE_TYPED_APP_STATE) {
      const { data: status, error: statusError } = await client
        .from('orvix_tenant_application_state_status')
        .select('state')
        .eq('tenant_id', nextTenantId)
        .maybeSingle();
      if (tenantId !== nextTenantId || hydrationGeneration !== generation) return;
      if (statusError && !['42P01', 'PGRST205'].includes(String(statusError.code || ''))) {
        typedStateReadFailed = true;
        throw statusError;
      }
      if (!statusError && status?.state === 'active') {
        // Status can only be activated by a reviewed server-side cutover,
        // never by a browser. A failed typed read MUST NOT fall back to
        // potentially stale legacy JSON and allow overwriting live values.
        typedStateReadFailed = true;
        const loadedRows: any[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data: rows, error: typedError } = await client
            .from('orvix_tenant_application_state_entries')
            .select('state_key,state_value,is_deleted')
            .eq('tenant_id', nextTenantId)
            .order('state_key', { ascending: true })
            .range(offset, offset + 499);
          if (tenantId !== nextTenantId || hydrationGeneration !== generation) return;
          if (typedError || !Array.isArray(rows)) {
            throw typedError || new Error('Typed application state read failed');
          }
          loadedRows.push(...rows);
          if (rows.length < 500) break;
        }
        const restored = hydrateTypedOnlineState(loadedRows);
        values.clear();
        for (const [key, value] of restored) values.set(key, value);
        typedStateActive = true;
        typedStateReadFailed = false;
        return;
      }
    }
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
    if (tenantId !== nextTenantId || hydrationGeneration !== generation) return;
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
    if (tenantId !== nextTenantId || hydrationGeneration !== generation) return;
    lastPersistedSnapshot = JSON.stringify(snapshot());
    hydrated = !typedStateReadFailed;
  }
}

export function resetOnlineStorage(): void {
  hydrationGeneration += 1;
  tenantId = null;
  hydrated = false;
  values.clear();
  lastPersistedSnapshot = '';
  persistenceNeeded = false;
  typedStateActive = false;
  typedStateReadFailed = false;
  typedPendingChanges.clear();
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = null;
}

declare global {
  var onlineStorage: Storage;
}

globalThis.onlineStorage = onlineStorage;

