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

  it('never lets a stale settings write remove a newly registered staff member', () => {
    const newer = {
      staffs: [
        { id: 'owner-1', name: 'Owner', role: 'Admin' },
        { id: 'staff-2', name: 'New Staff', role: 'Stock Manager', branchId: 'branch-1' },
      ],
      settingsSync: {
        staffs: '2026-08-21T10:00:00.000Z',
      },
    } as any;
    const stale = {
      staffs: [{ id: 'owner-1', name: 'Owner', role: 'Admin' }],
      settingsSync: {
        staffs: '2026-08-21T09:59:00.000Z',
      },
    } as any;

    const merged = mergeSettingsForSync(stale, newer);
    expect(merged.staffs).toHaveLength(2);
    expect(merged.staffs?.[1]).toMatchObject({
      id: 'staff-2',
      role: 'Stock Manager',
      branchId: 'branch-1',
    });
  });

  it('persists tenant-scoped alerts and expense categories, including an intentional empty list', () => {
    const current = {
      company: { companyName: 'Saved Company' },
      expenseCategories: ['Rent', 'Fuel'],
      notificationModuleSettings: [{
        id: 'tenant-1-wholesale-retail',
        tenantId: 'tenant-1',
        moduleName: 'wholesale-retail',
        receiverName: 'Owner',
        whatsappNumber: '+255712345678',
      }],
    } as any;
    const next = stampSettingsForSync({
      ...current,
      expenseCategories: [],
      notificationModuleSettings: [{
        ...current.notificationModuleSettings[0],
        receiverName: 'Finance Manager',
      }],
    }, current, '2026-07-29T10:00:00.000Z');

    const reloaded = mergeSettingsForSync(next, current);
    expect(reloaded.expenseCategories).toEqual([]);
    expect(reloaded.notificationModuleSettings?.[0]?.receiverName).toBe('Finance Manager');
    expect(reloaded.notificationModuleSettings?.[0]?.tenantId).toBe('tenant-1');
  });
});
