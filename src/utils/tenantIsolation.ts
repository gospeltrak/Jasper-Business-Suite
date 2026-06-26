import { SystemSettings, Tenant } from '../types';

// Demo records are deliberately opt-in. Every other tenant starts and remains empty until its users add data.
const DEMO_TENANT_IDS = new Set([
  't-lagos-01',
  't-nairobi-02',
  't-accra-03',
  't-hotel-01',
  't-restaurant-01',
  't-pharma-01'
]);

export const isDemoTenant = (tenantId: string) => DEMO_TENANT_IDS.has(tenantId);

export const createCleanTenantSettings = (tenant: Tenant): SystemSettings => ({
  company: {
    companyName: tenant.name,
    usernameKey: tenant.id,
    phone: '',
    email: '',
    address: '',
    tin: '',
    vat: '',
    currency: tenant.currency,
    timezone: '',
    logo: '',
    themeMode: 'light'
  },
  business: {
    businessName: tenant.name,
    businessPhone: '',
    businessAddress: '',
    businessLogo: '',
    paymentModes: [],
    registeredStores: []
  },
  productStore: {
    categories: [],
    units: []
  },
  staffs: [],
  customRoles: [],
  invoiceSettings: {}
});

const clearTenantEntry = (storageKey: string, tenantId: string) => {
  try {
    const raw = localStorage.getItem(storageKey);
    const value = raw ? JSON.parse(raw) : {};
    localStorage.setItem(storageKey, JSON.stringify({ ...value, [tenantId]: [] }));
  } catch {
    localStorage.setItem(storageKey, JSON.stringify({ [tenantId]: [] }));
  }
};

/**
 * Creates an explicit empty browser workspace for a newly provisioned tenant.
 * It never copies another tenant's local data and leaves existing tenant records untouched.
 */
export const initializeCleanTenantWorkspace = (tenant: Tenant) => {
  const tenantId = tenant.id;

  clearTenantEntry('jasper_products_map', tenantId);
  clearTenantEntry('jasper_sales_map', tenantId);
  clearTenantEntry('jasper_expenses_map', tenantId);
  clearTenantEntry('jasper_pending_delivery_notes_map', tenantId);

  localStorage.setItem(`jasper_settings_${tenantId}`, JSON.stringify(createCleanTenantSettings(tenant)));
  localStorage.setItem(`jasper_expense_cats_${tenantId}`, JSON.stringify([]));
  localStorage.setItem(`jasper_docs_${tenantId}`, JSON.stringify([]));
  localStorage.setItem(`till_settlements_${tenantId}`, JSON.stringify([]));
  localStorage.setItem(`jasper_channels_${tenantId}`, JSON.stringify([]));
  localStorage.setItem(`jasper_cash_bank_matrix_${tenantId}`, JSON.stringify([]));
  localStorage.setItem(`jasper_deliveries_${tenantId}`, JSON.stringify([]));
  localStorage.removeItem(`jasper_tenant_logo_${tenantId}`);
};
