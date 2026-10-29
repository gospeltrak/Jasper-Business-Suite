import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * Native-only startup and edge-to-edge UI adapter.
 * The public website and installed PWA keep their existing routes and styling.
 * Login still uses the same Supabase backend and Cloudflare server verification.
 */
export const isOrvixNativeApp = () => Capacitor.isNativePlatform();

export function nativeEntryPath(path: string): string {
  if (!isOrvixNativeApp()) return path;
  const url = new URL(path, window.location.origin);
  if (url.pathname === '/' || url.pathname === '/home') {
    // A returning authenticated session will be restored by App's existing
    // /login -> dashboard redirect. Never discard OAuth or recovery callbacks.
    return '/login';
  }
  return path;
}

const nativeStyles = `
/* Native only: never change the website/PWA layout or emerald theme. */
html.orvix-native-app {
  --orvix-native-safe-top: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px));
  --orvix-native-safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px));
  --dashboard-bottom-nav-height: calc(64px + var(--orvix-native-safe-bottom) + var(--browser-bottom-inset, 0px));
}
html.orvix-native-app #dashboard-scaffold {
  box-sizing: border-box;
  padding-top: var(--orvix-native-safe-top);
}
html.orvix-native-app #dashboard-mobile-nav {
  padding-bottom: calc(var(--orvix-native-safe-bottom) + var(--browser-bottom-inset, 0px));
}
html.orvix-native-app #login-container {
  min-height: var(--app-height, 100dvh);
  box-sizing: border-box;
  justify-content: safe center;
  padding-top: calc(1rem + var(--orvix-native-safe-top));
  padding-bottom: calc(1rem + var(--orvix-native-safe-bottom));
  overflow-y: auto;
}
html.orvix-native-app #login-container > div.relative.z-10 {
  width: 100%;
  max-width: 30rem;
  margin-left: auto;
  margin-right: auto;
}
html.orvix-native-app #login-container input,
html.orvix-native-app #login-container select,
html.orvix-native-app #login-container textarea {
  font-size: 16px;
}
@media (max-width: 380px) {
  html.orvix-native-app #login-container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
  html.orvix-native-app #login-container .rounded-3xl.p-8 {
    padding: 1.25rem;
  }
}
`;

export function installNativeAppExperience(): void {
  if (!isOrvixNativeApp()) return;
  document.documentElement.classList.add('orvix-native-app');

  // The packaged app's cold start is local, not the remote landing website.
  const entry = nativeEntryPath(window.location.pathname);
  if (entry === '/login' && ['/', '/home'].includes(window.location.pathname)) {
    window.history.replaceState(window.history.state, '', '/login');
  }

  if (!document.getElementById('orvix-native-layout')) {
    const style = document.createElement('style');
    style.id = 'orvix-native-layout';
    style.textContent = nativeStyles;
    document.head.appendChild(style);
  }

  // Keep system status icons visible, with legible contrast. Capacitor 8's
  // SystemBars supplies Android 15+/16+ edge-to-edge safe area values.
  void SystemBars.setStyle({ style: SystemBarsStyle.Light })
    .catch((error) => console.warn('[orvix-native] SystemBars style unavailable', error));
}
