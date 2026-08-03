import React, { useState, useEffect, useRef } from 'react';
import PWAInstallBanner from './PWAInstallBanner';
import { requestManualInstallPrompt } from '../utils/pwaInstallPrompt';
import { useTranslation } from '../LanguageContext';
import { useTenantLogo } from '../TenantLogoContext';
import { useJasperNotifications } from '../JasperNotificationContext';
import { Branch, BranchStaffAssignment, BranchStock, User, Tenant, Product, Sale, SyncLog, Supplier, Expense, Purchase, Delivery, DeliveryRider, SystemSettings, CustomRole, SaleItem } from '../types';
import { 
  DEFAULT_TENANTS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_SUPPLIERS, 
  RECENT_SYNC_LOGS, 
  MOCK_SALES_HISTORY,
  MOCK_EXPENSES_HISTORY
} from '../data';
import { lazyWithReload } from '../utils/lazyWithReload';

// Subcomponents imports
// Each dashboard tab (and the SaaS admin view) is code-split via React.lazy().
// Importing them eagerly means every tab's code (POS, products, cash & bank,
// forecasting, settings, the entire SaaS admin panel, etc.) has to be
// downloaded AND parsed/executed as one monolithic bundle before ANY tab can
// render, even though a login only ever needs the one tab the user lands on.
// See STEP1_INSPECTION_REPORT.md / commit history for the original fix and
// why this must stay lazy-loaded.
const DashboardOverview = lazyWithReload('DashboardOverview', () => import('./DashboardOverview'));
const DashboardPOS = lazyWithReload('DashboardPOS', () => import('./DashboardPOS'));
const DashboardProducts = lazyWithReload('DashboardProducts', () => import('./DashboardProducts'));
const DashboardSuppliers = lazyWithReload('DashboardSuppliers', () => import('./DashboardSuppliers'));
const DashboardLogsAndSync = lazyWithReload('DashboardLogsAndSync', () => import('./DashboardLogsAndSync'));
const DashboardReports = lazyWithReload('DashboardReports', () => import('./DashboardReports'));
const DashboardExpenses = lazyWithReload('DashboardExpenses', () => import('./DashboardExpenses'));
const DashboardSalesList = lazyWithReload('DashboardSalesList', () => import('./DashboardSalesList'));
const DashboardForecasting = lazyWithReload('DashboardForecasting', () => import('./DashboardForecasting'));
const DashboardCashBank = lazyWithReload('DashboardCashBank', () => import('./DashboardCashBank'));
import { saveData } from '../utils/dbSync';
const DashboardPurchases = lazyWithReload('DashboardPurchases', () => import('./DashboardPurchases'));
const DashboardDeliveries = lazyWithReload('DashboardDeliveries', () => import('./DashboardDeliveries'));
const DashboardHotelPMS = lazyWithReload('DashboardHotelPMS', () => import('./DashboardHotelPMS'));
const DashboardSandboxVerticals = lazyWithReload('DashboardSandboxVerticals', () => import('./DashboardSandboxVerticals'));
const DashboardRestaurant = lazyWithReload('DashboardRestaurant', () => import('./DashboardRestaurant'));
const DashboardWhiteLabel = lazyWithReload('DashboardWhiteLabel', () => import('./DashboardWhiteLabel'));
const DashboardSettings = lazyWithReload('DashboardSettings', () => import('./DashboardSettings'));
import { DEFAULT_CUSTOM_ROLES } from '../utils/defaultCustomRoles';
const DashboardStaff = lazyWithReload('DashboardStaff', () => import('./DashboardStaff'));
import DashboardScreenErrorBoundary from './DashboardScreenErrorBoundary';
import AIBusinessCopilot from './AIBusinessCopilot';
import GlobalStickyAd from './GlobalStickyAd';
const SuperSaaSAdminView = lazyWithReload('SuperSaaSAdminView', () => import('./SuperSaaSAdminView'));
import DuressDashboard from './DuressDashboard';
import CachedImage from './CachedImage';
import { savePendingSaleOffline } from '../utils/offlineDb';
import { createCleanTenantSettings, isDemoTenant } from '../utils/tenantIsolation';
import { flushPendingTenantWorkspace, loadTenantWorkspace, markTenantProductsUpdated, saveTenantSettings, saveTenantWorkspace, scheduleTenantWorkspaceSave, subscribeToTenantWorkspace, TenantWorkspace, workspaceHasBusinessData } from '../utils/tenantWorkspace';
import { safeSetJsonItem, safeSetTenantMapItem } from '../utils/dataSafety';
import { findPaymentChannel, getTreasuryPaymentMethods, reconcilePaymentChannels } from '../utils/paymentAccounts';
import { attachPayloadProductTombstones, markLocalProductTombstones, readLocalProductTombstones, stampProductsForSync } from '../utils/productSync';
import {
  attachPayloadSaleTombstones,
  markLocalSaleTombstone,
  readLocalSaleTombstones,
  reverseSaleInventory,
  saleHasTenantConflict,
  writeLocalSaleTombstones,
} from '../utils/saleSync';
import { mergeSettingsForSync, stampSettingsForSync } from '../utils/settingsSync';
import { BranchProvider, useOptionalBranchContext } from '../branches/BranchContext';
import GlobalBranchSwitcher from './GlobalBranchSwitcher';
import {
  mergeScopedProducts,
  recordBelongsToActiveBranch,
  replaceScopedBranchRecords,
  scopeBranchRecords,
  scopeProductsForBranch,
  type ActiveBranchSelection,
} from '../branches/branchScope';
import { ONLINE_ONLY_WRITE_MESSAGE, canWriteBusinessDataOnline } from '../utils/onlineOnly';
import { getSecureDataBridgeClient, isPlaceholderSecureDataBridgeClient } from '../secureDataBridge';
import { postTreasuryEntry, postTreasurySplitIncome, reverseTreasuryEntry } from '../utils/treasuryApi';
import { getSubscriptionReminder, getSubscriptionReminderKey } from '../utils/subscriptionReminder';
import { Shield, Sparkles as SparklesIcon, AlertTriangle, CheckCircle, HelpCircle as HelpIcon, Play, RefreshCcw, CreditCard as CardIcon, Bell } from 'lucide-react';
import { 
  getSubscriptionState, 
  checkSubscriptionStatus, 
  loadSubscriptionFromDB,
  SUBSCRIPTION_PLANS, 
  PAID_PACKAGE_IDS,
  isTenantPackageTabAllowed,
  normalizeSubscriptionPlanId,
  SubscriptionPlanId,
  SubscriptionState
} from '../utils/subscription';

const DashboardBranchesSettings = lazyWithReload('DashboardBranchesSettings', () => import('./DashboardBranchesSettings'));

import { 
  Store, 
  LogOut, 
  Cpu, 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Activity, 
  Wifi, 
  WifiOff, 
  HelpCircle,
  Database,
  Building,
  DollarSign,
  TrendingUp,
  FileText,
  Receipt,
  Sparkles,
  Truck,
  Bike,
  Bed,
  Pill,
  Utensils,
  Globe,
  Clock,
  Settings as SettingsIcon,
  Coins,
  Wallet,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  Award,
  Volume2,
  MessageSquare,
  Inbox,
  Layers,
  MonitorPlay,
  Menu,
  MoreHorizontal,
  X,
  Sun,
  Moon,
  PieChart,
  TrendingDown,
  CloudLightning,
  Search,
  ArrowRightLeft,
  MapPin,
  MinusCircle,
  RefreshCw,
  Handshake,
  Download
} from 'lucide-react';

// A high-fidelity composite component representing a rider on a motorcycle with a delivery basket on their back
function DeliveryMotorcycleIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size} 
      height={size} 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Wheels with inner hubs */}
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <circle cx="5" cy="18" r="0.8" fill="currentColor" />
      <circle cx="19" cy="18" r="0.8" fill="currentColor" />
      
      {/* Front Fork & Scooter Shield & Body */}
      <path d="M5 18h4.5l1.5-3.5h5.5l2.5 3.5" />
      <path d="M17 14.5l1.5-6" strokeWidth="2.2" />
      <path d="M15.5 8.5h3" />

      {/* Seat */}
      <path d="M8 14.5h4.5" strokeWidth="1.5" />

      {/* Rider Helmet (Head) */}
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />

      {/* Rider's Torso leaning forward slightly */}
      <path d="M10 14l2-5" strokeWidth="1.8" />

      {/* Rider's Arms reaching to the handlebar */}
      <path d="M11.5 9.5l4.5-0.5" />

      {/* Rider's Legs sitting on the scooter */}
      <path d="M10 14l1.5 2H13" />

      {/* Large Delivery Backpack on the rider's back */}
      <rect x="5" y="6" width="4.5" height="5.5" rx="1.2" fill="currentColor" className="text-emerald-500 stroke-none" />
      {/* Backpack design line / straps */}
      <path d="M5.5 8h3.5" stroke="white" strokeWidth="0.8" />
      <path d="M5.5 10h3.5" stroke="white" strokeWidth="0.8" />
      <path d="M9.5 7.5c0.5 0.5 0.8 1.2 0.5 2.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

interface UI_Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (route: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  initialTab?: string;
}

import { NotificationCenterModal } from './NotificationCenterModal';

const getInitialSystemSettings = (tenant: Tenant): SystemSettings => {
  if (!isDemoTenant(tenant.id)) return createCleanTenantSettings(tenant);

  return {
    company: {
      companyName: tenant.name,
      usernameKey: tenant.id,
      phone: tenant.id === 't-lagos-01' ? '+234 803 444 5555' : '+254 722 000 111',
      email: 'info@jasper-wholesale.com',
      address: `${tenant.city}, ${tenant.country}`,
      tin: 'TIN-492942-A',
      vat: 'VAT-492040-B',
      currency: tenant.currency,
      timezone: tenant.currencyCode === 'KES' ? 'EAT' : 'WAT',
      logo: '',
      themeMode: 'light'
    },
    business: {
      businessName: tenant.name,
      businessPhone: tenant.id === 't-lagos-01' ? '+234 803 444 5555' : '+254 722 000 111',
      businessAddress: `${tenant.city}, ${tenant.country}`,
      businessLogo: '',
      paymentModes: ['Cash', 'Card', 'M-Pesa', 'MTN MoMo', 'Paystack', 'Bank Transfer'],
      registeredStores: ['Main Store', 'In-Shelf Store', 'Backroom Storage']
    },
    productStore: {
      categories: ['Groceries', 'Beverages', 'Electronics', 'Pharmaceuticals', 'Personal Care', 'Homeware'],
      units: ['pcs', 'kg', 'litres', 'box', 'bottle', 'dozen', 'meters'],
      brands: []
    },
    staffs: [
      { id: 'st-01', name: 'John Mwangi', phone: '+254 722 123 456', role: 'Seller', salary: 35000, password: 'password123' },
      { id: 'st-02', name: 'Babajide Cole', phone: '+234 802 111 2222', role: 'Delivery Rider / Permanent Driver', salary: 45000, password: 'password123' },
      { id: 'st-03', name: 'Kofi Mensah', phone: '+233 244 888 999', role: 'Cashier', salary: 50000, password: 'password123' }
    ]
  };
};

const normalizeSystemSettings = (
  tenant: Tenant,
  incoming?: Partial<SystemSettings> | null,
): SystemSettings => {
  const normalizeNamedList = (value: unknown, fallback: string[] = []) => {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item: any) => {
        if (typeof item === 'string') return item.trim();
        if (!item || typeof item !== 'object') return '';
        return String(item.name || item.label || item.provider || item.value || '').trim();
      })
      .filter(Boolean);
    return normalized.length > 0 ? normalized : fallback;
  };
  const normalizeBrandList = (
    value: unknown,
    fallback: Array<{ name: string; logo?: string }> = [],
  ) => {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item: any) => typeof item === 'string'
        ? { name: item.trim() }
        : { name: String(item?.name || item?.label || '').trim(), logo: item?.logo || item?.logoUrl || undefined })
      .filter((item) => item.name);
    return normalized.length > 0 ? normalized : fallback;
  };
  const defaults = getInitialSystemSettings(tenant);
  const merged = mergeSettingsForSync(incoming, defaults);
  const company: Partial<SystemSettings['company']> = merged?.company && typeof merged.company === 'object' ? merged.company : {};
  const business: Partial<SystemSettings['business']> = merged?.business && typeof merged.business === 'object' ? merged.business : {};
  const productStore: Partial<SystemSettings['productStore']> = merged?.productStore && typeof merged.productStore === 'object' ? merged.productStore : {};

  return {
    ...merged,
    company: { ...defaults.company, ...company },
    business: {
      ...defaults.business,
      ...business,
      paymentModes: normalizeNamedList(
        business.paymentModes,
        (defaults.business.paymentModes || []).map((mode: any) => (
          typeof mode === 'string' ? { name: mode } : mode
        )),
      ),
      registeredStores: normalizeNamedList(business.registeredStores, defaults.business.registeredStores),
    },
    productStore: {
      ...defaults.productStore,
      ...productStore,
      categories: normalizeNamedList(productStore.categories, defaults.productStore.categories),
      units: normalizeNamedList(productStore.units, defaults.productStore.units),
      brands: normalizeBrandList(productStore.brands, defaults.productStore.brands),
    },
    staffs: Array.isArray(merged?.staffs) ? merged.staffs : [],
    customRoles: Array.isArray(merged?.customRoles) ? merged.customRoles : [],
    paymentChannels: Array.isArray(merged?.paymentChannels) ? merged.paymentChannels : [],
  };
};

type SubscriptionCheckoutRenderState = {
  selectedPlanId: SubscriptionPlanId;
  setSelectedPlanId: React.Dispatch<React.SetStateAction<SubscriptionPlanId>>;
  paymentMode: 'online' | 'offline';
  setPaymentMode: React.Dispatch<React.SetStateAction<'online' | 'offline'>>;
};

function SubscriptionCheckoutStateBridge({
  initialPlan,
  children,
}: {
  initialPlan: SubscriptionPlanId;
  children: (state: SubscriptionCheckoutRenderState) => React.ReactNode;
}) {
  const normalizedInitialPlan = normalizeSubscriptionPlanId(initialPlan);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>(
    PAID_PACKAGE_IDS.includes(normalizedInitialPlan as any) ? normalizedInitialPlan : 'diamond'
  );
  const [paymentMode, setPaymentMode] = useState<'online' | 'offline'>('online');

  return <>{children({ selectedPlanId, setSelectedPlanId, paymentMode, setPaymentMode })}</>;
}

