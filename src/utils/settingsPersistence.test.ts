import { beforeEach, describe, expect, it, vi } from 'vitest';

let savedWorkspace: any = null;
let explicitlySavedSettings: any = null;

const remoteWorkspace = {
  branches: [],
  branchStocks: [],
  branchStaffAssignments: [],
  products: [{ id: 'product-1', name: 'Product' }],
  sales: [],
  expenses: [],
  settings: {
    company: { companyName: 'Saved Company', phone: '0712345678' },
    business: { businessName: 'Saved Business', paymentModes: ['Cash'] },
    productStore: { categories: ['Saved Category'], units: ['pcs'] },
    settingsSync: {
      'company.companyName': '2026-07-28T05:00:00.000Z',
      'company.phone': '2026-07-28T05:00:00.000Z',
    },
  },
  deliveries: [],
  pendingDeliveryNotes: [],
  purchases: [],
  productTombstones: {},
  saleTombstones: {},
};

vi.mock('./onlineOnly', () => ({
  canWriteBusinessDataOnline: () => true,
  isBrowserOnline: () => true,
  warnOfflineWriteBlocked: () => {},
}));

vi.mock('../secureDataBridge', () => ({
  getSecureDataBridgeClient: vi.fn(async () => ({
    supabaseUrl: 'https://fake-project.supabase.co',
    rpc: vi.fn(async (name: string, args?: any) => {
      if (name === 'get_current_branch_workspace') {
        return { data: { payload: remoteWorkspace }, error: null };
      }
      if (name === 'save_current_branch_workspace') {
        savedWorkspace = args?.p_workspace;
        return { data: { payload: savedWorkspace }, error: null };
      }
      if (name === 'save_current_tenant_settings') {
        explicitlySavedSettings = args?.p_settings;
        return { data: { settings: explicitlySavedSettings }, error: null };
      }
      return { data: null, error: null };
    }),
  })),
  isPlaceholderSecureDataBridgeClient: () => false,
}));

import { saveTenantSettings, saveTenantWorkspace } from './tenantWorkspace';

describe('authoritative tenant settings persistence', () => {
  beforeEach(() => {
    savedWorkspace = null;
    explicitlySavedSettings = null;
  });

  it('keeps cloud settings unchanged during an ordinary workspace save', async () => {
    const staleWorkspace = {
      ...remoteWorkspace,
      products: [{ id: 'product-1', name: 'Updated Product' }],
      settings: {
        company: { companyName: 'Default Company', phone: '' },
        business: { businessName: '', paymentModes: [] },
        productStore: { categories: [], units: [] },
      },
    } as any;

    expect(await saveTenantWorkspace('tenant-settings-guard', staleWorkspace)).toBe(true);
    expect(savedWorkspace.settings).toEqual(remoteWorkspace.settings);
    expect(savedWorkspace.products[0].name).toBe('Updated Product');
  });

  it('writes settings only through the explicit settings RPC', async () => {
    const nextSettings = {
      ...remoteWorkspace.settings,
      company: {
        ...remoteWorkspace.settings.company,
        companyName: 'Tenant Changed Company',
      },
    } as any;

    expect(await saveTenantSettings('tenant-explicit-settings', nextSettings)).toBe(true);
    expect(explicitlySavedSettings.company.companyName).toBe('Tenant Changed Company');
    expect(explicitlySavedSettings.company.phone).toBe('0712345678');
  });
});
