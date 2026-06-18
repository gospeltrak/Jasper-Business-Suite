import React, { useState, useEffect } from 'react';
import { useTranslation } from '../LanguageContext';
import { useTenantLogo } from '../TenantLogoContext';
import { User, Tenant, Product, Sale, SyncLog, Supplier, Expense, Purchase, Delivery, DeliveryRider, SystemSettings, CustomRole, SaleItem } from '../types';
import { 
  DEFAULT_TENANTS, 
  DEFAULT_PRODUCTS, 
  DEFAULT_SUPPLIERS, 
  RECENT_SYNC_LOGS, 
  MOCK_SALES_HISTORY,
  MOCK_EXPENSES_HISTORY
} from '../data';

// Subcomponents imports
import DashboardOverview from './DashboardOverview';
import DashboardPOS from './DashboardPOS';
import DashboardProducts from './DashboardProducts';
import DashboardSuppliers from './DashboardSuppliers';
import DashboardLogsAndSync from './DashboardLogsAndSync';
import DashboardReports from './DashboardReports';
import DashboardExpenses from './DashboardExpenses';
import DashboardSalesList from './DashboardSalesList';
import DashboardForecasting from './DashboardForecasting';
import DashboardCashBank from './DashboardCashBank';
import DashboardPurchases from './DashboardPurchases';
import DashboardDeliveries from './DashboardDeliveries';
import DashboardHotelPMS from './DashboardHotelPMS';
import DashboardSandboxVerticals from './DashboardSandboxVerticals';
import DashboardRestaurant from './DashboardRestaurant';
import DashboardWhiteLabel from './DashboardWhiteLabel';
import DashboardSettings, { DEFAULT_CUSTOM_ROLES } from './DashboardSettings';
import DashboardStaff from './DashboardStaff';
import AIBusinessCopilot from './AIBusinessCopilot';
import SuperSaaSAdminView from './SuperSaaSAdminView';
import DuressDashboard from './DuressDashboard';
import CachedImage from './CachedImage';
import { savePendingSaleOffline, clearPendingSales } from '../utils/offlineDb';
import { Shield, Sparkles as SparklesIcon, AlertTriangle, CheckCircle, HelpCircle as HelpIcon, Play, RefreshCcw, CreditCard as CardIcon, Bell } from 'lucide-react';
import { 
  getSubscriptionState, 
  saveSubscriptionState, 
  checkSubscriptionStatus, 
  SUBSCRIPTION_PLANS, 
  SubscriptionPlanId,
  SubscriptionState
} from '../utils/subscription';

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
  Handshake
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
}

