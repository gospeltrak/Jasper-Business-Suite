import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Sale, Tenant, SaleItem, Product, SystemSettings, SalesDocument, User as AppUser } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatSaleItemQuantity } from '../utils/unitFormatter';
import { isDemoTenant } from '../utils/tenantIsolation';
import { safeSetJsonItem } from '../utils/dataSafety';
import {
  Search, 
  Calendar, 
  Filter, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  User, 
  Phone, 
  ArrowRight,
  TrendingUp,
  X,
  CreditCard,
  XOctagon,
  Menu,
  Edit,
  Trash2,
  Plus,
  Check,
  Building,
  Coins,
  MessageSquare,
  Download,
  Bike,
  Eye,
  Lock,
  WifiOff,
  Receipt,
  MoreVertical,
  AlertCircle,
  ChevronRight,
  PlusCircle,
  Pencil,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Share2,
  ChevronLeft,
  Barcode,
  ScanLine,
  RefreshCw
} from 'lucide-react';
import { downloadPdfFromElement, shareElementPdfToWhatsApp } from '../utils/pdfShare';
import CachedImage from './CachedImage';
import { getBusinessDisplayName, getBusinessLogo } from '../utils/businessBranding';
import { normalizeSubscriptionPlanId } from '../utils/subscription';
import { findPaymentChannel, getPaymentModeName } from '../utils/paymentAccounts';
import { calculateSalesDocumentTotals } from '../utils/salesDocumentTotals';
import {
  createCrossBranchCommercialDocument,
  convertCrossBranchCommercialDocument,
  loadCrossBranchDocumentSources,
  type CrossBranchDocumentSources,
} from '../branches/branchApi';

// A high-fidelity composite component representing a rider on a motorcycle with a delivery basket on their back
function DeliveryMotorcycleIcon({ className, size = 14 }: { className?: string; size?: number }) {
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
      {/* Motorcycle Frame / Engine Body */}
      <path d="M 5 18 L 8 14 L 14 14 L 18 18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M 8 14 L 15.5 14" stroke="currentColor" strokeWidth="1.5" />
      
      {/* Engine component block */}
      <rect x="9" y="14.8" width="4" height="2.2" rx="0.6" fill="currentColor" className="opacity-50" />

      {/* Front wheel & Shock fork */}
      <circle cx="19" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M 19 18 L 17 11.5 M 17 11.5 L 18 8" stroke="currentColor" strokeWidth="1.8" />
      <line x1="18.5" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2" /> {/* Handlebars */}

      {/* Rear wheel & Chain swingarm */}
      <circle cx="5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M 5 18 L 8 14" stroke="currentColor" strokeWidth="1.8" />

      {/* Headlight lamp */}
      <path d="M 18.2 9 L 19.5 9" stroke="currentColor" strokeWidth="1.2" />

      {/* Rider Body */}
      {/* Torso leaning forward in active sporty riding pose */}
      <path d="M 10 14 L 12 8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      
      {/* Arms reaching the handlebars */}
      <path d="M 11.5 10 L 16.5 8.5" stroke="currentColor" strokeWidth="1.5" />

      {/* Leg bent on chassis footpeg */}
      <path d="M 10 14 L 11.8 16.2 H 13.5" stroke="currentColor" strokeWidth="1.5" />

      {/* Rider Helmet (Head) */}
      <circle cx="12.8" cy="6" r="1.8" fill="currentColor" />
      <path d="M 13.5 6.3 H 14.3" stroke="currentColor" strokeWidth="0.8" /> {/* Front helmet glass visor */}

      {/* Large Delivery Backpack on the rider's back */}
      <rect x="5.5" y="6" width="4.5" height="6.2" rx="1" fill="currentColor" className="text-emerald-500 stroke-emerald-600" strokeWidth="0.5" />
      
      {/* Contrast insulation stripes / backpack features */}
      <path d="M 6 8 H 9.5" stroke="white" strokeWidth="0.6" />
      <path d="M 6 10 H 9.5" stroke="white" strokeWidth="0.6" strokeDasharray="1 1" />
      <path d="M 7.5 6 L 7.5 12" stroke="white" strokeWidth="0.5" className="opacity-80" />
    </svg>
  );
}

export interface TillSettlement {
  id: string;
  timestamp: string;
  cashierName: string;
  openingFloat: number;
  expectedSalesCash: number;
  actualCashInDrawer: number;
  paymentInAmount: number;
  discrepancy: number;
  vaultDestination: string;
  status: 'settled' | 'audited';
  memo?: string;
  receiptFileName?: string;
  receiptFileSize?: string;
  receiptSmsText?: string;
  openingFloatVerified?: boolean;
}

const DEFAULT_SETTLEMENTS: TillSettlement[] = [
  {
    id: 'SETTLE-8402',
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    cashierName: 'Jane Smith',
    openingFloat: 150,
    expectedSalesCash: 450,
    actualCashInDrawer: 600,
    paymentInAmount: 600,
    discrepancy: 0,
    vaultDestination: 'Main Safe Vault',
    status: 'audited',
    memo: 'Daily sales closing, reconciled 100% with cash drawer tally.'
  },
  {
    id: 'SETTLE-8391',
    timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    cashierName: 'Robert Kiprop',
    openingFloat: 100,
    expectedSalesCash: 820,
    actualCashInDrawer: 915,
    paymentInAmount: 900,
    discrepancy: -5,
    vaultDestination: 'Co-operative Bank Till #1',
    status: 'settled',
    memo: 'Slightly short on drawer cash due to coin change deficits.'
  }
];

interface DashboardSalesListProps {
  activeTenant: Tenant;
  sales: Sale[];
  onUpdateSales?: (updatedSales: Sale[]) => Promise<boolean> | boolean;
  onDeleteSale?: (sale: Sale) => Promise<boolean> | boolean;
  rolePermissions?: any;
  products?: Product[];
  /**
   * Full tenant-wide product catalog, unscoped by the dashboard's active
   * branch selection. Used only by the cross-branch document wizard, which
   * must be able to resolve product names/details for whichever branch the
   * user picks there, not just the branch currently active on the dashboard.
   */
  allTenantProducts?: Product[];
  /** The branch the user is currently operating the dashboard from. */
  activeBranchId?: string | null;
  systemSettings?: SystemSettings;
  onPreloadCartForPOS?: (
    items: SaleItem[],
    backdate?: string,
    options?: {
      deliveryCost?: number;
      paymentMethod?: string;
      customerName?: string;
      customerPhone?: string;
      hasVat?: boolean;
    }
  ) => void;
  currentUser?: AppUser;
  subscriptionStatus?: any;
  onSendToDeliveryNote?: (sale: Sale) => void;
}

