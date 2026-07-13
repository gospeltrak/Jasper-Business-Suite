export const ONLINE_ONLY_WRITE_MESSAGE =
  'Internet is required to save changes. Reconnect before editing products, sales, stock, purchases, settings, or tenant data.';

export class OfflineWriteBlockedError extends Error {
  constructor(context?: string) {
    super(context ? `${ONLINE_ONLY_WRITE_MESSAGE} (${context})` : ONLINE_ONLY_WRITE_MESSAGE);
    this.name = 'OfflineWriteBlockedError';
  }
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export function canWriteBusinessDataOnline(): boolean {
  return isBrowserOnline();
}

export function requireOnlineBusinessWrite(context?: string): void {
  if (!canWriteBusinessDataOnline()) {
    throw new OfflineWriteBlockedError(context);
  }
}

export function warnOfflineWriteBlocked(context?: string): void {
  console.warn(`[online-only] blocked offline business write${context ? `: ${context}` : ''}`);
}