function DashboardContent({ user, onLogout, onNavigate, isDark = false, onToggleTheme, initialTab }: DashboardProps) {
  const { t, lang, setLang } = useTranslation();
  const { getFallbackInitials } = useTenantLogo();
  const { addSaleNotification, unreadCount, hydrateTenantModuleSettings } = useJasperNotifications();
  const [showDashLangMenu, setShowDashLangMenu] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  // Load standard + custom registered tenants dynamically
  const [tenantsList] = useState<Tenant[]>(() => {
    const cached = onlineStorage.getItem('jasper_custom_tenants');
    const parsed = cached ? JSON.parse(cached) : [];
    return [...DEFAULT_TENANTS, ...parsed];
  });

  // Determine starting tenant from combined lists
  const [activeTenant, setActiveTenant] = useState<Tenant>(() => {
    const targetTenantId = user.activeTenant || user.tenantId;
    if (!targetTenantId) {
      return {
        id: '',
        name: 'No Tenant Suite Available',
        country: 'Tanzania',
        city: 'Dar es Salaam',
        currency: 'TSh',
        currencyCode: 'TZS',
        taxRate: 0.18,
        mobileMoneyProviders: [],
        businessType: 'retail'
      };
    }
    const matched = tenantsList.find(t => t.id === targetTenantId);
    if (matched) return matched;

    // Dynamically fallback to a clean empty tenant matching the user's activeTenant ID
    return {
      id: targetTenantId,
      name: user.name ? `${user.name}'s Business` : 'My Business',
      country: 'Tanzania',
      city: 'Dar es Salaam',
      currency: 'TSh',
      currencyCode: 'TZS',
      taxRate: 0.18,
      mobileMoneyProviders: ['M-Pesa', 'Airtel Money', 'Halopesa'],
      businessType: 'retail'
    };
  });

  // Sidebar Collapse state (icons vs full sidebar labels)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  const handleConfirmLogout = async () => {
    try {
      setLogoutError(null);
      await onLogout();
      setMoreMenuOpen(false);
      setShowLogoutConfirm(false);
    } catch (err) {
      console.error("Sign out error", err);
      setLogoutError("Sign out failed, please try again");
    }
  };

  // State Management - Starts on correct tab depending on tenant business vertical
  const knownDashboardTabs = new Set([
    'admin-dashboard',
    'admin-subscribers',
    'admin-hw-pos',
    'admin-hw-inventory',
    'admin-hw-sales',
    'admin-affiliates',
    'admin-affiliate-agents',
    'admin-sub-affiliates',
    'admin-status',
    'admin-reports',
    'admin-user-activity',
    'admin-expenses',
    'admin-chats',
    'admin-inbox',
    'admin-promotions',
    'admin-ad-placements',
    'admin-web-editor',
    'admin-settings',
    'hotel-pms',
    'restaurant-hub',
    'sandbox-pms',
    'overview',
    'pos',
    'products',
    'suppliers',
    'purchases-list',
    'deliveries',
    'sync',
    'reports',
    'sales-list',
    'expenses',
    'inventory',
    'forecasting',
    'cash-bank-matrix',
    'whitelabel',
    'staff-members',
    'settings'
  ]);

  const getDefaultDashboardTab = () => {
    if (user.role === 'SuperAdmin') return 'admin-dashboard';
    if (activeTenant.businessType === 'hotel') return 'hotel-pms';
    if (activeTenant.businessType === 'restaurant') return 'restaurant-hub';
    if (activeTenant.businessType === 'pharmacy') return 'sandbox-pms';
    return 'overview';
  };

  const [activeTab, setActiveTab ] = useState<string>(() => {
    if (initialTab && knownDashboardTabs.has(initialTab)) return initialTab;
    const cachedTab = sessionStorage.getItem(`jasper_active_dashboard_tab_${user.id}_${activeTenant.id}`);
    if (cachedTab && knownDashboardTabs.has(cachedTab)) return cachedTab;
    return getDefaultDashboardTab();
  });

  useEffect(() => {
    sessionStorage.setItem(`jasper_active_dashboard_tab_${user.id}_${activeTenant.id}`, activeTab);
  }, [activeTab, activeTenant.id, user.id]);

  const [actingStaffId, setActingStaffId] = useState<string>('logged-in-user');
  const [productsMap, setProductsMap] = useState<Record<string, Product[]>>(() => isDemoTenant(activeTenant.id) ? DEFAULT_PRODUCTS : {});
  const [salesMap, setSalesMap] = useState<Record<string, Sale[]>>(() => isDemoTenant(activeTenant.id) ? MOCK_SALES_HISTORY : {});
  const [expensesMap, setExpensesMap] = useState<Record<string, Expense[]>>(() => isDemoTenant(activeTenant.id) ? MOCK_EXPENSES_HISTORY : {});
  const [branchesMap, setBranchesMap] = useState<Record<string, Branch[]>>({});
  const [branchStocksMap, setBranchStocksMap] = useState<Record<string, BranchStock[]>>({});
  const [branchStaffAssignmentsMap, setBranchStaffAssignmentsMap] = useState<Record<string, BranchStaffAssignment[]>>({});
  
  const [pendingDeliveryNotesMap, setPendingDeliveryNotesMap] = useState<Record<string, any[]>>({});
  const [deliveriesSubTab, setDeliveriesSubTab] = useState<'queue' | 'riders' | 'notes'>('queue');

  const [deliveriesMap, setDeliveriesMap] = useState<Record<string, Delivery[]>>(() => ({
    't-lagos-01': [
      {
        id: 'DL-MOCKNG1',
        saleId: 'SL-MOCK1',
        customerName: 'John Doe',
        customerPhone: '+234 803 444 5555',
        items: [
          { productId: 'p-lag-01', productName: 'Dangote Refined Sugar (50kg)', qty: 1, price: 45000, discount: 0 }
        ],
        totalAmount: 45000,
        deliveryCost: 1500,
        status: 'Pending Dispatch',
        timestamp: '2026-05-18T14:30:00Z',
        tenantId: 't-lagos-01'
      }
    ],
    't-nairobi-02': [
      {
        id: 'DL-MOCKKE1',
        saleId: 'SL-MOCK2',
        customerName: 'Jane Doe',
        customerPhone: '+254 722 000 111',
        items: [
          { productId: 'p-nai-05', productName: 'Menengai Bar Soap White (800g x 10)', qty: 2, price: 1500, discount: 0 }
        ],
        totalAmount: 3000,
        deliveryCost: 200,
        status: 'Pending Dispatch',
        timestamp: '2026-05-19T09:15:00Z',
        tenantId: 't-nairobi-02'
      }
    ],
    't-accra-03': []
  }));

  const [riders, setRiders] = useState<DeliveryRider[]>(() => [
    {
      id: 'r-01',
      name: 'John Mwangi',
      phone: '+254 722 123 456',
      vehicleType: 'motorcycle',
      classification: 'rider',
      vehicleColor: 'Black & Orange',
      licensePlate: 'KMRD 420A',
      tenantId: 't-nairobi-02'
    },
    {
      id: 'r-02',
      name: 'Babajide Cole',
      phone: '+234 802 111 2222',
      vehicleType: 'tuktuk',
      classification: 'rider',
      vehicleColor: 'Yellow / Black stripe',
      licensePlate: 'LND-929-AA',
      tenantId: 't-lagos-01'
    },
    {
      id: 'r-03',
      name: 'Kofi Mensah',
      phone: '+233 244 888 999',
      vehicleType: 'car',
      classification: 'driver',
      vehicleColor: 'White Toyota Probox',
      licensePlate: 'GW-8842-20',
      tenantId: 't-accra-03'
    }
  ]);
  const [purchasesMap, setPurchasesMap] = useState<Record<string, Purchase[]>>(() => ({
    't-lagos-01': [
      {
        id: 'PC-MOCKNG1',
        supplierId: 's-01',
        supplierName: 'Dangote Foods Distribution Ltd',
        items: [
          { productId: 'p-lag-01', productName: 'Dangote Refined Sugar (50kg)', qty: 10, costPrice: 42000 }
        ],
        totalAmount: 420000,
        amountPaid: 420000,
        amountDue: 0,
        destination: 'store',
        deliveryStatus: 'Full order delivered',
        timestamp: '2026-05-18T14:30:00Z',
        tenantId: 't-lagos-01'
      }
    ],
    't-nairobi-02': [
      {
        id: 'PC-MOCKKE1',
        supplierId: 's-02',
        supplierName: 'Bidco Africa Logistics Kenya',
        items: [
          { productId: 'p-nai-05', productName: 'Menengai Bar Soap White (800g x 10)', qty: 20, costPrice: 1100 }
        ],
        totalAmount: 22000,
        amountPaid: 15000,
        amountDue: 7000,
        destination: 'shop',
        deliveryStatus: 'Full order delivered',
        timestamp: '2026-05-19T09:15:00Z',
        tenantId: 't-nairobi-02'
      }
    ],
    't-accra-03': [
      {
        id: 'PC-MOCKGH1',
        supplierId: 's-03',
        supplierName: 'GB Foods Ghana Limited',
        items: [
          { productId: 'p-acc-02', productName: 'Enapa Sardines in Tomato Sauce (Box of 50)', qty: 5, costPrice: 310 }
        ],
        totalAmount: 1550,
        amountPaid: 1550,
        amountDue: 0,
        destination: 'store',
        deliveryStatus: 'Full order delivered',
        timestamp: '2026-05-17T11:45:00Z',
        tenantId: 't-accra-03'
      }
    ]
  }));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => DEFAULT_SUPPLIERS);
  const [logs, setLogs] = useState<SyncLog[]>(() => RECENT_SYNC_LOGS);

  // Modern Toast notification array state and dispatcher
  const [toasts, setToasts] = useState<UI_Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => {
      const list = [...prev, { id, type, message }];
      if (list.length > 3) list.shift();
      return list;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const blockOfflineBusinessWrite = (action: string) => {
    if (canWriteBusinessDataOnline()) return false;
    const message = `${ONLINE_ONLY_WRITE_MESSAGE} Action blocked: ${action}.`;
    addToast(message, 'warning');
    setLogs(prev => [{
      id: 'ONLINE-ONLY-' + Math.random().toString(36).slice(2, 8),
      type: 'system_action',
      status: 'warning',
      message,
      timestamp: new Date().toISOString()
    }, ...prev]);
    return true;
  };

  // Monitor logs to trigger native responsive toast automatically on actions
  useEffect(() => {
    if (logs.length > 0) {
      const latest = logs[0];
      if (latest && latest.message) {
        // Find if this specific message was already toasted to avoid repeat
        addToast(latest.message, latest.status === 'error' ? 'error' : latest.status === 'warning' ? 'warning' : 'success');
      }
    }
  }, [logs]);

  // Load and cache branch specific Settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => normalizeSystemSettings(activeTenant));
  const [databaseBusinessName, setDatabaseBusinessName] = useState('');
  const [activeBranchBusinessName, setActiveBranchBusinessName] = useState('');
  const [activeBranchSelection, setActiveBranchSelection] = useState<ActiveBranchSelection>({
    activeBranchId: null,
    activeScope: 'compatibility_primary',
    selectedBranch: null,
  });
  const [branchSwitching, setBranchSwitching] = useState(false);
  // Direct read of the centralized branch context, in addition to the
  // window-event-driven state above. The event only fires when
  // BranchContext successfully publishes a snapshot; if that publish is
  // ever missed (e.g. listener not yet mounted, or the very first render
  // before any event has fired), this direct hook read still has the
  // real, current snapshot, so the header never falls through to a
  // placeholder while real branch data is actually available. Returns
  // null for SuperAdmin (no BranchProvider mounted in that tree).
  const branchContextValue = useOptionalBranchContext();
  const branchContextSelectedBranch = branchContextValue?.snapshot?.context.selectedBranch || null;

  const [preloadedCart, setPreloadedCart] = useState<{
    items: SaleItem[];
    backdate?: string;
    deliveryCost?: number;
    paymentMethod?: string;
    customerName?: string;
    customerPhone?: string;
    hasVat?: boolean;
  } | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const cloudWorkspaceLoadedRef = useRef(false);
  const localWorkspaceChangedAtRef = useRef(0);
  const skipNextWorkspaceSaveRef = useRef(false);
  const settingsSaveVersionRef = useRef(0);
  const branchWorkspaceCacheRef = useRef(new Map<string, TenantWorkspace>());
  const LOCAL_WORKSPACE_PROTECTION_MS = 10000; // 10s — save completes in < 5s normally

  useEffect(() => {
    hydrateTenantModuleSettings(
      activeTenant.id,
      systemSettings.notificationModuleSettings || [],
    );
  }, [activeTenant.id, systemSettings.notificationModuleSettings, hydrateTenantModuleSettings]);

  // Set safe defaults while the selected tenant workspace loads from Supabase.
  useEffect(() => {
    setSystemSettings(normalizeSystemSettings(activeTenant));
    setDatabaseBusinessName('');
    document.documentElement.classList.remove('dark');
  }, [activeTenant.id]);

  // The encrypted database is the only durable tenant source of truth.
  useEffect(() => {
    let active = true;
    let unsubscribe = () => undefined;
    let refreshInFlight = false;
    cloudWorkspaceLoadedRef.current = false;
    localWorkspaceChangedAtRef.current = 0;
    setWorkspaceReady(false);

    const applyWorkspace = (workspace: TenantWorkspace) => {
      if (!active) return;
      const cloudBusinessName = String(workspace.settings?.business?.businessName || '').trim();
      setDatabaseBusinessName(cloudBusinessName);
      if (Date.now() - localWorkspaceChangedAtRef.current < LOCAL_WORKSPACE_PROTECTION_MS) {
        return;
      }
      skipNextWorkspaceSaveRef.current = true;
      setProductsMap(prev => ({ ...prev, [activeTenant.id]: workspace.products || [] }));
      setBranchesMap(prev => ({ ...prev, [activeTenant.id]: workspace.branches || [] }));
      setBranchStocksMap(prev => ({ ...prev, [activeTenant.id]: workspace.branchStocks || [] }));
      setBranchStaffAssignmentsMap(prev => ({ ...prev, [activeTenant.id]: workspace.branchStaffAssignments || [] }));
      setSalesMap(prev => ({ ...prev, [activeTenant.id]: workspace.sales || [] }));
      setExpensesMap(prev => ({ ...prev, [activeTenant.id]: workspace.expenses || [] }));
      setDeliveriesMap(prev => ({ ...prev, [activeTenant.id]: workspace.deliveries || [] }));
      setPendingDeliveryNotesMap(prev => ({ ...prev, [activeTenant.id]: workspace.pendingDeliveryNotes || [] }));
      setPurchasesMap(prev => ({ ...prev, [activeTenant.id]: workspace.purchases || [] }));
      if (workspace.settings) {
        setSystemSettings(normalizeSystemSettings(activeTenant, workspace.settings));
      }
    };

    const refreshWorkspaceFromDatabase = async (force = false) => {
      if (!active || !navigator.onLine || refreshInFlight) return;
      if (Date.now() - localWorkspaceChangedAtRef.current < LOCAL_WORKSPACE_PROTECTION_MS) return;
      refreshInFlight = true;
      try {
        await flushPendingTenantWorkspace(activeTenant.id);
        const workspace = await loadTenantWorkspace(activeTenant.id);
        if (workspace) {
          cloudWorkspaceLoadedRef.current = true;
          applyWorkspace(workspace);
        }
      } finally {
        refreshInFlight = false;
      }
    };

    loadTenantWorkspace(activeTenant.id).then((workspace) => {
      if (!active) return;
      if (workspace) {
        cloudWorkspaceLoadedRef.current = true;
        applyWorkspace(workspace);
      }
      setWorkspaceReady(true);
    });

    subscribeToTenantWorkspace(activeTenant.id, applyWorkspace).then((cleanup) => {
      unsubscribe = cleanup;
    });

    const handleOnline = () => {
      refreshWorkspaceFromDatabase(true);
    };
    const handleFocus = () => {
      refreshWorkspaceFromDatabase(true);
    };
    // Realtime is the primary synchronisation path. This low-frequency,
    // visible-tab refresh is only a recovery net for silent disconnects.
    const liveRefreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshWorkspaceFromDatabase();
      }
    }, 90_000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      window.clearInterval(liveRefreshTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      unsubscribe();
    };
  }, [activeTenant.id]);

  useEffect(() => {
    let active = true;
    setActiveBranchBusinessName('');

    const applyBranchContext = (detail: any) => {
      if (!active) return;
      setActiveBranchBusinessName(String(detail?.businessName || '').trim());
      setActiveBranchSelection({
        activeBranchId: detail?.activeBranchId || null,
        activeScope: detail?.activeScope || detail?.scope || 'no_branch_access',
        selectedBranch: detail?.selectedBranch || null,
      });
    };
    const applyBranchWorkspace = (workspace: TenantWorkspace) => {
      skipNextWorkspaceSaveRef.current = true;
      setProductsMap(previous => ({ ...previous, [activeTenant.id]: workspace.products || [] }));
      setBranchesMap(previous => ({ ...previous, [activeTenant.id]: workspace.branches || [] }));
      setBranchStocksMap(previous => ({ ...previous, [activeTenant.id]: workspace.branchStocks || [] }));
      setBranchStaffAssignmentsMap(previous => ({
        ...previous,
        [activeTenant.id]: workspace.branchStaffAssignments || [],
      }));
      setSalesMap(previous => ({ ...previous, [activeTenant.id]: workspace.sales || [] }));
      setExpensesMap(previous => ({ ...previous, [activeTenant.id]: workspace.expenses || [] }));
      setDeliveriesMap(previous => ({ ...previous, [activeTenant.id]: workspace.deliveries || [] }));
      setPendingDeliveryNotesMap(previous => ({
        ...previous,
        [activeTenant.id]: workspace.pendingDeliveryNotes || [],
      }));
      setPurchasesMap(previous => ({ ...previous, [activeTenant.id]: workspace.purchases || [] }));
      setSystemSettings(normalizeSystemSettings(activeTenant, workspace.settings));
      cloudWorkspaceLoadedRef.current = true;
    };
    const handleBranchContextChanged = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      applyBranchContext(detail);
      const cacheKey = `${detail?.activeScope || detail?.scope || 'branch'}:${detail?.activeBranchId || 'primary'}`;
      const cachedWorkspace = branchWorkspaceCacheRef.current.get(cacheKey);
      if (cachedWorkspace) {
        applyBranchWorkspace(cachedWorkspace);
        setBranchSwitching(false);
      }
      try {
        const workspace = await loadTenantWorkspace(activeTenant.id);
        if (!active) return;
        if (!workspace) {
          addToast('The selected branch workspace could not be loaded. No previous-branch data was shown.', 'error');
          return;
        }
        branchWorkspaceCacheRef.current.set(cacheKey, workspace);
        applyBranchWorkspace(workspace);
      } finally {
        if (active) setBranchSwitching(false);
      }
    };
    const handleBranchSwitchStarted = () => setBranchSwitching(true);
    const handleBranchSwitchFailed = () => setBranchSwitching(false);

    window.addEventListener('jasper_branch_context_changed', handleBranchContextChanged);
    window.addEventListener('jasper_branch_switch_started', handleBranchSwitchStarted);
    window.addEventListener('jasper_branch_switch_failed', handleBranchSwitchFailed);

    return () => {
      active = false;
      window.removeEventListener('jasper_branch_context_changed', handleBranchContextChanged);
      window.removeEventListener('jasper_branch_switch_started', handleBranchSwitchStarted);
      window.removeEventListener('jasper_branch_switch_failed', handleBranchSwitchFailed);
    };
  }, [activeTenant.id]);

  useEffect(() => {
    if (!workspaceReady) return;
    if (!canWriteBusinessDataOnline()) return;
    if (skipNextWorkspaceSaveRef.current) {
      skipNextWorkspaceSaveRef.current = false;
      return;
    }
    localWorkspaceChangedAtRef.current = Date.now();
    const workspace: TenantWorkspace = {
      branches:             branchesMap[activeTenant.id]             || [],
      branchStocks:         branchStocksMap[activeTenant.id]         || [],
      branchStaffAssignments: branchStaffAssignmentsMap[activeTenant.id] || [],
      products:             productsMap[activeTenant.id]             || [],
      sales:                salesMap[activeTenant.id]                || [],
      expenses:             expensesMap[activeTenant.id]             || [],
      settings:             systemSettings,
      deliveries:           deliveriesMap[activeTenant.id]           || [],
      pendingDeliveryNotes: pendingDeliveryNotesMap[activeTenant.id] || [],
      purchases:            purchasesMap[activeTenant.id]            || [],
      productTombstones:    readLocalProductTombstones(activeTenant.id),
    };
    if (!cloudWorkspaceLoadedRef.current && !workspaceHasBusinessData(workspace)) {
      return;
    }
    // Coalesce render-driven snapshots. Explicit sale, stock, treasury and
    // settings operations still use immediate durable save paths.
    void scheduleTenantWorkspaceSave(activeTenant.id, workspace);
  }, [workspaceReady, activeTenant.id, branchesMap, branchStocksMap, branchStaffAssignmentsMap, productsMap, salesMap, expensesMap, systemSettings, deliveriesMap, pendingDeliveryNotesMap, purchasesMap]);

  // PHASE 3 — Auto-create the business owner as a staff record on first login.
  // This ensures the admin appears in the HR/staff list with full permissions
  // and is protected from deletion. Only runs once when settings are ready
  // and no owner record exists yet.
  useEffect(() => {
    if (!workspaceReady || user.role === 'SuperAdmin') return;
    if (!canWriteBusinessDataOnline()) return;
    const staffs: any[] = systemSettings?.staffs || [];
    const ownerExists = staffs.some((s: any) => s.isOwner);
    if (ownerExists) return;

    // Create an owner staff record from the logged-in admin's details
    const ownerRecord = {
      id: `owner-${activeTenant.id}`,
      name: user.name || activeTenant.name,
      phone: user.phone || '',
      role: 'Admin',
      salary: 0,
      salaryType: 'monthly' as const,
      status: 'active' as const,
      staffType: 'permanent' as const,
      dateJoined: new Date().toISOString().split('T')[0],
      isOwner: true,
      profileImage: user.profileImage || undefined,
      notes: 'Business owner account — auto-created on first login',
    };

    const updatedStaffs = [ownerRecord, ...staffs];
    const updatedSettings = stampSettingsForSync({ ...systemSettings, staffs: updatedStaffs }, systemSettings);
    setSystemSettings(updatedSettings);
    try {
      safeSetJsonItem(`jasper_settings_${activeTenant.id}`, updatedSettings, {
        tenantId: activeTenant.id,
        dataKey: 'settings',
        logLabel: `${activeTenant.id}/settings`,
      });
      void saveTenantSettings(activeTenant.id, updatedSettings);
    } catch { /* quota */ }
  }, [workspaceReady, activeTenant.id]);

  // AUTO-MIGRATE: Upload any remaining base64 product images to Supabase Storage.
  // Runs once per session, 8 seconds after workspace is ready (avoids race with
  // active user edits). Uses server-side API with service role key — bypasses RLS.
  useEffect(() => {
    if (!workspaceReady || user.role === 'SuperAdmin') return;
    if (!canWriteBusinessDataOnline()) return;

    let cancelled = false;
    const tid = activeTenant.id;

    // Delay 8 seconds to avoid interfering with user edits on page load
    const startTimer = setTimeout(async () => {
      try {
        // Re-read from latest productsMap at time of execution
        const products = productsMap[tid] || [];
        const needsMigration = products.filter(
          (p: any) => p.image && typeof p.image === 'string' && p.image.startsWith('data:image')
        );
        if (needsMigration.length === 0 || cancelled) return;

        let migrated = 0;
        const updatedProducts = [...products];

        for (const prod of needsMigration) {
          if (cancelled) break;
          try {
            const response = await fetch('/api/images/migrate-product', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tenantId: tid, productId: prod.id, base64DataUrl: prod.image }),
            });
            const result = await response.json();
            if (result.success && result.url) {
              const idx = updatedProducts.findIndex((p: any) => p.id === prod.id);
              if (idx !== -1) {
                updatedProducts[idx] = { ...updatedProducts[idx], image: result.url };
                migrated++;
              }
            }
          } catch { /* skip */ }
          await new Promise(r => setTimeout(r, 400));
        }

        if (migrated > 0 && !cancelled) {
          const syncUpdatedAt = new Date().toISOString();
          const syncedProducts = stampProductsForSync(updatedProducts, products, syncUpdatedAt);
          markTenantProductsUpdated(tid, syncUpdatedAt);
          setProductsMap(prev => ({ ...prev, [tid]: syncedProducts }));
          try {
            const currentMap = JSON.parse(onlineStorage.getItem('jasper_products_map') || '{}');
            currentMap[tid] = syncedProducts;
            safeSetTenantMapItem('jasper_products_map', 'products_map', currentMap);
          } catch { /* quota */ }
          saveData(tid, 'products_map', { [tid]: syncedProducts });
          console.log(`[Orvix] Migrated ${migrated} product images to Storage.`);
        }
      } catch (err) {
        console.warn('[Orvix] Image migration failed:', err);
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
  }, [workspaceReady, activeTenant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'OFFLINE_BACKGROUND_SYNC_SUCCESS') {
          const newLog: SyncLog = {
            id: 'ONLINE-ONLY-SW-' + Math.random().toString(36).slice(2, 8),
            type: 'sale',
            status: 'warning',
            message: 'Ignored legacy background sync success event. Online-only mode will not mark local pending sales as synced automatically.',
            timestamp: new Date().toISOString()
          };
          setLogs(prev => [newLog, ...prev]);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

      // Handle standard browser offline -> online transition
      const handleOnlineStatus = () => {
        const newLog: SyncLog = {
          id: 'l-' + Math.random().toString(36).substr(2, 9),
          type: 'inventory_audit',
          status: 'warning',
          message: 'Network connectivity restored. Offline queue replay remains disabled to protect tenant data.',
          timestamp: new Date().toISOString()
        };
        setLogs(prev => [newLog, ...prev]);
      };

      window.addEventListener('online', handleOnlineStatus);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
        window.removeEventListener('online', handleOnlineStatus);
      };
    }
  }, []);

  // Floating support hotline and broadcast tracker
  const [isSupportConsoleOpen, setIsSupportConsoleOpen] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'alerts' | 'chat' | 'offers'>('alerts');
  const [consoleChats, setConsoleChats] = useState<any[]>([]);
  const [userChatInput, setUserChatInput] = useState('');
  const [localBulletins, setLocalBulletins] = useState<any[]>([]);
  const [localOffers, setLocalOffers] = useState<any[]>([]);

  // Periodically synchronise with SaaS Admin broadcasts
  useEffect(() => {
    const fetchHotlineAssets = () => {
      // 1. Load bulletins
      const rawBulletins = onlineStorage.getItem('jasper_super_admin_bulletins');
      if (rawBulletins) {
        setLocalBulletins(JSON.parse(rawBulletins));
      } else {
        const fallbackBulletins = [
          { id: 'bul-1', timestamp: new Date().toISOString(), title: 'Mpesa real-time sync upgrade completed', content: 'Our real-time transaction processing latency is now officially verified at 0.3 seconds across all East African cash endpoints.', type: 'system' }
        ];
        setLocalBulletins(fallbackBulletins);
      }

      // 2. Load Offers
      const rawOffers = onlineStorage.getItem('jasper_super_admin_broadcast_offers');
      if (rawOffers) {
        setLocalOffers(JSON.parse(rawOffers));
      } else {
        const fallbackOffers = [
          { id: 'off-1', timestamp: new Date().toISOString(), title: 'SaaS Suite Easter Discount', code: 'UPGRADE20', badge: 'SAVE 20%', description: 'Get a 20% flat discount on unified consolidated bookkeeping & hotel PMS active models. Limited time discount.', isActive: true }
        ];
        setLocalOffers(fallbackOffers);
      }

      // 3. Load Chat messages
      const rawChats = onlineStorage.getItem('jasper_super_admin_hotline_chats');
      if (rawChats) {
        setConsoleChats(JSON.parse(rawChats));
      } else {
        const defaultChats = [
          { id: 'ch-1', tenantId: activeTenant.id, tenantName: activeTenant.name, senderName: user.name, timestamp: new Date().toISOString(), messageText: 'Habari, we would like assistance wiring extra Epson thermal printers to our wholesale terminals today.', direction: 'user_to_admin', isRead: false }
        ];
        setConsoleChats(defaultChats);
      }
    };

    fetchHotlineAssets();
    // Refresh every 5 seconds to simulate real-time socket updates
    const syncInterval = setInterval(fetchHotlineAssets, 5000);
    return () => clearInterval(syncInterval);
  }, [activeTenant.id, user.name]);

  const handleSendMerchantMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userChatInput.trim()) return;

    const newMsg = {
      id: 'ch-usr-' + Math.floor(Math.random() * 100000),
      tenantId: activeTenant.id,
      tenantName: activeTenant.name,
      senderName: user.name,
      timestamp: new Date().toISOString(),
      messageText: userChatInput,
      direction: 'user_to_admin',
      isRead: false
    };

    const currentSaved = JSON.parse(onlineStorage.getItem('jasper_super_admin_hotline_chats') || '[]');
    const updated = [...currentSaved, newMsg];
    onlineStorage.setItem('jasper_super_admin_hotline_chats', JSON.stringify(updated));
    setConsoleChats(updated);
    setUserChatInput('');
  };

  // Dynamic system permissions resolver based on actingStaffId
  const activeRoleName = (() => {
    const rawRole = actingStaffId === 'logged-in-user' 
      ? user.role 
      : (systemSettings.staffs.find(s => s.id === actingStaffId)?.role || 'Seller');
    return (rawRole === 'Seller' && activeTenant.businessType === 'restaurant') ? 'Waiter' : rawRole;
  })();

  const getSimulatedPermissions = () => {
    if (actingStaffId === 'logged-in-user' && user.rolePermissions) return user.rolePermissions;

    const customRoles = systemSettings.customRoles || [];
    const matched = customRoles.find(r => r.name.toLowerCase() === activeRoleName.toLowerCase());
    if (matched) return matched.permissions;

    const queryPreset = (activeRoleName.toLowerCase() === 'waiter' || activeRoleName.toLowerCase() === 'seller') ? 'seller' : activeRoleName.toLowerCase();
    const preset = DEFAULT_CUSTOM_ROLES.find(r => r.name.toLowerCase() === queryPreset);
    if (preset) return preset.permissions;

    // Never turn an unrecognised staff role into an administrator. Access is
    // denied until the owner assigns a known preset or custom role.
    return {
      pos: { read: false, write: false, edit: false },
      products: { read: false, write: false, edit: false },
      purchases: { read: false, write: false, edit: false },
      suppliers: { read: false, write: false, edit: false },
      expenses: { read: false, write: false, edit: false },
      reportsSalesExpenses: { read: false, write: false, edit: false },
      reportsProfitCogs: { read: false, write: false, edit: false },
      sync: { read: false, write: false, edit: false },
      settings: { read: false, write: false, edit: false }
    };
  };

  const currentPermissions = getSimulatedPermissions();

  const getSuperAdminPermissionKey = (tabId: string) => {
    const mapping: Record<string, string> = {
      'admin-dashboard': 'dashboard',
      'admin-subscribers': 'subscribers',
      'admin-hw-pos': 'hw-pos',
      'admin-hw-inventory': 'hw-inventory',
      'admin-hw-sales': 'hw-sales',
      'admin-affiliates': 'affiliates',
      'admin-affiliate-agents': 'affiliates',
      'admin-sub-affiliates': 'affiliates',
      'admin-status': 'status',
      'admin-reports': 'reports',
      'admin-user-activity': 'user-activity',
      'admin-expenses': 'expenses',
      'admin-chats': 'chats',
      'admin-inbox': 'inbox',
      'admin-promotions': 'promotions',
      'admin-ad-placements': 'web-editor',
      'admin-tutorials': 'tutorials',
      'admin-web-editor': 'web-editor',
      'admin-settings': 'settings'
    };
    return mapping[tabId] || tabId.replace(/^admin-/, '');
  };

  const isTabAllowed = (tabId: string) => {
    if (activeRoleName === 'SuperAdmin') {
      if (user.isSaaSStaff) {
        const permissions = user.saasPermissions || {};
        return Boolean(permissions[getSuperAdminPermissionKey(tabId)]);
      }
      return tabId === 'super-saas' || tabId.startsWith('admin-') || tabId === 'staff' || tabId === 'staff-members';
    }

    // Enforce package access at the common navigation boundary. Desktop,
    // mobile More, Lucy navigation, and restored session tabs all call this
    // helper, so a lower package cannot reach a premium screen through a
    // navigation path that happens not to be rendered in the desktop sidebar.
    if (!isTenantPackageTabAllowed(subStatus.plan.id, tabId)) return false;

    const perms = currentPermissions;
    if (!perms) return true;
    
    switch (tabId) {
      case 'overview':
        return perms.reportsSalesExpenses?.read || perms.reportsProfitCogs?.read;
      case 'pos':
        return perms.pos?.read;
      case 'sales-list':
        return perms.pos?.read;
      case 'purchases-list':
        return perms.purchases?.read;
      case 'deliveries':
        return perms.pos?.read;
      case 'expenses':
        return perms.expenses?.read;
      case 'inventory':
        return perms.products?.read && perms.reportsSalesExpenses?.read;
      case 'forecasting':
        return perms.products?.read && perms.reportsProfitCogs?.read;
      case 'products':
        return perms.products?.read;
      case 'suppliers':
        return perms.suppliers?.read;
      case 'reports':
        return perms.reportsSalesExpenses?.read || perms.reportsProfitCogs?.read;
      case 'sync':
        return perms.sync?.read;
      case 'whitelabel':
        return perms.settings?.read;
      case 'settings':
        return perms.settings?.read;
      case 'staff-members':
        return perms.settings?.read;
      case 'hotel-pms':
        return perms.settings?.read || perms.pos?.read;
      case 'restaurant-hub':
        return perms.pos?.read;
      case 'sandbox-pms':
        return perms.products?.read;
      default:
        return true;
    }
  };

  // Simulated connection states
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOfflineMode(true);
    const handleOnline = () => setIsOfflineMode(false);
    
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Multi-tenant pivot controller keys
  const currentTenantId = user.activeTenant || user.tenantId;
  const activeProducts = currentTenantId
    ? scopeProductsForBranch(
      productsMap[activeTenant.id] || [],
      branchStocksMap[activeTenant.id] || [],
      activeBranchSelection,
    )
    : [];
  const activeSales: Sale[] = currentTenantId ? scopeBranchRecords<Sale>(salesMap[activeTenant.id] || [], activeBranchSelection) : [];
  const activeExpenses: Expense[] = currentTenantId ? scopeBranchRecords<Expense>(expensesMap[activeTenant.id] || [], activeBranchSelection) : [];
  const activePurchases: Purchase[] = currentTenantId ? scopeBranchRecords<Purchase>(purchasesMap[activeTenant.id] || [], activeBranchSelection) : [];
  const activeDeliveries: Delivery[] = currentTenantId ? scopeBranchRecords<Delivery>(deliveriesMap[activeTenant.id] || [], activeBranchSelection) : [];
  const activePendingDeliveryNotes = currentTenantId
    ? scopeBranchRecords<any>(pendingDeliveryNotesMap[activeTenant.id] || [], activeBranchSelection)
    : [];

  const activeSuppliers = currentTenantId
    ? scopeBranchRecords<Supplier>(suppliers.filter(s => s.tenantId === activeTenant.id), activeBranchSelection)
    : [];
  const activeRiders = currentTenantId
    ? scopeBranchRecords<DeliveryRider>(riders.filter(r => r.tenantId === activeTenant.id), activeBranchSelection)
    : [];

  // Premium subscription state setup 
  const [subState, setSubState] = useState<SubscriptionState>(() => getSubscriptionState());
  const [isBillingBannerDismissed, setIsBillingBannerDismissed] = useState(false);
  const [manualActivationPackage, setManualActivationPackage] = useState<SubscriptionPlanId>('diamond');
  const [manualActivationReceipt, setManualActivationReceipt] = useState<File | null>(null);
  const [manualActivationNote, setManualActivationNote] = useState('');
  const [manualActivationSubmitting, setManualActivationSubmitting] = useState(false);
  const [manualActivationMessage, setManualActivationMessage] = useState<string | null>(null);
  const [onlinePaymentSubmitting, setOnlinePaymentSubmitting] = useState(false);
  const [onlinePaymentMessage, setOnlinePaymentMessage] = useState<string | null>(null);
  
  // Custom interactive limit modal state
  const [subModal, setSubModal] = useState<{
    show: boolean;
    title: string;
    description: string;
    limitType: 'products' | 'stores' | 'staff' | 'expired';
  } | null>(null);

  useEffect(() => {
    const openPackages = () => {
      setManualActivationPackage('diamond');
      setSubModal({
        show: true,
        title: 'Choose Subscription Package',
        limitType: 'expired',
        description: 'Choose a package and submit your payment receipt for activation.'
      });
    };
    window.addEventListener('jasper_open_subscription_packages', openPackages);
    return () => window.removeEventListener('jasper_open_subscription_packages', openPackages);
  }, []);

  // Sync state with localstorage on change of tenant
  useEffect(() => {
    setSubState(getSubscriptionState());
  }, [activeTenant.id]);

  // ── LOAD SUBSCRIPTION FROM DB ON LOGIN ──────────────────────────────────
  // This is the source of truth — overrides onlineStorage with DB plan
  useEffect(() => {
    if (!activeTenant.id) return;
    loadSubscriptionFromDB(activeTenant.id).then(dbState => {
      if (dbState) {
        setSubState(dbState);
      }
    }).catch(() => {
      // Silently fall back to onlineStorage state — system still works offline
    });
  }, [activeTenant.id]);

  const submitManualActivationRequest = async (requestedPlanId: SubscriptionPlanId = manualActivationPackage) => {
    const selectedPlanId = normalizeSubscriptionPlanId(requestedPlanId);
    if (selectedPlanId === 'trial') {
      setManualActivationMessage('Please choose Ruby, Diamond, or Tanzanite before submitting.');
      return;
    }
    if (!manualActivationReceipt) {
      setManualActivationMessage('Please attach the payment receipt before submitting.');
      return;
    }
    if (!manualActivationNote.trim()) {
      setManualActivationMessage('Please add the transaction reference or payment details.');
      return;
    }
    if (manualActivationReceipt.size > 5 * 1024 * 1024) {
      setManualActivationMessage('Receipt must be 5 MB or smaller.');
      return;
    }
    const allowedReceiptTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedReceiptTypes.includes(manualActivationReceipt.type)) {
      setManualActivationMessage('Use a JPG, PNG, WebP, or PDF receipt.');
      return;
    }

    setManualActivationSubmitting(true);
    setManualActivationMessage(null);
    const selectedPlan = SUBSCRIPTION_PLANS[selectedPlanId];
    const submittedAt = new Date().toISOString();
    const requestRecord = {
      id: crypto.randomUUID(),
      tenant_id: activeTenant.id,
      tenant_name: activeTenant.name,
      requested_package_id: selectedPlanId,
      requested_package_name: selectedPlan.name,
      amount: selectedPlan.price,
      currency: activeTenant.currency || 'TSh',
      status: 'pending',
      receipt_file_name: manualActivationReceipt.name,
      receipt_file_type: manualActivationReceipt.type || 'unknown',
      receipt_file_size: manualActivationReceipt.size,
      note: `Package: ${selectedPlan.name}. ${manualActivationNote.trim()}`,
      submitted_by: user.id,
      submitted_at: submittedAt,
      created_at: submittedAt,
      updated_at: submittedAt
    };

    try {
      const client: any = await getSecureDataBridgeClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Your secure session has expired. Sign in again.');
      const receiptBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Receipt file could not be read.'));
        reader.readAsDataURL(manualActivationReceipt);
      });
      const uploadResponse = await fetch('/api/subscriptions/payment-proof-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          fileName: manualActivationReceipt.name,
          fileType: manualActivationReceipt.type,
          receiptBase64,
        }),
      });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || !uploadPayload?.receiptPath) {
        throw new Error(uploadPayload?.error || 'Receipt upload failed.');
      }

      const { error } = await client
        .from('tenant_payment_proofs')
        .insert({ ...requestRecord, receipt_file_url: uploadPayload.receiptPath });

      if (error) throw error;
      setManualActivationMessage(`Activation request sent for ${selectedPlan.name}. Admin will verify the receipt.`);
      setManualActivationReceipt(null);
      setManualActivationNote('');
    } catch (err: any) {
      setManualActivationMessage(
        err?.message
          ? `Internet is required to submit activation requests. Nothing was saved offline: ${err.message}`
          : 'Internet is required to submit activation requests. Nothing was saved offline.'
      );
    } finally {
      setManualActivationSubmitting(false);
    }
  };

  const startOnlineSubscriptionPayment = async (
    requestedPlanId: SubscriptionPlanId = manualActivationPackage,
    onOfflineAvailable?: () => void
  ) => {
    const planId = normalizeSubscriptionPlanId(requestedPlanId);
    if (!PAID_PACKAGE_IDS.includes(planId as any)) {
      setOnlinePaymentMessage('Choose Ruby, Diamond, or Tanzanite first.');
      return;
    }
    setOnlinePaymentSubmitting(true);
    setOnlinePaymentMessage(null);
    try {
      const client: any = await getSecureDataBridgeClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Your secure session has expired. Sign in again.');

      const response = await fetch('/api/subscriptions/azam-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          planId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.offlineAvailable) {
          setOnlinePaymentMessage(payload?.error || 'Online payment is temporarily unavailable. Use the offline receipt option below.');
          onOfflineAvailable?.();
          return;
        }
        throw new Error(payload?.error || 'Online payment could not be started.');
      }
      if (payload?.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      throw new Error('AzamPay did not return a secure checkout link.');
    } catch (error: any) {
      setOnlinePaymentMessage(error?.message || 'Online payment could not be started.');
    } finally {
      setOnlinePaymentSubmitting(false);
    }
  };

  const currentProductCount = activeProducts.length;
  const currentStoreCount = systemSettings.business?.registeredStores?.length || 1;
  const currentStaffCount = systemSettings.staffs?.length || 0;

  useEffect(() => {
    if (!canWriteBusinessDataOnline()) return;
    Object.entries(salesMap).forEach(([tid, data]) => {
      saveData(
        tid,
        'sales_map',
        attachPayloadSaleTombstones(
          { [tid]: data },
          tid,
          readLocalSaleTombstones(tid),
        ),
      );
    });
  }, [salesMap]);

  useEffect(() => {
    if (!canWriteBusinessDataOnline()) return;
    Object.entries(expensesMap).forEach(([tid, data]) => {
      saveData(tid, 'expenses_map', { [tid]: data });
    });
  }, [expensesMap]);

  const subStatus = checkSubscriptionStatus(
    subState,
    currentProductCount,
    currentStoreCount,
    currentStaffCount
  );
  const isTrialAccount = normalizeSubscriptionPlanId(subStatus.state.planId) === 'trial' && !subStatus.state.isSubscribedPaid;
  const isTrialAccessLocked = user.role !== 'SuperAdmin' && isTrialAccount && subStatus.isExpired;
  const trialDurationDays = subStatus.state.promoCodeUsed ? 20 : 10;
  const rubyDowngradeNotes = [
    'Lucy AI online assistant is not included',
    'Product limit drops from 5,000 to 1,000',
    'Branch capacity remains 1 store',
    'Staff limit drops from 5 users to 2 users',
    'Custom role security controls are reduced',
    'Advanced consolidated reports and delivery workflows are limited'
  ];
  const tanzaniteUpgradeNotes = [
    'Unlimited product catalog capacity',
    '2 total branches included; Super Admin can grant more',
    'Up to 15 staff accounts',
    'Lucy AI Tanzanite limits: 500 chats, 6 reports, 3 forecasts per day',
    'Full white-label branding tools',
    'Staff payroll, allowances, and richer executive reporting'
  ];

  const subscriptionReminder = getSubscriptionReminder(
    subStatus.plan.id,
    subStatus.daysRemaining,
    subStatus.isExpired,
  );
  const subscriptionReminderKey = subscriptionReminder
    ? getSubscriptionReminderKey(
      activeTenant.id,
      subStatus.state.subscriptionEndAt,
      subscriptionReminder,
    )
    : null;

  useEffect(() => {
    setIsBillingBannerDismissed(
      Boolean(subscriptionReminderKey && sessionStorage.getItem(subscriptionReminderKey) === 'dismissed'),
    );
  }, [subscriptionReminderKey]);

  // Compact header countdown between search and online status.
  const renderSubscriptionCountdownBadge = () => {
    if (!subscriptionReminder || isBillingBannerDismissed || user.role === 'SuperAdmin') return null;

    return (
      <div
        className="flex min-w-0 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
        role="status"
      >
        <button
          type="button"
          onClick={() => {
          setSubModal({
            show: true,
            title: subscriptionReminder.level === 'expired' ? 'Renew Tanzanite' : 'Renew Subscription',
            limitType: 'expired',
            description: subscriptionReminder.message,
          });
          }}
          className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold"
          title={subscriptionReminder.message}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="hidden max-w-[260px] truncate md:inline">{subscriptionReminder.message}</span>
          <span className="md:hidden">{subscriptionReminder.title}</span>
        </button>
        <button
          type="button"
          aria-label="Dismiss subscription reminder for this session"
          className="rounded-md p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          onClick={() => {
            if (subscriptionReminderKey) sessionStorage.setItem(subscriptionReminderKey, 'dismissed');
            setIsBillingBannerDismissed(true);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  // Mutators passed down
  const getTreasuryOpeningBalances = () => {
    const channels = (systemSettings.paymentChannels || []).filter(channel =>
      channel.category !== 'person'
      && channel.status !== 'inactive'
      && channel.status !== 'archived'
    );
    const balances = Object.fromEntries(channels.map(channel => [channel.id, 0])) as Record<string, number>;
    const creditMethod = (method: string, amount: number) => {
      const channel = findPaymentChannel(channels, method);
      if (channel && amount > 0) balances[channel.id] = (balances[channel.id] || 0) + amount;
    };

    activeSales.forEach(sale => {
      const amount = Math.max(0, Number(sale.total || 0) - Number(sale.deliveryCost || 0));
      const breakdown = sale.paymentBreakdown?.length
        ? sale.paymentBreakdown
        : [{ method: sale.paymentMethod || 'Cash', amount }];
      breakdown.forEach(part => creditMethod(part.method || sale.paymentMethod || 'Cash', Math.max(0, Number(part.amount || 0))));
    });
    activeDeliveries.forEach(delivery => {
      const collected = delivery.deliveryPaymentStatus === 'collected'
        || (!delivery.deliveryPaymentStatus && delivery.status === 'Delivered');
      if (collected && delivery.status !== 'Cancelled') {
        creditMethod(
          delivery.deliveryPaymentMethod || 'Cash',
          Math.max(0, Number(delivery.deliveryCost || 0)),
        );
      }
    });
    activeExpenses.forEach(expense => {
      if (expense.paidFromAccountId && balances[expense.paidFromAccountId] !== undefined) {
        balances[expense.paidFromAccountId] -= Math.max(0, Number(expense.amount || 0));
      }
    });
    activePurchases.forEach(purchase => {
      if (purchase.paidFromAccountId && balances[purchase.paidFromAccountId] !== undefined) {
        balances[purchase.paidFromAccountId] -= Math.max(0, Number(purchase.amountPaid || 0));
      }
    });
    return Object.fromEntries(Object.entries(balances).map(([id, balance]) => [id, Math.max(0, balance)]));
  };

  const handleAddExpense = async (expense: Expense) => {
    if (blockOfflineBusinessWrite('expense entry')) return false;

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    const hasValidExpensePayload = Boolean(
      expense?.id &&
      expense?.category?.trim() &&
      expense?.description?.trim() &&
      Number.isFinite(Number(expense?.amount)) &&
      Number(expense?.amount) > 0
    );
    if (!hasValidExpensePayload) {
      console.warn('Blocked invalid automatic expense payload', expense);
      return false;
    }

    try {
      const posted = await postTreasuryEntry({
        channels: systemSettings.paymentChannels || [],
        sourceAccountKey: String(expense.paidFromAccountId || ''),
        amount: expense.amount,
        direction: 'out',
        sourceType: expense.payrollPaymentType ? 'payroll' : 'expense',
        sourceId: expense.id,
        description: expense.description,
        openingBalances: getTreasuryOpeningBalances(),
        metadata: {
          category: expense.category,
          staffId: expense.staffId || null,
          staffName: expense.staffName,
          payrollPaymentType: expense.payrollPaymentType || null,
          payrollPeriodStart: expense.payrollPeriodStart || null,
          payrollPeriodEnd: expense.payrollPeriodEnd || null,
          reference: expense.payrollReference || expense.receiptRef || null,
          attachmentName: expense.payrollAttachmentName || null,
        },
      });
      expense = {
        ...expense,
        branchId: posted.branchId,
        treasuryJournalId: posted.journalId,
      };
    } catch (error: any) {
      addToast(error?.message || 'Money & Bank could not post this expense safely.', 'error');
      return false;
    }

    setExpensesMap(prev => {
      const currentTenantExpenses = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: [expense, ...currentTenantExpenses]
      };
    });

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'auth_sync',
      status: 'success',
      message: `Recorded debit voucher (${expense.category}: ${activeTenant.currency}${expense.amount}) for branch: ${activeTenant.name}`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    return true;
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (blockOfflineBusinessWrite('expense delete')) return false;
    const expense = (expensesMap[activeTenant.id] || []).find(item => item.id === expenseId);
    if (!expense || !recordBelongsToActiveBranch(expense, activeBranchSelection)) {
      addToast('This expense is not part of the active branch workspace.', 'error');
      return false;
    }
    if (expense?.treasuryJournalId) {
      try {
        await reverseTreasuryEntry(
          expense.treasuryJournalId,
          expense.id,
          `Voided expense: ${expense.description}`,
        );
      } catch (error: any) {
        addToast(error?.message || 'Money & Bank could not reverse this expense safely.', 'error');
        return false;
      }
    }

    setExpensesMap(prev => ({
      ...prev,
      [activeTenant.id]: (prev[activeTenant.id] || []).filter(e => e.id !== expenseId)
    }));
    return true;
  };

  const handleUpdateExpense = async (updatedExpense: Expense): Promise<boolean> => {
    if (blockOfflineBusinessWrite('expense update')) return false;
    const existingExpense = (expensesMap[activeTenant.id] || []).find(item => item.id === updatedExpense.id);
    if (!existingExpense || !recordBelongsToActiveBranch(existingExpense, activeBranchSelection)) return false;
    const nextExpenses = (expensesMap[activeTenant.id] || []).map(expense => (
      expense.id === updatedExpense.id
        ? { ...updatedExpense, branchId: existingExpense.branchId }
        : expense
    ));
    localWorkspaceChangedAtRef.current = Date.now();
    const saved = await saveTenantWorkspace(activeTenant.id, {
      branches: branchesMap[activeTenant.id] || [],
      branchStocks: branchStocksMap[activeTenant.id] || [],
      branchStaffAssignments: branchStaffAssignmentsMap[activeTenant.id] || [],
      products: productsMap[activeTenant.id] || [],
      sales: salesMap[activeTenant.id] || [],
      expenses: nextExpenses,
      settings: systemSettings,
      deliveries: deliveriesMap[activeTenant.id] || [],
      pendingDeliveryNotes: pendingDeliveryNotesMap[activeTenant.id] || [],
      purchases: purchasesMap[activeTenant.id] || [],
      productTombstones: readLocalProductTombstones(activeTenant.id),
      saleTombstones: readLocalSaleTombstones(activeTenant.id),
    });
    if (!saved) return false;
    setExpensesMap(prev => ({ ...prev, [activeTenant.id]: nextExpenses }));
    return true;
  };

  const persistTenantProductsNow = (updatedProducts: Product[]) => {
    if (blockOfflineBusinessWrite('product or stock changes')) {
      return productsMap[activeTenant.id] || [];
    }

    const previousProducts = productsMap[activeTenant.id] || [];
    const syncUpdatedAt = new Date().toISOString();
    const deletedProductIds = previousProducts
      .filter((product) => !updatedProducts.some((nextProduct) => nextProduct.id === product.id))
      .map((product) => product.id)
      .filter(Boolean);
    if (deletedProductIds.length > 0) {
      markLocalProductTombstones(activeTenant.id, deletedProductIds, syncUpdatedAt);
    }
    const syncedProducts = stampProductsForSync(updatedProducts, previousProducts, syncUpdatedAt);
    const updatedProductsMap = {
      ...productsMap,
      [activeTenant.id]: syncedProducts,
    };

    markTenantProductsUpdated(activeTenant.id, syncUpdatedAt);
    saveData(
      activeTenant.id,
      'products_map',
      attachPayloadProductTombstones(
        { [activeTenant.id]: syncedProducts },
        activeTenant.id,
        readLocalProductTombstones(activeTenant.id),
      ),
    );
    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;

    const workspace: TenantWorkspace = {
      branches:             branchesMap[activeTenant.id]             || [],
      branchStocks:         branchStocksMap[activeTenant.id]         || [],
      branchStaffAssignments: branchStaffAssignmentsMap[activeTenant.id] || [],
      products:             syncedProducts,
      sales:                salesMap[activeTenant.id]                || [],
      expenses:             expensesMap[activeTenant.id]             || [],
      settings:             systemSettings,
      deliveries:           deliveriesMap[activeTenant.id]           || [],
      pendingDeliveryNotes: pendingDeliveryNotesMap[activeTenant.id] || [],
      purchases:            purchasesMap[activeTenant.id]            || [],
      productTombstones:    readLocalProductTombstones(activeTenant.id),
    };

    saveTenantWorkspace(activeTenant.id, workspace).catch((error) => {
      console.warn('[Dashboard] Unable to immediately sync updated products workspace:', error);
    });
    return syncedProducts;
  };

  const persistSystemSettingsNow = (updated: SystemSettings) => {
    if (blockOfflineBusinessWrite('settings changes')) {
      return systemSettings;
    }

    const previousSettings = systemSettings;
    const saveVersion = settingsSaveVersionRef.current + 1;
    settingsSaveVersionRef.current = saveVersion;
    const syncUpdatedAt = new Date().toISOString();
    const safeUpdatedSettings = normalizeSystemSettings(activeTenant, updated);
    const syncedSettings = stampSettingsForSync(safeUpdatedSettings, systemSettings, syncUpdatedAt);
    setDatabaseBusinessName(String(syncedSettings.business?.businessName || '').trim());
    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    skipNextWorkspaceSaveRef.current = true;
    setSystemSettings(syncedSettings);
    void saveTenantSettings(activeTenant.id, syncedSettings).then((saved) => {
      if (saved || settingsSaveVersionRef.current !== saveVersion) return;
      setSystemSettings(previousSettings);
      setDatabaseBusinessName(String(previousSettings.business?.businessName || '').trim());
      addToast('Settings could not be saved safely. Your previous saved settings were kept.', 'error');
    });
    return syncedSettings;
  };

  const handleUpdateActiveStocks = (updatedProducts: Product[]) => {
    if (blockOfflineBusinessWrite('stock adjustment')) return;

    const tenantProducts = productsMap[activeTenant.id] || [];
    const safeCatalogueUpdates = updatedProducts.map(updated => {
      const existing = tenantProducts.find(product => product.id === updated.id);
      if (!existing || recordBelongsToActiveBranch(existing, activeBranchSelection)) return updated;
      // A product shared into this branch through BranchStock keeps its tenant/
      // owning-branch catalogue record unchanged; only this branch's stock row
      // is updated below.
      return existing;
    });
    const nextTenantProducts = mergeScopedProducts(tenantProducts, safeCatalogueUpdates);
    if (activeBranchSelection.activeScope === 'branch' && activeBranchSelection.activeBranchId) {
      const now = new Date().toISOString();
      setBranchStocksMap(previous => {
        const tenantStocks = previous[activeTenant.id] || [];
        const updates = new Map(updatedProducts.map(product => [product.id, product]));
        const retained = tenantStocks.filter(stock => (
          stock.branchId !== activeBranchSelection.activeBranchId || !updates.has(stock.productId)
        ));
        const branchStockUpdates = updatedProducts.map(product => {
          const existing = tenantStocks.find(stock => (
            stock.branchId === activeBranchSelection.activeBranchId && stock.productId === product.id
          ));
          return {
            id: existing?.id || `branch-stock-${activeBranchSelection.activeBranchId}-${product.id}`,
            tenantId: activeTenant.id,
            branchId: activeBranchSelection.activeBranchId!,
            productId: product.id,
            quantity: Number(product.stockQty || 0),
            shopStockQty: Number(product.shopStockQty || 0),
            storeStockQty: Number(product.storeStockQty || 0),
            buyingPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            lowStockAlert: product.alertQty,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
          } satisfies BranchStock;
        });
        return { ...previous, [activeTenant.id]: [...retained, ...branchStockUpdates] };
      });
    }
    const syncedProducts = persistTenantProductsNow(nextTenantProducts);
    setProductsMap(prev => ({
      ...prev,
      [activeTenant.id]: syncedProducts
    }));
    
    // Add real-time log action
    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'product_update',
      status: 'success',
      message: `Adjusted inventory stock counts on central ledger for branch: ${activeTenant.name}`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleUpdateSales = async (updatedSales: Sale[]): Promise<boolean> => {
    if (blockOfflineBusinessWrite('sales ledger update')) return false;

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    const syncUpdatedAt = new Date().toISOString();
    const previousScopedSales = new Map(activeSales.map(sale => [sale.id, sale]));
    const synchronizedScopedSales = updatedSales.map((sale) => {
      const previous = previousScopedSales.get(sale.id);
      return previous === sale ? sale : { ...sale, syncUpdatedAt };
    });
    const synchronizedSales = replaceScopedBranchRecords(
      salesMap[activeTenant.id] || [],
      synchronizedScopedSales,
      activeBranchSelection,
    );
    const workspace: TenantWorkspace = {
      branches: branchesMap[activeTenant.id] || [],
      branchStocks: branchStocksMap[activeTenant.id] || [],
      branchStaffAssignments: branchStaffAssignmentsMap[activeTenant.id] || [],
      products: productsMap[activeTenant.id] || [],
      sales: synchronizedSales,
      expenses: expensesMap[activeTenant.id] || [],
      settings: systemSettings,
      deliveries: deliveriesMap[activeTenant.id] || [],
      pendingDeliveryNotes: pendingDeliveryNotesMap[activeTenant.id] || [],
      purchases: purchasesMap[activeTenant.id] || [],
      productTombstones: readLocalProductTombstones(activeTenant.id),
      saleTombstones: readLocalSaleTombstones(activeTenant.id),
    };
    const saved = await saveTenantWorkspace(activeTenant.id, workspace);
    if (!saved) {
      addToast('Sale changes could not be saved. Nothing was changed.', 'error');
      return false;
    }
    setSalesMap(prev => ({
      ...prev,
      [activeTenant.id]: synchronizedSales
    }));
    
    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'sale',
      status: 'success',
      message: `Updated and re-synchronized active sales ledger for branch: ${activeTenant.name}`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    return true;
  };

  const handleDeleteSale = async (sale: Sale): Promise<boolean> => {
    if (blockOfflineBusinessWrite('sale deletion')) return false;
    if (!sale?.id) {
      addToast('This sale has no valid transaction ID and could not be deleted.', 'error');
      return false;
    }

    const tenantId = activeTenant.id;
    const currentSales = salesMap[tenantId] || [];
    const persistedSale = currentSales.find(candidate => candidate.id === sale.id);
    if (!persistedSale) return true;

    // Older workspace sales can legitimately predate the tenantId field. Their
    // presence inside the active tenant's canonical workspace establishes the
    // tenant boundary; an explicit conflicting tenant ID is still rejected.
    if (saleHasTenantConflict(sale, persistedSale, tenantId)) {
      console.warn('[Dashboard] Blocked sale deletion outside the active tenant.');
      addToast('This sale belongs to a different business and cannot be deleted here.', 'error');
      return false;
    }

    if (!recordBelongsToActiveBranch(persistedSale, activeBranchSelection)) {
      addToast('Switch to the branch that owns this sale before deleting it.', 'error');
      return false;
    }

    const deletedAt = new Date().toISOString();
    const previousSaleTombstones = readLocalSaleTombstones(tenantId);
    const nextSaleTombstones = markLocalSaleTombstone(tenantId, sale.id, deletedAt);
    const nextSales = currentSales.filter(candidate => candidate.id !== sale.id);
    const currentProducts = productsMap[tenantId] || [];

    const restoredProducts = reverseSaleInventory(persistedSale, currentProducts, deletedAt);
    const nextDeliveries = (deliveriesMap[tenantId] || [])
      .filter(delivery => delivery.saleId !== sale.id);

    const saved = await saveTenantWorkspace(tenantId, {
      branches: branchesMap[tenantId] || [],
      branchStocks: branchStocksMap[tenantId] || [],
      branchStaffAssignments: branchStaffAssignmentsMap[tenantId] || [],
      products: restoredProducts,
      sales: nextSales,
      expenses: expensesMap[tenantId] || [],
      settings: systemSettings,
      deliveries: nextDeliveries,
      pendingDeliveryNotes: pendingDeliveryNotesMap[tenantId] || [],
      purchases: purchasesMap[tenantId] || [],
      productTombstones: readLocalProductTombstones(tenantId),
      saleTombstones: nextSaleTombstones,
    });

    if (!saved) {
      writeLocalSaleTombstones(tenantId, previousSaleTombstones);
      addToast('Sale could not be deleted from the database. Nothing was removed.', 'error');
      return false;
    }

    if (persistedSale.treasuryJournalId) {
      try {
        await reverseTreasuryEntry(
          persistedSale.treasuryJournalId,
          persistedSale.id,
          `Deleted sale ${persistedSale.reference || persistedSale.id}`,
        );
      } catch (error: any) {
        writeLocalSaleTombstones(tenantId, previousSaleTombstones);
        await saveTenantWorkspace(tenantId, {
          branches: branchesMap[tenantId] || [],
          branchStocks: branchStocksMap[tenantId] || [],
          branchStaffAssignments: branchStaffAssignmentsMap[tenantId] || [],
          products: currentProducts,
          sales: currentSales,
          expenses: expensesMap[tenantId] || [],
          settings: systemSettings,
          deliveries: deliveriesMap[tenantId] || [],
          pendingDeliveryNotes: pendingDeliveryNotesMap[tenantId] || [],
          purchases: purchasesMap[tenantId] || [],
          productTombstones: readLocalProductTombstones(tenantId),
          saleTombstones: previousSaleTombstones,
        });
        addToast(error?.message || 'Money & Bank could not reverse this sale safely.', 'error');
        return false;
      }
    }

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    setSalesMap(previous => ({ ...previous, [tenantId]: nextSales }));
    setProductsMap(previous => ({ ...previous, [tenantId]: restoredProducts }));
    setDeliveriesMap(previous => ({ ...previous, [tenantId]: nextDeliveries }));
    saveData(
      tenantId,
      'sales_map',
      attachPayloadSaleTombstones(
        { [tenantId]: nextSales },
        tenantId,
        nextSaleTombstones,
      ),
    );
    saveData(tenantId, 'products_map', { [tenantId]: restoredProducts });
    saveData(tenantId, 'deliveries_map', { [tenantId]: nextDeliveries });

    setLogs(previous => [{
      id: `sale-delete-${sale.id}-${Date.now()}`,
      type: 'sale',
      status: 'success',
      message: `Deleted sale ${sale.reference || sale.id} and reversed its inventory movements.`,
      timestamp: deletedAt,
    }, ...previous]);
    return true;
  };

  const handleSendToDeliveryNote = (sale: Sale) => {
    if (blockOfflineBusinessWrite('delivery note creation')) return;

    const newDelivery: Delivery = {
      id: `DL-${sale.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
      saleId: sale.id,
      customerName: sale.customerName || 'Walk-In Customer',
      customerPhone: sale.customerPhone || '',
      items: sale.items,
      totalAmount: sale.total,
      deliveryPaymentMethod: sale.deliveryPaymentMethod || '',
      deliveryCost: sale.deliveryCost || 0,
      status: 'Pending Dispatch',
      timestamp: sale.timestamp,
      tenantId: activeTenant.id,
      branchId: sale.branchId || activeBranchSelection.activeBranchId || undefined,
    };

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    setDeliveriesMap(prev => {
      const currentDeliveries = prev[activeTenant.id] || [];
      if (currentDeliveries.some(delivery => delivery.saleId === sale.id)) return prev;
      return { ...prev, [activeTenant.id]: [newDelivery, ...currentDeliveries] };
    });

    // Go directly to the operational dispatch queue, not the document-notes workspace.
    setDeliveriesSubTab('queue');
    setActiveTab('deliveries');
  };

  const handleUpdatePendingDeliveryNotes = (updatedNotes: any[]) => {
    if (blockOfflineBusinessWrite('pending delivery notes update')) return;

    const tenantNotes = replaceScopedBranchRecords(
      pendingDeliveryNotesMap[activeTenant.id] || [],
      updatedNotes,
      activeBranchSelection,
    );
    const updated = {
      ...pendingDeliveryNotesMap,
      [activeTenant.id]: tenantNotes
    };
    setPendingDeliveryNotesMap(updated);
    safeSetTenantMapItem('jasper_pending_delivery_notes_map', 'pending_delivery_notes_map', updated);
    saveData(activeTenant.id, 'pending_delivery_notes_map', updated);
  };

  const handleAddSale = async (sale: Sale) => {
    if (blockOfflineBusinessWrite('POS sale')) return false;

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    const syncUpdatedAt = new Date().toISOString();
    let saleToStore = {
      ...sale,
      branchId: sale.branchId || activeBranchSelection.activeBranchId || undefined,
      syncUpdatedAt,
    } as Sale;
    const saleIncome = Math.max(0, Number(sale.total || 0) - Number(sale.deliveryCost || 0));
    const collectedAmount = sale.paymentStatus === 'unpaid'
      ? 0
      : Math.min(saleIncome, Math.max(0, Number(sale.amountPaid ?? saleIncome)));
    const localDemoWithoutTreasury = collectedAmount > 0
      && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      && isPlaceholderSecureDataBridgeClient(await getSecureDataBridgeClient());
    if (collectedAmount > 0 && !localDemoWithoutTreasury) {
      // Reconcile against currently configured payment modes rather than reading
      // systemSettings.paymentChannels raw: that array is only seeded/persisted the
      // first time a tenant opens Money & Bank, so a tenant who never opened that
      // screen (or who just added a new payment mode) would have no matching
      // account here and every checkout would be blocked, regardless of the
      // payment mode chosen. reconcilePaymentChannels auto-derives a channel for
      // every active payment mode, matching the pattern already used in
      // DashboardCashBank.tsx.
      const channels = reconcilePaymentChannels(
        getTreasuryPaymentMethods(systemSettings.business),
        systemSettings.paymentChannels || [],
        { currency: activeTenant.currencyCode },
      );
      const rawBreakdown = sale.paymentBreakdown?.length
        ? sale.paymentBreakdown
        : [{ method: sale.paymentMethod || 'Cash', amount: collectedAmount }];
      const availableTotal = rawBreakdown.reduce((sum, part) => sum + Math.max(0, Number(part.amount || 0)), 0);
      const scale = availableTotal > collectedAmount && availableTotal > 0
        ? collectedAmount / availableTotal
        : 1;
      const paymentLines = rawBreakdown
        .map(part => {
          const channel = findPaymentChannel(channels, part.method || sale.paymentMethod || 'Cash');
          return {
            sourceAccountKey: channel?.id || '',
            amount: Math.max(0, Number(part.amount || 0)) * scale,
          };
        })
        .filter(line => line.amount > 0);
      if (paymentLines.some(line => !line.sourceAccountKey)) {
        addToast('Every sale payment must use an active Money & Bank account.', 'error');
        return false;
      }
      try {
        const posted = await postTreasurySplitIncome({
          channels,
          lines: paymentLines,
          sourceType: 'sale',
          sourceId: sale.id,
          description: `Sale payment ${sale.reference || sale.id}`,
          openingBalances: getTreasuryOpeningBalances(),
          metadata: {
            reference: sale.reference,
            cashierName: sale.cashierName,
            customerName: sale.customerName || null,
          },
        });
        saleToStore = {
          ...saleToStore,
          branchId: posted.branchId,
          treasuryJournalId: posted.journalId,
        };
      } catch (error: any) {
        addToast(error?.message || 'Money & Bank could not post this sale safely.', 'error');
        return false;
      }
    }
    setSalesMap(prev => {
      const currentTenantSales = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: [saleToStore, ...currentTenantSales]
      };
    });

    // Handle Global Owner Sale Notification
    try {
       // Estimate total cost of sale to determine profit
       let totalCost = 0;
       const summaryStrings = [];
       sale.items.forEach(item => {
          totalCost += ((item.costPriceAtSale || 0) * item.qty);
          summaryStrings.push(`${item.qty}x ${item.productName}`);
       });
       const estimatedProfit = sale.total - totalCost;

       addSaleNotification({
          tenantId: sale.tenantId,
          moduleName: activeTenant.businessType === 'pharmacy' ? 'pharmacy' : (sale.channel === 'wholesale' ? 'wholesale' : 'retail'),
          amount: sale.total,
          profit: estimatedProfit,
          paymentMethod: sale.paymentMethod,
          cashierName: sale.cashierName || user.name,
          itemsSummary: summaryStrings.join(', ')
       });
    } catch(e) {
       console.error("Failed to parse sale notification event", e);
    }

    if (sale.syncStatus === 'pending') {
      savePendingSaleOffline(saleToStore).catch(() => {});
    }

    // Auto trigger delivery dispatch if deliveryCost was paid
    if (sale.deliveryCost && sale.deliveryCost > 0) {
      const newDelivery: Delivery = {
        id: 'DL-' + sale.id.substring(3).toUpperCase(),
        saleId: sale.id,
        customerName: sale.customerName || 'Walk-In Customer',
        customerPhone: sale.customerPhone || '',
        items: sale.items,
        totalAmount: sale.total,
        deliveryPaymentMethod: sale.deliveryPaymentMethod || systemSettings?.business?.deliveryPaymentModes?.[0] || 'Cash',
        deliveryCost: sale.deliveryCost,
        status: 'Pending Dispatch',
        timestamp: sale.timestamp,
        tenantId: sale.tenantId,
        branchId: saleToStore.branchId || activeBranchSelection.activeBranchId || undefined,
      };
      setDeliveriesMap(prev => {
        const currentDeliveries = prev[sale.tenantId] || [];
        return {
          ...prev,
          [sale.tenantId]: [newDelivery, ...currentDeliveries]
        };
      });
    }

    // Logging sales logs
    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'sale',
      status: sale.syncStatus === 'pending' ? 'warning' : 'success',
      message: sale.syncStatus === 'pending'
        ? `Sale (Ref: ${sale.id}) needs online confirmation. Offline queue replay is disabled.`
        : `Sale (Ref: ${sale.id}) saved as a manual ${sale.paymentMethod || 'payment'} record.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    return true;
  };

  const handleAddRider = (newRider: DeliveryRider) => {
    setRiders(prev => [{
      ...newRider,
      branchId: activeBranchSelection.activeBranchId || undefined,
    }, ...prev]);
  };

  const handleDispatchDelivery = (deliveryId: string, riderDetails: NonNullable<Delivery['riderDetails']>, riderId?: string, customerData?: { name: string, phone: string, location: string, paymentMethod?: string }) => {
    if (blockOfflineBusinessWrite('delivery dispatch')) return;
    const delivery = (deliveriesMap[activeTenant.id] || []).find(item => item.id === deliveryId);
    if (!delivery || !recordBelongsToActiveBranch(delivery, activeBranchSelection)) return;

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    setDeliveriesMap(prev => {
      const currentTenantDels = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: currentTenantDels.map(del => 
          del.id === deliveryId 
            ? { 
                ...del, 
                status: 'Dispatched', 
                riderId, 
                riderDetails, 
                dispatchedAt: new Date().toISOString(),
                ...(customerData ? { 
                  customerName: customerData.name || del.customerName, 
                  customerPhone: customerData.phone || del.customerPhone, 
                  notes: customerData.location || del.notes,
                  ...(customerData.paymentMethod ? { deliveryPaymentMethod: customerData.paymentMethod } : {})
                } : {})
              } 
            : del
        )
      };
    });

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'product_update',
      status: 'success',
      message: `Dispatched order for ${riderDetails.name} to deliver to customer. Route tracked.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleUpdateDeliveryStatus = async (deliveryId: string, status: Delivery['status']) => {
    if (blockOfflineBusinessWrite('delivery status update')) return false;
    const currentDelivery = (deliveriesMap[activeTenant.id] || []).find(delivery => delivery.id === deliveryId);
    if (!currentDelivery || !recordBelongsToActiveBranch(currentDelivery, activeBranchSelection)) return false;
    let treasuryJournalId = currentDelivery.treasuryJournalId;
    let treasuryBranchId = currentDelivery.branchId;
    let collectedAccountId = currentDelivery.deliveryPaymentAccountId;

    const deliveryIncomeAmount = Math.max(0, Number(currentDelivery.deliveryCost || 0));
    if (
      status === 'Delivered'
      && currentDelivery.deliveryPaymentStatus !== 'collected'
      && deliveryIncomeAmount > 0
    ) {
      const account = findPaymentChannel(
        systemSettings.paymentChannels || [],
        currentDelivery.deliveryPaymentMethod || 'Cash',
      );
      if (!account) {
        addToast('Select an active delivery payment account before marking this delivery as collected.', 'error');
        return false;
      }
      try {
        const posted = await postTreasuryEntry({
          channels: systemSettings.paymentChannels || [],
          sourceAccountKey: account.id,
          amount: deliveryIncomeAmount,
          direction: 'in',
          sourceType: 'delivery',
          sourceId: currentDelivery.id,
          description: `Collected delivery income for ${currentDelivery.id}`,
          openingBalances: getTreasuryOpeningBalances(),
          metadata: {
            saleId: currentDelivery.saleId,
            customerName: currentDelivery.customerName,
          },
        });
        treasuryJournalId = posted.journalId;
        treasuryBranchId = posted.branchId;
        collectedAccountId = account.id;
      } catch (error: any) {
        addToast(error?.message || 'Money & Bank could not post this delivery income safely.', 'error');
        return false;
      }
    }
    if (status === 'Cancelled' && currentDelivery.treasuryJournalId) {
      try {
        await reverseTreasuryEntry(
          currentDelivery.treasuryJournalId,
          currentDelivery.id,
          `Cancelled delivery collection: ${currentDelivery.id}`,
        );
        treasuryJournalId = undefined;
      } catch (error: any) {
        addToast(error?.message || 'Money & Bank could not reverse this delivery income safely.', 'error');
        return false;
      }
    }

    setDeliveriesMap(prev => {
      const currentTenantDels = prev[activeTenant.id] || [];
      const collectedAt = status === 'Delivered' ? new Date().toISOString() : undefined;
      return {
        ...prev,
        [activeTenant.id]: currentTenantDels.map(del => 
          del.id === deliveryId
            ? (() => {
                return {
                  ...del,
                  status,
                  deliveredAt: collectedAt,
                  deliveryPaymentStatus: status === 'Delivered'
                    ? 'collected'
                    : status === 'Cancelled'
                      ? 'cancelled'
                      : 'pending',
                  paymentCollectedAt: collectedAt,
                  deliveryPaymentAccountId: status === 'Delivered'
                    ? collectedAccountId
                    : undefined,
                  treasuryJournalId,
                  branchId: treasuryBranchId,
                };
              })()
            : del
        )
      };
    });

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'product_update',
      status: status === 'Delivered' ? 'success' : 'failed',
      message: `Delivery dispatch ${deliveryId} status updated: ${status}.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    return true;
  };

  const handleUpdateDeliveryDetails = async (
    deliveryId: string,
    updates: { customerName?: string; customerPhone?: string; deliveryCost?: number; notes?: string },
  ): Promise<boolean> => {
    if (blockOfflineBusinessWrite('delivery edit')) return false;
    const currentDelivery = (deliveriesMap[activeTenant.id] || []).find(delivery => delivery.id === deliveryId);
    if (!currentDelivery || !recordBelongsToActiveBranch(currentDelivery, activeBranchSelection)) {
      addToast('Switch to the branch that owns this delivery before editing it.', 'error');
      return false;
    }

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    const nextDeliveries = (deliveriesMap[activeTenant.id] || []).map(del =>
      del.id === deliveryId
        ? {
            ...del,
            ...(updates.customerName !== undefined ? { customerName: updates.customerName } : {}),
            ...(updates.customerPhone !== undefined ? { customerPhone: updates.customerPhone } : {}),
            ...(updates.deliveryCost !== undefined ? { deliveryCost: updates.deliveryCost } : {}),
            ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
          }
        : del
    );
    const saved = await saveTenantWorkspace(activeTenant.id, {
      branches: branchesMap[activeTenant.id] || [],
      branchStocks: branchStocksMap[activeTenant.id] || [],
      branchStaffAssignments: branchStaffAssignmentsMap[activeTenant.id] || [],
      products: productsMap[activeTenant.id] || [],
      sales: salesMap[activeTenant.id] || [],
      expenses: expensesMap[activeTenant.id] || [],
      settings: systemSettings,
      deliveries: nextDeliveries,
      pendingDeliveryNotes: pendingDeliveryNotesMap[activeTenant.id] || [],
      purchases: purchasesMap[activeTenant.id] || [],
      productTombstones: readLocalProductTombstones(activeTenant.id),
      saleTombstones: readLocalSaleTombstones(activeTenant.id),
    });
    if (!saved) return false;
    setDeliveriesMap(prev => ({ ...prev, [activeTenant.id]: nextDeliveries }));

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'product_update',
      status: 'success',
      message: `Delivery ${deliveryId} details were edited.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    return true;
  };

  const handleDeleteDelivery = async (deliveryId: string): Promise<boolean> => {
    if (blockOfflineBusinessWrite('delivery deletion')) return false;
    const tenantId = activeTenant.id;
    const currentDeliveries = deliveriesMap[tenantId] || [];
    const currentDelivery = currentDeliveries.find(delivery => delivery.id === deliveryId);
    if (!currentDelivery) return true;
    if (!recordBelongsToActiveBranch(currentDelivery, activeBranchSelection)) {
      addToast('Switch to the branch that owns this delivery before deleting it.', 'error');
      return false;
    }

    const nextDeliveries = currentDeliveries.filter(delivery => delivery.id !== deliveryId);

    const workspaceBase = {
      branches: branchesMap[tenantId] || [],
      branchStocks: branchStocksMap[tenantId] || [],
      branchStaffAssignments: branchStaffAssignmentsMap[tenantId] || [],
      products: productsMap[tenantId] || [],
      sales: salesMap[tenantId] || [],
      expenses: expensesMap[tenantId] || [],
      settings: systemSettings,
      pendingDeliveryNotes: pendingDeliveryNotesMap[tenantId] || [],
      purchases: purchasesMap[tenantId] || [],
      productTombstones: readLocalProductTombstones(tenantId),
    };

    const saved = await saveTenantWorkspace(tenantId, { ...workspaceBase, deliveries: nextDeliveries });
    if (!saved) {
      addToast('Delivery could not be deleted from the database. Nothing was removed.', 'error');
      return false;
    }

    if (currentDelivery.treasuryJournalId) {
      try {
        await reverseTreasuryEntry(
          currentDelivery.treasuryJournalId,
          currentDelivery.id,
          `Deleted delivery ${currentDelivery.id}`,
        );
      } catch (error: any) {
        await saveTenantWorkspace(tenantId, { ...workspaceBase, deliveries: currentDeliveries });
        addToast(error?.message || 'Money & Bank could not reverse this delivery income safely.', 'error');
        return false;
      }
    }

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    setDeliveriesMap(previous => ({ ...previous, [tenantId]: nextDeliveries }));
    saveData(tenantId, 'deliveries_map', { [tenantId]: nextDeliveries });

    setLogs(previous => [{
      id: `delivery-delete-${deliveryId}-${Date.now()}`,
      type: 'product_update',
      status: 'success',
      message: `Deleted delivery ${currentDelivery.id}${currentDelivery.treasuryJournalId ? ' and reversed its collected income' : ''}.`,
      timestamp: new Date().toISOString(),
    }, ...previous]);
    return true;
  };

  const handleCreateProduct = (newProd: Product) => {
    if (blockOfflineBusinessWrite('product creation')) return;

    const branchScopedProduct = {
      ...newProd,
      branchId: activeBranchSelection.activeBranchId || undefined,
    };
    const updatedProducts = [branchScopedProduct, ...(productsMap[activeTenant.id] || [])];
    const syncedProducts = persistTenantProductsNow(updatedProducts);
    setProductsMap(prev => {
      return {
        ...prev,
        [activeTenant.id]: syncedProducts
      };
    });

    // Mark that local workspace has changed so the sync useEffect saves it
    localWorkspaceChangedAtRef.current = Date.now();
    // Ensure cloudWorkspaceLoadedRef is set so protection check doesn't skip save
    cloudWorkspaceLoadedRef.current = true;

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'product_update',
      status: 'success',
      message: `Registered new catalog item: ${newProd.name} (Code: ${newProd.barcode || newProd.sku}) at branch ${activeTenant.name}.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleDeleteProduct = (id: string) => {
    if (blockOfflineBusinessWrite('product delete/archive')) return;

    const tenantProducts = productsMap[activeTenant.id] || [];
    const product = tenantProducts.find(item => item.id === id);
    if (!product || !activeProducts.some(item => item.id === id)) return;
    if (!recordBelongsToActiveBranch(product, activeBranchSelection)) {
      if (!activeBranchSelection.activeBranchId) return;
      setBranchStocksMap(previous => ({
        ...previous,
        [activeTenant.id]: (previous[activeTenant.id] || []).filter(stock => !(
          stock.branchId === activeBranchSelection.activeBranchId
          && stock.productId === id
        )),
      }));
      return;
    }
    const updatedProducts = tenantProducts.filter(p => p.id !== id);
    const syncedProducts = persistTenantProductsNow(updatedProducts);
    setProductsMap(prev => {
      return {
        ...prev,
        [activeTenant.id]: syncedProducts
      };
    });

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'product_update',
      status: 'success',
      message: `De-registered catalog item from active store: ${activeTenant.name}`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleCreateSupplier = (newSup: Supplier) => {
    setSuppliers(prev => [{
      ...newSup,
      tenantId: activeTenant.id,
      branchId: activeBranchSelection.activeBranchId || undefined,
    }, ...prev]);

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'inventory_audit',
      status: 'success',
      message: `Linked external logistics supply vendor: ${newSup.name} into master catalog directory.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleAddPurchase = async (purchase: Purchase) => {
    if (blockOfflineBusinessWrite('purchase entry')) return false;

    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    purchase = {
      ...purchase,
      branchId: purchase.branchId || activeBranchSelection.activeBranchId || undefined,
    };
    if (Number(purchase.amountPaid || 0) > 0) {
      try {
        const posted = await postTreasuryEntry({
          channels: systemSettings.paymentChannels || [],
          sourceAccountKey: String(purchase.paidFromAccountId || ''),
          amount: Number(purchase.amountPaid || 0),
          direction: 'out',
          sourceType: 'purchase',
          sourceId: purchase.id,
          description: `Purchase payment to ${purchase.supplierName}`,
          openingBalances: getTreasuryOpeningBalances(),
          metadata: {
            supplierId: purchase.supplierId,
            supplierName: purchase.supplierName,
            totalAmount: purchase.totalAmount,
          },
        });
        purchase = {
          ...purchase,
          branchId: posted.branchId,
          treasuryJournalId: posted.journalId,
        };
      } catch (error: any) {
        addToast(error?.message || 'Money & Bank could not post this purchase safely.', 'error');
        return false;
      }
    }
    setPurchasesMap(prev => {
      const currentTenantPurchases = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: [purchase, ...currentTenantPurchases]
      };
    });

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'inventory_audit',
      status: 'success',
      message: `Procured warehouse stocks (Ref: ${purchase.id}) from ${purchase.supplierName} inside ${purchase.destination === 'shop' ? 'Shop Floor shelves' : 'Backroom Storage'}`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    return true;
  };

  const handleUpdatePurchases = async (nextPurchases: Purchase[]): Promise<boolean> => {
    if (blockOfflineBusinessWrite('purchase update')) return false;
    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    const tenantPurchases = replaceScopedBranchRecords(
      purchasesMap[activeTenant.id] || [],
      nextPurchases,
      activeBranchSelection,
    );
    const saved = await saveTenantWorkspace(activeTenant.id, {
      branches: branchesMap[activeTenant.id] || [],
      branchStocks: branchStocksMap[activeTenant.id] || [],
      branchStaffAssignments: branchStaffAssignmentsMap[activeTenant.id] || [],
      products: productsMap[activeTenant.id] || [],
      sales: salesMap[activeTenant.id] || [],
      expenses: expensesMap[activeTenant.id] || [],
      settings: systemSettings,
      deliveries: deliveriesMap[activeTenant.id] || [],
      pendingDeliveryNotes: pendingDeliveryNotesMap[activeTenant.id] || [],
      purchases: tenantPurchases,
      productTombstones: readLocalProductTombstones(activeTenant.id),
      saleTombstones: readLocalSaleTombstones(activeTenant.id),
    });
    if (!saved) return false;
    setPurchasesMap(prev => ({ ...prev, [activeTenant.id]: tenantPurchases }));
    return true;
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (blockOfflineBusinessWrite('purchase deletion')) return false;
    const purchase = (purchasesMap[activeTenant.id] || []).find(item => item.id === purchaseId);
    if (!purchase || !recordBelongsToActiveBranch(purchase, activeBranchSelection)) return false;
    if (purchase?.treasuryJournalId) {
      try {
        await reverseTreasuryEntry(
          purchase.treasuryJournalId,
          purchase.id,
          `Voided purchase payment: ${purchase.supplierName}`,
        );
      } catch (error: any) {
        addToast(error?.message || 'Money & Bank could not reverse this purchase safely.', 'error');
        return false;
      }
    }
    localWorkspaceChangedAtRef.current = Date.now();
    cloudWorkspaceLoadedRef.current = true;
    setPurchasesMap(prev => ({
      ...prev,
      [activeTenant.id]: (prev[activeTenant.id] || []).filter(purchase => purchase.id !== purchaseId)
    }));
    setLogs(prev => [{
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'inventory_audit',
      status: 'success',
      message: `Removed purchase record ${purchaseId} from ${activeTenant.name}. Product stock was not silently changed.`,
      timestamp: new Date().toISOString()
    }, ...prev]);
    return true;
  };

  // Switch store tenant controller
  const handleTenantChange = (tenantId: string) => {
    const matched = tenantsList.find(t => t.id === tenantId);
    if (matched) {
      setActiveTenant(matched);
      // Automatically adjust visual tab layout of active workspace
      if (matched.businessType === 'hotel') {
        setActiveTab('hotel-pms');
      } else if (matched.businessType === 'restaurant') {
        setActiveTab('restaurant-hub');
      } else if (matched.businessType === 'pharmacy') {
        setActiveTab('sandbox-pms');
      } else {
        setActiveTab('overview');
      }
      
      // Auto register a log trace of changing desks
      const newLog: SyncLog = {
        id: 'l-' + Math.random().toString(36).substr(2, 9),
        type: 'auth_sync',
        status: 'success',
        message: `Active user terminal pivoted to multi-tenant node: ${matched.name} (${matched.city})`,
        timestamp: new Date().toISOString()
      };
      setLogs(prev => [newLog, ...prev]);
    }
  };

  // Legacy pending queue review: replay is disabled in online-only mode.
  const handleSyncOfflineQueue = (callback: () => void) => {
    const newLog: SyncLog = {
      id: 'ONLINE-ONLY-SYNC-' + Math.random().toString(36).slice(2, 8),
      type: 'sale',
      status: 'warning',
      message: 'Offline queue replay is disabled to protect tenant data. Existing pending records were not deleted.',
      timestamp: new Date().toISOString()
    };

    setLogs(prev => [newLog, ...prev]);
    callback();
  };

  // Turn off offline state and record that legacy queue replay stays disabled.
  const handleToggleOnlineAndSync = () => {
    setIsOfflineMode(false);
    
    // Log the reconnect sequence
    const reconnectLog: SyncLog = {
      id: 'RECONNECT-' + Math.random().toString(36).substring(3, 8),
      type: 'auth_sync',
      status: 'success',
      message: `Network connectivity re-established. Legacy queue replay remains disabled.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [reconnectLog, ...prev]);

    // Preserve queue without replay.
    handleSyncOfflineQueue(() => {
      console.log('[Dashboard] Legacy offline queue preserved; replay disabled.');
    });
  };

  useEffect(() => {
    if (!isOfflineMode) {
      const currentList = salesMap[currentTenantId] || [];
      const pendingCount = currentList.filter(s => s.syncStatus === 'pending').length;
      if (pendingCount > 0) {
        // Preserve pending records for manual review.
        const logMsg = `Network connected. ${pendingCount} legacy pending receipt(s) preserved; replay disabled.`;
        setLogs(prev => [{
          id: 'AUTO-SYNC-' + Math.random().toString(36).substring(3, 8),
          type: 'system_action',
          status: 'success',
          message: logMsg,
          timestamp: new Date().toISOString()
        }, ...prev]);

        handleSyncOfflineQueue(() => {
          console.log('[Dashboard] Legacy pending queue preserved; replay disabled.');
        });
      }
    }
  }, [isOfflineMode, salesMap, currentTenantId]);

  // Calculate size of offline sync queue
  const offlinePendingCount = activeSales.filter(s => s.syncStatus === 'pending').length;

  // Dynamic branding selectors to personalize the user's Orvix
  const currentThemeMode = systemSettings.company?.themeMode || 'light';
  const customBrandingLogo = currentThemeMode === 'dark'
    ? (systemSettings.business?.businessLogoDark || systemSettings.business?.businessLogoLight || systemSettings.business?.businessLogo)
    : (systemSettings.business?.businessLogoLight || systemSettings.business?.businessLogoDark || systemSettings.business?.businessLogo);
  
  const activeProfileBusinessName = String(databaseBusinessName || '').trim();
  const branchContextBusinessName = String(
    branchContextSelectedBranch?.businessName || branchContextSelectedBranch?.branchName || ''
  ).trim();
  // On the main/default branch (including the virtual compatibility-primary
  // branch every tenant starts on before creating a physical branch), the
  // branch RPC's businessName is sourced from tenants.name - a short name
  // captured at signup, NOT the full name the user configures in Business
  // Settings. Prefer the real Business Settings name there. Only prefer the
  // branch-sourced name when a genuinely different (non-default) branch is
  // active, since that branch's own configured identity is what the user
  // wants shown in that case.
  const businessDisplayName = branchContextBusinessName
    || activeBranchBusinessName
    || activeProfileBusinessName
    || 'My Business';
  const onlineBusinessName = activeProfileBusinessName;
  const customBusinessName = businessDisplayName;
  const customBusinessAddressDetail = systemSettings.business?.businessAddress
    ? `Branch: ${systemSettings.business.businessAddress.split(',')[0]}`
    : 'Unified ERP Node';

  // Helper properties to resolve bottom navigation items dynamically
  const tab1Id = user.role === 'SuperAdmin' ? 'admin-dashboard' :
                 activeTenant.businessType === 'hotel' ? 'hotel-pms' :
                 activeTenant.businessType === 'restaurant' ? 'restaurant-hub' :
                 activeTenant.businessType === 'pharmacy' ? 'sandbox-pms' : 'overview';
  const tab1Label = user.role === 'SuperAdmin' ? 'Dashboard' :
                    activeTenant.businessType === 'hotel' ? 'Rooms' :
                    activeTenant.businessType === 'restaurant' ? 'Dining' :
                    activeTenant.businessType === 'pharmacy' ? 'Clinics' : 'Overview';
  const Tab1Icon = LayoutDashboard;

  const tab2Id = user.role === 'SuperAdmin' ? 'admin-subscribers' : 'pos';
  const tab2Label = user.role === 'SuperAdmin' ? 'Subscribers' : 'POS Till';
  const Tab2Icon = user.role === 'SuperAdmin' ? Users : ShoppingCart;

  const tab3Id = user.role === 'SuperAdmin' ? 'admin-affiliates' : 'sales-list';
  const tab3Label = user.role === 'SuperAdmin' ? 'Affiliates' : 'Sales';
  const Tab3Icon = user.role === 'SuperAdmin' ? Award : FileText;

  const tab4Id = user.role === 'SuperAdmin' ? 'admin-reports' : 'products';
  const tab4Label = user.role === 'SuperAdmin' ? 'Reports' : 'Stock';
  const Tab4Icon = user.role === 'SuperAdmin' ? Database : Package;

  // Secondary options that go inside the Bottom Sheet "More" menu
  const secondaryMenuOptions = (user.role === 'SuperAdmin'
    ? [

        { id: 'admin-status', label: 'Status & Requests', icon: Activity },
        { id: 'admin-expenses', label: 'Expenses', icon: Receipt },
        { id: 'admin-chats', label: 'Chats / Broadcasts', icon: MessageSquare },
        { id: 'admin-inbox', label: 'User Inbox', icon: Inbox },
        { id: 'admin-ad-placements', label: 'Ad Placements', icon: MonitorPlay },
        { id: 'admin-promotions', label: 'Ad Exchange SSP', icon: MonitorPlay },
        { id: 'admin-web-editor', label: 'Web Editor', icon: Globe },
        { id: 'admin-settings', label: 'Settings', icon: SettingsIcon }
      ]
    : activeTenant.businessType === 'hotel' 
      ? [
          { id: 'expenses', label: 'Expenses', icon: Receipt },
          { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
          { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
          { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
          { id: 'settings', label: 'System Settings', icon: SettingsIcon }
        ]
      : activeTenant.businessType === 'restaurant'
        ? [
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
            { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
            { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
            { id: 'settings', label: 'System Settings', icon: SettingsIcon }
          ]
      : activeTenant.businessType === 'pharmacy'
        ? [
            { id: 'purchases-list', label: 'Pharma Purchases Journal', icon: Truck },
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'inventory', label: 'Drug Stock Valuations', icon: Package },
            { id: 'suppliers', label: 'Suppliers Directory', icon: Users },
            { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
            { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
            { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
            { id: 'settings', label: 'System Settings', icon: SettingsIcon }
          ]
        : [
            { id: 'purchases-list', label: 'Purchases Journal', icon: Truck },
            { id: 'deliveries', label: 'Deliveries Menu', icon: DeliveryMotorcycleIcon },
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'inventory', label: 'Stock Valuations', icon: Package },
            { id: 'forecasting', label: 'AI Stock Forecast', icon: TrendingUp },
            { id: 'suppliers', label: 'Partners Directory', icon: Users },
            { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
            { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
            { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
            { id: 'settings', label: 'System Settings', icon: SettingsIcon }
          ]
  ).filter(item => isTabAllowed(item.id));

  // Master list of all menu items for the desktop Sidebar Menu
  const menuOptions = (user.role === 'SuperAdmin'
    ? [
        { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'admin-subscribers', label: 'Subscribers List', icon: Users },
        { id: 'admin-affiliates', label: 'Affiliates', icon: Award },

        { id: 'admin-status', label: 'Status and Request', icon: Activity },
        { id: 'admin-reports', label: 'Reports', icon: Database },
        { id: 'admin-user-activity', label: 'User Activity', icon: Users },
        { id: 'admin-expenses', label: 'Expenses', icon: Receipt },
        { id: 'admin-chats', label: 'Chats', icon: MessageSquare },
        { id: 'admin-inbox', label: 'Inbox', icon: Inbox },
        { id: 'admin-ad-placements', label: 'Ad Placements', icon: MonitorPlay },
        { id: 'admin-promotions', label: 'Ad Exchange SSP', icon: MonitorPlay },
        { id: 'admin-web-editor', label: 'Web Editor', icon: Globe },
        { id: 'admin-settings', label: 'Settings', icon: SettingsIcon }
      ]
    : activeTenant.businessType === 'hotel' 
      ? [
          { id: 'hotel-pms', label: 'Room Matrix (PMS)', icon: Bed },
          { id: 'expenses', label: 'Expenses', icon: Receipt },
          { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
          { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
          { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
          { id: 'settings', label: 'System Settings', icon: SettingsIcon }
        ]
      : activeTenant.businessType === 'restaurant'
        ? [
            { id: 'restaurant-hub', label: 'Dining & KDS Hub', icon: Utensils },
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
            { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
            { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
            { id: 'settings', label: 'System Settings', icon: SettingsIcon }
          ]
        : activeTenant.businessType === 'pharmacy'
          ? [
              { id: 'sandbox-pms', label: 'Clinical Rx Intercept', icon: Pill },
              { id: 'pos', label: 'Pharmacist Till (POS)', icon: ShoppingCart },
              { id: 'expenses', label: 'Expenses', icon: Receipt },
              { id: 'sales-list', label: 'Prescriptions & Sales', icon: FileText },
              { id: 'purchases-list', label: 'Pharma Purchases Journal', icon: Truck },
              { id: 'inventory', label: 'Drug Stock Valuations', icon: Package },
              { id: 'products', label: 'Drugs & Products Catalog', icon: Package },
              { id: 'suppliers', label: 'Suppliers Directory', icon: Users },
              { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
              { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
              { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
              { id: 'settings', label: 'System Settings', icon: SettingsIcon }
            ]
          : [
              { id: 'overview', label: 'Sales Summary', icon: LayoutDashboard },
              { id: 'pos', label: 'Cashier Till (POS)', icon: ShoppingCart },
              { id: 'expenses', label: 'Expenses', icon: Receipt },
              { id: 'sales-list', label: 'Sales List', icon: FileText },
              { id: 'purchases-list', label: 'Purchases Journal', icon: Truck },
              { id: 'deliveries', label: 'Deliveries Menu', icon: DeliveryMotorcycleIcon },
              { id: 'inventory', label: 'Stock Valuations', icon: Package },
              { id: 'forecasting', label: 'AI Stock Forecast', icon: TrendingUp },
              { id: 'products', label: 'Products Catalog', icon: Package },
              { id: 'suppliers', label: 'Partners Directory', icon: Users },
              { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
              { id: 'sync', label: 'Sync Safety Hub', icon: Activity },
              { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
              { id: 'settings', label: 'System Settings', icon: SettingsIcon }
            ]
  ).filter(item => isTabAllowed(item.id));

  const customSidebarItems = activeRoleName === 'SuperAdmin' ? [
    { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard, tabId: 'admin-dashboard' },
    { id: 'admin-subscribers', label: 'Subscribers', icon: Users, tabId: 'admin-subscribers' },
    { id: 'admin-hw-pos', label: 'Hardware POS', icon: ShoppingCart, tabId: 'admin-hw-pos' },
    { id: 'admin-hw-inventory', label: 'HW Inventory', icon: Package, tabId: 'admin-hw-inventory' },
    { id: 'admin-hw-sales', label: 'HW Sales', icon: TrendingUp, tabId: 'admin-hw-sales' },
    { id: 'admin-affiliates', label: 'Affiliates', icon: Award, tabId: 'admin-affiliates' },

    { id: 'admin-status', label: 'Status & Requests', icon: Activity, tabId: 'admin-status' },
    { id: 'admin-reports', label: 'Reports', icon: Database, tabId: 'admin-reports' },
    { id: 'admin-user-activity', label: 'User Activity', icon: Users, tabId: 'admin-user-activity' },
    { id: 'admin-expenses', label: 'Expenses', icon: Receipt, tabId: 'admin-expenses' },
    { id: 'admin-chats', label: 'Chats', icon: MessageSquare, tabId: 'admin-chats' },
    { id: 'admin-inbox', label: 'Inbox', icon: Inbox, tabId: 'admin-inbox' },
    { id: 'admin-ad-placements', label: 'Ad Placements', icon: MonitorPlay, tabId: 'admin-ad-placements' },
    { id: 'admin-promotions', label: 'Ad Exchange SSP', icon: MonitorPlay, tabId: 'admin-promotions' },
    { id: 'admin-web-editor', label: 'Web Editor', icon: Globe, tabId: 'admin-web-editor' },
    { id: 'admin-settings', label: 'Settings', icon: SettingsIcon, tabId: 'admin-settings' }
  ] : (() => {
    // ── PACKAGE FEATURE GATES ──────────────────────────────────────────────
    // Determines which menu items are visible based on the active subscription plan.
    // Ruby = basic, Diamond = mid, Tanzanite = full
    const planId = subStatus.plan.id;
    const isRuby      = planId === 'ruby'      || planId === 'essential' || planId === 'trial';
    const isDiamond   = planId === 'diamond'   || planId === 'business';
    const isTanzanite = planId === 'tanzanite' || planId === 'wholesale';

    // Features available per plan:
    // Ruby:      POS, Sales, Products, Expenses, basic Reports, Settings, Subscription
    // Diamond:   + Purchases, Deliveries, Money&Bank, Staff, Parties/Suppliers, advanced Reports
    // Tanzanite: + Forecasting + everything in Diamond

    const allItems = [
      { id: 'dashboard',          label: 'Dashboard',       icon: LayoutDashboard,      tabId: 'overview',            plans: ['ruby','diamond','tanzanite'] },
      { id: 'pos',                label: 'POS',             icon: ShoppingCart,          tabId: 'pos',                 plans: ['ruby','diamond','tanzanite'] },
      { id: 'sales',              label: 'Sales',           icon: FileText,              tabId: 'sales-list',          plans: ['ruby','diamond','tanzanite'] },
      { id: 'products',           label: 'Products',        icon: Package,               tabId: 'products',            plans: ['ruby','diamond','tanzanite'], hasSubmenu: true },
      { id: 'expenses',           label: 'Expenses',        icon: TrendingDown,          tabId: 'expenses',            plans: ['ruby','diamond','tanzanite'] },
      { id: 'reports-menu',       label: 'Reports',         icon: PieChart,              tabId: 'reports',             plans: ['ruby','diamond','tanzanite'] },
      { id: 'parties',            label: 'Parties',         icon: Users,                 tabId: 'suppliers',           plans: ['ruby','diamond','tanzanite'] },
      { id: 'purchases',          label: 'Purchases',       icon: Truck,                 tabId: 'purchases-list',      plans: ['ruby','diamond','tanzanite'] },
      { id: 'stock-transfer',     label: 'Delivery Menu',   icon: DeliveryMotorcycleIcon,tabId: 'deliveries',          plans: ['diamond','tanzanite'] },
      { id: 'ledger-balance-matrix', label: 'Money & Bank', icon: Wallet,               tabId: 'cash-bank-matrix',    plans: ['diamond','tanzanite'] },
      { id: 'staff',              label: 'Staff',           icon: Shield,                tabId: 'staff-members',       plans: ['diamond','tanzanite'] },
      { id: 'cash-bank',          label: 'Forecasting',     icon: TrendingUp,            tabId: 'forecasting',         plans: ['tanzanite'] },
      { id: 'branches',           label: 'Branches',        icon: Building,              tabId: 'branches',            plans: ['tanzanite'] },
      { id: 'settings',           label: 'Settings',        icon: SettingsIcon,          tabId: 'settings',            plans: ['ruby','diamond','tanzanite'] },
      { id: 'subscription',       label: 'Subscription',    icon: CardIcon,              tabId: 'subscription-modal',  plans: ['ruby','diamond','tanzanite'] },
    ];

    // For trial — show all items so user can see what they'll get, but limits still apply
    if (subStatus.plan.id === 'trial') return allItems.map(({ plans, ...rest }) => rest);

    // Filter by current plan
    const currentPlanKey = isTanzanite ? 'tanzanite' : isDiamond ? 'diamond' : 'ruby';
    return allItems
      .filter(item => item.plans.includes(currentPlanKey))
      .map(({ plans, ...rest }) => rest);
  })();
  const visibleSidebarItems = customSidebarItems.filter(item => isTabAllowed(item.tabId || item.id));

  useEffect(() => {
    if (isTabAllowed(activeTab)) return;
    const firstAllowed = visibleSidebarItems.find((item) => isTabAllowed(item.tabId || item.id));
    if (firstAllowed?.tabId) setActiveTab(firstAllowed.tabId);
  }, [activeRoleName, activeTab, subStatus.plan.id, user.isSaaSStaff]);

  if (user.isDuress) {
    return <DuressDashboard onLogout={onLogout} onNavigate={onNavigate} />;
  }

  return (
    <div id="dashboard-scaffold" className="w-full h-dvh bg-[#f5f6fa] dark:bg-slate-950 flex text-slate-800 dark:text-slate-200 font-sans antialiased overflow-hidden select-none">
      
      {/* PWA install banner — shows after login, not on login page */}
      {user.role !== 'SuperAdmin' && activeTenant.id ? (
        <PWAInstallBanner
          tenantId={activeTenant.id}
          businessName={businessDisplayName}
          businessLogo={customBrandingLogo || null}
          enabled={workspaceReady && Boolean(onlineBusinessName)}
        />
      ) : null}

      {/* 0. HIGH-FIDELITY FLOATING TOAST STACK (Centered at top on mobile, max 3 stacked) */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center space-y-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((t) => {
          let borderTheme = 'border-l-4 border-l-emerald-400';
          let bgTheme = 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800';
          let textColor = 'text-slate-800 dark:text-slate-100';
          
          let iconSvg = (
            <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          );

          if (t.type === 'error') {
            borderTheme = 'border-l-4 border-l-rose-500';
            iconSvg = (
              <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            );
          } else if (t.type === 'warning') {
            borderTheme = 'border-l-4 border-l-amber-500';
            iconSvg = (
              <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            );
          } else if (t.type === 'info') {
            borderTheme = 'border-l-4 border-l-blue-500';
            iconSvg = (
              <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            );
          }

          return (
            <div
              key={t.id}
              className={`flex items-center space-x-3 p-3.5 rounded-2xl shadow-xl w-full select-text pointer-events-auto transition-all duration-300 animate-slide-up-fade ${borderTheme} ${bgTheme}`}
            >
              {iconSvg}
              <p className={`text-xs font-semibold leading-tight flex-1 ${textColor}`}>
                {t.message}
              </p>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                type="button"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      
      {/* 1. Left Sidebar (Fixed, Dark #1a1f2e with smooth transition) */}
      <aside className={`hidden xl:flex flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'} bg-[#1a1f2e] border-r border-[#262c3f]/50 text-white h-full shrink-0 sticky top-0 overflow-y-auto overflow-x-hidden select-none z-45 transition-all duration-300 ease-in-out`}>
        
        {/* Fixed Header Section with Logo top left */}
        <div className="p-5 border-b border-[#262c3f]/50 shrink-0 select-none flex flex-col items-center justify-center">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center space-y-3 w-full">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-md overflow-hidden">
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                ) : systemSettings?.company?.logo ? (
                  <img src={systemSettings.company.logo} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#1a1f2e] font-bold text-lg uppercase tracking-wider">
                    {getFallbackInitials(user.name)}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSidebarCollapsed(false)} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer hidden lg:block"
                title="Expand Sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-md transform hover:scale-105 transition-transform duration-200 overflow-hidden">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#1a1f2e] font-bold text-lg uppercase tracking-wider">
                      {user.name.substring(0, 2)}
                    </span>
                  )}
                </div>
                <div className="text-left leading-tight min-w-0 transition-opacity duration-300">
                  <div className="font-extrabold text-sm text-white truncate max-w-[140px] tracking-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-400 capitalize truncate max-w-[140px]">{user.role} Profile</div>
                </div>
              </div>
              <button 
                onClick={() => setSidebarCollapsed(true)} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer hidden lg:block"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable list of sidebar items */}
        <div className={`flex-grow overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-3'} py-4 space-y-1 scrollbar-none flex flex-col items-center ${sidebarCollapsed ? 'items-center' : 'items-stretch'}`}>
          {visibleSidebarItems.map(item => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.tabId;

            return (
              <div key={item.id} className="w-full relative group">
                <button
                  onClick={() => {
                    if (item.tabId === 'subscription-modal') {
                      setSubModal({
                        show: true,
                        title: 'System Subscription Options',
                        limitType: 'general',
                        description: 'Manage active subscriptions and premium account plans easily to expand store limits.'
                      });
                    } else {
                      setActiveTab(item.tabId as any);
                    }
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all cursor-pointer group relative ${
                    sidebarCollapsed ? 'justify-center' : 'justify-start space-x-3.5'
                  } ${
                    isActive 
                      ? 'bg-emerald-500/10 border-l-4 border-emerald-400 text-emerald-100 font-semibold' 
                      : 'bg-transparent border-l-4 border-transparent hover:bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <IconComponent className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-200'}`} />
                  
                  {/* Label with clean fade transition */}
                  <span 
                    className={`text-[12px] font-medium tracking-tight truncate transition-all duration-300 ease-in-out origin-left flex items-center justify-between flex-1 ${
                      sidebarCollapsed 
                        ? 'opacity-0 scale-x-0 w-0 pointer-events-none' 
                        : 'opacity-100 scale-x-100 w-auto'
                    }`}
                  >
                    <span>{t(item.label)}</span>
                  </span>

                  {item.hasSubmenu && !sidebarCollapsed && (
                    <ChevronRight className="ml-auto w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors transition-all duration-300" />
                  )}
                </button>

                {/* Hover Tooltip - Pop up next to icon if collapsed */}
                {sidebarCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#11131e] border border-[#2d354d] text-white font-sans text-xs px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ease-out pointer-events-none whitespace-nowrap z-50">
                    <span className="font-semibold block">{t(item.label)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Fixed Footer Section - Avatar & Globe icon */}
        <div className={`mt-auto p-4 bg-[#141824] border-t border-[#262c3f]/50 flex shrink-0 items-center justify-center ${sidebarCollapsed ? 'flex-col space-y-3' : 'justify-between space-x-3'}`}>
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 bg-gradient-to-tr from-[#6c63ff] to-indigo-500 text-white rounded-full flex items-center justify-center font-black text-xs uppercase shadow shadow-xs shrink-0 select-text">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="space-y-0.5 leading-none min-w-0 text-left transition-opacity duration-300">
                <p className="text-xs font-bold text-white leading-tight truncate">{user.name}</p>
                <span className="text-[9px] font-mono text-slate-550 uppercase tracking-widest leading-none block mt-0.5 truncate">{activeRoleName}</span>
              </div>
            )}
          </div>
          
          <div
            title={isOfflineMode ? "Offline - saving disabled" : "Cloud Network Connected"}
            className={`p-1.5 rounded-lg text-slate-500 transition-all cursor-default ${sidebarCollapsed ? '' : 'hidden xl:flex'} items-center justify-center`}
          >
            <Globe className={`w-4 h-4 ${isOfflineMode ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`} />
          </div>
        </div>

      </aside>

      {/* Main Independence Dashboard Right scroll-container (independent scroll-box) */}
      <div className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden relative ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'bg-slate-950' : 'bg-[#f5f6fa] dark:bg-slate-950'} select-none`}>
        
        {/* Screen container — flex-col, header shrink-0, main scrolls, bottom nav fixed */}
        <div className={`flex-1 flex flex-col ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'bg-slate-950' : 'bg-[#f5f6fa] dark:bg-slate-950'} min-h-0 overflow-hidden relative`}>

        
          {/* 2. Top Bar Desktop */}
          <header className={`hidden xl:flex sticky top-0 z-35 shrink-0 ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'bg-slate-950 border-slate-800' : 'bg-white dark:bg-slate-905 border-slate-100/80 dark:border-slate-800/80 shadow-xs'} border-b px-6 py-4.5 select-none items-center justify-between transition-colors duration-300`}>
            <div className="flex items-center space-x-3.5 flex-1 animate-fade-in">
              {/* Business Logo / Avatar and Name */}
              <div className="flex items-center space-x-3 shrink-0">
                {(() => {
                  // Header logo: ONLY Business Setup logos (businessLogoLight / businessLogoDark)
                  // Company Account logo is NEVER used here — only in staff/HR profile fallback
                  const biz = systemSettings?.business;
                  let logo = isDark
                    ? (biz?.businessLogoDark || biz?.businessLogoLight || biz?.businessLogo || null)
                    : (biz?.businessLogoLight || biz?.businessLogoDark || biz?.businessLogo || null);
                  if (!logo) {
                    // Check cached settings for business logo (offline fallback)
                    try {
                      const pSet = JSON.parse(onlineStorage.getItem(`jasper_settings_${activeTenant.id}`) || 'null');
                      if (pSet) {
                        logo = isDark
                          ? (pSet?.business?.businessLogoDark || pSet?.business?.businessLogoLight || pSet?.business?.businessLogo || null)
                          : (pSet?.business?.businessLogoLight || pSet?.business?.businessLogoDark || pSet?.business?.businessLogo || null);
                      }
                    } catch { /* use initials fallback */ }
                  }
                  if (logo) {
                    return (
                      <img 
                        src={logo} 
                        alt={`${businessDisplayName} Logo`}
                        className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shrink-0 shadow-xs" 
                        referrerPolicy="no-referrer"
                      />
                    );
                  } else {
                    return (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-400 text-white flex items-center justify-center font-black text-xs tracking-wider shrink-0 shadow-xs">
                        {getFallbackInitials(businessDisplayName)}
                      </div>
                    );
                  }
                })()}
                <div className="flex flex-col text-left">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                    {businessDisplayName}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-0.5">
                    {t(visibleSidebarItems.find((m: any) => m.id === activeTab || m.tabId === activeTab)?.label || activeTab.replace(/-/g, ' '))}
                  </span>
                </div>
              </div>
              {user.role !== 'SuperAdmin' ? (
                <GlobalBranchSwitcher onManageBranches={() => setActiveTab('branches')} />
              ) : null}

            </div>

            <div className="flex items-center space-x-4">
              {renderSubscriptionCountdownBadge()}

              {/* Online / offline state tag indicators with globe icon */}
              <div 
                title={isOfflineMode ? 'Device is offline' : 'Device is online'}
                className="flex items-center space-x-2 text-[11px] font-medium tracking-tight px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-default transition-all font-sans"
              >
                <Globe className={`w-3.5 h-3.5 ${isOfflineMode ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
                <span className="hidden sm:inline font-semibold">{isOfflineMode ? 'OFFLINE' : 'ONLINE'}</span>
              </div>

              {/* Day / Dark Mode Toggle Switch inside Dashboard */}
              <button
                onClick={() => onToggleTheme?.()}
                title={isDark ? "Switch to Day Mode" : "Switch to Dark Mode"}
                className="p-2 text-slate-400 dark:text-slate-300 hover:text-slate-605 dark:hover:text-amber-400 hover:text-slate-800 transition-colors cursor-pointer bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center active:scale-95"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-505 text-indigo-500" />}
              </button>

              {/* Language Selection dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDashLangMenu(!showDashLangMenu)}
                  className="flex items-center space-x-1 px-2 py-2 text-xs font-bold border rounded-xl cursor-pointer transition-all bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-150/40 dark:hover:bg-slate-800 active:scale-95"
                  title="Select Language / Badili Lugha"
                >
                  <Globe className="w-4 h-4 text-emerald-500" />
                  <span className="uppercase font-mono text-[10px] ml-0.5">{lang}</span>
                </button>

                {showDashLangMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDashLangMenu(false)} />
                    <div className="absolute right-0 mt-2 w-32 rounded-xl border p-1 shadow-xl z-50 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-200">
                      {[
                        { code: 'en', label: 'English' },
                        { code: 'sw', label: 'Kiswahili' },
                        { code: 'fr', label: '🇫🇷 Français' }
                      ].map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            setLang(item.code as any);
                            setShowDashLangMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                            lang === item.code 
                              ? 'bg-emerald-500 text-slate-950 font-bold' 
                              : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{item.label}</span>
                          {lang === item.code && <span className="text-[9px] font-bold">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Notification bell desk pivot */}
              <div 
                className="relative p-2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800"
                onClick={() => {
                  setIsNotificationCenterOpen(true);
                  setMoreMenuOpen(false);
                }}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && <div className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />}
                {offlinePendingCount > 0 && unreadCount === 0 && <div className="absolute top-1 right-1 w-2 h-2 bg-[#ef4444] rounded-full border border-white" />}
              </div>

              {/* User Avatar Circle with dropdown */}
              <div className="relative">
                <div 
                  className="w-9 h-9 bg-white text-slate-800 rounded-full flex items-center justify-center font-black text-xs uppercase shadow cursor-pointer hover:opacity-90 hover:scale-105 active:scale-95 transition-all leading-none select-none overflow-hidden border border-slate-200 dark:border-slate-700"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-black text-slate-800 dark:text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize mt-0.5">{user.role}</p>
                      </div>
                      {/* Menu items */}
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('settings' as any); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Shield className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold">Profile</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('settings' as any); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <SettingsIcon className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold">Settings</span>
                        </button>
                        {user.role !== 'SuperAdmin' && (
                          <button
                            type="button"
                            onClick={() => { requestManualInstallPrompt(); setShowUserMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4 text-slate-400" />
                            <span className="font-semibold">Install Orvix App</span>
                          </button>
                        )}
                        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                        <button
                          type="button"
                          onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-rose-500" />
                          <span className="font-semibold">Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* 2b. Top Bar Mobile - Exact 60px height sticky glassmorphic header */}
          <header className="xl:hidden shrink-0 z-50 h-[calc(60px+env(safe-area-inset-top))] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/60 px-4 pt-[env(safe-area-inset-top)] select-none flex items-center justify-between" style={{boxShadow:'0 1px 0 rgba(0,0,0,0.06)', transform:'translateZ(0)', willChange:'transform'}}>
            {/* Left: business logo or initials avatar on mobile top bar */}
            <div className="flex items-center space-x-3 animate-fade-in">
              <div 
                onClick={() => setMoreMenuOpen(true)}
                className="cursor-pointer active:scale-95 shrink-0 select-none"
                title="Open Workspace Menu"
              >
                {(() => {
                  // Header logo: ONLY Business Setup logos (businessLogoLight / businessLogoDark)
                  // Company Account logo is NEVER used here — only in staff/HR profile fallback
                  const biz = systemSettings?.business;
                  let logo = isDark
                    ? (biz?.businessLogoDark || biz?.businessLogoLight || biz?.businessLogo || null)
                    : (biz?.businessLogoLight || biz?.businessLogoDark || biz?.businessLogo || null);
                  if (!logo) {
                    // Check cached settings for business logo (offline fallback)
                    try {
                      const pSet = JSON.parse(onlineStorage.getItem(`jasper_settings_${activeTenant.id}`) || 'null');
                      if (pSet) {
                        logo = isDark
                          ? (pSet?.business?.businessLogoDark || pSet?.business?.businessLogoLight || pSet?.business?.businessLogo || null)
                          : (pSet?.business?.businessLogoLight || pSet?.business?.businessLogoDark || pSet?.business?.businessLogo || null);
                      }
                    } catch { /* use initials fallback */ }
                  }
                  if (logo) {
                    return (
                      <img 
                        src={logo} 
                        alt={`${businessDisplayName} Logo`}
                        className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shadow-sm shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                    );
                  } else {
                    return (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-400 text-white flex items-center justify-center font-black text-xs tracking-wider shrink-0 shadow-sm">
                        {getFallbackInitials(businessDisplayName)}
                      </div>
                    );
                  }
                })()}
              </div>
              <div className="flex flex-col items-start leading-none text-left">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white capitalize tracking-tight mb-0.5">
                  {businessDisplayName}
                </span>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t(visibleSidebarItems.find((m: any) => m.id === activeTab || m.tabId === activeTab)?.label || activeTab.replace(/-/g, ' '))}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 px-2">
              {user.role !== 'SuperAdmin' ? (
                <GlobalBranchSwitcher onManageBranches={() => setActiveTab('branches')} />
              ) : null}
            </div>

            {/* Right: Search icon + Dark Mode + Language + Notification bell */}
            <div className="flex items-center space-x-1">
              <button className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90 cursor-pointer">
                <Search className="w-5 h-5" />
              </button>

              {/* Dark / Light Mode Toggle */}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90 cursor-pointer"
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {isDark
                    ? <Sun className="w-5 h-5 text-amber-400" />
                    : <Moon className="w-5 h-5 text-slate-500" />
                  }
                </button>
              )}

              {/* Mobile Language Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDashLangMenu(!showDashLangMenu)}
                  className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90 flex items-center justify-center cursor-pointer"
                  title="Select Language / Badili Lugha"
                >
                  <Globe className="w-5 h-5 text-emerald-500" />
                </button>

                {showDashLangMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDashLangMenu(false)} />
                    <div className="absolute right-0 mt-2 w-32 rounded-xl border p-1 shadow-xl z-50 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-200">
                      {[
                        { code: 'en', label: 'English' },
                        { code: 'sw', label: 'Kiswahili' },
                        { code: 'fr', label: '🇫🇷 Français' }
                      ].map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            setLang(item.code as any);
                            setShowDashLangMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                            lang === item.code 
                              ? 'bg-emerald-500 text-slate-950 font-bold' 
                              : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{item.label}</span>
                          {lang === item.code && <span className="text-[9px] font-bold">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div 
                className="relative p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90 cursor-pointer"
                onClick={() => setIsNotificationCenterOpen(true)}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />}
                {offlinePendingCount > 0 && unreadCount === 0 && <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ef4444] rounded-full border-2 border-white dark:border-slate-900" />}
              </div>
            </div>
          </header>

          {/* Core workspace content viewports */}
          <main id="workspace-content" className={`relative flex-1 overflow-y-auto scrollbar-none overscroll-contain touch-pan-y ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'p-0 bg-slate-950 flex flex-col' : 'p-3 sm:p-4 xl:p-6 bg-[#f5f6fa] dark:bg-slate-950 space-y-5 xl:space-y-6'} pb-[calc(72px+env(safe-area-inset-bottom))] xl:pb-6 min-h-0`}>
            <DashboardScreenErrorBoundary
              resetKey={activeTab}
              onReturnToDashboard={() => setActiveTab(getDefaultDashboardTab())}
            >

            {isTrialAccessLocked ? (
              <div className="min-h-[calc(100dvh-120px)]">
                <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
                  <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-xl dark:border-slate-800">
                    <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_0.85fr] md:p-8">
                      <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Trial expired
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-3xl font-black tracking-tight md:text-4xl">Your Diamond free trial has ended</h2>
                          <p className="max-w-2xl text-sm leading-6 text-slate-300">
                            During your free trial you were using the Diamond package experience for {trialDurationDays} days. Your business data is still preserved. Choose Ruby, Diamond, or Tanzanite below, submit payment proof, and continue with the package limits you select.
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trial package</p>
                            <p className="mt-1 text-lg font-black text-emerald-300">Diamond</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trial length</p>
                            <p className="mt-1 text-lg font-black text-white">{trialDurationDays} days</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data status</p>
                            <p className="mt-1 text-lg font-black text-white">Preserved</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
                        <h3 className="text-sm font-black uppercase tracking-wider text-amber-200">Before choosing Ruby</h3>
                        <p className="mt-2 text-xs leading-5 text-amber-50/85">Ruby is cheaper, but because your trial was Diamond, these Diamond features will no longer be available on Ruby:</p>
                        <ul className="mt-3 space-y-2 text-xs text-amber-50/90">
                          {rubyDowngradeNotes.map((note) => <li key={note} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />{note}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    {([
                      { id: 'ruby' as const, tag: 'Lower cost', tone: 'border-rose-200 bg-white', cta: 'Choose Ruby', notes: ['TZS 15,000 / month', '1,000 products', '1 store', '2 staff users'] },
                      { id: 'diamond' as const, tag: 'Same as trial', tone: 'border-emerald-300 bg-emerald-50', cta: 'Keep Diamond', notes: ['TZS 30,000 / month', '5,000 products', 'Diamond Lucy AI', '5 staff users'] },
                      { id: 'tanzanite' as const, tag: 'Full upgrade', tone: 'border-cyan-300 bg-white', cta: 'Upgrade Tanzanite', notes: ['TZS 50,000 / month', 'Unlimited products', 'Forecasting + higher Lucy limits', '15 staff users'] },
                    ]).map((pkg) => {
                      const plan = SUBSCRIPTION_PLANS[pkg.id];
                      const isDiamond = pkg.id === 'diamond';
                      return (
                        <article key={pkg.id} className={`rounded-3xl border p-5 shadow-sm ${pkg.tone}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isDiamond ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{pkg.tag}</span>
                              <h3 className="mt-3 text-2xl font-black text-slate-950">{plan.name}</h3>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly</p>
                              <p className="text-lg font-black text-slate-950">{activeTenant.currency}{plan.price.toLocaleString()}</p>
                            </div>
                          </div>
                          <ul className="mt-5 space-y-2 text-sm text-slate-600">
                            {pkg.notes.map((note) => <li key={note} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{note}</li>)}
                          </ul>
                          {pkg.id === 'tanzanite' && (
                            <div className="mt-4 rounded-2xl bg-cyan-50 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700">Extra vs Diamond</p>
                              <ul className="mt-2 space-y-1.5 text-xs text-cyan-900">
                                {tanzaniteUpgradeNotes.slice(0, 4).map((note) => <li key={note}>+ {note}</li>)}
                              </ul>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setManualActivationPackage(pkg.id);
                              setSubModal({
                                show: true,
                                title: `${pkg.cta}`,
                                limitType: 'expired',
                                description: `Select ${plan.name}, pay, and upload your receipt for activation.`
                              });
                            }}
                            className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black transition-colors ${isDiamond ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-950 text-white hover:bg-slate-800'}`}
                          >
                            {pkg.cta}
                          </button>
                        </article>
                      );
                    })}
                  </div>

                  <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-900">If you choose Tanzanite you gain</h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {tanzaniteUpgradeNotes.map((note) => (
                        <div key={note} className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-cyan-950 shadow-sm">{note}</div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
            <React.Suspense fallback={(
              <div className="flex min-h-[50vh] w-full items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500 dark:border-slate-700" />
                  <span className="text-sm font-semibold">Loading…</span>
                </div>
              </div>
            )}>
            <>

          {/* TAB ROOT: Hotel Property Management Room Matrix (PMS) */}
          {activeTab === 'hotel-pms' && (
            <DashboardHotelPMS 
              activeTenant={activeTenant} 
              currentUser={user}
              onAddSyncLog={(newLog) => {
                setLogs(prev => [newLog, ...prev]);
              }}
            />
          )}

          {/* TAB ROOT: Restaurant Gastronomy, Dining Map, POS & KDS */}
          {activeTab === 'restaurant-hub' && (
            <DashboardRestaurant 
              activeTenant={activeTenant} 
              currentUser={user}
              onAddSyncLog={(newLog) => {
                const mappedLog: SyncLog = {
                  id: newLog.id,
                  type: 'auth_sync', 
                  status: newLog.status === 'pending' ? 'pending' : newLog.status === 'failed' ? 'failed' : 'success',
                  message: newLog.details,
                  timestamp: newLog.timestamp
                };
                setLogs(prev => [mappedLog, ...prev]);
              }}
              onAddSale={handleAddSale}
            />
          )}

          {/* TAB ROOT: Pharmacy and Restaurant Sandboxes */}
          {activeTab === 'sandbox-pms' && (
            <DashboardSandboxVerticals 
              activeTenant={activeTenant} 
              currentUser={user}
              onAddSale={handleAddSale}
            />
          )}

          {/* TAB ROOT: Ledger Metrics Overview */}
          {activeTab === 'overview' && (
            <DashboardOverview 
              activeTenant={activeTenant}
              systemSettings={systemSettings}
              products={activeProducts}
              sales={activeSales}
              expenses={activeExpenses}
              purchases={activePurchases}
              isOfflineMode={isOfflineMode}
              offlinePendingCount={offlinePendingCount}
              onToggleOffline={handleToggleOnlineAndSync}
              userName={user.name}
              userRole={user.role}
              userProfileImage={user.profileImage}
            />
          )}

          {/* TAB ROOT: Point of Sale cashier register terminals */}
          {activeTab === 'pos' && (
            <DashboardPOS 
              activeTenant={activeTenant}
              products={activeProducts}
              userName={user.name}
              isOfflineMode={isOfflineMode}
              onUpdateStocks={handleUpdateActiveStocks}
              onAddSale={handleAddSale}
              systemSettings={systemSettings}
              preloadedCart={preloadedCart}
              onClearPreloadedCart={() => setPreloadedCart(null)}
            />
          )}

          {/* TAB ROOT: Inventory Products catalogs */}
          {activeTab === 'products' && (
            <DashboardProducts 
              activeTenant={activeTenant}
              products={activeProducts}
              systemSettings={systemSettings}
              onUpdateSettings={(updated) => {
                persistSystemSettingsNow(updated);
              }}
              onAddProduct={handleCreateProduct}
              onDeleteProduct={handleDeleteProduct}
              onUpdateProducts={handleUpdateActiveStocks}
              subscriptionStatus={subStatus}
              onTriggerUpgrade={(type) => {
                setSubModal({
                  show: true,
                  title: 'Upgrade System Plan',
                  limitType: type,
                  description: 'Register standard or upgrade plans to upload more products without limit caps.'
                });
              }}
            />
          )}

          {/* TAB ROOT: Supplier entities management */}
          {activeTab === 'suppliers' && (
            <DashboardSuppliers 
              suppliers={activeSuppliers}
              onAddSupplier={handleCreateSupplier}
              purchases={activePurchases}
              sales={activeSales}
              activeTenant={activeTenant}
            />
          )}

          {/* TAB ROOT: High-Fidelity Supplier Purchases Receipts list */}
          {activeTab === 'purchases-list' && (
            <DashboardPurchases 
              activeTenant={activeTenant}
              products={activeProducts}
              suppliers={activeSuppliers}
              onUpdateStocks={handleUpdateActiveStocks}
              purchases={activePurchases}
              onAddPurchase={handleAddPurchase}
              onUpdatePurchases={handleUpdatePurchases}
              onDeletePurchase={handleDeletePurchase}
              systemSettings={systemSettings}
            />
          )}

          {/* TAB ROOT: Deliveries & Logistics tracker */}
          {activeTab === 'deliveries' && (
            <DashboardDeliveries 
              activeTenant={activeTenant}
              deliveries={activeDeliveries}
              riders={activeRiders}
              onAddRider={handleAddRider}
              onAddDelivery={(delivery) => {
                setDeliveriesMap(prev => {
                  const currentDeliveries = prev[delivery.tenantId] || [];
                  const scopedDelivery = {
                    ...delivery,
                    branchId: delivery.branchId || activeBranchSelection.activeBranchId || undefined,
                  };
                  return { ...prev, [delivery.tenantId]: [scopedDelivery, ...currentDeliveries] };
                });
              }}
              onDispatchDelivery={handleDispatchDelivery}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              products={activeProducts}
              systemSettings={systemSettings}
              sales={activeSales}
              pendingNotes={activePendingDeliveryNotes}
              onUpdatePendingNotes={handleUpdatePendingDeliveryNotes}
              defaultSubTab={deliveriesSubTab}
              onSubTabChange={(tab) => setDeliveriesSubTab(tab)}
              expenses={activeExpenses}
              onAddExpense={handleAddExpense}
              onEditDelivery={handleUpdateDeliveryDetails}
              onDeleteDelivery={handleDeleteDelivery}
              activeBranchName={
                branchContextSelectedBranch?.businessName
                || branchContextSelectedBranch?.branchName
                || activeBranchBusinessName
                || activeTenant.name
              }
            />
          )}

          {/* TAB ROOT: Sockets logging and sync status queue flusher */}
          {activeTab === 'sync' && (
            <DashboardLogsAndSync 
              logs={logs}
              sales={activeSales}
              isOfflineMode={isOfflineMode}
              onToggleOffline={() => setIsOfflineMode(!isOfflineMode)}
              onSyncOfflineQueue={handleSyncOfflineQueue}
            />
          )}

          {/* TAB ROOT: Comprehensive financial reports and branch audits */}
          {activeTab === 'reports' && (
            <DashboardReports 
              activeTenant={activeTenant}
              products={activeProducts}
              sales={activeSales}
              expenses={activeExpenses}
              onAddExpense={handleAddExpense}
              userName={user.name}
              rolePermissions={currentPermissions}
              suppliers={activeSuppliers}
              purchases={activePurchases}
              deliveries={activeDeliveries}
              systemSettings={systemSettings}
            />
          )}

          {/* TAB ROOT: High-Fidelity Sales Receipts History list */}
          {activeTab === 'sales-list' && (
            <DashboardSalesList 
              activeTenant={activeTenant}
              sales={activeSales}
              onUpdateSales={handleUpdateSales}
              onDeleteSale={handleDeleteSale}
              rolePermissions={currentPermissions}
              products={activeProducts}
              systemSettings={systemSettings}
              onPreloadCartForPOS={(items, backdate, options) => {
                setPreloadedCart({ items, backdate, ...options });
                setActiveTab('pos');
              }}
              currentUser={user}
              subscriptionStatus={subStatus}
              onSendToDeliveryNote={handleSendToDeliveryNote}
            />
          )}

          {/* TAB ROOT: Operating Expenses Logging Journal */}
          {activeTab === 'expenses' && (
            <DashboardExpenses 
              activeTenant={activeTenant}
              expenses={activeExpenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateExpense={handleUpdateExpense}
              userName={user.name}
              sales={activeSales}
              systemSettings={systemSettings}
              onUpdateSystemSettings={persistSystemSettingsNow}
            />
          )}

          {/* TAB ROOT: Stock Valuations */}
          {activeTab === 'inventory' && (
            <DashboardReports 
              activeTenant={activeTenant}
              products={activeProducts}
              sales={activeSales}
              expenses={activeExpenses}
              onAddExpense={handleAddExpense}
              userName={user.name}
              defaultTab="inventory"
              rolePermissions={currentPermissions}
              suppliers={activeSuppliers}
              purchases={activePurchases}
              systemSettings={systemSettings}
            />
          )}

          {/* TAB ROOT: Smart Generative Forecasting (AI Pro) */}
          {activeTab === 'forecasting' && (
            <DashboardForecasting 
              activeTenant={activeTenant}
              products={activeProducts}
              sales={activeSales}
              expenses={activeExpenses}
              systemSettings={systemSettings}
              onUpdateStocks={handleUpdateActiveStocks}
            />
          )}

          {/* TAB ROOT: Money & Bank Balance Matrix (Double-Entry Treasury Ledger) */}
          {activeTab === 'cash-bank-matrix' && (
            <DashboardCashBank 
              activeTenant={activeTenant}
              sales={activeSales}
              expenses={activeExpenses}
              deliveries={activeDeliveries}
              purchases={activePurchases}
              user={user}
              systemSettings={systemSettings}
              onUpdateSystemSettings={(updated) => {
                persistSystemSettingsNow(updated);
              }}
            />
          )}

          {/* TAB ROOT: Agency White-Label Branding Studio */}
          {activeTab === 'whitelabel' && (
            <DashboardWhiteLabel 
              activeTenant={activeTenant}
            />
          )}

          {/* TAB ROOT: Staff */}
          {activeTab === 'staff-members' && (
            <DashboardStaff 
              systemSettings={{
                ...systemSettings,
                staffs: scopeBranchRecords<NonNullable<SystemSettings['staffs']>[number]>(
                  systemSettings.staffs || [],
                  activeBranchSelection,
                ),
              }}
              onUpdateSettings={(updated) => {
                persistSystemSettingsNow({
                  ...updated,
                  staffs: replaceScopedBranchRecords(
                    systemSettings.staffs || [],
                    (updated.staffs || []).map(staff => ({
                      ...staff,
                      branchId: staff.branchId || activeBranchSelection.activeBranchId || undefined,
                    })),
                    activeBranchSelection,
                  ),
                });
              }}
              sales={activeSales}
              expenses={activeExpenses}
              activeTenant={activeTenant}
              deliveries={activeDeliveries}
              onPayStaff={handleAddExpense}
              payrollEnabled={subStatus.plan.id === 'tanzanite'}
              canPayPayroll={Boolean(currentPermissions?.expenses?.write || activeRoleName === 'SuperAdmin')}
            />
          )}

          {/* TAB ROOT: System Settings */}
          {activeTab === 'settings' && (
            <DashboardSettings 
              activeTenant={activeTenant}
              systemSettings={systemSettings}
              onSaveSettings={(updated) => {
                if (blockOfflineBusinessWrite('settings save')) return;
                const syncedSettings = persistSystemSettingsNow(updated);
                let logoToSave = '';
                if (syncedSettings.company?.logo) {
                  logoToSave = syncedSettings.company.logo;
                } else if (syncedSettings.business?.businessLogoLight) {
                  logoToSave = syncedSettings.business.businessLogoLight;
                } else if (syncedSettings.business?.businessLogo) {
                  logoToSave = syncedSettings.business.businessLogo;
                }
                if (logoToSave) {
                  onlineStorage.setItem(`jasper_tenant_logo_${activeTenant.id}`, logoToSave);
                  setActiveTenant(prev => ({
                    ...prev,
                    company_settings: {
                      ...(prev.company_settings || {}),
                      logo_url: logoToSave
                    }
                  }));
                }
              }}
              subscriptionStatus={subStatus}
              onTriggerUpgrade={(type) => {
                setSubModal({
                  show: true,
                  title: 'Upgrade System Plan',
                  limitType: type,
                  description: 'Upgrade your subscription tier to allow unlimited shops and team staff accounts.'
                });
              }}
              sales={activeSales}
              expenses={activeExpenses}
              deliveries={activeDeliveries}
            />
          )}

          {activeTab === 'branches' && (
            <React.Suspense fallback={(
              <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="h-8 w-44 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="mt-6 h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
              </div>
            )}>
              <DashboardBranchesSettings
                activeTenant={activeTenant}
                onTriggerUpgrade={(type) => {
                  setSubModal({
                    show: true,
                    title: 'Upgrade System Plan',
                    limitType: type,
                    description: 'Upgrade to Tanzanite to activate multi-branch business controls.'
                  });
                }}
              />
            </React.Suspense>
          )}

           {/* TAB ROOT: Super SaaS Admin Control Panel */}
           {(activeTab === 'super-saas' || activeTab.startsWith('admin-')) && (
             <SuperSaaSAdminView 
               user={user}
               activeAdminSubTab={
                 activeTab === 'admin-dashboard' ? 'dashboard' :
                 activeTab === 'admin-subscribers' ? 'subscribers' :
                 activeTab === 'admin-hw-pos' ? 'hw-pos' :
                 activeTab === 'admin-hw-inventory' ? 'hw-inventory' :
                 activeTab === 'admin-hw-sales' ? 'hw-sales' :
                 activeTab === 'admin-affiliates' ? 'affiliates' :
                 activeTab === 'admin-affiliate-agents' ? 'affiliate-agents' :
                 activeTab === 'admin-sub-affiliates' ? 'sub-affiliates' :
                 activeTab === 'admin-status' ? 'status' :
                 activeTab === 'admin-reports' ? 'reports' :
                 activeTab === 'admin-user-activity' ? 'user-activity' :
                  activeTab === 'admin-expenses' ? 'expenses' :
                 activeTab === 'admin-chats' ? 'chats' :
                 activeTab === 'admin-inbox' ? 'inbox' :
                 activeTab === 'admin-promotions' ? 'promotions' :
                 activeTab === 'admin-ad-placements' ? 'ad-placements' :
                 activeTab === 'admin-web-editor' ? 'web-editor' :
                 activeTab === 'admin-settings' ? 'settings' : 'dashboard'
               }
               setActiveAdminSubTab={(subTab) => {
                 const mappedTab = 
                   subTab === 'dashboard' ? 'admin-dashboard' :
                   subTab === 'subscribers' ? 'admin-subscribers' :
                   subTab === 'hw-pos' ? 'admin-hw-pos' :
                   subTab === 'hw-inventory' ? 'admin-hw-inventory' :
                   subTab === 'hw-sales' ? 'admin-hw-sales' :
                   subTab === 'affiliates' ? 'admin-affiliates' :
                   subTab === 'affiliate-agents' ? 'admin-affiliate-agents' :
                   subTab === 'sub-affiliates' ? 'admin-sub-affiliates' :
                   subTab === 'status' ? 'admin-status' :
                   subTab === 'reports' ? 'admin-reports' :
                   subTab === 'user-activity' ? 'admin-user-activity' :
                    subTab === 'expenses' ? 'admin-expenses' :
                   subTab === 'chats' ? 'admin-chats' :
                   subTab === 'inbox' ? 'admin-inbox' :
                   subTab === 'promotions' ? 'admin-promotions' :
                   subTab === 'ad-placements' ? 'admin-ad-placements' :
                   subTab === 'web-editor' ? 'admin-web-editor' :
                   subTab === 'settings' ? 'admin-settings' : 'admin-dashboard';
                 setActiveTab(mappedTab);
               }}
              hideSidebar={true}
            />
          )}

            </>
            </React.Suspense>
            )}

            </DashboardScreenErrorBoundary>

          </main>

          {/* Mobile Bottom Navigation Component */}
          <nav id="dashboard-mobile-nav" className="xl:hidden shrink-0 z-[80] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800" style={{height:'var(--dashboard-bottom-nav-height)', paddingBottom:'calc(env(safe-area-inset-bottom) + var(--browser-bottom-inset, 0px))', boxShadow:'0 -1px 0 rgba(0,0,0,0.05)', transform:'translateZ(0)', willChange:'transform', isolation:'isolate'}}>
            <div className="flex items-stretch h-14">
              {(user.role === 'SuperAdmin' ? [
                // ── Super SaaS Admin bottom nav ──────────────────────────
                { id: 'admin-dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
                { id: 'admin-subscribers',  label: 'Subscribers',  icon: Users },
                { id: 'admin-affiliates',   label: 'Affiliates',   icon: Award },
                { id: '__more__',           label: 'More',         icon: Menu },
              ] : [
                // ── Tenant / business user bottom nav ────────
                { id: 'overview',    label: 'Home',  icon: LayoutDashboard, alwaysShow: true },
                { id: 'sales-list',  label: 'Sales', icon: FileText,        alwaysShow: true },
                { id: 'pos',         label: 'Sell',  icon: ShoppingCart,    isPOS: true, alwaysShow: true },
                { id: 'products',    label: 'Stock', icon: Database,        alwaysShow: true },
                { id: '__more__',    label: 'More',  icon: Menu },
              ]).filter(tab => tab.id === '__more__' || (tab as any).alwaysShow || isTabAllowed(tab.id)).map((tab: any) => {
                const isMore = tab.id === '__more__';
                const isActive = (!isMore && activeTab === tab.id) || (isMore && moreMenuOpen);
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isMore) { setMoreMenuOpen(true); }
                      else { setActiveTab(tab.id as any); setMoreMenuOpen(false); }
                    }}
                    className="flex-1 flex flex-col items-center justify-center relative transition-all duration-150 active:scale-90 cursor-pointer bg-transparent border-none outline-none"
                    type="button"
                  >
                    {tab.isPOS ? (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30" style={{marginTop:'-18px'}}>
                          <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-bold text-emerald-500 mt-0.5 leading-none">{t('Sell')}</span>
                      </>
                    ) : (
                      <>
                        <div className={`flex items-center justify-center w-7 h-6 rounded-lg mb-0.5 transition-all ${isActive ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
                          <Icon className={`w-5 h-5 transition-all ${isActive ? 'stroke-emerald-500' : 'stroke-slate-400 dark:stroke-slate-500'}`} strokeWidth={isActive ? 2.5 : 1.8} />
                        </div>
                        <span className={`text-[9px] font-semibold leading-none ${isActive ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{t(tab.label)}</span>
                        {isActive && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* 5. Mobile Floating Action Button (FAB)

          {/* 5. Mobile Floating Action Button (FAB) (Brand green, rounded-full, 56px, above bottom nav) */}


        </div>

        {/* Universal sub-modal anchors & floating elements */}
        {/* Native App Full-Screen More Menu */}
        <div
          className={`xl:hidden fixed inset-x-0 top-0 z-[70] flex flex-col bg-slate-50 dark:bg-slate-950 select-none transition-all duration-300 ease-out ${moreMenuOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-4'}`}
          style={{
            bottom: 'var(--dashboard-bottom-nav-height)',
            paddingTop: 'env(safe-area-inset-top)'
          }}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-5 h-[60px] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/60 shrink-0" style={{boxShadow:'0 1px 0 rgba(0,0,0,0.06)'}}>
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5">All Features</p>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {user.role === 'SuperAdmin' ? 'SaaS Admin Portal' : businessDisplayName}
              </h2>
            </div>
            <button onClick={() => setMoreMenuOpen(false)} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-90 transition-all border-none cursor-pointer" type="button">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto pb-24">
            <div className="px-5 pt-5 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">All Features</p>
              <div className="mobile-more-features-grid gap-4">
                {(user.role === 'SuperAdmin' ? [
                  // ── Super SaaS Admin more menu ─────────────────────
                  { id: 'admin-dashboard',   label: 'Dashboard',  icon: LayoutDashboard, bg: 'bg-emerald-600' },
                  { id: 'admin-subscribers', label: 'Subscribers',icon: Users,           bg: 'bg-blue-600' },
                  { id: 'admin-affiliates',  label: 'Affiliates', icon: Award,           bg: 'bg-amber-500' },
                  { id: 'admin-status',      label: 'Approvals',  icon: Activity,        bg: 'bg-teal-600' },
                  { id: 'admin-hw-pos',      label: 'HW POS',     icon: ShoppingCart,    bg: 'bg-violet-600' },
                  { id: 'admin-hw-inventory',label: 'HW Stock',   icon: Database,        bg: 'bg-orange-500' },
                  { id: 'admin-hw-sales',    label: 'HW Sales',   icon: TrendingUp,      bg: 'bg-rose-500' },
                  { id: 'admin-reports',     label: 'Reports',    icon: PieChart,        bg: 'bg-indigo-600' },
                  { id: 'admin-user-activity', label: 'Activity', icon: Users,           bg: 'bg-sky-600' },
                  { id: 'admin-expenses',    label: 'Expenses',   icon: MinusCircle,     bg: 'bg-rose-600' },
                  { id: 'admin-chats',       label: 'Chats',      icon: MessageSquare,   bg: 'bg-cyan-600' },
                  { id: 'admin-ad-placements', label: 'Placements', icon: MonitorPlay,   bg: 'bg-purple-600' },
                  { id: 'admin-promotions',  label: 'Ads',        icon: MonitorPlay,     bg: 'bg-pink-600' },
                  { id: 'admin-settings',    label: 'Settings',   icon: SettingsIcon,    bg: 'bg-slate-700' },
                ] : [
                  // ── Tenant / business user more menu (UNCHANGED) ──
                  { id: 'overview',          label: 'Home',       icon: LayoutDashboard, bg: 'bg-blue-500',    alwaysShow: true },
                  { id: 'sales-list',        label: 'Sales',      icon: FileText,        bg: 'bg-emerald-500', alwaysShow: true },
                  { id: 'pos',               label: 'Sell',       icon: ShoppingCart,    bg: 'bg-gradient-to-r from-emerald-400 to-teal-400' },
                  { id: 'purchases-list',    label: 'Buying',     icon: Package,         bg: 'bg-violet-500' },
                  { id: 'products',          label: 'Stock',      icon: Database,        bg: 'bg-orange-500',  alwaysShow: true },
                  { id: 'expenses',          label: 'Expenses',   icon: MinusCircle,     bg: 'bg-rose-500' },
                  { id: 'reports',           label: 'Reports',    icon: PieChart,        bg: 'bg-indigo-500',  alwaysShow: true },
                  { id: 'deliveries',        label: 'Delivery',   icon: MapPin,          bg: 'bg-teal-500' },
                  { id: 'suppliers',         label: 'Partners',   icon: Handshake,       bg: 'bg-purple-500' },
                  { id: 'cash-bank-matrix',  label: 'Money',      icon: Wallet,          bg: 'bg-amber-500' },
                  { id: 'forecasting',       label: 'Planning',   icon: TrendingUp,      bg: 'bg-cyan-500' },
                  { id: 'staff-members',     label: 'Staff',      icon: Shield,          bg: 'bg-slate-700' },
                ]).filter(item => (item as any).alwaysShow || isTabAllowed(item.id)).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button"
                      onClick={() => { setActiveTab(item.id as any); setMoreMenuOpen(false); }}
                      className="flex flex-col items-center gap-1.5 active:scale-90 transition-all duration-150 cursor-pointer bg-transparent border-none outline-none">
                      <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center shadow-sm`}>
                        <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight">{t(item.label)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-5 my-4 h-px bg-slate-200 dark:bg-slate-800" />

            {/* Quick actions list */}
            <div className="px-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">System</p>
              <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                {(user.role === 'SuperAdmin' ? [
                  { id: 'admin-web-editor', label: 'Web Editor',  icon: Globe,       desc: 'Edit landing page content', color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
                  { id: 'admin-ad-placements', label: 'Ad Placements', icon: MonitorPlay, desc: 'Control dashboard and sticky ads', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
                  { id: 'admin-settings',   label: 'Settings',    icon: SettingsIcon,desc: 'System configuration',      color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
                ] : [
                  { id: 'sync', label: 'Sync', icon: RefreshCw, desc: isOfflineMode ? 'You are offline' : 'All data synced', color: isOfflineMode ? 'text-amber-600' : 'text-emerald-600', bg: isOfflineMode ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10' },
                  { id: 'settings', label: 'Settings', icon: SettingsIcon, desc: 'Manage your business settings', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
                  { id: 'subscription-modal', label: 'Subscription', icon: CardIcon, desc: 'Pay online or upload an offline receipt', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', alwaysShow: true },
                  { id: 'install-orvix-app', label: 'Install Orvix App', icon: Download, desc: 'Add this app to your home screen', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', alwaysShow: true },
                ]).filter(item => (item as any).alwaysShow || isTabAllowed(item.id)).map((item, idx, arr) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button"
                      onClick={() => {
                        if (item.id === 'subscription-modal') {
                          setSubModal({
                            show: true,
                            title: 'System Subscription Options',
                            limitType: 'general',
                            description: 'Manage active subscriptions and premium account plans.',
                          });
                        } else if (item.id === 'install-orvix-app') {
                          requestManualInstallPrompt();
                        } else {
                          setActiveTab(item.id as any);
                        }
                        setMoreMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors cursor-pointer bg-transparent border-none text-left ${idx < arr.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                      <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${item.color}`} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">{t(item.label)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{item.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logout */}
            <div className="px-5 mt-4">
              <button
                type="button"
                onClick={() => { setShowLogoutConfirm(true); setMoreMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 active:bg-rose-50 transition-colors cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5 text-rose-500" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-600 leading-tight">Sign Out</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{user.name}</p>
                </div>
              </button>
            </div>

          </div>
        </div>

        </div> {/* End of Main scroll-container */}

      {/* Intelligent AI business copilot module / chat drawer */}
      <AIBusinessCopilot 
        activeTenant={activeTenant}
        activeTab={activeTab}
        onNavigate={(tabId) => setActiveTab(tabId as any)}
        products={activeProducts}
        sales={activeSales}
        expenses={activeExpenses}
        subscriptionStatus={subStatus}
      />
      {user.role !== 'SuperAdmin' && (
        <GlobalStickyAd
          bottomOffsetClass="bottom-[var(--dashboard-sticky-ad-clearance)] xl:bottom-4"
          leftOffsetClass="left-3 xl:left-1/2 xl:-translate-x-1/2"
          maxWidthClass="max-w-[640px]"
        />
      )}

      {/* Live Premium Subscription upgrade popups */}
      {subModal && subModal.show && (
        <SubscriptionCheckoutStateBridge initialPlan={manualActivationPackage}>
          {({ selectedPlanId, setSelectedPlanId, paymentMode, setPaymentMode }) => (
        <div className="fixed inset-0 z-[170] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm md:items-center md:p-5 animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="subscription-title" className="relative mt-auto flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl md:mt-0 md:h-auto md:max-h-[calc(100dvh-40px)] md:rounded-[2rem] animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0">
            <div className="flex justify-center pb-1 pt-2.5 md:hidden">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-3 md:px-8 md:pb-5 md:pt-7">
              <div>
                <h3 id="subscription-title" className="text-[28px] font-black leading-tight tracking-[-0.035em] text-slate-950 md:text-4xl">
                  Subscription
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500 md:text-base">Choose the plan that fits your business</p>
              </div>
              <button
                type="button"
                onClick={() => setSubModal(null)}
                aria-label="Close subscription options"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </header>

            <div className="subscription-shell-grid min-h-0 flex-1 overflow-y-auto px-5 py-5 md:grid md:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)] md:gap-8 md:px-8 md:py-7">
              <section aria-label="Choose subscription plan" className="space-y-3">
                {PAID_PACKAGE_IDS.map((planId) => {
                  const plan = SUBSCRIPTION_PLANS[planId];
                  const isSelected = selectedPlanId === planId;
                  const planTone = planId === 'ruby'
                    ? 'bg-rose-50 text-rose-600'
                    : planId === 'diamond'
                      ? 'bg-sky-50 text-sky-600'
                      : 'bg-violet-50 text-violet-600';
                  return (
                    <button
                      key={planId}
                      type="button"
                      onClick={() => setSelectedPlanId(planId)}
                      aria-pressed={isSelected}
                      className={`flex min-h-[86px] w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 md:min-h-[112px] md:px-5 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-[0_10px_30px_rgba(5,150,105,0.10)]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${planTone}`}>
                        <CardIcon className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-black text-slate-950 md:text-lg">{plan.name}</p>
                        <p className="mt-0.5 text-lg font-bold tracking-tight text-slate-700 md:text-xl">
                          {activeTenant.currency}{plan.price.toLocaleString()}
                        </p>
                        <p className="mt-1 hidden text-xs font-medium leading-5 text-slate-500 md:block">
                          {planId === 'ruby'
                            ? '1 branch · 2 users · 1,000 products'
                            : planId === 'diamond'
                              ? '1 branch · 5 users · 5,000 products'
                              : '2 branches included · 15 users · unlimited products'}
                        </p>
                      </div>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-emerald-600' : 'border-slate-300'}`}>
                        {isSelected ? <span className="h-3 w-3 rounded-full bg-emerald-600" /> : null}
                      </span>
                    </button>
                  );
                })}
              </section>

              <section className="mt-5 border-t border-slate-100 pt-5 md:mt-0 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                <div className="grid min-h-12 grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('online')}
                    className={`min-h-11 rounded-xl px-4 text-sm font-bold transition-all ${paymentMode === 'online' ? 'border border-emerald-600 bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Pay online
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('offline')}
                    className={`min-h-11 rounded-xl px-4 text-sm font-bold transition-all ${paymentMode === 'offline' ? 'border border-emerald-600 bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Pay offline
                  </button>
                </div>

                {paymentMode === 'online' ? (
                  <div className="mt-5">
                    <h4 className="text-base font-black text-slate-950 md:text-lg">Order summary</h4>
                    <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
                        <span className="text-sm font-medium text-slate-500">Selected plan</span>
                        <span className="text-base font-black text-slate-950">
                          {SUBSCRIPTION_PLANS[selectedPlanId].name}
                        </span>
                      </div>
                      <div className="mx-4 border-t border-slate-100 md:mx-5" />
                      <div className="flex items-end justify-between gap-4 px-4 py-4 md:px-5">
                        <span className="text-sm font-medium text-slate-500">Monthly total</span>
                        <span className="text-2xl font-black tracking-tight text-slate-950">
                          {activeTenant.currency}{SUBSCRIPTION_PLANS[selectedPlanId].price.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
                      <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.25} />
                      <p className="text-xs font-semibold leading-5">Secure payment. Access activates after payment confirmation.</p>
                    </div>

                    {onlinePaymentMessage ? (
                      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">{onlinePaymentMessage}</p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => startOnlineSubscriptionPayment(selectedPlanId, () => setPaymentMode('offline'))}
                      disabled={onlinePaymentSubmitting}
                      className="subscription-desktop-action mt-4 min-h-14 w-full rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.22)] transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {onlinePaymentSubmitting ? 'Starting secure payment…' : 'Pay online'}
                    </button>

                    <a
                      href="https://wa.me/255655746552?text=Hello%20Jasper%20Deployments%2C%20I%20need%20help%20with%20subscription%20payment."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Need help? Contact deployments
                    </a>
                  </div>
                ) : (
                  <div className="mt-5">
                    <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 md:p-5">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Pay with Mixx by Yas</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lipa Namba — mfano</p>
                          <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">123456</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Jina — mfano</p>
                          <p className="mt-1 text-base font-black text-slate-950">Orvix Business Suite</p>
                        </div>
                      </div>
                      <p className="mt-4 text-xs font-medium leading-5 text-amber-800">Hizi ni taarifa za mfano. Thibitisha Lipa Namba halisi kwa deployments kabla ya kutuma malipo.</p>
                    </div>

                    <label className="mt-4 block">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment details</span>
                      <input
                        type="text"
                        value={manualActivationNote}
                        onChange={(event) => setManualActivationNote(event.target.value)}
                        placeholder="Transaction reference and payment details"
                        className="mt-1.5 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-emerald-500"
                      />
                    </label>

                    <div className="relative mt-3">
                      <input
                        type="file"
                        id="receipt-upload"
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        accept="image/*,.pdf"
                        onChange={(event) => setManualActivationReceipt(event.target.files?.[0] || null)}
                      />
                      <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-slate-600">
                        <CloudLightning className="h-5 w-5" />
                        <span className="truncate text-xs font-bold">{manualActivationReceipt ? manualActivationReceipt.name : 'Upload payment receipt'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => submitManualActivationRequest(selectedPlanId)}
                      disabled={manualActivationSubmitting}
                      className="subscription-desktop-action mt-3 min-h-14 w-full rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {manualActivationSubmitting ? 'Sending…' : 'Submit receipt for activation'}
                    </button>

                    {manualActivationMessage ? (
                      <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-semibold leading-5 text-slate-700">{manualActivationMessage}</p>
                    ) : null}

                    <a
                      href="https://wa.me/255655746552?text=Hello%20Jasper%20Deployments%2C%20I%20need%20help%20with%20offline%20subscription%20payment."
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Contact Orvix deployments on WhatsApp"
                      className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Need help? Contact deployments
                    </a>
                  </div>
                )}
              </section>
            </div>

            <footer className="subscription-mobile-action shrink-0 border-t border-slate-100 bg-white px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              {paymentMode === 'online' ? (
                <button
                  type="button"
                  onClick={() => startOnlineSubscriptionPayment(selectedPlanId, () => setPaymentMode('offline'))}
                  disabled={onlinePaymentSubmitting}
                  className="min-h-14 w-full rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.22)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {onlinePaymentSubmitting ? 'Starting secure payment…' : 'Pay online'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => submitManualActivationRequest(selectedPlanId)}
                  disabled={manualActivationSubmitting}
                  className="min-h-14 w-full rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {manualActivationSubmitting ? 'Sending…' : 'Submit receipt for activation'}
                </button>
              )}
            </footer>
          </div>
        </div>
          )}
        </SubscriptionCheckoutStateBridge>
      )}

      {/* 🔒 Sign Out Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full space-y-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center animate-scale-up">
            <div className="mx-auto w-12 h-12 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center text-rose-500 mb-2">
              <LogOut className="w-6 h-6" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Sign Out</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Are you sure you want to sign out of your account?
              </p>
            </div>

            {logoutError && (
              <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450 text-xs rounded-xl p-3 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{logoutError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  setLogoutError(null);
                }}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-400 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-rose-600/15"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      
      <NotificationCenterModal 
        isOpen={isNotificationCenterOpen} 
        onClose={() => setIsNotificationCenterOpen(false)} 
        onNavigateToReports={() => {
           setActiveTab('reports');
           setIsNotificationCenterOpen(false);
        }} 
      />
    </div>
  );
}

export default function Dashboard(props: DashboardProps) {
  if (props.user.role === 'SuperAdmin') return <DashboardContent {...props} />;
  const tenantKey = props.user.activeTenant || props.user.tenantId;
  return (
    <BranchProvider tenantKey={tenantKey}>
      <DashboardContent {...props} />
    </BranchProvider>
  );
}
