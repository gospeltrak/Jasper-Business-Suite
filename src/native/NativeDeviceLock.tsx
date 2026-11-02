import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LockKeyhole, ShieldCheck, LogOut } from 'lucide-react';

interface DeviceCredentialPlugin {
  authenticate(): Promise<{ verified: boolean }>;
}
const DeviceCredential = registerPlugin<DeviceCredentialPlugin>('OrvixDeviceCredential');
const BACKGROUND_LOCK_MS = 30_000;

type Props = {
  identity: string;
  splashVisible: boolean;
  children: ReactNode;
  onSignOut: () => void | Promise<void>;
};

/**
 * UI gate only: the actual PIN challenge runs through Android's
 * KeyguardManager, never through a JavaScript form or an Orvix PIN database.
 * The wrapped dashboard stays mounted but visually hidden while locked, so
 * an unfinished sale does not disappear when the screen is switched off.
 */
export default function NativeDeviceLock({ identity, splashVisible, children, onSignOut }: Props) {
  const nativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const [unlocked, setUnlocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inFlightRef = useRef(false);
  const lastBackgroundAt = useRef<number | null>(null);
  const requestRef = useRef(0);
  const autoPromptedForIdentityRef = useRef('');

  useEffect(() => {
    requestRef.current += 1;
    autoPromptedForIdentityRef.current = '';
    setUnlocked(false);
    setError('');
    setVerifying(false);
    inFlightRef.current = false;
  }, [identity]);

  useEffect(() => {
    if (!nativeAndroid) return;
    const onVisibility = () => {
      // The native Keyguard prompt temporarily backgrounds the WebView.
      // This is NOT the user leaving Orvix: never re-lock during validation.
      if (inFlightRef.current) {
        lastBackgroundAt.current = null;
        return;
      }
      if (document.visibilityState === 'hidden') {
        lastBackgroundAt.current = performance.now();
      } else {
        const since = lastBackgroundAt.current;
        lastBackgroundAt.current = null;
        if (since !== null && performance.now() - since >= BACKGROUND_LOCK_MS) {
          // Keep the cart/form mounted, but cover all confidential content.
          autoPromptedForIdentityRef.current = '';
          setUnlocked(false);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [nativeAndroid]);

  const unlock = useCallback(async () => {
    if (inFlightRef.current || !nativeAndroid) return;
    inFlightRef.current = true;
    lastBackgroundAt.current = null;
    const request = ++requestRef.current;
    setVerifying(true);
    setError('');
    try {
      const result = await DeviceCredential.authenticate();
      if (request !== requestRef.current) return;
      if (result.verified) {
        setUnlocked(true);
      } else {
        setError('Uthibitisho haujakamilika. Jaribu tena.');
      }
    } catch (cause: any) {
      if (request !== requestRef.current) return;
      const needsPin = String(cause?.message || '').includes('PHONE_SCREEN_LOCK_NOT_CONFIGURED');
      setError(needsPin
        ? 'Weka PIN, mchoro au nenosiri kwenye mipangilio ya usalama ya simu, kisha urudi Orvix.'
        : 'Android imeshindwa kuthibitisha screen lock. Jaribu tena au ingia upya.');
    } finally {
      if (request === requestRef.current) {
        inFlightRef.current = false;
        setVerifying(false);
      }
    }
  }, [nativeAndroid]);

  // Prompt once automatically after the branded login reveal has finished.
  // Cancelled challenges require a deliberate tap, not an endless PIN loop.
  useEffect(() => {
    if (!nativeAndroid || splashVisible || unlocked || verifying) return;
    if (autoPromptedForIdentityRef.current === identity) return;
    autoPromptedForIdentityRef.current = identity;
    void unlock();
  }, [nativeAndroid, splashVisible, unlocked, verifying, identity, unlock]);

  if (!nativeAndroid) return <>{children}</>;
  return (
    <>
      <div inert={!unlocked} style={{ display: 'contents', visibility: unlocked ? 'visible' : 'hidden', pointerEvents: unlocked ? 'auto' : 'none' }} aria-hidden={!unlocked}>
        {children}
      </div>
      {!unlocked && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-white px-6 dark:bg-slate-950">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/50">
              <LockKeyhole className="h-10 w-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Fungua Orvix</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Thibitisha PIN, mchoro au nenosiri la simu yako. Orvix haihifadhi PIN yako.
            </p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{error}</p>}
            <button type="button" disabled={verifying} onClick={() => void unlock()}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-60">
              <ShieldCheck className="h-5 w-5" />
              {verifying ? 'Inathibitisha…' : 'Thibitisha kwa PIN ya simu'}
            </button>
            <button type="button" disabled={verifying} onClick={() => void onSignOut()}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-slate-500">
              <LogOut className="h-4 w-4" /> Toka kwenye akaunti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
