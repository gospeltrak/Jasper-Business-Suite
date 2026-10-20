import { createClient } from '@supabase/supabase-js';

let secureDataBridgeInstance: any = null;
const PLACEHOLDER_DATA_URL = 'https://placeholder-url.supabase.co';
const PLACEHOLDER_DATA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

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

// A password-recovery link signs the browser in just like a normal login
// (Supabase has no other way to let the user prove they own the account),
// so the app's "there is a session, open the dashboard" logic cannot tell
// the two apart by calling getSession() alone -- it would silently skip
// straight past the "set a new password" screen. Registered here, at
// module load, so it is listening before anything else in the app runs
// and can never miss the PASSWORD_RECOVERY event racing a later screen's
// own subscription.
let passwordRecoverySessionActive = false;
secureDataBridge.auth.onAuthStateChange((event: string) => {
  if (event === 'PASSWORD_RECOVERY') passwordRecoverySessionActive = true;
  if (event === 'SIGNED_OUT') passwordRecoverySessionActive = false;
});
export const isPasswordRecoverySessionActive = () => passwordRecoverySessionActive;

// The PASSWORD_RECOVERY event above only fires once Supabase has finished
// exchanging the link's code for a session -- a real network round trip.
// A synchronous check like "is there already a cached user, redirect them
// to the dashboard" can run and complete before that finishes, so it would
// never see the flag in time and would redirect right past the recovery
// screen using a stale, unrelated cached profile. Recognising the callback
// straight from the URL closes that gap: it is true the instant the page
// loads with a Supabase auth link, before any network call resolves.
// Supabase strips these params from the URL once the exchange completes,
// so this naturally turns false again on its own.
export const hasPendingSupabaseAuthCallback = () => {
  if (typeof window === 'undefined') return false;
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  return /[?&]code=/.test(search) || /access_token=/.test(hash) || /type=recovery/.test(hash) || /type=recovery/.test(search);
};
