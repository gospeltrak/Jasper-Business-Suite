import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Share, X } from 'lucide-react';
import {
  BeforeInstallPromptEvent,
  clearCapturedInstallPrompt,
  getCapturedInstallPrompt,
  hasDismissedInstallPrompt,
  hasInstalledPwa,
  markInstallPromptDismissed,
  markPwaInstalled,
  subscribeToInstallPrompt,
  subscribeToInstalled,
  subscribeToManualInstallTrigger,
} from '../utils/pwaInstallPrompt';

interface PWAInstallBannerProps {
  tenantId: string;
  businessName: string;
  businessLogo?: string | null;
  enabled?: boolean;
  appId?: string;
  startUrl?: string;
  automaticPrompt?: boolean;
}

const isIOS = () =>
  /ipad|iphone|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;

const isAndroid = () => /android/i.test(navigator.userAgent);

const isIOSSafari = () => {
  if (!isIOS()) return false;
  return !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
};

const isInStandaloneMode = () =>
  (window.navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches;

const safeBusinessName = (value: string) => value.trim() || 'My Business';

const shortBusinessName = (value: string) => {
  const name = safeBusinessName(value);
  return name.length <= 24 ? name : `${name.slice(0, 23).trim()}…`;
};

const businessInitials = (value: string) => safeBusinessName(value)
  .split(/\s+/)
  .slice(0, 2)
  .map(word => word.charAt(0).toUpperCase())
  .join('') || 'MB';

const createBusinessInitialsIcon = (value: string) => {
  const initials = businessInitials(value).replace(/[&<>"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#10b981"/><text x="256" y="286" text-anchor="middle" font-family="Arial,sans-serif" font-size="190" font-weight="800" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const inferImageType = (src: string) => {
  if (src.startsWith('data:image/png')) return 'image/png';
  if (src.startsWith('data:image/svg')) return 'image/svg+xml';
  if (src.startsWith('data:image/webp')) return 'image/webp';
  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) return 'image/jpeg';
  if (/\.svg(?:\?|$)/i.test(src)) return 'image/svg+xml';
  if (/\.webp(?:\?|$)/i.test(src)) return 'image/webp';
  if (/\.jpe?g(?:\?|$)/i.test(src)) return 'image/jpeg';
  return 'image/png';
};

// Business documents (receipts, invoices) are printed on white paper, so the
// installed app icon and splash screen must show the tenant logo the same
// way: sitting on a solid white square, never floating on a dark or
// transparent background. This composites the (possibly transparent) logo
// onto a white canvas before it is used as a PWA icon.
const createWhiteBackedIcon = (src: string): Promise<string> =>
  new Promise((resolve) => {
    if (!src || src.startsWith('data:image/svg')) {
      // SVG initials badge already ships its own solid background.
      resolve(src);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx || !img.naturalWidth || !img.naturalHeight) { resolve(src); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        // Keep the logo inside Android's maskable "safe zone" (~80% of the icon).
        const padding = size * 0.16;
        const maxDim = size - padding * 2;
        const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
        const drawW = img.naturalWidth * ratio;
        const drawH = img.naturalHeight * ratio;
        ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        // Cross-origin logo without CORS headers taints the canvas — fall
        // back to the original source rather than breaking the PWA banner.
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

function usePersonalizedManifest({
  tenantId,
  businessName,
  businessLogo,
  enabled,
  appId,
  startUrl,
}: PWAInstallBannerProps) {
  useEffect(() => {
    if (!enabled || !tenantId) return undefined;
    let cancelled = false;
    // index.html ships one static <link rel="manifest"> / <link
    // rel="apple-touch-icon"> pair so the landing/login page is installable
    // pre-auth. Rather than appending a second manifest/icon link (which
    // leaves two competing tags in the DOM with inconsistent cross-browser
    // "which one wins" behavior), swap that existing element's href to the
    // tenant-specific one and restore the original Orvix href on cleanup.
    const existingManifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const existingAppleIconLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const originalManifestHref = existingManifestLink?.getAttribute('href') ?? null;
    const originalAppleIconHref = existingAppleIconLink?.getAttribute('href') ?? null;
    let titleMeta: HTMLMetaElement | null = null;
    let manifestUrl: string | null = null;

    const name = safeBusinessName(businessName);
    const encodedTenantId = encodeURIComponent(tenantId);
    const resolvedStartUrl = startUrl || `/dashboard?tenant=${encodedTenantId}`;
    const resolvedAppId = appId || resolvedStartUrl;
    const rawIconSource = businessLogo || createBusinessInitialsIcon(name);

    (async () => {
      // Always composite onto solid white first — the tenant logo must look
      // the same on the home-screen icon / splash screen as it does on a
      // printed receipt or invoice, not floating on transparency or navy.
      const iconSource = await createWhiteBackedIcon(rawIconSource);
      if (cancelled) return;

      const icons = [{
        src: iconSource,
        sizes: 'any',
        type: inferImageType(iconSource),
        purpose: 'any maskable',
      }];

      const manifest = {
        id: resolvedAppId,
        name,
        short_name: shortBusinessName(name),
        description: `${name} business app`,
        start_url: resolvedStartUrl,
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        background_color: '#ffffff',
        theme_color: '#ffffff',
        orientation: 'portrait-primary',
        categories: ['business', 'productivity', 'finance'],
        prefer_related_applications: false,
        icons,
      };

      manifestUrl = URL.createObjectURL(
        new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }),
      );
      if (existingManifestLink) {
        existingManifestLink.href = manifestUrl;
        existingManifestLink.dataset.tenantPwa = tenantId;
      }

      titleMeta = document.createElement('meta');
      titleMeta.name = 'apple-mobile-web-app-title';
      titleMeta.content = name;
      titleMeta.dataset.tenantPwa = tenantId;
      document.head.appendChild(titleMeta);

      if (existingAppleIconLink) {
        existingAppleIconLink.href = iconSource;
        existingAppleIconLink.dataset.tenantPwa = tenantId;
      }
    })();

    return () => {
      cancelled = true;
      if (existingManifestLink) {
        if (originalManifestHref !== null) existingManifestLink.setAttribute('href', originalManifestHref);
        delete existingManifestLink.dataset.tenantPwa;
      }
      if (existingAppleIconLink) {
        if (originalAppleIconHref !== null) existingAppleIconLink.setAttribute('href', originalAppleIconHref);
        delete existingAppleIconLink.dataset.tenantPwa;
      }
      titleMeta?.remove();
      if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    };
  }, [appId, businessLogo, businessName, enabled, startUrl, tenantId]);
}

function BusinessIdentity({ businessName, businessLogo }: Pick<PWAInstallBannerProps, 'businessName' | 'businessLogo'>) {
  const name = safeBusinessName(businessName);

  return businessLogo ? (
    <img
      src={businessLogo}
      alt={`${name} business logo`}
      className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1.5 shadow-lg"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      aria-label={`${name} business logo`}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-white shadow-lg"
    >
      {businessInitials(name)}
    </div>
  );
}

export default function PWAInstallBanner(props: PWAInstallBannerProps) {
  const {
    tenantId,
    businessName,
    businessLogo,
    enabled = true,
    automaticPrompt = true,
  } = props;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | null>(null);
  const [iosStep, setIosStep] = useState<'initial' | 'steps'>('initial');
  const [manualUnavailable, setManualUnavailable] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = useMemo(() => safeBusinessName(businessName), [businessName]);
  const host = typeof window === 'undefined' ? '' : window.location.host;
  const isDevelopmentPreview = Boolean((import.meta as any).env?.DEV) &&
    new URLSearchParams(window.location.search).get('pwa-preview') === '1';

  usePersonalizedManifest(props);

  useEffect(() => {
    if (!enabled || !automaticPrompt || !tenantId || isInStandaloneMode()) return undefined;
    // Show the automatic prompt at most once: never again after the user
    // dismissed it, and never once the app is already installed.
    if (hasDismissedInstallPrompt(tenantId) || hasInstalledPwa(tenantId)) return undefined;

    const reveal = (nextPlatform: 'android' | 'ios' | 'desktop') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setPlatform(nextPlatform);
        setShow(true);
      }, 1800);
    };

    const receivePrompt = (event: BeforeInstallPromptEvent) => {
      setDeferredPrompt(event);
      reveal(isAndroid() ? 'android' : 'desktop');
    };

    const unsubscribe = subscribeToInstallPrompt(receivePrompt);
    const unsubscribeInstalled = subscribeToInstalled(() => {
      markPwaInstalled(tenantId);
      setShow(false);
      setDeferredPrompt(null);
    });
    const existingPrompt = getCapturedInstallPrompt();
    if (existingPrompt) receivePrompt(existingPrompt);
    else if (isIOSSafari()) reveal('ios');
    else if (isDevelopmentPreview) reveal('desktop');

    return () => {
      unsubscribe();
      unsubscribeInstalled();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [automaticPrompt, enabled, isDevelopmentPreview, tenantId]);

  // Manual "Install Orvix App" entry point (profile menu / Settings). Stays
  // available regardless of the automatic prompt's dismissal state.
  useEffect(() => {
    if (!tenantId) return undefined;

    const showManualUnavailable = (message: string) => {
      if (manualToastTimerRef.current) clearTimeout(manualToastTimerRef.current);
      setManualUnavailable(message);
      manualToastTimerRef.current = setTimeout(() => setManualUnavailable(null), 4500);
    };

    const unsubscribe = subscribeToManualInstallTrigger(() => {
      if (isInStandaloneMode() || hasInstalledPwa(tenantId)) {
        showManualUnavailable('Orvix is already installed on this device.');
        return;
      }
      const existingPrompt = getCapturedInstallPrompt();
      if (existingPrompt) {
        setDeferredPrompt(existingPrompt);
        setPlatform(isAndroid() ? 'android' : 'desktop');
        setShow(true);
        return;
      }
      if (isIOSSafari()) {
        setIosStep('initial');
        setPlatform('ios');
        setShow(true);
        return;
      }
      showManualUnavailable('Installation is not available in this browser yet. Try Chrome or Edge, or Safari on iPhone/iPad.');
    });

    return () => {
      unsubscribe();
      if (manualToastTimerRef.current) clearTimeout(manualToastTimerRef.current);
    };
  }, [tenantId]);

  const dismiss = () => {
    if (tenantId) markInstallPromptDismissed(tenantId);
    setShow(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    clearCapturedInstallPrompt(deferredPrompt);
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      if (tenantId) markPwaInstalled(tenantId);
      setShow(false);
    } else {
      dismiss();
    }
  };

  if (manualUnavailable) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:left-auto sm:right-5 sm:w-[360px] sm:justify-end sm:px-0 sm:pb-5">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 shadow-2xl">
          <Download className="h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-[12px] font-semibold text-slate-200">{manualUnavailable}</p>
        </div>
      </div>
    );
  }

  if (!show || !enabled) return null;

  if (platform === 'android' || platform === 'desktop') {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:left-auto sm:right-5 sm:w-[390px] sm:px-0 sm:pb-5">
        <div className="pointer-events-auto overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex justify-center pb-1 pt-3 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-slate-700" />
          </div>
          <div className="px-5 pb-5 pt-2 sm:pt-5">
            <div className="mb-4 flex items-center gap-3">
              <BusinessIdentity businessName={name} businessLogo={businessLogo} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-black leading-tight text-white">{name}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">{host}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-400">Install your business app</span>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close install message"
                className="ml-auto shrink-0 cursor-pointer rounded-full border-none bg-transparent p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-none bg-emerald-500 py-4 text-[15px] font-black text-white transition-colors hover:bg-emerald-400 active:bg-emerald-600"
            >
              <Download className="h-5 w-5" />
              <span>{`Install ${shortBusinessName(name)}`}</span>
            </button>
            <p className="mt-2.5 text-center text-[10px] text-slate-500">Adds this business app to your device</p>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'ios') {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
        <div className="pointer-events-auto mx-auto max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex justify-center pb-1 pt-3"><div className="h-1 w-10 rounded-full bg-slate-700" /></div>
          <div className="px-5 pb-5 pt-2">
            {iosStep === 'initial' ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <BusinessIdentity businessName={name} businessLogo={businessLogo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-black leading-tight text-white">{name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Add this business app to Home Screen</p>
                  </div>
                  <button type="button" onClick={dismiss} aria-label="Close install message" className="rounded-full bg-transparent p-2 text-slate-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <button type="button" onClick={() => setIosStep('steps')} className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-indigo-500 py-4 text-[15px] font-black text-white">
                  Show install steps
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="truncate text-[15px] font-black text-white">Install {shortBusinessName(name)}</p>
                  <button type="button" onClick={dismiss} aria-label="Close install message" className="rounded-full bg-transparent p-2 text-slate-500"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  {[
                    { step: '1', icon: <Share className="h-5 w-5 shrink-0 text-blue-400" />, text: 'Tap the Share button' },
                    { step: '2', icon: <Plus className="h-5 w-5 shrink-0 text-emerald-400" />, text: 'Tap Add to Home Screen' },
                    { step: '3', icon: <Download className="h-5 w-5 shrink-0 text-amber-400" />, text: 'Tap Add' },
                  ].map(item => (
                    <div key={item.step} className="flex items-center gap-3 rounded-2xl bg-slate-800 p-3.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-black text-slate-300">{item.step}</div>
                      <p className="flex-1 text-[13px] font-bold text-white">{item.text}</p>
                      {item.icon}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
