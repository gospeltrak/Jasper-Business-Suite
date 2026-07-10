import { useEffect, useState, type CSSProperties } from 'react';

interface JasperSplashScreenProps {
  logoSrc?: string;
  duration?: number;
  onFinish?: () => void;
}

export default function JasperSplashScreen({
  logoSrc = '/jb-logo.png',
  duration = 2800,
  onFinish,
}: JasperSplashScreenProps) {
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  // 0 = mount  1 = logo in  2 = hold  3 = exit

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';

    const t1 = setTimeout(() => setStage(1), 60);    // start logo entrance
    const t2 = setTimeout(() => setStage(2), 700);   // hold / glow phase
    const t3 = setTimeout(() => setStage(3), duration - 500); // exit
    const t4 = setTimeout(() => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      onFinish?.();
    }, duration);

    return () => {
      [t1,t2,t3,t4].forEach(clearTimeout);
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, [duration, onFinish]);

  return (
    <>
      <style>{`
        @keyframes js-particle-float {
          0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 0.6; }
          100% { transform: translateY(-120px) translateX(var(--tx,20px)) scale(0.4); opacity: 0; }
        }
        @keyframes js-ring-expand {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes js-shimmer {
          0%   { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(300%) rotate(25deg); }
        }
        @keyframes js-glow-pulse {
          0%,100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.75; transform: scale(1.12); }
        }
        @keyframes js-word-rise {
          0%   { opacity: 0; transform: translateY(18px); letter-spacing: 0.35em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.45em; }
        }
        @keyframes js-bar-fill {
          0%   { width: 0%; }
          100% { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* ── ROOT OVERLAY ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          width: '100%', height: '100dvh',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          // Deep midnight premium bg
          background: 'radial-gradient(ellipse at 50% 40%, #0d1f2d 0%, #06111a 60%, #020b12 100%)',
          opacity: stage === 3 ? 0 : 1,
          transition: stage === 3 ? 'opacity 0.55s cubic-bezier(0.4,0,1,1)' : 'none',
        }}
      >

        {/* ── AMBIENT GLOW BENEATH LOGO ── */}
        <div style={{
          position: 'absolute',
          width: 'clamp(240px,55vw,380px)',
          height: 'clamp(240px,55vw,380px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.08) 50%, transparent 75%)',
          animation: stage >= 2 ? 'js-glow-pulse 2.6s ease-in-out infinite' : 'none',
          opacity: stage >= 1 ? 1 : 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
        }} />

        {/* ── RING 1 ── */}
        {stage >= 2 && (
          <div style={{
            position: 'absolute',
            width: 'clamp(180px,42vw,280px)',
            height: 'clamp(180px,42vw,280px)',
            borderRadius: '50%',
            border: '1.5px solid rgba(52,211,153,0.25)',
            animation: 'js-ring-expand 2.0s ease-out 0.1s infinite',
            pointerEvents: 'none',
          }} />
        )}
        {/* ── RING 2 ── */}
        {stage >= 2 && (
          <div style={{
            position: 'absolute',
            width: 'clamp(180px,42vw,280px)',
            height: 'clamp(180px,42vw,280px)',
            borderRadius: '50%',
            border: '1px solid rgba(52,211,153,0.15)',
            animation: 'js-ring-expand 2.0s ease-out 0.7s infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* ── FLOATING PARTICLES ── */}
        {stage >= 2 && [
          { x: '-30px', size: 4, delay: '0s',   dur: '2.4s', left: '44%', top: '42%' },
          { x:  '40px', size: 3, delay: '0.4s', dur: '2.8s', left: '54%', top: '38%' },
          { x: '-20px', size: 5, delay: '0.8s', dur: '2.2s', left: '48%', top: '48%' },
          { x:  '25px', size: 3, delay: '1.1s', dur: '3.0s', left: '52%', top: '44%' },
          { x: '-35px', size: 4, delay: '1.5s', dur: '2.5s', left: '46%', top: '40%' },
          { x:  '15px', size: 2, delay: '0.2s', dur: '2.7s', left: '56%', top: '46%' },
        ].map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: p.left, top: p.top,
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: 'rgba(52,211,153,0.9)',
            boxShadow: '0 0 6px rgba(52,211,153,0.8)',
            '--tx': p.x,
            animationName: 'js-particle-float',
            animationDuration: p.dur,
            animationDelay: p.delay,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-out',
          } as CSSProperties} />
        ))}

        {/* ── LOGO CONTAINER ── */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '24px',
          transform: stage === 0 ? 'scale(0.78) translateY(20px)'
            : stage === 3 ? 'scale(1.04) translateY(-8px)'
            : 'scale(1) translateY(0)',
          opacity: stage === 0 ? 0 : stage === 3 ? 0 : 1,
          transition: stage === 1
            ? 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.42s ease-out'
            : stage === 3
            ? 'transform 0.5s ease-in, opacity 0.48s ease-in'
            : 'none',
        }}>

          {/* Logo with shimmer layer */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={logoSrc}
              alt="Ndiva Suite"
              draggable={false}
              style={{
                width: 'clamp(110px,28vw,160px)',
                height: 'clamp(110px,28vw,160px)',
                objectFit: 'contain',
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 0 28px rgba(52,211,153,0.30)) drop-shadow(0 0 8px rgba(255,255,255,0.12))',
              }}
            />
            {/* Light sweep */}
            {stage >= 2 && (
              <div style={{
                position: 'absolute',
                inset: '-30px',
                background: 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.14) 45%, rgba(255,255,255,0.06) 52%, transparent 70%)',
                animation: 'js-shimmer 2.2s ease-in-out 0.3s 1',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 3,
              }} />
            )}
          </div>

          {/* Wordmark */}
          <div style={{
            opacity: stage >= 2 ? 1 : 0,
            transition: 'opacity 0.5s ease 0.2s',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 'clamp(11px,2.5vw,13px)',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.38)',
              letterSpacing: '0.45em',
              textTransform: 'uppercase',
              animation: stage >= 2 ? 'js-word-rise 0.7s cubic-bezier(0.22,1,0.36,1) forwards' : 'none',
              margin: 0,
            }}>
              Business Suite
            </p>
          </div>
        </div>

        {/* ── LOADING BAR ── */}
        <div style={{
          position: 'absolute',
          bottom: 'max(env(safe-area-inset-bottom), 48px)',
          left: '50%', transform: 'translateX(-50%)',
          width: 'clamp(100px, 30vw, 160px)',
          opacity: stage >= 1 ? 1 : 0,
          transition: 'opacity 0.4s ease 0.5s',
        }}>
          <div style={{
            height: '2px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #34d399, #5eead4)',
              borderRadius: '2px',
              width: stage >= 2 ? '100%' : '0%',
              transition: stage >= 2 ? `width ${duration - 900}ms cubic-bezier(0.4,0,0.6,1)` : 'none',
              boxShadow: '0 0 8px rgba(52,211,153,0.6)',
            }} />
          </div>
        </div>

      </div>
    </>
  );
}
