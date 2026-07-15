import { useState, useEffect, useRef } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';

// ── Detect platform ────────────────────────────────────────────────────────
const isIOS = () => /ipad|iphone|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
const isInStandaloneMode = () =>
  (window.navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches;

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const [iosStep, setIosStep] = useState<'initial' | 'steps'>('initial');
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Already installed — never show
    if (isInStandaloneMode()) return;

    // Already dismissed in this session
    if (sessionStorage.getItem('pwa-install-dismissed')) return;

    // ── Android / Chrome: use beforeinstallprompt ──────────────────────────
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform('android');
      // Show after 3s so it doesn't feel intrusive on first load
      timerRef.current = setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // ── iOS Safari: show manual steps guide ───────────────────────────────
    if (isIOS()) {
      timerRef.current = setTimeout(() => {
        setPlatform('ios');
        setShow(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  if (!show || dismissed) return null;

  // ── Android prompt ────────────────────────────────────────────────────────
  if (platform === 'android') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[200] px-4 pb-6 pt-2 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
          {/* Top handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-700" />
          </div>

          <div className="px-5 pb-5 pt-2">
            {/* App identity row */}
            <div className="flex items-center gap-3 mb-4">
              <img src="/icon-192.png" alt="Jasper" className="w-14 h-14 rounded-2xl shadow-lg shrink-0" />
              <div>
                <p className="text-white font-black text-[15px] leading-tight">Jasper Business Suite</p>
                <p className="text-slate-400 text-[11px] mt-0.5">jasper-business-suite.vercel.app</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-400 font-semibold">Free · No ads · Works offline</span>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="ml-auto p-2 rounded-full hover:bg-slate-800 text-slate-500 border-none bg-transparent cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Install button */}
            <button
              onClick={handleAndroidInstall}
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-black rounded-2xl py-4 text-[15px] cursor-pointer border-none transition-colors"
            >
              <Download className="w-5 h-5" />
              Install App
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-2.5">
              Installs to your home screen · No Play Store needed
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS guide ─────────────────────────────────────────────────────────────
  if (platform === 'ios') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[200] px-4 pb-6 pt-2 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-700" />
          </div>

          <div className="px-5 pb-5 pt-2">
            {iosStep === 'initial' ? (
              <>
                {/* App identity */}
                <div className="flex items-center gap-3 mb-4">
                  <img src="/icon-192.png" alt="Jasper" className="w-14 h-14 rounded-2xl shadow-lg shrink-0" />
                  <div>
                    <p className="text-white font-black text-[15px] leading-tight">Install App</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Add Jasper to your home screen</p>
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold">Full screen · No browser bars</p>
                  </div>
                  <button
                    onClick={dismiss}
                    className="ml-auto p-2 rounded-full hover:bg-slate-800 text-slate-500 border-none bg-transparent cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setIosStep('steps')}
                  className="w-full flex items-center justify-center gap-2.5 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white font-black rounded-2xl py-4 text-[15px] cursor-pointer border-none transition-colors"
                >
                  Show me how
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-black text-[15px]">Install App</p>
                  <button
                    onClick={dismiss}
                    className="p-2 rounded-full hover:bg-slate-800 text-slate-500 border-none bg-transparent cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      step: '1',
                      icon: <Share className="w-5 h-5 text-blue-400 shrink-0" />,
                      text: 'Tap the',
                      highlight: 'Share button',
                      sub: 'at the bottom of Safari',
                      after: '',
                    },
                    {
                      step: '2',
                      icon: <Plus className="w-5 h-5 text-emerald-400 shrink-0" />,
                      text: 'Scroll down and tap',
                      highlight: '"Add to Home Screen"',
                      sub: '',
                      after: '',
                    },
                    {
                      step: '3',
                      icon: <Download className="w-5 h-5 text-amber-400 shrink-0" />,
                      text: 'Tap',
                      highlight: '"Add"',
                      sub: 'in the top-right corner',
                      after: '',
                    },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3 bg-slate-800 rounded-2xl p-3.5">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[11px] font-black text-slate-300">{s.step}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-slate-200">
                          {s.text}{' '}
                          <span className="font-black text-white">{s.highlight}</span>
                          {s.after}
                        </p>
                        {s.sub && <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>}
                      </div>
                      {s.icon}
                    </div>
                  ))}
                </div>

                <p className="text-center text-[10px] text-slate-500 mt-3">
                  Opens as a full-screen app — no browser bars
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
