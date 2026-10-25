import { Capacitor } from '@capacitor/core';

/**
 * Bundled Capacitor content has an app-local origin, but Orvix's existing
 * authenticated backend lives at https://orvix.africa/api. The website and
 * PWA retain their native same-origin fetch behavior.
 *
 * This adapter redirects ONLY requests targeting /api/ on the native local
 * origin. Supabase calls, external integrations and assets are untouched.
 *
 * CapacitorHttp handles native cross-origin requests when enabled in
 * capacitor.config.ts. Never rewrite absolute third-party URLs.
 */
const API_ORIGIN = 'https://orvix.africa';
let installed = false;

export function installNativeApiTransport(): void {
  if (installed || typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    let candidate: URL;
    try {
      candidate = new URL(raw, window.location.href);
    } catch {
      return originalFetch(input, init);
    }
    if (candidate.origin !== window.location.origin || !candidate.pathname.startsWith('/api/')) {
      return originalFetch(input, init);
    }

    const upstream = new URL(candidate.pathname + candidate.search, API_ORIGIN);
    // Preserve the caller's headers, body, method, credentials and AbortSignal.
    if (typeof input === 'string' || input instanceof URL) {
      return originalFetch(upstream.href, init);
    }
    return originalFetch(new Request(upstream.href, input), init);
  };
}
