import { useEffect, useState } from 'react';

interface JasperSplashScreenProps {
  logoSrc?: string;
  duration?: number;
  onFinish?: () => void;
}

export default function JasperSplashScreen({
  logoSrc = '/jasper_logo_transparent.png',
  duration = 2600,
  onFinish,
}: JasperSplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';

    const timer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      onFinish?.();
    }, duration);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, [duration, onFinish]);

  if (!visible) return null;

  return (
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
        background: 'linear-gradient(135deg, #0a0a0a 0%, #0f172a 100%)',
      }}
    >
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
          userSelect: 'none',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.15))',
        }}
      />
    </div>
  );
}
