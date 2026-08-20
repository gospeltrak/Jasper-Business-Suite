import React, { useState, useEffect, useRef } from 'react';
import { CompanySettings, BusinessSettings, ProductStoreSettings, StaffSettings, SystemSettings, Tenant, CustomRole, RolePermission, InvoiceSettings, Sale, Expense, Delivery } from '../types';
import { useTheme } from '../ThemeContext';
import { useTenantLogo } from '../TenantLogoContext';
import { DEFAULT_TENANTS } from '../data';
import { getPaymentModeName } from '../utils/paymentAccounts';
import { 
  Settings as SettingsIcon, 
  Building, 
  Building2,
  Briefcase, 
  Package, 
  Users, 
  Check, 
  Trash2, 
  Plus, 
  Upload, 
  Coins, 
  Globe, 
  Clock, 
  CreditCard, 
  Store, 
  Tag, 
  Sliders, 
  Sun, 
  Moon, 
  Bell,
  Percent, 
  PercentSquare, 
  User, 
  CheckCircle,
  FileText,
  ShieldCheck,
  Lock,
  KeyRound,
  Save,
  X,
  Activity,
  DollarSign,
  Truck,
  ArrowLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { DashboardNotificationsSettings } from './DashboardNotificationsSettings';
import { getSecureDataBridgeClient } from '../secureDataBridge';
import { compressImageFile } from '../utils/imageCompression';
import { getTreasuryPaymentMethods, reconcilePaymentChannels } from '../utils/paymentAccounts';
import { lazyWithReload } from '../utils/lazyWithReload';

const DashboardBranchesSettings = lazyWithReload('SettingsDashboardBranches', () => import('./DashboardBranchesSettings'));

import { DEFAULT_CUSTOM_ROLES } from '../utils/defaultCustomRoles';
export { DEFAULT_CUSTOM_ROLES };

interface DashboardSettingsProps {
  activeTenant: Tenant;
  systemSettings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => void;
  subscriptionStatus?: any;
  onTriggerUpgrade?: (limitType: 'products' | 'stores' | 'staff' | 'expired') => void;
  sales?: Sale[];
  expenses?: Expense[];
  deliveries?: Delivery[];
}

const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: '',
  businessAddress: '',
  businessPhone: '',
  businessEmail: '',
  allowNegativeStock: false,
  defaultUnit: 'pcs',
  requireStockCheck: true,
  autoGenerateBarcode: false,
  paymentModes: [],
  deliveryPaymentModes: [],
  registeredStores: [],
  businessNameSlug: '',
  subdomainSlug: '',
  primaryDomain: '',
  domainStatus: '',
  isDomainActive: true
} as unknown as BusinessSettings;

const DEFAULT_PRODUCT_STORE_SETTINGS: ProductStoreSettings = {
  showImages: true,
  compactView: false,
  categories: [],
  units: [],
  brands: []
} as unknown as ProductStoreSettings;

const normalizeBusinessSettings = (settings?: Partial<BusinessSettings>): BusinessSettings => ({
  ...DEFAULT_BUSINESS_SETTINGS,
  ...(settings || {}),
  paymentModes: Array.isArray(settings?.paymentModes) ? settings.paymentModes : [],
  deliveryPaymentModes: Array.isArray(settings?.deliveryPaymentModes) ? settings.deliveryPaymentModes : [],
  registeredStores: Array.isArray(settings?.registeredStores) ? settings.registeredStores : []
} as BusinessSettings);

const normalizeProductStoreSettings = (settings?: Partial<ProductStoreSettings>): ProductStoreSettings => ({
  ...DEFAULT_PRODUCT_STORE_SETTINGS,
  ...(settings || {}),
  categories: Array.isArray(settings?.categories) ? settings.categories : [],
  units: Array.isArray(settings?.units) ? settings.units : [],
  brands: Array.isArray(settings?.brands) ? settings.brands : []
} as ProductStoreSettings);

const SETTINGS_DRAFT_PROTECTION_MS = 15000;

// Store Locations (registeredStores) is a legacy stock-bin concept, unrelated
// to the real Tanzanite Branches feature (separate `branches` table, its own
// entitlement/limit, its own Settings screen). Its embedded "Branch Logos"
// sub-panel in particular was a naive stand-in that never followed the
// tenant's actual active branch — see docs/multi-branch-audit-plan.md,
// "Existing branch-like concepts that must remain independent" and gap
// High-7. Hidden here (not deleted) while real per-branch logo support is
// built on the `branches` table; existing registeredStores/branchBranding
// data is left untouched so nothing already saved is lost, and the product
// destination picker (Shop/Store in Purchases) is a separate hardcoded
// concept unaffected by this toggle.
const SHOW_LEGACY_STORE_LOCATIONS = false;