export default function Dashboard({ user, onLogout, onNavigate, isDark = false, onToggleTheme }: DashboardProps) {
  const { t, lang, setLang } = useTranslation();
  const { logoUrl, getFallbackInitials } = useTenantLogo();
  const [showDashLangMenu, setShowDashLangMenu] = useState(false);

  // Load standard + custom registered tenants dynamically
  const [tenantsList] = useState<Tenant[]>(() => {
    const cached = localStorage.getItem('jasper_custom_tenants');
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
      name: user.name ? `${user.name} Suite` : 'My Jasper Suite',
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
  const [activeTab, setActiveTab ] = useState<string>(() => {
    if (user.role === 'SuperAdmin') return 'admin-dashboard';
    if (activeTenant.businessType === 'hotel') return 'hotel-pms';
    if (activeTenant.businessType === 'restaurant') return 'restaurant-hub';
    if (activeTenant.businessType === 'pharmacy') return 'sandbox-pms';
    return 'overview';
  });
  const [actingStaffId, setActingStaffId] = useState<string>('logged-in-user');
  const [productsMap, setProductsMap] = useState<Record<string, Product[]>>(() => DEFAULT_PRODUCTS);
  const [salesMap, setSalesMap] = useState<Record<string, Sale[]>>(() => MOCK_SALES_HISTORY);
  const [expensesMap, setExpensesMap] = useState<Record<string, Expense[]>>(() => MOCK_EXPENSES_HISTORY);
  
  const [pendingDeliveryNotesMap, setPendingDeliveryNotesMap] = useState<Record<string, any[]>>(() => {
    const cached = localStorage.getItem('jasper_pending_delivery_notes_map');
    return cached ? JSON.parse(cached) : {};
  });
  const [deliveriesSubTab, setDeliveriesSubTab] = useState<'queue' | 'riders' | 'notes'>('queue');

  const [deliveriesMap, setDeliveriesMap] = useState<Record<string, Delivery[]>>(() => ({
    't-lagos-01': [
      {
        id: 'DL-MOCKNG1',
        saleId: 'SL-MOCK1',
        customerName: 'Kunle Adebayo',
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
        customerName: 'Mary Atieno',
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

  // Monitor logs to trigger native responsive toast automatically on actions
  useEffect(() => {
    if (logs.length > 0) {
      const latest = logs[0];
      if (latest && latest.message) {
        // Find if this specific message was already toasted to avoid repeat
        addToast(latest.message, latest.status === 'error' ? 'error' : 'success');
      }
    }
  }, [logs]);

  // Load and cache branch specific Settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const cached = localStorage.getItem(`jasper_settings_${activeTenant.id}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Fallback below
      }
    }
    return {
      company: {
        companyName: activeTenant.name,
        usernameKey: activeTenant.id,
        phone: activeTenant.id === 't-lagos-01' ? '+234 803 444 5555' : '+254 722 000 111',
        email: 'info@jasper-wholesale.com',
        address: `${activeTenant.city}, ${activeTenant.country}`,
        tin: 'TIN-492942-A',
        vat: 'VAT-492040-B',
        currency: activeTenant.currency,
        timezone: activeTenant.currencyCode === 'KES' ? 'EAT' : 'WAT',
        logo: '',
        themeMode: 'light'
      },
      business: {
        businessName: activeTenant.name,
        businessPhone: activeTenant.id === 't-lagos-01' ? '+234 803 444 5555' : '+254 722 000 111',
        businessAddress: `${activeTenant.city}, ${activeTenant.country}`,
        businessLogo: '',
        paymentModes: ['Cash', 'Card', 'M-Pesa', 'MTN MoMo', 'Paystack', 'Bank Transfer'],
        registeredStores: ['Main Store', 'In-Shelf Store', 'Backroom Storage']
      },
      productStore: {
        categories: ['Groceries', 'Beverages', 'Electronics', 'Pharmaceuticals', 'Personal Care', 'Homeware'],
        units: ['pcs', 'kg', 'litres', 'box', 'bottle', 'dozen', 'meters']
      },
      staffs: [
        { id: 'st-01', name: 'John Mwangi', phone: '+254 722 123 456', role: 'Seller', salary: 35000, password: 'password123' },
        { id: 'st-02', name: 'Babajide Cole', phone: '+234 802 111 2222', role: 'Delivery Rider / Permanent Driver', salary: 45000, password: 'password123' },
        { id: 'st-03', name: 'Kofi Mensah', phone: '+233 244 888 999', role: 'Cashier', salary: 50000, password: 'password123' }
      ]
    };
  });

  const [preloadedCart, setPreloadedCart] = useState<{items: SaleItem[], backdate?: string} | null>(null);

  // Automatically refresh settings when pivot branch (activeTenant) updates
  useEffect(() => {
    const cached = localStorage.getItem(`jasper_settings_${activeTenant.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSystemSettings(parsed);
        if (parsed.company?.themeMode === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        // Fallback
      }
    } else {
      const freshDefaults: SystemSettings = {
        company: {
          companyName: activeTenant.name,
          usernameKey: activeTenant.id,
          phone: activeTenant.id === 't-lagos-01' ? '+234 803 444 5555' : '+254 722 000 111',
          email: 'info@jasper-wholesale.com',
          address: `${activeTenant.city}, ${activeTenant.country}`,
          tin: 'TIN-492942-A',
          vat: 'VAT-492040-B',
          currency: activeTenant.currency,
          timezone: activeTenant.currencyCode === 'KES' ? 'EAT' : 'WAT',
          logo: '',
          themeMode: 'light'
        },
        business: {
          businessName: activeTenant.name,
          businessPhone: activeTenant.id === 't-lagos-01' ? '+234 803 444 5555' : '+254 722 000 111',
          businessAddress: `${activeTenant.city}, ${activeTenant.country}`,
          businessLogo: '',
          paymentModes: ['Cash', 'Card', 'M-Pesa', 'MTN MoMo', 'Paystack', 'Bank Transfer'],
          registeredStores: ['Main Store', 'In-Shelf Store', 'Backroom Storage']
        },
        productStore: {
          categories: ['Groceries', 'Beverages', 'Electronics', 'Pharmaceuticals', 'Personal Care', 'Homeware'],
          units: ['pcs', 'kg', 'litres', 'box', 'bottle', 'dozen', 'meters']
        },
        staffs: [
          { id: 'st-01', name: 'John Mwangi', phone: '+254 722 123 456', role: 'Seller', salary: 35000, password: 'password123' },
          { id: 'st-02', name: 'Babajide Cole', phone: '+234 802 111 2222', role: 'Delivery Rider / Permanent Driver', salary: 45000, password: 'password123' },
          { id: 'st-03', name: 'Kofi Mensah', phone: '+233 244 888 999', role: 'Cashier', salary: 50000, password: 'password123' }
        ]
      };
      setSystemSettings(freshDefaults);
      document.documentElement.classList.remove('dark');
    }
  }, [activeTenant]);

  // Service Worker and Offline background synchronizer listener
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'OFFLINE_BACKGROUND_SYNC_SUCCESS') {
          const { count, syncedIds } = event.data;
          
          // Move matched pending sales to synced
          setSalesMap(prev => {
            const updated: Record<string, Sale[]> = {};
            Object.keys(prev).forEach(tenantId => {
              updated[tenantId] = prev[tenantId].map(sale => {
                if (syncedIds.includes(sale.id)) {
                  return { ...sale, syncStatus: 'synced' as const };
                }
                return sale;
              });
            });
            return updated;
          });

          // Add a glorious trace log
          const newLog: SyncLog = {
            id: 'l-' + Math.random().toString(36).substr(2, 9),
            type: 'sale',
            status: 'success',
            message: `Background Sync worker flushed ${count} pending offline sales receipts successfully!`,
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
          status: 'success',
          message: `Network connectivity restored. Requesting Service Worker transaction queue flush...`,
          timestamp: new Date().toISOString()
        };
        setLogs(prev => [newLog, ...prev]);

        // Attempt Background Sync tag registration
        if ('SyncManager' in window) {
          navigator.serviceWorker.ready.then(reg => {
            return (reg as any).sync.register('sync-pos-sales');
          }).catch(err => {
            console.warn('Sync registration failed:', err);
            // Fallback: send message to SW to trigger sync immediately
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_POS_SYNC' });
            }
          });
        } else {
          // Manual fallback for browsers without Background Sync API support (or sandboxed iframes)
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_POS_SYNC' });
          }
        }
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
      const rawBulletins = localStorage.getItem('jasper_super_admin_bulletins');
      if (rawBulletins) {
        setLocalBulletins(JSON.parse(rawBulletins));
      } else {
        const fallbackBulletins = [
          { id: 'bul-1', timestamp: new Date().toISOString(), title: 'Mpesa real-time sync upgrade completed', content: 'Our real-time transaction processing latency is now officially verified at 0.3 seconds across all East African cash endpoints.', type: 'system' }
        ];
        setLocalBulletins(fallbackBulletins);
      }

      // 2. Load Offers
      const rawOffers = localStorage.getItem('jasper_super_admin_broadcast_offers');
      if (rawOffers) {
        setLocalOffers(JSON.parse(rawOffers));
      } else {
        const fallbackOffers = [
          { id: 'off-1', timestamp: new Date().toISOString(), title: 'SaaS Suite Easter Discount', code: 'UPGRADE20', badge: 'SAVE 20%', description: 'Get a 20% flat discount on unified consolidated bookkeeping & hotel PMS active models. Limited time discount.', isActive: true }
        ];
        setLocalOffers(fallbackOffers);
      }

      // 3. Load Chat messages
      const rawChats = localStorage.getItem('jasper_super_admin_hotline_chats');
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

    const currentSaved = JSON.parse(localStorage.getItem('jasper_super_admin_hotline_chats') || '[]');
    const updated = [...currentSaved, newMsg];
    localStorage.setItem('jasper_super_admin_hotline_chats', JSON.stringify(updated));
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
    const customRoles = systemSettings.customRoles || [];
    const matched = customRoles.find(r => r.name.toLowerCase() === activeRoleName.toLowerCase());
    if (matched) return matched.permissions;

    const queryPreset = (activeRoleName.toLowerCase() === 'waiter' || activeRoleName.toLowerCase() === 'seller') ? 'seller' : activeRoleName.toLowerCase();
    const preset = DEFAULT_CUSTOM_ROLES.find(r => r.name.toLowerCase() === queryPreset);
    if (preset) return preset.permissions;

    return {
      pos: { read: true, write: true, edit: true },
      products: { read: true, write: true, edit: true },
      purchases: { read: true, write: true, edit: true },
      suppliers: { read: true, write: true, edit: true },
      expenses: { read: true, write: true, edit: true },
      reportsSalesExpenses: { read: true, write: true, edit: true },
      reportsProfitCogs: { read: true, write: true, edit: true },
      sync: { read: true, write: true, edit: true },
      settings: { read: true, write: true, edit: true }
    };
  };

  const currentPermissions = getSimulatedPermissions();

  const isTabAllowed = (tabId: string) => {
    if (activeRoleName === 'SuperAdmin') {
      return tabId === 'super-saas' || tabId.startsWith('admin-') || tabId === 'staff' || tabId === 'staff-members';
    }
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

  const [currentTime, setCurrentTime] = useState(new Date());

  // Setup live clock in the ledger header
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Multi-tenant pivot controller keys
  const currentTenantId = user.activeTenant || user.tenantId;
  const activeProducts = currentTenantId ? (productsMap[activeTenant.id] || []) : [];
  const activeSales = currentTenantId ? (salesMap[activeTenant.id] || []) : [];
  const activeExpenses = currentTenantId ? (expensesMap[activeTenant.id] || []) : [];
  const activePurchases = currentTenantId ? (purchasesMap[activeTenant.id] || []) : [];
  const activeDeliveries = currentTenantId ? (deliveriesMap[activeTenant.id] || []) : [];

  const activeSuppliers = currentTenantId ? suppliers.filter(s => s.tenantId === activeTenant.id) : [];
  const activeRiders = currentTenantId ? riders.filter(r => r.tenantId === activeTenant.id) : [];

  // Premium subscription state setup 
  const [subState, setSubState] = useState<SubscriptionState>(() => getSubscriptionState());
  const [isBillingBannerDismissed, setIsBillingBannerDismissed] = useState(false);
  
  // Custom interactive limit modal state
  const [subModal, setSubModal] = useState<{
    show: boolean;
    title: string;
    description: string;
    limitType: 'products' | 'stores' | 'staff' | 'expired';
  } | null>(null);

  // Sync state with localstorage on change of tenant
  useEffect(() => {
    setSubState(getSubscriptionState());
  }, [activeTenant.id]);

  const updateSubscriptionPlan = (newPlanId: SubscriptionPlanId) => {
    const updated: SubscriptionState = {
      ...subState,
      planId: newPlanId,
      isSubscribedPaid: newPlanId !== 'trial',
      paidAt: newPlanId !== 'trial' ? new Date().toISOString() : undefined
    };
    saveSubscriptionState(updated);
    setSubState(updated);
  };

  const setSimulatedDays = (days: number) => {
    const updated: SubscriptionState = {
      ...subState,
      simulatedDaysPassed: days
    };
    saveSubscriptionState(updated);
    setSubState(updated);
  };

  const currentProductCount = activeProducts.length;
  const currentStoreCount = systemSettings.business?.registeredStores?.length || 1;
  const currentStaffCount = systemSettings.staffs?.length || 0;

  const subStatus = checkSubscriptionStatus(
    subState,
    currentProductCount,
    currentStoreCount,
    currentStaffCount
  );

  // Render Subscription Action Banner & Pay Simulator
  const renderSubscriptionStatusBlock = () => {
    return null;
  };

  // Mutators passed down
  const handleAddExpense = (expense: Expense) => {
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
  };

  const handleUpdateActiveStocks = (updatedProducts: Product[]) => {
    setProductsMap(prev => ({
      ...prev,
      [activeTenant.id]: updatedProducts
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

  const handleUpdateSales = (updatedSales: Sale[]) => {
    setSalesMap(prev => ({
      ...prev,
      [activeTenant.id]: updatedSales
    }));
    
    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'sale',
      status: 'success',
      message: `Updated and re-synchronized active sales ledger for branch: ${activeTenant.name}`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleSendToDeliveryNote = (sale: Sale) => {
    const newPendingNote = {
      id: `DN-PEND-${Math.floor(10000 + Math.random() * 90000)}`,
      saleId: sale.id,
      customerName: sale.customerName || 'Walk-In Customer',
      customerPhone: sale.customerPhone || '',
      customerAddress: '', // user will fill this
      items: sale.items.map((item, idx) => ({
        id: (idx + 1).toString(),
        description: item.productName,
        unit: 'PC',
        qty: item.qty
      })),
      piNo: `PI-${sale.id.replace(/[^0-9]/g, '').slice(0, 6) || Math.floor(100000 + Math.random() * 899999)}`,
      lpoNo: `LP-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toLocaleDateString('en-GB'), // dd/mm/yyyy
      status: 'Pending',
      deliveryLocation: '', // user will fill this
      registrationPlate: '', // user will fill this
      transportType: '', // user will fill this
      deliveredByName: '', // user will fill this
    };

    const currentNotes = pendingDeliveryNotesMap[activeTenant.id] || [];
    const updated = {
      ...pendingDeliveryNotesMap,
      [activeTenant.id]: [
        newPendingNote,
        ...currentNotes
      ]
    };

    setPendingDeliveryNotesMap(updated);
    localStorage.setItem('jasper_pending_delivery_notes_map', JSON.stringify(updated));
    
    // Switch tab and subtab
    setDeliveriesSubTab('notes');
    setActiveTab('deliveries');
  };

  const handleUpdatePendingDeliveryNotes = (updatedNotes: any[]) => {
    const updated = {
      ...pendingDeliveryNotesMap,
      [activeTenant.id]: updatedNotes
    };
    setPendingDeliveryNotesMap(updated);
    localStorage.setItem('jasper_pending_delivery_notes_map', JSON.stringify(updated));
  };

  const handleAddSale = (sale: Sale) => {
    setSalesMap(prev => {
      const currentTenantSales = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: [sale, ...currentTenantSales]
      };
    });

    // Queue in IndexedDB for Background Sync if pending (offline mode)
    if (sale.syncStatus === 'pending') {
      savePendingSaleOffline(sale).then(() => {
        console.log('[Dashboard] Offline sale queued in IndexedDB database.');
        // Notify Service Worker or register Background Sync tag
        if ('serviceWorker' in navigator) {
          if ('SyncManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
              return (reg as any).sync.register('sync-pos-sales');
            }).catch(err => {
              console.warn('Sync registration failed, fallback to postMessage:', err);
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_POS_SYNC' });
              }
            });
          } else {
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_POS_SYNC' });
            }
          }
        }
      }).catch(err => {
        console.error('[Dashboard] Error queuing pending sale in IndexedDB:', err);
      });
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
        tenantId: sale.tenantId
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
        ? `Offline Sale (Ref: ${sale.id}) saved to IndexedDB & Service Worker queue registry.`
        : `Approved transaction (Ref: ${sale.id}) synced directly with Paystack / Mobile money clearing cores.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleAddRider = (newRider: DeliveryRider) => {
    setRiders(prev => [newRider, ...prev]);
  };

  const handleDispatchDelivery = (deliveryId: string, riderDetails: NonNullable<Delivery['riderDetails']>, riderId?: string, customerData?: { name: string, phone: string, location: string, paymentMethod?: string }) => {
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

  const handleUpdateDeliveryStatus = (deliveryId: string, status: Delivery['status']) => {
    setDeliveriesMap(prev => {
      const currentTenantDels = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: currentTenantDels.map(del => 
          del.id === deliveryId 
            ? { 
                ...del, 
                status, 
                deliveredAt: status === 'Delivered' ? new Date().toISOString() : undefined 
              } 
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
  };

  const handleCreateProduct = (newProd: Product) => {
    setProductsMap(prev => {
      const currentProducts = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: [newProd, ...currentProducts]
      };
    });

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
    setProductsMap(prev => {
      const currentProducts = prev[activeTenant.id] || [];
      return {
        ...prev,
        [activeTenant.id]: currentProducts.filter(p => p.id !== id)
      };
    });

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
    setSuppliers(prev => [newSup, ...prev]);

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'inventory_audit',
      status: 'success',
      message: `Linked external logistics supply vendor: ${newSup.name} into master catalog directory.`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleAddPurchase = (purchase: Purchase) => {
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

  // Flushing pending offline queues to simulation Online servers
  const handleSyncOfflineQueue = (callback: () => void) => {
    // Clear pending queue from IndexedDB 
    clearPendingSales().catch(err => {
      console.error('[Dashboard] Failed to clear IndexedDB pending queue:', err);
    });

    setSalesMap(prev => {
      const currentList = prev[activeTenant.id] || [];
      const updatedList = currentList.map(s => s.syncStatus === 'pending' ? { ...s, syncStatus: 'synced' as const } : s);
      return {
        ...prev,
        [activeTenant.id]: updatedList
      };
    });

    const newLog: SyncLog = {
      id: 'l-' + Math.random().toString(36).substr(2, 9),
      type: 'sale',
      status: 'success',
      message: `Offline queued sales flushed successfully to unified distributed container server and cleared from local IndexedDB cache!`,
      timestamp: new Date().toISOString()
    };
    
    setLogs(prev => [newLog, ...prev]);
    callback();
  };

  // Turn off offline simulation mode and immediately synchronise the queue
  const handleToggleOnlineAndSync = () => {
    setIsOfflineMode(false);
    
    // Log the reconnect sequence
    const reconnectLog: SyncLog = {
      id: 'RECONNECT-' + Math.random().toString(36).substring(3, 8),
      type: 'auth_sync',
      status: 'success',
      message: `Network connectivity re-established! Synchronizing local resilient queue...`,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [reconnectLog, ...prev]);

    // Perform queue flush
    handleSyncOfflineQueue(() => {
      console.log('[Dashboard] Offline local queue synchronized successfully.');
    });
  };

  useEffect(() => {
    if (!isOfflineMode) {
      const currentList = salesMap[currentTenantId] || [];
      const pendingCount = currentList.filter(s => s.syncStatus === 'pending').length;
      if (pendingCount > 0) {
        // Auto-sync
        const logMsg = `Network connected. Auto-syncing ${pendingCount} offline receipts.`;
        setLogs(prev => [{
          id: 'AUTO-SYNC-' + Math.random().toString(36).substring(3, 8),
          type: 'system_action',
          status: 'success',
          message: logMsg,
          timestamp: new Date().toISOString()
        }, ...prev]);

        handleSyncOfflineQueue(() => {
          console.log('[Dashboard] Auto-synced offline queue successfully.');
        });
      }
    }
  }, [isOfflineMode, salesMap, currentTenantId]);

  // Calculate size of offline sync queue
  const offlinePendingCount = activeSales.filter(s => s.syncStatus === 'pending').length;

  // Dynamic branding selectors to personalize the user's Jasper suite
  const currentThemeMode = systemSettings.company?.themeMode || 'light';
  const customBrandingLogo = currentThemeMode === 'dark'
    ? (systemSettings.business?.businessLogoDark || systemSettings.business?.businessLogoLight || systemSettings.business?.businessLogo)
    : (systemSettings.business?.businessLogoLight || systemSettings.business?.businessLogoDark || systemSettings.business?.businessLogo);
  
  const customBusinessName = systemSettings.business?.businessName || 'Jasper';
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
        { id: 'admin-promotions', label: 'Ad Exchange SSP', icon: MonitorPlay },
        { id: 'admin-web-editor', label: 'Web Editor', icon: Globe },
        { id: 'admin-settings', label: 'Settings', icon: SettingsIcon }
      ]
    : activeTenant.businessType === 'hotel' 
      ? [
          { id: 'expenses', label: 'Expenses', icon: Receipt },
          { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
          { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
          { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
          { id: 'settings', label: 'System Settings', icon: SettingsIcon }
        ]
      : activeTenant.businessType === 'restaurant'
        ? [
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
            { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
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
            { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
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
            { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
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
        { id: 'admin-expenses', label: 'Expenses', icon: Receipt },
        { id: 'admin-chats', label: 'Chats', icon: MessageSquare },
        { id: 'admin-inbox', label: 'Inbox', icon: Inbox },
        { id: 'admin-promotions', label: 'Ad Exchange SSP', icon: MonitorPlay },
        { id: 'admin-web-editor', label: 'Web Editor', icon: Globe },
        { id: 'admin-settings', label: 'Settings', icon: SettingsIcon }
      ]
    : activeTenant.businessType === 'hotel' 
      ? [
          { id: 'hotel-pms', label: 'Room Matrix (PMS)', icon: Bed },
          { id: 'expenses', label: 'Expenses', icon: Receipt },
          { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
          { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
          { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
          { id: 'settings', label: 'System Settings', icon: SettingsIcon }
        ]
      : activeTenant.businessType === 'restaurant'
        ? [
            { id: 'restaurant-hub', label: 'Dining & KDS Hub', icon: Utensils },
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'reports', label: 'Reports & Audits', icon: DollarSign },
            { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
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
              { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
              { id: 'whitelabel', label: 'White-Label Branding', icon: Globe },
              { id: 'settings', label: 'System Settings', icon: SettingsIcon }
            ]
          : [
              { id: 'overview', label: 'Ledger Analytics', icon: LayoutDashboard },
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
              { id: 'sync', label: 'Offline Sync Hub', icon: Activity },
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
    { id: 'admin-expenses', label: 'Expenses', icon: Receipt, tabId: 'admin-expenses' },
    { id: 'admin-chats', label: 'Chats', icon: MessageSquare, tabId: 'admin-chats' },
    { id: 'admin-inbox', label: 'Inbox', icon: Inbox, tabId: 'admin-inbox' },
    { id: 'admin-promotions', label: 'Ad Exchange SSP', icon: MonitorPlay, tabId: 'admin-promotions' },
    { id: 'admin-web-editor', label: 'Web Editor', icon: Globe, tabId: 'admin-web-editor' },
    { id: 'admin-settings', label: 'Settings', icon: SettingsIcon, tabId: 'admin-settings' }
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tabId: 'overview' },
    { id: 'parties', label: 'Parties', icon: Users, tabId: 'suppliers' },
    { id: 'sales', label: 'Sales', icon: FileText, tabId: 'sales-list' },
    { id: 'purchases', label: 'Purchases', icon: Truck, tabId: 'purchases-list' },
    { id: 'pos', label: 'POS', icon: ShoppingCart, tabId: 'pos' },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown, tabId: 'expenses' },
    { id: 'products', label: 'Product Manager', icon: Package, tabId: 'products', hasSubmenu: true },
    { id: 'stock-transfer', label: 'Delivery Menu', icon: DeliveryMotorcycleIcon, tabId: 'deliveries' },
    { id: 'cash-bank', label: 'Sales Forecasting', icon: TrendingUp, tabId: 'forecasting' },
    { id: 'ledger-balance-matrix', label: 'Cash & Bank', icon: Wallet, tabId: 'cash-bank-matrix' },
    { id: 'reports-menu', label: 'Reports', icon: PieChart, tabId: 'reports' },
    { id: 'staff', label: 'Staff Members', icon: Shield, tabId: 'staff-members' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, tabId: 'settings' },
    { id: 'subscription', label: 'Subscription', icon: CardIcon, tabId: 'subscription-modal' }
  ];

  if (user.isDuress) {
    return <DuressDashboard onLogout={onLogout} onNavigate={onNavigate} />;
  }

  return (
    <div id="dashboard-scaffold" className="w-full h-screen bg-[#f5f6fa] dark:bg-slate-950 flex text-slate-800 dark:text-slate-200 font-sans antialiased overflow-hidden select-none">
      
      {/* 0. HIGH-FIDELITY FLOATING TOAST STACK (Centered at top on mobile, max 3 stacked) */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center space-y-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((t) => {
          let borderTheme = 'border-l-4 border-l-[#00C853]';
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
      <aside className={`hidden md:flex flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'} bg-[#1a1f2e] border-r border-[#262c3f]/50 text-white h-full shrink-0 sticky top-0 overflow-y-auto overflow-x-hidden select-none z-45 transition-all duration-300 ease-in-out`}>
        
        {/* Fixed Header Section with Logo top left */}
        <div className="p-5 border-b border-[#262c3f]/50 shrink-0 select-none flex flex-col items-center justify-center">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center space-y-3 w-full">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-md overflow-hidden">
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#1a1f2e] font-bold text-lg uppercase tracking-wider">
                    {user.name.substring(0, 2)}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSidebarCollapsed(false)} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer hidden md:block"
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
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer hidden md:block"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable list of sidebar items */}
        <div className={`flex-grow overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-3'} py-4 space-y-1 scrollbar-none flex flex-col items-center ${sidebarCollapsed ? 'items-center' : 'items-stretch'}`}>
          {customSidebarItems.map(item => {
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
                      ? 'bg-[#141824] border-l-4 border-[#6c63ff] text-white font-semibold' 
                      : 'bg-transparent border-l-4 border-transparent hover:bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <IconComponent className={`w-4.5 h-4.5 shrink-0 transition-colors ${isActive ? 'text-[#6c63ff]' : 'text-slate-450 group-hover:text-slate-200'}`} />
                  
                  {/* Label with clean fade transition */}
                  <span 
                    className={`text-[12px] font-medium tracking-tight truncate transition-all duration-300 ease-in-out origin-left flex items-center justify-between flex-1 ${
                      sidebarCollapsed 
                        ? 'opacity-0 scale-x-0 w-0 pointer-events-none' 
                        : 'opacity-100 scale-x-100 w-auto'
                    }`}
                  >
                    <span>{t(item.label)}</span>
                    {item.tabId === 'admin-status' && !sidebarCollapsed && (
                      <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-md shadow-rose-500/20 animate-pulse">
                        2
                      </span>
                    )}
                    {item.tabId === 'admin-inbox' && !sidebarCollapsed && (
                      <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-md shadow-indigo-500/20">
                        1
                      </span>
                    )}
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
                {/* Collapsed Badge indicator */}
                {sidebarCollapsed && item.tabId === 'admin-status' && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse border border-[#1a1f2e]"></span>
                )}
                {sidebarCollapsed && item.tabId === 'admin-inbox' && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border border-[#1a1f2e]"></span>
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
            title={isOfflineMode ? "Local Mode (Offline)" : "Cloud Network Connected"}
            className={`p-1.5 rounded-lg text-slate-450 transition-all cursor-default ${sidebarCollapsed ? '' : 'hidden xl:flex'} items-center justify-center`}
          >
            <Globe className={`w-4 h-4 ${isOfflineMode ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`} />
          </div>
        </div>

      </aside>

      {/* Main Independence Dashboard Right scroll-container (independent scroll-box) */}
      <div className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden relative ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'bg-slate-950' : 'bg-[#f5f6fa] dark:bg-slate-950'} select-none`}>
        
        {/* Screen container */}
        <div className={`flex-grow flex flex-col ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'bg-slate-950' : 'bg-[#f5f6fa] dark:bg-slate-950'} min-h-0 overflow-y-auto relative scrollbar-none pb-20 md:pb-0`}>

        
          {/* 2. Top Bar Desktop */}
          <header className={`hidden md:flex sticky top-0 z-35 ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'bg-slate-950 border-slate-800' : 'bg-white dark:bg-slate-905 border-slate-100/80 dark:border-slate-800/80 shadow-xs'} border-b px-6 py-4.5 select-none items-center justify-between shrink-0 transition-colors duration-300`}>
            <div className="flex items-center space-x-3.5 flex-1 animate-fade-in">
              {/* Business Logo / Avatar and Name */}
              <div className="flex items-center space-x-3 shrink-0">
                {(() => {
                  let logo = logoUrl || systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant.company_settings?.logo_url || null;
                  if (!logo) {
                    const cachedSet = localStorage.getItem(`jasper_settings_${activeTenant.id}`);
                    if (cachedSet) {
                      try {
                        const pSet = JSON.parse(cachedSet);
                        logo = pSet?.company?.logo || pSet?.business?.businessLogoLight || pSet?.business?.businessLogo || null;
                      } catch (err) {}
                    }
                  }
                  if (logo) {
                    return (
                      <img 
                        src={logo} 
                        alt={`${activeTenant.name} Logo`} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-[#00C853] shrink-0 shadow-xs" 
                        referrerPolicy="no-referrer"
                      />
                    );
                  } else {
                    return (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00C853] to-teal-400 text-white flex items-center justify-center font-black text-xs tracking-wider shrink-0 shadow-xs">
                        {getFallbackInitials(activeTenant.name)}
                      </div>
                    );
                  }
                })()}
                <div className="flex flex-col text-left">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white capitalize leading-tight">
                    {activeTenant.name}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-0.5">
                    {t(customSidebarItems.find((m: any) => m.id === activeTab || m.tabId === activeTab)?.label || activeTab.replace(/-/g, ' '))} Screen
                  </span>
                </div>
              </div>

              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'bg-slate-900 border-slate-800/60' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800/60'} w-full max-w-sm transition-colors`}>
                <Search className={`w-4 h-4 ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'text-slate-500' : 'text-slate-400'}`} />
                <input 
                  type="text" 
                  placeholder="Search workspace..."
                  className={`bg-transparent outline-none border-none text-xs w-full ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'text-slate-300 placeholder-slate-600' : 'text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500'}`}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
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
                        { code: 'sw', label: 'Swahili' },
                        { code: 'ar', label: '🇸🇦 العربية' },
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
                  setActiveTab('sync');
                  setMoreMenuOpen(false);
                }}
              >
                <Bell className="w-4 h-4" />
                {offlinePendingCount > 0 && <div className="absolute top-1 right-1 w-2 h-2 bg-[#ef4444] rounded-full border border-white" />}
              </div>

              {/* User Avatar Circle */}
              <div 
                className="w-8.5 h-8.5 bg-white text-slate-800 rounded-full flex-center font-black text-xs uppercase shadow cursor-pointer hover:opacity-90 hover:scale-102 active:scale-97 transition-all leading-none select-none flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700"
                onClick={() => setMoreMenuOpen(true)}
              >
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
            </div>
          </header>

          {/* 2b. Top Bar Mobile - Exact 60px height sticky glassmorphic header */}
          <header className="md:hidden sticky top-0 z-35 h-[62px] backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-b border-slate-100/10 dark:border-slate-800/15 px-4 select-none flex items-center justify-between shrink-0 transition-all duration-300">
            {/* Left: business logo or initials avatar on mobile top bar */}
            <div className="flex items-center space-x-3 animate-fade-in">
              <div 
                onClick={() => setMoreMenuOpen(true)}
                className="cursor-pointer active:scale-95 shrink-0 select-none"
                title="Open Workspace Menu"
              >
                {(() => {
                  let logo = logoUrl || systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant.company_settings?.logo_url || null;
                  if (!logo) {
                    const cachedSet = localStorage.getItem(`jasper_settings_${activeTenant.id}`);
                    if (cachedSet) {
                      try {
                        const pSet = JSON.parse(cachedSet);
                        logo = pSet?.company?.logo || pSet?.business?.businessLogoLight || pSet?.business?.businessLogo || null;
                      } catch (err) {}
                    }
                  }
                  if (logo) {
                    return (
                      <img 
                        src={logo} 
                        alt={`${activeTenant.name} Logo`} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-[#00C853] shadow-sm shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                    );
                  } else {
                    return (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00C853] to-teal-400 text-white flex items-center justify-center font-black text-xs tracking-wider shrink-0 shadow-sm">
                        {getFallbackInitials(activeTenant.name)}
                      </div>
                    );
                  }
                })()}
              </div>
              <div className="flex flex-col items-start leading-none text-left">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white capitalize tracking-tight mb-0.5">
                  {activeTenant.name}
                </span>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t(customSidebarItems.find((m: any) => m.id === activeTab || m.tabId === activeTab)?.label || activeTab.replace(/-/g, ' '))}
                </span>
              </div>
            </div>

            {/* Center: Clean whitespace (nothing, per design) */}
            <div className="flex-1" />

            {/* Right: Search icon + Language + Notification bell with unread dot indicator */}
            <div className="flex items-center space-x-1">
              <button className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90 cursor-pointer">
                <Search className="w-4.5 h-4.5" />
              </button>

              {/* Mobile Language Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDashLangMenu(!showDashLangMenu)}
                  className="p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90 flex items-center justify-center cursor-pointer"
                  title="Select Language / Badili Lugha"
                >
                  <Globe className="w-4.5 h-4.5 text-emerald-500" />
                </button>

                {showDashLangMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDashLangMenu(false)} />
                    <div className="absolute right-0 mt-2 w-32 rounded-xl border p-1 shadow-xl z-50 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-200">
                      {[
                        { code: 'en', label: 'English' },
                        { code: 'sw', label: 'Swahili' },
                        { code: 'ar', label: '🇸🇦 العربية' },
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
                onClick={() => setActiveTab('sync')}
              >
                <Bell className="w-4.5 h-4.5" />
                {offlinePendingCount > 0 && <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />}
              </div>
            </div>
          </header>

          {/* Core workspace content viewports */}
          <main id="workspace-content" className={`flex-grow ${activeTab === 'super-saas' || activeTab.startsWith('admin-') ? 'p-0 bg-slate-950 flex flex-col' : 'p-4 md:p-6 bg-[#f5f6fa] dark:bg-slate-950 space-y-6 pb-24'} min-h-[500px]`}>
            
            {user.role !== 'SuperAdmin' && renderSubscriptionStatusBlock()}

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
                  return { ...prev, [delivery.tenantId]: [delivery, ...currentDeliveries] };
                });
              }}
              onDispatchDelivery={handleDispatchDelivery}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              products={activeProducts}
              systemSettings={systemSettings}
              sales={activeSales}
              pendingNotes={pendingDeliveryNotesMap[activeTenant.id] || []}
              onUpdatePendingNotes={handleUpdatePendingDeliveryNotes}
              defaultSubTab={deliveriesSubTab}
              onSubTabChange={(tab) => setDeliveriesSubTab(tab)}
              expenses={expensesMap[activeTenant.id] || []}
              onAddExpense={handleAddExpense}
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
              purchases={purchasesMap[activeTenant.id] || []}
              deliveries={deliveriesMap[activeTenant.id] || []}
            />
          )}

          {/* TAB ROOT: High-Fidelity Sales Receipts History list */}
          {activeTab === 'sales-list' && (
            <DashboardSalesList 
              activeTenant={activeTenant}
              sales={activeSales}
              onUpdateSales={handleUpdateSales}
              rolePermissions={currentPermissions}
              products={activeProducts}
              systemSettings={systemSettings}
              onPreloadCartForPOS={(items, backdate) => {
                setPreloadedCart({ items, backdate });
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
              userName={user.name}
              sales={activeSales}
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
              purchases={purchasesMap[activeTenant.id] || []}
            />
          )}

          {/* TAB ROOT: Smart Generative Forecasting (AI Pro) */}
          {activeTab === 'forecasting' && (
            <DashboardForecasting 
              activeTenant={activeTenant}
              products={activeProducts}
              sales={activeSales}
              onUpdateStocks={handleUpdateActiveStocks}
            />
          )}

          {/* TAB ROOT: Cash & Bank Balance Matrix (Double-Entry Treasury Ledger) */}
          {activeTab === 'cash-bank-matrix' && (
            <DashboardCashBank 
              activeTenant={activeTenant}
              sales={activeSales}
              expenses={activeExpenses}
              deliveries={deliveriesMap[activeTenant.id] || []}
              user={user}
            />
          )}

          {/* TAB ROOT: Agency White-Label Branding Studio */}
          {activeTab === 'whitelabel' && (
            <DashboardWhiteLabel 
              activeTenant={activeTenant}
            />
          )}

          {/* TAB ROOT: Staff Members */}
          {activeTab === 'staff-members' && (
            <DashboardStaff 
              systemSettings={systemSettings}
              onUpdateSettings={(updated) => {
                setSystemSettings(updated);
                localStorage.setItem(`jasper_settings_${activeTenant.id}`, JSON.stringify(updated));
              }}
              sales={activeSales}
              expenses={activeExpenses}
              activeTenant={activeTenant}
              deliveries={deliveriesMap[activeTenant.id] || []}
            />
          )}

          {/* TAB ROOT: System Settings */}
          {activeTab === 'settings' && (
            <DashboardSettings 
              activeTenant={activeTenant}
              systemSettings={systemSettings}
              onSaveSettings={(updated) => {
                setSystemSettings(updated);
                localStorage.setItem(`jasper_settings_${activeTenant.id}`, JSON.stringify(updated));
                let logoToSave = '';
                if (updated.company?.logo) {
                  logoToSave = updated.company.logo;
                } else if (updated.business?.businessLogoLight) {
                  logoToSave = updated.business.businessLogoLight;
                } else if (updated.business?.businessLogo) {
                  logoToSave = updated.business.businessLogo;
                }
                if (logoToSave) {
                  localStorage.setItem(`jasper_tenant_logo_${activeTenant.id}`, logoToSave);
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
              sales={salesMap[activeTenant.id] || []}
              expenses={expensesMap[activeTenant.id] || []}
              deliveries={deliveriesMap[activeTenant.id] || []}
            />
          )}

           {/* TAB ROOT: Super SaaS Admin Control Panel */}
           {(activeTab === 'super-saas' || activeTab.startsWith('admin-')) && (
             <SuperSaaSAdminView 
               activeAdminSubTab={
                 activeTab === 'admin-dashboard' ? 'dashboard' :
                 activeTab === 'admin-subscribers' ? 'subscribers' :
                 activeTab === 'admin-hw-pos' ? 'hw-pos' :
                 activeTab === 'admin-hw-inventory' ? 'hw-inventory' :
                 activeTab === 'admin-hw-sales' ? 'hw-sales' :
                 activeTab === 'admin-affiliates' ? 'affiliates' :
                 activeTab === 'admin-status' ? 'status' :
                 activeTab === 'admin-reports' ? 'reports' :
                  activeTab === 'admin-expenses' ? 'expenses' :
                 activeTab === 'admin-chats' ? 'chats' :
                 activeTab === 'admin-inbox' ? 'inbox' :
                 activeTab === 'admin-promotions' ? 'promotions' :
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
                   subTab === 'status' ? 'admin-status' :
                   subTab === 'reports' ? 'admin-reports' :
                    subTab === 'expenses' ? 'admin-expenses' :
                   subTab === 'chats' ? 'admin-chats' :
                   subTab === 'inbox' ? 'admin-inbox' :
                   subTab === 'promotions' ? 'admin-promotions' :
                   subTab === 'web-editor' ? 'admin-web-editor' :
                   subTab === 'settings' ? 'admin-settings' : 'admin-dashboard';
                 setActiveTab(mappedTab);
               }}
              hideSidebar={true}
            />
          )}

          </main>

          {/* Mobile Bottom Navigation Component */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-t border-emerald-500/15 pb-[calc(0.5rem+env(safe-area-inset-bottom))] px-3 pt-2 flex items-center justify-around shadow-[0_-8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.35)] shrink-0 transition-all duration-300">
             {[
               { id: 'overview', label: 'Home', icon: LayoutDashboard },
               { id: 'sales-list', label: 'Sales', icon: FileText },
               { id: 'pos', label: 'POS', icon: ShoppingCart },
               { id: 'reports', label: 'Reports', icon: PieChart },
             ].map((tab) => {
               const isActive = activeTab === tab.id;
               const Icon = tab.icon;
               return (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`flex flex-col items-center justify-between h-11 w-16 relative transition-all duration-150 active:scale-95 cursor-pointer ${
                     isActive ? 'text-[#00C853] font-bold' : 'text-slate-400 dark:text-slate-500'
                   }`}
                 >
                   <div className="flex flex-col items-center justify-center flex-1">
                     <Icon 
                       className={`w-5 h-5 mb-0.5 transition-transform duration-200 ${isActive ? 'scale-110 text-[#00C853] fill-emerald-500/10' : ''}`} 
                       strokeWidth={isActive ? 2.5 : 2} 
                     />
                     <span className="text-[9px] font-semibold tracking-tight">{isActive ? t(tab.label) : t(tab.label)}</span>
                   </div>
                   {isActive && (
                     <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] shadow-[0_0_10px_#00C853] animate-bounce mb-0.5" />
                   )}
                 </button>
               )
             })}
             
             <button 
               onClick={() => setMoreMenuOpen(true)}
               className={`flex flex-col items-center justify-between h-11 w-16 relative transition-all duration-150 active:scale-95 cursor-pointer ${
                 moreMenuOpen ? 'text-[#00C853] font-bold' : 'text-slate-400 dark:text-slate-500'
               }`}
             >
               <div className="flex flex-col items-center justify-center flex-1">
                 <Menu className={`w-5 h-5 mb-0.5 transition-transform duration-200 ${moreMenuOpen ? 'scale-110 text-[#00C853]' : ''}`} />
                 <span className="text-[9px] font-semibold tracking-tight">{t('More')}</span>
               </div>
               {moreMenuOpen && (
                 <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] shadow-[0_0_10px_#00C853] mb-0.5" />
               )}
             </button>
          </nav>

          {/* 5. Mobile Floating Action Button (FAB) (Brand green, rounded-full, 56px, above bottom nav) */}
          <button
            onClick={() => setActiveTab('pos')}
            className={`md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-[#00C853] hover:bg-[#00953D] text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all duration-150 fab-attention-pulse cursor-pointer`}
            title="Quick POS Checkout"
            type="button"
          >
            <span className="text-[28px] font-light leading-none select-none">+</span>
          </button>

        </div>

        {/* Universal sub-modal anchors & floating elements */}
        <div 
          className={`absolute inset-0 z-[60] bg-white flex flex-col select-none transition-transform duration-300 ${moreMenuOpen ? 'translate-y-0 shadow-[-5px_0_30px_rgba(0,0,0,0.15)]' : 'translate-y-full pointer-events-none'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Menu</h2>
            <button 
              onClick={() => setMoreMenuOpen(false)}
              className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Links Container */}
          <div className="flex-grow overflow-y-auto px-4 py-2 pb-20">
            <div className="flex flex-col">
              {[
                { id: 'purchases-list', label: 'Purchases', icon: ShoppingCart, colorTheme: 'blue' },
                { id: 'suppliers', label: 'Partners', icon: Handshake, colorTheme: 'purple' },
                { id: 'deliveries', label: 'Delivery', icon: MapPin, colorTheme: 'teal' },
                { id: 'products', label: 'Products', icon: Package, colorTheme: 'emerald' },
                { id: 'expenses', label: 'Expenses', icon: MinusCircle, colorTheme: 'rose' },
                { id: 'settings', label: 'Settings', icon: SettingsIcon, colorTheme: 'slate' },
                { id: 'sync', label: 'Offline Sync', icon: RefreshCw, colorTheme: 'amber' }
              ].map((option) => {
                const IconComponent = option.icon;
                
                let textColors = 'text-slate-800';
                let bgColors = 'bg-slate-50 border-slate-100';
                let iconColors = 'text-slate-500';
                
                if (option.colorTheme === 'blue') {
                  bgColors = 'bg-blue-50 border-blue-100';
                  iconColors = 'text-blue-500';
                } else if (option.colorTheme === 'purple') {
                  bgColors = 'bg-purple-50 border-purple-100';
                  iconColors = 'text-purple-500';
                } else if (option.colorTheme === 'teal') {
                  bgColors = 'bg-teal-50 border-teal-100';
                  iconColors = 'text-teal-500';
                } else if (option.colorTheme === 'emerald') {
                  bgColors = 'bg-emerald-50 border-emerald-100';
                  iconColors = 'text-emerald-500';
                } else if (option.colorTheme === 'rose') {
                  bgColors = 'bg-rose-50 border-rose-100';
                  iconColors = 'text-rose-500';
                } else if (option.colorTheme === 'slate') {
                  bgColors = 'bg-slate-100 border-slate-200';
                  iconColors = 'text-slate-500';
                } else if (option.colorTheme === 'amber') {
                  bgColors = 'bg-amber-50 border-amber-100';
                  iconColors = 'text-amber-500';
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      setActiveTab(option.id as any);
                      setMoreMenuOpen(false);
                    }}
                    className="w-full px-2 flex items-center justify-between min-h-[56px] py-2.5 border-b border-slate-100 transition-colors hover:bg-slate-50 active:bg-slate-100 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative shrink-0">
                        <div className={`w-[44px] h-[44px] rounded-xl flex items-center justify-center border ${bgColors}`}>
                          <IconComponent className={`w-5 h-5 ${iconColors}`} />
                        </div>
                        {option.id === 'sync' && (
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-[2px] border-white ${isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        )}
                      </div>
                      <span className={`text-sm font-semibold tracking-tight ${textColors}`}>{option.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                );
              })}

              {/* Logout Button */}
              <button
                onClick={() => {
                  setShowLogoutConfirm(true);
                }}
                className="w-full px-2 flex items-center justify-between min-h-[56px] py-2.5 transition-colors hover:bg-rose-50/50 active:bg-rose-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-[44px] h-[44px] flex items-center justify-center rounded-xl bg-rose-50 border border-rose-100 shrink-0">
                    <LogOut className="w-5 h-5 text-rose-500" />
                  </div>
                  <span className="text-sm font-semibold tracking-tight text-rose-600">Logout</span>
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
      />

      {/* Live Premium Subscription upgrade popups */}
      {subModal && subModal.show && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-in fade-in slide-in-from-bottom-5 md:slide-in-from-bottom-0">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl md:rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 relative shadow-2xl mt-auto md:mt-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-8 animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0">
            {/* Mobile Drag Handle */}
            <div className="w-full flex justify-center pb-2 md:hidden">
              <div className="w-12 h-1.5 bg-slate-700/50 rounded-full" />
            </div>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-wider">
                {subModal.title}
              </h3>
              <p className="text-xs text-slate-450 max-w-md mx-auto">
                You have reached your subscription tier limits! To sustain your business operations, please choose one of our three premium subscription packages to pay and unlock capacity instantly.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between font-mono">
                <span className="text-slate-400 uppercase font-bold">Quota Category:</span>
                <span className="text-rose-400 font-bold uppercase tracking-widest">
                  {subModal.limitType === 'products' ? 'Products Exhausted' : 
                   subModal.limitType === 'stores' ? 'Branches Full' :
                   subModal.limitType === 'staff' ? 'Staff Limit Reached' : 'Trial Concluded'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-350">
                <span>Active Subscription Tier:</span>
                <span className="text-white font-bold">{subStatus.plan.name}</span>
              </div>
              <p className="text-[11.5px] text-slate-500 pt-2 border-t border-slate-800/40 text-center italic font-mono">
                "Instant, non-disruptive cloud upgrades for modern store networks."
              </p>
            </div>

            {/* Live Plan Select Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Plan 1 */}
              <button
                onClick={() => {
                  updateSubscriptionPlan('essential');
                  setSubModal(null);
                }}
                className="bg-slate-950/50 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl text-left transition-all space-y-2 cursor-pointer outline-none focus:border-emerald-500"
              >
                <h5 className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">Essential Ledger</h5>
                <div className="text-lg font-black text-white font-mono">{activeTenant.currency}15,000</div>
                <ul className="text-[9.5px] text-slate-400 space-y-0.5 list-disc list-inside">
                  <li>1,000 Products max</li>
                  <li>5 Branch Stores max</li>
                  <li>5 Cashier/Staff max</li>
                </ul>
              </button>

              {/* Plan 2 */}
              <button
                onClick={() => {
                  updateSubscriptionPlan('business');
                  setSubModal(null);
                }}
                className="bg-slate-950 hover:bg-slate-950 border-2 border-emerald-500/30 hover:border-emerald-500/60 p-4 rounded-xl text-left transition-all space-y-2 cursor-pointer outline-none focus:border-emerald-500"
              >
                <span className="bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase block w-max mb-1">Best Choice</span>
                <h5 className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">Standard Business</h5>
                <div className="text-lg font-black text-white font-mono">{activeTenant.currency}30,000</div>
                <ul className="text-[9.5px] text-slate-400 space-y-0.5 list-disc list-inside">
                  <li>5,000 Products max</li>
                  <li>8 Branch Stores max</li>
                  <li>8 Cashier/Staff max</li>
                </ul>
              </button>

              {/* Plan 3 */}
              <button
                onClick={() => {
                  updateSubscriptionPlan('wholesale');
                  setSubModal(null);
                }}
                className="bg-slate-950/50 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl text-left transition-all space-y-2 cursor-pointer outline-none focus:border-emerald-500"
              >
                <h5 className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">Premium</h5>
                <div className="text-lg font-black text-white font-mono">{activeTenant.currency}45,000</div>
                <ul className="text-[9.5px] text-slate-400 space-y-0.5 list-disc list-inside">
                  <li>Unlimited Products</li>
                  <li>10 Active branches</li>
                  <li>10 Cashier/Staff max</li>
                </ul>
              </button>
            </div>

            {/* Manual Payment Fallback */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-inner mt-4">
              <h5 className="text-[11px] uppercase font-bold text-slate-300 font-mono flex items-center space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Payment Gateway Failed?</span>
              </h5>
              <p className="text-[10px] text-slate-400 mt-1 mb-3">
                If the automated payment gateway fails, pay directly via local bank/mobile transfer and upload the receipt here. Our support team will verify and activate your subscription manually.
              </p>
              <div className="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-3">
                <div className="flex-1 w-full relative">
                  <input type="file" id="receipt-upload" className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" accept="image/*,.pdf" />
                  <div className="bg-slate-950 border border-slate-800 border-dashed hover:border-emerald-500/50 rounded-xl px-3 py-2 flex items-center justify-center space-x-2 text-slate-400 group transition-colors">
                    <CloudLightning className="w-4 h-4 group-hover:text-emerald-400" />
                    <span className="text-[10px] font-bold">Attach Receipt Document</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    alert("Manual activation request submitted with attached receipt. Please wait for admin approval.");
                    setSubModal(null);
                  }}
                  className="w-full md:w-auto px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold uppercase border border-indigo-500/20 text-[10px] rounded-xl transition-all tracking-wider shrink-0"
                >
                  Send Activation Request
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSubModal(null)}
                className="px-5 py-2 hover:bg-slate-850 text-slate-400 hover:text-white font-medium text-xs font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        </div>
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
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
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
    </div>
  );
}
