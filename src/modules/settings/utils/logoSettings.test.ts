import { describe, expect, it } from 'vitest';
import { withUploadedBusinessLogo } from './logoSettings';
import type { BusinessSettings } from '../../../types';

const previous = {
  businessName: 'A business',
  businessLogo: 'https://example.com/old-generic.png',
  businessLogoLight: 'https://example.com/old-light.png',
  businessLogoDark: 'https://example.com/old-dark.png',
  businessAddress: 'Original address',
  paymentModes: ['Cash'],
} as unknown as BusinessSettings;

describe('business logo settings: preserve existing unrelated settings', () => {
  it('updates both the light logo and generic document fallback without changing dark logo', () => {
    const next = withUploadedBusinessLogo(previous, 'light', 'https://example.com/new-light.png');
    expect(next.businessLogoLight).toBe('https://example.com/new-light.png');
    expect(next.businessLogo).toBe('https://example.com/new-light.png');
    expect(next.businessLogoDark).toBe(previous.businessLogoDark);
    expect(next.businessAddress).toBe(previous.businessAddress);
    expect(next.paymentModes).toEqual(previous.paymentModes);
    expect(previous.businessLogoLight).toContain('old-light');
  });
  it('updates only the dark logo', () => {
    const next = withUploadedBusinessLogo(previous, 'dark', 'https://example.com/new-dark.png');
    expect(next.businessLogoDark).toBe('https://example.com/new-dark.png');
    expect(next.businessLogoLight).toBe(previous.businessLogoLight);
    expect(next.businessLogo).toBe(previous.businessLogo);
  });
  it('refuses data URLs so base64 cannot be written as a replacement logo', () => {
    expect(() => withUploadedBusinessLogo(previous, 'light', 'data:image/png;base64,AAAA')).toThrow();
  });
});
