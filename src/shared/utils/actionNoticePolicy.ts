/**
 * Business-facing notice policy. Never infer loss of data from a failed
 * request; never claim offline based on one slow request or transient 5xx.
 * Backend role authorization always remains authoritative.
 */
export type NoticeLanguage = 'sw' | 'en';
export const permissionNotice = (language: NoticeLanguage) =>
  language === 'sw'
    ? 'Huna idhini ya kufanya kitendo hiki.'
    : 'You do not have permission to perform this action.';

export const offlineNotice = (language: NoticeLanguage) =>
  language === 'sw'
    ? 'Hakuna muunganisho wa intaneti. Taarifa zilizokwisha hifadhiwa hazijafutwa; mabadiliko mapya yanahitaji intaneti.'
    : 'No internet connection. Previously saved data has not been deleted; reconnect to save new changes.';

/** Connection transitions are often short during Wi-Fi/cellular handoff. */
export const OFFLINE_CONFIRMATION_MS = 8_000;

export function isAuthorizationDenial(raw: unknown): boolean {
  const data = raw as { code?: unknown; status?: unknown; message?: unknown } | null;
  if (data && typeof data === 'object') {
    if (data.status === 403 || data.code === '42501' || data.code === 'PERMISSION_ERROR') return true;
  }
  const text = String(typeof raw === 'string' ? raw : data?.message || '').toLowerCase();
  return /\bpermission denied\b|\bnot authorized\b|\baccess denied\b|\byou do not have permission\b|\bno permission\b|\binsufficient privileges\b|\bforbidden\b|\bhuna ruhusa\b|\bhuna idhini\b|\bhauna ruhusa\b/.test(text);
}

/** Only classify connectivity wording, never stock/validation/payment errors. */
export function isConnectivityNotice(raw: unknown): boolean {
  const message = String(raw || '').toLowerCase();
  return /internet connection|no internet|network (?:connection|unavailable|error|request failed)|failed to fetch|networkerror|mtandao haupatikani|intaneti haipatikani|muunganisho wa (?:mtandao|intaneti)|connection (?:lost|restored|failed)|please check your connection|check your internet|reconnect before/.test(message);
}

export function normalizeActionNotice(
  raw: string,
  language: NoticeLanguage,
  confirmedOffline: boolean,
): string | null {
  if (isAuthorizationDenial(raw)) return permissionNotice(language);
  if (isConnectivityNotice(raw)) return confirmedOffline ? offlineNotice(language) : null;
  return raw;
}

/**
 * True offline requires BOTH a continuous browser offline flag for a grace
 * interval and failure to reach the same-origin server. ANY HTTP response
 * proves some connectivity: don't mistake an API 401/500 for no internet.
 * Recheck the current navigator flag after the probe before notifying.
 */
export async function confirmConnectivityLoss(
  isBrowserOffline: () => boolean,
  probe: () => Promise<boolean>,
): Promise<boolean> {
  if (!isBrowserOffline()) return false;
  try {
    if (await probe()) return false;
  } catch {
    // A failed probe alone is not enough; only paired with navigator.offline.
  }
  return isBrowserOffline();
}
