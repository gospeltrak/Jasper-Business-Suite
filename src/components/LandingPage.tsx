import { useCallback, useEffect, useRef } from 'react';

interface LandingPageProps {
  onNavigate: (route: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

const LANDING_DOCUMENT = '/orvix-landing/index.html';

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<() => void>(() => undefined);

  const connectLandingNavigation = useCallback(() => {
    cleanupRef.current();
    const frameDocument = frameRef.current?.contentDocument;
    if (!frameDocument) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>('a');
      if (!link) return;

      const href = link.getAttribute('href') || '';
      const isTrialAction = link.classList.contains('btn') && (
        href === '#trial' || href.startsWith('mailto:info@orvix.africa')
      );

      if (isTrialAction) {
        event.preventDefault();
        onNavigate('/login?register=true');
        return;
      }

      if (href === '#affiliate') {
        event.preventDefault();
        onNavigate('/affiliate');
      }
    };

    frameDocument.addEventListener('click', handleClick);
    cleanupRef.current = () => frameDocument.removeEventListener('click', handleClick);
  }, [onNavigate]);

  useEffect(() => () => cleanupRef.current(), []);

  return (
    <main className="relative min-h-[100dvh] bg-white" aria-label="Orvix website">
      <iframe
        ref={frameRef}
        src={LANDING_DOCUMENT}
        title="Orvix POS and inventory management"
        onLoad={connectLandingNavigation}
        className="block min-h-[100dvh] w-full border-0 bg-white"
        style={{ height: '100dvh' }}
      />
    </main>
  );
}
