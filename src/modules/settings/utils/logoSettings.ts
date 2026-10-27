import type { BusinessSettings } from '../../../types';

/**
 * Canonical business logo edit. The general logo is the light-safe fallback
 * used by reports, receipts and older clients, so updating light also refreshes
 * that fallback. Dark logo uploads must not affect either light logo value.
 */
export function withUploadedBusinessLogo(
  current: BusinessSettings,
  variant: 'light' | 'dark',
  storageUrl: string,
): BusinessSettings {
  if (!/^https:\/\//i.test(storageUrl)) {
    throw new Error('A verified HTTPS Storage URL is required');
  }
  return variant === 'light'
    ? { ...current, businessLogoLight: storageUrl, businessLogo: storageUrl }
    : { ...current, businessLogoDark: storageUrl };
}
