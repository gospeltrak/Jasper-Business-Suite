/**
 * Web release discovery shared by browsers, installed PWAs, and remote-URL
 * Android WebViews. A new JS/CSS release loads on a fresh app navigation.
 *
 * IMPORTANT: never reload an active page from here. An automatic reload could
 * interrupt a POS sale, stock transfer, credit invoice, or unsaved form.
 * Native APK binary updates require the separately signed Android project.
 */
export interface OrvixWebRelease {
  schemaVersion: 1;
  webVersion: string;
  updateStrategy: 'next-launch';
}

const RELEASE_PATTERN = /^(?:[a-f0-9]{7,64}|build-[a-z0-9-]{4,40})$/i;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

export const isValidOrvixWebRelease = (value: unknown): value is OrvixWebRelease => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const release = value as Record<string, unknown>;
  return release.schemaVersion === 1
    && release.updateStrategy === 'next-launch'
    && typeof release.webVersion === 'string'
    && RELEASE_PATTERN.test(release.webVersion);
};

export const isNewOrvixWebRelease = (current: string, release: unknown): boolean =>
  RELEASE_PATTERN.test(current)
  && isValidOrvixWebRelease(release)
  && release.webVersion !== current;

declare global {
  interface Window {
    __orvixWebReleaseAvailable?: string;
  }
}

export function startOrvixWebReleaseChecks(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  // Bundled Android assets use capacitor:/file: origins and cannot be hot-
  // swapped from the website. Only remote-URL WebViews receive web releases.
  if (window.location.protocol !== 'https:' && window.location.protocol !== 'http:') return () => {};
  const currentVersion = document.querySelector<HTMLMetaElement>(
    'meta[name="orvix-web-release"]'
  )?.content || '';

  // Development and unversioned legacy shells should not poll or display
  // spurious updates. The build script stamps all release markers together.
  if (!RELEASE_PATTERN.test(currentVersion)) return () => {};

  let lastCheckedAt = 0;
  let checking = false;
  let stopped = false;
  let lastNotifiedVersion = '';

  const check = async () => {
    if (stopped || checking || document.visibilityState === 'hidden') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (Date.now() - lastCheckedAt < CHECK_INTERVAL_MS) return;

    checking = true;
    lastCheckedAt = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch('/orvix-release.json', {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });
      // A missing file can be rewritten to index.html by the SPA fallback.
      // Ignore HTML rather than treating it as a release manifest.
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
      const release: unknown = await response.json();
      if (!stopped && isNewOrvixWebRelease(currentVersion, release)) {
        const latestVersion = (release as OrvixWebRelease).webVersion;
        if (latestVersion !== lastNotifiedVersion) {
          lastNotifiedVersion = latestVersion;
          window.__orvixWebReleaseAvailable = latestVersion;
          window.dispatchEvent(new CustomEvent('orvix:web-release-available', {
            detail: { currentVersion, latestVersion, apply: 'next-launch' },
          }));
        }
      }
    } catch {
      // Temporary network loss must never prevent sales or login.
    } finally {
      window.clearTimeout(timeout);
      checking = false;
    }
  };

  const checkOnVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };

  window.addEventListener('focus', checkOnVisible);
  window.addEventListener('pageshow', checkOnVisible);
  window.addEventListener('online', checkOnVisible);
  document.addEventListener('visibilitychange', checkOnVisible);
  const interval = window.setInterval(checkOnVisible, CHECK_INTERVAL_MS);
  void check();

  return () => {
    stopped = true;
    window.clearInterval(interval);
    window.removeEventListener('focus', checkOnVisible);
    window.removeEventListener('pageshow', checkOnVisible);
    window.removeEventListener('online', checkOnVisible);
    document.removeEventListener('visibilitychange', checkOnVisible);
  };
}
