import { useEffect, useRef, useState } from 'react';

interface JasperSplashScreenProps {
  logoSrc?: string;
  duration?: number;
  onFinish?: () => void;
  showTagline?: boolean;
}

export default function JasperSplashScreen({
  logoSrc,
  duration = 4000,
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
      className={`fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center bg-white px-6 transition-all duration-500 ${
        leaving ? 'pointer-events-none scale-[1.015] opacity-0' : 'opacity-100'
      }`}
    >
      <style>{`
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

      <div className={`flex flex-col items-center text-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
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