export default function DashboardSalesList({ 
  activeTenant, 
  sales, 
  onUpdateSales, 
  onDeleteSale,
  rolePermissions,
  products = [],
  allTenantProducts,
  activeBranchId,
  systemSettings,
  onPreloadCartForPOS,
  currentUser,
  subscriptionStatus,
  onSendToDeliveryNote
}: DashboardSalesListProps) {
  const currency = activeTenant.currency;

  const [viewingSaleDetail, setViewingSaleDetail] = useState<Sale | null>(null);

  const getSaleReference = (sale: Sale) => {
    if (sale.reference && !sale.reference.startsWith('CASH-LEDGER-') && !sale.reference.startsWith('DIRECT-SALE-') && !sale.reference.startsWith('sl-') && !sale.reference.startsWith('REC-') && !sale.reference.startsWith('sr-')) {
      return sale.reference;
    }
    // Generate a predictable but unique 4 digit number from the sale ID if no reference exists or if it's a default generated key
    const idStr = sale.id || '';
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const positiveHash = Math.abs(hash);
    const min = 1000;
    const max = 9999;
    const range = max - min + 1;
    const uniqueNum = min + (positiveHash % range);
    return `TX-${uniqueNum}`;
  };

  const formatShortDateTime = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} '${year}, ${hours}:${minutes}`;
  };
  
  // Current local date in YYYY-MM-DD format as default
  const getTodayLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date Selection Range - default is current day
  const [startDate, setStartDate] = useState<string>(getTodayLocalDateStr());
  const [endDate, setEndDate] = useState<string>(getTodayLocalDateStr());

  // Sub tab selection (Sales transaction ledger vs. Customer A/R Debt vs. Seller Shift settlements)
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'debts' | 'settlement' | 'documents'>('sales');

  const activePlanId = normalizeSubscriptionPlanId(
    subscriptionStatus?.state?.planId
      || subscriptionStatus?.plan?.packageId
      || subscriptionStatus?.plan?.id
      || activeTenant.activePackageId
      || activeTenant.selectedPackageId
      || (activeTenant as any).subscriptionPlan
  );
  const canUseCrossBranchDocuments = activePlanId === 'tanzanite';
  const canUseTillSettlement = activePlanId !== 'ruby';

  useEffect(() => {
    if (!canUseTillSettlement && activeSubTab === 'settlement') {
      setActiveSubTab('sales');
    }
  }, [activeSubTab, canUseTillSettlement]);

  const salesSubTabs = [
    { id: 'sales', icon: <Receipt className="w-4 h-4" />, label: 'Receipts', color: '#4f46e5' },
    { id: 'debts', icon: <Coins className="w-4 h-4" />, label: 'Credit & Debts', color: '#d97706', badge: sales.filter(s=>s.paymentMethod==='Credit'&&(s.total-(s.amountPaid!==undefined?s.amountPaid:0))>0).length },
    { id: 'settlement', icon: <Building className="w-4 h-4" />, label: 'Till Settlement', color: '#7c3aed' },
    { id: 'documents', icon: <FileText className="w-4 h-4" />, label: 'Quotes & Invoices', color: '#0d9488' },
  ].filter(tab => tab.id !== 'settlement' || canUseTillSettlement);

  const mobileSalesSubTabs = [
    { id: 'sales', icon: <Receipt className="w-[18px] h-[18px]" />, label: 'Receipts', color: '#10b981', activeBg: '#10b981' },
    { id: 'debts', icon: <Coins className="w-[18px] h-[18px]" />, label: 'Debts', color: '#10b981', activeBg: '#10b981', badge: sales.filter(s => s.paymentMethod === 'Credit' && (s.total - (s.amountPaid !== undefined ? s.amountPaid : 0)) > 0).length },
    { id: 'settlement', icon: <Building className="w-[18px] h-[18px]" />, label: 'Settle', color: '#10b981', activeBg: '#10b981' },
    { id: 'documents', icon: <FileText className="w-[18px] h-[18px]" />, label: 'Quotes', color: '#10b981', activeBg: '#10b981' },
  ].filter(tab => tab.id !== 'settlement' || canUseTillSettlement);

  const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const money = (value: unknown) => `${currency}${Math.round(toNumber(value)).toLocaleString()}`;
  // Deterministic decorative barcode — same visual-only hashing approach
  // used for printed product labels (DashboardProducts.tsx), not a real
  // scannable symbology.
  const receiptBarcodeDigits = (code: string) => {
    const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + 7;
    return String(hash).padStart(13, '0').slice(-13);
  };
  const renderReceiptBarcodeBars = (code: string) => {
    const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + 7;
    return Array.from({ length: 46 }, (_, i) => {
      const isBlack = i % 2 === 0;
      const isGuard = i < 3 || (i >= 21 && i <= 23) || i > 42;
      const w = (hash * (i + 17)) % 10;
      const width = isGuard ? 1.5 : w < 4 ? 1.5 : w < 7 ? 2.5 : w < 9 ? 3.8 : 5;
      return <div key={i} style={{ height: '32px', flexShrink: 0, background: isBlack ? '#000' : 'transparent', width: `${width}px` }} />;
    });
  };
  const normalizeDocType = (type: SalesDocument['type'] | string): SalesDocument['type'] => {
    if (type === 'price quote invoice' || type === 'invoice') return 'proforma invoice';
    if (type === 'quotation') return 'price quote';
    return (type as SalesDocument['type']) || 'price quote';
  };
  const getDocumentLabel = (type: SalesDocument['type'] | string) => normalizeDocType(type) === 'proforma invoice' ? 'Proforma Invoice' : 'Price Quote';
  const getDocumentItemName = (item: SaleItem) => {
    const product = products.find(p => p.id === item.productId);
    return (item as any).item_description || (item as any).description || item.productName || (item as any).name || product?.name || 'Item';
  };
  const getDocumentItemUnit = (item: SaleItem) => item.unit || item.sellUnit || item.baseUnit || '';
  const getLegacyLineTotal = (item: SaleItem) => {
    const qty = toNumber(item.qty);
    const price = toNumber(item.price);
    const discount = toNumber(item.discount);
    const effectivePrice = item.discountType === 'cash'
      ? Math.max(0, price - discount)
      : price * (1 - discount / 100);
    return Math.max(0, effectivePrice * qty);
  };
  const getLineTotal = (item: SaleItem) => Math.max(0, toNumber(item.qty) * toNumber(item.price));
  const normalizeDocumentDiscount = (doc: SalesDocument): SalesDocument => {
    const rawSubtotal = (doc.items || []).reduce((sum, item) => sum + getLineTotal(item), 0);
    const legacySubtotal = (doc.items || []).reduce((sum, item) => sum + getLegacyLineTotal(item), 0);
    const legacyDiscount = Math.max(0, rawSubtotal - legacySubtotal);
    const discountAmount = Math.max(0, toNumber(doc.discountAmount, legacyDiscount));
    const taxableAmount = Math.max(0, rawSubtotal - discountAmount);
    const legacyTax = Math.max(0, toNumber(doc.tax));
    return {
      ...doc,
      discountAmount,
      discountValue: Math.max(0, toNumber(doc.discountValue, discountAmount)),
      discountType: doc.discountType || 'cash',
      hasVat: doc.hasVat ?? (legacyTax > 0),
      taxRate: doc.taxRate ?? (legacyTax > 0 && taxableAmount > 0
        ? legacyTax / taxableAmount
        : (activeTenant.taxRate ?? 0.18)),
      items: (doc.items || []).map(item => ({ ...item, discount: 0, discountType: 'percent' })),
    };
  };
  const getDocumentTotals = (doc: SalesDocument) => {
    return calculateSalesDocumentTotals({
      items: doc.items,
      discountAmount: doc.discountAmount,
      deliveryCost: doc.deliveryCost,
      hasVat: !!doc.hasVat,
      taxRate: doc.taxRate ?? activeTenant.taxRate ?? 0.18,
      paidAmount: (doc as SalesDocument & { paidAmount?: number }).paidAmount,
    });
  };
  const getInvoiceFooter = (doc?: SalesDocument) => {
    const snapshot = (doc?.brandingSnapshot || {}) as Record<string, any>;
    const businessName = snapshot.businessName || snapshot.branchName || getBusinessDisplayName(activeTenant, systemSettings);
    const mainMessage = doc?.tagline || systemSettings?.invoiceSettings?.footerNote || 'Thank you for shopping with us.';
    // Fixed brand line — a configured business website is a different concept
    // from "Powered by Orvix" attribution and must not replace it here.
    const poweredBy = 'Powered by Orvix';
    return { mainMessage, businessName, poweredBy };
  };
  const getDocumentBranding = (doc: SalesDocument) => {
    const snapshot = (doc.brandingSnapshot || {}) as Record<string, any>;
    return {
      name: snapshot.businessName || snapshot.branchName || getBusinessDisplayName(activeTenant, systemSettings),
      city: snapshot.city || activeTenant.city || '',
      address: snapshot.address || systemSettings?.business?.businessAddress || '',
      phone: snapshot.phone || systemSettings?.business?.businessPhone || '',
      email: snapshot.email || systemSettings?.business?.businessEmail || '',
      logo: getBusinessLogo(systemSettings) || '',
    };
  };

  // Load documents from onlineStorage on mount
  const [documents, setDocuments] = useState<SalesDocument[]>(() => {
    const cached = onlineStorage.getItem(`jasper_docs_${activeTenant.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SalesDocument[];
        // Map legacy document types gracefully to the current labels.
        return parsed.map(d => {
          const normalizedItems = (d.items || []).map(item => ({
            ...item,
            productName: getDocumentItemName(item),
            unit: getDocumentItemUnit(item),
            price: toNumber(item.price),
            qty: toNumber(item.qty),
            discount: toNumber(item.discount),
          }));
          return normalizeDocumentDiscount({ ...d, type: normalizeDocType(d.type), items: normalizedItems, total: toNumber(d.total, normalizedItems.reduce((sum, item) => sum + getLegacyLineTotal(item), 0)), tax: toNumber(d.tax) });
        });
      } catch (e) {
        return [];
      }
    }
    if (!isDemoTenant(activeTenant.id)) return [];
    // Demo tenants retain their example documents; provisioned tenants never receive them.
    const defaultDocs: SalesDocument[] = [
      {
        id: 'doc-qt-001',
        type: 'price quote',
        documentNumber: 'QUO-2026-0001',
        items: [
          { productId: 'p-1', productName: 'Premium Brown Rice (Sacks)', qty: 10, price: 42, discount: 0, discountType: 'percent' }
        ],
        total: 420,
        tax: 0,
        customerName: 'Amani Supermarket Ltd',
        customerPhone: '+254 711 222 333',
        customerAddress: '123 Main Street, City',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        tenantId: activeTenant.id,
        status: 'pending'
      },
      {
        id: 'doc-pf-002',
        type: 'proforma invoice',
        documentNumber: 'PRO-2026-0002',
        items: [
          { productId: 'p-2', productName: 'White Sugar (Fine Grain Box)', qty: 20, price: 30, discount: 5, discountType: 'percent' }
        ],
        total: 570,
        tax: 0,
        customerName: 'Lipa Wholesale Traders',
        customerPhone: '+254 733 444 555',
        customerAddress: '123 Main Street, City',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        tenantId: activeTenant.id,
        status: 'pending'
      }
    ];
    return defaultDocs.map(normalizeDocumentDiscount);
  });

  // Save documents back to onlineStorage whenever they change
  useEffect(() => {
    safeSetJsonItem(`jasper_docs_${activeTenant.id}`, documents, {
      tenantId: activeTenant.id,
      dataKey: 'docs',
      logLabel: `${activeTenant.id}/docs`,
    });
  }, [documents, activeTenant.id]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('All');
  const [selectedSyncStatus, setSelectedSyncStatus] = useState<string>('All');

  // Received Customer Debt Payments Search Query
  const [debtSearchTerm, setDebtSearchTerm] = useState('');

  // Settle shift / Pay-In list states
  const [tillSettlements, setTillSettlements] = useState<TillSettlement[]>(() => {
    const saved = onlineStorage.getItem(`till_settlements_${activeTenant.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return isDemoTenant(activeTenant.id) ? DEFAULT_SETTLEMENTS : [];
  });

  useEffect(() => {
    safeSetJsonItem(`till_settlements_${activeTenant.id}`, tillSettlements, {
      tenantId: activeTenant.id,
      dataKey: 'till_settlements',
      logLabel: `${activeTenant.id}/till-settlements`,
    });
  }, [tillSettlements, activeTenant.id]);

  // Selected Sale for visual receipt overlay
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isReceiptPrinting, setIsReceiptPrinting] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');

  useEffect(() => {
    if (selectedSale) {
      setWhatsappPhone(selectedSale.customerPhone || '');
    } else {
      setWhatsappPhone('');
    }
  }, [selectedSale]);

  useEffect(() => {
    if (systemSettings?.business?.tagline) {
      setNewDocTagline(systemSettings.business.tagline);
    }
  }, [systemSettings]);

  // Dropdown action popover state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{top:number;right:number} | null>(null);
  const [mobileActionsSale, setMobileActionsSale] = useState<Sale | null>(null);

  // Modal triggers
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  const [viewA4InvoiceOpen, setViewA4InvoiceOpen] = useState(false);
  // Starts below 100% (matching the delivery note preview's "optimal fit")
  // so the full A4 page is visible without cropping on tablet/mobile widths.
  const [docZoom, setDocZoom] = useState(0.65);
  // A fixed 65% still overflows most phone screens (794px * 0.65 = 516px,
  // wider than a typical 360-430px phone), forcing horizontal scrolling.
  // The A4 Invoice opens at a zoom fit to the actual device width instead —
  // capped at the tablet/desktop "optimal fit" of 65% — so the whole page
  // is visible with zero side-scrolling on any phone.
  const computeInvoiceFitZoom = () => {
    if (typeof window === 'undefined') return 0.65;
    const availableWidth = window.innerWidth - 16; // matches the canvas's px-2 side padding
    return Math.max(0.35, Math.min(0.65, availableWidth / 794));
  };
  // Same tenant-chosen brand color used by the Delivery Note template
  // (Settings → Invoice Settings → Brand Highlights Color), so the A4
  // Invoice's badge, table header, and totals box follow it too.
  const computedInvoiceColor = systemSettings?.invoiceSettings?.invoiceColor || '#4f46e5';
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false); // WYSIWYG zoom level
  const [payInInputVal, setPayInInputVal] = useState<string>('');

  // Editing transaction fields
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);
  const [deleteSaleError, setDeleteSaleError] = useState<string | null>(null);
  const openDeleteSaleConfirmation = (sale: Sale) => {
    setDeleteSaleError(null);
    setSaleToDelete(sale);
  };
  const closeDeleteSaleConfirmation = () => {
    if (isDeletingSale) return;
    setDeleteSaleError(null);
    setSaleToDelete(null);
  };

  // States for Documents Tab (Quotes, Quote, Invoices)
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<SalesDocument | null>(null);
  const [documentSendOpen, setDocumentSendOpen] = useState(false);
  const [documentSendPhone, setDocumentSendPhone] = useState('');
  const [pdfShareStatus, setPdfShareStatus] = useState<string | null>(null);
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState<'all' | 'price quote' | 'proforma invoice'>('all');
  
  // States for wizard: document creator
  const [newDocType, setNewDocType] = useState<'price quote' | 'proforma invoice'>('price quote');
  const [newDocCustomerName, setNewDocCustomerName] = useState('');
  const [newDocCustomerPhone, setNewDocCustomerPhone] = useState('');
  const [newDocCustomerAddress, setNewDocCustomerAddress] = useState('');
  const [newDocDate, setNewDocDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [newDocItems, setNewDocItems] = useState<SaleItem[]>([]);
  const [newDocTagline, setNewDocTagline] = useState(() => systemSettings?.business?.tagline || '');
  const [newDocDeliveryCost, setNewDocDeliveryCost] = useState(0);
  const [newDocDiscountValue, setNewDocDiscountValue] = useState(0);
  const [newDocDiscountType, setNewDocDiscountType] = useState<'percent' | 'cash'>('percent');
  const [newDocPaymentMethod, setNewDocPaymentMethod] = useState(() => getPaymentModeName(systemSettings?.business?.paymentModes?.[0] || 'Cash'));
  const [newDocPaymentAccountNumber, setNewDocPaymentAccountNumber] = useState(() => systemSettings?.invoiceSettings?.accountNumber || '');
  const [newDocPaymentAccountName, setNewDocPaymentAccountName] = useState(() => systemSettings?.invoiceSettings?.accountName || '');
  const [newDocHasVat, setNewDocHasVat] = useState(() => !!systemSettings?.invoiceSettings?.hasVatByDefault);
  const [crossBranchSources, setCrossBranchSources] = useState<CrossBranchDocumentSources | null>(null);
  const [crossBranchSourcesLoading, setCrossBranchSourcesLoading] = useState(false);
  const [crossBranchSourcesError, setCrossBranchSourcesError] = useState('');
  const [newDocIssuingBranchId, setNewDocIssuingBranchId] = useState('');
  const [docWizardSourceBranchId, setDocWizardSourceBranchId] = useState('');
  const [documentMutationPending, setDocumentMutationPending] = useState(false);
  const [conversionNotice, setConversionNotice] = useState<{
    kind: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const documentPaymentMethods = React.useMemo(() => {
    const configured = (systemSettings?.business?.paymentModes || [])
      .map(getPaymentModeName)
      .filter(Boolean);
    const channels = systemSettings?.paymentChannels || [];
    const enabled = configured.filter(method => {
      const matchingChannels = channels.filter(channel =>
        String(channel.paymentMethod || channel.name || '').trim().toLowerCase() === method.toLowerCase()
      );
      return matchingChannels.length === 0 || matchingChannels.some(channel =>
        channel.status !== 'inactive' && channel.status !== 'archived'
      );
    });
    return [...new Set(enabled.length > 0 ? enabled : ['Cash'])];
  }, [systemSettings?.business?.paymentModes, systemSettings?.paymentChannels]);
  const getDocumentPaymentAccount = React.useCallback((method: string) => {
    const channel = findPaymentChannel(systemSettings?.paymentChannels || [], method);
    return {
      accountNumber: channel?.accountNumber || systemSettings?.invoiceSettings?.accountNumber || '',
      accountName: systemSettings?.invoiceSettings?.accountName || channel?.name || channel?.provider || '',
    };
  }, [systemSettings?.invoiceSettings?.accountName, systemSettings?.invoiceSettings?.accountNumber, systemSettings?.paymentChannels]);

  useEffect(() => {
    if (!conversionNotice) return;
    const timeout = window.setTimeout(() => setConversionNotice(null), 9000);
    return () => window.clearTimeout(timeout);
  }, [conversionNotice]);

  // Sync VAT toggle default state when modal opens
  const prevShowNewDocModal = React.useRef(false);
  useEffect(() => {
    const justOpened = showNewDocModal && !prevShowNewDocModal.current;
    prevShowNewDocModal.current = showNewDocModal;
    if (justOpened) {
      setNewDocHasVat(!!systemSettings?.invoiceSettings?.hasVatByDefault);
      setNewDocDeliveryCost(0);
      setNewDocDiscountValue(0);
      setNewDocDiscountType('percent');
      setNewDocPaymentMethod(documentPaymentMethods[0]);
      const paymentAccount = getDocumentPaymentAccount(documentPaymentMethods[0]);
      setNewDocPaymentAccountNumber(paymentAccount.accountNumber);
      setNewDocPaymentAccountName(paymentAccount.accountName);
      if (canUseCrossBranchDocuments) {
        setCrossBranchSourcesLoading(true);
        setCrossBranchSourcesError('');
        void loadCrossBranchDocumentSources()
          .then(sources => {
            setCrossBranchSources(sources);
            // Default to the branch the user is actually operating from, not
            // the tenant's designated default branch — otherwise a staff
            // member working from a secondary branch opens the wizard
            // pre-pointed at a different branch's products every time.
            const preferredBranch = sources.branches.find(branch => branch.id === activeBranchId)
              || sources.branches.find(branch => branch.isDefault)
              || sources.branches[0];
            setNewDocIssuingBranchId(current => current || preferredBranch?.id || '');
            setDocWizardSourceBranchId(current => current || preferredBranch?.id || '');
          })
          .catch(error => {
            setCrossBranchSources(null);
            setCrossBranchSourcesError(error instanceof Error ? error.message : 'Branch products could not be loaded.');
          })
          .finally(() => setCrossBranchSourcesLoading(false));
      }
    }
  }, [showNewDocModal, canUseCrossBranchDocuments, documentPaymentMethods, getDocumentPaymentAccount, activeBranchId]); // reset only when opening

  useEffect(() => {
    if (!documentPaymentMethods.includes(newDocPaymentMethod)) {
      setNewDocPaymentMethod(documentPaymentMethods[0]);
    }
  }, [documentPaymentMethods, newDocPaymentMethod]);

  useEffect(() => {
    const paymentAccount = getDocumentPaymentAccount(newDocPaymentMethod);
    setNewDocPaymentAccountNumber(paymentAccount.accountNumber);
    setNewDocPaymentAccountName(paymentAccount.accountName);
  }, [getDocumentPaymentAccount, newDocPaymentMethod]);

  useEffect(() => {
    if (viewingDocument) {
      setDocumentSendPhone(viewingDocument.customerPhone || '');
      setDocumentSendOpen(false);
    } else {
      setDocumentSendPhone('');
      setDocumentSendOpen(false);
    }
  }, [viewingDocument]);

  // Wizard quick add product states
  const [docWizardSelectedProductId, setDocWizardSelectedProductId] = useState('');
  const [docWizardSelectedQty, setDocWizardSelectedQty] = useState(1);
  const [docWizardProductSearchQuery, setDocWizardProductSearchQuery] = useState('');
  const branchSourceProductIds = React.useMemo(() => new Set(
    (crossBranchSources?.products || [])
      .filter(product => product.branchId === docWizardSourceBranchId && product.quantity > 0)
      .map(product => product.productId)
  ), [crossBranchSources, docWizardSourceBranchId]);
  const documentPickerProducts = canUseCrossBranchDocuments && crossBranchSources
    ? (allTenantProducts && allTenantProducts.length ? allTenantProducts : products).filter(product => branchSourceProductIds.has(product.id))
    : products;
  const newDocSubtotal = React.useMemo(
    () => newDocItems.reduce((sum, item) => sum + (toNumber(item.qty) * toNumber(item.price)), 0),
    [newDocItems]
  );
  const cappedDiscountValue = newDocDiscountType === 'percent'
    ? Math.min(100, Math.max(0, newDocDiscountValue))
    : Math.min(newDocSubtotal, Math.max(0, newDocDiscountValue));
  const newDocDiscountAmount = newDocDiscountType === 'percent'
    ? newDocSubtotal * cappedDiscountValue / 100
    : cappedDiscountValue;
  const newDocTaxRate = activeTenant.taxRate ?? 0.18;
  const newDocTotals = calculateSalesDocumentTotals({
    items: newDocItems,
    discountAmount: newDocDiscountAmount,
    deliveryCost: newDocDeliveryCost,
    hasVat: newDocHasVat,
    taxRate: newDocTaxRate,
  });
  const newDocTaxAmount = newDocTotals.tax;
  const newDocGrandTotal = newDocTotals.total;

  // States for Direct Add Sale tab removed as all sales must be logged on POS view

  // Shared by every "Edit Sale" entry point (desktop menu + mobile sheet) so the
  // Sale Date field always defaults to the sale's actual date, never blank.
  const computeSaleDateStr = (s: Sale): string => {
    const d = s.timestamp ? new Date(s.timestamp) : new Date();
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [editFormFields, setEditFormFields] = useState<{
    customerName: string;
    customerPhone: string;
    paymentMethod: string;
    amountPaid: number;
    amountDue: number;
    items: SaleItem[];
    saleDate: string;
  } | null>(null);
  const [editCartEmptyWarning, setEditCartEmptyWarning] = useState<string | null>(null);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editPaymentMethods = React.useMemo(() => {
    const configured = (systemSettings?.business?.paymentModes || [])
      .map(getPaymentModeName)
      .filter(Boolean);
    const channels = systemSettings?.paymentChannels || [];
    const branchId = editingSale?.branchId;
    const enabled = configured.filter(method => {
      const matchingChannels = channels.filter(channel =>
        String(channel.paymentMethod || channel.name || '').trim().toLowerCase() === method.toLowerCase()
      );
      if (matchingChannels.length === 0) return true;
      return matchingChannels.some(channel =>
        channel.status !== 'inactive'
        && channel.status !== 'archived'
        && (!channel.branchId || !branchId || channel.branchId === branchId)
      );
    });
    const current = String(editingSale?.paymentMethod || '').trim();
    return [...new Set(current && !enabled.includes(current) ? [current, ...enabled] : enabled)];
  }, [editingSale?.branchId, editingSale?.paymentMethod, systemSettings?.business?.paymentModes, systemSettings?.paymentChannels]);

  // Local interactive installment recording ledger (Key: Sale ID)
  const [installmentRecords, setInstallmentRecords] = useState<Record<string, Array<{
    id: string;
    date: string;
    amount: number;
    method: string;
    note?: string;
  }>>>({});

  // -----------------------------------------------------------------
  // Live Cashier Register Math (Daily Expected Collections Today)
  // -----------------------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0];
  
  // 1. Sum up cash paid from primary sale tickets logged today
  const todayCashSalesVolume = sales
    .filter(s => s.timestamp.startsWith(todayStr) && s.paymentMethod === 'Cash')
    .reduce((sum, s) => {
      const initialPaid = s.amountPaid !== undefined ? s.amountPaid : s.total;
      return sum + initialPaid;
    }, 0);

  // 2. Sum up customer debt pay-ins (installments) received today in cash format
  const todayCashInstallmentsVolume = Object.entries(installmentRecords).reduce((tot, [saleId, insts]) => {
    const typedInsts = (insts as { id: string; amount: number; date: string; method: string }[] || []);
    const todayInsts = typedInsts.filter(i => i.date.startsWith(todayStr) && i.method === 'Cash');
    return tot + todayInsts.reduce((s, i) => s + i.amount, 0);
  }, 0);

  // Expected cash on floor drawer sum
  const expectedTodayDrawerSales = todayCashSalesVolume + todayCashInstallmentsVolume;

  // Settle Form States
  const getLastDrawerBalance = () => {
    const latest = [...tillSettlements].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (!latest) return 0;
    return Math.max(0, toNumber(latest.actualCashInDrawer) - toNumber(latest.paymentInAmount));
  };
  const [settleOpeningFloat, setSettleOpeningFloat] = useState(() => getLastDrawerBalance());
  const [settleShiftPayIns, setSettleShiftPayIns] = useState(0);
  const [settleShiftPayOuts, setSettleShiftPayOuts] = useState(0);
  const [settleActualDrawerCount, setSettleActualDrawerCount] = useState<number | ''>('');
  const [settlePayInAmount, setSettlePayInAmount] = useState<number | ''>('');
  const [settleCashierName, setSettleCashierName] = useState(() => currentUser?.name || 'In-Office Teller');
  const [settleDestination, setSettleDestination] = useState('Main Safe Vault');
  const [settleMemo, setSettleMemo] = useState('');
  const [settleSuccessMsg, setSettleSuccessMsg] = useState<string | null>(null);

  // New Settle Till requirement fields
  const [settleDestinationType, setSettleDestinationType] = useState<'account' | 'person'>('account');
  const [settleRegisteredAccount, setSettleRegisteredAccount] = useState('Equity Bank Operating Treasury (A/C: 1024-555)');
  const [settleRecipientName, setSettleRecipientName] = useState('');
  const [settleRecipientTransferType, setSettleRecipientTransferType] = useState<'bank' | 'mobile_money'>('bank');
  const [settleReferenceCode, setSettleReferenceCode] = useState('');

  // Real-world Settle Drawer updates
  const [openingFloatVerified, setOpeningFloatVerified] = useState(() => {
    return onlineStorage.getItem(`float_verified_${activeTenant.id}`) === 'true';
  });
  const [verifiedFloatTimestamp, setVerifiedFloatTimestamp] = useState(() => {
    return onlineStorage.getItem(`float_verified_time_${activeTenant.id}`) || '';
  });
  const [settleReceiptFile, setSettleReceiptFile] = useState<{name: string, size: string} | null>(null);
  const [settleSmsPasteText, setSettleSmsPasteText] = useState('');
  
  // Ledger array state for Double-Entry records
  const [doubleEntryLedgers, setDoubleEntryLedgers] = useState<{
    id: string;
    settlementId: string;
    timestamp: string;
    type: 'cash_outflow' | 'path_a_split_deposit' | 'path_b_split_payout';
    amount: number;
    paymentMode: string;
    entryType: string;
    sourceMode?: string;
    destinationName: string;
    reference: string;
    cashierName: string;
  }[]>(() => {
    const saved = onlineStorage.getItem(`double_entry_ledgers_${activeTenant.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    safeSetJsonItem(`double_entry_ledgers_${activeTenant.id}`, doubleEntryLedgers, {
      tenantId: activeTenant.id,
      dataKey: 'double_entry_ledgers',
      logLabel: `${activeTenant.id}/double-entry-ledgers`,
    });
  }, [doubleEntryLedgers, activeTenant.id]);

  // Synchronize actual cash defaults once expected sales change
  useEffect(() => {
    const totalExpected = settleOpeningFloat + expectedTodayDrawerSales + settleShiftPayIns - settleShiftPayOuts;
    setSettleActualDrawerCount(totalExpected);
    setSettlePayInAmount(totalExpected);
  }, [settleOpeningFloat, expectedTodayDrawerSales, settleShiftPayIns, settleShiftPayOuts]);

  // Filter logic
  const classifyPaymentMethod = (method?: string) => {
    const value = String(method || '').toLowerCase();
    if (value.includes('credit')) return 'Credit';
    if (value.includes('cash')) return 'Cash';
    if (value.includes('card') || value.includes('paystack')) return 'Card';
    if (value.includes('bank') || value.includes('transfer') || value.includes('wire')) return 'Bank';
    if (value.includes('mpesa') || value.includes('m-pesa') || value.includes('momo') || value.includes('money') || value.includes('airtel') || value.includes('yas') || value.includes('mixx') || value.includes('tigo') || value.includes('wallet')) return 'Mobile Money';
    return method || 'Cash';
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.reference && s.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPayment = 
      selectedPaymentMethod === 'All' || 
      (selectedPaymentMethod === 'Mobile Money' && classifyPaymentMethod(s.paymentMethod) === 'Mobile Money') ||
      (selectedPaymentMethod === 'Card' && classifyPaymentMethod(s.paymentMethod) === 'Card') ||
      (selectedPaymentMethod === 'Cash' && classifyPaymentMethod(s.paymentMethod) === 'Cash') ||
      (selectedPaymentMethod === 'Credit' && classifyPaymentMethod(s.paymentMethod) === 'Credit');
    
    const matchesSync = 
      selectedSyncStatus === 'All' || 
      s.syncStatus === selectedSyncStatus;

    // Date range filter
    let matchesDate = true;
    if (startDate || endDate) {
      try {
        const saleTime = new Date(s.timestamp).getTime();
        if (startDate) {
          const startLimit = new Date(`${startDate}T00:00:00`).getTime();
          if (!isNaN(startLimit)) {
            matchesDate = matchesDate && saleTime >= startLimit;
          }
        }
        if (endDate) {
          const endLimit = new Date(`${endDate}T23:59:59.999`).getTime();
          if (!isNaN(endLimit)) {
            matchesDate = matchesDate && saleTime <= endLimit;
          }
        }
      } catch (err) {
        console.error('Date parsing error', err);
      }
    }

    return matchesSearch && matchesPayment && matchesSync && matchesDate;
  });

  // KPI Calculations
  const totalVolume = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const pendingSyncCount = filteredSales.filter(s => s.syncStatus === 'pending').length;
  const creditsCount = filteredSales.filter(s => s.paymentMethod === 'Credit').length;
  const creditsVolume = filteredSales.filter(s => s.paymentMethod === 'Credit').reduce((acc, s) => acc + s.total, 0);
  const getAmountPaidForSale = (s: Sale) => s.amountPaid !== undefined ? s.amountPaid : (s.paymentMethod === 'Credit' ? 0 : s.total);
  const amountCollectedVolume = filteredSales.reduce((acc, s) => acc + getAmountPaidForSale(s), 0);
  const amountCollectedCount = filteredSales.filter(s => getAmountPaidForSale(s) > 0).length;
  const pendingCount = filteredSales.filter(s => {
    const amountPaid = s.amountPaid !== undefined ? s.amountPaid : s.total;
    const pastInstallments = (installmentRecords[s.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
    const totalCollectedSoFar = s.paymentMethod === 'Credit' ? (amountPaid + pastInstallments) : s.total;
    return s.paymentMethod === 'Credit' && totalCollectedSoFar < s.total;
  }).length;

  const simulatePrint = () => {
    if (!selectedSale) return;
    // Use thermal receipt printing — works with USB and Bluetooth printers on Android/iOS/Desktop
    printThermalReceipt(selectedSale);
  };

  const handleAddInstallment = (saleId: string, amount: number, method: string, date?: string) => {
    if (amount <= 0) return;
    const newInstallments = [
      ...(installmentRecords[saleId] || []),
      {
        id: 'inst-' + Math.random().toString(36).substr(2, 9),
        date: date || new Date().toISOString(),
        amount,
        method
      }
    ];

    setInstallmentRecords(prev => ({
      ...prev,
      [saleId]: newInstallments
    }));

    // Instantly reconcile back to parent database
    if (onUpdateSales) {
      const parentSale = sales.find(s => s.id === saleId);
      if (parentSale) {
        const initialPaid = parentSale.amountPaid !== undefined ? parentSale.amountPaid : (parentSale.paymentMethod === 'Credit' ? 0 : parentSale.total);
        const updatedSale = {
          ...parentSale,
          amountPaid: Math.min(parentSale.total, initialPaid + amount)
        };
        onUpdateSales(sales.map(s => s.id === saleId ? updatedSale : s));
      }
    }
  };

  const buildDocumentWhatsAppMessage = (doc: SalesDocument) => {
    const documentLabel = getDocumentLabel(doc.type).toLowerCase();
    const customer = doc.customerName?.trim() || 'valued customer';
    return `Hello ${customer}, please find attached your ${documentLabel} PDF ${doc.documentNumber} from ${getDocumentBranding(doc).name}. Thank you.`;
  };

  const sharePdfDocument = async (doc: SalesDocument, phone?: string) => {
    try {
      setPdfShareStatus('Preparing PDF...');
      await shareElementPdfToWhatsApp({
        elementId: 'sales-document-a4-pdf-template',
        fileName: `${normalizeDocType(doc.type).replace(/\s+/g, '-')}-${doc.documentNumber}.pdf`,
        phone: phone || doc.customerPhone,
        message: buildDocumentWhatsAppMessage(doc),
        format: 'a4'
      });
      setPdfShareStatus('PDF ready for WhatsApp.');
    } catch (err: any) {
      setPdfShareStatus(err?.message || 'Could not prepare PDF.');
    } finally {
      setTimeout(() => setPdfShareStatus(null), 4000);
    }
  };

  const downloadPdfDocument = async (doc: SalesDocument) => {
    try {
      setPdfShareStatus('📄 Generating PDF...');
      await downloadPdfFromElement({
        elementId: 'sales-document-a4-pdf-template',
        fileName: `${normalizeDocType(doc.type).replace(/\s+/g, '-')}-${doc.documentNumber}.pdf`,
        format: 'a4'
      });
      setPdfShareStatus('✅ Document downloaded.');
    } catch (err: any) {
      setPdfShareStatus('Download failed: ' + (err?.message || 'Please try again.'));
    } finally {
      setTimeout(() => setPdfShareStatus(null), 4000);
    }
  };

  const shareSalePdf = async (sale: Sale, phone?: string, format: 'a4' | 'receipt' = 'a4') => {
    try {
      setPdfShareStatus('Preparing PDF...');
      await shareElementPdfToWhatsApp({
        elementId: format === 'a4' ? 'sales-invoice-a4-pdf-template' : 'sales-receipt-pdf-template',
        fileName: format === 'a4' ? buildInvoiceFileName(sale) : buildReceiptFileName(sale),
        phone: phone || sale.customerPhone,
        message: `Hello ${sale.customerName || 'customer'}, please find attached your ${format === 'a4' ? 'sales invoice' : 'POS receipt'} PDF from ${getBusinessDisplayName(activeTenant, systemSettings)}. Thank you.`,
        format
      });
      setPdfShareStatus('PDF ready for WhatsApp.');
    } catch (err: any) {
      setPdfShareStatus(err?.message || 'Could not prepare PDF.');
    } finally {
      setTimeout(() => setPdfShareStatus(null), 4000);
    }
  };

  const downloadInvoicePdf = async (sale: Sale) => {
    try {
      setPdfShareStatus('📄 Generating PDF...');
      await downloadPdfFromElement({
        elementId: 'sales-invoice-a4-pdf-template',
        fileName: buildInvoiceFileName(sale),
        format: 'a4'
      });
      setPdfShareStatus('✅ Invoice downloaded.');
    } catch (err: any) {
      setPdfShareStatus('Download failed: ' + (err?.message || 'Please try again.'));
    } finally {
      setTimeout(() => setPdfShareStatus(null), 4000);
    }
  };

  const downloadReceiptPdf = async (sale: Sale) => {
    try {
      setPdfShareStatus('📄 Generating PDF...');
      await downloadPdfFromElement({
        elementId: 'sales-receipt-pdf-template',
        fileName: buildReceiptFileName(sale),
        format: 'receipt'
      });
      setPdfShareStatus('✅ Receipt downloaded.');
    } catch (err: any) {
      setPdfShareStatus('Download failed: ' + (err?.message || 'Please try again.'));
    } finally {
      setTimeout(() => setPdfShareStatus(null), 4000);
    }
  };

  // Deterministic, recognizable filename using the real business and sale reference.
  const buildInvoiceFileName = (sale: Sale) => {
    const bizName = getBusinessDisplayName(activeTenant, systemSettings).trim();
    const safeBusiness = bizName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'Business';
    const safeReference = String(sale.reference || sale.id || 'sale')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'sale';
    return `sales-invoice-${safeBusiness}-${safeReference}.pdf`;
  };

  const buildReceiptFileName = (sale: Sale) => {
    const bizName = getBusinessDisplayName(activeTenant, systemSettings).trim();
    const safeBusiness = bizName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'Business';
    const safeReference = String(sale.reference || sale.id || 'receipt')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'receipt';
    return `receipt-${safeBusiness}-${safeReference}.pdf`;
  };

  // Print thermal receipt — works with USB and Bluetooth thermal printers
  // On Android: triggers native print dialog (Chrome → Share → Print)
  // On Desktop: opens print dialog with thermal paper settings
  const printThermalReceipt = (sale: Sale) => {
    const el = document.getElementById('sales-receipt-pdf-template');
    if (!el) return;
    const content = el.innerHTML;

    const thermalCSS = `
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { width: 72mm; font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; background: #fff; margin: 0; padding: 0; }
      img { max-width: 100%; height: auto; }
      * { color: #000 !important; background: transparent !important; border-color: #888 !important; box-shadow: none !important; border-radius: 0 !important; }
      .flex { display: flex; } .justify-between { justify-content: space-between; } .justify-center { justify-content: center; } .items-center { align-items: center; } .items-start { align-items: flex-start; } .flex-col { flex-direction: column; }
      .text-center { text-align: center; } .text-right { text-align: right; }
      .font-black, .font-bold, .font-extrabold, .font-semibold { font-weight: bold; }
      .uppercase { text-transform: uppercase; }
      .border-b { border-bottom: 1px dashed #666; } .border-t { border-top: 1px dashed #666; }
      .border-dashed { border-style: dashed !important; }
      .space-y-1 > * + * { margin-top: 2px; } .space-y-2 > * + * { margin-top: 4px; } .space-y-3 > * + * { margin-top: 6px; } .space-y-6 > * + * { margin-top: 12px; }
      .py-4 { padding: 8px 0; } .py-2 { padding: 4px 0; } .pb-4 { padding-bottom: 8px; } .pt-4 { padding-top: 8px; } .pt-1 { padding-top: 2px; } .p-6 { padding: 12px; } .px-1 { padding: 0 2px; }
      .mt-1 { margin-top: 2px; } .mt-1\\.5 { margin-top: 3px; } .mt-2 { margin-top: 4px; } .mb-2 { margin-bottom: 4px; }
      .text-sm { font-size: 12px; } .text-xs { font-size: 11px; }
      .w-full { width: 100%; } .max-w-\\[70\\%\\] { max-width: 70%; }
      /* Store logo — without an explicit cap here the print stylesheet falls
         back to the page-width-only "img { max-width: 100% }" rule above, so
         the logo prints far larger than it appears in every other receipt. */
      .max-h-12 { max-height: 48px; } .max-w-\\[140px\\] { max-width: 140px; }
      .object-contain { object-fit: contain; }
      /* Arbitrary Tailwind font sizes used throughout the receipt — without
         these every line silently collapses to the 11px body default,
         flattening the label/total/footer size hierarchy seen in Preview. */
      .text-\\[8px\\] { font-size: 8px; } .text-\\[9px\\] { font-size: 9px; }
      .text-\\[9\\.5px\\] { font-size: 9.5px; } .text-\\[10px\\] { font-size: 10px; }
      .text-\\[10\\.5px\\] { font-size: 10.5px; } .text-\\[11px\\] { font-size: 11px; }
      .space-y-0\\.5 > * + * { margin-top: 1px; } .space-y-1\\.5 > * + * { margin-top: 3px; }
      .pt-1\\.5 { padding-top: 3px; } .pt-2 { padding-top: 4px; } .ml-1 { margin-left: 2px; }
      .tracking-wider { letter-spacing: 0.05em; } .tracking-tight { letter-spacing: -0.025em; }
      .leading-tight { line-height: 1.25; } .shrink-0 { flex-shrink: 0; }
    `;

    // Create hidden iframe — works on Android Chrome without popup blocker
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt ${sale.reference || sale.id}</title><style>${thermalCSS}</style></head><body>${content}</body></html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {}
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 3000);
    }, 600);
  };

  const resetNewDocumentForm = () => {
    setNewDocItems([]);
    setNewDocCustomerName('');
    setNewDocCustomerPhone('');
    setNewDocCustomerAddress('');
    setNewDocDiscountValue(0);
    setShowNewDocModal(false);
  };

  const handleCreateCommercialDocument = async () => {
    if (newDocItems.length === 0 || documentMutationPending) return;
    const prefixMap = { 'price quote': 'QUO', 'proforma invoice': 'PFI' };
    const prefix = prefixMap[newDocType] || 'DOC';
    const nextNum = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const issuingBranch = crossBranchSources?.branches.find(branch => branch.id === newDocIssuingBranchId);
    const localDocument: SalesDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: newDocType,
      documentNumber: nextNum,
      customerName: newDocCustomerName || 'Customer',
      customerPhone: newDocCustomerPhone || '',
      customerAddress: newDocCustomerAddress || '',
      items: newDocItems.map(item => ({ ...item, discount: 0, discountType: 'percent' })),
      total: newDocGrandTotal,
      tax: newDocTaxAmount,
      discountAmount: newDocDiscountAmount,
      discountValue: cappedDiscountValue,
      discountType: newDocDiscountType,
      hasVat: newDocHasVat,
      taxRate: newDocTaxRate,
      deliveryCost: Number(newDocDeliveryCost) || 0,
      paymentMethod: newDocPaymentMethod,
      paymentAccountNumber: newDocPaymentAccountNumber.trim() || undefined,
      paymentAccountName: newDocPaymentAccountName.trim() || undefined,
      paymentAmount: newDocGrandTotal,
      timestamp: new Date(`${newDocDate || new Date().toISOString().split('T')[0]}T12:00:00`).toISOString(),
      tenantId: activeTenant.id,
      status: 'pending',
      issuingBranchId: issuingBranch?.id,
      issuingBranchName: issuingBranch?.businessName || issuingBranch?.branchName,
    };

    if (!canUseCrossBranchDocuments) {
      setDocuments(prev => [localDocument, ...prev]);
      resetNewDocumentForm();
      return;
    }
    if (!issuingBranch || newDocItems.some(item => !item.sourceBranchId)) {
      alert('Select the issuing branch and a source branch for every product.');
      return;
    }

    setDocumentMutationPending(true);
    try {
      const saved = await createCrossBranchCommercialDocument({
        issuingBranchId: issuingBranch.id,
        documentType: newDocType === 'price quote' ? 'price_quote' : 'proforma_invoice',
        documentNumber: nextNum,
        customerName: localDocument.customerName,
        customerPhone: localDocument.customerPhone,
        customerAddress: localDocument.customerAddress,
        issueDate: newDocDate,
        currency,
        discountAmount: newDocDiscountAmount,
        taxAmount: newDocTaxAmount,
        deliveryAmount: Number(newDocDeliveryCost) || 0,
        items: newDocItems.map(item => ({
          sourceBranchId: item.sourceBranchId!,
          productId: String(item.productId),
          productName: item.productName,
          unit: item.unit,
          quantity: toNumber(item.qty),
          unitPrice: toNumber(item.price),
        })),
      });
      setDocuments(prev => [{
        ...localDocument,
        id: saved.documentId,
        serverDocumentId: saved.documentId,
        documentNumber: saved.documentNumber,
        total: saved.total,
        brandingSnapshot: saved.brandingSnapshot,
      }, ...prev]);
      resetNewDocumentForm();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'The document could not be saved.');
    } finally {
      setDocumentMutationPending(false);
    }
  };

  // A document whose items were sourced from more than one branch cannot be
  // recorded as a single sale from here — it must go through the dedicated
  // cross-branch conversion flow instead.
  const isMixedBranchDocument = (doc: SalesDocument) => new Set(
    (doc.items || []).map(item => item.sourceBranchId).filter(Boolean)
  ).size > 1;

  const sendDocumentToSales = async (doc: SalesDocument) => {
    if (doc.status === 'converted') {
      alert(`This ${getDocumentLabel(doc.type)} has already been recorded as a sale.`);
      return;
    }
    if (isMixedBranchDocument(doc)) {
      alert('This document mixes products from two branches and cannot be recorded from here.');
      return;
    }

    const normalizedItems = (doc.items || []).map(item => ({
      ...item,
      productName: getDocumentItemName(item),
      unit: getDocumentItemUnit(item),
      qty: toNumber(item.qty),
      price: toNumber(item.price),
      discount: toNumber(item.discount),
    })).filter(item => item.productName && item.qty > 0);

    if (normalizedItems.length === 0) {
      alert('This document has no valid items to record as a sale.');
      return;
    }

    if (doc.serverDocumentId) {
      if (documentMutationPending) return;
      setDocumentMutationPending(true);
      try {
        const conversion = await convertCrossBranchCommercialDocument(
          doc.serverDocumentId,
          `commercial-document:${doc.serverDocumentId}`,
        );
        setDocuments(prev => prev.map(item => item.id === doc.id ? {
          ...item,
          items: normalizedItems,
          status: 'converted',
          convertedSaleId: conversion.saleGroupId,
          convertedBranchSaleIds: (conversion.branchSales || []).map(sale => sale.saleId),
          convertedAt: new Date().toISOString(),
        } : item));
        setViewingDocument(null);
        setConversionNotice({
          kind: 'success',
          title: 'Conversion completed',
          message: 'Stock was deducted and an unpaid sale was created in every source branch.',
        });
      } catch (error) {
        setConversionNotice({
          kind: 'error',
          title: 'Conversion could not be completed',
          message: error instanceof Error
            ? error.message
            : 'One or more products are out of stock. No stock or sale was changed.',
        });
      } finally {
        setDocumentMutationPending(false);
      }
      return;
    }

    if (!onPreloadCartForPOS) return;
    onPreloadCartForPOS(normalizedItems, doc.timestamp, {
      deliveryCost: toNumber(doc.deliveryCost),
      paymentMethod: doc.paymentMethod || 'Cash',
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      hasVat: !!doc.hasVat
    });

    setDocuments(prev => prev.map(d => d.id === doc.id ? {
      ...d,
      items: normalizedItems,
      status: 'converted',
      convertedSaleId: `pending-pos-${Date.now()}`,
      convertedAt: new Date().toISOString()
    } : d));
    setViewingDocument(null);
  };

  return (
    <div className="space-y-0 md:space-y-6 animate-fade-in" id="sales-list-view-root">
      {conversionNotice && createPortal((
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] w-[min(94vw,560px)]"
        >
          <div className={`rounded-2xl border shadow-2xl px-4 py-3.5 flex items-start gap-3 ${
            conversionNotice.kind === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}>
            {conversionNotice.kind === 'error'
              ? <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{conversionNotice.title}</p>
              <p className="text-xs font-semibold mt-1 leading-relaxed">{conversionNotice.message}</p>
            </div>
            <button
              type="button"
              aria-label="Close notification"
              onClick={() => setConversionNotice(null)}
              className="w-7 h-7 rounded-lg border-none bg-transparent hover:bg-black/5 flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ), document.body)}

      {/* ── MOBILE HERO BANNER — replaces old "Sales History" card ────────── */}
      <div className="xl:hidden">
        {/* Gradient hero strip */}
        <div className="relative overflow-hidden rounded-3xl mx-0 mb-4"
          style={{background: 'linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%)', boxShadow: '0 4px 24px rgba(16,185,129,0.25)'}}>
          {/* Decorative blobs */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30" style={{background: 'rgba(255,255,255,0.35)'}} />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-25" style={{background: 'rgba(255,255,255,0.4)'}} />

          <div className="relative px-5 pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 text-[11px] font-semibold uppercase tracking-widest mb-1">Sales Overview</p>
                <p className="text-white font-black text-2xl leading-none">{currency}{Math.round(totalVolume).toLocaleString()}</p>
                <p className="text-white/70 text-[11px] mt-1">{filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background: 'rgba(255,255,255,0.24)'}}>
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* 3 mini KPI pills */}
            <div className="flex gap-2 mt-4">
              <div className="flex-1 rounded-xl px-3 py-2" style={{background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'}}>
                <p className="text-white/80 text-[9px] font-bold uppercase tracking-wider">Credit</p>
                <p className="text-white font-black text-[13px] mt-0.5">{currency}{Math.round(creditsVolume).toLocaleString()}</p>
              </div>
              <div className="flex-1 rounded-xl px-3 py-2" style={{background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'}}>
                <p className="text-white/80 text-[9px] font-bold uppercase tracking-wider">Collected</p>
                <p className="text-white font-black text-[13px] mt-0.5">{currency}{Math.round(amountCollectedVolume).toLocaleString()}</p>
              </div>
              <div className="flex-1 rounded-xl px-3 py-2" style={{background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'}}>
                <p className="text-white/80 text-[9px] font-bold uppercase tracking-wider">Pending</p>
                <p className="text-white font-black text-[13px] mt-0.5">{pendingCount} due</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP HEADER — title + date filter + KPI cards + tabs ── */}
      <div className="hidden xl:block space-y-4">

        {/* 1. Title bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''} · {activeTenant.businessType === 'pharmacy' ? 'Pharmacy Receipts' : 'All Channels'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Revenue</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{currency}{Math.round(totalVolume).toLocaleString()}</p>
          </div>
        </div>

        {/* 2. Date range filter bar */}
        <div className="bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700">Date Range</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto">
            <div className="flex flex-row gap-2 w-full lg:w-auto">
              <div className="flex flex-col gap-0.5 flex-1 lg:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer" />
              </div>
              <div className="flex flex-col gap-0.5 flex-1 lg:flex-none">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer" />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: 'Today', action: () => { const s = getTodayLocalDateStr(); setStartDate(s); setEndDate(s); } },
                { label: 'Yesterday', action: () => { const y = new Date(); y.setDate(y.getDate()-1); const s=`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`; setStartDate(s); setEndDate(s); } },
                { label: '7 Days', action: () => { const p=new Date(); p.setDate(p.getDate()-6); const s=`${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`; setStartDate(s); setEndDate(getTodayLocalDateStr()); } },
                { label: '30 Days', action: () => { const p=new Date(); p.setDate(p.getDate()-29); const s=`${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`; setStartDate(s); setEndDate(getTodayLocalDateStr()); } },
                { label: 'All', action: () => { setStartDate(''); setEndDate(''); } },
              ].map(b => (
                <button key={b.label} type="button" onClick={b.action}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. KPI cards */}
        <div className="mobile-tablet-kpi-grid gap-4" style={{ ['--desktop-kpi-columns' as any]: 'repeat(4, minmax(0, 1fr))' }}>
          {[
            { label: 'Total Sales', value: `${currency}${Math.round(totalVolume).toLocaleString()}`, sub: `${filteredSales.length} sales`, icon: <TrendingUp className="w-5 h-5" />, color: '#059669', iconBg: '#dcfce7' },
            { label: 'Credit Outstanding', value: `${currency}${Math.round(creditsVolume).toLocaleString()}`, sub: `${sales.filter(s=>s.paymentMethod==='Credit').length} credit sales`, icon: <CreditCard className="w-5 h-5" />, color: '#d97706', iconBg: '#fef3c7' },
            { label: 'Amount Collected', value: `${currency}${Math.round(amountCollectedVolume).toLocaleString()}`, sub: `${amountCollectedCount} paid sales`, icon: <Coins className="w-5 h-5" />, color: '#7c3aed', iconBg: '#ede9fe' },
            { label: 'Amount Due', value: `${pendingCount}`, sub: 'outstanding bills', icon: <AlertCircle className="w-5 h-5" />, color: '#dc2626', iconBg: '#fee2e2' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-2xl p-4 flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:kpi.iconBg,color:kpi.color}}>{kpi.icon}</div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider truncate">{kpi.label}</p>
                <p className="text-[18px] font-black leading-tight truncate text-slate-900 dark:text-white">{kpi.value}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 4. Tab navigation */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-2xl gap-1 shadow-xs">
            {salesSubTabs.map(tab => {
              const active = activeSubTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveSubTab(tab.id as any)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold relative"
                  style={{background:active?tab.color:'transparent',color:active?'#ffffff':'#64748b',boxShadow:active?`0 2px 8px ${tab.color}30`:'none'}}>
                  {tab.icon}<span>{tab.label}</span>
                  {tab.badge && tab.badge > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">{tab.badge > 9 ? '9+' : tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
      {/* MOBILE ONLY TAB NAVIGATION — visible pill tabs */}
      <div className="xl:hidden pb-3 select-none">
        <div className="flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-2xl gap-1">
          {mobileSalesSubTabs.map(tab => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className="flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl relative"
                style={{
                  background: active ? tab.activeBg : 'transparent',
                  boxShadow: active ? `0 2px 8px ${tab.activeBg}40` : 'none',
                }}
              >
                <span style={{ color: active ? '#ffffff' : '#64748b' }}>{tab.icon}</span>
                <span className="text-[10px] font-bold mt-1" style={{ color: active ? '#ffffff' : '#64748b' }}>{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-slate-800" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeSubTab === 'sales' && (
        <>
          {/* DATE RANGE SELECTOR — desktop only, now shown above in header */}
      {/* FILTER & CONTROL PANEL BAR (DESKTOP) */}
      <div className="hidden xl:flex bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs max-w-sm flex-grow">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search Receipt ID, Client Customer Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none focus:outline-none w-full text-slate-800 placeholder-slate-400 font-sans"
          />
        </div>

        {/* Advanced Select Dropdowns filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-705">
          
          {/* Payment Method filter */}
          <div className="flex items-center">
            <span className="mr-2 font-bold text-[10px] uppercase font-mono text-slate-400">Channel:</span>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-xl font-bold text-slate-700 cursor-pointer outline-none focus:bg-white text-xs"
            >
              <option value="All">All Payments</option>
              <option value="Cash">Cash Channel Only</option>
              <option value="Card">Card & Online Tills</option>
              <option value="Mobile Money">Smart MOMO Express</option>
              <option value="Credit">Issued Credit Sales</option>
            </select>
          </div>

          {/* Sync status filter */}
          <div className="flex items-center">
            <span className="mr-2 font-bold text-[10px] uppercase font-mono text-slate-400">Sync state:</span>
            <select
              value={selectedSyncStatus}
              onChange={(e) => setSelectedSyncStatus(e.target.value)}
              className="bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-xl font-bold text-slate-700 cursor-pointer outline-none focus:bg-white text-xs"
            >
              <option value="All">All Registers</option>
              <option value="synced">Synced Only</option>
              <option value="pending">Local Offline Store</option>
            </select>
          </div>

        </div>

      </div>

      {/* FILTER & CONTROL PANEL BAR (MOBILE) */}
      <div className="xl:hidden space-y-2">
        {/* Quick date chips */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-1">
            {[
              { label: 'Today', action: () => { const s = getTodayLocalDateStr(); setStartDate(s); setEndDate(s); }, active: startDate === getTodayLocalDateStr() && endDate === getTodayLocalDateStr() },
              { label: 'Week',  action: () => { const p = new Date(); p.setDate(p.getDate()-6); const s = `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`; setStartDate(s); setEndDate(getTodayLocalDateStr()); }, active: startDate !== getTodayLocalDateStr() && endDate === getTodayLocalDateStr() && startDate !== endDate },
              { label: 'Month', action: () => { const p = new Date(); p.setDate(p.getDate()-29); const s = `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`; setStartDate(s); setEndDate(getTodayLocalDateStr()); }, active: (() => { const p = new Date(); p.setDate(p.getDate()-29); const s = `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`; return startDate === s && endDate === getTodayLocalDateStr(); })() },
              { label: 'All',   action: () => { setStartDate(''); setEndDate(''); }, active: !startDate && !endDate },
            ].map(opt => (
              <button key={opt.label} type="button" onClick={opt.action}
                className="flex-1 py-1.5 rounded-xl text-[11px] font-bold"
                style={{ background: opt.active ? '#0f172a' : '#f1f5f9', color: opt.active ? '#ffffff' : '#64748b' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowMobileDatePicker(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
            style={{ background: showMobileDatePicker ? '#0f172a' : '#f1f5f9' }}>
            <Calendar className="w-4 h-4" style={{ color: showMobileDatePicker ? '#ffffff' : '#64748b' }} />
          </button>
        </div>

        {/* Inline date pickers — shown when calendar tapped */}
        {showMobileDatePicker && (
          <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none min-w-0" />
            <span className="text-slate-300 text-xs shrink-0">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none min-w-0" />
            {(startDate || endDate) && (
              <button type="button" onClick={() => { setStartDate(''); setEndDate(''); }} className="text-slate-400 ml-1 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Search + filter row */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl shadow-xs">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input type="text" placeholder="Search sales..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none focus:outline-none w-full text-xs text-slate-800 placeholder-slate-400" />
          </div>
          <select value={selectedPaymentMethod} onChange={e => setSelectedPaymentMethod(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white px-3 py-2.5 rounded-xl font-bold cursor-pointer outline-none text-xs shadow-xs shrink-0">
            <option value="All">All</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Mobile Money">MOMO</option>
            <option value="Credit">Credit</option>
          </select>
        </div>
      </div>

      {/* SALES MAIN DATA LIST */}
      <div className="bg-transparent md:bg-white dark:md:bg-slate-800/60 md:rounded-2xl md:border md:border-slate-200 dark:md:border-slate-700 shadow-none md:shadow-xs md:overflow-hidden">
        
        {/* Mobile View: Cards */}
        <div className="xl:hidden flex flex-col space-y-3 pb-[calc(80px+env(safe-area-inset-bottom))]">
          {filteredSales.map((sale) => {
            const totalVal = sale.total;
            const isCredit = sale.paymentMethod === 'Credit';
            const amountPaid = sale.amountPaid !== undefined ? sale.amountPaid : totalVal;
            const pastInstallments = (installmentRecords[sale.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
            const totalCollectedSoFar = isCredit ? (amountPaid + pastInstallments) : totalVal;
            const amountDueRaw = isCredit ? Math.max(0, totalVal - totalCollectedSoFar) : 0;

            const isPaid = !isCredit;
            const isSettled = isCredit && amountDueRaw <= 0;
            const isPartial = isCredit && totalCollectedSoFar > 0 && amountDueRaw > 0;
            const isUnpaid = isCredit && totalCollectedSoFar <= 0;

            const statusLabel = isPaid ? 'Paid' : isSettled ? 'Settled' : isPartial ? 'Partial' : 'Unpaid';
            const statusDot = isPaid || isSettled ? '#22c55e' : isPartial ? '#f59e0b' : '#ef4444';

            return (
              <div
                key={sale.id}
                className="relative overflow-hidden rounded-2xl"
                style={{ background: '#ffffff', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
              >
                {/* Accent left bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: statusDot }} />

                <div className="pl-4 pr-3 py-3.5">
                  {/* Row 1: customer + amount + menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-900 text-[14px] leading-tight truncate">
                        {sale.customerName || 'Customer'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        #{sale.reference || sale.id.substring(0,6)} · {sale.items.length} line item{sale.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right">
                        <p className="font-black text-[15px] leading-tight" style={{ color: '#0f172a' }}>
                          {currency}{Math.round(totalVal).toLocaleString()}
                        </p>
                        {isCredit && amountDueRaw > 0 && (
                          <p className="text-[10px] font-bold text-rose-500 leading-tight">
                            -{currency}{Math.round(amountDueRaw).toLocaleString()} due
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMobileActionsSale(sale); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl active:bg-slate-100"
                        aria-label="Sale actions"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: date + method + status */}
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-50">
                    <p className="text-[10px] text-slate-400 font-mono">
                      {new Date(sale.timestamp).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})}
                      {' · '}
                      {new Date(sale.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {sale.paymentMethod || 'Cash'}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{ color: statusDot, background: `${statusDot}15` }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusDot }} />
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredSales.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={{background: '#f8fafc', border: '1px solid #f1f5f9'}}>
                <FileText className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-bold text-slate-700 text-sm">No sales yet</p>
              <p className="text-xs text-slate-400 mt-1">Start selling to see transactions here.</p>
            </div>
          )}
        </div>

        {/* Desktop View: Redesigned Table */}
        <div className="hidden xl:block">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden" style={{boxShadow: '0 1px 8px rgba(0,0,0,0.06)'}}>
            {/* Table toolbar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{filteredSales.length} Sales</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none w-36" />
                </div>
                <select value={selectedPaymentMethod} onChange={e => setSelectedPaymentMethod(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold outline-none cursor-pointer">
                  <option value="All">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Reference</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date & Time</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Items</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Method</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Total</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Paid</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Due</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Status</th>
                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale, idx) => {
                  const totalVal = sale.total;
                  const isCredit = sale.paymentMethod === 'Credit';
                  const initialPaid = sale.amountPaid !== undefined ? sale.amountPaid : (isCredit ? 0 : totalVal);
                  const installments = installmentRecords[sale.id] || [];
                  const extraPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);
                  const calculatedPaid = Math.min(totalVal, initialPaid + extraPaid);
                  const calculatedDue = Math.max(0, totalVal - calculatedPaid);
                  let paymentStatus: 'Paid' | 'Not Paid' | 'Partially Paid' = 'Paid';
                  if (calculatedPaid <= 0.05) paymentStatus = 'Not Paid';
                  else if (calculatedDue <= 0.05) paymentStatus = 'Paid';
                  else paymentStatus = 'Partially Paid';
                  const statusColor = paymentStatus === 'Paid' ? {bg:'#f0fdf4',text:'#059669'} : paymentStatus === 'Not Paid' ? {bg:'#fff5f5',text:'#dc2626'} : {bg:'#fffbeb',text:'#d97706'};

                  return (
                    <tr key={sale.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Reference */}
                      <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                        <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{getSaleReference(sale)}</span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-mono text-[11px] text-slate-600">{formatShortDateTime(sale.timestamp).split(' ')[0]}</p>
                        <p className="font-mono text-[10px] text-slate-400">{formatShortDateTime(sale.timestamp).split(' ').slice(1).join(' ')}</p>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 text-[12px]">{sale.customerName || <span className="text-slate-400 italic font-normal">Customer</span>}</p>
                        {sale.customerPhone && <p className="text-[10px] text-slate-400 font-mono">{sale.customerPhone}</p>}
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 max-w-[160px]">
                        <p className="font-bold text-slate-700 text-[12px]">{sale.items.length} line item{sale.items.length === 1 ? '' : 's'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{sale.items.slice(0,2).map(i => i.productName).join(', ')}{sale.items.length > 2 ? ` +${sale.items.length-2}` : ''}</p>
                      </td>

                      {/* Method */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          sale.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-700' :
                          ['Card','Paystack'].includes(sale.paymentMethod) ? 'bg-blue-50 text-blue-700' :
                          sale.paymentMethod === 'Credit' ? 'bg-amber-50 text-amber-700' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>{sale.paymentMethod}</span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 text-[12px] whitespace-nowrap">
                        {currency}{Math.round(totalVal).toLocaleString()}
                      </td>

                      {/* Paid */}
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold text-[12px] whitespace-nowrap">
                        {currency}{Math.round(calculatedPaid).toLocaleString()}
                      </td>

                      {/* Due */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {calculatedDue > 0
                          ? <span className="font-mono font-bold text-rose-600 text-[12px]">{currency}{Math.round(calculatedDue).toLocaleString()}</span>
                          : <span className="text-slate-300 font-mono text-[11px]">—</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                          style={{background: statusColor.bg, color: statusColor.text}}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: statusColor.text}} />
                          {paymentStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center relative" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeMenuId === sale.id) {
                                setActiveMenuId(null);
                                setMenuPos(null);
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const estimatedMenuHeight = calculatedDue > 0 ? 360 : 330;
                                const viewportPadding = 12;
                                const highestSafeTop = Math.max(viewportPadding, window.innerHeight - estimatedMenuHeight - viewportPadding);
                                setMenuPos({
                                  top: Math.min(rect.bottom + 6, highestSafeTop),
                                  right: Math.max(12, window.innerWidth - rect.right),
                                });
                                setActiveMenuId(sale.id);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                            <span>Actions</span>
                          </button>

                          {activeMenuId === sale.id && menuPos && createPortal(
                            <>
                              <div className="fixed z-[999] inset-0" onClick={() => { setActiveMenuId(null); setMenuPos(null); }} />
                              <div
                                data-testid="desktop-sale-actions-menu"
                                className="fixed w-52 bg-white border border-slate-100 rounded-2xl shadow-xl z-[1000] py-1.5 overflow-y-auto overscroll-contain"
                                style={{ top: menuPos.top, right: menuPos.right, maxHeight: 'calc(100dvh - 24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)' }}
                              >
                                <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">Sale Actions</div>

                                {calculatedDue > 0 && (
                                  <button onClick={() => { setSelectedSale(sale); setPayInInputVal(calculatedDue.toString()); setViewPaymentsOpen(true); setActiveMenuId(null); setMenuPos(null); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50">
                                    <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Payment In
                                  </button>
                                )}
                                <button onClick={() => { setSelectedSale(sale); setPayInInputVal(''); setViewPaymentsOpen(true); setActiveMenuId(null); setMenuPos(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                                  <CreditCard className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Payments Log
                                </button>
                                <button onClick={() => { setViewingSaleDetail(sale); setActiveMenuId(null); setMenuPos(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                                  <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" /> View Sale
                                </button>
                                <button onClick={() => { setEditingSale(sale); setEditFormFields({customerName:sale.customerName||'',customerPhone:sale.customerPhone||'',paymentMethod:sale.paymentMethod,amountPaid:initialPaid,amountDue:calculatedDue,items:[...sale.items],saleDate:computeSaleDateStr(sale)}); setEditCartEmptyWarning(null); setActiveMenuId(null); setMenuPos(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                                  <Edit className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Edit Sale
                                </button>

                                <div className="border-t border-slate-100 mt-1 pt-1">
                                  <button onClick={() => { setSelectedSale(sale); setViewA4InvoiceOpen(false); setActiveMenuId(null); setMenuPos(null); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                                    <Printer className="w-3.5 h-3.5 text-slate-400 shrink-0" /> POS Receipt
                                  </button>
                                  <button onClick={() => { setSelectedSale(sale); setViewA4InvoiceOpen(true); setDocZoom(computeInvoiceFitZoom()); setWhatsappPhone((sale.customerPhone||'').replace(/[^0-9]/g,'')); setActiveMenuId(null); setMenuPos(null); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" /> A4 Invoice
                                  </button>
                                  {onSendToDeliveryNote && (
                                    <button onClick={() => { onSendToDeliveryNote(sale); setActiveMenuId(null); setMenuPos(null); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50">
                                      <DeliveryMotorcycleIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" size={14} /> Send to Delivery
                                    </button>
                                  )}
                                </div>

                                {(!rolePermissions || rolePermissions.deleteSale?.write !== false) && (
                                  <div className="border-t border-slate-100 mt-1 pt-1">
                                    <button onClick={() => { openDeleteSaleConfirmation(sale); setActiveMenuId(null); setMenuPos(null); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50">
                                      <Trash2 className="w-3.5 h-3.5 shrink-0" /> Cancel Receipt
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>,
                            document.body
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredSales.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-slate-300" />
                </div>
                <p className="font-bold text-slate-600 text-sm">No sales found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your date range or filters.</p>
              </div>
            )}
          </div>
        </div>

      </div>{/* end SALES MAIN DATA LIST */}

      </>
      )}

      {/* SECTION B: ACCOUNTS RECEIVABLE / DEBTS COLLECTOR PORTAL & PAYMENT-IN */}
      {activeSubTab === 'debts' && (() => {
        // Calculate dynamic figures
        const debtSales = sales.filter(s => s.paymentMethod === 'Credit' || (s.total - (s.amountPaid !== undefined ? s.amountPaid : s.total)) > 0);
        const totalDebtIssued = debtSales.reduce((sum, s) => sum + s.total, 0);
        
        const totalDebtPaidIn = debtSales.reduce((sum, s) => {
          const initialPaid = s.amountPaid !== undefined ? s.amountPaid : 0;
          const installmentsVal = (installmentRecords[s.id] || []).reduce((instTot, i) => instTot + i.amount, 0);
          return sum + Math.min(s.total, initialPaid + installmentsVal);
        }, 0);
        
        const totalDebtOutstanding = Math.max(0, totalDebtIssued - totalDebtPaidIn);
        const clearedDebtsCount = debtSales.filter(s => {
          const initialPaid = s.amountPaid !== undefined ? s.amountPaid : 0;
          const installmentsVal = (installmentRecords[s.id] || []).reduce((instTot, i) => instTot + i.amount, 0);
          return (initialPaid + installmentsVal) >= s.total;
        }).length;

        // Filter debt contracts by keyword query
        const filteredDebtSales = debtSales.filter(s => {
          if (!debtSearchTerm) return true;
          return s.id.toLowerCase().includes(debtSearchTerm.toLowerCase()) ||
            (s.customerName && s.customerName.toLowerCase().includes(debtSearchTerm.toLowerCase())) ||
            (s.customerPhone && s.customerPhone.toLowerCase().includes(debtSearchTerm.toLowerCase())) ||
            (s.reference && s.reference.toLowerCase().includes(debtSearchTerm.toLowerCase()));
        });

        return (
          <div className="space-y-6 animate-fade-in" id="debts-ledger-portal">
            
            {/* KPI metrics row */}

            {/* MOBILE/TABLET — compact 2-up + full-width outstanding balance */}
            <div className="xl:hidden space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-0">
                  <p className="text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none truncate">Total Credit</p>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white mt-1.5 truncate">{currency}{Math.round(totalDebtIssued).toLocaleString()}</h4>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 border border-emerald-100 dark:border-emerald-900/40 rounded-xl min-w-0">
                  <p className="text-[8.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none truncate">Collected</p>
                  <h4 className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-1.5 truncate">{currency}{Math.round(totalDebtPaidIn).toLocaleString()}</h4>
                </div>
              </div>
              <div className="w-full p-3.5 rounded-xl" style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}}>
                <p className="text-[8.5px] font-mono font-bold text-white/80 uppercase tracking-widest leading-none">Outstanding Balance Receivable</p>
                <h4 className="text-lg font-black text-white mt-1.5">{currency}{Math.round(totalDebtOutstanding).toLocaleString()}</h4>
              </div>
            </div>

            {/* DESKTOP — unchanged original 3-card grid */}
            <div className="hidden xl:block">
              <div className="mobile-tablet-kpi-grid gap-4" style={{ ['--desktop-kpi-columns' as any]: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest leading-none">Total Credit Credit-Sales</p>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white mt-2">{currency}{Math.round(totalDebtIssued).toLocaleString()}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Outstanding sales invoices marked as Credit tabs.</p>
                </div>
                <div className="bg-emerald-505 p-5 border border-emerald-250 rounded-2xl">
                  <p className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Total Payment-Ins Collected</p>
                  <h4 className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-2">{currency}{Math.round(totalDebtPaidIn).toLocaleString()}</h4>
                  <p className="text-[10px] text-emerald-600 mt-1">Total credit installments & payments-in received.</p>
                </div>
                <div className="bg-amber-505 p-5 border border-amber-250 rounded-2xl">
                  <p className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none">Outstanding Balance Receivable</p>
                  <h4 className="text-xl font-black text-amber-700 dark:text-amber-300 mt-2">{currency}{Math.round(totalDebtOutstanding).toLocaleString()}</h4>
                  <p className="text-[10px] text-amber-652 mt-1">Remaining customer dockets debt pending settlement.</p>
                </div>
              </div>
            </div>

            {/* Debts Search panel */}
            <div className="bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs max-w-sm flex-grow">
                <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Filter by Customer, Phone, or Ticket Ref..."
                  value={debtSearchTerm}
                  onChange={(e) => setDebtSearchTerm(e.target.value)}
                  className="bg-transparent border-none focus:outline-none w-full text-slate-800 placeholder-slate-400 font-sans"
                />
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Showing {filteredDebtSales.length} Credit Dockets ({clearedDebtsCount} Cleared)
              </div>
            </div>

            {/* Bento Grid checklist of active credit files */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
              {filteredDebtSales.map(s => {
                const totalVal = s.total;
                const initialPaid = s.amountPaid !== undefined ? s.amountPaid : 0;
                const installments = installmentRecords[s.id] || [];
                const extraPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);
                const calculatedPaid = Math.min(totalVal, initialPaid + extraPaid);
                const calculatedDue = Math.max(0, totalVal - calculatedPaid);
                const percentPaid = Math.round((calculatedPaid / totalVal) * 100) || 0;
                const currentPercent = Math.min(100, percentPaid);
                const isCleared = calculatedDue === 0;

                const paymentInForm = (compact: boolean) => (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const payAmt = parseFloat((form.elements.namedItem('pay-amount') as HTMLInputElement).value);
                      const payMethod = (form.elements.namedItem('pay-method') as HTMLSelectElement).value;
                      const payDateVal = (form.elements.namedItem('pay-date') as HTMLInputElement).value;
                      const timestamp = payDateVal ? new Date(payDateVal).toISOString() : new Date().toISOString();
                      if (payAmt > 0) {
                        handleAddInstallment(s.id, payAmt, payMethod, timestamp);
                        form.reset();
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className={compact ? 'grid grid-cols-1 sm:grid-cols-3 gap-2.5' : 'grid grid-cols-3 gap-2'}>
                      <div>
                        <label className={`block uppercase font-mono text-slate-500 font-bold mb-1 ${compact ? 'text-[9px]' : 'text-[8px]'}`}>Pay-in Amount</label>
                        <input
                          type="number"
                          name="pay-amount"
                          min="1"
                          max={calculatedDue}
                          defaultValue={calculatedDue}
                          required
                          className={`w-full bg-white border border-slate-200 rounded-lg font-mono font-bold focus:outline-emerald-500 text-slate-800 ${compact ? 'px-3 py-2.5 text-sm min-h-[42px]' : 'px-2 py-1 text-xs'}`}
                        />
                      </div>
                      <div>
                        <label className={`block uppercase font-mono text-slate-500 font-bold mb-1 ${compact ? 'text-[9px]' : 'text-[8px]'}`}>Payment Channel</label>
                        <select
                          name="pay-method"
                          className={`w-full bg-white border border-slate-200 rounded-lg cursor-pointer font-sans text-slate-803 outline-none ${compact ? 'px-3 py-2.5 text-xs min-h-[42px]' : 'px-2 py-1 text-[11px] font-bold'}`}
                        >
                          <option value="Cash">Cash Drawer</option>
                          <option value="M-Pesa">M-Pesa Express</option>
                          <option value="MTN MoMo">MTN MoMo Net</option>
                          <option value="Card">Visa Debit Card</option>
                          <option value="Airtel Money">Airtel Money</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block uppercase font-mono text-slate-500 font-bold mb-1 ${compact ? 'text-[9px]' : 'text-[8px]'}`}>Payment Date</label>
                        <input
                          type="date"
                          name="pay-date"
                          defaultValue={new Date().toISOString().split('T')[0]}
                          required
                          className={`w-full bg-white border border-slate-200 rounded-lg font-sans outline-none text-slate-800 ${compact ? 'px-3 py-2.5 text-xs min-h-[42px]' : 'px-2 py-1 text-xs'}`}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold tracking-wider uppercase rounded-lg border-none transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${compact ? 'py-3 text-[11px] min-h-[44px]' : 'py-1.5 text-[10px]'}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-white" />
                      <span>Submit Payment-In Reference</span>
                    </button>
                  </form>
                );

                return (
                  <React.Fragment key={s.id}>
                    {/* ── MOBILE/TABLET redesigned debt card ────────────────────── */}
                    <div className="xl:hidden bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                      {/* Gradient header strip */}
                      <div className="relative px-4 pt-4 pb-3.5 overflow-hidden" style={{background: isCleared ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' : 'linear-gradient(135deg, #047857 0%, #059669 55%, #10b981 100%)'}}>
                        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-25" style={{background: 'rgba(255,255,255,0.4)'}} />
                        <div className="relative flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[9px] font-mono font-bold text-white/70 uppercase tracking-widest">Ref: {getSaleReference(s)}</span>
                            <h4 className="text-sm font-black text-white mt-1 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-white/80 shrink-0" />
                              <span className="truncate">{s.customerName || 'Customer'}</span>
                            </h4>
                            {s.customerPhone && (
                              <p className="text-[10.5px] text-white/80 flex items-center gap-1.5 mt-0.5 font-mono">
                                <Phone className="w-3 h-3 text-white/70 shrink-0" />
                                <span>{s.customerPhone}</span>
                              </p>
                            )}
                          </div>
                          <span className={`shrink-0 inline-flex items-center text-[9px] font-bold uppercase px-2.5 py-1 rounded-full ${isCleared ? 'bg-white/25 text-white' : 'bg-white text-emerald-700'}`}>
                            {isCleared ? 'Cleared' : 'Credit Due'}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 space-y-3.5">
                        {/* Stat row: Total / Paid / Balance */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl py-2 px-1">
                            <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">Total</p>
                            <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5 font-mono truncate">{currency}{Math.round(totalVal).toLocaleString()}</p>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl py-2 px-1">
                            <p className="text-[8.5px] font-bold text-emerald-500 uppercase tracking-wide">Paid</p>
                            <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono truncate">{currency}{Math.round(calculatedPaid).toLocaleString()}</p>
                          </div>
                          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl py-2 px-1">
                            <p className="text-[8.5px] font-bold text-rose-400 uppercase tracking-wide">Balance</p>
                            <p className="text-xs font-black text-rose-600 dark:text-rose-300 mt-0.5 font-mono truncate">{currency}{Math.round(calculatedDue).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">
                            <span>Reconciliation</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{currentPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${currentPercent}%`, background: 'linear-gradient(90deg, #059669 0%, #34d399 100%)' }}
                            />
                          </div>
                        </div>

                        {/* Items summary */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-[11px] space-y-1">
                          <span className="block text-[8px] font-mono font-bold uppercase tracking-widest text-slate-400">Items summary</span>
                          <div className="max-h-[70px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {s.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between py-1 font-sans text-slate-600 dark:text-slate-300 text-[11px]">
                                <span className="truncate pr-2">{formatSaleItemQuantity(item, products.find(product => product.id === item.productId))} × {item.productName}</span>
                                <span className="font-mono shrink-0">{currency}{item.price.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Payment-in form or cleared state */}
                        {!isCleared ? (
                          <div className="bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-3.5 space-y-3">
                            <span className="block text-[9px] font-mono font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Settle Outstanding Payment-In</span>
                            {paymentInForm(true)}
                          </div>
                        ) : (
                          <div className="bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 p-3 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] font-sans">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Cleared Account: Consolidated to tills ledger successfully!</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── DESKTOP — unchanged original card ─────────────────────── */}
                    <div className={`hidden xl:flex bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex-col justify-between ${isCleared ? 'border-emerald-250 bg-emerald-50/20' : 'border-slate-200'}`}>
                      <div className="space-y-4">

                        {/* Customer core card row */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-mono font-black py-0.5 px-2 bg-slate-100 border border-slate-204 rounded text-slate-500 uppercase tracking-widest">
                              Ref: {getSaleReference(s)}
                            </span>
                            <h4 className="text-sm font-bold text-slate-808 mt-2 flex items-center space-x-1.5 font-sans">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{s.customerName || 'Customer'}</span>
                            </h4>
                            {s.customerPhone && (
                              <p className="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{s.customerPhone}</span>
                              </p>
                            )}
                          </div>

                          <div className="text-right font-sans">
                            <span className={`inline-flex items-center text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${isCleared ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'}`}>
                              {isCleared ? 'Cleared' : 'Credit Due'}
                            </span>
                            <p className="text-xs font-mono font-black text-slate-900 mt-1">{currency}{totalVal.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Purchased products list summary */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] space-y-1">
                          <span className="block text-[8px] font-mono font-bold uppercase tracking-widest text-slate-400">Items summary</span>
                          <div className="max-h-[70px] overflow-y-auto divide-y divide-slate-100">
                            {s.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between py-1 font-sans text-slate-600 text-[11px]">
                                <span>{formatSaleItemQuantity(item, products.find(product => product.id === item.productId))} × {item.productName}</span>
                                <span className="font-mono">{currency}{item.price.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Collapsible Ledger Payment-In Remittance form (If not fully paid) */}
                        {!isCleared ? (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
                            <span className="block text-[9px] font-mono font-black text-emerald-800 uppercase tracking-widest">Settle Outstanding Payment-In</span>
                            {paymentInForm(false)}
                          </div>
                        ) : (
                          <div className="bg-emerald-100/50 border border-emerald-200 p-3 rounded-xl flex items-center space-x-2 text-emerald-800 font-bold text-[11px] font-sans">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Cleared Account: Consolidated to tills ledger successfully!</span>
                          </div>
                        )}
                      </div>

                      {/* Progress indicator */}
                      <div className="mt-4 space-y-1.5 font-sans">
                        <div className="flex justify-between font-mono text-[10px] font-bold text-slate-500 uppercase leading-none">
                          <span>Reconciliation</span>
                          <span>{currentPercent}% Reconciled</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${currentPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between font-mono text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded-lg mt-1.5">
                          <span className="text-slate-500">Paid: {currency}{Math.round(calculatedPaid).toLocaleString()}</span>
                          <span className="text-rose-600">Bal: {currency}{Math.round(calculatedDue).toLocaleString()}</span>
                        </div>
                      </div>

                    </div>
                  </React.Fragment>
                );
              })}

              {filteredDebtSales.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-slate-400 font-sans">
                  No outstanding credit accounts match search keyword or custom criteria.
                </div>
              )}
            </div>

          </div>
        );
      })()}
      {/* SECTION C: CASH DRAWER SHIFT CLOSE & SETTLEMENTS (PAYMENT-INS) */}
      {activeSubTab === 'settlement' && (() => {
        const totalExpectedCalculated = Number(settleOpeningFloat) + expectedTodayDrawerSales + Number(settleShiftPayIns) - Number(settleShiftPayOuts);
        const discrepancyVal = settleActualDrawerCount !== '' ? (Number(settleActualDrawerCount) - totalExpectedCalculated) : 0;

        const handleRegisterSettlement = (e: FormEvent) => {
          e.preventDefault();
          
          if (!settleReferenceCode.trim()) {
            alert("Reference Code / Slip ID is mandatory for tracking cash transfers!");
            return;
          }

          const transferAmount = Number(settlePayInAmount !== '' ? settlePayInAmount : 0);
          if (transferAmount <= 0) {
            alert("Please specify a valid transfer amount greater than 0.");
            return;
          }

          const newId = 'SETTLE-' + Math.floor(1000 + Math.random() * 9000);
          
          const destinationLabel = settleDestinationType === 'account' 
            ? settleRegisteredAccount 
            : `${settleRecipientName} (Direct To Person - ${settleRecipientTransferType === 'mobile_money' ? 'M-Pesa Mobile Money' : 'Bank Transfer'})`;

          const newSettle: TillSettlement = {
            id: newId,
            timestamp: new Date().toISOString(),
            cashierName: settleCashierName.trim() || 'In-Office Teller',
            openingFloat: Number(settleOpeningFloat),
            expectedSalesCash: expectedTodayDrawerSales,
            actualCashInDrawer: Number(settleActualDrawerCount),
            paymentInAmount: transferAmount,
            discrepancy: discrepancyVal,
            vaultDestination: destinationLabel,
            status: 'settled',
            memo: `${settleMemo.trim()} [Ref ID: ${settleReferenceCode}]`,
            receiptFileName: settleReceiptFile?.name || undefined,
            receiptFileSize: settleReceiptFile?.size || undefined,
            receiptSmsText: settleSmsPasteText.trim() || undefined,
            openingFloatVerified: openingFloatVerified
          };

          // Generate Double-Entry ledger transactions
          const coreCashOutFlow = {
            id: 'ENTRY-OUT-' + Math.floor(10000 + Math.random() * 90000),
            settlementId: newId,
            timestamp: new Date().toISOString(),
            type: 'cash_outflow' as const,
            amount: -transferAmount, // Mathematically balance drawer cash down
            paymentMode: 'cash',
            entryType: 'drawer_settlement_withdraw',
            destinationName: destinationLabel,
            reference: settleReferenceCode,
            cashierName: settleCashierName
          };

          let splitEntry;
          if (settleDestinationType === 'account') {
            const isMomo = settleRegisteredAccount.toLowerCase().includes('m-pesa') || settleRegisteredAccount.toLowerCase().includes('momo') || settleRegisteredAccount.toLowerCase().includes('till');
            splitEntry = {
              id: 'ENTRY-IN-' + Math.floor(10000 + Math.random() * 90000),
              settlementId: newId,
              timestamp: new Date().toISOString(),
              type: 'path_a_split_deposit' as const,
              amount: transferAmount, // Credit matching destination
              paymentMode: isMomo ? 'mobile_money' : 'bank',
              entryType: 'drawer_settlement_deposit',
              sourceMode: 'cash',
              destinationName: settleRegisteredAccount,
              reference: settleReferenceCode,
              cashierName: settleCashierName
            };
          } else {
            splitEntry = {
              id: 'ENTRY-IN-' + Math.floor(10000 + Math.random() * 90000),
              settlementId: newId,
              timestamp: new Date().toISOString(),
              type: 'path_b_split_payout' as const,
              amount: transferAmount,
              paymentMode: settleRecipientTransferType === 'mobile_money' ? 'mobile_money' : 'bank',
              entryType: 'person_payout',
              destinationName: settleRecipientName,
              reference: settleReferenceCode,
              cashierName: settleCashierName
            };
          }

          // Save and Update State
          setTillSettlements(prev => [newSettle, ...prev]);
          setDoubleEntryLedgers(prev => [coreCashOutFlow, splitEntry, ...prev]);

          setSettleSuccessMsg(`✓ Shift Finalized! Document: ${newId}. Dual ledger entries have been routed successfully.`);

          // Inform user about printer physical kick
          setTimeout(() => {
            alert(`🖨️ Receipt Printer Alert:\n\nTriggering print layout for slip ${newId} with dual-entry split receipts.\n\nNote: Sending raw ESC/POS control codes (via print command) to thermal printers mechanically opens secure physical till drawers connected via standard RJ11/RJ12 telephone cables.`);
            window.print();
          }, 350);

          // Clear form fields
          setSettleReferenceCode('');
          setSettleRecipientName('');
          setSettleMemo('');
          setSettleShiftPayIns(0);
          setSettleShiftPayOuts(0);
          setSettleReceiptFile(null);
          setSettleSmsPasteText('');
          setOpeningFloatVerified(false);
          onlineStorage.removeItem(`float_verified_${activeTenant.id}`);

          setTimeout(() => {
            setSettleSuccessMsg(null);
          }, 6000);
        };

        const preRegisteredCompanyOptions = [
          'Equity Bank Operating Treasury (A/C: 1024-555)',
          'CRDB Corporate Deposit Node (A/C: 4002-887)',
          'M-Pesa Merchant Settlement Till #98021',
          'MTN MoMo Corporate Float Node #44321',
          'Main Vault Room Safe #12'
        ];

        const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';

        return (
          <div className="space-y-6 font-sans">
            
            {/* Feature Gating Workspace Header */}
            {isAdmin && (
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-indigo-950/40 animate-fade-in">
                <div>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-indigo-400 font-bold block">SaaS Membership Module</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <h4 className="text-xs font-bold font-mono">
                      Tenant Level: <span className="text-emerald-400 capitalize underline px-1">{activePlanId}</span>
                    </h4>
                    <span className="text-xs text-slate-400">•</span>
                    <p className="text-[11px] text-slate-300">
                      Shift Settle and Cash Drawer tracking follows the active subscription package.
                    </p>
                  </div>
                </div>
              </div>
            )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="shift-settlements-view">
                
                {/* COLUMN 1 (6 Cols): ACTIVE SHIFT SETTLEMENT & CASH HANDOFF FORM */}
                <div className="lg:col-span-5 border border-slate-200 bg-white p-6 rounded-3xl shadow-sm space-y-5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">Shift Close & Till Handoff</h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Finalize the current drawer session, count physical cash assets, and route drops to corporate bank safes or recipient payouts.
                    </p>
                  </div>

                  {settleSuccessMsg && (
                    <div className="bg-emerald-500/10 border border-emerald-400 font-sans text-xs text-emerald-800 font-bold p-3.5 rounded-xl animate-bounce">
                      {settleSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleRegisterSettlement} className="space-y-4">
                    
                    {/* STEP 1: START OF SHIFT OPENING FLOAT CHECK */}
                    <div className={`p-4 rounded-2xl border ${openingFloatVerified ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-amber-50/80 border-amber-250 text-amber-950'} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono font-black tracking-wider text-slate-500">
                          Step 1: Start of Shift Drawer Verification
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${openingFloatVerified ? 'bg-emerald-600 text-white animate-pulse' : 'bg-amber-600 text-white'}`}>
                          {openingFloatVerified ? '✓ Verified & Locked' : '⚠️ Pending Verification'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[11px] leading-snug">
                          {openingFloatVerified 
                            ? `You successfully matched the physical paper coins & banknotes in the register drawer with the opening float at the start of the shift.`
                            : `Confirm opening cash before sales.`
                          }
                        </p>
                      </div>

                      <div className="flex items-end gap-3 pt-1">
                        <div className="flex-1">
                          <label className="block text-[8px] font-mono font-bold uppercase text-slate-500 mb-1">Counted Opening Float ({currency})</label>
                          <input
                            type="number"
                            min="0"
                            disabled={openingFloatVerified}
                            value={settleOpeningFloat}
                            onChange={(e) => setSettleOpeningFloat(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-white border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:font-bold rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                          />
                        </div>
                        {openingFloatVerified ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpeningFloatVerified(false);
                              onlineStorage.setItem(`float_verified_${activeTenant.id}`, 'false');
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 text-[10px] font-mono font-black uppercase rounded-lg transition-all border-none cursor-pointer"
                          >
                            Reset Verification
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setOpeningFloatVerified(true);
                              const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              setVerifiedFloatTimestamp(nowTime);
                              onlineStorage.setItem(`float_verified_${activeTenant.id}`, 'true');
                              onlineStorage.setItem(`float_verified_time_${activeTenant.id}`, nowTime);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-[10px] font-mono font-black uppercase rounded-lg transition-all border-none cursor-pointer"
                          >
                            Verify & Match Lock
                          </button>
                        )}
                      </div>

                      {openingFloatVerified && (
                        <div className="text-[9px] text-emerald-800 font-medium italic">
                          ✓ Drawer float verified at {verifiedFloatTimestamp || 'just now'} by Cashier {settleCashierName}
                        </div>
                      )}
                    </div>

                    {/* Basic Operator info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[8px] font-mono font-black uppercase text-slate-400 mb-1">Cashier Session Login</label>
                        <input
                          type="text"
                          required
                          value={settleCashierName}
                          onChange={(e) => setSettleCashierName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-sans text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-mono font-black uppercase text-slate-400 mb-1">Active Currency</label>
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-600">
                          {activeTenant.currencyCode} ({currency})
                        </div>
                      </div>
                    </div>

                    {/* Mathematically Structured Shift Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      
                      {/* Opening Float Card (Read-only) */}
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1">
                        <span className="block text-[8px] font-mono font-bold uppercase text-slate-400">Opening Float</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] text-slate-500 font-mono">{currency}</span>
                          <span className="text-xs font-mono font-black text-slate-700">{settleOpeningFloat}</span>
                        </div>
                        <span className="block text-[9px] text-slate-400 italic">Read-only preset</span>
                      </div>

                      {/* Shift Pay-Ins */}
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1">
                        <label className="block text-[8px] font-mono font-bold uppercase text-slate-500">Shift Pay-Ins</label>
                        <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                          <span className="text-[9px] text-slate-500 font-mono">{currency}</span>
                          <input
                            type="number"
                            min="0"
                            value={settleShiftPayIns}
                            onChange={(e) => setSettleShiftPayIns(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full border-none outline-none font-mono text-xs font-bold px-0 p-0 text-slate-800 bg-transparent"
                          />
                        </div>
                        <span className="block text-[8px] text-slate-400 mt-0.5">Drawer injection</span>
                      </div>

                      {/* Shift Pay-Outs */}
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1">
                        <label className="block text-[8px] font-mono font-bold uppercase text-slate-455">Shift Pay-Outs</label>
                        <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                          <span className="text-[9px] text-slate-500 font-mono">{currency}</span>
                          <input
                            type="number"
                            min="0"
                            value={settleShiftPayOuts}
                            onChange={(e) => setSettleShiftPayOuts(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full border-none outline-none font-mono text-xs font-bold px-0 p-0 text-slate-800 bg-transparent"
                          />
                        </div>
                        <span className="block text-[8px] text-slate-400 mt-0.5">Petty expense leak</span>
                      </div>

                    </div>

                    {/* Real-time calculated indicator of expected cash on floor handover */}
                    <div className="p-3 bg-indigo-50/50 border border-indigo-150 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="block text-[9px] font-mono font-black text-indigo-500 uppercase tracking-wider">Expected Till Cash Balance</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">Opening Float ({settleOpeningFloat}) + Cash Sales ({expectedTodayDrawerSales}) + PayIns ({settleShiftPayIns}) - PayOuts ({settleShiftPayOuts})</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-sans text-indigo-650 font-medium">Expected Summary:</span>
                        <div className="text-sm font-mono font-black text-indigo-950">
                          {currency}{totalExpectedCalculated.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* TODAY'S CASH SALES ACCUMULATED INFO COMPONENT */}
                    {(() => {
                      const todayCashSales = sales.filter(s => s.timestamp.startsWith(todayStr) && s.paymentMethod === 'Cash');
                      const todayCashInstalls = Object.entries(installmentRecords).flatMap(([saleId, insts]) => {
                        const typed = (insts as Array<{ id: string; amount: number; date: string; method: string }> || []);
                        return typed.map(i => ({ ...i, saleId }));
                      }).filter(i => i.date.startsWith(todayStr) && i.method === 'Cash');

                      return (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-mono font-black tracking-wider text-slate-500 flex items-center space-x-1">
                              <span>📦 Today's Live Sales Audit Stream</span>
                            </span>
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 font-mono font-bold px-1.5 py-0.5 rounded">
                              {todayCashSales.length + todayCashInstalls.length} receipts
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Match today cash with drawer cash.
                          </p>

                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {todayCashSales.map(s => {
                              const itemsSummary = s.items.map(i => `${i.productName} (${formatSaleItemQuantity(i, products.find(product => product.id === i.productId))})`).join(', ');
                              return (
                                <div key={s.id} className="bg-white border border-slate-200 p-2 rounded-xl flex items-center justify-between text-[11px] hover:border-indigo-300 transition-all">
                                  <div>
                                    <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                                      <span className="text-indigo-600">{s.id}</span>
                                      <span className="text-slate-400 font-mono text-[9px]">{new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="text-[9.5px] text-slate-500 truncate max-w-[170px]" title={itemsSummary || 'Customer Sale Record'}>{itemsSummary || 'Customer Sale Record'}</div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-mono font-bold text-emerald-800">+{currency}{(s.amountPaid !== undefined ? s.amountPaid : s.total).toLocaleString()}</span>
                                    <span className="block text-[8px] uppercase font-mono font-black text-slate-400">Cash POS</span>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {todayCashInstalls.map((inst, index) => (
                              <div key={index} className="bg-white border border-slate-200 p-2 rounded-xl flex items-center justify-between text-[11px] hover:border-indigo-300 transition-all">
                                <div>
                                  <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                                    <span className="text-rose-600">DEBT-PAY</span>
                                    <span className="text-slate-400 font-mono text-[9px]">{new Date(inst.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  </div>
                                  <div className="text-[9.5px] text-slate-500 truncate max-w-[170px]">Installment for Ticket {inst.saleId}</div>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-emerald-800">+{currency}{inst.amount.toLocaleString()}</span>
                                  <span className="block text-[8px] uppercase font-mono font-black text-slate-400">Cash Debt-Pay</span>
                                </div>
                              </div>
                            ))}

                            {todayCashSales.length === 0 && todayCashInstalls.length === 0 && (
                              <div className="text-center py-4 text-slate-400 text-xs italic font-sans bg-white rounded-xl border border-dashed border-slate-200">
                                No cash receipts processed yet today.
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-sans">
                            <span className="text-slate-500 font-medium">Auto System Cash Volume:</span>
                            <span className="font-mono font-black text-emerald-700">+{currency}{expectedTodayDrawerSales.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actual Physical Till counted field */}
                    <div>
                      <label className="block text-[8.5px] font-mono font-black uppercase text-slate-500 mb-1">
                        Actual Physical Cash Counted ({currency}) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={settleActualDrawerCount}
                        onChange={(e) => setSettleActualDrawerCount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Count all physical notes & silver change"
                      />
                      <span className="block text-[9px] text-slate-400 mt-0.5">Cash count.</span>
                    </div>

                    {/* Variance alert card block */}
                    <div className={`p-3 rounded-2xl border ${
                      discrepancyVal === 0 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : discrepancyVal < 0
                          ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse'
                          : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-sans">
                        <span className="font-bold flex items-center space-x-1">
                          <span>📊 Variance Tracker:</span>
                          <span className="font-mono text-[10px] font-medium">(Actual - Expected)</span>
                        </span>
                        <span className="font-mono font-black uppercase text-xs">
                          {discrepancyVal === 0 
                            ? 'Balanced (✓ 0.00 Perfect)' 
                            : discrepancyVal < 0 
                              ? `💸 Shortage: -${currency}${Math.abs(discrepancyVal).toLocaleString()}` 
                              : `📈 Surge/Overage: +${currency}${discrepancyVal.toLocaleString()}`}
                        </span>
                      </div>
                      <div className="mt-1 text-[9px] opacity-75 font-sans leading-relaxed">
                        {discrepancyVal === 0 && "Great job! Physical cash matches system totals perfectly. Drawer is cleared to close."}
                        {discrepancyVal < 0 && "ALERT! The counted physical drawer cash is LESS than expected. Verify coin drops or register petty slips before settling."}
                        {discrepancyVal > 0 && "Overage recorded. High surplus could indicate unlogged cash-ins or missing customer change refund steps."}
                      </div>
                    </div>

                    {/* Volume of cash being transferred out of drawer */}
                    <div>
                      <label className="block text-[8.5px] font-mono font-black uppercase text-slate-500 mb-1">
                        Amount to Transfer / Drop ({currency}) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={settlePayInAmount}
                        onChange={(e) => setSettlePayInAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Cash removed"
                      />
                      <span className="block text-[9px] text-slate-400 mt-0.5">Amount to clear out of the physical drawer and route.</span>
                    </div>

                    {/* Destination Target Toggle switch selector */}
                    <div className="space-y-2 border-t border-slate-200/60 pt-3">
                      <label className="block text-[8.5px] font-mono font-black uppercase text-slate-500">Destination target route</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSettleDestinationType('account')}
                          className={`px-3 py-2.5 rounded-xl border text-[10px] uppercase font-bold flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all ${
                            settleDestinationType === 'account'
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Building className="w-4 h-4" />
                          <span>Registered Company Account</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettleDestinationType('person')}
                          className={`px-3 py-2.5 rounded-xl border text-[10px] uppercase font-bold flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all ${
                            settleDestinationType === 'person'
                              ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <User className="w-4 h-4" />
                          <span>Direct Cash To Person</span>
                        </button>
                      </div>
                    </div>

                    {/* TOGGLE PATH A : Registered Business Account dropdown */}
                    {settleDestinationType === 'account' && (
                      <div className="p-3.5 bg-indigo-50/30 border border-indigo-100 rounded-2xl space-y-1.5 animate-fade-in">
                        <label className="block text-[8.5px] font-mono font-black uppercase text-indigo-700">Pre-Registered Company Account Node</label>
                        <select
                          value={settleRegisteredAccount}
                          onChange={(e) => setSettleRegisteredAccount(e.target.value)}
                          className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          {preRegisteredCompanyOptions.map((opt, id) => (
                            <option key={id} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <span className="block text-[8.5px] text-slate-500">
                          Deposit to selected account.
                        </span>
                      </div>
                    )}

                    {/* TOGGLE PATH B : Direct to Person text fields */}
                    {settleDestinationType === 'person' && (
                      <div className="p-3.5 bg-rose-50/20 border border-rose-100 rounded-2xl space-y-3 animate-fade-in">
                        <span className="block text-[8.5px] font-mono font-black uppercase text-rose-700">Ad-Hoc Direct Recipient Payout</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8px] font-mono font-bold uppercase text-slate-500 mb-1">Beneficiary Name</label>
                            <input
                              type="text"
                              required
                              value={settleRecipientName}
                              onChange={(e) => setSettleRecipientName(e.target.value)}
                              placeholder="e.g. Jane Doe (Manager)"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] font-mono font-bold uppercase text-slate-500 mb-1">Payout Channel Type</label>
                            <select
                              value={settleRecipientTransferType}
                              onChange={(e) => setSettleRecipientTransferType(e.target.value as any)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 outline-none"
                            >
                              <option value="bank">🏦 Bank Wire Transaction</option>
                              <option value="mobile_money">📱 Mobile Money Wallet Transfer</option>
                            </select>
                          </div>
                        </div>

                        <span className="block text-[8.5px] text-rose-700 leading-relaxed font-sans mt-1">
                          <strong>Route:</strong> person payout.
                        </span>
                      </div>
                    )}

                    {/* Reference code entry */}
                    <div>
                      <label className="block text-[8px] font-mono font-black uppercase text-slate-500 mb-1">
                        Tracking Slip Reference Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={settleReferenceCode}
                        onChange={(e) => setSettleReferenceCode(e.target.value)}
                        placeholder="Deposit reference"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="block text-[8px] text-slate-400 mt-1">Required reference.</span>
                    </div>

                    {/* DEPOSIT SLIP / RECEIPT DRAG-AND-DROP ZONE */}
                    <div className="space-y-2 border-t border-slate-200/60 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-[8.5px] font-mono font-black uppercase text-slate-500">
                          Upload Deposit Receipt (PDF or Image)
                        </label>
                        {settleReceiptFile && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            Attached ✓
                          </span>
                        )}
                      </div>
                      
                      <div 
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const files = e.dataTransfer.files;
                          if (files && files.length > 0) {
                            const file = files[0];
                            const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
                            const isImage = file.type.startsWith('image/') || file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg');
                            if (isPdf || isImage) {
                              setSettleReceiptFile({
                                name: file.name,
                                size: (file.size / 1024).toFixed(1) + ' KB'
                              });
                            } else {
                              alert("Please upload a valid PDF file or image (PNG/JPG).");
                            }
                          }
                        }}
                        className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                          settleReceiptFile 
                            ? 'border-indigo-500 bg-indigo-50/30' 
                            : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-100/50'
                        }`}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'application/pdf,image/*';
                          input.onchange = (e) => {
                            const target = e.target as HTMLInputElement;
                            if (target.files && target.files.length > 0) {
                              const file = target.files[0];
                              setSettleReceiptFile({
                                name: file.name,
                                size: (file.size / 1024).toFixed(1) + ' KB'
                              });
                            }
                          };
                          input.click();
                        }}
                      >
                        {settleReceiptFile ? (
                          <div className="space-y-1.5 text-slate-700 font-sans" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center space-x-2">
                              <FileText className="w-5 h-5 text-indigo-600 animate-pulse" />
                              <span className="text-xs font-bold truncate max-w-[200px]" title={settleReceiptFile.name}>{settleReceiptFile.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({settleReceiptFile.size})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettleReceiptFile(null)}
                              className="text-[9px] font-mono text-rose-600 hover:underline font-extrabold border-none bg-transparent cursor-pointer"
                            >
                              ✕ Remove / Clear File
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-500 pointer-events-none">
                            <div className="flex justify-center">
                              <Download className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-[11px] font-sans">
                              Drag and drop your file here, or <span className="text-indigo-600 font-bold underline">browse local files</span>
                            </p>
                            <p className="text-[8.5px] font-mono text-slate-400">Supports PDF / Images up to 10MB</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CLIPBOARD SMS MUAMALA / TRANSACTION MESSAGE BOX */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[8.5px] font-mono font-black uppercase text-slate-500">
                          Paste Transaction SMS Text (Optional)
                        </label>
                        <span className="text-[8px] text-slate-400 italic">M-Pesa, Airtel Money, Bank SMS</span>
                      </div>
                      <textarea
                        rows={2}
                        value={settleSmsPasteText}
                        onChange={(e) => setSettleSmsPasteText(e.target.value)}
                        placeholder="Confirmation message..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[10px]"
                      />
                    </div>

                    {/* Optional remarks/memo */}
                    <div>
                      <label className="block text-[8px] font-mono font-black uppercase text-slate-400 mb-1.5">Remarks / Audit Note</label>
                      <textarea
                        rows={2}
                        placeholder="Shift note..."
                        value={settleMemo}
                        onChange={(e) => setSettleMemo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Action execution button */}
                    <button
                      type="submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all cursor-pointer shadow-xs border-none flex items-center justify-center space-x-1.5"
                    >
                      <Building className="w-4 h-4 text-white" />
                      <span>Confirm & Execute Split Settlement</span>
                    </button>

                  </form>
                </div>

                {/* COLUMN 2 (7 Cols): HISTORICAL SHIFT CLOSURES & DOUBLE ENTRY LEDGER VIEW */}
                <div className="lg:col-span-7 space-y-6 self-start">
                  
                  {/* Historic drawer handovers table */}
                  <div className="border border-slate-200 bg-white p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">Historical Till Settlements</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Shift settlement.</p>
                      </div>
                      <div className="bg-slate-100 px-2.5 py-1.5 rounded-lg font-mono text-[10px] text-indigo-700 font-bold border border-slate-200">
                        Deposited Cash: {currency}{tillSettlements.reduce((tot, st) => tot + st.paymentInAmount, 0).toLocaleString()}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest select-none">
                            <th className="p-2.5">Date / Time</th>
                            <th className="p-2.5">Cashier</th>
                            <th className="p-2.5 text-right">Expected Drawer</th>
                            <th className="p-2.5 text-right">Actual Counted</th>
                            <th className="p-2.5 text-center">Variance Flag</th>
                            <th className="p-2.5">Destination Safe / Reference Code</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                          {tillSettlements.map(st => (
                            <tr key={st.id} className="hover:bg-slate-50 transition-all text-[11px]">
                              <td className="p-2.5 font-mono text-slate-500">
                                <span className="block font-bold">{new Date(st.timestamp).toLocaleDateString()}</span>
                                <span className="text-[10px]">{new Date(st.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </td>
                              <td className="p-2.5 font-bold font-sans text-slate-800">
                                {st.cashierName}
                                <span className="block text-[8px] uppercase tracking-wider font-mono text-indigo-500 mt-0.5">{st.id}</span>
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-600">
                                {currency}{st.openingFloat + st.expectedSalesCash}
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-900 font-bold">
                                {currency}{st.actualCashInDrawer.toLocaleString()}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`inline-flex items-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded ${
                                  st.discrepancy === 0 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : st.discrepancy < 0 
                                      ? 'bg-rose-100 text-rose-800' 
                                      : 'bg-blue-100 text-blue-805'
                                }`}>
                                  {st.discrepancy === 0 
                                    ? 'Balanced' 
                                    : st.discrepancy < 0 
                                      ? `Shortage (-${Math.abs(st.discrepancy)})` 
                                      : `Overage (+${st.discrepancy})`}
                                </span>
                              </td>
                              <td className="p-2.5 font-sans leading-tight">
                                <div className="font-bold text-slate-800 truncate max-w-[150px]">{st.vaultDestination}</div>
                                {st.memo && <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[150px]">{st.memo}</div>}
                                
                                {st.openingFloatVerified && (
                                  <div className="mt-1 text-[9px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded w-max">
                                    ✓ Shift Float Verified at Start
                                  </div>
                                )}
                                
                                {st.receiptFileName && (
                                  <div className="mt-1 flex items-center space-x-1 text-[9.5px] text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-1.5 py-0.5 rounded w-max font-mono">
                                    <FileText className="w-3 h-3 text-indigo-500" />
                                    <span className="truncate max-w-[120px]" title={st.receiptFileName}>Doc: {st.receiptFileName} ({st.receiptFileSize})</span>
                                  </div>
                                )}
                                
                                {st.receiptSmsText && (
                                  <div className="mt-1 text-[9.5px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded max-w-[180px] break-words font-mono block">
                                    💬 SMS: <span className="text-slate-500 italic">"{st.receiptSmsText}"</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          {tillSettlements.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 text-xs italic">
                                No shift settlements recorded yet under this merchant workspace.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* DOUBLE-ENTRY SPLIT JOURNAL VIEW */}
                  <div className="border border-slate-200 bg-indigo-950 text-indigo-50 p-6 rounded-3xl shadow-sm space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-widest font-mono text-indigo-400">
                          🔀 Real-Time Double-Entry Split Ledger
                        </h4>
                        <span className="text-[9px] bg-indigo-900 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded-md">
                          Verified Audit Stream
                        </span>
                      </div>
                      <p className="text-[10.5px] text-indigo-305 mt-1 leading-relaxed">
                        Every physical drop removes assets from the cash drawer register (Debit outflow entry) and transfers an identical credit amount directly to registered bank assets or payouts.
                      </p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-indigo-900 bg-slate-950 font-sans">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-indigo-950/80 border-b border-indigo-900 text-[8.5px] font-mono font-bold text-indigo-300 uppercase tracking-widest select-none">
                            <th className="p-2.5">Entry Token</th>
                            <th className="p-2.5">Settle Ref</th>
                            <th className="p-2.5">Accounting Action</th>
                            <th className="p-2.5">Payment Mode</th>
                            <th className="p-2.5 text-right">Value Change</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-950/80 font-mono text-slate-200">
                          {doubleEntryLedgers.map(entry => {
                            const isNegative = entry.amount < 0;
                            return (
                              <tr key={entry.id} className="hover:bg-indigo-950/30 transition-all">
                                <td className="p-2.5 text-indigo-405 font-bold">{entry.id}</td>
                                <td className="p-2.5 text-indigo-300">
                                  <span className="block font-bold">{entry.settlementId}</span>
                                  <span className="text-[9px] text-slate-400">{entry.reference}</span>
                                </td>
                                <td className="p-2.5 font-sans leading-tight">
                                  <span className="block font-bold text-indigo-200">
                                    {entry.type === 'cash_outflow' ? 'Cash Register Money Out' : 'Destination Asset Influx'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {entry.destinationName} ({entry.entryType})
                                  </span>
                                </td>
                                <td className="p-2.5 uppercase text-[10px] font-bold text-indigo-300">
                                  {entry.paymentMode}
                                </td>
                                <td className={`p-2.5 text-right font-bold text-xs ${isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {isNegative ? '-' : '+'}{currency}{Math.abs(entry.amount).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                          {doubleEntryLedgers.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-indigo-400/70 text-xs italic">
                                No split entries yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-indigo-300 bg-indigo-900/30 p-2.5 rounded-xl border border-indigo-900/50">
                      <span>💡</span>
                      <p className="leading-tight">
                        <strong>Ledger Rules Enforced:</strong> Physical drawer balance matches standard GAAP criteria where assets decrement from till and increment in target treasury nodes.
                      </p>
                    </div>

                  </div>

                </div>

              </div>
          </div>
        );
      })()}

      {/* SECTION D: QUOTATIONS, PROFORMA & INVOICES (STOCK-INDEPENDENT) */}
      {activeSubTab === 'documents' && (() => {
        const filteredDocs = documents.filter(doc => {
          const matchType = selectedDocTypeFilter === 'all' || doc.type === selectedDocTypeFilter;
          const matchSearch = doc.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || doc.documentNumber.toLowerCase().includes(searchTerm.toLowerCase());
          return matchType && matchSearch;
        });

        return (
          <div className="space-y-6 animate-fade-in" id="sales-documents-view">
            {/* Header control block */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search docs or clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-emerald-500"
                  />
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                </div>
                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  {(['all', 'price quote', 'proforma invoice'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedDocTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize cursor-pointer transition-all ${
                        selectedDocTypeFilter === t
                          ? 'bg-white text-slate-950 shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t === 'all' ? 'Show All' : getDocumentLabel(t)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewDocItems([]);
                  setNewDocCustomerName('');
                  setNewDocCustomerPhone('');
                  setNewDocCustomerAddress('');
                  setShowNewDocModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1 border-none cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>New Quote / Invoice</span>
              </button>
            </div>

            {/* List of generated documents */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
              {filteredDocs.map(doc => {
                const totals = getDocumentTotals(doc);

                const typeColor = normalizeDocType(doc.type) === 'price quote'
                  ? { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }
                  : { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };

                return (
                  <div key={doc.id}
                    className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs active:scale-[0.985] cursor-pointer"
                    onClick={() => { setViewingDocument(doc); setDocZoom(computeInvoiceFitZoom()); }}
                    style={{boxShadow: '0 1px 6px rgba(0,0,0,0.06)'}}
                  >
                    {/* Top accent + type + doc number */}
                    <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg"
                        style={{ background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.border}` }}>
                        {getDocumentLabel(doc.type)}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        doc.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {doc.status === 'pending' ? 'Pending' : '✓ Converted'}
                      </span>
                    </div>

                    <div className="px-4 pb-3">
                      {/* Customer + date */}
                      <p className="font-extrabold text-slate-900 text-[13px] leading-tight truncate">
                        {doc.customerName || 'Customer'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {doc.documentNumber}
                        </span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(doc.timestamp).toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})}
                        </span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] text-slate-400">
                          {doc.items.length} item{doc.items.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Total + actions */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                        <p className="font-black text-slate-900 text-[15px] font-mono">
                          {money(totals.total)}
                        </p>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => { setViewingDocument(doc); setDocZoom(computeInvoiceFitZoom()); }}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-slate-200 bg-slate-50 text-slate-700"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          {doc.status === 'pending' ? (
                            isMixedBranchDocument(doc) ? (
                              <span
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-400 flex items-center gap-1"
                                title="Mixes products from two branches — cannot be recorded as a sale from here."
                              >
                                <span>Multi-branch</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => sendDocumentToSales(doc)}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-emerald-600 text-white border-none"
                              >
                                <ArrowRight className="w-3 h-3" />
                                <span>Record</span>
                              </button>
                            )
                          ) : (
                            <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-400 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Done</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredDocs.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white border border-slate-200 rounded-3xl shadow-xs italic text-slate-400 text-xs font-sans">
                No documents found matching current filter under this tenant branch office.
              </div>
            )}
          </div>
        );
      })()}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: VIEW AND PRINT RECEIPT RE-PRINT OVERLAY */}
      {/* ------------------------------------------------------------- */}
      {selectedSale && !viewPaymentsOpen && (
        <div className={viewA4InvoiceOpen ? "fixed inset-0 z-[200] flex flex-col bg-[#404040] font-sans" : "fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm text-slate-800"}
          style={viewA4InvoiceOpen ? {paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'} : {}}>
          
          {/* CONDITION A: A4 CORPORATE INVOICE MODE */}
          {viewA4InvoiceOpen ? (
            <>
              {/* WYSIWYG Toolbar — shrink-0 */}
              <div className="shrink-0 bg-[#2c2c2c] border-b border-[#1a1a1a] px-3 py-2 flex items-center justify-between gap-2 print:hidden select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => { setSelectedSale(null); setViewA4InvoiceOpen(false); setDocZoom(0.65); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-black truncate leading-tight">Sales Invoice — {selectedSale.reference || selectedSale.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-white/40 text-[10px] font-mono truncate">{selectedSale.customerName || 'Customer'} · {new Date(selectedSale.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-xl px-2 py-1">
                  <button type="button" onClick={() => setDocZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white cursor-pointer"><ZoomOut className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setDocZoom(1.0)} className="text-white/70 hover:text-white text-xs font-mono font-bold w-12 text-center cursor-pointer">{Math.round(docZoom * 100)}%</button>
                  <button type="button" onClick={() => setDocZoom(z => Math.min(2.0, +(z + 0.1).toFixed(1)))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white cursor-pointer"><ZoomIn className="w-4 h-4" /></button>
                </div>

                <button
                  onClick={() => { setSelectedSale(null); setViewA4InvoiceOpen(false); setDocZoom(0.65); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/70 transition-colors cursor-pointer text-white shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── BOTTOM ACTION BAR — Send / Download / Close, one row, all screen sizes ── */}
              <div className="shrink-0 bg-[#1e1e1e] border-t border-[#2a2a2a] px-3 py-2 flex items-center justify-center gap-2 print:hidden">
                <button onClick={() => shareSalePdf(selectedSale, selectedSale.customerPhone, 'a4')}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" /><span>Send</span>
                </button>
                <button onClick={() => downloadInvoicePdf(selectedSale)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors">
                  <Download className="w-3.5 h-3.5" /><span>Download</span>
                </button>
                <button onClick={() => { setSelectedSale(null); setViewA4InvoiceOpen(false); setDocZoom(0.65); }}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white/10 hover:bg-red-500/60 text-white text-[11px] font-bold transition-colors">
                  <X className="w-3.5 h-3.5" /><span>Close</span>
                </button>
              </div>

              {/* A4 Canvas */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden print:overflow-visible print:bg-white" style={{background: '#404040'}}>
                <div className="print:hidden text-center py-2">
                  <span className="text-white/20 text-[10px] font-mono select-none">A4 · Sales Invoice · {selectedSale.reference || selectedSale.id}</span>
                </div>
                <div className="flex justify-start md:justify-center px-2 md:px-0 pb-16 print:pb-0 print:block">
                  <div
                    id="sales-invoice-a4-pdf-template"
                    style={{
                      width: '794px',
                      minHeight: '1123px',
                      transform: `scale(${docZoom})`,
                      transformOrigin: 'top center',
                      marginBottom: docZoom < 1 ? `${(1123 * docZoom) - 1123}px` : 0,
                    }}
                    className="bg-white shadow-2xl font-sans relative print:shadow-none print:min-h-0 shrink-0"
                  >
                  <style>{`
                    @media print { body * { visibility: hidden !important; } #sales-invoice-a4-pdf-template, #sales-invoice-a4-pdf-template * { visibility: visible !important; } #sales-invoice-a4-pdf-template { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; transform: none !important; } }
                  `}</style>

                {/* Standard A4 template used by every downloaded sales invoice. */}
                <div className="p-8 space-y-5">
                  <div className="flex items-start justify-between gap-8">
                    <div className="min-w-0">
                      {(((() => { const stores = systemSettings?.business?.registeredStores || []; const activeBranch = stores[0]; const bb = activeBranch && systemSettings?.business?.branchBranding?.[activeBranch]; return bb?.businessLogoLight || bb?.businessLogo || null; })()) || getBusinessLogo(systemSettings)) ? (
                        <img
                          src={((() => { const stores = systemSettings?.business?.registeredStores || []; const activeBranch = stores[0]; const bb = activeBranch && systemSettings?.business?.branchBranding?.[activeBranch]; return bb?.businessLogoLight || bb?.businessLogo || null; })()) || getBusinessLogo(systemSettings) || undefined}
                          alt="Logo"
                          referrerPolicy="no-referrer"
                          className="max-h-16 max-w-[200px] object-contain mb-3"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl text-white flex items-center justify-center text-xl font-black mb-3" style={{ backgroundColor: computedInvoiceColor }}>
                          {getBusinessDisplayName(activeTenant, systemSettings).charAt(0)}
                        </div>
                      )}
                      <h2 className="text-xl font-black text-slate-900">{getBusinessDisplayName(activeTenant, systemSettings)}</h2>
                      {/* Address block stays plain black/gray, never the brand color, so it always
                          reads as the legal business address rather than decorative branding. */}
                      {activeTenant.city && <p className="text-[11px] text-slate-400 uppercase font-bold mt-1">{activeTenant.city}</p>}
                      {systemSettings?.business?.businessAddress && <p className="text-[11px] text-slate-500 mt-1">{systemSettings.business.businessAddress}</p>}
                      {systemSettings?.business?.businessPhone && <p className="text-[11px] text-slate-500 font-semibold">Tel: {systemSettings.business.businessPhone}</p>}
                      {systemSettings?.business?.businessEmail && <p className="text-[11px] text-slate-500">{systemSettings.business.businessEmail}</p>}
                      {/* TIN and VAT — from Invoice Settings, directly below the address */}
                      {systemSettings?.invoiceSettings?.tinNumber && <p className="text-[11px] text-slate-500 font-mono">TIN: {systemSettings.invoiceSettings.tinNumber}</p>}
                      {systemSettings?.invoiceSettings?.vatNumber && <p className="text-[11px] text-slate-500 font-mono">VAT: {systemSettings.invoiceSettings.vatNumber}</p>}
                    </div>
                    <div className="text-right font-mono text-xs space-y-1.5 shrink-0">
                      <div className="inline-block text-white text-sm font-black uppercase tracking-wider px-6 py-2.5 rounded-full mb-1" style={{ backgroundColor: computedInvoiceColor }}>Mauzo Ankara</div>
                      <p className="text-slate-400">Hapana: <strong className="text-slate-800">{selectedSale.reference || `INV-${selectedSale.id.toUpperCase().slice(0, 8)}`}</strong></p>
                      <p className="text-slate-400">Tarehe: <span className="text-slate-700">{new Date(selectedSale.timestamp).toLocaleDateString([], { dateStyle: 'long' })}</span></p>
                      {(() => {
                        const paid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : selectedSale.total);
                        const isPaid = paid >= selectedSale.total;
                        return <span className={`inline-flex items-center gap-1 mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>● {isPaid ? 'Imelipwa' : 'Haijalipwa'}</span>;
                      })()}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-mono">Invoice To</p>
                    <p className="font-black text-slate-900 text-base">{selectedSale.customerName || 'Customer'}</p>
                    {selectedSale.customerPhone && <p className="text-xs text-slate-500 mt-1">{selectedSale.customerPhone}</p>}
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-white" style={{ backgroundColor: computedInvoiceColor }}>
                        <th className="py-3 px-4 rounded-l-xl w-10">#</th>
                        <th className="py-3 px-4 uppercase text-[10px]">Maelezo</th>
                        <th className="py-3 px-4 uppercase text-[10px] text-center">Idadi</th>
                        <th className="py-3 px-4 uppercase text-[10px] text-right">Kipimo Bei</th>
                        <th className="py-3 px-4 uppercase text-[10px] text-right rounded-r-xl">Jumla</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.items.map((item, index) => (
                        <tr key={index} className={index % 2 ? 'bg-slate-50/60' : 'bg-white'}>
                          <td className="py-3 px-4 text-slate-400 font-mono">{index + 1}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{item.productName}</td>
                          <td className="py-3 px-4 text-center text-slate-700">{formatSaleItemQuantity(item, products.find(product => product.id === item.productId))}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">{currency}{item.price.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900">{currency}{Math.round(item.price * item.qty).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex items-start justify-between gap-6">
                    {(() => {
                      const channel = findPaymentChannel(systemSettings?.paymentChannels || [], selectedSale.paymentMethod);
                      const accountNumber = channel?.accountNumber || systemSettings?.invoiceSettings?.accountNumber;
                      const accountName = systemSettings?.invoiceSettings?.accountName || channel?.name || channel?.provider;
                      return (
                        <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-100 min-w-[200px] text-xs">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Payment Details</p>
                          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            <span className="text-slate-400">Mode</span><strong className="text-right text-slate-700">{selectedSale.paymentMethod}</strong>
                            {accountNumber && <><span className="text-slate-400">Account No.</span><strong className="text-right text-slate-700 font-mono">{accountNumber}</strong></>}
                            {accountName && <><span className="text-slate-400">Account Name</span><strong className="text-right text-slate-700">{accountName}</strong></>}
                            <span className="text-slate-400">Kiasi</span><strong className="text-right text-slate-900 font-mono">{currency}{Math.round(selectedSale.total).toLocaleString()}</strong>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="w-72 space-y-2 font-mono text-xs shrink-0">
                      {(() => {
                        const subtotal = selectedSale.items.reduce((sum, item) => sum + item.price * item.qty, 0);
                        const paid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : selectedSale.total);
                        const balance = Math.max(0, selectedSale.total - paid);
                        return <>
                          <div className="flex justify-between text-slate-500"><span>Jumla Ndogo</span><strong className="text-slate-800">{currency}{Math.round(subtotal).toLocaleString()}</strong></div>
                          {(selectedSale.discount || 0) > 0 && <div className="flex justify-between text-orange-600"><span>Punguzo</span><strong>-{currency}{Math.round(selectedSale.discount || 0).toLocaleString()}</strong></div>}
                          {(selectedSale.vatStatus === 'vat' || (!selectedSale.vatStatus && (selectedSale.tax || 0) > 0)) && <div className="flex justify-between text-slate-500"><span>VAT / Tax</span><strong className="text-slate-700">{currency}{Math.round(selectedSale.tax || 0).toLocaleString()}</strong></div>}
                          {(selectedSale.deliveryCost || 0) > 0 && <div className="flex justify-between text-slate-500"><span>Delivery</span><strong className="text-slate-700">{currency}{Math.round(selectedSale.deliveryCost || 0).toLocaleString()}</strong></div>}
                          <div className="flex justify-between text-white rounded-xl px-4 py-3" style={{ backgroundColor: computedInvoiceColor }}><strong className="uppercase text-sm">Jumla</strong><strong className="text-base">{currency}{Math.round(selectedSale.total).toLocaleString()}</strong></div>
                          <div className="flex justify-between text-slate-500 px-4"><span>Due</span><strong className="text-slate-800">{currency}{Math.round(balance).toLocaleString()}</strong></div>
                        </>;
                      })()}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-5 flex items-end justify-between gap-6">
                    {(() => {
                      const responsibleStaff = systemSettings?.staffs?.find(staff =>
                        staff.name.toLowerCase() === (selectedSale.cashierName || currentUser?.name || '').toLowerCase()
                      );
                      const preparedByName = selectedSale.cashierName || currentUser?.name || '—';
                      const preparedByRole = responsibleStaff?.role || 'Sales Associate';
                      return (
                        <div className="text-left">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mb-1">Prepared by</p>
                          <p className="font-black text-slate-800 text-sm">{preparedByName}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{preparedByRole}</p>
                        </div>
                      );
                    })()}
                    <div className="text-right">
                      {(() => {
                        const responsibleStaff = systemSettings?.staffs?.find(staff =>
                          staff.name.toLowerCase() === (selectedSale.cashierName || currentUser?.name || '').toLowerCase()
                        );
                        const signature = responsibleStaff?.signatureImage || systemSettings?.invoiceSettings?.signatureImage;
                        return signature ? (
                          <div className="h-10 mb-1.5 flex justify-end items-end">
                            <img src={signature} alt="Signature" className="max-h-10 max-w-[160px] object-contain" referrerPolicy="no-referrer" />
                          </div>
                        ) : <div className="h-10 w-48 border-b border-slate-300 mb-1.5" />;
                      })()}
                      <p className="text-[10px] text-slate-400">Authorized Sahihi</p>
                    </div>
                  </div>
                  {(() => {
                    const rawTerms = systemSettings?.invoiceSettings?.termsAndConditions;
                    const terms = Array.isArray(rawTerms) ? rawTerms : rawTerms ? String(rawTerms).split('\n').filter(Boolean) : [];
                    if (!terms.length) return null;
                    return <div className="border-t border-slate-100 pt-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mb-2">Terms &amp; Conditions</p><ol className="list-decimal list-inside space-y-1">{terms.map((term: string, index: number) => <li key={index} className="text-[11px] text-slate-500">{term}</li>)}</ol></div>;
                  })()}
                  <div className="text-center border-t border-slate-100 pt-3"><p className="text-[8px] text-slate-300 font-mono">Powered by Orvix</p></div>
                </div>
              </div>
                </div>
              </div>
            </>
          ) : (
            
            /* CONDITION B: NARROW THERMAL POS SLIP RECEIPT MODE (ORIGINAL PRISTINE TICKET) */
            <div className="detail-shell relative bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm">
              
              {/* Header branding */}
              <div className="detail-header bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">Terminal Docket</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setSelectedSale(null)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable ticket details */}
              <div id="sales-receipt-pdf-template" className="detail-body p-6 space-y-4 font-mono text-xs select-text bg-white text-black">

                {/* Receipt store branding block — plain black ink, matching a real thermal printout */}
                <div className="text-center space-y-1 flex flex-col items-center">
                  {(((() => { const stores = systemSettings?.business?.registeredStores || []; const activeBranch = stores[0]; const bb = activeBranch && systemSettings?.business?.branchBranding?.[activeBranch]; return bb?.businessLogoLight || bb?.businessLogo || null; })()) || getBusinessLogo(systemSettings)) && (
                    <img
                      src={((() => { const stores = systemSettings?.business?.registeredStores || []; const activeBranch = stores[0]; const bb = activeBranch && systemSettings?.business?.branchBranding?.[activeBranch]; return bb?.businessLogoLight || bb?.businessLogo || null; })()) || getBusinessLogo(systemSettings) || undefined}
                      alt="Receipt Logo"
                      referrerPolicy="no-referrer"
                      className="max-h-12 max-w-[140px] object-contain mb-1 select-none"
                    />
                  )}
                  <h4 className="text-base font-black tracking-tight text-black">{getBusinessDisplayName(activeTenant, systemSettings)}</h4>
                  {activeTenant.city && <p className="text-[11px] text-black uppercase font-semibold">{activeTenant.city}</p>}
                  {systemSettings?.business?.businessPhone && <p className="text-[11px] text-black">Tel:{systemSettings.business.businessPhone}</p>}
                </div>

                <div className="border-t border-dashed border-slate-300" />

                <h3 className="text-center text-sm font-black uppercase tracking-wide text-black">POS Receipt</h3>

                {/* Core docket information */}
                <div className="space-y-1.5 text-[11px] text-black">
                  <div className="flex justify-between">
                    <span>Invoice No:</span>
                    <span className="font-semibold">{selectedSale.reference || `REC-${selectedSale.id.toUpperCase().slice(0, 8)}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarehe:</span>
                    <span className="font-semibold">{new Date(selectedSale.timestamp).toLocaleDateString([], { dateStyle: 'long' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wakati:</span>
                    <span className="font-semibold">{new Date(selectedSale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span className="font-semibold">{selectedSale.cashierName || currentUser?.name || 'Cashier'}</span>
                  </div>
                  {selectedSale.customerName && (
                    <div className="flex justify-between">
                      <span>Customer:</span>
                      <span className="font-semibold">{selectedSale.customerName}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-dashed border-slate-300" />

                {/* Items table */}
                <div>
                  <div className="flex text-[10px] font-black uppercase text-black pb-1.5 border-b-2 border-black">
                    <span className="w-5 shrink-0">#</span>
                    <span className="flex-1">Maelezo</span>
                    <span className="w-12 shrink-0 text-center">Qty</span>
                    <span className="w-16 shrink-0 text-right">Bei</span>
                    <span className="w-16 shrink-0 text-right">Jumla</span>
                  </div>
                  {selectedSale.items.map((item, index) => {
                    const isItemCash = item.discountType === 'cash';
                    const priceAfterDiscount = isItemCash
                      ? Math.max(0, item.price - item.discount)
                      : item.price * (1 - item.discount / 100);
                    const itemProduct = products.find(product => product.id === item.productId);
                    return (
                      <div key={index}>
                        <div className="flex items-start py-2 text-[11px] text-black">
                          <span className="w-5 shrink-0 text-slate-400">{index + 1}</span>
                          <span className="flex-1 font-semibold pr-1">{item.productName}</span>
                          <span className="w-12 shrink-0 text-center">{formatSaleItemQuantity(item, itemProduct)}</span>
                          <span className="w-16 shrink-0 text-right">{currency}{Math.round(priceAfterDiscount).toLocaleString()}</span>
                          <span className="w-16 shrink-0 text-right font-bold">{currency}{Math.round(priceAfterDiscount * item.qty).toLocaleString()}</span>
                        </div>
                        {index < selectedSale.items.length - 1 && <div className="border-t border-dashed border-slate-200" />}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-dashed border-slate-300" />

                {/* Totals */}
                {(() => {
                  const isVat = selectedSale.vatStatus === 'vat' || (selectedSale.tax > 0);
                  const taxAmt = isVat ? (selectedSale.tax || 0) : 0;
                  const delivery = selectedSale.deliveryCost || 0;
                  const taxableSub = selectedSale.total - taxAmt - delivery;
                  const discVal = selectedSale.discount || 0;
                  const hasDisc = discVal > 0;
                  const originalSub = hasDisc
                    ? (selectedSale.discountType === 'cash' ? taxableSub + discVal : taxableSub / (1 - discVal / 100))
                    : taxableSub;
                  const discAmt = originalSub - taxableSub;
                  const initialPaid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : selectedSale.total);
                  const extra = (installmentRecords[selectedSale.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
                  const totalPaidNow = Math.min(selectedSale.total, initialPaid + extra);
                  const dueRemainder = Math.max(0, selectedSale.total - totalPaidNow);
                  return (
                    <>
                      <div className="space-y-1.5 text-[11px] text-black">
                        <div className="flex justify-between">
                          <span>Jumla Ndogo</span>
                          <span className="font-semibold">{currency}{Math.round(originalSub).toLocaleString()}</span>
                        </div>
                        {hasDisc && (
                          <div className="flex justify-between">
                            <span>Punguzo</span>
                            <span className="font-semibold">-{currency}{Math.round(discAmt).toLocaleString()}</span>
                          </div>
                        )}
                        {isVat && (
                          <div className="flex justify-between">
                            <span>VAT ({Math.round(activeTenant.taxRate * 100)}%)</span>
                            <span className="font-semibold">{currency}{Math.round(taxAmt).toLocaleString()}</span>
                          </div>
                        )}
                        {delivery > 0 && (
                          <div className="flex justify-between">
                            <span>Delivery</span>
                            <span className="font-semibold">{currency}{Math.round(delivery).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t-2 border-black pt-1.5 flex justify-between text-sm font-black text-black">
                        <span>Jumla</span>
                        <span>{currency}{Math.round(selectedSale.total).toLocaleString()}</span>
                      </div>
                      <div className="border-t-2 border-black pt-1.5 flex justify-between text-[11px] text-black">
                        <span>Due</span>
                        <span className="font-semibold">{currency}{Math.round(dueRemainder).toLocaleString()}</span>
                      </div>

                      <div className="border-t border-dashed border-slate-300" />

                      {/* Payment details */}
                      <div className="space-y-1 text-[11px] text-black">
                        <p className="font-black uppercase tracking-wide">Payment Details</p>
                        <div className="flex justify-between">
                          <span>Mode</span>
                          <span className="font-semibold">{selectedSale.paymentMethod}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kiasi</span>
                          <span className="font-semibold">{currency}{Math.round(totalPaidNow).toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="border-t border-dashed border-slate-300" />

                {/* Barcode */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="flex items-end">
                    {renderReceiptBarcodeBars(selectedSale.reference || selectedSale.id)}
                  </div>
                  <p className="text-[9px] font-bold tracking-[0.2em] text-black">{receiptBarcodeDigits(selectedSale.reference || selectedSale.id)}</p>
                </div>

                {/* Footer */}
                <div className="text-center space-y-1 pt-1">
                  <p className="text-[10px] font-black text-black">Thank you for shopping with us</p>
                  <p className="text-[9px] text-slate-400">Powered by Orvix</p>
                </div>

              </div>

              {/* Print action bottom drawer */}
              <div className="detail-footer p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                {/* WhatsApp phone number */}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">+</span>
                  <input
                    type="text"
                    placeholder="WhatsApp phone (e.g. 234803...)"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-white border border-slate-300 rounded-xl text-[11px] pl-5 pr-2 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => shareSalePdf(selectedSale, whatsappPhone, 'receipt')}
                    className="min-w-0 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold font-sans text-[10px] uppercase cursor-pointer flex items-center justify-center gap-1 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>

                  <button
                    onClick={() => downloadReceiptPdf(selectedSale)}
                    className="min-w-0 h-10 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold font-sans text-[10px] uppercase cursor-pointer text-slate-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={simulatePrint}
                    className="min-w-0 h-10 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold font-sans text-[10px] uppercase cursor-pointer text-slate-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    disabled={isReceiptPrinting}
                  >
                    {isReceiptPrinting ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Wait…</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setSelectedSale(null)}
                    className="min-w-0 h-10 border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 rounded-xl font-bold font-sans text-[10px] uppercase cursor-pointer text-slate-700 transition-colors disabled:opacity-50"
                    disabled={isReceiptPrinting}
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: VIEW AND MANAGE INSTALLMENT PAYMENTS */}
      {/* ------------------------------------------------------------- */}
      {selectedSale && viewPaymentsOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800" style={{paddingBottom: `calc(${'var(--dashboard-bottom-nav-height, 60px)'} + env(safe-area-inset-bottom) + 0.5rem)`}}>
          <div className="detail-shell relative bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md font-sans">
            
            {/* Header */}
            <div className="detail-header bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 select-none">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-black tracking-tight">Payments Log Ledger</h4>
                  <p className="text-[10.5px] font-mono text-emerald-400 uppercase tracking-widest">{selectedSale.reference || `REC-${selectedSale.id.toUpperCase().slice(0, 8)}`}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedSale(null);
                  setViewPaymentsOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content list of payments history */}
            <div className="detail-body p-6 space-y-6">
              
              {/* Metric Overview cards grid */}
              {(() => {
                const totalInvoice = selectedSale.total;
                const initialPaid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : totalInvoice);
                const extraInstallments = installmentRecords[selectedSale.id] || [];

                // Reconstruct the installment history timeline step-by-step
                const steps: {
                  label: string;
                  requiredBefore: number;
                  entered: number;
                  remainingAfter: number;
                  date: string;
                  method: string;
                  isFull: boolean;
                }[] = [];

                if (initialPaid >= totalInvoice) {
                  steps.push({
                    label: 'Paid Amount',
                    requiredBefore: totalInvoice,
                    entered: initialPaid,
                    remainingAfter: 0,
                    date: selectedSale.timestamp,
                    method: selectedSale.paymentMethod,
                    isFull: true
                  });
                } else {
                  steps.push({
                    label: 'Installment #1',
                    requiredBefore: totalInvoice,
                    entered: initialPaid,
                    remainingAfter: Math.max(0, totalInvoice - initialPaid),
                    date: selectedSale.timestamp,
                    method: selectedSale.paymentMethod,
                    isFull: false
                  });
                }

                let lastRemaining = steps[steps.length - 1].remainingAfter;

                extraInstallments.forEach((inst, idx) => {
                  const reqBefore = lastRemaining;
                  const currentRemaining = Math.max(0, reqBefore - inst.amount);
                  steps.push({
                    label: `Installment #${idx + 2}`,
                    requiredBefore: reqBefore,
                    entered: inst.amount,
                    remainingAfter: currentRemaining,
                    date: inst.date,
                    method: inst.method,
                    isFull: false
                  });
                  lastRemaining = currentRemaining;
                });

                const dueRemainder = lastRemaining;
                const totalPaidNow = Math.min(totalInvoice, initialPaid + extraInstallments.reduce((sum, inst) => sum + inst.amount, 0));

                return (
                  <>
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs">
                      <div>
                        <p className="text-[9px] uppercase text-slate-400 font-bold font-sans">Total Bill</p>
                        <p className="text-sm font-black text-slate-800 mt-1">{currency}{totalInvoice.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase text-emerald-500 font-bold font-sans">Total Paid</p>
                        <p className="text-sm font-black text-emerald-700 mt-1">{currency}{totalPaidNow.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase text-rose-500 font-bold font-sans">Balance Due</p>
                        <p className={`text-sm font-black mt-1 ${dueRemainder > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {currency}{dueRemainder.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* NEW: Original Sale Audit Metadata */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700 shadow-xs">
                      <p className="text-[9.5px] uppercase font-mono font-black text-slate-500 tracking-wider">Original Sale Audit Info</p>
                      <div className="grid grid-cols-1 gap-2.5 border-t border-slate-200/60 pt-2.5 font-sans">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Initial Payment Mode:</span>
                          </span>
                          <span className="font-bold text-slate-800 bg-white border border-slate-200/80 px-2 py-0.5 rounded-lg text-[10px] uppercase">
                            {selectedSale.paymentMethod}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Sale Timestamp:</span>
                          </span>
                          <span className="font-mono text-slate-700 font-bold text-[10px]">
                            {new Date(selectedSale.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{activeTenant.businessType === 'pharmacy' ? 'Dispensed By (Pharmacist):' : 'Prepared by (Cashier):'}</span>
                          </span>
                          <span className="font-bold text-slate-800 uppercase text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                            {selectedSale.cashierName || 'Primary Teller'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline logs */}
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase font-mono font-black text-slate-400 tracking-wider">Historical Transactions Timeline</p>
                      
                      <div className="space-y-3.5 border-l-2 border-slate-100 pl-4 ml-2">
                        {steps.map((step, idx) => {
                          return (
                            <div key={idx} className="relative">
                              <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white ${step.isFull ? 'bg-emerald-500' : 'bg-indigo-550'}`} />
                              <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 shadow-xs bg-white">
                                <div className="flex justify-between items-center font-bold">
                                  <span className="text-slate-800 uppercase text-[10.5px] font-mono tracking-wider">{step.label}</span>
                                  <span className={`font-mono text-[11px] font-black ${step.isFull ? 'text-emerald-700' : 'text-indigo-705'}`}>
                                    {currency}{step.entered.toLocaleString()}
                                  </span>
                                </div>
                                {step.isFull ? (
                                  <div className="text-slate-500 text-[10px] font-sans">
                                    Paid Amount: <span className="font-mono font-bold text-slate-705">{currency}{step.entered.toLocaleString()}</span> (Fully Paid at checkout) using <span className="font-semibold uppercase text-slate-655 bg-indigo-50 px-1 py-0.5 rounded text-[9.5px] text-indigo-700">{step.method}</span>.
                                    <p className="text-[9.5px] text-slate-500 pt-1.5 font-mono">
                                      Posted on {new Date(step.date).toLocaleDateString()} using {step.method}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="text-[10.5px] space-y-1 font-sans text-slate-600">
                                    <div className="flex justify-between">
                                      <span>Amount to be paid:</span>
                                      <span className="font-mono font-bold text-slate-800">{currency}{step.requiredBefore.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-indigo-700 font-semibold">
                                      {idx === 0 ? (
                                        <span>Initial paid:</span>
                                      ) : (
                                        <span>Paid amount:</span>
                                      )}
                                      <span className="font-mono font-bold">+{currency}{step.entered.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-rose-700 border-t border-slate-200/60 pt-1 font-bold">
                                      <span>Balance due/not paid:</span>
                                      <span className="font-mono font-black">{currency}{step.remainingAfter.toLocaleString()}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 pt-0.5 italic font-mono block">
                                      Posted on {new Date(step.date).toLocaleDateString()} using {step.method}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                     {/* Interactive record payment form */}
                     {dueRemainder > 0 ? (
                       <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-3 animate-fade-in text-xs">
                         <div className="flex items-center space-x-1.5 text-emerald-800 font-bold">
                           <Coins className="w-4 h-4 text-emerald-600" />
                           <span>Record Installment Remittance (Payment-In)</span>
                         </div>
                         
                         {/* Dynamic dynamic calculations display representing example: if 1000 is due, entering 700 leaves 300 due */}
                         {(() => {
                           const currentValStr = payInInputVal !== '' ? payInInputVal : dueRemainder.toString();
                           const parsedAmt = parseFloat(currentValStr);
                           const activeInputAmt = isNaN(parsedAmt) ? 0 : parsedAmt;
                           const futureRemaining = Math.max(0, dueRemainder - activeInputAmt);
                           
                           return (
                             <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1.5 font-sans shadow-xs">
                               <div className="flex justify-between items-center text-xs">
                                 <span className="text-slate-500 font-semibold">Amount required to be paid:</span>
                                 <span className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">{currency}{dueRemainder.toLocaleString()}</span>
                               </div>
                               <div className="flex justify-between items-center text-xs text-emerald-700">
                                 <span className="font-semibold">Entered payment:</span>
                                 <span className="font-mono font-black">{currency}{activeInputAmt.toLocaleString()}</span>
                               </div>
                               <div className="flex justify-between items-center text-xs text-rose-700 border-t border-slate-100 pt-1.5 font-bold">
                                 <span>Balance due/unpaid:</span>
                                 <span className="font-mono font-black bg-rose-50 px-2 py-0.5 rounded text-[11px]">{currency}{futureRemaining.toLocaleString()}</span>
                               </div>
                             </div>
                           );
                         })()}

                         <form
                           onSubmit={(e) => {
                             e.preventDefault();
                             const currentValStr = payInInputVal !== '' ? payInInputVal : dueRemainder.toString();
                             const amt = parseFloat(currentValStr);
                             const form = e.currentTarget;
                             const channel = (form.elements.namedItem('channel') as HTMLSelectElement).value;
                              const payDateVal = (form.elements.namedItem('paymentDate') as HTMLInputElement)?.value;
                              const timestamp = payDateVal ? new Date(payDateVal).toISOString() : new Date().toISOString();
                             if (amt > 0) {
                               handleAddInstallment(selectedSale.id, Math.min(amt, dueRemainder), channel, timestamp);
                               setPayInInputVal('');
                               form.reset();
                             }
                           }}
                           className="space-y-2.5"
                         >
                           <div className="grid grid-cols-3 gap-2">
                             <div>
                               <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1">Amount</label>
                               <input 
                                 type="text" 
                                 name="amount"
                                 value={payInInputVal}
                                 onChange={(e) => {
                                   const val = e.target.value.replace(/[^0-9.]/g, '');
                                   const numVal = parseFloat(val);
                                   if (!isNaN(numVal) && numVal > dueRemainder) {
                                     setPayInInputVal(dueRemainder.toString());
                                   } else {
                                     setPayInInputVal(val);
                                   }
                                 }}
                                 required
                                 className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-550 font-mono font-bold text-xs"
                               />
                             </div>
                             <div>
                               <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1">Payment Mode</label>
                               <select 
                                 name="channel"
                                 className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans cursor-pointer focus:outline-none"
                               >
                                 <option value="Cash">Cash Channel</option>
                                 <option value="Card">Visa/Card Till</option>
                                 <option value="M-Pesa">M-Pesa Express</option>
                                 <option value="MTN MoMo">MTN MoMo API</option>
                                 <option value="Paystack">Direct Paystack</option><option value="Airtel Money">Airtel Money</option></select></div><div><label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1">Payment Date</label><input type="date" name="paymentDate" defaultValue={new Date().toISOString().split("T")[0]} required className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans cursor-pointer focus:outline-none text-slate-800" /></div></div><div className="hidden"><div><select>
                                 <option value="Airtel Money">Airtel Money</option>
                               </select>
                             </div>
                           </div>

                           <button 
                             type="submit"
                             className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider rounded-xl cursor-pointer border-none shadow-xs transition-colors"
                           >
                             add payment
                           </button>
                         </form>
                       </div>
                    ) : (
                      <div className="bg-emerald-100/40 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3 text-emerald-800 animate-slide-in text-xs">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold uppercase tracking-wider">Settled Invoice</p>
                          <p className="text-[10px] text-slate-500">No balance due.</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

            </div>

            {/* Bottom buttons */}
            <div className="detail-footer bg-slate-50 border-t border-slate-200 px-5 py-4 flex justify-end">
              <button
                onClick={() => {
                  setSelectedSale(null);
                  setViewPaymentsOpen(false);
                }}
                className="px-6 py-2 bg-slate-900 text-white text-xs font-bold uppercase rounded-xl hover:bg-slate-800 transition-colors cursor-pointer select-none"
              >
                Done Auditing
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: VIEW SELL RECORD (READ-ONLY DETAILED ARCHIVE SUMMARY) */}
      {/* ------------------------------------------------------------- */}
      {viewingSaleDetail && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm text-slate-800"
          style={{padding:'max(env(safe-area-inset-top), 12px) 12px max(env(safe-area-inset-bottom), 12px) 12px'}}>
          <div className="detail-shell relative bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-xl font-sans">
            
            {/* Header */}
            <div className="detail-header bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 select-none">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black uppercase tracking-wider">View Sale Details</h4>
                  <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest leading-none mt-0.5 truncate">
                    Ref: {getSaleReference(viewingSaleDetail)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingSaleDetail(null)}
                className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer bg-transparent border-none shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read-only ribbon */}
            <div className="detail-header bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center justify-between text-[11px] font-bold text-slate-600 select-none">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Read-Only Sale Record</span>
              </div>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px] uppercase font-mono tracking-wider font-extrabold shrink-0 ml-2">Archived</span>
            </div>

            {/* Body — overflow-x-hidden prevents horizontal bleed */}
            <div className="detail-body px-4 sm:px-6 py-4 space-y-4">
              
              {/* Metadata key values */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                <div className="space-y-1 min-w-0">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Date & Time</span>
                  <span className="font-semibold text-slate-800 text-[11px] break-words">
                    {formatShortDateTime(viewingSaleDetail.timestamp)}
                  </span>
                </div>
                <div className="space-y-1 min-w-0">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Payment Method</span>
                  <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-full font-bold text-[10px] mt-0.5">
                    {viewingSaleDetail.paymentMethod}
                  </span>
                </div>
                <div className="space-y-1 min-w-0">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Cashier</span>
                  <span className="font-bold text-slate-700 text-[11px] break-words">
                    {viewingSaleDetail.cashierName || viewingSaleDetail.staffName || 'System Cashier'}
                  </span>
                </div>
                <div className="space-y-1 min-w-0">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Customer</span>
                  <span className="font-extrabold text-indigo-950 text-[11px] break-words">
                    {viewingSaleDetail.customerName || 'Customer'}
                  </span>
                </div>
              </div>

              {/* Product items list */}
              <div className="space-y-2 text-left">
                <h5 className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">Items Purchased</h5>
                
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {viewingSaleDetail.items.map((item, index) => {
                    const matchingProduct = products?.find(
                      p => p.id === item.productId || p.barcode === item.productId
                    );

                    return (
                      <div key={index} className="flex items-center gap-3 p-3">
                        {/* Thumbnail */}
                        <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                          {matchingProduct?.image ? (
                            <CachedImage src={matchingProduct.image} alt={item.productName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] font-mono font-bold text-slate-400">
                              {item.productName.slice(0, 3).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-[12px] truncate">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {formatSaleItemQuantity(item, matchingProduct)} × {currency}{item.price.toLocaleString()}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-[12px] text-slate-900">
                            {currency}{(item.price * item.qty).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Balance tally */}
              <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
                {(() => {
                  const itemsSubtotal = viewingSaleDetail.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
                  const discountVal = viewingSaleDetail.discount !== undefined ? viewingSaleDetail.discount : 0;
                  const discountType = viewingSaleDetail.discountType || 'percent';
                  const computedDiscountAmount = discountType === 'percent' ? itemsSubtotal * (discountVal / 100) : discountVal;
                  const taxVal = viewingSaleDetail.tax || 0;
                  const isVatSale = viewingSaleDetail.vatStatus === 'vat' || (!viewingSaleDetail.vatStatus && taxVal > 0);
                  const deliveryVal = viewingSaleDetail.deliveryCost || 0;
                  const grandTotalVal = viewingSaleDetail.total;
                  const isCredit = viewingSaleDetail.paymentMethod === 'Credit';
                  const initialPaid = viewingSaleDetail.amountPaid !== undefined ? viewingSaleDetail.amountPaid : (isCredit ? 0 : grandTotalVal);
                  const installments = installmentRecords[viewingSaleDetail.id] || [];
                  const extraPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);
                  const totalPaid = Math.min(grandTotalVal, initialPaid + extraPaid);
                  const remainingDue = Math.max(0, grandTotalVal - totalPaid);

                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-slate-600 font-medium">
                        <span>Sub-Total</span>
                        <span className="font-mono font-semibold">{currency}{itemsSubtotal.toLocaleString()}</span>
                      </div>
                      {computedDiscountAmount > 0 && (
                        <div className="flex justify-between items-center text-rose-600 font-bold">
                          <span>Discount</span>
                          <span className="font-mono">-{currency}{computedDiscountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {isVatSale && (
                        <div className="flex justify-between items-center text-slate-500 font-medium">
                          <span>Tax / VAT</span>
                          <span className="font-mono">+{currency}{taxVal.toLocaleString()}</span>
                        </div>
                      )}
                      {deliveryVal > 0 && (
                        <div className="flex justify-between items-center text-slate-500 font-medium">
                          <span>Delivery</span>
                          <span className="font-mono">+{currency}{deliveryVal.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                        <span>Grand Total</span>
                        <span className="font-mono text-emerald-700">{currency}{grandTotalVal.toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 bg-slate-50 px-3.5 py-3 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Paid</span>
                          <span className="font-mono font-black text-emerald-700 text-xs">{currency}{totalPaid.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Balance Due</span>
                          <span className="font-mono font-black text-rose-600 text-xs">{currency}{remainingDue.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Footer */}
            <div className="detail-footer bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex justify-end">
              <button
                onClick={() => setViewingSaleDetail(null)}
                className="px-6 py-2.5 bg-slate-900 text-white text-[11px] tracking-wider uppercase font-extrabold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer select-none border-none"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: EDIT TRANSACTION TRANSACTION (CASHIER ADMIN EDITS) */}
      {/* ------------------------------------------------------------- */}
      {editingSale && editFormFields && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm text-slate-800"
          style={{padding:'calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 12px) 12px'}}>
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-sans" style={{maxHeight:'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))'}}>
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
              <div className="flex items-center space-x-2 min-w-0">
                <Edit className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-sm font-black tracking-tight">Edit Sale Record</h4>
                  <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest leading-none truncate">ID: {editingSale.reference || editingSale.id.toUpperCase()}</p>
                </div>
              </div>
              <button 
                onClick={() => { if (isSavingEdit) return; setEditingSale(null); setEditFormFields(null); setEditCartEmptyWarning(null); setEditSaveError(null); }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer bg-transparent border-none shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Body */}
            <div className="px-4 sm:px-6 py-4 overflow-y-auto overflow-x-hidden flex-1 space-y-5">
              
              {/* Customer Info */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
                <p className="text-[10px] uppercase font-mono font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                  <User className="w-3 h-3 text-slate-400" /> Customer Info
                </p>
                <div className="grid gap-3 text-xs" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <div>
                    <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1 flex items-center gap-1"><User className="w-2.5 h-2.5" /> Client Name</label>
                    <input
                      type="text"
                      value={editFormFields.customerName}
                      onChange={(e) => setEditFormFields({ ...editFormFields, customerName: e.target.value })}
                      placeholder="Customer"
                      className="w-full bg-slate-50 border border-slate-240 rounded-xl px-3 py-2 text-slate-800 text-xs font-semibold focus:outline-none focus:border-slate-800 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> Client Phone</label>
                    <input
                      type="text"
                      value={editFormFields.customerPhone}
                      onChange={(e) => setEditFormFields({ ...editFormFields, customerPhone: e.target.value })}
                      placeholder="Phone number"
                      className="w-full bg-slate-50 border border-slate-240 rounded-xl px-3 py-2 text-slate-800 text-xs font-semibold focus:outline-none focus:border-slate-800 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
                <p className="text-[10px] uppercase font-mono font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-400" /> Transaction Details
                </p>
                <div className="grid gap-3 text-xs" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <div>
                    <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> Sale Date</label>
                    <input
                      type="date"
                      value={editFormFields.saleDate}
                      onChange={(e) => setEditFormFields({ ...editFormFields, saleDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-240 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono font-bold focus:outline-none focus:border-slate-800 focus:bg-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1 flex items-center gap-1"><CreditCard className="w-2.5 h-2.5" /> Payment Method</label>
                    <select
                      value={editFormFields.paymentMethod}
                      onChange={(e: any) => setEditFormFields({ ...editFormFields, paymentMethod: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-240 rounded-xl px-2.5 py-2 text-xs font-bold font-sans cursor-pointer focus:outline-none focus:border-slate-800 focus:bg-white"
                    >
                      {editPaymentMethods.map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-mono text-slate-500 font-bold mb-1 flex items-center gap-1"><Coins className="w-2.5 h-2.5" /> Adjust Amount Paid Initially</label>
                  <input
                    type="number"
                    value={editFormFields.amountPaid}
                    onChange={(e) => setEditFormFields({ ...editFormFields, amountPaid: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-240 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              {/* Editable items list checklist */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-mono font-black text-slate-400 tracking-wider">Update Transaction Cart Items</p>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-150">
                  {editFormFields.items.map((item, index) => {
                    const isItemCash = item.discountType === 'cash';
                    const lineTotal = isItemCash
                      ? Math.max(0, item.price - item.discount) * item.qty
                      : item.price * (1 - item.discount / 100) * item.qty;
                    return (
                      <div key={index} className="p-3 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4 text-xs">
                        <div className="space-y-0.5 max-w-[50%]">
                          <p className="font-bold text-slate-800 truncate">{item.productName}</p>
                          <p className="text-[10px] font-mono text-slate-500">
                            Unit Price: {currency}{item.price.toLocaleString()}
                          </p>
                        </div>

                        {/* Quantity adjusts */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const items = [...editFormFields.items];
                              if (items[index].qty > 1) {
                                items[index] = { ...items[index], qty: items[index].qty - 1 };
                                setEditFormFields({ ...editFormFields, items });
                              }
                            }}
                            className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 cursor-pointer text-center font-bold font-sans text-xs flex items-center justify-center select-none"
                          >
                            -
                          </button>
                          
                          <span className="font-bold text-slate-800 w-6 text-center">{item.qty}</span>
                          
                          <button
                            type="button"
                            onClick={() => {
                              const items = [...editFormFields.items];
                              items[index] = { ...items[index], qty: items[index].qty + 1 };
                              setEditFormFields({ ...editFormFields, items });
                            }}
                            className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 cursor-pointer text-center font-bold font-sans text-xs flex items-center justify-center select-none"
                          >
                            +
                          </button>
                        </div>

                        {/* Sum and delete trigger */}
                        <div className="flex items-center space-x-3 text-right">
                          <span className="font-mono font-bold text-slate-900 leading-none">
                            {currency}{Math.round(lineTotal).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (editFormFields.items.length <= 1) {
                                setEditCartEmptyWarning('Cart cannot be empty. A sale must have at least one item.');
                                window.setTimeout(() => setEditCartEmptyWarning(null), 3500);
                                return;
                              }
                              setEditCartEmptyWarning(null);
                              const items = editFormFields.items.filter((_, idx) => idx !== index);
                              setEditFormFields({ ...editFormFields, items });
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-800 rounded-lg transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {editFormFields.items.length === 0 && (
                    <div className="p-4 text-center text-slate-400 italic">
                      Zero items in edit basket. Add products at cashier till first.
                    </div>
                  )}
                </div>
                {editCartEmptyWarning && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 text-[11px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{editCartEmptyWarning}</span>
                  </div>
                )}
                {editSaveError && (
                  <div role="alert" className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 text-[11px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{editSaveError}</span>
                  </div>
                )}
              </div>

              {/* Math preview */}
              {(() => {
                const subAmt = editFormFields.items.reduce((sum, item) => {
                  const isItemCash = item.discountType === 'cash';
                  const priceAfterDiscount = isItemCash
                    ? Math.max(0, item.price - item.discount)
                    : item.price * (1 - item.discount / 100);
                  return sum + (priceAfterDiscount * item.qty);
                }, 0);
                // Strict conditional tax: only recompute/show VAT if this sale was
                // originally completed WITH tax. Never inject tax into a sale that
                // was completed tax-free.
                const originalIsVat = editingSale.vatStatus === 'vat' || (!editingSale.vatStatus && (editingSale.tax || 0) > 0);
                const taxAmt = originalIsVat ? Math.round(subAmt * activeTenant.taxRate) : 0;
                const totalAmt = subAmt + taxAmt;
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-600 flex justify-between">
                    {originalIsVat && (
                      <div>
                        <p className="text-[9px] uppercase font-sans text-slate-405 font-bold mb-0.5">VAT TAXES ESTIMATED ({activeTenant.taxRate * 100}%)</p>
                        <p className="font-bold text-slate-700">{currency}{taxAmt.toLocaleString()}</p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-[9px] uppercase font-sans text-slate-405 font-bold mb-0.5">NEW ESTIMATED TOTAL BILL</p>
                      <p className="text-sm font-black text-emerald-700">{currency}{totalAmt.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Save Buttons Drawer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex shrink-0 justify-end items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isSavingEdit) return;
                  setEditingSale(null);
                  setEditFormFields(null);
                  setEditCartEmptyWarning(null);
                  setEditSaveError(null);
                }}
                disabled={isSavingEdit}
                className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs uppercase select-none"
              >
                Cancel Changes
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!editingSale || !editFormFields || !onUpdateSales) return;
                  if (isSavingEdit) return;
                  if (editFormFields.items.length === 0) {
                    setEditCartEmptyWarning('Cart cannot be empty. A sale must have at least one item.');
                    window.setTimeout(() => setEditCartEmptyWarning(null), 3500);
                    return;
                  }
                  const itemSubtotal = editFormFields.items.reduce((sum, item) => {
                    const isItemCash = item.discountType === 'cash';
                    const priceAfterDiscount = isItemCash
                      ? Math.max(0, item.price - item.discount)
                      : item.price * (1 - item.discount / 100);
                    return sum + (priceAfterDiscount * item.qty);
                  }, 0);
                  // Strict conditional tax: preserve the sale's original vat/non-vat
                  // status. A sale completed without tax must never have tax injected
                  // just because it was edited; a sale completed with tax keeps being
                  // recalculated from its (possibly-edited) items at the tenant rate.
                  const originalIsVat = editingSale.vatStatus === 'vat' || (!editingSale.vatStatus && (editingSale.tax || 0) > 0);
                  const calculatedTax = originalIsVat ? Math.round(itemSubtotal * activeTenant.taxRate) : 0;
                  const calculatedTotal = itemSubtotal + calculatedTax;

                  // Sale Date: combine the (possibly-edited) calendar date with the
                  // sale's original time-of-day so only the date actually changes.
                  const updatedTimestamp = (() => {
                    if (!editFormFields.saleDate) return editingSale.timestamp;
                    const original = editingSale.timestamp ? new Date(editingSale.timestamp) : new Date();
                    const hh = String(isNaN(original.getTime()) ? 0 : original.getHours()).padStart(2, '0');
                    const mm = String(isNaN(original.getTime()) ? 0 : original.getMinutes()).padStart(2, '0');
                    const ss = String(isNaN(original.getTime()) ? 0 : original.getSeconds()).padStart(2, '0');
                    const target = new Date(`${editFormFields.saleDate}T${hh}:${mm}:${ss}.000Z`);
                    return isNaN(target.getTime()) ? editingSale.timestamp : target.toISOString();
                  })();

                  const updatedSale: Sale = {
                    ...editingSale,
                    customerName: editFormFields.customerName.trim() || undefined,
                    customerPhone: editFormFields.customerPhone.trim() || undefined,
                    paymentMethod: editFormFields.paymentMethod as Sale['paymentMethod'],
                    items: editFormFields.items,
                    tax: calculatedTax,
                    total: calculatedTotal,
                    amountPaid: editFormFields.amountPaid,
                    timestamp: updatedTimestamp,
                    vatStatus: originalIsVat ? 'vat' : editingSale.vatStatus,
                  };

                  const newSales = sales.map(s => s.id === editingSale.id ? updatedSale : s);
                  setIsSavingEdit(true);
                  setEditSaveError(null);
                  try {
                    const saved = await onUpdateSales(newSales);
                    if (!saved) {
                      setEditSaveError('Sale was not saved. Your changes remain open; please check the connection and try again.');
                      return;
                    }
                    setEditingSale(null);
                    setEditFormFields(null);
                    setEditCartEmptyWarning(null);
                  } catch {
                    setEditSaveError('Sale was not saved. Nothing was changed in the database.');
                  } finally {
                    setIsSavingEdit(false);
                  }
                }}
                disabled={isSavingEdit}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl border-none transition-colors text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-sm select-none"
              >
                <Check className="w-4 h-4 text-white" />
                <span>{isSavingEdit ? 'Saving…' : 'Save Changes'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: CONFIRM DELETE SALE (TICKET VOIDING) */}
      {/* ------------------------------------------------------------- */}
      {saleToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800" style={{paddingBottom: `calc(${'var(--dashboard-bottom-nav-height, 60px)'} + env(safe-area-inset-bottom))`}}>
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col font-sans">
            
            {/* Header */}
            <div className="bg-rose-950 text-white px-6 py-4 flex items-center justify-between border-b border-rose-900 shrink-0 select-none border-b-none p-4">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-rose-400 animate-bounce" />
                <div>
                  <h4 className="text-sm font-black tracking-tight">Cancel Receipt</h4>
                  <span className="text-[10px] font-mono text-rose-450 uppercase tracking-widest block font-bold leading-none mt-1">Confirm before continuing</span>
                </div>
              </div>
              <button 
                onClick={closeDeleteSaleConfirmation}
                disabled={isDeletingSale}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-left">
              <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-start space-x-3">
                <span className="text-xl">⚠️</span>
                <div className="space-y-1 font-sans">
                  <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                    You are about to cancel receipt <strong className="font-bold text-rose-700 font-mono">{saleToDelete.reference || saleToDelete.id.toUpperCase()}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    The sale will be reversed safely, including its stock and payment records.
                  </p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-2.5 text-xs text-slate-600 font-sans">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-800">{saleToDelete.customerName || 'Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Method / Date:</span>
                  <span className="font-bold text-slate-800">{saleToDelete.paymentMethod} ({new Date(saleToDelete.timestamp).toLocaleDateString()})</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200 font-bold">
                  <span className="text-slate-800">Sale Total Amount:</span>
                  <span className="text-rose-600 font-mono">{activeTenant.currency} {saleToDelete.total.toLocaleString()}</span>
                </div>
              </div>
              {deleteSaleError && (
                <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-relaxed text-rose-700">
                  {deleteSaleError}
                </div>
              )}
            </div>

            {/* Actions Drawer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={closeDeleteSaleConfirmation}
                disabled={isDeletingSale}
                className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer text-xs uppercase select-none"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  if (isDeletingSale) return;
                  setIsDeletingSale(true);
                  setDeleteSaleError(null);
                  try {
                    if (onDeleteSale) {
                      const deleted = await onDeleteSale(saleToDelete);
                      if (!deleted) {
                        setDeleteSaleError('Receipt could not be cancelled. Check your branch access and permissions, then try again.');
                        return;
                      }
                    } else if (onUpdateSales) {
                      const nextSales = sales.filter(s => s.id !== saleToDelete.id);
                      onUpdateSales(nextSales);
                    }
                    setInstallmentRecords(previous => {
                      const next = { ...previous };
                      delete next[saleToDelete.id];
                      return next;
                    });
                    setSaleToDelete(null);
                  } catch {
                    setDeleteSaleError('Receipt could not be cancelled safely. Nothing was changed.');
                  } finally {
                    setIsDeletingSale(false);
                  }
                }}
                disabled={isDeletingSale}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 text-white font-black rounded-xl border-none transition-all text-xs uppercase flex items-center space-x-1.5 cursor-pointer shadow-md select-none"
              >
                {isDeletingSale ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Trash2 className="w-4 h-4 text-white" />}
                <span>{isDeletingSale ? 'Cancelling…' : 'Confirm Cancel'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DIALOG: NEW DOCUMENT CREATOR MODAL */}
      {showNewDocModal && createPortal((
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-white dark:bg-slate-900 w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{maxHeight:'94dvh'}}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div>
                <h3 className="text-[15px] font-black text-slate-900 dark:text-white">New Document</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Quotation or Proforma Invoice</p>
              </div>
              <button type="button" onClick={() => setShowNewDocModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer border-none transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">

              {/* Doc type picker — single row, badge + label */}
              <div className="flex gap-2">
                {(['price quote', 'proforma invoice'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setNewDocType(t)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border transition-all ${
                      newDocType === t
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[8px] font-black ${newDocType === t ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      {t === 'price quote' ? 'QUO' : 'PFI'}
                    </div>
                    <span className="text-[13px] font-bold leading-tight">{getDocumentLabel(t)}</span>
                  </button>
                ))}
              </div>

              {/* Client details */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Details</p>
                <div className="grid grid-cols-[minmax(0,1fr)_120px] sm:grid-cols-[minmax(0,1.1fr)_150px_minmax(0,1.5fr)] gap-2">
                  <div className="min-w-0">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Client Name</label>
                    <input type="text" placeholder="e.g. Lipa Traders Ltd" value={newDocCustomerName}
                      onChange={e => setNewDocCustomerName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20" />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Phone</label>
                    <input type="text" placeholder="+255 7XX…" value={newDocCustomerPhone}
                      onChange={e => setNewDocCustomerPhone(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Client Address</label>
                  <textarea placeholder="e.g. P.O. Box 1234, Kariakoo, Dar es Salaam, Tanzania" value={newDocCustomerAddress}
                    onChange={e => setNewDocCustomerAddress(e.target.value)}
                    rows={1}
                    className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-none leading-relaxed" />
                  </div>
                </div>
              </div>

              {/* Date + payment + delivery */}
              <div className="space-y-2">
                <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-[0.12em]">Settings</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Date</label>
                    <input type="date" value={newDocDate} onChange={e => setNewDocDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Delivery ({currency})</label>
                    <input type="number" min="0" placeholder="0" value={newDocDeliveryCost || ''}
                      onChange={e => setNewDocDeliveryCost(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" id="newDocHasVatCheckbox" checked={newDocHasVat}
                    onChange={e => setNewDocHasVat(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0" />
                  <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">Include VAT ({Math.round(newDocTaxRate * 100)}%)</span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">· Applied after discount</span>
                </label>
              </div>

              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">Payment Details</p>
                  <span className="text-[9px] text-indigo-400">Amount updates automatically</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="min-w-0">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Payment Mode</label>
                    <select value={newDocPaymentMethod} onChange={e => setNewDocPaymentMethod(e.target.value)}
                      className="w-full min-h-[42px] bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 rounded-xl px-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer">
                      {documentPaymentMethods.map(modeName => (
                        <option key={modeName} value={modeName}>{modeName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Account Number</label>
                    <input type="text" value={newDocPaymentAccountNumber}
                      onChange={e => setNewDocPaymentAccountNumber(e.target.value)} placeholder="Account / Till number"
                      className="w-full min-h-[42px] bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 rounded-xl px-3 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono" />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Account Name</label>
                    <input type="text" value={newDocPaymentAccountName}
                      onChange={e => setNewDocPaymentAccountName(e.target.value)} placeholder="Account holder name"
                      className="w-full min-h-[42px] bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 rounded-xl px-3 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Amount ({currency})</label>
                    <input type="text" readOnly value={newDocGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      className="w-full min-h-[42px] bg-indigo-100/70 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 text-xs font-black text-indigo-800 dark:text-indigo-200 font-mono cursor-default" />
                  </div>
                </div>
              </div>

              {canUseCrossBranchDocuments && (
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/20 p-3.5 space-y-3">
                  <div>
                    <p className="text-xs font-black text-indigo-900 dark:text-indigo-200">Tanzanite multi-branch document</p>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400">The customer sees one document. Branch sources remain internal.</p>
                  </div>
                  {crossBranchSourcesLoading ? (
                    <p className="text-xs text-indigo-600">Loading branch products…</p>
                  ) : crossBranchSourcesError ? (
                    <p className="text-xs font-semibold text-rose-600">{crossBranchSourcesError}</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Document branding branch</label>
                        <select value={newDocIssuingBranchId} onChange={e => setNewDocIssuingBranchId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                          {(crossBranchSources?.branches || []).map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.businessName || branch.branchName}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Product source branch</label>
                        <select value={docWizardSourceBranchId}
                          onChange={e => {
                            setDocWizardSourceBranchId(e.target.value);
                            setDocWizardSelectedProductId('');
                            setDocWizardProductSearchQuery('');
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                          {(crossBranchSources?.branches || []).map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Product search */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add Products</p>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 space-y-2 border border-slate-200 dark:border-slate-700">
                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="Search by name or scan barcode…"
                      value={docWizardProductSearchQuery}
                      onChange={e => setDocWizardProductSearchQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const query = docWizardProductSearchQuery.toLowerCase().trim();
                          const matches = documentPickerProducts.filter(p =>
                            (p.barcode && p.barcode.toLowerCase() === query) ||
                            (p.sku && p.sku.toLowerCase() === query) ||
                            (p.name && p.name.toLowerCase().includes(query))
                          );
                          if (matches.length === 1) {
                            setDocWizardSelectedProductId(matches[0].id);
                            setDocWizardProductSearchQuery(matches[0].name);
                          }
                          e.preventDefault();
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500" />
                    {docWizardProductSearchQuery && (
                      <button type="button" onClick={() => { setDocWizardProductSearchQuery(''); setDocWizardSelectedProductId(''); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer text-xs font-bold">✕</button>
                    )}
                  </div>

                  {/* Product results / selected chip */}
                  {(() => {
                    const query = docWizardProductSearchQuery.toLowerCase().trim();
                    const filtered = documentPickerProducts.filter(p => {
                      if (!query) return true;
                      return (p.name && p.name.toLowerCase().includes(query)) ||
                        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
                        (p.sku && p.sku.toLowerCase().includes(query));
                    });
                    const selected = documentPickerProducts.find(p => p.id === docWizardSelectedProductId);
                    const selectedSource = crossBranchSources?.products.find(product =>
                      product.branchId === docWizardSourceBranchId && product.productId === selected?.id
                    );
                    if (selected && (!query || selected.name.toLowerCase().includes(query) || (selected.barcode || '').includes(query))) {
                      return (
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-indigo-800 dark:text-indigo-300 truncate">{selected.name}</p>
                            <p className="text-[10px] text-indigo-500">{currency}{(selectedSource?.sellingPrice ?? selected.sellingPrice).toLocaleString()} · Stock: {selectedSource?.quantity ?? selected.shopStockQty ?? selected.stockQty ?? 0}</p>
                          </div>
                          <button type="button" onClick={() => { setDocWizardSelectedProductId(''); setDocWizardProductSearchQuery(''); }}
                            className="text-indigo-300 hover:text-indigo-600 ml-2 shrink-0 cursor-pointer text-sm font-bold border-none bg-transparent">✕</button>
                        </div>
                      );
                    }
                    if (!query) return null;
                    return (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-44 overflow-y-auto shadow-md">
                        {filtered.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-slate-400 text-center">No products found</p>
                        ) : filtered.slice(0, 20).map(p => {
                          const source = crossBranchSources?.products.find(product =>
                            product.branchId === docWizardSourceBranchId && product.productId === p.id
                          );
                          return (
                          <button key={p.id} type="button"
                            onClick={() => { setDocWizardSelectedProductId(p.id); setDocWizardProductSearchQuery(p.name); }}
                            className={`w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer transition-colors ${docWizardSelectedProductId === p.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{currency}{(source?.sellingPrice ?? p.sellingPrice).toLocaleString()} · Stock: {source?.quantity ?? p.shopStockQty ?? p.stockQty ?? 0}</p>
                          </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Quantity + Add */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Qty</label>
                      <input type="number" min="1" value={docWizardSelectedQty}
                        onChange={e => setDocWizardSelectedQty(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono" />
                    </div>
                    <button type="button"
                      onClick={() => {
                        if (!docWizardSelectedProductId) return;
                        const found = documentPickerProducts.find(p => p.id === docWizardSelectedProductId);
                        if (!found) return;
                        const source = crossBranchSources?.products.find(product =>
                          product.branchId === docWizardSourceBranchId && product.productId === found.id
                        );
                        const sourceBranch = crossBranchSources?.branches.find(branch => branch.id === docWizardSourceBranchId);
                        const existingIdx = newDocItems.findIndex(x =>
                          x.productId === found.id && x.sourceBranchId === (canUseCrossBranchDocuments ? docWizardSourceBranchId : undefined)
                        );
                        if (existingIdx >= 0) {
                          setNewDocItems(prev => prev.map((item, index) => index === existingIdx
                            ? { ...item, qty: toNumber(item.qty) + docWizardSelectedQty }
                            : item));
                        } else {
                          setNewDocItems(prev => [...prev, {
                            productId: found.id, productName: found.name,
                            qty: docWizardSelectedQty, price: source?.sellingPrice ?? found.sellingPrice,
                            sourceBranchId: canUseCrossBranchDocuments ? docWizardSourceBranchId : undefined,
                            sourceBranchName: canUseCrossBranchDocuments ? sourceBranch?.branchName : undefined,
                            discount: 0, discountType: 'percent' as const
                          }]);
                        }
                        setDocWizardSelectedProductId('');
                        setDocWizardSelectedQty(1);
                        setDocWizardProductSearchQuery('');
                      }}
                      disabled={!docWizardSelectedProductId}
                      className="shrink-0 h-[42px] px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors whitespace-nowrap">
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Items list */}
              {newDocItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items ({newDocItems.length})</p>
                  <div className="space-y-1.5">
                    {newDocItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.qty} × {currency}{item.price}</p>
                          {item.sourceBranchName && (
                            <p className="text-[9px] text-indigo-500 font-semibold mt-0.5">Internal source: {item.sourceBranchName}</p>
                          )}
                        </div>
                        <p className="text-[14px] font-black text-slate-800 dark:text-slate-100 font-mono shrink-0">
                          {currency}{Math.round(item.qty * item.price).toLocaleString()}
                        </p>
                        <button type="button" onClick={() => setNewDocItems(prev => prev.filter((_, i) => i !== idx))}
                          className="w-7 h-7 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-100 border-none cursor-pointer shrink-0 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {newDocItems.length === 0 && (
                <div className="py-5 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-slate-400 text-sm">No items added yet</p>
                  <p className="text-slate-300 text-xs mt-1">Search and add products above</p>
                </div>
              )}

              {newDocItems.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">Order Discount</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">One discount for all products.</p>
                  </div>
                  <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                    <select value={newDocDiscountType}
                      onChange={e => setNewDocDiscountType(e.target.value as 'percent' | 'cash')}
                      className="min-h-11 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl px-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500">
                      <option value="percent">Percent %</option>
                      <option value="cash">Amount</option>
                    </select>
                    <input data-testid="document-order-discount" type="number" min="0"
                      max={newDocDiscountType === 'percent' ? 100 : newDocSubtotal}
                      inputMode="decimal" placeholder="0" value={newDocDiscountValue || ''}
                      onChange={e => setNewDocDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                      className="min-h-11 w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl px-3 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono" />
                  </div>
                </div>
              )}

              {/* Totals */}
              {newDocItems.length > 0 && (
                  <div key={`${newDocItems.length}-${newDocSubtotal}-${newDocDiscountAmount}-${newDocTaxAmount}-${newDocDeliveryCost}`} className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {[
                      ['Subtotal', `${currency}${newDocSubtotal.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, false],
                      ...(newDocDiscountAmount > 0 ? [[`Order Discount${newDocDiscountType === 'percent' ? ` (${cappedDiscountValue}%)` : ''}`, `-${currency}${newDocDiscountAmount.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, false]] : []),
                      ...(newDocHasVat ? [[`VAT ${Math.round(newDocTaxRate * 100)}%`, `+${currency}${newDocTaxAmount.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, false]] : []),
                      ...(newDocDeliveryCost > 0 ? [['Delivery', `+${currency}${newDocDeliveryCost.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, false]] : []),
                      ['Grand Total', `${currency}${newDocGrandTotal.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, true],
                    ].map(([label, value, bold], i) => (
                      <div key={i} className={`flex justify-between items-center px-4 py-2.5 ${i > 0 ? 'border-t border-slate-200 dark:border-slate-700' : ''} ${bold ? 'bg-white dark:bg-slate-900' : ''}`}>
                        <span className={`text-sm ${bold ? 'font-black text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>{label as string}</span>
                        <span className={`font-mono ${bold ? 'text-base font-black text-indigo-700 dark:text-indigo-400' : 'text-sm font-bold text-slate-700 dark:text-slate-300'}`}>{value as string}</span>
                      </div>
                    ))}
                  </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
              <button type="button" onClick={() => setShowNewDocModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button type="button"
                disabled={newDocItems.length === 0 || documentMutationPending || (canUseCrossBranchDocuments && (!newDocIssuingBranchId || crossBranchSourcesLoading || !!crossBranchSourcesError))}
                onClick={() => void handleCreateCommercialDocument()}
                className="flex-[2] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-black text-sm cursor-pointer transition-colors border-none">
                {documentMutationPending ? 'Saving…' : `Create ${getDocumentLabel(newDocType)}`}
              </button>
            </div>

          </div>
        </div>
      ), document.body)}

      {/* DIALOG: VIEW & PRINT A4 COMMERCIAL DOCUMENT LAYOUT */}
      {viewingDocument && (() => {
        const totals = getDocumentTotals(viewingDocument);
        const invoiceFooter = getInvoiceFooter(viewingDocument);
        const documentBranding = getDocumentBranding(viewingDocument);

        const activeStaff = systemSettings?.staffs?.find(
          s => s.name.toLowerCase() === (currentUser?.name || '').toLowerCase()
        );
        const docTypeLabel = getDocumentLabel(viewingDocument.type);

        return (
          <div className="fixed inset-0 z-[200] flex flex-col bg-[#404040] font-sans print:bg-white"
            style={{paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'}}>

            {/* ── WYSIWYG TOOLBAR ── shrink-0 ───────────────────────────────── */}
            <div className="shrink-0 bg-[#2c2c2c] border-b border-[#1a1a1a] px-3 py-2 flex items-center justify-between gap-2 print:hidden select-none">

              {/* Left: back + doc title */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => { setViewingDocument(null); setDocZoom(0.65); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <p className="text-white text-xs font-black truncate leading-tight">{docTypeLabel} — {viewingDocument.documentNumber}</p>
                  <p className="text-white/40 text-[10px] font-mono truncate">{viewingDocument.customerName || 'Customer'} · {new Date(viewingDocument.timestamp).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Centre: zoom controls */}
              <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-xl px-2 py-1">
                <button
                  type="button"
                  onClick={() => setDocZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDocZoom(1.0)}
                  className="text-white/70 hover:text-white text-xs font-mono font-bold w-12 text-center cursor-pointer"
                  title="Reset zoom"
                >
                  {Math.round(docZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setDocZoom(z => Math.min(2.0, +(z + 0.1).toFixed(1)))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Close */}
                <button
                  type="button"
                  onClick={() => { setViewingDocument(null); setDocZoom(0.65); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/70 transition-colors cursor-pointer text-white"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── PDF SHARE STATUS TOAST ───────────────────────────────────── */}
            {pdfShareStatus && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[90] bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg border border-slate-700 print:hidden whitespace-nowrap">
                {pdfShareStatus}
              </div>
            )}

            {/* ── BOTTOM ACTION BAR — Record as Sale / Send / Download / Close, one row, all screen sizes ── */}
            <div className="shrink-0 bg-[#1e1e1e] border-t border-[#2a2a2a] px-3 py-2 flex items-center justify-center gap-2 print:hidden">
              {viewingDocument.status === 'pending' && !isMixedBranchDocument(viewingDocument) && (
                <button
                  type="button"
                  onClick={() => sendDocumentToSales(viewingDocument)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Record as Sale</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (viewingDocument.customerPhone?.trim()) {
                    sharePdfDocument(viewingDocument, viewingDocument.customerPhone);
                  } else {
                    setDocumentSendOpen(prev => !prev);
                  }
                }}
                title="Send via WhatsApp"
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /><span>Send</span>
              </button>
              <button
                type="button"
                onClick={() => downloadPdfDocument(viewingDocument)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors"
              >
                <Download className="w-3.5 h-3.5" /><span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => { setViewingDocument(null); setDocZoom(0.65); }}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white/10 hover:bg-red-500/60 text-white text-[11px] font-bold transition-colors"
              >
                <X className="w-3.5 h-3.5" /><span>Close</span>
              </button>
            </div>

            {/* ── A4 CANVAS ───────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto print:overflow-visible print:bg-white" style={{background: '#404040'}}>
              {/* Page ruler hint */}
              <div className="print:hidden text-center py-2">
                <span className="text-white/20 text-[10px] font-mono select-none">A4 · 210mm × 297mm · {viewingDocument.documentNumber}</span>
              </div>

              {/* Zoomed A4 page — full A4 on tablet/mobile, no cropping; horizontal scroll when narrower than the page */}
              <div className="flex justify-start md:justify-center px-2 md:px-0 pb-16 print:pb-0 print:block">
                <div
                  id="sales-document-a4-pdf-template"
                  style={{
                    width: '794px',
                    minHeight: '1123px',
                    transform: `scale(${docZoom})`,
                    transformOrigin: 'top center',
                    marginBottom: docZoom < 1 ? `${(1123 * docZoom) - 1123}px` : 0,
                  }}
                  className="bg-white shadow-2xl font-sans relative print:shadow-none print:min-h-0 shrink-0"
                >
                  <style>{`
                    @media print {
                      body * { visibility: hidden !important; }
                      #sales-document-a4-pdf-template, #sales-document-a4-pdf-template * { visibility: visible !important; }
                      #sales-document-a4-pdf-template { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; transform: none !important; margin: 0 !important; }
                    }
                  `}</style>

                  {/* ── DOCUMENT CONTENT (same as before, just inside new shell) ── */}
                  <div className="p-8 space-y-5">

                    {/* Header: logo + doc meta */}
                    <div className="flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        {documentBranding.logo ? (
                          <img
                            src={documentBranding.logo}
                            alt="Logo"
                            referrerPolicy="no-referrer"
                            className="max-h-16 max-w-[200px] object-contain rounded-xl select-none mb-3"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl mb-3" style={{ backgroundColor: computedInvoiceColor }}>
                            {documentBranding.name.charAt(0)}
                          </div>
                        )}
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{documentBranding.name}</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide font-semibold">{documentBranding.city}</p>
                        {/* Address, phone, email — from Corporate Business Setup. Kept plain black/gray,
                            never the brand color, so it always reads as the legal business address. */}
                        {documentBranding.address && <p className="text-[11px] text-slate-500 mt-0.5">{documentBranding.address}</p>}
                        {documentBranding.phone && <p className="text-[11px] text-slate-500">Tel: {documentBranding.phone}</p>}
                        {documentBranding.email && <p className="text-[11px] text-slate-500">Email: {documentBranding.email}</p>}
                        {/* TIN and VAT — from Invoice Settings, directly below the address */}
                        {systemSettings?.invoiceSettings?.tinNumber && <p className="text-[11px] text-slate-500 font-mono">TIN: {systemSettings.invoiceSettings.tinNumber}</p>}
                        {viewingDocument.hasVat && systemSettings?.invoiceSettings?.vatNumber && (
                          <p className="text-[11px] text-slate-500 font-mono">VAT: {systemSettings.invoiceSettings.vatNumber}</p>
                        )}
                      </div>

                      <div className="text-right space-y-1 font-mono text-xs shrink-0">
                        <div className="inline-block text-white text-sm font-black uppercase px-6 py-2.5 rounded-full mb-1 tracking-wider" style={{ backgroundColor: computedInvoiceColor }}>
                          {docTypeLabel}
                        </div>
                        <p className="text-slate-400">Hapana: <strong className="text-slate-800">{viewingDocument.documentNumber}</strong></p>
                        <p className="text-slate-400">Tarehe: <span className="text-slate-700">{new Date(viewingDocument.timestamp).toLocaleDateString([], {dateStyle: 'long'})}</span></p>
                        {viewingDocument.validUntil && <p className="text-slate-400">Valid Until: <span className="text-slate-700">{new Date(viewingDocument.validUntil).toLocaleDateString()}</span></p>}
                        <div className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg mt-1 ${
                          viewingDocument.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          viewingDocument.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {viewingDocument.status === 'pending' ? '● Pending' : viewingDocument.status === 'approved' ? '✓ Approved' : viewingDocument.status}
                        </div>
                      </div>
                    </div>

                    {/* Bill To */}
                    <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-mono">Customer</p>
                      <p className="font-black text-slate-900 text-base">{viewingDocument.customerName || 'Customer'}</p>
                      {viewingDocument.customerPhone && <p className="text-xs text-slate-500 mt-1">{viewingDocument.customerPhone}</p>}
                      {viewingDocument.customerAddress && <p className="text-xs text-slate-500 mt-0.5">{viewingDocument.customerAddress}</p>}
                    </div>

                    {/* Items Table */}
                    <div>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-white" style={{ backgroundColor: computedInvoiceColor }}>
                            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] rounded-l-xl w-8">#</th>
                            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px]">Maelezo</th>
                            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] text-center">Idadi</th>
                            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] text-right">Kipimo Bei</th>
                            <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] text-right rounded-r-xl">Jumla</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingDocument.items.map((item, idx) => {
                            const lineTotal = getLineTotal(item);
                            const displayName = getDocumentItemName(item);
                            const itemDescription = (item as any).description || (item as any).item_description;
                            const unitPrice = toNumber(item.price);
                            const qty = toNumber(item.qty);
                            return (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-slate-800">{displayName}</span>
                                  {itemDescription && itemDescription !== displayName && <span className="block text-[10px] text-slate-400 mt-0.5">{itemDescription}</span>}
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-slate-700">{qty} {getDocumentItemUnit(item)}</td>
                                <td className="py-3 px-4 text-right font-mono text-slate-700">{money(unitPrice)}</td>
                                <td className="py-3 px-4 text-right font-black font-mono text-slate-900">{money(lineTotal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="flex items-start justify-between gap-6">
                      {viewingDocument.paymentMethod && (
                        <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-100 min-w-[200px] text-xs">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Payment Details</p>
                          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            <span className="text-slate-400">Mode</span><strong className="text-right text-slate-700">{viewingDocument.paymentMethod}</strong>
                            {viewingDocument.paymentAccountNumber && <><span className="text-slate-400">Account No.</span><strong className="text-right text-slate-700 font-mono">{viewingDocument.paymentAccountNumber}</strong></>}
                            {viewingDocument.paymentAccountName && <><span className="text-slate-400">Account Name</span><strong className="text-right text-slate-700">{viewingDocument.paymentAccountName}</strong></>}
                            <span className="text-slate-400">Kiasi</span><strong className="text-right text-slate-900 font-mono">{money(viewingDocument.paymentAmount ?? totals.total)}</strong>
                          </div>
                        </div>
                      )}
                      <div className="w-72 space-y-2 font-mono text-xs shrink-0 ml-auto">
                        <div className="flex justify-between text-slate-500 pb-1">
                          <span>Jumla Ndogo</span>
                          <span className="font-bold text-slate-800">{money(totals.subTotal)}</span>
                        </div>
                        {totals.discount > 0 && (
                          <div className="flex justify-between text-orange-600 pb-1">
                            <span>Punguzo</span>
                            <span className="font-bold">-{money(totals.discount)}</span>
                          </div>
                        )}
                        {viewingDocument.hasVat && totals.tax > 0 && (
                          <div className="flex justify-between text-slate-500 pb-1">
                            <span>VAT ({Math.round((viewingDocument.taxRate ?? activeTenant.taxRate ?? 0.18) * 100)}%)</span>
                            <span className="font-bold text-slate-700">{money(totals.tax)}</span>
                          </div>
                        )}
                        {totals.delivery > 0 && (
                          <div className="flex justify-between text-slate-500 pb-1">
                            <span>Delivery</span>
                            <span className="font-bold text-slate-700">{money(totals.delivery)}</span>
                          </div>
                        )}
                        {totals.paid > 0 && (
                          <div className="flex justify-between text-emerald-600 pb-1">
                            <span>Paid</span>
                            <span className="font-bold">{money(totals.paid)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-white rounded-xl px-4 py-3" style={{ backgroundColor: computedInvoiceColor }}>
                          <span className="font-black text-sm uppercase tracking-wide">Jumla</span>
                          <span className="font-black text-base">{money(totals.total)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 px-4">
                          <span>Due</span>
                          <span className="font-bold text-slate-800">{money(totals.balance)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Signature row — Prepared by (left) | Authorized Sahihi (right) */}
                    <div className="border-t border-slate-100 pt-5 flex items-end justify-between gap-6">
                        <div className="text-left">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mb-1">Prepared by</p>
                          <p className="font-black text-slate-800 text-sm">{activeStaff?.name || currentUser?.name || '—'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{activeStaff?.role || 'Sales Associate'}</p>
                        </div>
                        <div className="w-64 text-right">
                          {(() => {
                            const sigImg = activeStaff?.signatureImage || systemSettings?.invoiceSettings?.signatureImage;
                            return sigImg ? (
                              <div className="h-10 mb-1.5 flex justify-end items-end">
                                <img src={sigImg} alt="Signature" className="max-h-10 max-w-[160px] object-contain" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="h-10 border-b border-slate-300 mb-1.5" />
                            );
                          })()}
                          <p className="text-[10px] text-slate-400">Authorized Sahihi</p>
                        </div>
                    </div>

                    {/* Terms & Conditions — from Invoice Settings, shown below signature */}
                    {(() => {
                      const terms = systemSettings?.invoiceSettings?.termsAndConditions;
                      const hasTerms = Array.isArray(terms) ? terms.length > 0 : !!terms;
                      if (!hasTerms) return null;
                      return (
                        <div className="border-t border-slate-100 pt-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mb-2">Terms &amp; Conditions</p>
                          {Array.isArray(terms) ? (
                            <ol className="list-decimal list-inside space-y-1">
                              {terms.map((term: string, i: number) => (
                                <li key={i} className="text-[11px] text-slate-500 leading-relaxed">{term}</li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line">{terms}</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Footer — thank-you message + powered-by attribution, matching the standard document footer used across the app */}
                    <div className="text-center border-t border-slate-100 pt-3 space-y-0.5">
                      <p className="text-[9px] text-slate-400 font-mono">{invoiceFooter.mainMessage}</p>
                      <p className="text-[8px] text-slate-300 font-mono">{invoiceFooter.poweredBy}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        );
      })()}

      {/* Bottom Sheet Action Menu for Mobile */}
      <AnimatePresence>
        {mobileActionsSale && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileActionsSale(null)}
              className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed left-0 right-0 max-w-lg mx-auto bg-white rounded-t-3xl shadow-xl z-[120] overflow-hidden font-sans flex flex-col text-[#0f172a] border border-slate-100" style={{bottom: "calc(var(--dashboard-bottom-nav-height, 56px) + env(safe-area-inset-bottom))", maxHeight: "calc(85vh - var(--dashboard-bottom-nav-height, 56px) - env(safe-area-inset-bottom))"}}
            >
              {/* Close Handle Bar */}
              <div className="w-full flex justify-center py-2 shrink-0">
                <div className="w-12 h-1 bg-slate-250 rounded-full" />
              </div>

              {/* Header Title Information */}
              <div className="px-5 pb-3 pt-1 text-left shrink-0">
                <h3 className="text-base font-extrabold text-slate-800 leading-tight">
                  {mobileActionsSale.customerName || 'Customer'} — <span className="font-mono text-indigo-700">#{getSaleReference(mobileActionsSale)}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                  <span>Total Due: <strong className="font-extrabold text-slate-900">{currency}{Math.round(mobileActionsSale.total).toLocaleString()}</strong></span>
                  <span>{new Date(mobileActionsSale.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} &bull; {new Date(mobileActionsSale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </p>
              </div>

              <div className="bg-slate-100 h-[1px] w-full" />

              {/* Scrollable Action List */}
              <div className="overflow-y-auto divide-y divide-slate-100 p-4 max-h-[calc(70vh-20px)] space-y-2.5">
                
                {/* 1. View Sale */}
                <button
                  type="button"
                  onClick={() => {
                    setViewingSaleDetail(mobileActionsSale);
                    setMobileActionsSale(null);
                  }}
                  className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 select-none">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">View Sale</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Inspect client receipt details</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 2. Add Payment */}
                <button
                  type="button"
                  onClick={() => {
                    const totalVal = mobileActionsSale.total;
                    const isCredit = mobileActionsSale.paymentMethod === 'Credit';
                    const initialPaid = mobileActionsSale.amountPaid !== undefined ? mobileActionsSale.amountPaid : (isCredit ? 0 : totalVal);
                    const installments = installmentRecords[mobileActionsSale.id] || [];
                    const extraPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);
                    const calculatedPaid = Math.min(totalVal, initialPaid + extraPaid);
                    const calculatedDue = Math.max(0, totalVal - calculatedPaid);

                    setSelectedSale(mobileActionsSale);
                    setPayInInputVal(calculatedDue > 0 ? calculatedDue.toString() : '');
                    setViewPaymentsOpen(true);
                    setMobileActionsSale(null);
                  }}
                  className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 select-none">
                      <PlusCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Add Payment</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Collect due balance installment</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 3. Edit Sale */}
                <button
                  type="button"
                  onClick={() => {
                    const totalVal = mobileActionsSale.total;
                    const isCredit = mobileActionsSale.paymentMethod === 'Credit';
                    const initialPaid = mobileActionsSale.amountPaid !== undefined ? mobileActionsSale.amountPaid : (isCredit ? 0 : totalVal);
                    const installments = installmentRecords[mobileActionsSale.id] || [];
                    const extraPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);
                    const calculatedPaid = Math.min(totalVal, initialPaid + extraPaid);
                    const calculatedDue = Math.max(0, totalVal - calculatedPaid);

                    setEditingSale(mobileActionsSale);
                    setEditFormFields({
                      customerName: mobileActionsSale.customerName || '',
                      customerPhone: mobileActionsSale.customerPhone || '',
                      paymentMethod: mobileActionsSale.paymentMethod,
                      amountPaid: initialPaid,
                      amountDue: calculatedDue,
                      items: [...mobileActionsSale.items],
                      saleDate: computeSaleDateStr(mobileActionsSale)
                    });
                    setEditCartEmptyWarning(null);
                    setMobileActionsSale(null);
                  }}
                  className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 select-none">
                      <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Edit Sale</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Update customer details or items</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 4. POS Receipt */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSale(mobileActionsSale);
                    setViewA4InvoiceOpen(false);
                    setMobileActionsSale(null);
                  }}
                  className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 select-none">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">POS Receipt</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">View or print thermal slip</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 5. A4 Invoice */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSale(mobileActionsSale);
                    setViewA4InvoiceOpen(true);
                    setDocZoom(computeInvoiceFitZoom());
                    setWhatsappPhone((mobileActionsSale.customerPhone || '').replace(/[^0-9]/g, ''));
                    setMobileActionsSale(null);
                  }}
                  className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 select-none">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">A4 Invoice</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">View or print full-page invoice</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 5b. Add to Delivery */}
                {onSendToDeliveryNote && (
                  <button
                    type="button"
                    onClick={() => {
                      onSendToDeliveryNote(mobileActionsSale);
                      setMobileActionsSale(null);
                    }}
                    className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 select-none">
                        <DeliveryMotorcycleIcon className="w-5 h-5 text-indigo-600" size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Add to Delivery</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Send to delivery note dispatch</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}

                {/* Divider below main actions */}
                <div className="my-2 border-t border-slate-100" />

                {/* 6. Cancel Receipt */}
                <button
                  type="button"
                  onClick={() => {
                    openDeleteSaleConfirmation(mobileActionsSale);
                    setMobileActionsSale(null);
                  }}
                  disabled={rolePermissions && rolePermissions.deleteSale?.write === false}
                  className={`w-full h-14 min-h-[52px] flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-rose-50 shadow-3xs cursor-pointer text-left transition-colors font-semibold ${
                    rolePermissions && rolePermissions.deleteSale?.write === false 
                      ? 'bg-slate-50 text-slate-400 border-none cursor-not-allowed opacity-50' 
                      : 'bg-rose-50/30 hover:bg-rose-50 border-rose-100 text-rose-600'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 select-none ${
                      rolePermissions && rolePermissions.deleteSale?.write === false
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-rose-100 text-rose-600'
                    }`}>
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`text-sm font-black block ${rolePermissions && rolePermissions.deleteSale?.write === false ? 'text-slate-400' : 'text-rose-700'}`}>Cancel Receipt</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Reverse payment and restore stock safely</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400 flex items-center justify-center" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
