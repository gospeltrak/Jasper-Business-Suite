import { describe, expect, it } from 'vitest';
import { mergeSettingsForSync, stampSettingsForSync } from './settingsSync';

describe('settings field persistence', () => {
  it('preserves fields that are absent from a partial incoming settings form', () => {
    const saved = {
      company: {
        companyName: 'Saved Company',
        phone: '0712345678',
        email: 'owner@example.com',
      },
      business: {
        businessName: 'Saved Business',
        paymentModes: ['Cash'],
      },
      invoiceSettings: {
        tin: 'TIN-123',
      },
      settingsSync: {
        'company.companyName': '2026-07-28T05:00:00.000Z',
        'company.phone': '2026-07-28T05:00:00.000Z',
        'company.email': '2026-07-28T05:00:00.000Z',
        'business.businessName': '2026-07-28T05:00:00.000Z',
        'business.paymentModes': '2026-07-28T05:00:00.000Z',
        'invoiceSettings.tin': '2026-07-28T05:00:00.000Z',
      },
    } as any;
    const partial = stampSettingsForSync({
      ...saved,
      company: {
        ...saved.company,
        companyName: 'Tenant Changed Company',
      },
    }, saved, '2026-07-28T06:00:00.000Z');

    const merged = mergeSettingsForSync(partial, saved);
    expect(merged.company.companyName).toBe('Tenant Changed Company');
    expect(merged.company.phone).toBe('0712345678');
    expect(merged.company.email).toBe('owner@example.com');
    expect(merged.invoiceSettings?.tin).toBe('TIN-123');
  });

  it('rejects a stale settings snapshot after a newer tenant save', () => {
    const newer = {
      company: { companyName: 'New Saved Name' },
      settingsSync: {
        'company.companyName': '2026-07-28T06:00:00.000Z',
      },
    } as any;
    const stale = {
      company: { companyName: 'Old Name' },
      settingsSync: {
        'company.companyName': '2026-07-28T05:00:00.000Z',
      },
    } as any;

    expect(mergeSettingsForSync(stale, newer).company.companyName).toBe('New Saved Name');
  });
});
