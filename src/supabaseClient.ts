import { createClient } from '@supabase/supabase-js';

let supabaseClientInstance: ReturnType<typeof createClient> | null = null;
const PLACEHOLDER_SUPABASE_URL = 'https://placeholder-url.supabase.co';
const PLACEHOLDER_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const isPlaceholderSupabaseClient = (client: any) =>
  Boolean(client?.__isPlaceholderSupabaseClient);

export async function getDynamicSupabaseClient() {
  if (supabaseClientInstance && supabaseClientInstance.auth) {
    return supabaseClientInstance;
  }

  const metaEnv = (import.meta as any).env || {};
  let url = metaEnv.VITE_SUPABASE_URL;
  let key = metaEnv.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    try {
      const res = await fetch(`/api/auth/config`);
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
    url = PLACEHOLDER_SUPABASE_URL;
    key = PLACEHOLDER_SUPABASE_KEY;
  }

  const isPlaceholder = url === PLACEHOLDER_SUPABASE_URL;

  supabaseClientInstance = createClient(url, key, {
    auth: {
      persistSession: !isPlaceholder,
      autoRefreshToken: !isPlaceholder,
      detectSessionInUrl: !isPlaceholder
    },
    global: {
      fetch: isPlaceholder ? (async () => new Response('{}', { status: 200 })) as any : undefined
    }
  });
  (supabaseClientInstance as any).__isPlaceholderSupabaseClient = isPlaceholder;

  return supabaseClientInstance;
}

// Keep a default client as well for direct/immediate static imports
const metaEnvStatic = (import.meta as any).env || {};
const supabaseUrl = metaEnvStatic.VITE_SUPABASE_URL || PLACEHOLDER_SUPABASE_URL;
const supabaseAnonKey = metaEnvStatic.VITE_SUPABASE_ANON_KEY || PLACEHOLDER_SUPABASE_KEY;
const isStaticPlaceholder = supabaseUrl === PLACEHOLDER_SUPABASE_URL;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isStaticPlaceholder,
    autoRefreshToken: !isStaticPlaceholder,
    detectSessionInUrl: !isStaticPlaceholder
  },
  global: {
    fetch: isStaticPlaceholder ? (async () => new Response('{}', { status: 200 })) as any : undefined
  }
});
