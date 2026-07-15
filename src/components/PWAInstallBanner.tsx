import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Share, X } from 'lucide-react';
import {
  BeforeInstallPromptEvent,
  clearCapturedInstallPrompt,
  getCapturedInstallPrompt,
  subscribeToInstallPrompt,
} from '../utils/pwaInstallPrompt';

interface PWAInstallBannerProps {
  tenantId: string;
  businessName: string;
  businessLogo?: string | null;
  enabled?: boolean;
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

function usePersonalizedManifest({ tenantId, businessName, businessLogo, enabled }: PWAInstallBannerProps) {
  useEffect(() => {
    if (!enabled || !tenantId) return undefined;

    const name = safeBusinessName(businessName);
    const encodedTenantId = encodeURIComponent(tenantId);
    const iconSource = businessLogo || createBusinessInitialsIcon(name);
    const icons = [{
      src: iconSource,
      sizes: 'any',
      type: inferImageType(iconSource),
      purpose: 'any maskable',
    }];

    const manifest = {
      id: `/dashboard?tenant=${encodedTenantId}`,
      name,
      short_name: shortBusinessName(name),
      description: `${name} business app`,
      start_url: `/dashboard?tenant=${encodedTenantId}`,
      scope: '/',
      display: 'standalone',
      display_override: ['standalone', 'fullscreen'],
      background_color: '#0f172a',
      theme_color: '#0f172a',
      orientation: 'portrait-primary',
      categories: ['business', 'productivity', 'finance'],
      prefer_related_applications: false,
      icons,
    };

    const manifestUrl = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }),
    );
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestUrl;
    manifestLink.dataset.tenantPwa = tenantId;
    document.head.appendChild(manifestLink);

    const titleMeta = document.createElement('meta');
    titleMeta.name = 'apple-mobile-web-app-title';
    titleMeta.content = name;
    titleMeta.dataset.tenantPwa = tenantId;
    document.head.appendChild(titleMeta);

    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = iconSource;
    appleIcon.dataset.tenantPwa = tenantId;
    document.head.appendChild(appleIcon);

    return () => {
      manifestLink.remove();
      titleMeta.remove();
      appleIcon.remove();
      URL.revokeObjectURL(manifestUrl);
    };
  }, [businessLogo, businessName, enabled, tenantId]);
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
  const { tenantId, businessName, businessLogo, enabled = true } = props;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | null>(null);
  const [iosStep, setIosStep] = useState<'initial' | 'steps'>('initial');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = useMemo(() => safeBusinessName(businessName), [businessName]);
  const host = typeof window === 'undefined' ? '' : window.location.host;
  const isDevelopmentPreview = import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('pwa-preview') === '1';

  usePersonalizedManifest(props);

  useEffect(() => {
    if (!enabled || !tenantId || isInStandaloneMode()) return undefined;

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
    const existingPrompt = getCapturedInstallPrompt();
    if (existingPrompt) receivePrompt(existingPrompt);
    else if (isIOSSafari()) reveal('ios');
    else if (isDevelopmentPreview) reveal('desktop');

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, isDevelopmentPreview, tenantId]);

  const dismiss = () => setShow(false);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    clearCapturedInstallPrompt(deferredPrompt);
    setDeferredPrompt(null);
    if (outcome === 'accepted') setShow(false);
    else dismiss();
  };

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
