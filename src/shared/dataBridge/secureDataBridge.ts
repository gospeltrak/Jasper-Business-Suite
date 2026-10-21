import { createClient } from '@supabase/supabase-js';

let secureDataBridgeInstance: any = null;
const PLACEHOLDER_DATA_URL = 'https://placeholder-url.supabase.co';
const PLACEHOLDER_DATA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

const PASSWORD_RECOVERY_STORAGE_KEY = 'jasper_password_recovery_active';

function readPasswordRecoveryState(): boolean {
  if (typeof window === 'undefined') return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (search.get('type') === 'recovery' || hash.get('type') === 'recovery') return true;
  try {
    return window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// A password-recovery link signs the browser in just like a normal login
// (Supabase has no other way to let the user prove they own the account), so
// the app's "there is a session, open the dashboard" logic cannot tell the
// two apart by calling getSession() alone -- it would silently skip straight
// past the "set a new password" screen.
//
// Capture recovery state synchronously from the URL at module load, before
// Supabase has consumed it and before any lazy-loaded route mounts, and keep
// it in sessionStorage so it survives a reload while the recovery screen is
// still open. This is UI routing state, never proof of authorization to
// update a user -- the actual password change still goes through Supabase's
// own session/auth checks.
let passwordRecoverySessionActive = readPasswordRecoveryState();
const passwordRecoveryListeners = new Set<() => void>();
export const isPasswordRecoverySessionActive = () => passwordRecoverySessionActive;
export const subscribeToPasswordRecoverySession = (listener: () => void) => {
  passwordRecoveryListeners.add(listener);
  return () => { passwordRecoveryListeners.delete(listener); };
};

function observePasswordRecovery(client: any): void {
  if (isPlaceholderSecureDataBridgeClient(client)) return;
  client.auth.onAuthStateChange((event: string, session: unknown) => {
    const sessionEnded = event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session);
    if (event !== 'PASSWORD_RECOVERY' && !sessionEnded) return;
    passwordRecoverySessionActive = event === 'PASSWORD_RECOVERY';
    try {
      if (passwordRecoverySessionActive) window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, 'true');
      else window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    } catch { /* In-memory recovery still works when browser storage is denied. */ }
    for (const listener of passwordRecoveryListeners) listener();
  });
}

// Keep authentication outside onlineStorage. Large tenant workspaces can fill
// onlineStorage; auth must still be able to save its token and complete login.
// localStorage (not sessionStorage): the session must survive closing the
// tab/app/browser and only end on an explicit Logout — sessionStorage was
// wiping this on every close, forcing a fresh login each time.
const browserAuthStorage = {
  getItem: (key: string) => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  }
};

export const isPlaceholderSecureDataBridgeClient = (client: any) =>
  Boolean(client?.__isPlaceholderSecureDataBridgeClient);

export async function getSecureDataBridgeClient() {
  if (secureDataBridgeInstance && secureDataBridgeInstance.auth) {
    return secureDataBridgeInstance;
  }

  // Reuse the eager real client. Creating two GoTrue clients with the same
  // project/storage key can make logout and the next login behave unpredictably.
  if (!isStaticPlaceholder) {
    secureDataBridgeInstance = secureDataBridge;
    return secureDataBridgeInstance;
  }

  const metaEnv = (import.meta as any).env || {};
  let url = metaEnv.VITE_SUPABASE_URL;
  let key = metaEnv.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    try {
      const res = await fetch(`/api/auth/config`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('frontend config endpoint unavailable');
      }
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseAnonKey) {
        url = data.supabaseUrl;
        key = data.supabaseAnonKey;
      }
    } catch (e: any) {
      // Static deployments fall back to the local/demo client when no config API is available.
    }
  }

  if (!url || !key) {
    // Graceful fallback to prevent compilation/load failure
    url = PLACEHOLDER_DATA_URL;
    key = PLACEHOLDER_DATA_KEY;
  }

  const isPlaceholder = url === PLACEHOLDER_DATA_URL;

  secureDataBridgeInstance = createClient(url, key, {
    auth: {
      persistSession: !isPlaceholder,
      autoRefreshToken: !isPlaceholder,
      detectSessionInUrl: !isPlaceholder,
      storage: browserAuthStorage,
      storageKey: 'jasper_supabase_auth_v2'
    },
    global: {
      fetch: isPlaceholder ? (async () => new Response('{}', { status: 200 })) as any : undefined
    }
  });
  (secureDataBridgeInstance as any).__isPlaceholderSecureDataBridgeClient = isPlaceholder;
  observePasswordRecovery(secureDataBridgeInstance);

  return secureDataBridgeInstance;
}

// Keep a default client as well for direct/immediate static imports
const metaEnvStatic = (import.meta as any).env || {};
const secureDataUrl = metaEnvStatic.VITE_SUPABASE_URL || PLACEHOLDER_DATA_URL;
const secureDataAnonKey = metaEnvStatic.VITE_SUPABASE_ANON_KEY || PLACEHOLDER_DATA_KEY;
const isStaticPlaceholder = secureDataUrl === PLACEHOLDER_DATA_URL;

export const secureDataBridge = createClient(secureDataUrl, secureDataAnonKey, {
  auth: {
    persistSession: !isStaticPlaceholder,
    autoRefreshToken: !isStaticPlaceholder,
    detectSessionInUrl: !isStaticPlaceholder,
    storage: browserAuthStorage,
    storageKey: isStaticPlaceholder ? 'jasper_supabase_auth_placeholder_v2' : 'jasper_supabase_auth_v2'
  },
  global: {
    fetch: isStaticPlaceholder ? (async () => new Response('{}', { status: 200 })) as any : undefined
  }
});

// Watch the eager client as well as a client created from /api/auth/config.
if (!isStaticPlaceholder) observePasswordRecovery(secureDataBridge);

// A pending OAuth/auth callback that isn't itself a recovery session (used to
// hold off a stale-cached-user redirect until a fresh sign-in finishes).
export const hasPendingSupabaseAuthCallback = () => {
  if (typeof window === 'undefined') return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return search.has('code') || hash.has('access_token')
    || search.get('type') === 'recovery' || hash.get('type') === 'recovery';
};
