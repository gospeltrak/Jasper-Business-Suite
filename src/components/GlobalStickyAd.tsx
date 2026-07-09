import { useEffect, useState } from 'react';
import { canShowStickyBottomAd, useGlobalAdSettings } from '../utils/adPlacement';
import { sanitizeTrustedHtml } from '../utils/safeHtml';

const STICKY_AD_RETURN_DELAY_MS = 45000;

type GlobalStickyAdProps = {
  bottomOffsetClass?: string;
  leftOffsetClass?: string;
  maxWidthClass?: string;
  className?: string;
};

export default function GlobalStickyAd({
  bottomOffsetClass = 'bottom-[calc(0.75rem+env(safe-area-inset-bottom)+var(--browser-bottom-inset,0px))] xl:bottom-4',
  leftOffsetClass = 'left-3 xl:left-1/2 xl:-translate-x-1/2',
  maxWidthClass = 'max-w-[640px]',
  className = '',
}: GlobalStickyAdProps) {
  const adSettings = useGlobalAdSettings();
  const [hiddenUntil, setHiddenUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!hiddenUntil) return;
    const delay = Math.max(0, hiddenUntil - Date.now());
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [hiddenUntil]);

  const bottomAdCode = adSettings.bottomAdCode?.trim();
  if (!canShowStickyBottomAd(adSettings) || hiddenUntil > now) return null;

  return (
    <div
      className={`jasper-global-sticky-ad fixed ${bottomOffsetClass} ${leftOffsetClass} right-3 z-[45] pointer-events-none ${className}`}
      style={{ animation: 'jasperStickyAdUp 0.35s ease-out' }}
    >
      <style>{`
        @keyframes jasperStickyAdUp {
          from { transform: translateY(28px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .jasper-sticky-ad-slot,
        .jasper-sticky-ad-slot > * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .jasper-sticky-ad-slot img,
        .jasper-sticky-ad-slot iframe,
        .jasper-sticky-ad-slot video,
        .jasper-sticky-ad-slot ins {
          max-width: 100% !important;
          height: auto !important;
        }
      `}</style>
      <div className={`relative mx-auto w-full ${maxWidthClass} pointer-events-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.24)] backdrop-blur`}>
        <button
          type="button"
          onClick={() => {
            setHiddenUntil(Date.now() + STICKY_AD_RETURN_DELAY_MS);
            setNow(Date.now());
          }}
          className="absolute -right-2 -top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-xs font-black text-slate-500 shadow hover:text-slate-900"
          title="Close ad"
          aria-label="Close ad"
        >
          ×
        </button>
        <div
          className="jasper-sticky-ad-slot max-h-[104px] overflow-hidden rounded-xl"
          dangerouslySetInnerHTML={{ __html: sanitizeTrustedHtml(bottomAdCode) }}
        />
      </div>
    </div>
  );
}
