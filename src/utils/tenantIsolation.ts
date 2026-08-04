import { SystemSettings, Tenant } from '../types';
import { initializeNewTenantWorkspace } from './tenantWorkspace';
import { payloadHasRecords, readJsonValue, safeSetJsonItem, safeSetTenantMapItem } from './dataSafety';

// Demo records are deliberately opt-in. Every other tenant starts and remains empty until its users add data.
const DEMO_TENANT_IDS = new Set([
  't-lagos-01',
  't-nairobi-02',
  't-accra-03',
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
    businessName: tenant.businessName || '',
    businessPhone: '',
    businessAddress: '',
    businessLogo: '',
    paymentModes: [],
    registeredStores: []
  },
  productStore: {
    categories: [],
    units: [],
    brands: []
  },
  staffs: [],
  customRoles: [],
  invoiceSettings: {}
});

const clearTenantEntry = (storageKey: string, tenantId: string) => {
  try {
    const raw = onlineStorage.getItem(storageKey);
    const value = raw ? JSON.parse(raw) : {};
    if (Array.isArray(value?.[tenantId]) && value[tenantId].length > 0) return;
    safeSetTenantMapItem(storageKey, storageKey.replace(/^jasper_/, ''), { ...value, [tenantId]: [] });
  } catch {
    safeSetTenantMapItem(storageKey, storageKey.replace(/^jasper_/, ''), { [tenantId]: [] });
  }
};

const tenantHasLocalBusinessData = (tenantId: string) => {
  return [
    'jasper_products_map',
    'jasper_sales_map',
    'jasper_expenses_map',
    'jasper_pending_delivery_notes_map',
    'jasper_branches_map',
    'jasper_branch_stocks_map',
    'jasper_branch_staff_assignments_map',
  ].some((storageKey) => {
    const value = readJsonValue<Record<string, any[]>>(storageKey);
    return Array.isArray(value?.[tenantId]) && value[tenantId].length > 0;
  });
};

/**
 * Creates an explicit empty browser workspace for a newly provisioned tenant.
 * It never copies another tenant's local data and leaves existing tenant records untouched.
 */
export const initializeCleanTenantWorkspace = (tenant: Tenant) => {
  const tenantId = tenant.id;
  const hasExistingBusinessData = tenantHasLocalBusinessData(tenantId);

  clearTenantEntry('jasper_products_map', tenantId);
  clearTenantEntry('jasper_sales_map', tenantId);
  clearTenantEntry('jasper_expenses_map', tenantId);
  clearTenantEntry('jasper_pending_delivery_notes_map', tenantId);

  const settings = createCleanTenantSettings(tenant);
  const settingsKey = `jasper_settings_${tenantId}`;
  const existingSettings = readJsonValue(settingsKey);
  if (!payloadHasRecords(existingSettings)) {
    safeSetJsonItem(settingsKey, settings, { tenantId, dataKey: 'settings', logLabel: `${tenantId}/settings` });
  }
  safeSetJsonItem(`jasper_expense_cats_${tenantId}`, [], { tenantId, dataKey: 'expense_cats', logLabel: `${tenantId}/expense-categories` });
  safeSetJsonItem(`jasper_docs_${tenantId}`, [], { tenantId, dataKey: 'docs', logLabel: `${tenantId}/docs` });
  safeSetJsonItem(`till_settlements_${tenantId}`, [], { tenantId, dataKey: 'till_settlements', logLabel: `${tenantId}/till-settlements` });
  safeSetJsonItem(`jasper_channels_${tenantId}`, [], { tenantId, dataKey: 'channels', logLabel: `${tenantId}/channels` });
  safeSetJsonItem(`jasper_cash_bank_matrix_${tenantId}`, [], { tenantId, dataKey: 'cash_bank_matrix', logLabel: `${tenantId}/cash-bank-matrix` });
  safeSetJsonItem(`jasper_deliveries_${tenantId}`, [], { tenantId, dataKey: 'deliveries', logLabel: `${tenantId}/deliveries` });

  // Save empty workspace to Supabase DB so data persists across devices
  if (!hasExistingBusinessData) {
    initializeNewTenantWorkspace(tenantId, settings as any).catch(() => {
      // Non-fatal — workspace will be saved when dashboard first loads
    });
  }
};
