import { useEffect, useRef, useState } from 'react';

interface JasperSplashScreenProps {
  logoSrc?: string;
  duration?: number;
  onFinish?: () => void;
  showTagline?: boolean;
}

export default function JasperSplashScreen({
  logoSrc,
  duration = 1200,
  onFinish,
  showTagline = false,
}: JasperSplashScreenProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const enterTimer = window.setTimeout(() => setVisible(true), 40);
    const exitTimer = window.setTimeout(() => setLeaving(true), Math.max(500, duration - 420));
    const finishTimer = window.setTimeout(() => {
      document.body.style.overflow = previousOverflow;
      finishRef.current?.();
    }, duration);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={logoSrc ? 'Loading your business workspace' : 'Loading Orvix'}
      className={`fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-white px-6 transition-all duration-500 ${
        leaving ? 'pointer-events-none scale-[1.015] opacity-0' : 'opacity-100'
      }`}
    >
      <style>{`
        @keyframes jasper-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .jasper-skeleton-block {
          background-color: #eef1f5;
          background-image: linear-gradient(90deg, #eef1f5 0px, #f8fafc 40px, #eef1f5 80px);
          background-size: 600px 100%;
          animation: jasper-shimmer 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .jasper-skeleton-block { animation: none; }
        }
        @keyframes jasper-reveal {
          0% { opacity: 0; transform: translateY(18px) scale(.96); filter: blur(8px); letter-spacing: -.05em; }
          58% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: -.035em; }
        }
        @keyframes jasper-logo-reveal {
          0% { opacity: 0; transform: translateY(14px) scale(.9); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes jasper-line {
          0% { transform: scaleX(0); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jasper-splash-motion { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Dashboard-shaped skeleton, shown only behind the post-login tenant
          reveal (logoSrc set) -- gives a sense of the workspace structure
          loading underneath instead of a blank white screen. */}
      {logoSrc && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col gap-4 p-6 pt-16 sm:p-10 sm:pt-20">
          <div className="flex items-center gap-3">
            <div className="jasper-skeleton-block h-9 w-9 shrink-0 rounded-full" />
            <div className="jasper-skeleton-block h-4 w-32 rounded-md" />
            <div className="jasper-skeleton-block ml-auto h-8 w-8 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="jasper-skeleton-block h-20 rounded-2xl" />
            <div className="jasper-skeleton-block h-20 rounded-2xl" />
            <div className="jasper-skeleton-block hidden h-20 rounded-2xl sm:block" />
          </div>
          <div className="mt-2 space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="jasper-skeleton-block h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="jasper-skeleton-block h-3 w-3/5 rounded" />
                  <div className="jasper-skeleton-block h-3 w-2/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Soft fade so the skeleton reads as background texture instead of
          competing with the logo sitting on top of it. */}
      {logoSrc && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.75) 32%, rgba(255,255,255,0) 58%)' }}
        />
      )}

      <div className={`relative z-10 flex flex-col items-center text-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        {logoSrc ? (
          <img
            src={logoSrc}
            alt="Business logo"
            className="jasper-splash-motion max-h-28 w-auto max-w-[min(70vw,18rem)] object-contain"
            style={{ animation: 'jasper-logo-reveal 700ms cubic-bezier(.22,1,.36,1) both' }}
          />
        ) : (
          <div
            className="jasper-splash-motion bg-gradient-to-br from-emerald-950 via-emerald-600 to-green-400 bg-clip-text text-[clamp(3.25rem,13vw,7rem)] font-black leading-none text-transparent"
            style={{
              animation: 'jasper-reveal 800ms cubic-bezier(.22,1,.36,1) both',
              fontFamily: '"Avenir Next", "Century Gothic", "Trebuchet MS", sans-serif',
            }}
          >
            Orvix
          </div>
        )}

        {!logoSrc && showTagline && (
          <p className="jasper-splash-motion mt-4 text-[10px] font-bold uppercase tracking-[0.34em] text-slate-500 sm:text-xs">
            African Merchant OS
          </p>
        )}

        <div className="mt-8 h-px w-28 overflow-hidden bg-slate-100">
          <div
            className="jasper-splash-motion h-full origin-left bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-300"
            style={{ animation: `jasper-line ${Math.max(850, duration - 350)}ms ease-out both` }}
          />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