export default function DashboardSettings({ 
  activeTenant, 
  systemSettings, 
  onSaveSettings,
  subscriptionStatus,
  onTriggerUpgrade,
  sales = [],
  expenses = [],
  deliveries = []
}: DashboardSettingsProps) {
  const { isDark, toggleTheme } = useTheme();
  const { setLogoUrl } = useTenantLogo();
  const incomingSettingsSyncRef = useRef(false);
  const settingsDraftTouchedAtRef = useRef(0);
  // Navigation tabs for Settings
  const [activeSubTab, setActiveSubTab] = useState<'company' | 'business' | 'product-store' | 'invoice-settings' | 'roles' | 'notifications' | 'branches'>('company');
  const [isMobileSettingsMenuOpen, setIsMobileSettingsMenuOpen] = useState(true);
  const [settingsSearchTerm, setSettingsSearchTerm] = useState('');
  
  // Temporary states for local forms to avoid writing directly to parent state until saved
  const [companyForm, setCompanyForm] = useState<CompanySettings>(() => {
    const base = systemSettings?.company || {
      companyName: '', businessType: '', currency: 'TZS', currencySymbol: 'TSh',
      country: 'Tanzania', city: '', taxRate: 18, logoUrl: ''
    } as unknown as CompanySettings;
    // Sync themeMode with the actual current theme so saving doesn't reset it
    return { ...base, themeMode: (base as any).themeMode || (isDark ? 'dark' : 'light') };
  });
  const [businessForm, setBusinessForm] = useState<BusinessSettings>(() => normalizeBusinessSettings(systemSettings?.business));
  // The tenant's subdomain/business-name slug is assigned server-side at registration
  // (and is immutable after that) and lives on the `tenants` table row, not inside
  // systemSettings.business -- so it's fetched separately here rather than relying on
  // businessForm, which would otherwise always look "not yet chosen".
  const [fetchedTenantDomain, setFetchedTenantDomain] = useState<{ subdomainSlug: string | null; businessNameSlug: string | null; isDomainActive: boolean } | null>(null);

  useEffect(() => {
    if (!activeTenant?.id) return;
    let cancelled = false;
    fetch(`/api/tenant/slug?tenantId=${encodeURIComponent(activeTenant.id)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setFetchedTenantDomain({
          subdomainSlug: data.subdomainSlug || null,
          businessNameSlug: data.businessNameSlug || null,
          isDomainActive: data.isDomainActive !== false,
        });
      })
      .catch(() => { /* non-critical: the slug section just falls back to "not yet set" */ });
    return () => { cancelled = true; };
  }, [activeTenant?.id]);
  const [productForm, setProductForm] = useState<ProductStoreSettings>(() => normalizeProductStoreSettings(systemSettings?.productStore));
  const [invoiceSettingsForm, setInvoiceSettingsForm] = useState<InvoiceSettings>(() => {
    return systemSettings?.invoiceSettings || {
      invoiceColor: '#0284c7', // Sky Blue fallback matching PDF
      tin: systemSettings?.company?.tin || '',
      bankName: 'NMB Bank',
      accountNumber: '23710039969',
      accountName: systemSettings?.company?.companyName || 'Doe Company',
      authorisedPerson: 'Jane Doe',
      termsAndConditions: [
        'Goods once sold will not be taken back or exchanged.',
        'The buyer is responsible for all delivery costs.'
      ],
      hasVatByDefault: false
    };
  });
  const [posSettingsForm, setPosSettingsForm] = useState(() => ({
    showProductImages: systemSettings?.posSettings?.showProductImages !== false
  }));
  const [staffsList, setStaffsList] = useState<StaffSettings[]>(() => {
    const original = systemSettings?.staffs || [];
    if (activeTenant.businessType === 'restaurant') {
      return original.map(s => s.role === 'Seller' ? { ...s, role: 'Waiter' as any } : s);
    }
    return original;
  });

  const [viewingStaffReport, setViewingStaffReport] = useState<StaffSettings | null>(null);
  // A brand-new tenant starts with zero roles — they build their own from
  // scratch (see "Create New Role" below) rather than the system silently
  // seeding a fixed preset list. A tenant that already has real, saved
  // roles (customRoles.length > 0) is completely unaffected by this.
  const [customRolesList, setCustomRolesList] = useState<CustomRole[]>(() => {
    const roles = systemSettings?.customRoles || [];
    if (activeTenant.businessType === 'restaurant') {
      return roles.map(r => r.name === 'Seller' ? { ...r, name: 'Waiter' } : r);
    }
    return roles;
  });

  // Success alert message states
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [slugSaveStatus, setSlugSaveStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [isSlugSaving, setIsSlugSaving] = useState(false);

  // Logo upload and server persistence state
  const [isLogoSaving, setIsLogoSaving] = useState(false);
  const [logoSaveStatus, setLogoSaveStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [hasNewLogoToSave, setHasNewLogoToSave] = useState(false);

  const handlePersistLogoToDb = async () => {
    if (!companyForm.logo) return;
    setIsLogoSaving(true);
    setLogoSaveStatus(null);
    try {
      const client: any = await getSecureDataBridgeClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in again before saving the logo.');
      }
      const response = await fetch(`/api/tenant/logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          logoBase64: companyForm.logo
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData?.error || resData?.message || 'Failed to save logo');
      }

      const savedLogoUrl = resData.logoUrl;
      setCompanyForm(prev => ({ ...prev, logo: savedLogoUrl }));
      setHasNewLogoToSave(false);
      setLogoSaveStatus({ type: 'success', msg: 'Nembo imehifadhiwa kikamilifu! / Logo saved successfully!' });
      
      // Update local storage in real-time
      onlineStorage.setItem(`jasper_tenant_logo_${activeTenant.id}`, savedLogoUrl);
      setLogoUrl(savedLogoUrl);
      
      // Also save general settings
      const fullyUpdatedSettings = buildSettingsSnapshot({
        company: { ...companyForm, logo: savedLogoUrl },
      });
      onSaveSettings(fullyUpdatedSettings);

    } catch (err: any) {
      console.error('Error saving logo:', err);
      setLogoSaveStatus({ type: 'error', msg: 'Imeshindwa kuhifadhi nembo. / Failed to save logo. ' + (err?.message || '') });
    } finally {
      setIsLogoSaving(false);
    }
  };

  // Dynamic Roles & Permissions States
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role-seller');
  const [newRoleName, setNewRoleName] = useState<string>('');
  const markSettingsDraftChanged = () => {
    settingsDraftTouchedAtRef.current = Date.now();
  };

  const buildSettingsSnapshot = (
    overrides: Partial<SystemSettings> = {},
  ): SystemSettings => {
    const nextBusiness = overrides.business || businessForm;
    return {
      ...systemSettings,
      ...overrides,
      company: overrides.company || companyForm,
      business: nextBusiness,
      productStore: overrides.productStore || productForm,
      staffs: overrides.staffs || staffsList,
      customRoles: overrides.customRoles || customRolesList,
      invoiceSettings: overrides.invoiceSettings || invoiceSettingsForm,
      posSettings: overrides.posSettings || posSettingsForm,
      paymentChannels: overrides.paymentChannels || reconcilePaymentChannels(
        getTreasuryPaymentMethods(nextBusiness),
        systemSettings.paymentChannels || [],
        { currency: activeTenant.currencyCode },
      ),
    };
  };

  const cleanBusinessSlug = (value: string) => value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);

  const baseDomain = ((import.meta as any).env?.VITE_APP_BASE_DOMAIN || 'orvix.africa') as string;
  const lockedBusinessSlug = fetchedTenantDomain?.subdomainSlug || fetchedTenantDomain?.businessNameSlug
    || activeTenant.subdomainSlug || activeTenant.businessNameSlug
    || (businessForm.domainStatus === 'active' ? (businessForm.subdomainSlug || businessForm.businessNameSlug) : '');
  const currentBusinessSlug = String(lockedBusinessSlug || businessForm.subdomainSlug || businessForm.businessNameSlug || '');
  const isBusinessSlugLocked = !!lockedBusinessSlug;
  const currentBusinessDomain = currentBusinessSlug ? `${currentBusinessSlug}.${baseDomain}` : '';

  const persistBusinessSlugIfNeeded = async () => {
    if (isBusinessSlugLocked) return businessForm;
    const slug = cleanBusinessSlug(currentBusinessSlug);
    if (!slug) return businessForm;
    if (slug.length < 2) throw new Error('Business Name Slug must be at least 2 characters.');

    setIsSlugSaving(true);
    setSlugSaveStatus({ type: 'info', msg: 'Saving Business Name Slug...' });
    try {
      const client: any = await getSecureDataBridgeClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before saving Business Name Slug.');
      const response = await fetch('/api/tenant/slug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ tenantId: activeTenant.id, slug })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result?.error || 'Unable to save Business Name Slug.');
      const nextBusinessForm = {
        ...businessForm,
        businessNameSlug: result.slug,
        subdomainSlug: result.slug,
        primaryDomain: result.domain,
        domainStatus: 'active',
        isDomainActive: true
      } as BusinessSettings;
      setBusinessForm(nextBusinessForm);
      setSlugSaveStatus({ type: 'success', msg: `Business domain saved: ${result.domain}. It cannot be changed.` });
      return nextBusinessForm;
    } finally {
      setIsSlugSaving(false);
    }
  };

  const handleToggleBranchAccess = (roleId: string) => {
    setCustomRolesList(prev => prev.map(r => r.id === roleId
      ? { ...r, canAccessAllBranches: r.canAccessAllBranches === false ? true : false }
      : r));
  };

  const handleTogglePermission = (roleId: string, module: string, permissionType: 'read' | 'write' | 'edit') => {
    setCustomRolesList(prev => prev.map(r => {
      if (r.id === roleId) {
        const currentModPerms = (r.permissions as any)[module] || { read: false, write: false, edit: false };
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [module]: {
              ...currentModPerms,
              [permissionType]: !currentModPerms[permissionType]
            }
          }
        };
      }
      return r;
    }));
  };

  const handleRenameRole = (roleId: string, newName: string) => {
    setCustomRolesList(prev => prev.map(r => {
      if (r.id === roleId) {
        return { ...r, name: newName };
      }
      return r;
    }));
  };

  const handleCreateNewRole = () => {
    const freshRoleName = newRoleName.trim() || 'Custom Role';
    if (customRolesList.some(r => r.name.toLowerCase() === freshRoleName.toLowerCase())) {
      alert("A system role with this name already exists. Please provide a distinctive name!");
      return;
    }
    const newId = 'role-' + Math.random().toString(36).substr(2, 9);
    const templatedRole: CustomRole = {
      id: newId,
      name: freshRoleName,
      permissions: {
        pos: { read: true, write: true, edit: false },
        products: { read: true, write: false, edit: false },
        purchases: { read: false, write: false, edit: false },
        suppliers: { read: false, write: false, edit: false },
        expenses: { read: true, write: true, edit: false },
        reportsSalesExpenses: { read: true, write: false, edit: false },
        reportsProfitCogs: { read: false, write: false, edit: false },
        sync: { read: true, write: false, edit: false },
        settings: { read: false, write: false, edit: false },

        salesList: { read: true, write: false, edit: false },
        salesReturn: { read: false, write: false, edit: false },
        orderPayments: { read: true, write: true, edit: false },
        paymentIn: { read: true, write: true, edit: false },
        paymentOut: { read: false, write: false, edit: false },
        quotation: { read: true, write: false, edit: false },
        stockAdjustment: { read: false, write: false, edit: false },
        stockTransfer: { read: true, write: false, edit: false },
        companySettings: { read: false, write: false, edit: false },
        storageSettings: { read: false, write: false, edit: false },
        emailSettings: { read: false, write: false, edit: false },
        updateApp: { read: false, write: false, edit: false },
        cashAndBank: { read: true, write: false, edit: false },
        storesBranch: { read: false, write: false, edit: false },
        translations: { read: false, write: false, edit: false },
        rolePermissions: { read: false, write: false, edit: false },
        taxes: { read: false, write: false, edit: false },
        currencies: { read: false, write: false, edit: false },
        paymentModes: { read: true, write: false, edit: false },
        units: { read: true, write: false, edit: false },
        customFields: { read: false, write: false, edit: false },
        staffMembers: { read: false, write: false, edit: false },
        customersList: { read: true, write: true, edit: false },
        suppliersList: { read: false, write: false, edit: false },
        saleItemsStats: { read: true, write: false, edit: false },
        totalAmountStats: { read: true, write: false, edit: false },
        totalExpensesStats: { read: false, write: false, edit: false },
        totalPurchasesStats: { read: false, write: false, edit: false },
        totalProfitStats: { read: false, write: false, edit: false },
        salesDueStats: { read: true, write: false, edit: false },
        brands: { read: true, write: false, edit: false },
        productCategories: { read: true, write: false, edit: false },
        productVariations: { read: true, write: false, edit: false },
        productsList: { read: true, write: false, edit: false },
        expenseCategories: { read: true, write: false, edit: false },
        expensesList: { read: true, write: true, edit: false },
        purchaseReturn: { read: false, write: false, edit: false }
      }
    };
    setCustomRolesList(prev => [...prev, templatedRole]);
    setSelectedRoleId(newId);
    setNewRoleName('');
  };

  const handleDeleteRole = (id: string) => {
    // No hardcoded preset IDs are protected anymore — every role here is
    // one the tenant created themselves. The only real safety guard is not
    // orphaning a staff member who currently holds this role, since an
    // unmatched role string silently resolves to zero permissions.
    const role = customRolesList.find(r => r.id === id);
    const assignedCount = role ? staffsList.filter(s => s.role === role.name).length : 0;
    if (assignedCount > 0) {
      alert(`This role is assigned to ${assignedCount} staff member${assignedCount === 1 ? '' : 's'}. Reassign them to a different role before deleting it.`);
      return;
    }
    const remaining = customRolesList.filter(r => r.id !== id);
    setCustomRolesList(remaining);
    if (remaining.length > 0) {
      setSelectedRoleId(remaining[0].id);
    }
  };

  // Synchronize when the active props update
  useEffect(() => {
    if (Date.now() - settingsDraftTouchedAtRef.current < SETTINGS_DRAFT_PROTECTION_MS) {
      return;
    }
    incomingSettingsSyncRef.current = true;
    setCompanyForm(systemSettings?.company || companyForm);
    setBusinessForm(normalizeBusinessSettings(systemSettings?.business));
    setProductForm(normalizeProductStoreSettings(systemSettings?.productStore));
    setStaffsList(systemSettings?.staffs || []);
    setCustomRolesList(systemSettings?.customRoles || []);
    setInvoiceSettingsForm(systemSettings?.invoiceSettings || {});
    setPosSettingsForm({
      showProductImages: systemSettings?.posSettings?.showProductImages !== false,
    });
    window.setTimeout(() => {
      incomingSettingsSyncRef.current = false;
    }, 0);
  }, [systemSettings]);

  // Handle Company Name change to system auto-generate usernameKey
  const handleCompanyNameChange = (val: string) => {
    // Generate username format based on text: lowercase, replace spaces and special chars with hyphens
    const generatedKey = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // strip special characters
      .replace(/\s+/g, '-') // collapse spaces to single hyphen
      .replace(/-+/g, '-'); // collapse multiple hyphens
    
    setCompanyForm(prev => ({
      ...prev,
      companyName: val,
      usernameKey: generatedKey
    }));
  };

  const persistCompanySettings = (nextCompanyForm: CompanySettings) => {
    markSettingsDraftChanged();
    onSaveSettings(buildSettingsSnapshot({ company: nextCompanyForm }));
  };

  const persistBusinessSettings = (nextBusinessForm: BusinessSettings) => {
    markSettingsDraftChanged();
    onSaveSettings(buildSettingsSnapshot({
      business: nextBusinessForm,
      paymentChannels: reconcilePaymentChannels(
        getTreasuryPaymentMethods(nextBusinessForm),
        systemSettings.paymentChannels || [],
        { currency: activeTenant.currencyCode },
      ),
    }));
  };

  // Drag and drop logo processors
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'company' | 'business' | 'business_light' | 'business_dark') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64String = await compressImageFile(file, { maxWidth: 512, maxHeight: 512, quality: 0.72 });

        // Upload to Supabase Storage in background — get a permanent URL
        // that replaces the base64 string everywhere once upload completes.
        const applyLogoUrl = (url: string) => {
          const urlToUse = url || base64String;
          if (target === 'company') {
            const nextCompanyForm = { ...companyForm, logo: urlToUse };
            setCompanyForm(nextCompanyForm);
            setHasNewLogoToSave(true);
            onlineStorage.setItem(`jasper_tenant_logo_${activeTenant.id}`, urlToUse);
            setLogoUrl(urlToUse);
            persistCompanySettings(nextCompanyForm);
          } else if (target === 'business_light') {
            const nextBusinessForm = {
              ...businessForm,
              businessLogoLight: urlToUse,
              businessLogo: businessForm.businessLogo || urlToUse
            };
            setBusinessForm(nextBusinessForm);
            persistBusinessSettings(nextBusinessForm);
          } else if (target === 'business_dark') {
            // Deliberately does NOT fall back into the general `businessLogo`
            // field the way the light-logo branch below does. `businessLogo`
            // is the "safe on a white background" fallback used by Reports
            // and the Light Theme preview card — leaking a dark-theme logo
            // (which can carry a baked-in dark/black background) into it
            // reproduces the exact black-logo-box artifact those call sites
            // exist to avoid. Places that do want the dark logo already read
            // `businessLogoDark` directly (see getBusinessLogo()).
            const nextBusinessForm = {
              ...businessForm,
              businessLogoDark: urlToUse
            };
            setBusinessForm(nextBusinessForm);
            persistBusinessSettings(nextBusinessForm);
          } else {
            const nextBusinessForm = { ...businessForm, businessLogo: urlToUse };
            setBusinessForm(nextBusinessForm);
            persistBusinessSettings(nextBusinessForm);
          }
        };

        // Apply base64 immediately for instant preview
        applyLogoUrl(base64String);

        // Then upload to Storage and replace with permanent URL
        import('../utils/imageStorage').then(({ uploadTenantLogo }) =>
          uploadTenantLogo(file, activeTenant.id)
        ).then((storageUrl) => {
          if (storageUrl) applyLogoUrl(storageUrl);
        }).catch((err) => {
          console.warn('[DashboardSettings] Logo Storage upload failed, base64 kept:', err);
        });

      } catch (error) {
        console.warn('Unable to compress uploaded logo', error);
      }
    }
  };

  // Delivery Payment Mode management states
  const [newDeliveryPaymentMode, setNewDeliveryPaymentMode] = useState('');
  const handleAddDeliveryPaymentMode = () => {
    const deliveryMode = newDeliveryPaymentMode.trim();
    if (!deliveryMode) return;
    const currentDeliveryPaymentModes = businessForm.deliveryPaymentModes || [];
    if (!currentDeliveryPaymentModes.includes(deliveryMode)) {
      const nextBusinessForm = {
        ...businessForm,
        deliveryPaymentModes: [...currentDeliveryPaymentModes, deliveryMode]
      };
      setBusinessForm(nextBusinessForm);
      persistBusinessSettings(nextBusinessForm);
    }
    setNewDeliveryPaymentMode('');
  };
  const handleRemoveDeliveryPaymentMode = (mode: string) => {
    const nextBusinessForm = {
      ...businessForm,
      deliveryPaymentModes: (businessForm.deliveryPaymentModes || []).filter(m => m !== mode)
    };
    setBusinessForm(nextBusinessForm);
    persistBusinessSettings(nextBusinessForm);
  };

  // Payment Mode management states
  const [newPaymentMode, setNewPaymentMode] = useState('');
  const handleAddPaymentMode = () => {
    const paymentMode = newPaymentMode.trim();
    if (!paymentMode) return;
    const currentPaymentModes = businessForm.paymentModes || [];
    if (!currentPaymentModes.some(mode => getPaymentModeName(mode) === paymentMode)) {
      const nextBusinessForm = {
        ...businessForm,
        paymentModes: [...currentPaymentModes, paymentMode]
      };
      setBusinessForm(nextBusinessForm);
      persistBusinessSettings(nextBusinessForm);
    }
    setNewPaymentMode('');
  };
  const handleRemovePaymentMode = (mode: string) => {
    const nextBusinessForm = {
      ...businessForm,
        paymentModes: (businessForm.paymentModes || []).filter(m => getPaymentModeName(m) !== mode)
    };
    setBusinessForm(nextBusinessForm);
    persistBusinessSettings(nextBusinessForm);
  };

  // Store management states
  const [newStoreName, setNewStoreName] = useState('');
  const [storeLimitMessage, setStoreLimitMessage] = useState<string | null>(null);
  const openStoreUpgrade = (planId: 'diamond' | 'tanzanite') => {
    setStoreLimitMessage(null);
    onTriggerUpgrade?.('stores');
  };
  const [selectedBranchForLogo, setSelectedBranchForLogo] = useState<string | null>(null);

  const handleBranchLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, storeName: string, mode: 'light' | 'dark') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const logoUrl = reader.result as string;
        const currentBranding = businessForm.branchBranding || {};
        const currentEntry = currentBranding[storeName] || {};
        const updated = {
          ...businessForm,
          branchBranding: {
            ...currentBranding,
            [storeName]: {
              ...currentEntry,
              ...(mode === 'light'
                ? { businessLogoLight: logoUrl, businessLogo: currentEntry.businessLogo || logoUrl }
                : { businessLogoDark: logoUrl })
            }
          }
        };
        setBusinessForm(updated);
        persistBusinessSettings(updated);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('[BranchLogo] Upload failed:', err);
    }
    e.target.value = '';
  };

  const handleBranchLogoRemove = (storeName: string, mode: 'light' | 'dark') => {
    const currentBranding = businessForm.branchBranding || {};
    const currentEntry = { ...(currentBranding[storeName] || {}) };
    if (mode === 'light') { delete currentEntry.businessLogoLight; delete currentEntry.businessLogo; }
    else delete currentEntry.businessLogoDark;
    const updated = { ...businessForm, branchBranding: { ...currentBranding, [storeName]: currentEntry } };
    setBusinessForm(updated);
    persistBusinessSettings(updated);
  };

  const handleAddStore = () => {
    if (newStoreName.trim()) {
      if (subscriptionStatus) {
        if (subscriptionStatus.isExpired) {
          onTriggerUpgrade?.('expired');
          return;
        }
        const planId = String(subscriptionStatus.state?.planId || subscriptionStatus.plan?.packageId || subscriptionStatus.plan?.name || '').toLowerCase();
        const isRubyPlan = planId === 'ruby' || planId === 'essential' || subscriptionStatus.plan?.name === 'Ruby';
        const registeredStores = businessForm.registeredStores || [];
        if (isRubyPlan && registeredStores.length >= 1) {
          setStoreLimitMessage('ruby-multiple-stores');
          return;
        }
        if (registeredStores.length >= subscriptionStatus.plan.maxStores) {
          onTriggerUpgrade?.('stores');
          return;
        }
      }
      if (!(businessForm.registeredStores || []).includes(newStoreName.trim())) {
        const nextBusinessForm = {
          ...businessForm,
          registeredStores: [...(businessForm.registeredStores || []), newStoreName.trim()]
        };
        setBusinessForm(nextBusinessForm);
        persistBusinessSettings(nextBusinessForm);
      }
      setStoreLimitMessage(null);
      setNewStoreName('');
    }
  };
  const handleRemoveStore = (store: string) => {
    const nextBusinessForm = {
      ...businessForm,
      registeredStores: (businessForm.registeredStores || []).filter(s => s !== store)
    };
    setBusinessForm(nextBusinessForm);
    persistBusinessSettings(nextBusinessForm);
  };

  const persistProductStoreSettings = (nextProductForm: ProductStoreSettings) => {
    markSettingsDraftChanged();
    onSaveSettings(buildSettingsSnapshot({
      productStore: nextProductForm,
    }));
  };

  // Product Categories management states
  const [newCategory, setNewCategory] = useState('');
  const handleAddCategory = () => {
    const category = newCategory.trim();
    if (!category) return;

    const currentCategories = productForm.categories || [];
    if (!currentCategories.includes(category)) {
      const nextProductForm = {
        ...productForm,
        categories: [...currentCategories, category]
      };
      setProductForm(nextProductForm);
      persistProductStoreSettings(nextProductForm);
    }
    setNewCategory('');
  };
  const handleRemoveCategory = (cat: string) => {
    const nextProductForm = {
      ...productForm,
      categories: (productForm.categories || []).filter(c => c !== cat)
    };
    setProductForm(nextProductForm);
    persistProductStoreSettings(nextProductForm);
  };

  // Product Units management states
  const [newUnit, setNewUnit] = useState('');
  const handleAddUnit = () => {
    const formatted = newUnit.trim().toLowerCase();
    if (!formatted) return;

    const currentUnits = productForm.units || [];
    if (!currentUnits.includes(formatted)) {
      const nextProductForm = {
        ...productForm,
        units: [...currentUnits, formatted]
      };
      setProductForm(nextProductForm);
      persistProductStoreSettings(nextProductForm);
    }
    setNewUnit('');
  };
  const handleRemoveUnit = (unit: string) => {
    const nextProductForm = {
      ...productForm,
      units: (productForm.units || []).filter(u => u !== unit)
    };
    setProductForm(nextProductForm);
    persistProductStoreSettings(nextProductForm);
  };

  // Global Save triggers
  const triggerSaveAll = async () => {
    let nextBusinessForm = businessForm;
    try {
      nextBusinessForm = await persistBusinessSlugIfNeeded();
    } catch (error: any) {
      setSlugSaveStatus({ type: 'error', msg: error?.message || 'Unable to save Business Name Slug.' });
      setSaveSuccess(null);
      return;
    }
    const fullyUpdatedSettings = buildSettingsSnapshot({
      business: nextBusinessForm,
    });
    onSaveSettings(fullyUpdatedSettings);
    
    // Apply Light/Dark mode changes immediately if the user explicitly changed it
    if (companyForm.themeMode === 'dark' && !isDark) {
      toggleTheme();
    } else if (companyForm.themeMode === 'light' && isDark) {
      toggleTheme();
    }

    setSaveSuccess('System configurations and business guidelines updated successfully!');
    setTimeout(() => {
      setSaveSuccess(null);
    }, 4000);
  };

  const settingsTabs: Array<{
    id: typeof activeSubTab;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ElementType;
    premium?: boolean;
  }> = [
    { id: 'company', label: 'Company Account', shortLabel: 'Company', description: 'Legal profile, tax, currency, theme', icon: Building },
    { id: 'business', label: 'Business Setup', shortLabel: 'Business', description: 'Brand, payment modes, stores', icon: Briefcase },
    { id: 'product-store', label: 'Product & Store Units', shortLabel: 'Stores', description: 'Units, product behavior, inventory bins', icon: Package },
    { id: 'invoice-settings', label: 'Invoice Settings', shortLabel: 'Invoice', description: 'Receipt branding and invoice fields', icon: FileText },
    { id: 'roles', label: 'Staff Roles & Access', shortLabel: 'Access', description: 'Permissions and private role presets', icon: ShieldCheck },
    { id: 'notifications', label: 'Alerts & Reports', shortLabel: 'Alerts', description: 'Notification channels and reports', icon: Bell },
    { id: 'branches', label: 'Branches', shortLabel: 'Branches', description: 'Independent branch workspaces and access', icon: Building2, premium: true }
  ];

  const visibleSettingsTabs = settingsTabs.filter(tab => {
    const needle = settingsSearchTerm.trim().toLowerCase();
    return !needle || `${tab.label} ${tab.description}`.toLowerCase().includes(needle);
  });

  const activeSettingsTab = settingsTabs.find(tab => tab.id === activeSubTab) || settingsTabs[0];
  const completedProfileCount = [
    companyForm.companyName,
    companyForm.email,
    companyForm.phone,
    companyForm.tin,
    businessForm.businessName,
    businessForm.paymentModes?.length ? 'payments' : '',
    staffsList.length ? 'staff' : ''
  ].filter(Boolean).length;

  const openSettingsModule = (tabId: typeof activeSubTab) => {
    setActiveSubTab(tabId);
    setIsMobileSettingsMenuOpen(false);
    requestAnimationFrame(() => {
      document.getElementById('workspace-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const returnToSettingsMenu = () => {
    setIsMobileSettingsMenuOpen(true);
    requestAnimationFrame(() => {
      document.getElementById('workspace-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div
      className="tenant-settings-shell space-y-5 pb-24 md:pb-8"
      onInputCapture={markSettingsDraftChanged}
      onChangeCapture={markSettingsDraftChanged}
    >
      
      {/* Title Header with descriptive details */}
      <div className="hidden xl:block bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 lg:p-6 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                <SettingsIcon className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">System control center</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">Settings</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Configure company identity, business rules, invoices, staff, access controls, stores, alerts, and reports.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 xl:min-w-[560px]">
            <div className="rounded-2xl border border-slate-900 bg-slate-950 text-white p-3.5">
              <span className="block text-[9.5px] font-black uppercase tracking-widest text-white/60 font-mono">Active module</span>
              <span className="block mt-2 text-sm font-black leading-tight">{activeSettingsTab.shortLabel}</span>
              <span className="block mt-1 text-[10px] text-white/50">{activeSettingsTab.description}</span>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-900 p-3.5">
              <span className="block text-[9.5px] font-black uppercase tracking-widest text-emerald-700/70 font-mono">Profile ready</span>
              <span className="block mt-2 text-lg font-black leading-tight">{completedProfileCount}/7</span>
              <span className="block mt-1 text-[10px] text-emerald-700/70">Core fields filled</span>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-900 p-3.5">
              <span className="block text-[9.5px] font-black uppercase tracking-widest text-indigo-700/70 font-mono">Staff</span>
              <span className="block mt-2 text-lg font-black leading-tight">{staffsList.length}</span>
              <span className="block mt-1 text-[10px] text-indigo-700/70">Registered workers</span>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 text-blue-900 p-3.5">
              <span className="block text-[9.5px] font-black uppercase tracking-widest text-blue-700/70 font-mono">Roles</span>
              <span className="block mt-2 text-lg font-black leading-tight">{customRolesList.length}</span>
              <span className="block mt-1 text-[10px] text-blue-700/70">Access presets</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span className="font-black text-slate-700">{activeSettingsTab.label}</span>
            <span className="hidden sm:inline"> · {activeSettingsTab.description}</span>
          </div>
          {activeSubTab !== 'branches' ? (
            <button
              type="button"
              onClick={triggerSaveAll}
              disabled={isSlugSaving}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-md shadow-emerald-600/10 cursor-pointer transition-all flex items-center justify-center space-x-2 shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSlugSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="settings-native-mobile-header sticky top-0 z-30 overflow-hidden border-y border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 md:hidden">
        <div className="flex items-center gap-3 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-4">
          {!isMobileSettingsMenuOpen && (
            <button
              type="button"
              onClick={returnToSettingsMenu}
              aria-label="Back to Settings menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
            {isMobileSettingsMenuOpen
              ? <SettingsIcon className="h-5 w-5" />
              : <activeSettingsTab.icon className="h-5 w-5" />}
          </div>
          {isMobileSettingsMenuOpen ? (
            <div key="settings-menu-title" className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-black leading-tight text-slate-950 dark:text-white">Settings</h2>
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">Manage your business preferences</p>
            </div>
          ) : (
            <div key={activeSettingsTab.id} className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-black leading-tight text-slate-950 dark:text-white">{activeSettingsTab.label}</h2>
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{activeSettingsTab.description}</p>
            </div>
          )}
          {activeSubTab !== 'branches' ? (
            <button
              type="button"
              onClick={triggerSaveAll}
              disabled={isSlugSaving}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-[11px] font-black uppercase tracking-wide text-white shadow-sm shadow-emerald-600/15 active:scale-95 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSlugSaving ? 'Saving' : 'Save'}</span>
            </button>
          ) : null}
        </div>
        {isMobileSettingsMenuOpen && (
          <div className="settings-readiness-grid grid grid-cols-3 border-t border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center justify-center gap-2 px-2 py-3">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-400">Profile</span>
                <span className="block truncate text-[11px] font-black text-slate-800 dark:text-slate-200">{completedProfileCount}/7 ready</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 border-x border-slate-200 px-2 py-3">
              <Users className="h-4 w-4 shrink-0 text-indigo-600" />
              <div className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-400">Staff</span>
                <span className="block truncate text-[11px] font-black text-slate-800 dark:text-slate-200">{staffsList.length} saved</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-2 py-3">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
              <div className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-400">Roles</span>
                <span className="block truncate text-[11px] font-black text-slate-800 dark:text-slate-200">{customRolesList.length} active</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-xs font-bold text-emerald-800 font-sans transition-all">
          <CheckCircle className="w-4 h-4 text-emerald-600 animate-bounce" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Primary configuration drawer bento structure */}
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-4 xl:grid-cols-4 xl:gap-6">
        
        {/* Navigation Sidebar Drawer */}
        <div className="hidden xl:block bg-white rounded-3xl border border-slate-200 p-4 space-y-2 lg:col-span-1 shadow-sm sticky top-[4.5rem] z-10">
          <div className="px-3 py-2 text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">
            Configuration Modules
          </div>

          {settingsTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-black border-l-2 border-emerald-500'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                {tab.premium ? (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-700">Tanzanite</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 md:block xl:hidden">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">Settings</h3>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={settingsSearchTerm} onChange={event => setSettingsSearchTerm(event.target.value)} placeholder="Search settings" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            </label>
          </div>
          <nav className="divide-y divide-slate-100 dark:divide-slate-800" aria-label="Tablet settings categories">
            {visibleSettingsTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveSubTab(tab.id)} className={`flex min-h-[66px] w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition ${isActive ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/60'}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}><Icon className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-black text-slate-900 dark:text-white">{tab.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">{tab.description}</span>
                  </span>
                  {tab.premium ? <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Tanzanite</span> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className={`${isMobileSettingsMenuOpen ? 'block' : 'hidden'} settings-mobile-module-menu overflow-hidden border-y border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 md:hidden`}>
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Configuration</span>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={settingsSearchTerm} onChange={event => setSettingsSearchTerm(event.target.value)} placeholder="Search settings" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-[13px] font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            </label>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleSettingsTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openSettingsModule(tab.id)}
                  className={`group flex min-h-[68px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-800 sm:px-4 ${isActive ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'bg-white dark:bg-slate-950'}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${isActive ? 'border-emerald-200 bg-emerald-600 text-white shadow-sm dark:border-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-black leading-tight text-slate-900 dark:text-white">{tab.label}</span>
                    <span className="mt-1 block truncate text-[10.5px] font-medium text-slate-500 dark:text-slate-400">{tab.description}</span>
                  </span>
                  {tab.premium ? <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Tanzanite</span> : null}
                  <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Panel Frame */}
        <div className={`${isMobileSettingsMenuOpen ? 'hidden md:block' : 'block'} settings-content-panel min-w-0 space-y-5 md:col-start-2 xl:col-span-3 xl:col-start-auto xl:space-y-6`}>
          
          {/* TAB 1: COMPANY SETTINGS */}
          {activeSubTab === 'company' && (
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-6 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">🏢 Company Level Settings</h3>
                <p className="text-xs text-slate-500 mt-1 font-sans">
                  Configure core business metadata, localized compliance TIN/VAT numbers, legal currency markers, and system color mode preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans">
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Company Legal Name</label>
                  <input
                    type="text"
                    value={companyForm.companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="Enter company legal registry name..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Company Code</label>
                  <div className="flex bg-slate-100 border border-slate-200 rounded-xl overflow-hidden font-mono font-bold text-slate-600">
                    <span className="px-3.5 py-2.5 bg-slate-200 text-slate-500 select-none text-[11px]">@</span>
                    <input
                      type="text"
                      readOnly
                      value={companyForm.usernameKey}
                      className="w-full px-3 py-2.5 bg-transparent outline-none cursor-not-allowed text-[11px]"
                      placeholder="auto-generated-key"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block">Auto-created from your company name.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Email Address</label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="email@company.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Direct Phone Line</label>
                  <input
                    type="text"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="+234 or +254..."
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Company Address</label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="Legal street, Plot No, City, Country"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Tax ID Number (TIN)</label>
                  <input
                    type="text"
                    value={companyForm.tin}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, tin: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="TIN-XXXXXXXX-X"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">VAT Number</label>
                  <input
                    type="text"
                    value={companyForm.vat}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, vat: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. VAT-123456-7"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Currency</label>
                  <select
                    value={companyForm.currency}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-220 rounded-xl font-bold text-slate-700 cursor-pointer outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="TSh">Tanzania Shilling (TSh — TZS)</option>
                    <option value="KSh">Kenya Shilling (KSh — KES)</option>
                    <option value="₦">Nigeria Naira (₦ — NGN)</option>
                    <option value="GH₵">Ghana Cedi (GH₵ — GHS)</option>
                    <option value="R">South Africa Rand (R — ZAR)</option>
                    <option value="$">US Dollar ($ — USD)</option>
                    <option value="€">Euro (€ — EUR)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Operating Time Zone</label>
                  <select
                    value={companyForm.timezone}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-220 rounded-xl font-bold text-slate-700 cursor-pointer outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="EAT">East Africa Time (UTC+3)</option>
                    <option value="WAT">West Africa Time (UTC+1)</option>
                    <option value="GMT">Greenwich Mean Time (UTC+0)</option>
                    <option value="SAST">South Africa Standard Time (UTC+2)</option>
                    <option value="EST">Eastern Standard Time (UTC-5)</option>
                  </select>
                </div>
              </div>

              {/* Logo Drag/Upload Section */}
              <div className="space-y-3">
                <span className="block text-[10px] uppercase font-bold text-slate-500 font-mono">Company Branding Logo</span>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4">
                  {companyForm.logo ? (
                    <div className={`rounded-xl bg-white flex items-center justify-center p-1.5 overflow-hidden shadow-xs flex-shrink-0 ${
                      hasNewLogoToSave ? 'border-2 border-emerald-500 w-[120px] h-[120px]' : 'border border-slate-200 w-20 h-20'
                    }`}>
                      <img 
                        src={companyForm.logo} 
                        alt="Company Logo" 
                        className="w-full h-full object-contain" 
                        style={{ maxWidth: '120px', maxHeight: '120px' }}
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-mono font-bold flex-shrink-0">
                      NO LOGO
                    </div>
                  )}

                  <div className="space-y-2 flex-grow">
                    <div className="relative cursor-pointer transition-all inline-block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, 'company')}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />
                      <button type="button" className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-220 rounded-xl text-xs font-bold text-slate-700 flex items-center space-x-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Custom Logo</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">Supported formats: JPG, PNG, WEBP. Maximum file size: 2MB.</p>

                    {hasNewLogoToSave && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handlePersistLogoToDb}
                          disabled={isLogoSaving}
                          className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all uppercase tracking-wider"
                        >
                          {isLogoSaving ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white animate-infinite" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>Inapakia...</span>
                            </>
                          ) : (
                            <span>Hifadhi Nembo / Save Logo</span>
                          )}
                        </button>
                      </div>
                    )}

                    {logoSaveStatus && (
                      <div className={`mt-2 p-2.5 rounded-xl text-[11px] font-mono leading-relaxed ${
                        logoSaveStatus.type === 'success' 
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                          : 'bg-red-50 border border-red-200 text-red-800'
                      }`}>
                        {logoSaveStatus.msg}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual System Themes toggle slider */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono">System Visual Theme Mode</h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans mt-0.5">
                    Select the fallback visual representation of the admin framework, point-of-sale menus, and operating dashboards.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyForm(prev => ({ ...prev, themeMode: 'light' }));
                      if (isDark) toggleTheme();
                    }}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all ${
                      companyForm.themeMode === 'light'
                        ? 'bg-white border-emerald-500 shadow-md scale-[1.01]'
                        : 'bg-slate-100/50 hover:bg-white border-slate-200'
                    }`}
                  >
                    <Sun className={`w-5 h-5 ${companyForm.themeMode === 'light' ? 'text-emerald-500 font-bold' : 'text-slate-400'}`} />
                    <span className="text-xs font-extrabold text-slate-800">Clear Light Presets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCompanyForm(prev => ({ ...prev, themeMode: 'dark' }));
                      if (!isDark) toggleTheme();
                    }}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all ${
                      companyForm.themeMode === 'dark'
                        ? 'bg-slate-900 border-indigo-500 shadow-md text-slate-100 scale-[1.01]'
                        : 'bg-slate-100/50 hover:bg-white border-slate-200'
                    }`}
                  >
                    <Moon className={`w-5 h-5 ${companyForm.themeMode === 'dark' ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-extrabold ${companyForm.themeMode === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Slate Dark Presets</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CORPORATE BUSINESS SETUP */}
          {activeSubTab === 'business' && (
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-6 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">💼 Corporate Business Setup</h3>
                <p className="text-xs text-slate-500 mt-1 font-sans">
                  Configure your business identity details, branding logos for light/daymode and darkmode, customized physical warehouses, and cashier till payment modes. This setup personalizes the entire Orvix, dashboard views, receipts, and invoices.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans">
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono">Business Brand Name</label>
                  <input
                    type="text"
                    value={businessForm.businessName}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, businessName: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="Enter business brand name..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono">Business Name Slug</label>
                  <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-1 focus-within:ring-emerald-500">
                    <input
                      type="text"
                      value={currentBusinessSlug}
                      disabled={isBusinessSlugLocked || isSlugSaving}
                      onChange={(e) => {
                        const slug = cleanBusinessSlug(e.target.value);
                        setBusinessForm(prev => ({
                          ...prev,
                          businessNameSlug: slug,
                          subdomainSlug: slug,
                          primaryDomain: slug ? `${slug}.${baseDomain}` : '',
                          domainStatus: 'draft'
                        }));
                        setSlugSaveStatus(null);
                      }}
                      className={`min-w-0 flex-1 px-4 py-2.5 bg-transparent font-semibold text-slate-700 outline-none ${isBusinessSlugLocked ? 'cursor-not-allowed text-slate-400' : ''}`}
                      placeholder="lim"
                    />
                    <span className="shrink-0 border-l border-slate-200 px-3 py-2.5 text-[11px] font-black text-slate-400">.{baseDomain}</span>
                  </div>
                  <p className="text-[10px] font-medium leading-relaxed text-slate-500">
                    This will be your domain name. Example: <span className="font-black text-slate-700">lim.{baseDomain}</span>. Once saved, it cannot be changed.
                  </p>
                  {currentBusinessDomain && (
                    <p className="text-[10px] font-black text-emerald-600">
                      {isBusinessSlugLocked ? 'Locked domain' : 'Pending save'}: {currentBusinessDomain}
                    </p>
                  )}
                  {slugSaveStatus && (
                    <p className={`text-[10px] font-bold ${
                      slugSaveStatus.type === 'error' ? 'text-red-600' : slugSaveStatus.type === 'success' ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {slugSaveStatus.msg}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono">Phone Number.</label>
                  <input
                    type="text"
                    value={businessForm.businessPhone}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, businessPhone: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="Shown on receipts and invoices..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono">Operating Floor Address</label>
                  <input
                    type="text"
                    value={businessForm.businessAddress}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, businessAddress: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="Branch address..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono">Business Email Address</label>
                  <input
                    type="email"
                    value={businessForm.businessEmail || ''}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, businessEmail: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="E.g. contact@business.com..."
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono">Invoice Footer Tagline</label>
                  <textarea
                    value={businessForm.tagline || ''}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, tagline: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                    placeholder="Payment note..."
                  />
                </div>
              </div>

              {/* Daymode & Darkmode Logo uploads split */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono tracking-wider">🎨 Custom System Branding Logos</h4>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 font-sans leading-relaxed">
                    Upload light and dark logos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Sun (Day mode) Logo Card */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <span className="text-[10px] font-mono font-black uppercase text-slate-500 flex items-center space-x-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-500 select-none shrink-0" />
                      <span>Light Theme Logo</span>
                    </span>

                    <div className="flex items-center gap-4">
                      {businessForm.businessLogoLight ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-220 flex-shrink-0 flex items-center justify-center p-1 shadow-sm">
                          <img src={businessForm.businessLogoLight} alt="Daymode Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : businessForm.businessLogo ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-220 flex-shrink-0 flex items-center justify-center p-1 shadow-sm">
                          <img src={businessForm.businessLogo} alt="Daymode Fallback" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-mono font-bold flex-shrink-0">
                          GENERIC
                        </div>
                      )}

                      <div className="space-y-1.5 flex-grow">
                        <div className="relative cursor-pointer transition-all inline-block">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoUpload(e, 'business_light')}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <button type="button" className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-220 rounded-xl text-xs font-bold text-slate-700 flex items-center space-x-1.5 shadow-xs cursor-pointer">
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>Upload Day Logo</span>
                          </button>
                        </div>
                        <p className="text-[9.5px] text-slate-400">Light logo.</p>
                      </div>
                    </div>
                  </div>

                  {/* Moon (Dark mode) Logo Card */}
                  <div className="p-4 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl space-y-3">
                    <span className="text-[10px] font-mono font-black uppercase text-slate-400 flex items-center space-x-1.5">
                      <Moon className="w-3.5 h-3.5 text-indigo-400 select-none shrink-0" />
                      <span>Dark Theme Logo</span>
                    </span>

                    <div className="flex items-center gap-4">
                      {businessForm.businessLogoDark ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-850 flex-shrink-0 flex items-center justify-center p-1 shadow-sm">
                          <img src={businessForm.businessLogoDark} alt="Darkmode Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-500 text-[10px] font-mono font-bold flex-shrink-0">
                          GENERIC
                        </div>
                      )}

                      <div className="space-y-1.5 flex-grow">
                        <div className="relative cursor-pointer transition-all inline-block">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoUpload(e, 'business_dark')}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <button type="button" className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-705 rounded-xl text-xs font-bold text-slate-200 flex items-center space-x-1.5 shadow-xs cursor-pointer">
                            <Upload className="w-3.5 h-3.5 text-slate-400" />
                            <span>Upload Dark Logo</span>
                          </button>
                        </div>
                        <p className="text-[9.5px] text-slate-500">Dark logo.</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* POS Display Settings */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-slate-500" />
                    <span>POS Settings</span>
                  </h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans mt-0.5">
                    Choose how products appear on the sales screen.
                  </p>
                </div>

                <label className="flex items-center justify-between gap-4 bg-white border border-slate-220 rounded-2xl p-4 cursor-pointer">
                  <div className="min-w-0">
                    <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">Show product pictures in POS</span>
                    <span className="block text-[10.5px] text-slate-500 mt-0.5">
                      Turn off to show a clean product list without images.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={posSettingsForm.showProductImages}
                    onChange={(e) => setPosSettingsForm(prev => ({ ...prev, showProductImages: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                  />
                </label>
              </div>

              {/* Payment modes register */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <span>Payment Methods</span>
                  </h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans mt-0.5">
                    Add payment methods.
                  </p>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="flex flex-wrap gap-2">
                    {(businessForm.paymentModes || []).map(mode => {
                      const modeName = getPaymentModeName(mode);
                      return (
                      <span 
                        key={modeName} 
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-220 rounded-xl text-xs font-bold text-slate-700 select-none shadow-xs"
                      >
                        <span>{modeName}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemovePaymentMode(modeName)}
                          className="hover:text-rose-600 cursor-pointer p-0.5"
                          title="Click to remove"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-600" />
                        </button>
                      </span>
                      );
                    })}
                  </div>

                  <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm">
                    <input
                      type="text"
                      value={newPaymentMode}
                      onChange={(e) => setNewPaymentMode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPaymentMode()}
                      placeholder="Add custom method (e.g., Yas, Paypal)..."
                      className="flex-1 px-3.5 py-1.5 text-xs outline-none bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleAddPaymentMode}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors mt-6">
                  <div className="mb-4">
                    <h4 className="font-extrabold text-xs text-slate-700 tracking-tight flex items-center space-x-1.5 uppercase font-mono">
                      <Truck className="w-4 h-4 text-slate-500" />
                      <span>Delivery Payment Methods</span>
                    </h4>
                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans mt-0.5">
                      Add delivery payment methods.
                    </p>
                  </div>

                  <div className="space-y-3 font-sans">
                    <div className="flex flex-wrap gap-2">
                      {(businessForm.deliveryPaymentModes || []).map(mode => (
                        <span 
                          key={mode} 
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-220 rounded-xl text-xs font-bold text-slate-700 select-none shadow-xs"
                        >
                          <span>{mode}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveDeliveryPaymentMode(mode)}
                            className="hover:text-rose-600 cursor-pointer p-0.5"
                            title="Click to remove"
                          >
                            <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-600" />
                          </button>
                        </span>
                      ))}
                      {(businessForm.deliveryPaymentModes || []).length === 0 && (
                        <span className="text-[10px] text-slate-400 font-mono italic">No delivery payment methods. Pos default will be applied.</span>
                      )}
                    </div>
                    {true && (
                      <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm mt-3">
                        <input 
                          type="text" 
                          value={newDeliveryPaymentMode}
                          onChange={(e) => setNewDeliveryPaymentMode(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDeliveryPaymentMode())}
                          placeholder="e.g. Cash, Bank Transfer, Mobile Money" 
                          className="flex-1 px-3.5 py-1.5 text-xs outline-none bg-transparent"
                        />
                        <button 
                          type="button" 
                          onClick={handleAddDeliveryPaymentMode}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stores Register */}
              {SHOW_LEGACY_STORE_LOCATIONS && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono flex items-center space-x-2">
                    <Store className="w-4 h-4 text-slate-500" />
                    <span>Store Locations</span>
                  </h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans mt-0.5">
                    Register distinct physical bins or storages where bulk cargo or in-shelf products can be allocated.
                  </p>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="flex flex-wrap gap-2">
                    {(businessForm.registeredStores || []).map(store => (
                      <span 
                        key={store} 
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-220 rounded-xl text-xs font-bold text-slate-700 select-none shadow-xs"
                      >
                        <Building className="w-3 h-3 text-slate-400 mr-1" />
                        <span>{store}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveStore(store)}
                          className="hover:text-rose-600 cursor-pointer p-0.5"
                          title="De-register store storage bin"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-600" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm">
                    <input
                      type="text"
                      value={newStoreName}
                      onChange={(e) => {
                        setNewStoreName(e.target.value);
                        if (storeLimitMessage) setStoreLimitMessage(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddStore()}
                      placeholder="e.g. Backroom Freezer, Main Store..."
                      className="flex-1 px-3.5 py-1.5 text-xs outline-none bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleAddStore}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {storeLimitMessage === 'ruby-multiple-stores' && (
                    <p className="max-w-sm text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      Sorry, this feature is not available in your current package. Upgrade to{' '}
                      <button
                        type="button"
                        onClick={() => openStoreUpgrade('diamond')}
                        className="font-bold underline underline-offset-2 hover:text-amber-900"
                      >
                        Diamond
                      </button>
                      {' '}or{' '}
                      <button
                        type="button"
                        onClick={() => openStoreUpgrade('tanzanite')}
                        className="font-bold underline underline-offset-2 hover:text-amber-900"
                      >
                        Tanzanite
                      </button>
                      {' '}to unlock multiple store locations.
                    </p>
                  )}

                  {/* Plan limit badge */}
                  {subscriptionStatus?.plan && (
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(businessForm.registeredStores || []).length} / {subscriptionStatus.plan.maxStores >= 999 ? 'Unlimited' : subscriptionStatus.plan.maxStores} branch{subscriptionStatus.plan.maxStores !== 1 ? 'es' : ''} — {subscriptionStatus.plan.name} plan
                    </p>
                  )}

                  {/* Per-branch branding logos — Tanzanite feature */}
                  {(businessForm.registeredStores || []).length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-slate-100 mt-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider pt-2">Branch Logos</p>
                      <p className="text-[10px] text-slate-400">Each branch can have its own logo on invoices, delivery notes, and receipts.</p>
                      {(businessForm.registeredStores || []).map(store => {
                        const bb = (businessForm.branchBranding || {})[store] || {};
                        const isOpen = selectedBranchForLogo === store;
                        return (
                          <div key={store} className="border border-slate-200 rounded-xl overflow-hidden">
                            <button type="button"
                              onClick={() => setSelectedBranchForLogo(isOpen ? null : store)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border-none text-left">
                              <div className="flex items-center gap-2">
                                {(bb.businessLogoLight || bb.businessLogo) ? (
                                  <img src={bb.businessLogoLight || bb.businessLogo} alt={store} className="w-5 h-5 rounded object-contain border border-slate-200" />
                                ) : (
                                  <div className="w-5 h-5 rounded bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500">{store[0]?.toUpperCase()}</div>
                                )}
                                <span className="text-xs font-bold text-slate-700">{store}</span>
                                {(bb.businessLogoLight || bb.businessLogo) && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ Logo</span>}
                              </div>
                              <span className="text-[10px] text-slate-400">{isOpen ? '▲' : '▼'}</span>
                            </button>
                            {isOpen && (
                              <div className="px-3 py-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-bold text-slate-500">Light / Document</p>
                                  <div className="w-16 h-10 rounded-lg border-2 border-dashed border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                                    {(bb.businessLogoLight || bb.businessLogo)
                                      ? <img src={bb.businessLogoLight || bb.businessLogo} className="w-full h-full object-contain p-0.5" alt="" />
                                      : <span className="text-[8px] text-slate-400">None</span>}
                                  </div>
                                  <label className="inline-block px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-indigo-700">
                                    Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => handleBranchLogoUpload(e, store, 'light')} />
                                  </label>
                                  {(bb.businessLogoLight || bb.businessLogo) && (
                                    <button type="button" onClick={() => handleBranchLogoRemove(store, 'light')} className="ml-1 text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer border-none bg-transparent">Remove</button>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-bold text-slate-500">Dark Mode</p>
                                  <div className="w-16 h-10 rounded-lg border-2 border-dashed border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden">
                                    {bb.businessLogoDark
                                      ? <img src={bb.businessLogoDark} className="w-full h-full object-contain p-0.5" alt="" />
                                      : <span className="text-[8px] text-slate-500">None</span>}
                                  </div>
                                  <label className="inline-block px-2.5 py-1 bg-slate-700 text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-slate-600">
                                    Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => handleBranchLogoUpload(e, store, 'dark')} />
                                  </label>
                                  {bb.businessLogoDark && (
                                    <button type="button" onClick={() => handleBranchLogoRemove(store, 'dark')} className="ml-1 text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer border-none bg-transparent">Remove</button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              )}

            </div>
          )}

          {/* TAB 3: PRODUCT & STORE SETTINGS */}
          {activeSubTab === 'product-store' && (
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-6 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">📦 Product Catalog & Measurements</h3>
                <p className="text-xs text-slate-500 mt-1 font-sans">
                  Add categories and units.
                </p>
              </div>

              {/* Product categories */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-slate-500" />
                    <span>Active Product Categories</span>
                  </h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans mt-0.5">
                    Define tags to organize drugs, foodstuffs, or retail units inside catalog browsers.
                  </p>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="flex flex-wrap gap-2">
                    {productForm.categories.map(cat => (
                      <span 
                        key={cat} 
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-220 rounded-xl text-xs font-bold text-slate-700 select-none shadow-xs"
                      >
                        <span>{cat}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveCategory(cat)}
                          className="hover:text-rose-600 cursor-pointer p-0.5"
                          title="Delete category"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-600" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      placeholder="Add category (e.g. Cosmetics, Bakery)..."
                      className="flex-1 px-3.5 py-1.5 text-xs outline-none bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Product measurement units */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono flex items-center space-x-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>Units of Measure</span>
                  </h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans mt-0.5">
                    Define authorized weighing or counting metrics by which checkout lines and stock takes operate.
                  </p>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="flex flex-wrap gap-2">
                    {productForm.units.map(unit => (
                      <span 
                        key={unit} 
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-225 rounded-lg text-xs font-mono font-bold text-slate-700 select-none shadow-xs uppercase"
                      >
                        <span>{unit}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveUnit(unit)}
                          className="hover:text-rose-600 cursor-pointer p-0.5 ml-1"
                          title="Delete unit measurement"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-slate-400 hover:text-rose-600" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm">
                    <input
                      type="text"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
                      placeholder="Add UOM (e.g. kg, litres, pcs, box)..."
                      className="flex-1 px-3.5 py-1.5 text-xs outline-none bg-transparent font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddUnit}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB: INVOICE & BRANDING CUSTOMIZATION */}
          {activeSubTab === 'invoice-settings' && (
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-6 shadow-sm font-sans text-slate-800">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">🎨 Invoice Settings</h3>
                <p className="text-xs text-slate-500 mt-1 font-sans">
                  Customize colors, compliance credentials, bank details, and terms displayed on Quotes and Quotes to align with your brand guidelines.
                </p>
              </div>

              {/* Brand color selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono">1. Brand Highlights Color</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans mt-0.5">
                    Select the dominant theme color that will styled the borders, table headers, and visual emphasis of your printed documents.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  {[
                    { name: 'Sky Blue', hex: '#0284c7' },
                    { name: 'Indigo Blue', hex: '#1e3a8a' },
                    { name: 'Teal Green', hex: '#0d9488' },
                    { name: 'Emerald', hex: '#16a34a' },
                    { name: 'Royal Purple', hex: '#6d28d9' },
                    { name: 'Crimson', hex: '#dc2626' },
                    { name: 'Slate Gray', hex: '#334155' },
                    { name: 'Charcoal Black', hex: '#0f172a' }
                  ].map(color => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setInvoiceSettingsForm(prev => ({ ...prev, invoiceColor: color.hex }))}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                        invoiceSettingsForm.invoiceColor === color.hex
                          ? 'bg-white border-slate-900 shadow-sm font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </div>

                {/* Custom HEX code input */}
                <div className="max-w-xs space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono">Custom Color Hex Code</span>
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded-xl border border-slate-200"
                      style={{ backgroundColor: invoiceSettingsForm.invoiceColor }}
                    />
                    <input
                      type="text"
                      placeholder="#0284c7"
                      value={invoiceSettingsForm.invoiceColor}
                      onChange={(e) => setInvoiceSettingsForm(prev => ({ ...prev, invoiceColor: e.target.value }))}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white font-mono text-xs text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Tax & Banking Compliance Credentials */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-700 font-mono">2. Bank Details & Compliance Credentials</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono mb-1">Tax ID (TIN)</label>
                    <input
                      type="text"
                      placeholder="e.g. 140-763-403"
                      value={invoiceSettingsForm.tin || ''}
                      onChange={(e) => setInvoiceSettingsForm(prev => ({ ...prev, tin: e.target.value }))}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-slate-500 font-mono font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono mb-1">Authorized Person Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={invoiceSettingsForm.authorisedPerson || ''}
                      onChange={(e) => setInvoiceSettingsForm(prev => ({ ...prev, authorisedPerson: e.target.value }))}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-slate-500 font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono mb-1">Corporate Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. NMB Bank or CRDB Bank"
                      value={invoiceSettingsForm.bankName || ''}
                      onChange={(e) => setInvoiceSettingsForm(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-slate-500 font-medium outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono mb-1">Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 23710039969"
                      value={invoiceSettingsForm.accountNumber || ''}
                      onChange={(e) => setInvoiceSettingsForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-slate-500 font-mono font-medium outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-455 font-mono mb-1">Bank Account Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Doe Company"
                      value={invoiceSettingsForm.accountName || ''}
                      onChange={(e) => setInvoiceSettingsForm(prev => ({ ...prev, accountName: e.target.value }))}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-slate-500 font-medium outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* VAT Default Setting */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-700 font-mono">3. VAT Configuration Options</h4>
                <div className="flex items-start sm:items-center space-x-3 text-xs">
                  <input
                    type="checkbox"
                    id="hasVatByDefaultCheck"
                    checked={!!invoiceSettingsForm.hasVatByDefault}
                    onChange={(e) => setInvoiceSettingsForm(prev => ({ ...prev, hasVatByDefault: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="hasVatByDefaultCheck" className="font-semibold text-slate-700 cursor-pointer select-none">
                    Include Value Added Tax (VAT 18%) by default on every new Quote or Quote
                  </label>
                </div>
              </div>

              {/* Terms & Conditions List */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-700 font-mono">4. Default Legal Terms & Conditions</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Define policies, warrant declarations or client legal rules printed on the bottom of price quotes & price quote invoices.
                  </p>
                </div>

                <div className="space-y-2">
                  {(invoiceSettingsForm.termsAndConditions || []).map((term, index) => (
                    <div key={index} className="flex items-start sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="font-sans font-medium leading-relaxed">{term}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const list = [...(invoiceSettingsForm.termsAndConditions || [])];
                          list.splice(index, 1);
                          setInvoiceSettingsForm(prev => ({ ...prev, termsAndConditions: list }));
                        }}
                        className="text-red-500 hover:text-red-700 font-bold px-2 py-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 max-w-xl">
                    <input
                      type="text"
                      placeholder="Add a new term..."
                      id="newTermBodyInput"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            setInvoiceSettingsForm(prev => ({
                              ...prev,
                              termsAndConditions: [...(prev.termsAndConditions || []), val]
                            }));
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                      className="flex-1 px-3.5 py-1.5 text-xs outline-none bg-white border border-slate-200 rounded-xl font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('newTermBodyInput') as HTMLInputElement;
                        const val = el?.value.trim() || '';
                        if (val) {
                          setInvoiceSettingsForm(prev => ({
                            ...prev,
                            termsAndConditions: [...(prev.termsAndConditions || []), val]
                          }));
                          el.value = '';
                        }
                      }}
                      className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs uppercase rounded-xl cursor-pointer"
                    >
                      Append
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: CUSTOM ROLES MANAGEMENT */}
          {activeSubTab === 'roles' && customRolesList.length === 0 && (
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-6 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">🛡️ System Security Roles & Permissions</h3>
                <p className="text-xs text-slate-455 mt-1 font-sans">
                  Construct fine-grain security roles for your floor {activeTenant.businessType === 'restaurant' ? 'waiters' : 'sellers'}, cashiers, and managers. Assign permissions checkmark-by-checkmark to restrict access to secret revenues, cost of goods (Cost of Goods), or system setup.
                </p>
              </div>
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-4">
                <p className="text-sm font-black text-slate-700">No roles created yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Create your first role and choose exactly which permissions it has. You'll need at least one role before you can register staff.
                </p>
                <div className="max-w-xs mx-auto space-y-2 text-xs pt-2">
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Cashier"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewRole}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Role</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeSubTab === 'roles' && customRolesList.length > 0 && (() => {
            const activeRole = customRolesList.find(r => r.id === selectedRoleId) || customRolesList[0];
            const activePlanId = String(subscriptionStatus?.state?.planId || subscriptionStatus?.plan?.packageId || subscriptionStatus?.plan?.name || '').toLowerCase();
            const isTanzanitePlan = activePlanId === 'tanzanite';

            const modulesList = [
              // Category: Sales & Cashier Till
              { key: 'pos', category: 'Sales & Cashier Till', name: 'Pharmacist & Register POS Tills', desc: 'Authorizes register transactions, checking custom sales, and printing patient bills' },
              { key: 'salesList', category: 'Sales & Cashier Till', name: 'Sales Histories & Order Registers', desc: 'Allows looking up historical transactions, re-printing old bills, and finding order records' },
              { key: 'deleteSale', category: 'Sales & Cashier Till', name: 'Delete Sale Menu (Ticket Voiding)', desc: 'Enables delete menu button to void paid sales or delete incorrect cash ticket records' },
              { key: 'salesReturn', category: 'Sales & Cashier Till', name: 'Receipt Returns & Customer Refunds', desc: 'Allows entering product sales returns, credit adjustments, and refunding store cash' },
              { key: 'paymentIn', category: 'Sales & Cashier Till', name: 'Debt Payments & Installments (Pay-In)', desc: 'Authorizes accepting payments towards pending buyer invoices or active store credits' },
              { key: 'price quote', category: 'Sales & Cashier Till', name: 'Quotes & Quotes', desc: 'Allows issuing price quotes and price quote invoices' },
              { key: 'customersList', category: 'Sales & Cashier Till', name: 'Customers Profiles & Balance Ledgers', desc: 'Allows managing buyer contact listings, credit allocation thresholds, and histories' },

              // Category: Inventory & Buying
              { key: 'products', category: 'Inventory & Buying', name: 'Product Catalog & Inventory Listing', desc: 'Authorize editing base product fields, barcodes, pricing, and viewing current stock items' },
              { key: 'productCategories', category: 'Inventory & Buying', name: 'Classifications, Categories & Brands', desc: 'Authorizes managing item folders, generic grouping tags, brands, and units of measure' },
              { key: 'units', category: 'Inventory & Buying', name: 'Product Units of Measure', desc: 'Authorizes adding and editing units used for stock counting' },
              { key: 'brands', category: 'Inventory & Buying', name: 'Product Brands Database', desc: 'Manages catalog item brands' },
              { key: 'stockAdjustment', category: 'Inventory & Buying', name: 'Inventory Level Audits & Adjustments', desc: 'Grants access to manual stock level overrides, warehouse counts, and shelf transfers' },
              { key: 'stockTransfer', category: 'Inventory & Buying', name: 'Warehouse & Shelf Transfers', desc: 'Transfer physical inventory between virtual branches or backrooms' },
              { key: 'purchases', category: 'Inventory & Buying', name: 'Supplier Purchases & Cost of Goods Ledgers', desc: 'Allows entering wholesale stock purchases, vendor costs (Cost of Goods), and purchase bills' },
              { key: 'purchaseReturn', category: 'Inventory & Buying', name: 'Purchase Return to Vendors', desc: 'Handling damaged or defect purchases returned to the supplier' },
              { key: 'suppliers', category: 'Inventory & Buying', name: 'Suppliers Profiles & Vendor Credit Lines', desc: 'Allows managing wholesale vendor directories, contact cards, and trade debt records' },

              // Category: Finance & Accounting Reports
              { key: 'expenses', category: 'Finance & Accounting', name: 'Operating Expenses Records', desc: 'Allows logging rent costs, store licensing, salaries, and operating branch payouts' },
              { key: 'expenseCategories', category: 'Finance & Accounting', name: 'Expense Category Chart', desc: 'Allows customization of the chart of ledger expense categories' },
              { key: 'paymentOut', category: 'Finance & Accounting', name: 'Supplier Bill Payments (Pay-Out)', desc: 'Authorizes outgoing cash to suppliers or cost contractors' },
              { key: 'cashAndBank', category: 'Finance & Accounting', name: 'Cash Register Float & Vault Safes', desc: 'Allows checking register drawer floats, cash safety vaults, and branch bank balances' },
              { key: 'reportsSalesExpenses', category: 'Finance & Accounting', name: 'General Sales & Expense Reports', desc: 'Access overall profit-and-loss, cash flow performance metrics' },
              { key: 'reportsProfitCogs', category: 'Finance & Accounting', name: 'Cost of Goods & Profit Audits', desc: 'Detailed view to product margins, net profit after cost of goods calculations' },

              // Category: Office & Operations Systems
              { key: 'staffMembers', category: 'Office & Operations Systems', name: 'Staff HR & Cashier Users', desc: 'Grants access to employeer credentials setup and pin resets' },
              { key: 'rolePermissions', category: 'Office & Operations Systems', name: 'Security Permissions Control', desc: 'Control customized role access rights' },
              { key: 'storesBranch', category: 'Office & Operations Systems', name: 'Corporate Branch & Warehouse Settings', desc: 'Authorizes creating physical outlet locations, managing warehouse keys, and layout settings' },
              { key: 'sync', category: 'Office & Operations Systems', name: 'Local Sync & System Connectivity Hub', desc: 'Allows checking network sync queues, local state backups, and clearing caches' },
              { key: 'settings', category: 'Office & Operations Systems', name: 'Branding, Layout, Taxes & VAT Options', desc: 'Allows uploading branch logos, whitelabel options, receipt headings, and tax attributes' },
              { key: 'companySettings', category: 'Office & Operations Systems', name: 'Company Identity Profile', desc: 'Update enterprise registration and entity profiles' },
              { key: 'taxes', category: 'Office & Operations Systems', name: 'Tax Compliance & VAT Codes', desc: 'Define tax margins, VAT configurations, and exempt rules' },
            ];

            return (
              <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 sm:p-6 space-y-6 shadow-sm">
                
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">🛡️ System Security Roles & Permissions</h3>
                  <p className="text-xs text-slate-455 mt-1 font-sans">
                    Construct fine-grain security roles for your floor {activeTenant.businessType === 'restaurant' ? 'waiters' : 'sellers'}, cashiers, and managers. Assign permissions checkmark-by-checkmark to restrict access to secret revenues, cost of goods (Cost of Goods), or system setup.
                  </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 xl:gap-6 font-sans">
                  
                  {/* Left Column: Roles list and Addition box */}
                  <div className="xl:col-span-1 space-y-4">
                    <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                      <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Created Staff Roles</span>
                      
                      <div className="settings-role-list flex xl:block gap-2 overflow-x-auto xl:overflow-y-auto xl:max-h-[320px] xl:space-y-1.5 xl:pr-1 pb-1">
                        {customRolesList.map(r => {
                          const isSel = r.id === selectedRoleId;
                          return (
                            <div
                              key={r.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedRoleId(r.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedRoleId(r.id);
                                }
                              }}
                              className={`settings-role-card min-w-[190px] xl:min-w-0 xl:w-full p-3 rounded-xl flex items-center justify-between text-left transition-all text-xs cursor-pointer ${
                                isSel
                                  ? 'bg-emerald-600 text-white font-extrabold shadow-sm border border-transparent'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <Lock className={`w-3.5 h-3.5 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                                <div className="min-w-0">
                                  <p className="font-bold truncate">{r.name}</p>
                                  <p className={`text-[9.5px] font-normal leading-relaxed ${isSel ? 'text-emerald-100' : 'text-slate-400'}`}>
                                    Custom role
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRole(r.id);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isSel
                                    ? 'text-emerald-100 hover:text-white hover:bg-emerald-700'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title="Delete Role"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Create dynamic role input form */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <span className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Create Private Role</span>
                      <div className="space-y-2 text-xs">
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="e.g. Sales Assistant"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleCreateNewRole}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95 shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Instantiate Brand Role</span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Active Role settings with fine permission checkboxes */}
                  <div className="xl:col-span-2 space-y-4 col-span-1">
                    <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4 shadow-xs">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-emerald-600 font-bold">Current Setup</span>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={activeRole.name}
                              onChange={(e) => handleRenameRole(activeRole.id, e.target.value)}
                              className="text-sm font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[9.5px] bg-slate-100 text-slate-500 font-mono font-black border border-slate-200 px-1.5 py-0.5 rounded">CUSTOM</span>
                          </div>
                        </div>
                      </div>

                      {isTanzanitePlan && (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-indigo-900">Access all branches</p>
                            <p className="text-[11px] text-indigo-600 mt-0.5">Staff assigned this role can switch between every branch, not just the one they were registered under.</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={activeRole.canAccessAllBranches !== false}
                            onClick={() => handleToggleBranchAccess(activeRole.id)}
                            className={`relative shrink-0 w-11 h-6 rounded-full border-none cursor-pointer transition-colors ${activeRole.canAccessAllBranches !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${activeRole.canAccessAllBranches !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      )}

                      <div className="hidden xl:block overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">
                              <th className="p-3">Feature</th>
                              <th className="p-3 text-center">Read</th>
                              <th className="p-3 text-center">Write</th>
                              <th className="p-3 text-center">Edit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans font-medium text-slate-700">
                            {(() => {
                              let lastCategory = '';
                              return modulesList.map(mod => {
                                const showCategoryHeader = mod.category !== lastCategory;
                                lastCategory = mod.category || '';
                                const permissions = (activeRole.permissions as any)[mod.key] || { read: false, write: false, edit: false };
                                return (
                                  <React.Fragment key={mod.key}>
                                    {showCategoryHeader && (
                                      <tr className="bg-slate-50 border-y border-slate-200">
                                        <td colSpan={4} className="p-3 bg-slate-100/60 uppercase font-mono text-[10px] font-black text-slate-500 tracking-wider">
                                          📁 {mod.category || 'Core Permissions'}
                                        </td>
                                      </tr>
                                    )}
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 space-y-0.5 max-w-[240px]">
                                        <p className="font-bold text-slate-800">{mod.name}</p>
                                        <p className="text-[10px] text-slate-400 leading-normal font-normal">{mod.desc}</p>
                                      </td>
                                      
                                      <td className="p-3 text-center">
                                        <input
                                          type="checkbox"
                                          id={`perm-${activeRole.id}-${mod.key}-read`}
                                          checked={permissions.read}
                                          onChange={() => handleTogglePermission(activeRole.id, mod.key, 'read')}
                                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300"
                                        />
                                      </td>
                                      
                                      <td className="p-3 text-center">
                                        <input
                                          type="checkbox"
                                          id={`perm-${activeRole.id}-${mod.key}-write`}
                                          checked={permissions.write}
                                          onChange={() => handleTogglePermission(activeRole.id, mod.key, 'write')}
                                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300"
                                        />
                                      </td>
                                      
                                      <td className="p-3 text-center">
                                        <input
                                          type="checkbox"
                                          id={`perm-${activeRole.id}-${mod.key}-edit`}
                                          checked={permissions.edit}
                                          onChange={() => handleTogglePermission(activeRole.id, mod.key, 'edit')}
                                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300"
                                        />
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <div className="xl:hidden space-y-3">
                        {(() => {
                          let lastCategory = '';
                          return modulesList.map(mod => {
                            const showCategoryHeader = mod.category !== lastCategory;
                            lastCategory = mod.category || '';
                            const permissions = (activeRole.permissions as any)[mod.key] || { read: false, write: false, edit: false };
                            return (
                              <React.Fragment key={mod.key}>
                                {showCategoryHeader && (
                                  <div className="pt-2 first:pt-0">
                                    <div className="px-3 py-2 bg-slate-100 rounded-xl uppercase font-mono text-[10px] font-black text-slate-500 tracking-wider">
                                      {mod.category || 'Core Permissions'}
                                    </div>
                                  </div>
                                )}
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <div>
                                    <p className="font-black text-slate-900 text-sm leading-snug">{mod.name}</p>
                                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{mod.desc}</p>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 mt-4">
                                    {(['read', 'write', 'edit'] as const).map(permissionType => (
                                      <label
                                        key={permissionType}
                                        className={`min-h-[52px] rounded-2xl border flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wide ${
                                          permissions[permissionType]
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                            : 'bg-white border-slate-200 text-slate-500'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={permissions[permissionType]}
                                          onChange={() => handleTogglePermission(activeRole.id, mod.key, permissionType)}
                                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300"
                                        />
                                        <span>{permissionType}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            );
          })()}

          {/* TAB 6: NOTIFICATIONS & AUTO REPORTS */}
          {activeSubTab === 'notifications' && (
             (() => {
               const notificationModule = activeTenant.businessType === 'pharmacy'
                 ? { name: 'pharmacy', label: 'Pharmacy' }
                 : { name: 'wholesale-retail', label: 'Wholesale & Retail' };

               return (
                 <DashboardNotificationsSettings
                   tenantId={activeTenant.id}
                   moduleName={notificationModule.name}
                   moduleLabel={notificationModule.label}
                   persistedSettings={(systemSettings.notificationModuleSettings || []).find(
                     setting => setting.tenantId === activeTenant.id
                       && setting.moduleName === notificationModule.name
                   )}
                   onPersistSettings={(updatedNotificationSettings) => {
                     const remaining = (systemSettings.notificationModuleSettings || []).filter(
                       setting => !(setting.tenantId === activeTenant.id
                         && setting.moduleName === notificationModule.name)
                     );
                     return onSaveSettings(buildSettingsSnapshot({
                       notificationModuleSettings: [updatedNotificationSettings, ...remaining],
                     }));
                   }}
                 />
               );
             })()
          )}

          {activeSubTab === 'branches' && (
            <React.Suspense fallback={(
              <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="h-8 w-44 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="mt-6 h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
              </div>
            )}>
              <DashboardBranchesSettings activeTenant={activeTenant} onTriggerUpgrade={onTriggerUpgrade} />
            </React.Suspense>
          )}

        </div>
      </div>

      {/* MODAL: STAFF PERFORMANCE REPORT */}
      {viewingStaffReport && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-sans animate-scale-in max-h-[92vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">{viewingStaffReport.name}'s Report</h3>
                  <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">{viewingStaffReport.role}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStaffReport(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {(() => {
                const staffSales = sales?.filter(s => s.staffName === viewingStaffReport.name) || [];
                const staffExpenses = expenses?.filter(e => e.staffName === viewingStaffReport.name) || [];
                
                const numSales = staffSales.length;
                const totalSalesAmount = staffSales.reduce((sum, s) => sum + s.total, 0);
                
                const numExpenses = staffExpenses.length;
                const totalExpensesAmount = staffExpenses.reduce((sum, e) => sum + e.amount, 0);
                
                const profitLoss = totalSalesAmount - totalExpensesAmount;

                // Handle riders/drivers specifically
                const isRider = viewingStaffReport.role.toLowerCase().includes('rider') || viewingStaffReport.role.toLowerCase().includes('driver') || viewingStaffReport.role.toLowerCase().includes('delivery');
                const staffDeliveries = deliveries?.filter(d => d.riderId === viewingStaffReport.id || d.riderDetails?.name === viewingStaffReport.name) || [];
                const numDeliveries = staffDeliveries.length;
                const totalDeliveryIncome = staffDeliveries.reduce((sum, d) => sum + (d.deliveryCost || 0), 0);

                return (
                  <div className="space-y-6">
                    {/* General Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      {isRider ? (
                        <>
                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
                            <span className="block text-[10px] font-mono uppercase font-bold text-indigo-500 mb-1">Total Deliveries</span>
                            <span className="text-2xl font-black text-indigo-900">{numDeliveries}</span>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                            <span className="block text-[10px] font-mono uppercase font-bold text-emerald-600 mb-1">Delivery Income</span>
                            <span className="text-xl font-black font-mono text-emerald-900">{activeTenant.currency}{totalDeliveryIncome.toLocaleString()}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                            <span className="block text-[10px] font-mono uppercase font-bold text-emerald-600 mb-1">Total Sales ({numSales})</span>
                            <span className="text-xl font-black font-mono text-emerald-900">{activeTenant.currency}{totalSalesAmount.toLocaleString()}</span>
                          </div>
                          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
                            <span className="block text-[10px] font-mono uppercase font-bold text-rose-600 mb-1">Total Expenses ({numExpenses})</span>
                            <span className="text-xl font-black font-mono text-rose-900">{activeTenant.currency}{totalExpensesAmount.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {!isRider && (
                      <div className={`rounded-xl p-5 border ${profitLoss >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} flex items-center justify-between`}>
                        <div className="space-y-1">
                          <span className={`block text-[10px] font-mono uppercase font-black ${profitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'} tracking-wider`}>
                            Calculated Net Result
                          </span>
                          <span className={`text-2xl font-black font-mono ${profitLoss >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                            {profitLoss >= 0 ? '+' : ''}{activeTenant.currency}{profitLoss.toLocaleString()}
                          </span>
                        </div>
                        <div className={`p-3 rounded-full ${profitLoss >= 0 ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>
                          <DollarSign className="w-6 h-6" />
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-medium">
                        This report calculates metrics strictly linked to actions explicitly logged by <strong className="text-slate-800">{viewingStaffReport.name}</strong> under their profile context. 
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingStaffReport(null)}
                className="px-6 py-2 bg-slate-800 text-white font-bold text-xs uppercase rounded-xl hover:bg-slate-900 transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
