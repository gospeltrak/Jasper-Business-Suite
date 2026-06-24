import { useEffect, useState, useRef } from 'react';

interface JasperSplashScreenProps {
  logoSrc?: string;
  duration?: number; // ms — default 2600
  onFinish?: () => void;
}

/**
 * Premium animated splash screen — appears on main dashboard entry only.
 * Logo PNG is NEVER modified. All effects are separate CSS layers.
 * Adapts to all screen sizes with safe-area support and 100dvh.
 */
export default function JasperSplashScreen({
  logoSrc = '/jasper_logo_transparent.png',
  duration = 2600,
  onFinish,
}: JasperSplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Lock scroll immediately
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';

    const holdAt = 400;           // enter animation completes ~400ms
    const exitAt = duration - 500; // start exit 500ms before end
    const doneAt = duration;

    timerRef.current = [
      setTimeout(() => setPhase('hold'), holdAt),
      setTimeout(() => setPhase('exit'), exitAt),
      setTimeout(() => {
        setVisible(false);
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        onFinish?.();
      }, doneAt),
    ];

    return () => {
      timerRef.current.forEach(clearTimeout);
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, [duration, onFinish]);

  if (!visible) return null;

  const isEnter = phase === 'enter';
  const isExit  = phase === 'exit';

  return (
    <>
      {/* ── Keyframe definitions ── */}
      <style>{`
        @keyframes jasper-sweep {
          0%   { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
          30%  { opacity: 0.7; }
          70%  { opacity: 0.5; }
          100% { transform: translateX(220%) skewX(-20deg); opacity: 0; }
        }
        @keyframes jasper-pulse-glow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.6;  transform: scale(1.08); }
        }
        @keyframes jasper-ring {
          0%   { transform: scale(0.85); opacity: 0; }
          40%  { opacity: 0.18; }
          100% { transform: scale(1.5);  opacity: 0; }
        }
        @keyframes jasper-sparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50%       { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jasper-sweep, .jasper-glow, .jasper-ring, .jasper-sparkle {
            animation: none !important;
          }
        }
      `}</style>

      {/* ── Full-screen overlay ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 9999,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          // Deep navy background — premium dark
          background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 40%, #102d68 100%)',
          // Fade in/out
          opacity: isEnter ? 0 : isExit ? 0 : 1,
          transition: isEnter
            ? 'opacity 0.35s ease-out'
            : isExit
            ? 'opacity 0.5s ease-in'
            : 'none',
          animation: isEnter ? 'none' : 'none',
          // Force opacity after enter
          ...(phase === 'hold' ? { opacity: 1 } : {}),
        }}
      >
        {/* Background radial gradient glow — separate layer, never touches logo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(16,45,104,0.9) 0%, rgba(10,22,40,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Ambient particle dots — decorative only */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `jasper-sparkle ${1.8 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
            }}
            className="jasper-sparkle"
          />
        ))}

        {/* Logo + effects container */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isEnter ? 'scale(0.82)' : isExit ? 'scale(1.04)' : 'scale(1)',
            opacity: isEnter ? 0 : isExit ? 0 : 1,
            transition: isEnter
              ? 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1), opacity 0.36s ease-out'
              : isExit
              ? 'transform 0.48s ease-in, opacity 0.44s ease-in'
              : 'none',
          }}
        >
          {/* Outer glow ring — separate animated layer */}
          <div
            className="jasper-ring"
            style={{
              position: 'absolute',
              width: 'clamp(180px, 40vw, 280px)',
              height: 'clamp(180px, 40vw, 280px)',
              borderRadius: '50%',
              border: '1.5px solid rgba(99,140,255,0.25)',
              animation: phase === 'hold' ? 'jasper-ring 2.2s ease-out 0.1s infinite' : 'none',
              pointerEvents: 'none',
            }}
          />

          {/* Pulse glow blob — separate animated layer, behind logo */}
          <div
            className="jasper-glow"
            style={{
              position: 'absolute',
              width: 'clamp(140px, 32vw, 220px)',
              height: 'clamp(140px, 32vw, 220px)',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,140,255,0.22) 0%, rgba(16,45,104,0.08) 65%, transparent 100%)',
              animation: phase === 'hold' ? 'jasper-pulse-glow 2.4s ease-in-out 0.2s infinite' : 'none',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* ── THE LOGO — completely unmodified PNG ── */}
          <img
            src={logoSrc}
            alt="Jasper"
            draggable={false}
            style={{
              width: 'clamp(140px, 36vw, 220px)',
              height: 'clamp(140px, 36vw, 220px)',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              position: 'relative',
              zIndex: 2,
              userSelect: 'none',
              pointerEvents: 'none',
              // White filter so the logo reads on dark background
              filter: 'brightness(0) invert(1)',
            }}
          />

          {/* Light sweep — separate animated layer ON TOP of logo, logo untouched */}
          <div
            className="jasper-sweep"
            style={{
              position: 'absolute',
              inset: '-20px',
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.06) 55%, transparent 70%)',
              animation: phase === 'hold' ? 'jasper-sweep 2.0s ease-in-out 0.6s 1' : 'none',
              pointerEvents: 'none',
              zIndex: 3,
              borderRadius: '50%',
            }}
          />
        </div>

        {/* Jasper wordmark — separate from logo, appears after logo settles */}
        <div
          style={{
            position: 'absolute',
            bottom: 'max(env(safe-area-inset-bottom), 40px)',
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: isEnter ? 0 : isExit ? 0 : 1,
            transform: isEnter ? 'translateY(12px)' : 'translateY(0)',
            transition: 'opacity 0.4s ease 0.3s, transform 0.4s ease 0.3s',
          }}
        >
          <p style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: 'clamp(10px, 2.5vw, 13px)',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            Business Suite
          </p>
        </div>
      </div>
    </>
  );
}
