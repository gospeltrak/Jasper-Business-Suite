export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallPromptListener = (event: BeforeInstallPromptEvent) => void;
type InstalledListener = () => void;

let capturedPrompt: BeforeInstallPromptEvent | null = null;
let pwaInstalledThisSession = false;
const listeners = new Set<InstallPromptListener>();
const installedListeners = new Set<InstalledListener>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    capturedPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach(listener => listener(capturedPrompt as BeforeInstallPromptEvent));
  });

  // Authoritative "installed" signal where supported (Chrome/Edge/Android).
  // Not relied on alone — see hasInstalledPwa, which also checks the
  // persisted per-tenant flag set here and in PWAInstallBanner's accepted
  // outcome, since some browsers never fire this event at all.
  window.addEventListener('appinstalled', () => {
    pwaInstalledThisSession = true;
    capturedPrompt = null;
    installedListeners.forEach(listener => listener());
  });
}

export const getCapturedInstallPrompt = () => capturedPrompt;

export const subscribeToInstallPrompt = (listener: InstallPromptListener) => {
  listeners.add(listener);
  if (capturedPrompt) listener(capturedPrompt);
  return () => listeners.delete(listener);
};

export const subscribeToInstalled = (listener: InstalledListener) => {
  installedListeners.add(listener);
  return () => installedListeners.delete(listener);
};

export const clearCapturedInstallPrompt = (event?: BeforeInstallPromptEvent | null) => {
  if (!event || capturedPrompt === event) capturedPrompt = null;
};

// ---------------------------------------------------------------------------
// Persisted, per-tenant install-prompt state.
//
// Orvix installs are white-labeled per tenant (each business gets its own
// name/logo/start_url — see PWAInstallBanner's usePersonalizedManifest), so
// "the user dismissed the install prompt" is scoped per tenant rather than
// one global flag: a device shared across two different businesses (e.g. a
// multi-branch admin signing into two tenants on the same browser) should be
// offered each business's own install card independently.
// ---------------------------------------------------------------------------

const DISMISSED_KEY_PREFIX = 'orvix_pwa_install_prompt_dismissed_';
const INSTALLED_KEY_PREFIX = 'orvix_pwa_installed_';

const tenantKey = (prefix: string, tenantId: string) => `${prefix}${tenantId || 'default'}`;

const readFlag = (key: string): boolean => {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    // Private-browsing / storage-disabled — fail safe to "not dismissed",
    // matching prior (always-show) behavior rather than throwing.
    return false;
  }
};

const writeFlag = (key: string): void => {
  try {
    window.localStorage.setItem(key, 'true');
  } catch {
    // Storage unavailable — the prompt may reappear next visit, which is
    // acceptable degradation rather than a hard failure.
  }
};

export const hasDismissedInstallPrompt = (tenantId: string): boolean =>
  readFlag(tenantKey(DISMISSED_KEY_PREFIX, tenantId));

export const markInstallPromptDismissed = (tenantId: string): void =>
  writeFlag(tenantKey(DISMISSED_KEY_PREFIX, tenantId));

export const hasInstalledPwa = (tenantId: string): boolean =>
  pwaInstalledThisSession || readFlag(tenantKey(INSTALLED_KEY_PREFIX, tenantId));

export const markPwaInstalled = (tenantId: string): void => {
  pwaInstalledThisSession = true;
  writeFlag(tenantKey(INSTALLED_KEY_PREFIX, tenantId));
};

// ---------------------------------------------------------------------------
// Manual install trigger — lets a "Install Orvix App" entry anywhere in the
// app (e.g. the profile menu) ask PWAInstallBanner to show itself on demand,
// bypassing the one-time-dismissal gate. The automatic prompt still only
// ever shows itself once; this manual path is a deliberate, explicit user
// action and stays available regardless of dismissal state.
// ---------------------------------------------------------------------------

type ManualTriggerListener = () => void;
const manualTriggerListeners = new Set<ManualTriggerListener>();

export const subscribeToManualInstallTrigger = (listener: ManualTriggerListener) => {
  manualTriggerListeners.add(listener);
  return () => manualTriggerListeners.delete(listener);
};

export const requestManualInstallPrompt = (): void => {
  manualTriggerListeners.forEach(listener => listener());
};
