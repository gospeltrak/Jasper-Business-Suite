import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// Explicit rendering prevents Cloudflare's implicit .cf-turnstile auto-scan
// from trying to render the same React widget twice.
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile?.render) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.scripts).find(
      script => script.src.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js'),
    );
    const script = existing || document.createElement('script');
    let done = false;
    const complete = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onLoad = () => window.turnstile?.render
      ? complete()
      : complete(new Error('Cloudflare verification API is unavailable'));
    const onError = () => complete(new Error('Cannot load Cloudflare verification'));
    const timeout = window.setTimeout(
      () => complete(new Error('Cloudflare verification timed out')), 15000,
    );

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    // A pre-existing script may have completed before this component mounted.
    if (window.turnstile?.render) complete();
  }).catch(error => {
    // An unstable network or temporarily blocked iframe must be retryable.
    scriptLoadPromise = null;
    document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)?.remove();
    throw error;
  });
  return scriptLoadPromise;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (code?: string) => void;
  /** Increment after the server has consumed a single-use token. */
  resetKey?: number;
}

type WidgetState = 'loading' | 'ready' | 'verified' | 'expired' | 'error';

function failureMessage(code?: string) {
  if (code === '110200') return 'Cloudflare haijaidhinisha anwani ya tovuti hii. Wasiliana na msaada wa Orvix.';
  if (code === '110100' || code === '110110') return 'Mipangilio ya Cloudflare inahitaji kurekebishwa na Orvix.';
  return 'Uthibitishaji wa Cloudflare umekwama. Bonyeza Jaribu tena.';
}

export default function TurnstileWidget({ onVerify, onExpire, onError, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<WidgetState>('loading');
  const [message, setMessage] = useState('');
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY;
  const retry = () => {
    onExpireRef.current?.();
    setAttempt(value => value + 1);
  };

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    setStatus('loading');
    setMessage('');

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          appearance: 'always',
          theme: 'auto',
          size: 'flexible',
          callback: (token: string) => {
            if (cancelled) return;
            setStatus('verified');
            setMessage('');
            onVerifyRef.current(token);
          },
          'expired-callback': () => {
            if (cancelled) return;
            setStatus('expired');
            setMessage('Uthibitishaji umeisha muda wake. Bonyeza Jaribu tena.');
            onExpireRef.current?.();
          },
          'timeout-callback': () => {
            if (cancelled) return;
            setStatus('expired');
            setMessage('Uthibitishaji umechukua muda mrefu. Bonyeza Jaribu tena.');
            onExpireRef.current?.();
          },
          'error-callback': (code?: string) => {
            if (cancelled) return true;
            setStatus('error');
            setMessage(failureMessage(code));
            onExpireRef.current?.();
            onErrorRef.current?.(code);
            return true;
          },
        });
        setStatus('ready');
      } catch {
        setStatus('error');
        setMessage('Cloudflare haikuweza kuanzishwa. Bonyeza Jaribu tena.');
        onExpireRef.current?.();
        onErrorRef.current?.('render');
      }
    }).catch(() => {
      if (cancelled) return;
      setStatus('error');
      setMessage('Imeshindikana kupakia Cloudflare. Kagua intaneti kisha bonyeza Jaribu tena.');
      onExpireRef.current?.();
      onErrorRef.current?.('load');
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* Already unmounted */ }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, resetKey, attempt]);

  if (!siteKey) {
    return <p role="alert" className="text-xs text-rose-500">Cloudflare haijasanidiwa kwa tovuti hii. Tafadhali wasiliana na msaada wa Orvix.</p>;
  }

  return (
    <div className="w-full min-w-0 space-y-2" data-testid="turnstile-widget">
      <div ref={containerRef} className="flex justify-center min-h-[48px] max-w-full" aria-label="Cloudflare security verification" />
      {status === 'loading' && <p className="text-[11px] text-slate-400 text-center" role="status">Inapakia uthibitishaji wa Cloudflare…</p>}
      {status === 'verified' && <p className="text-[11px] text-emerald-500 text-center" role="status">Uthibitishaji umekamilika.</p>}
      {(status === 'error' || status === 'expired') && (
        <div className="flex flex-col items-center gap-2">
          <p role="alert" className="text-[11px] text-amber-500 text-center">{message}</p>
          <button type="button" onClick={retry} className="rounded-lg border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-500">
            Jaribu tena
          </button>
        </div>
      )}
    </div>
  );
}
