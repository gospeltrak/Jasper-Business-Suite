import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '../LanguageContext';

interface LandingPageProps {
  onNavigate: (route: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

const LANDING_DOCUMENT = '/orvix-landing/index.html';

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { lang, setLang } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<() => void>(() => undefined);

  const connectLandingNavigation = useCallback(() => {
    cleanupRef.current();
    const frameDocument = frameRef.current?.contentDocument;
    if (!frameDocument) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const languageOption = target?.closest<HTMLButtonElement>('[data-lang]');
      const selectedLanguage = languageOption?.dataset.lang;
      if (selectedLanguage && ['en', 'sw', 'fr'].includes(selectedLanguage)) {
        setLang(selectedLanguage as 'en' | 'sw' | 'fr');
        return;
      }

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
        return;
      }

      if (href === '#login') {
        event.preventDefault();
        onNavigate('/login');
      }
    };

    frameDocument.addEventListener('click', handleClick);
    cleanupRef.current = () => frameDocument.removeEventListener('click', handleClick);
  }, [onNavigate, setLang]);

  useEffect(() => () => cleanupRef.current(), []);

  useEffect(() => {
    const handleLandingLanguage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type !== 'orvix-language-change') return;
      if (!['en', 'sw', 'fr'].includes(event.data.language)) return;
      setLang(event.data.language);
    };
    window.addEventListener('message', handleLandingLanguage);
    return () => window.removeEventListener('message', handleLandingLanguage);
  }, [setLang]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({
      type: 'orvix-language-sync',
      language: lang,
    }, window.location.origin);
  }, [lang]);

  return (
    <main className="relative min-h-[100dvh] bg-white" aria-label="Orvix website">
      <iframe
        ref={frameRef}
        src={LANDING_DOCUMENT}
        title="Orvix POS and inventory management"
        onLoad={() => {
          connectLandingNavigation();
          frameRef.current?.contentWindow?.postMessage({
            type: 'orvix-language-sync',
            language: lang,
          }, window.location.origin);
        }}
        className="block min-h-[100dvh] w-full border-0 bg-white"
        style={{ height: '100dvh' }}
      />
    </main>
  );
}
