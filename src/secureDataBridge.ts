import { createClient } from '@supabase/supabase-js';

let secureDataBridgeInstance: ReturnType<typeof createClient> | null = null;
const PLACEHOLDER_DATA_URL = 'https://placeholder-url.supabase.co';
const PLACEHOLDER_DATA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const isPlaceholderSecureDataBridgeClient = (client: any) =>
  Boolean(client?.__isPlaceholderSecureDataBridgeClient);

export async function getSecureDataBridgeClient() {
  if (secureDataBridgeInstance && secureDataBridgeInstance.auth) {
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
      detectSessionInUrl: !isPlaceholder
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
    detectSessionInUrl: !isStaticPlaceholder
  },
  global: {
    fetch: isStaticPlaceholder ? (async () => new Response('{}', { status: 200 })) as any : undefined
  }
});
