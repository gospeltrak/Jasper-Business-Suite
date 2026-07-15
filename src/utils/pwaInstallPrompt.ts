export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallPromptListener = (event: BeforeInstallPromptEvent) => void;

let capturedPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<InstallPromptListener>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    capturedPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach(listener => listener(capturedPrompt as BeforeInstallPromptEvent));
  });
}

export const getCapturedInstallPrompt = () => capturedPrompt;

export const subscribeToInstallPrompt = (listener: InstallPromptListener) => {
  listeners.add(listener);
  if (capturedPrompt) listener(capturedPrompt);
  return () => listeners.delete(listener);
};

export const clearCapturedInstallPrompt = (event?: BeforeInstallPromptEvent | null) => {
  if (!event || capturedPrompt === event) capturedPrompt = null;
};
