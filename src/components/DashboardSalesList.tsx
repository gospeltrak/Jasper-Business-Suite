import { useState, useRef, useEffect, FormEvent } from 'react';
import { Sale, Tenant, SaleItem, Product, SystemSettings, SalesDocument, User as AppUser } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatSaleItemQuantity } from '../utils/unitFormatter';
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
  ChevronRight,
  PlusCircle,
  Pencil
} from 'lucide-react';
import { shareElementPdfToWhatsApp } from '../utils/pdfShare';
import CachedImage from './CachedImage';

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
  onUpdateSales?: (updatedSales: Sale[]) => void;
  rolePermissions?: any;
  products?: Product[];
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
  rolePermissions,
  products = [],
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

  // Load documents from localStorage on mount
  const [documents, setDocuments] = useState<SalesDocument[]>(() => {
    const cached = localStorage.getItem(`jasper_docs_${activeTenant.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SalesDocument[];
        // Map legacy document types gracefully to unified 'price quote invoice' and add mock defaults if empty
        return parsed.map(d => {
          const typeStr = d.type as string;
          if (typeStr === 'price quote' || typeStr === 'invoice' || typeStr === 'price quote invoice') {
            return { ...d, type: 'price quote invoice' as const };
          }
          return d;
        });
      } catch (e) {
        return [];
      }
    }
    // Default initial mock documents
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
        customerAddress: 'Tom Mboya Street, Nairobi',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        tenantId: activeTenant.id,
        status: 'pending'
      },
      {
        id: 'doc-pf-002',
        type: 'price quote invoice',
        documentNumber: 'PRO-2026-0002',
        items: [
          { productId: 'p-2', productName: 'White Sugar (Fine Grain Box)', qty: 20, price: 30, discount: 5, discountType: 'percent' }
        ],
        total: 570,
        tax: 0,
        customerName: 'Lipa Wholesale Traders',
        customerPhone: '+254 733 444 555',
        customerAddress: 'Pipeline Road, Nairobi',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        tenantId: activeTenant.id,
        status: 'pending'
      }
    ];
    return defaultDocs;
  });

  // Save documents back to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`jasper_docs_${activeTenant.id}`, JSON.stringify(documents));
  }, [documents, activeTenant.id]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('All');
  const [selectedSyncStatus, setSelectedSyncStatus] = useState<string>('All');

  // Received Customer Debt Payments Search Query
  const [debtSearchTerm, setDebtSearchTerm] = useState('');

  // Settle shift / Pay-In list states
  const [tillSettlements, setTillSettlements] = useState<TillSettlement[]>(() => {
    const saved = localStorage.getItem(`till_settlements_${activeTenant.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_SETTLEMENTS;
  });

  useEffect(() => {
    localStorage.setItem(`till_settlements_${activeTenant.id}`, JSON.stringify(tillSettlements));
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
  const [mobileActionsSale, setMobileActionsSale] = useState<Sale | null>(null);

  // Modal triggers
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  const [viewA4InvoiceOpen, setViewA4InvoiceOpen] = useState(false);
  const [payInInputVal, setPayInInputVal] = useState<string>('');

  // Editing transaction fields
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  // States for Documents Tab (Quotes, Quote, Invoices)
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<SalesDocument | null>(null);
  const [documentSendOpen, setDocumentSendOpen] = useState(false);
  const [documentSendPhone, setDocumentSendPhone] = useState('');
  const [pdfShareStatus, setPdfShareStatus] = useState<string | null>(null);
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState<'all' | 'price quote' | 'price quote invoice'>('all');
  
  // States for wizard: document creator
  const [newDocType, setNewDocType] = useState<'price quote' | 'price quote invoice'>('price quote');
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
  const [newDocPaymentMethod, setNewDocPaymentMethod] = useState(() => systemSettings?.business?.paymentModes?.[0] || 'Cash');
  const [newDocHasVat, setNewDocHasVat] = useState(() => !!systemSettings?.invoiceSettings?.hasVatByDefault);

  // Sync VAT toggle default state when modal opens
  useEffect(() => {
    if (showNewDocModal) {
      setNewDocHasVat(!!systemSettings?.invoiceSettings?.hasVatByDefault);
      setNewDocDeliveryCost(0);
      setNewDocPaymentMethod(systemSettings?.business?.paymentModes?.[0] || 'Cash');
    }
  }, [showNewDocModal, systemSettings]);

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
  const [docWizardSelectedDiscount, setDocWizardSelectedDiscount] = useState(0);
  const [docWizardProductSearchQuery, setDocWizardProductSearchQuery] = useState('');

  // States for Direct Add Sale tab removed as all sales must be logged on POS view

  const [editFormFields, setEditFormFields] = useState<{
    customerName: string;
    customerPhone: string;
    paymentMethod: 'Cash' | 'Card' | 'M-Pesa' | 'MTN MoMo' | 'Paystack' | 'Airtel Money' | 'Credit';
    amountPaid: number;
    amountDue: number;
    items: SaleItem[];
  } | null>(null);

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
  const [settleOpeningFloat, setSettleOpeningFloat] = useState(100);
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
    return localStorage.getItem(`float_verified_${activeTenant.id}`) === 'true';
  });
  const [verifiedFloatTimestamp, setVerifiedFloatTimestamp] = useState(() => {
    return localStorage.getItem(`float_verified_time_${activeTenant.id}`) || '';
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
    const saved = localStorage.getItem(`double_entry_ledgers_${activeTenant.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(`double_entry_ledgers_${activeTenant.id}`, JSON.stringify(doubleEntryLedgers));
  }, [doubleEntryLedgers, activeTenant.id]);

  // Synchronize actual cash defaults once expected sales change
  useEffect(() => {
    const totalExpected = settleOpeningFloat + expectedTodayDrawerSales + settleShiftPayIns - settleShiftPayOuts;
    setSettleActualDrawerCount(totalExpected);
    setSettlePayInAmount(totalExpected);
  }, [settleOpeningFloat, expectedTodayDrawerSales, settleShiftPayIns, settleShiftPayOuts]);

  // Filter logic
  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.reference && s.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPayment = 
      selectedPaymentMethod === 'All' || 
      (selectedPaymentMethod === 'Mobile Money' && ['M-Pesa', 'MTN MoMo', 'Airtel Money'].includes(s.paymentMethod)) ||
      (selectedPaymentMethod === 'Card' && ['Card', 'Paystack'].includes(s.paymentMethod)) ||
      (selectedPaymentMethod === 'Cash' && s.paymentMethod === 'Cash') ||
      (selectedPaymentMethod === 'Credit' && s.paymentMethod === 'Credit');
    
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
  const pendingCount = filteredSales.filter(s => {
    const amountPaid = s.amountPaid !== undefined ? s.amountPaid : s.total;
    const pastInstallments = (installmentRecords[s.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
    const totalCollectedSoFar = s.paymentMethod === 'Credit' ? (amountPaid + pastInstallments) : s.total;
    return s.paymentMethod === 'Credit' && totalCollectedSoFar < s.total;
  }).length;

  const simulatePrint = () => {
    setIsReceiptPrinting(true);
    setTimeout(() => {
      setIsReceiptPrinting(false);
    }, 1500);
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
    const documentLabel = doc.type === 'price quote' ? 'price quote' : 'price quote invoice';
    const customer = doc.customerName?.trim() || 'valued customer';
    return `Hello ${customer}, please find attached your ${documentLabel} PDF ${doc.documentNumber} from ${activeTenant.name}. Thank you.`;
  };

  const sharePdfDocument = async (doc: SalesDocument, phone?: string) => {
    try {
      setPdfShareStatus('Preparing PDF...');
      await shareElementPdfToWhatsApp({
        elementId: 'sales-document-a4-pdf-template',
        fileName: `${doc.type.replace(/\s+/g, '-')}-${doc.documentNumber}.pdf`,
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

  const shareSalePdf = async (sale: Sale, phone?: string, format: 'a4' | 'receipt' = 'a4') => {
    try {
      setPdfShareStatus('Preparing PDF...');
      await shareElementPdfToWhatsApp({
        elementId: format === 'a4' ? 'sales-invoice-a4-pdf-template' : 'sales-receipt-pdf-template',
        fileName: `${format === 'a4' ? 'sales-invoice' : 'pos-receipt'}-${sale.reference || sale.id}.pdf`,
        phone: phone || sale.customerPhone,
        message: `Hello ${sale.customerName || 'customer'}, please find attached your ${format === 'a4' ? 'sales invoice' : 'POS receipt'} PDF from ${activeTenant.name}. Thank you.`,
        format
      });
      setPdfShareStatus('PDF ready for WhatsApp.');
    } catch (err: any) {
      setPdfShareStatus(err?.message || 'Could not prepare PDF.');
    } finally {
      setTimeout(() => setPdfShareStatus(null), 4000);
    }
  };

  const sendDocumentToSales = (doc: SalesDocument) => {
    if (!onPreloadCartForPOS) return;

    onPreloadCartForPOS(doc.items, doc.timestamp, {
      deliveryCost: doc.deliveryCost || 0,
      paymentMethod: doc.paymentMethod || 'Cash',
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      hasVat: !!doc.hasVat
    });

    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'converted' } : d));
    setViewingDocument(null);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="sales-list-view-root">
      
      {/* HEADER CONTROLS SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-slide-in">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Sales History</h2>
          </div>
          <p className="text-xs text-slate-450 leading-relaxed font-sans mt-1">
            {activeTenant.businessType === 'pharmacy' 
              ? 'Real-time catalog of active pharmaceutical tickets, clinical checkout records, and generated prescription receipts.' 
              : 'Real-time catalog of active cashier tickets, checkout records, payment statuses, and generated receipt files.'}
          </p>
        </div>

        {/* Quick total metric label */}
        <div className="bg-slate-900 text-white rounded-xl px-4 py-2 font-mono text-xs flex items-center space-x-3 shadow-sm select-none">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Total Value:</span>
          <span className="font-bold text-emerald-400 text-sm leading-none">{currency}{Math.round(totalVolume).toLocaleString()}</span>
        </div>
      </div>

      {/* Dynamic Sub-Tab Selector for general payments, documents, and cashier drawer loggers */}
      {/* DESKTOP ONLY TAB NAVIGATION */}
      <div className="hidden md:flex bg-slate-100 p-1 rounded-2xl border border-slate-205 overflow-x-auto scrollbar-none shadow-xs select-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('sales')}
          className={`px-4 py-2.5 rounded-xl border-none cursor-pointer font-sans text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 shrink-0 ${
            activeSubTab === 'sales'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-500 font-sans" />
          <span>Sales & Receipts</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('debts')}
          className={`px-4 py-2.5 rounded-xl border-none cursor-pointer font-sans text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 shrink-0 ${
            activeSubTab === 'debts'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-450 hover:text-slate-850'
          }`}
        >
          <Coins className="w-4 h-4 text-orange-500" />
          <span>Customer Debts (Pay-In)</span>
          {sales.filter(s => s.paymentMethod === 'Credit' && (s.total - (s.amountPaid !== undefined ? s.amountPaid : 0)) > 0).length > 0 && (
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('settlement')}
          className={`px-4 py-2.5 rounded-xl border-none cursor-pointer font-sans text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 shrink-0 ${
            activeSubTab === 'settlement'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-450 hover:text-slate-850'
          }`}
        >
          <Building className="w-4 h-4 text-indigo-650" />
          <span>Settle Till</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('documents')}
          className={`px-4 py-2.5 rounded-xl border-none cursor-pointer font-sans text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 shrink-0 ${
            activeSubTab === 'documents'
              ? 'bg-white text-teal-950 shadow-sm font-black'
              : 'text-slate-555 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-teal-600 font-sans" />
          <span>Quotes & Quotes</span>
        </button>
      </div>

      {/* MOBILE ONLY TAB NAVIGATION */}
      <div className="md:hidden grid grid-cols-4 gap-1.5 px-3 pb-2 select-none w-full" id="mobile-sales-tabs-grid">
        {/* 1. Receipts */}
        <button
          type="button"
          onClick={() => setActiveSubTab('sales')}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-205 border min-h-[58px] ${
            activeSubTab === 'sales'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
              : 'bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-555 dark:text-slate-400'
          }`}
        >
          <FileText className={`w-[18px] h-[18px] mb-1 shrink-0 ${activeSubTab === 'sales' ? 'text-white' : 'text-indigo-500'}`} />
          <span className="text-[10px] font-semibold text-center leading-tight whitespace-nowrap">Receipts</span>
        </button>

        {/* 2. Debts */}
        <button
          type="button"
          onClick={() => setActiveSubTab('debts')}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-205 border min-h-[58px] relative ${
            activeSubTab === 'debts'
              ? 'bg-orange-500 border-orange-500 text-white shadow-xs font-bold'
              : 'bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-555 dark:text-slate-400'
          }`}
        >
          <Coins className={`w-[18px] h-[18px] mb-1 shrink-0 ${activeSubTab === 'debts' ? 'text-white' : 'text-orange-500'}`} />
          <span className="text-[10px] font-semibold text-center leading-tight whitespace-nowrap">Debts</span>
          {sales.filter(s => s.paymentMethod === 'Credit' && (s.total - (s.amountPaid !== undefined ? s.amountPaid : 0)) > 0).length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse border border-white" />
          )}
        </button>

        {/* 3. Settle Till */}
        <button
          type="button"
          onClick={() => setActiveSubTab('settlement')}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-205 border min-h-[58px] ${
            activeSubTab === 'settlement'
              ? 'bg-indigo-650 border-indigo-650 text-white shadow-xs font-bold'
              : 'bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-555 dark:text-slate-400'
          }`}
        >
          <Building className={`w-[18px] h-[18px] mb-1 shrink-0 ${activeSubTab === 'settlement' ? 'text-white' : 'text-indigo-600'}`} />
          <span className="text-[10px] font-semibold text-center leading-tight whitespace-nowrap">Settle Till</span>
        </button>

        {/* 4. Documents */}
        <button
          type="button"
          onClick={() => setActiveSubTab('documents')}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-205 border min-h-[58px] ${
            activeSubTab === 'documents'
              ? 'bg-teal-650 border-teal-650 text-white shadow-xs font-bold'
              : 'bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-555 dark:text-slate-400'
          }`}
        >
          <FileText className={`w-[18px] h-[18px] mb-1 shrink-0 ${activeSubTab === 'documents' ? 'text-white' : 'text-teal-600'}`} />
          <span className="text-[10px] font-semibold text-center leading-tight whitespace-nowrap">Quotes</span>
        </button>
      </div>

      {activeSubTab === 'sales' && (
        <>
          {/* DATE RANGE SELECTOR BAR */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Calendar className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <h3 className="text-xs font-bold text-slate-800">Date Range Filter</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Filter by date</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto">
              <div className="flex flex-row gap-2 w-full lg:w-auto">
                <div className="flex flex-col flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl w-full sm:w-auto relative">
                  <span className="text-xs uppercase font-mono font-medium text-slate-400 mb-0.5">From</span>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none outline-none font-medium text-slate-700 focus:ring-0 text-sm cursor-pointer w-full p-0 h-5"
                  />
                </div>

                <div className="flex flex-col flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl w-full sm:w-auto relative">
                  <span className="text-xs uppercase font-mono font-medium text-slate-400 mb-0.5">To</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none outline-none font-medium text-slate-700 focus:ring-0 text-sm cursor-pointer w-full p-0 h-5"
                  />
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex flex-row items-center gap-2 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const str = getTodayLocalDateStr();
                    setStartDate(str);
                    setEndDate(str);
                  }}
                  className={`flex-1 lg:flex-none whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 ${
                    startDate === getTodayLocalDateStr() && endDate === getTodayLocalDateStr()
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yYear = yesterday.getFullYear();
                    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
                    const yDay = String(yesterday.getDate()).padStart(2, '0');
                    const yStr = `${yYear}-${yMonth}-${yDay}`;
                    setStartDate(yStr);
                    setEndDate(yStr);
                  }}
                  className={`flex-1 lg:flex-none whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 ${
                    startDate && startDate === endDate && startDate !== getTodayLocalDateStr()
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const past7 = new Date();
                    past7.setDate(past7.getDate() - 6);
                    const pastYear = past7.getFullYear();
                    const pastMonth = String(past7.getMonth() + 1).padStart(2, '0');
                    const pastDay = String(past7.getDate()).padStart(2, '0');
                    const p7Str = `${pastYear}-${pastMonth}-${pastDay}`;
                    setStartDate(p7Str);
                    setEndDate(getTodayLocalDateStr());
                  }}
                  className={`flex-1 lg:flex-none whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 ${
                    startDate && startDate !== getTodayLocalDateStr() && endDate === getTodayLocalDateStr()
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className={`flex-1 lg:flex-none whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 ${
                    !startDate && !endDate
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>
          </div>

          {/* KPI METADATA CARDS */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Sales Ticket count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-slate-100 text-slate-650 rounded-xl border border-slate-205 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Number of Sales</p>
            <h4 className="text-lg font-black text-slate-800 mt-1">{filteredSales.length} Transactions</h4>
          </div>
        </div>

        {/* Total Sales revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Total Sales</p>
            <h4 className="text-lg font-black text-emerald-700 mt-1">{currency}{Math.round(totalVolume).toLocaleString()}</h4>
          </div>
        </div>

        {/* Pending Offline sales queue count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl shrink-0 border ${pendingSyncCount > 0 ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Offline Queue Logs</p>
            <h4 className="text-lg font-black text-slate-800 mt-1">
              {pendingSyncCount} {pendingSyncCount === 1 ? 'Docket' : 'Dockets'} Pending
            </h4>
          </div>
        </div>

        {/* Issued Credit Saless */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/5 text-amber-700 rounded-xl border border-amber-100 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold text-amber-600 uppercase tracking-widest leading-none">Credit Saless</p>
            <h4 className="text-lg font-black text-slate-800 mt-1">{currency}{Math.round(creditsVolume).toLocaleString()} ({creditsCount} files)</h4>
          </div>
        </div>

      </div>

      {/* KPI METADATA CARDS (MOBILE) */}
      <div className="md:hidden grid grid-cols-2 gap-3 pb-2 w-full">
        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 shadow-sm flex items-center space-x-2">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-slate-800 truncate">{filteredSales.length}</h4>
            <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider truncate mt-0.5">Number of Sales</p>
          </div>
        </div>

        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50 shadow-sm flex items-center space-x-2">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-slate-800 truncate">{currency}{Math.round(totalVolume).toLocaleString()}</h4>
            <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider truncate mt-0.5">Total Sales</p>
          </div>
        </div>

        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50 shadow-sm flex items-center space-x-2">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-lg shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-slate-800 truncate">{pendingSyncCount}</h4>
            <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider truncate mt-0.5">Offline Bills</p>
          </div>
        </div>

        <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100/50 shadow-sm flex items-center space-x-2">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-slate-800 truncate">{pendingCount}</h4>
            <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider truncate mt-0.5">Pending</p>
          </div>
        </div>

        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100/50 shadow-sm flex items-center space-x-3 col-span-2">
          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-black text-slate-800 truncate">{currency}{Math.round(creditsVolume).toLocaleString()}</h4>
              <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider truncate mt-0.5">Credit Sales</p>
            </div>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded-md">{creditsCount} docs</span>
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL PANEL BAR (DESKTOP) */}
      <div className="hidden md:flex bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex-col md:flex-row md:items-center justify-between gap-4">
        
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
      <div className="md:hidden flex flex-row gap-2 items-center">
        {/* Search */}
        <div className="flex-1 flex items-center bg-white border border-slate-200 px-3 py-2.5 rounded-xl shadow-xs">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search Receipt ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none focus:outline-none w-full text-xs text-slate-800 placeholder-slate-400 font-sans"
          />
        </div>

        {/* Channel Dropdown */}
        <select
          value={selectedPaymentMethod}
          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-white px-3 py-2.5 rounded-xl font-bold cursor-pointer outline-none text-xs shadow-xs shrink-0 max-w-[120px]"
        >
          <option value="All">All Channels</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Mobile Money">MOMO</option>
          <option value="Credit">Credit</option>
        </select>
      </div>

      {/* SALES MAIN DATA LIST */}
      <div className="bg-transparent md:bg-white md:rounded-2xl md:border md:border-slate-200 shadow-none md:shadow-xs overflow-hidden">
        
        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col space-y-3 pb-8">
          {filteredSales.map((sale) => {
            const totalVal = sale.total;
            const isCredit = sale.paymentMethod === 'Credit';
            const amountPaid = sale.amountPaid !== undefined ? sale.amountPaid : totalVal;
            const pastInstallments = (installmentRecords[sale.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
            const totalCollectedSoFar = isCredit ? (amountPaid + pastInstallments) : totalVal;
            const amountDueRaw = isCredit ? Math.max(0, totalVal - totalCollectedSoFar) : 0;

            let paymentStatusTag = '';
            let paymentStatusColor = '';

            if (!isCredit) {
              paymentStatusTag = 'PAID IN FULL';
              paymentStatusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
            } else if (amountDueRaw <= 0) {
              paymentStatusTag = 'SETTLED';
              paymentStatusColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
            } else if (totalCollectedSoFar > 0) {
              paymentStatusTag = 'PARTIAL PAYMENT';
              paymentStatusColor = 'bg-amber-50 text-amber-700 border-amber-100';
            } else {
              paymentStatusTag = 'UNPAID / RAW';
              paymentStatusColor = 'bg-rose-50 text-rose-700 border-rose-100';
            }

            return (
              <div key={sale.id} className="bg-white border text-sm border-slate-100 shadow-sm rounded-xl p-3 pr-9 flex flex-col relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer" onClick={() => setViewingSaleDetail(sale)}>
                {/* Vertical Three-Dots Menu Icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMobileActionsSale(sale);
                  }}
                  className="absolute top-2.5 right-2 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 active:scale-95 transition-all cursor-pointer z-10"
                  aria-label="Open sales Actions menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Top Row */}
                <div className="flex items-start justify-between mb-2 truncate pr-2">
                  <span className="font-bold text-slate-800 tracking-tight truncate pr-2">{sale.customerName || 'Walk-in Customer'}</span>
                  <span className="font-bold text-slate-900 tracking-tight text-right text-base shrink-0">{currency} {Math.round(sale.total).toLocaleString()}</span>
                </div>

                {/* Second Row */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-400 font-mono truncate mr-2">
                    #{sale.reference || sale.id.substring(0, 5)} &bull; {sale.items.reduce((sum, item) => sum + item.qty, 0)} Items
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                    {sale.paymentMethod || 'Cash'}
                  </span>
                </div>

                {/* Third Row */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    <span className="mr-1">{new Date(sale.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border shrink-0 ${paymentStatusColor}`}>
                    {paymentStatusTag}
                  </span>
                </div>
              </div>
            );
          })}
          {filteredSales.length === 0 && (
             <div className="p-12 flex flex-col items-center justify-center text-center text-slate-455 text-sm bg-white rounded-2xl shadow-sm">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 mt-4 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 mb-1">No sales yet</h4>
                <p className="text-xs text-slate-455 mb-4">No matching sales.</p>
             </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">
                <th className="p-4">Reference</th>
                <th className="p-4">Time</th>
                <th className="p-4">Customer Client Details</th>
                <th className="p-4">Item Quantities Checked</th>
                <th className="p-4 text-center">Payment Mode</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Total Amount</th>
                <th className="p-4 text-right">Amount Paid</th>
                <th className="p-4 text-right text-rose-750">Amount Due</th>
                <th className="p-4 text-center">Payment Status</th>
                <th className="p-4 text-right">Taxes Charged</th>
                <th className="p-4 text-right font-black text-slate-900">Grand Total Amount</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-xs">
              {filteredSales.map((sale) => {
                const totalVal = sale.total;
                const isCredit = sale.paymentMethod === 'Credit';
                
                // Get pre-saved amounts or fallback defaults
                const initialPaid = sale.amountPaid !== undefined ? sale.amountPaid : (isCredit ? 0 : totalVal);
                
                // Incorporate installments recorded in memory
                const installments = installmentRecords[sale.id] || [];
                const extraPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);
                
                const calculatedPaid = Math.min(totalVal, initialPaid + extraPaid);
                const calculatedDue = Math.max(0, totalVal - calculatedPaid);

                let paymentStatus: 'Paid' | 'Not Paid' | 'Partially Paid' = 'Paid';
                if (calculatedPaid <= 0.05) {
                  paymentStatus = 'Not Paid';
                } else if (calculatedDue <= 0.05) {
                  paymentStatus = 'Paid';
                } else {
                  paymentStatus = 'Partially Paid';
                }

                return (
                  <tr key={sale.id} className="hover:bg-slate-50/55 transition-all text-slate-700">
                    
                    {/* Receipt code reference */}
                    <td className="p-4 font-mono font-bold text-slate-850">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-150 text-[11px] font-bold">
                        {getSaleReference(sale)}
                      </span>
                    </td>

                    {/* Date and time stamp */}
                    <td className="p-4 whitespace-nowrap text-slate-650 font-mono text-[11px]">
                      {formatShortDateTime(sale.timestamp)}
                    </td>

                    {/* Customer Info */}
                    <td className="p-4">
                      {sale.customerName ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 flex items-center">
                            <User className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
                            <span>{sale.customerName}</span>
                          </p>
                          {sale.customerPhone && (
                            <p className="text-[10px] text-slate-450 font-mono flex items-center">
                              <Phone className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                              <span>{sale.customerPhone}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Walk-In Customer</span>
                      )}
                    </td>

                    {/* Items purchased */}
                    <td className="p-4 max-w-[220px]">
                      <span className="font-bold text-slate-750">
                        {sale.items.reduce((tot, i) => tot + i.qty, 0)} Units check
                      </span>
                      <p className="text-[10px] text-slate-450 truncate mt-0.5" title={sale.items.map(it => `${it.productName} (x${it.qty})`).join(', ')}>
                        {sale.items.map(it => `${it.productName} (x${it.qty})`).join(', ')}
                      </p>
                    </td>

                    {/* Payment Method badge */}
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-1 text-[10px] font-bold font-sans rounded-full border ${
                        sale.paymentMethod === 'Cash' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                          : ['Card', 'Paystack'].includes(sale.paymentMethod)
                          ? 'bg-blue-50 text-blue-800 border-blue-105'
                          : sale.paymentMethod === 'Credit'
                          ? 'bg-amber-50 text-amber-800 border-amber-105'
                          : 'bg-indigo-50 text-indigo-800 border-indigo-105'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>

                    {/* Sync status */}
                    <td className="p-4 text-center text-[10px] font-sans font-bold">
                      <div className="inline-flex items-center space-x-1">
                        {sale.syncStatus === 'synced' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="text-emerald-700">Synced</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="text-amber-700">Cache</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* NEW: Total Amount */}
                    <td className="p-4 text-right font-mono text-slate-800 font-bold whitespace-nowrap">
                      {currency}{Math.round(totalVal).toLocaleString()}
                    </td>

                    {/* NEW: Amount Paid */}
                    <td className="p-4 text-right font-mono text-emerald-700 font-bold bg-emerald-50/10 whitespace-nowrap">
                      {currency}{Math.round(calculatedPaid).toLocaleString()}
                    </td>

                    {/* NEW: Amount Due */}
                    <td className="p-4 text-right font-mono whitespace-nowrap">
                      {calculatedDue > 0 ? (
                        <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100/50">
                          {currency}{Math.round(calculatedDue).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    {/* NEW: Payment Status (Paid / Not Paid / Partially Paid) */}
                    <td className="p-4 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase rounded border ${
                        paymentStatus === 'Paid'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : paymentStatus === 'Not Paid'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-850 border-amber-200'
                      }`}>
                        {paymentStatus}
                      </span>
                    </td>

                    {/* Tax */}
                    <td className="p-4 text-right font-mono text-slate-650">
                      {currency}{sale.tax ? Math.round(sale.tax).toLocaleString() : '0'}
                    </td>

                    {/* Total sales cost */}
                    <td className="p-4 text-right font-mono text-slate-900 font-extrabold text-xs">
                      {currency}{Math.round(sale.total).toLocaleString()}
                    </td>

                    {/* NEW: Hamburger Dropdown Actions Trigger */}
                    <td className="p-4 text-center relative whitespace-nowrap">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === sale.id ? null : sale.id)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-250 cursor-pointer font-sans text-xs font-bold transition-all inline-flex items-center space-x-1.5 active:scale-95 select-none shadow-xs"
                          title="View Actions Hamburger Menu"
                        >
                          <Menu className="w-3.5 h-3.5 text-slate-550" />
                          <span>View...</span>
                        </button>

                        {activeMenuId === sale.id && (
                          <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 text-left font-sans py-2 animate-fade-in divide-y divide-slate-100">
                            
                            <div className="px-3 py-1 text-[9.5px] uppercase font-mono font-bold text-slate-400">
                              MANAGE TICKET
                            </div>

                            <div className="py-1">
                              {calculatedDue > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedSale(sale);
                                    setPayInInputVal(calculatedDue.toString()); // Prefill with the dynamic amount required to be paid
                                    setViewPaymentsOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-emerald-850 hover:bg-emerald-50/50 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-emerald-500/5 font-bold"
                                >
                                  <Coins className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                                  <span>Payment In (Pay-In)</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setPayInInputVal('');
                                  setViewPaymentsOpen(true);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent font-medium"
                              >
                                <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                                <span>View Payments Log</span>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setViewingSaleDetail(sale);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-805 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent font-bold"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>View Sell</span>
                              </button>

                              <button
                                onClick={() => {
                                  setEditingSale(sale);
                                  setEditFormFields({
                                    customerName: sale.customerName || '',
                                    customerPhone: sale.customerPhone || '',
                                    paymentMethod: sale.paymentMethod,
                                    amountPaid: initialPaid,
                                    amountDue: calculatedDue,
                                    items: [...sale.items]
                                  });
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-750 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent font-medium"
                              >
                                <Edit className="w-3.5 h-3.5 text-amber-500" />
                                <span>Edit Sell</span>
                              </button>

                              {(!rolePermissions || rolePermissions.deleteSale?.write !== false) && (
                                <button
                                  onClick={() => {
                                    setSaleToDelete(sale);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-rose-650 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Delete Sale</span>
                                </button>
                              )}
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setViewA4InvoiceOpen(false); // Make sure A4 invoice mode is off
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-705 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-bold">Printing POS receipt</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setViewA4InvoiceOpen(true); // Switch to A4 print mode
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-705 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="font-bold">Printing Invoice (A4)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setViewA4InvoiceOpen(true);
                                  setWhatsappPhone((sale.customerPhone || '').replace(/[^0-9]/g, ''));
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-705 hover:bg-emerald-50 hover:text-emerald-800 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent decoration-transparent font-semibold"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Send PDF via WhatsApp</span>
                              </button>

                              {onSendToDeliveryNote && (
                                <button
                                  onClick={() => {
                                    onSendToDeliveryNote(sale);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-55 flex items-center space-x-2 transition-colors cursor-pointer border-none bg-transparent font-black mt-1"
                                >
                                  <DeliveryMotorcycleIcon className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Send to Delivery Note</span>
                                </button>
                              )}
                            </div>

                          </div>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-455">
                    No active transactions match your filter criteria or search keyword.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Total Credit Credit-Sales</p>
                <h4 className="text-xl font-black text-slate-800 mt-2">{currency}{Math.round(totalDebtIssued).toLocaleString()}</h4>
                <p className="text-[10px] text-slate-400 mt-1">Outstanding sales invoices marked as Credit tabs.</p>
              </div>
              <div className="bg-emerald-505 p-5 border border-emerald-250 rounded-2xl">
                <p className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest leading-none">Total Payment-Ins Collected</p>
                <h4 className="text-xl font-black text-emerald-800 mt-2">{currency}{Math.round(totalDebtPaidIn).toLocaleString()}</h4>
                <p className="text-[10px] text-emerald-650 mt-1">Total credit installments & payments-in received.</p>
              </div>
              <div className="bg-amber-505 p-5 border border-amber-250 rounded-2xl">
                <p className="text-[10px] font-mono font-bold text-amber-600 uppercase tracking-widest leading-none">Outstanding Balance Receivable</p>
                <h4 className="text-xl font-black text-amber-808 mt-2">{currency}{Math.round(totalDebtOutstanding).toLocaleString()}</h4>
                <p className="text-[10px] text-amber-652 mt-1">Remaining customer dockets debt pending settlement.</p>
              </div>
            </div>

            {/* Debts Search panel */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <div className="text-xs text-slate-450 font-mono">
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

                return (
                  <div key={s.id} className={`bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${isCleared ? 'border-emerald-250 bg-emerald-50/20' : 'border-slate-205'}`}>
                    <div className="space-y-4">
                      
                      {/* Customer core card row */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-mono font-black py-0.5 px-2 bg-slate-100 border border-slate-204 rounded text-slate-500 uppercase tracking-widest">
                            Ref: {getSaleReference(s)}
                          </span>
                          <h4 className="text-sm font-bold text-slate-808 mt-2 flex items-center space-x-1.5 font-sans">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{s.customerName || 'Anonymous Account-Tab'}</span>
                          </h4>
                          {s.customerPhone && (
                            <p className="text-[10px] text-slate-450 flex items-center space-x-1.5 mt-0.5 font-mono">
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
                            <div key={idx} className="flex justify-between py-1 font-sans text-slate-650 text-[11px]">
                              <span>{item.qty} × {item.productName}</span>
                              <span className="font-mono">{currency}{item.price.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Collapsible Ledger Payment-In Remittance form (If not fully paid) */}
                      {!isCleared ? (
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
                          <span className="block text-[9px] font-mono font-black text-emerald-800 uppercase tracking-widest">Settle Outstanding Payment-In</span>
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
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[8px] uppercase font-mono text-slate-450 font-bold mb-1">Pay-in Amount</label>
                                <input
                                  type="number"
                                  name="pay-amount"
                                  min="1"
                                  max={calculatedDue}
                                  defaultValue={calculatedDue}
                                  required
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-emerald-500 text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] uppercase font-mono text-slate-450 font-bold mb-1">Payment Channel</label>
                                <select
                                  name="pay-method"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer font-sans text-slate-803 outline-none"
                                >
                                  <option value="Cash">Cash Drawer</option>
                                  <option value="M-Pesa">M-Pesa Express</option>
                                  <option value="MTN MoMo">MTN MoMo Net</option>
                                  <option value="Card">Visa Debit Card</option>
                                  <option value="Airtel Money">Airtel Money</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[8px] uppercase font-mono text-slate-450 font-bold mb-1">Payment Date</label>
                                <input
                                  type="date"
                                  name="pay-date"
                                  defaultValue={new Date().toISOString().split('T')[0]}
                                  required
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-sans outline-none text-slate-800"
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] tracking-wider uppercase rounded-lg border-none transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-white" />
                              <span>Submit Payment-In Reference</span>
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="bg-emerald-100/50 border border-emerald-200 p-3 rounded-xl flex items-center space-x-2 text-emerald-800 font-bold text-[11px] font-sans">
                          <CheckCircle2 className="w-4 h-4 text-emerald-650 shrink-0" />
                          <span>Cleared Account: Consolidated to tills ledger successfully!</span>
                        </div>
                      )}
                    </div>

                    {/* Progress indicator */}
                    <div className="mt-4 space-y-1.5 font-sans">
                      <div className="flex justify-between font-mono text-[10px] font-bold text-slate-450 uppercase leading-none">
                        <span>Reconciliation</span>
                        <span>{currentPercent}% Reconciled</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                        <div 
                          className="bg-emerald-600 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${currentPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between font-mono text-[10px] font-bold text-slate-650 bg-slate-50 border border-slate-150 p-2 rounded-lg mt-1.5">
                        <span className="text-slate-450">Paid: {currency}{Math.round(calculatedPaid).toLocaleString()}</span>
                        <span className="text-rose-650">Bal: {currency}{Math.round(calculatedDue).toLocaleString()}</span>
                      </div>
                    </div>

                  </div>
                );
              })}

              {filteredDebtSales.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-450 font-sans">
                  No outstanding credit accounts match search keyword or custom criteria.
                </div>
              )}
            </div>

          </div>
        );
      })()}
      {/* SECTION C: CASH DRAWER SHIFT CLOSE & SETTLEMENTS (PAYMENT-INS) */}
      {activeSubTab === 'settlement' && (() => {
        // Gating subscription tier logic
        const planTier = localStorage.getItem(`plan_tier_${activeTenant.id}`) || 'premium';
        const isPremium = planTier === 'premium';

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
          localStorage.removeItem(`float_verified_${activeTenant.id}`);

          setTimeout(() => {
            setSettleSuccessMsg(null);
          }, 6000);
        };

        const toggleFeatureGateSim = () => {
          const nextTier = planTier === 'premium' ? 'standard' : 'premium';
          localStorage.setItem(`plan_tier_${activeTenant.id}`, nextTier);
          // Simple trigger reload or message
          setSettleSuccessMsg(`Membership tier changed to: ${nextTier.toUpperCase()}`);
          setTimeout(() => setSettleSuccessMsg(null), 3000);
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
                      Tenant Level: <span className="text-emerald-400 capitalize underline px-1">{planTier}</span>
                    </h4>
                    <span className="text-xs text-slate-400">•</span>
                    <p className="text-[11px] text-slate-300">
                      Shift Settle and Cash Drawer tracking restricted to <strong className="font-bold">Premium Tier</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleFeatureGateSim}
                  className="px-3.5 py-1.5 bg-indigo-950 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 text-[10px] font-mono font-bold uppercase rounded-lg border border-indigo-800/40 cursor-pointer transition-all"
                >
                  🔄 Toggle Tenant Plan ({planTier === 'premium' ? 'Downgrade' : 'Upgrade Premium'})
                </button>
              </div>
            )}

            {!isPremium && isAdmin ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-6 shadow-sm mx-auto max-w-xl animate-fade-in my-8">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 border border-rose-100 animate-pulse">
                  <XOctagon className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-md font-bold text-slate-800 uppercase tracking-wider font-mono">Premium Sub Ledger Workspace Locked</h3>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto font-sans">
                    Shift settlement is premium.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(`plan_tier_${activeTenant.id}`, 'premium');
                      setSettleSuccessMsg("🎉 Premium plan unlocked! Drawer auditing and shift settling are now available.");
                      setTimeout(() => setSettleSuccessMsg(null), 4050);
                    }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-md cursor-pointer border-none"
                  >
                    ✨ Activate Premium Tier & Unlock (Single-Click Bypass)
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="shift-settlements-view">
                
                {/* COLUMN 1 (6 Cols): ACTIVE SHIFT SETTLEMENT & CASH HANDOFF FORM */}
                <div className="lg:col-span-5 border border-slate-205 bg-white p-6 rounded-3xl shadow-sm space-y-5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">Shift Close & Till Handoff</h3>
                    <p className="text-[11px] text-slate-450 mt-1">
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
                          <label className="block text-[8px] font-mono font-bold uppercase text-slate-450 mb-1">Counted Opening Float ({currency})</label>
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
                              localStorage.setItem(`float_verified_${activeTenant.id}`, 'false');
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
                              localStorage.setItem(`float_verified_${activeTenant.id}`, 'true');
                              localStorage.setItem(`float_verified_time_${activeTenant.id}`, nowTime);
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
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1">
                        <span className="block text-[8px] font-mono font-bold uppercase text-slate-400">Opening Float</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] text-slate-450 font-mono">{currency}</span>
                          <span className="text-xs font-mono font-black text-slate-755">{settleOpeningFloat}</span>
                        </div>
                        <span className="block text-[9px] text-slate-400 italic">Read-only preset</span>
                      </div>

                      {/* Shift Pay-Ins */}
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1">
                        <label className="block text-[8px] font-mono font-bold uppercase text-slate-450">Shift Pay-Ins</label>
                        <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                          <span className="text-[9px] text-slate-450 font-mono">{currency}</span>
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
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1">
                        <label className="block text-[8px] font-mono font-bold uppercase text-slate-455">Shift Pay-Outs</label>
                        <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                          <span className="text-[9px] text-slate-450 font-mono">{currency}</span>
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
                              const itemsSummary = s.items.map(i => `${i.productName} (x${i.qty})`).join(', ');
                              return (
                                <div key={s.id} className="bg-white border border-slate-150 p-2 rounded-xl flex items-center justify-between text-[11px] hover:border-indigo-300 transition-all">
                                  <div>
                                    <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                                      <span className="text-indigo-600">{s.id}</span>
                                      <span className="text-slate-400 font-mono text-[9px]">{new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="text-[9.5px] text-slate-450 truncate max-w-[170px]" title={itemsSummary || 'Customer Sale Record'}>{itemsSummary || 'Customer Sale Record'}</div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-mono font-bold text-emerald-800">+{currency}{(s.amountPaid !== undefined ? s.amountPaid : s.total).toLocaleString()}</span>
                                    <span className="block text-[8px] uppercase font-mono font-black text-slate-400">Cash POS</span>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {todayCashInstalls.map((inst, index) => (
                              <div key={index} className="bg-white border border-slate-150 p-2 rounded-xl flex items-center justify-between text-[11px] hover:border-indigo-300 transition-all">
                                <div>
                                  <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                                    <span className="text-rose-600">DEBT-PAY</span>
                                    <span className="text-slate-400 font-mono text-[9px]">{new Date(inst.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  </div>
                                  <div className="text-[9.5px] text-slate-450 truncate max-w-[170px]">Installment for Ticket {inst.saleId}</div>
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
                            <label className="block text-[8px] font-mono font-bold uppercase text-slate-450 mb-1">Beneficiary Name</label>
                            <input
                              type="text"
                              required
                              value={settleRecipientName}
                              onChange={(e) => setSettleRecipientName(e.target.value)}
                              placeholder="e.g. Lilian Mbawala (Manager)"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] font-mono font-bold uppercase text-slate-450 mb-1">Payout Channel Type</label>
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
                              <span className="text-[10px] text-slate-450 font-mono">({settleReceiptFile.size})</span>
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
                          <div className="space-y-1 text-slate-450 pointer-events-none">
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans text-slate-755 outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[10px]"
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
                        <p className="text-[11px] text-slate-450 mt-1">Shift settlement.</p>
                      </div>
                      <div className="bg-slate-100 px-2.5 py-1.5 rounded-lg font-mono text-[10px] text-indigo-700 font-bold border border-slate-205">
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
                              <td className="p-2.5 font-bold font-sans text-slate-805">
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
                                {st.memo && <div className="text-[10px] text-slate-450 italic mt-0.5 truncate max-w-[150px]">{st.memo}</div>}
                                
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
                  <div className="border border-slate-205 bg-indigo-950 text-indigo-50 p-6 rounded-3xl shadow-sm space-y-4">
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
            )}

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
                  {(['all', 'price quote', 'price quote invoice'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedDocTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize cursor-pointer transition-all ${
                        selectedDocTypeFilter === t
                          ? 'bg-white text-slate-950 shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-850'
                      }`}
                    >
                      {t === 'all' ? 'Show All' : t}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map(doc => {
                const subTotal = doc.items.reduce((sum, item) => {
                  const itemPrice = item.discountType === 'cash' ? Math.max(0, item.price - item.discount) : item.price * (1 - item.discount / 100);
                  return sum + (itemPrice * item.qty);
                }, 0);
                return (
                  <div key={doc.id} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm hover:border-slate-355 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider font-mono ${
                          doc.type === 'price quote' ? 'bg-indigo-55 text-indigo-700 border border-indigo-200' :
                          'bg-amber-100/70 text-amber-700 border border-amber-200'
                        }`}>
                          {doc.type}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          {doc.documentNumber}
                        </span>
                      </div>

                      <div className="mt-4 space-y-1">
                        <h4 className="font-bold text-slate-800 text-sm font-sans">{doc.customerName || 'Walk-In Customer'}</h4>
                        {doc.customerPhone && <p className="text-[11px] text-slate-500 font-mono">📞 {doc.customerPhone}</p>}
                        <p className="text-[10px] text-slate-400 font-mono">📅 {new Date(doc.timestamp).toLocaleDateString()}</p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Items ({doc.items.length})</div>
                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                          {doc.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-slate-650 font-sans">
                              <span>{it.qty}x {it.productName}</span>
                              <span className="font-bold font-mono text-slate-700">{currency}{Math.round(it.price * it.qty).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[8px] uppercase tracking-wider font-bold text-slate-400 font-sans">Grand Total</div>
                        <div className="text-sm font-black font-mono text-slate-900">{currency}{Math.round(subTotal).toLocaleString()}</div>
                      </div>

                      <div className="flex items-center space-x-1.5 font-sans">
                        <button
                          type="button"
                          onClick={() => setViewingDocument(doc)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-205 hover:border-slate-300 text-slate-650 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-450" />
                          <span>A4 View</span>
                        </button>
                        
                        {doc.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => {
                              sendDocumentToSales(doc);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10.5px] transition-all border-none cursor-pointer flex items-center space-x-1 shadow-sm"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Record as Sale</span>
                          </button>
                        ) : (
                          <span className="px-2 py-1.5 bg-slate-100 text-slate-450 border border-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center space-x-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Converted ✓</span>
                          </span>
                        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800">
          
          {/* CONDITION A: A4 CORPORATE INVOICE MODE */}
          {viewA4InvoiceOpen ? (
            <div className="relative bg-white border border-slate-205 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] font-sans">
              
              {/* Header branding */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="text-xs font-mono font-bold tracking-wider uppercase text-indigo-400">Official ERP Suite Document</span>
                    <h4 className="text-sm font-black tracking-tight text-white leading-none">Corporate A4 Invoice Viewer</h4>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      setViewA4InvoiceOpen(false); // Quick toggle back to POS narrow mode
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-705 text-xs font-bold rounded-lg text-slate-305 transition-all select-none cursor-pointer"
                  >
                    Switch to Narrow Thermal POS
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedSale(null);
                      setViewA4InvoiceOpen(false);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable A4 Document Sheet */}
              <div className="p-8 overflow-y-auto max-h-[75vh] space-y-8 bg-slate-50">
                <div id="sales-invoice-a4-pdf-template" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl mx-auto space-y-8 relative select-text">
                  
                  {/* Decorative Paid/Unpaid background watermark stamp */}
                  <div className="absolute top-8 right-8 select-none pointer-events-none opacity-10 rotate-12">
                    {(() => {
                      const initialPaid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : selectedSale.total);
                      const extra = (installmentRecords[selectedSale.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
                      const isComplete = (initialPaid + extra) >= selectedSale.total;
                      return isComplete ? (
                        <div className="border-[6px] border-emerald-600 text-emerald-605 text-2xl font-black uppercase px-4 py-2 rounded-xl">
                          FULLY PAID
                        </div>
                      ) : (
                        <div className="border-[6px] border-rose-600 text-rose-605 text-2xl font-black uppercase px-4 py-2 rounded-xl">
                          BALANCE DUE
                        </div>
                      );
                    })()}
                  </div>

                  {/* Header Row: Company Title vs Invoice Meta */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 pb-6">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl">
                          <Building className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-850">{activeTenant.name}</h2>
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm uppercase leading-relaxed font-semibold">
                        {activeTenant.businessType === 'pharmacy' ? 'Clinical Pharmacy Dispensary' : 'Retail Branch'} — {activeTenant.city}, West Africa Operations • Smart POS Ledger Verified
                      </p>
                    </div>

                    <div className="space-y-1 text-left md:text-right font-mono text-xs">
                      <h3 className="text-base font-black font-sans text-slate-800 uppercase tracking-tight">TAX INVOICE</h3>
                      <p className="text-slate-400">INVOICE NO: <span className="font-bold text-slate-700">{selectedSale.reference || `INV-${selectedSale.id.toUpperCase().slice(0, 8)}`}</span></p>
                      <p className="text-slate-400">ISSUED DATE: <span className="text-slate-750">{new Date(selectedSale.timestamp).toLocaleDateString([], { dateStyle: 'long' })}</span></p>
                      <p className="text-slate-400">TELLER SIGN: <span className="font-bold text-slate-700 uppercase">{selectedSale.cashierName || 'Primary Admin'}</span></p>
                    </div>
                  </div>

                  {/* Address Columns: Billed-To vs Branch Registry */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 rounded-2xl p-6 text-xs text-slate-600">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono">CLIENT DETAILS (BILLED TO)</p>
                      {selectedSale.customerName ? (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-sm font-black text-slate-800">{selectedSale.customerName}</p>
                          <p className="flex items-center text-slate-500">
                            <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            <span>{selectedSale.customerPhone || 'No contact reference listed'}</span>
                          </p>
                          <p className="text-[10px] bg-slate-200 text-slate-705 font-bold font-mono px-2 py-0.5 rounded-md inline-block">
                            REGULAR CUSTOMER
                          </p>
                        </div>
                      ) : (
                        <div className="pt-1.5">
                          <p className="text-sm font-bold text-slate-500 italic">{activeTenant.businessType === 'pharmacy' ? 'Walk-In Patient' : 'Walk-In Retail Client'}</p>
                          <p className="text-[10px] text-slate-400">Unified Point of Sale Direct Cash Settlement</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-left md:text-right md:border-l md:border-slate-200/80 md:pl-6">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono">SETTLEMENT INFORMATION</p>
                      <div className="space-y-1">
                        <div className="flex md:justify-end space-x-2">
                          <span className="text-slate-400">CHANNEL:</span>
                          <span className="font-bold text-slate-800 uppercase">{selectedSale.paymentMethod}</span>
                        </div>
                        <div className="flex md:justify-end space-x-2">
                          <span className="text-slate-400">SYNC STAT:</span>
                          <span className={`font-bold uppercase ${selectedSale.syncStatus === 'synced' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {selectedSale.syncStatus}
                          </span>
                        </div>
                        <div className="flex md:justify-end space-x-2 pt-1 border-t border-slate-100 mt-2">
                          <span className="text-slate-400">NET DUE BALANCE:</span>
                          {(() => {
                            const initialPaid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : selectedSale.total);
                            const extra = (installmentRecords[selectedSale.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
                            const due = Math.max(0, selectedSale.total - (initialPaid + extra));
                            return (
                              <span className={`font-mono font-bold ${due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {currency}{due.toLocaleString()}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core A4 Invoice Line Items Table */}
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-mono font-black text-slate-400">LINE ITEMIZATION LEDGER</p>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-mono font-black text-slate-450 uppercase uppercase-tracking-widest">
                            <th className="p-3">Product Description / Code</th>
                            <th className="p-3 text-center">Unit Price Price</th>
                            <th className="p-3 text-center">Qty Qty</th>
                            <th className="p-3 text-center">Discount Portion</th>
                            <th className="p-3 text-right">Line Subtotal Sum</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 font-sans">
                          {selectedSale.items.map((item, index) => {
                            const isItemCash = item.discountType === 'cash';
                            const priceAfterDiscount = isItemCash 
                              ? Math.max(0, item.price - item.discount)
                              : item.price * (1 - item.discount / 100);
                            return (
                              <tr key={index} className="hover:bg-slate-50/40 transition-colors">
                                <td className="p-3">
                                  <p className="font-bold text-slate-800">{item.productName}</p>
                                  <p className="text-[10px] text-slate-450 font-mono">PRODUCT CODE: {item.productId.toUpperCase().slice(0, 10)}</p>
                                </td>
                                <td className="p-3 text-center font-mono">
                                  {currency}{item.price.toLocaleString()}
                                </td>
                                <td className="p-3 text-center font-bold">
                                  {item.qty}
                                </td>
                                <td className="p-3 text-center text-emerald-600 font-bold font-mono">
                                  {item.discount > 0 ? (isItemCash ? `${currency}${item.discount} Off` : `${item.discount}% OFF`) : '0%'}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900">
                                  {currency}{Math.round(priceAfterDiscount * item.qty).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bottom Financial Summaries Grid */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6 pt-2">
                    <div className="text-slate-400 text-[11px] leading-relaxed max-w-sm">
                      <p className="font-bold uppercase tracking-wider text-slate-500 mb-0.5">Corporate Settlement Note</p>
                      All issued invoice papers are digitally signed and verified across decentralized {activeTenant.businessType === 'pharmacy' ? 'clinical medical dispensaries' : 'retail branches'}. Taxes are registered strictly according to the statutory authority standard rate representing {activeTenant.taxRate * 100}% on net purchase price valuation dockets.
                    </div>

                    <div className="w-full md:w-72 bg-slate-55 border border-slate-200/80 rounded-2xl p-5 space-y-2 text-xs font-mono text-slate-600">
                      {(() => {
                        const taxableSub = selectedSale.total - selectedSale.tax - (selectedSale.deliveryCost || 0);
                        const discVal = selectedSale.discount || 0;
                        const hasDisc = discVal > 0;
                        const originalSub = hasDisc 
                          ? (selectedSale.discountType === 'cash' ? taxableSub + discVal : taxableSub / (1 - discVal / 100))
                          : taxableSub;
                        const discAmt = originalSub - taxableSub;
                        return (
                          <>
                            <div className="flex justify-between">
                              <span>ITEMS SUB-TOTAL</span>
                              <span>{currency}{Math.round(originalSub).toLocaleString()}</span>
                            </div>
                            {hasDisc && (
                              <div className="flex justify-between text-emerald-650 font-bold">
                                <span>ORDER DISCOUNT {selectedSale.discountType === 'cash' ? '' : `(${discVal}%)`}</span>
                                <span>-{currency}{Math.round(discAmt).toLocaleString()}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex justify-between">
                        <span>LEVIED VAT TAXES ({activeTenant.taxRate * 100}%)</span>
                        <span>{currency}{Math.round(selectedSale.tax).toLocaleString()}</span>
                      </div>
                      {selectedSale.deliveryCost !== undefined && selectedSale.deliveryCost > 0 && (
                        <div className="flex justify-between text-indigo-650 font-bold">
                          <span>DELIVERY COST</span>
                          <span>{currency}{Math.round(selectedSale.deliveryCost).toLocaleString()}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-sm">
                        <span>GRAND INVOICE SUM</span>
                        <span className="font-black text-slate-900">{currency}{Math.round(selectedSale.total).toLocaleString()}</span>
                      </div>

                      {(() => {
                        const initialPaid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : selectedSale.total);
                        const extra = (installmentRecords[selectedSale.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
                        const totalPaidNow = Math.min(selectedSale.total, initialPaid + extra);
                        const dueRemainder = Math.max(0, selectedSale.total - totalPaidNow);
                        return (
                          <>
                            <div className="flex justify-between text-emerald-700 font-bold">
                              <span>TOTAL PAYMENTS PAID</span>
                              <span>{currency}{Math.round(totalPaidNow).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-rose-700 font-bold border-t border-slate-100 pt-1.5">
                              <span>OUTSTANDING DUE</span>
                              <span>{currency}{Math.round(dueRemainder).toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Corporate Footer Badge */}
                  <div className="border-t border-slate-150 pt-6 text-center text-[10px] text-slate-400 font-mono uppercase tracking-widest leading-none">
                    {activeTenant.businessType === 'pharmacy' ? 'Certified Clinical Pharmacy System Verification' : 'Certified ISO 9001 Retail System Verification'} • {activeTenant.name} Invoice Ledger Database
                  </div>

                </div>
              </div>

              {/* Bottom Print Buttons */}
              <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                {/* WhatsApp Quick Link */}
                <div className="flex items-center space-x-2 flex-grow max-w-sm">
                  <span className="text-xs font-mono font-bold text-slate-500">+</span>
                  <input
                    type="text"
                    placeholder="WhatsApp Phone (e.g. 234803...)"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-white border border-slate-300 rounded-xl text-xs px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => shareSalePdf(selectedSale, whatsappPhone, 'a4')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 hover:text-white text-white rounded-xl text-xs font-bold whitespace-nowrap decoration-transparent inline-flex items-center space-x-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Send PDF</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedSale(null);
                      setViewA4InvoiceOpen(false);
                    }}
                    className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-150 font-bold rounded-xl text-slate-650 transition-all text-xs uppercase cursor-pointer select-none"
                    disabled={isReceiptPrinting}
                  >
                    Close Document
                  </button>
                  
                  <button
                    onClick={() => {
                      if (!selectedSale) return;
                      simulatePrint();
                      
                      // Download CSV representation of A4 Statement
                      const invoiceHeaders = "Invoice Line Item,Quantity,Unit Price (Base),Subtotal\r\n";
                      const invoiceRows = selectedSale.items.map(it => `"${it.productName}",${it.qty},${it.price},${it.qty * it.price}`).join("\r\n");
                      const invoiceSummary = `\r\nInvoice ID,${selectedSale.id}\r\nCustomer,${selectedSale.customerName || 'Walk-in Client'}\r\nDate,${new Date(selectedSale.timestamp).toLocaleDateString()}\r\nTotal Invoiced,${selectedSale.total}\r\nTax,${selectedSale.tax}\r\nRemaining Bal,${selectedSale.amountDue || 0}\r\nPayment Mode,${selectedSale.paymentMethod}\r\n`;
                      
                      const csvContent = "data:text/csv;charset=utf-8," + invoiceHeaders + invoiceRows + invoiceSummary;
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `Invoice_A4_${selectedSale.id}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-none transition-all text-xs uppercase flex items-center space-x-2 cursor-pointer shadow-md select-none"
                    disabled={isReceiptPrinting}
                  >
                    {isReceiptPrinting ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin text-white" />
                        <span>PREPARING DOWNLOAD...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-emerald-200" />
                        <span>Download A4 Invoice Only</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            
            /* CONDITION B: NARROW THERMAL POS SLIP RECEIPT MODE (ORIGINAL PRISTINE TICKET) */
            <div className="relative bg-white border border-slate-205 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
              
              {/* Header branding */}
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">Terminal Docket</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setViewA4InvoiceOpen(true)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded font-bold"
                  >
                    A4 View
                  </button>
                  <button 
                    onClick={() => setSelectedSale(null)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable ticket details */}
              <div id="sales-receipt-pdf-template" className="p-6 overflow-y-auto max-h-[70vh] space-y-6 font-mono text-xs select-text">
                
                {/* Receipt store branding block */}
                <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-200 flex flex-col items-center">
                  {(systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant?.company_settings?.logo_url) && (
                    <img 
                      src={systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant?.company_settings?.logo_url || undefined} 
                      alt="Receipt Logo" 
                      referrerPolicy="no-referrer"
                      className="max-h-12 max-w-[140px] object-contain rounded-lg mb-2 select-none"
                    />
                  )}
                  <h4 className="text-sm font-black tracking-tight text-slate-800 text-uppercase">{activeTenant.name}</h4>
                  <p className="text-[10px] text-slate-450 uppercase">{activeTenant.city}</p>
                  <p className="text-[10px] text-slate-400 leading-normal mt-1.5 font-bold text-slate-500">TAX REGISTER INVOICE DEBT VOUCHER</p>
                </div>

                {/* Core Docket Information details */}
                <div className="space-y-1.5 text-[11px] text-slate-650">
                  <div className="flex justify-between">
                    <span className="text-slate-400">RECEIPT NO</span>
                    <span className="font-bold text-slate-800">{selectedSale.reference || `REC-${selectedSale.id.toUpperCase().slice(0, 8)}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">DATE & TIME</span>
                    <span className="text-slate-800">{new Date(selectedSale.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">TELLER</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedSale.cashierName || 'Primary Teller'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">STORES CHANNEL</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded text-[10px] uppercase">{selectedSale.paymentMethod}</span>
                  </div>
                  {selectedSale.customerName && (
                    <div className="flex justify-between pt-1 border-t border-slate-105">
                      <span className="text-slate-400">CLIENT</span>
                      <span className="font-black text-slate-850 uppercase">{selectedSale.customerName}</span>
                    </div>
                  )}
                  {selectedSale.customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">CONTACT REF</span>
                      <span className="text-slate-800">{selectedSale.customerPhone}</span>
                    </div>
                  )}
                </div>

                {/* Items checklist table split */}
                <div className="space-y-2 border-t border-b border-dashed border-slate-200 py-4">
                  <p className="text-[9.5px] uppercase font-black text-slate-450 tracking-wider">Purchased items</p>
                  
                  <div className="space-y-3 font-sans">
                    {selectedSale.items.map((item, index) => {
                      const isItemCash = item.discountType === 'cash';
                      const priceAfterDiscount = isItemCash
                        ? Math.max(0, item.price - item.discount)
                        : item.price * (1 - item.discount / 100);
                      const itemProduct = products.find(product => product.id === item.productId);
                      return (
                        <div key={index} className="flex justify-between items-start text-xs text-slate-705">
                          <div className="space-y-0.5 max-w-[70%]">
                            <p className="font-bold text-slate-800 leading-tight">{item.productName}</p>
                            <p className="text-[10.5px] text-slate-450 font-mono">
                              {formatSaleItemQuantity(item, itemProduct)} x {currency}{item.price.toLocaleString()}
                              {item.discount > 0 && (
                                <span className="text-emerald-600 font-bold ml-1">
                                  ({isItemCash ? `${currency}${item.discount} Off` : `${item.discount}% Off`})
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-slate-900 shrink-0">
                            {currency}{Math.round(priceAfterDiscount * item.qty).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calculations tally */}
                <div className="space-y-1.5 font-mono text-[11px] text-slate-700">
                  {(() => {
                    const isVat = selectedSale.vatStatus === 'vat' || (selectedSale.tax > 0);
                    const taxAmt = isVat ? (selectedSale.tax || 0) : 0;
                    const delivery = selectedSale.deliveryCost || 0;
                    // Subtotal is total minus tax and delivery
                    const taxableSub = selectedSale.total - taxAmt - delivery;
                    const discVal = selectedSale.discount || 0;
                    const hasDisc = discVal > 0;
                    const originalSub = hasDisc 
                      ? (selectedSale.discountType === 'cash' ? taxableSub + discVal : taxableSub / (1 - discVal / 100))
                      : taxableSub;
                    const discAmt = originalSub - taxableSub;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>ITEMS SUB-TOTAL</span>
                          <span>{currency}{Math.round(originalSub).toLocaleString()}</span>
                        </div>
                        {hasDisc && (
                          <div className="flex justify-between text-emerald-700 font-bold font-mono">
                            <span>ORDER DISCOUNT {selectedSale.discountType === 'cash' ? '' : `(${discVal}%)`}</span>
                            <span>-{currency}{Math.round(discAmt).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>TAX COMPLIANCE REGISTER</span>
                          <span>{isVat ? `VAT (${Math.round(activeTenant.taxRate * 100)}%)` : 'NON-VAT (0%)'}</span>
                        </div>
                        {isVat && (
                          <div className="flex justify-between text-slate-500">
                            <span>VAT VALUE CHARGED</span>
                            <span>{currency}{Math.round(taxAmt).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {selectedSale.deliveryCost !== undefined && selectedSale.deliveryCost > 0 && (
                    <div className="flex justify-between text-indigo-700 font-bold font-mono">
                      <span>DELIVERY CHARGES</span>
                      <span>{currency}{Math.round(selectedSale.deliveryCost).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200/60 pt-2 text-[11px]">
                    <span>TOTAL INVOICE PRICE</span>
                    <span className="font-black text-slate-905">{currency}{Math.round(selectedSale.total).toLocaleString()}</span>
                  </div>

                  {/* TRA VFD fiscal signature block if VAT was charged */}
                  {selectedSale.vatStatus === 'vat' && selectedSale.vfdControlNo && (
                    <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-3 space-y-1 text-[9.5px] leading-relaxed text-slate-700 text-left my-2 shrink-0">
                      <p className="font-bold text-[9.5px] text-emerald-800 uppercase tracking-widest text-center border-b border-dashed border-emerald-250 pb-1 mb-1.5 font-sans">
                        TRA VFD FISCAL RECEIPT
                      </p>
                      <div className="flex justify-between font-mono">
                        <span>VFD Serial No:</span>
                        <span className="font-bold text-slate-800">TZ-VFD-REG-847294B</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>TRA Control No:</span>
                        <span className="font-bold text-emerald-950">{selectedSale.vfdControlNo}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Receipt Verification PIN:</span>
                        <span className="font-bold text-rose-800 select-all shrink-0">{selectedSale.vfdSignature}</span>
                      </div>
                      <p className="text-[8px] text-emerald-700 text-center italic mt-1.5 font-sans font-semibold">
                        ✓ Registered with Tanzania Money Earned Authority Gateway VFD Server.
                      </p>
                    </div>
                  )}

                  {(() => {
                    const initialPaid = selectedSale.amountPaid !== undefined ? selectedSale.amountPaid : (selectedSale.paymentMethod === 'Credit' ? 0 : selectedSale.total);
                    const extra = (installmentRecords[selectedSale.id] || []).reduce((sum, inst) => sum + inst.amount, 0);
                    const totalPaidNow = Math.min(selectedSale.total, initialPaid + extra);
                    const dueRemainder = Math.max(0, selectedSale.total - totalPaidNow);
                    return (
                      <>
                        <div className="flex justify-between text-emerald-700 font-bold pt-1.5 border-t border-slate-100">
                          <span>TOTAL AMOUNT PAID</span>
                          <span>{currency}{Math.round(totalPaidNow).toLocaleString()}</span>
                        </div>
                        {dueRemainder > 0 && (
                          <div className="flex justify-between text-rose-700 font-bold">
                            <span>OUTSTANDING DUE</span>
                            <span>{currency}{Math.round(dueRemainder).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Bottom footer bar codes */}
                <div className="text-center space-y-1.5 pt-4 border-t border-dashed border-slate-200 text-slate-400">
                  <span className="inline-block tracking-[0.3em] font-mono font-bold text-[13px] bg-slate-50 border border-slate-200 px-3 py-1 text-slate-800 rounded select-none">
                    *20260520TSUITE*
                  </span>
                  <p className="text-[9px] uppercase">Thank you.</p>
                </div>

              </div>

              {/* Print action bottom drawer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0">
                {/* WhatsApp Quick Link */}
                <div className="flex gap-2 items-center">
                  <div className="relative flex-grow">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">+</span>
                    <input
                      type="text"
                      placeholder="WhatsApp phone (e.g. 234803...)"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-white border border-slate-300 rounded-xl text-[11px] pl-5 pr-2 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => shareSalePdf(selectedSale, whatsappPhone, 'receipt')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 hover:text-white text-white rounded-xl text-xs font-bold whitespace-nowrap decoration-transparent flex items-center justify-center space-x-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Send PDF</span>
                  </button>
                </div>

                <div className="gap-2.5 flex">
                  <button
                    onClick={() => setSelectedSale(null)}
                    className="flex-grow py-2.5 border border-slate-300 hover:bg-slate-100 rounded-xl font-bold font-sans text-xs uppercase cursor-pointer text-slate-600 transition-colors"
                    disabled={isReceiptPrinting}
                  >
                    Close Ticket
                  </button>
                  
                  <button
                    onClick={simulatePrint}
                    className="flex-grow py-2.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-emerald-450 border-none rounded-xl font-bold font-sans text-xs uppercase cursor-pointer flex items-center justify-center space-x-1.5 transition-colors"
                    disabled={isReceiptPrinting}
                  >
                    {isReceiptPrinting ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span className="text-emerald-400">PRINT...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-3.5 h-3.5 text-emerald-455" />
                        <span>Reprint Slip</span>
                      </>
                    )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col font-sans">
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
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
            <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6">
              
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
                      <p className="text-[9.5px] uppercase font-mono font-black text-slate-450 tracking-wider">Original Sale Audit Info</p>
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
                              <div className="text-xs bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-1.5 shadow-xs bg-white">
                                <div className="flex justify-between items-center font-bold">
                                  <span className="text-slate-805 uppercase text-[10.5px] font-mono tracking-wider">{step.label}</span>
                                  <span className={`font-mono text-[11px] font-black ${step.isFull ? 'text-emerald-700' : 'text-indigo-705'}`}>
                                    {currency}{step.entered.toLocaleString()}
                                  </span>
                                </div>
                                {step.isFull ? (
                                  <div className="text-slate-500 text-[10px] font-sans">
                                    Paid Amount: <span className="font-mono font-bold text-slate-705">{currency}{step.entered.toLocaleString()}</span> (Fully Paid at checkout) using <span className="font-semibold uppercase text-slate-655 bg-indigo-50 px-1 py-0.5 rounded text-[9.5px] text-indigo-700">{step.method}</span>.
                                    <p className="text-[9.5px] text-slate-450 pt-1.5 font-mono">
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
                             <div className="bg-white border border-slate-150 rounded-xl p-3.5 space-y-1.5 font-sans shadow-xs">
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
                               <label className="block text-[9px] uppercase font-mono text-slate-450 font-bold mb-1">Amount</label>
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
                               <label className="block text-[9px] uppercase font-mono text-slate-450 font-bold mb-1">Payment Mode</label>
                               <select 
                                 name="channel"
                                 className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans cursor-pointer focus:outline-none"
                               >
                                 <option value="Cash">Cash Channel</option>
                                 <option value="Card">Visa/Card Till</option>
                                 <option value="M-Pesa">M-Pesa Express</option>
                                 <option value="MTN MoMo">MTN MoMo API</option>
                                 <option value="Paystack">Direct Paystack</option><option value="Airtel Money">Airtel Money</option></select></div><div><label className="block text-[9px] uppercase font-mono text-slate-450 font-bold mb-1">Payment Date</label><input type="date" name="paymentDate" defaultValue={new Date().toISOString().split("T")[0]} required className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold font-sans cursor-pointer focus:outline-none text-slate-800" /></div></div><div className="hidden"><div><select>
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
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 shrink-0 flex justify-end">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col font-sans max-h-[85vh] animate-scale-in">
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">View Sell Details</h4>
                  <p className="text-[10.5px] font-mono text-emerald-400 uppercase tracking-widest leading-none mt-0.5">
                    Reference: {getSaleReference(viewingSaleDetail)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingSaleDetail(null)}
                className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-lg cursor-pointer bg-transparent border-none"
                title="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read-only status indicator ribbon */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-[11px] font-sans font-bold text-slate-600 select-none">
              <div className="flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Read-Only Archive Tally</span>
              </div>
              <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] uppercase font-mono tracking-wider font-extrabold">
                Uneditable Ledger File
              </span>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Metadata key values */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div className="space-y-1 text-left">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Date & Time</span>
                  <span className="font-semibold text-slate-800 text-[11px]">
                    {formatShortDateTime(viewingSaleDetail.timestamp)}
                  </span>
                </div>
                <div className="space-y-1 text-left">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Payment Method</span>
                  <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-full font-bold text-[10px] mt-0.5">
                    {viewingSaleDetail.paymentMethod}
                  </span>
                </div>
                <div className="space-y-1 text-left">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Logged Cashier</span>
                  <span className="font-bold text-slate-700">
                    {viewingSaleDetail.cashierName || viewingSaleDetail.staffName || 'System Cashier'}
                  </span>
                </div>
                <div className="space-y-1 text-left">
                  <span className="block text-[8px] uppercase font-mono font-bold text-slate-400 tracking-wider">Customer Client</span>
                  <span className="font-extrabold text-indigo-950">
                    {viewingSaleDetail.customerName || 'Walk-In Customer'}
                  </span>
                </div>
              </div>

              {/* Product items list with images */}
              <div className="space-y-3 text-left">
                <h5 className="text-[10px] uppercase font-mono font-bold text-slate-45 tracking-wider">Items Purchased Checklist</h5>
                
                <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-white">
                  {viewingSaleDetail.items.map((item, index) => {
                    // Look up product to find image
                    const matchingProduct = products?.find(
                      p => p.id === item.productId || p.barcode === item.productId
                    );

                    return (
                      <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-all">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          {/* Image rendering with robust fallback */}
                          <div className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative">
                            {matchingProduct?.image ? (
                              <CachedImage 
                                src={matchingProduct.image} 
                                alt={item.productName} 
                                className="w-full h-full object-contain" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-[9px] font-mono font-bold text-slate-400 uppercase select-none">
                                <span className="text-slate-300 pointer-events-none mb-0.5 font-bold">PKG</span>
                                <span className="text-[7px] text-slate-350 tracking-tighter leading-none">
                                  {item.productName.slice(0, 3).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-xs truncate" title={item.productName}>
                              {item.productName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              QTY: <span className="font-extrabold text-slate-650">{item.qty}</span> × {currency}{item.price.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="text-right ml-4 shrink-0 font-sans">
                          <span className="text-[10px] text-slate-400 font-mono block">Line Total</span>
                          <span className="font-mono font-black text-xs text-slate-900">
                            {currency}{(item.price * item.qty).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Bottom Balance Tally Sheet */}
              <div className="border-t border-slate-100 pt-5 space-y-2 text-slate-600 text-xs">
                
                {/* Math variables */}
                {(() => {
                  const itemsSubtotal = viewingSaleDetail.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
                  const discountVal = viewingSaleDetail.discount !== undefined ? viewingSaleDetail.discount : 0;
                  const discountType = viewingSaleDetail.discountType || 'percent';
                  
                  const computedDiscountAmount = discountType === 'percent' 
                    ? itemsSubtotal * (discountVal / 100)
                    : discountVal;
                  
                  const taxVal = viewingSaleDetail.tax || 0;
                  const deliveryVal = viewingSaleDetail.deliveryCost || 0;
                  const grandTotalVal = viewingSaleDetail.total;

                  const isCredit = viewingSaleDetail.paymentMethod === 'Credit';
                  const initialPaid = viewingSaleDetail.amountPaid !== undefined ? viewingSaleDetail.amountPaid : (isCredit ? 0 : grandTotalVal);
                  const installments = installmentRecords[viewingSaleDetail.id] || [];
                  const extraPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);
                  const totalPaid = Math.min(grandTotalVal, initialPaid + extraPaid);
                  const remainingDue = Math.max(0, grandTotalVal - totalPaid);

                  return (
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-slate-600 font-medium">
                        <span>Items Sub-Total:</span>
                        <span className="font-mono font-semibold">{currency}{itemsSubtotal.toLocaleString()}</span>
                      </div>

                      {computedDiscountAmount > 0 && (
                        <div className="flex justify-between items-center text-red-650 font-bold">
                          <span>Total Discount Saved:</span>
                          <span className="font-mono">-{currency}{computedDiscountAmount.toLocaleString()}</span>
                        </div>
                      )}

                      {taxVal > 0 && (
                        <div className="flex justify-between items-center text-slate-500 font-medium">
                          <span>Sales Tax / VAT:</span>
                          <span className="font-mono">+{currency}{taxVal.toLocaleString()}</span>
                        </div>
                      )}

                      {deliveryVal > 0 && (
                        <div className="flex justify-between items-center text-slate-500 font-medium">
                          <span>Delivery Surcharge:</span>
                          <span className="font-mono">+{currency}{deliveryVal.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-sm font-black text-slate-900 border-t border-slate-100 pt-2.5">
                        <span>Grand Invoice Total:</span>
                        <span className="font-mono font-black text-emerald-800 text-sm">
                          {currency}{grandTotalVal.toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <div className="text-left font-bold text-slate-600">
                          <span>Total Paid:</span>
                          <span className="block font-mono font-black text-emerald-700 text-xs mt-0.5">
                            {currency}{totalPaid.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right font-bold text-slate-600">
                          <span className="text-rose-750">Remainder Balance Due:</span>
                          <span className="block font-mono font-black text-rose-750 text-xs mt-0.5">
                            {currency}{remainingDue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>

            </div>

            {/* Bottom button footer panel */}
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 shrink-0 flex justify-end">
              <button
                onClick={() => setViewingSaleDetail(null)}
                className="px-6 py-2.5 bg-slate-900 text-white text-[10px] tracking-wider uppercase font-extrabold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer select-none border-none shadow-xs"
              >
                Done Viewing
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: EDIT TRANSACTION TRANSACTION (CASHIER ADMIN EDITS) */}
      {/* ------------------------------------------------------------- */}
      {editingSale && editFormFields && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-sans max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-amber-500" />
                <div>
                  <h4 className="text-sm font-black tracking-tight">Modify Transaction Form</h4>
                  <p className="text-[10.5px] font-mono text-amber-500 uppercase tracking-widest leading-none">ID: {editingSale.reference || editingSale.id.toUpperCase()}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setEditingSale(null);
                  setEditFormFields(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Body panel */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              
              {/* Client meta details information */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[9px] uppercase font-mono text-slate-450 font-bold mb-1">Purchaser Client Name</label>
                  <input
                    type="text"
                    value={editFormFields.customerName}
                    onChange={(e) => setEditFormFields({ ...editFormFields, customerName: e.target.value })}
                    placeholder="Walk-In Customer"
                    className="w-full bg-slate-50 border border-slate-240 rounded-xl px-3 py-2 text-slate-800 text-xs font-semibold focus:outline-none focus:border-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-mono text-slate-450 font-bold mb-1">Purchaser Client Phone</label>
                  <input
                    type="text"
                    value={editFormFields.customerPhone}
                    onChange={(e) => setEditFormFields({ ...editFormFields, customerPhone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full bg-slate-50 border border-slate-240 rounded-xl px-3 py-2 text-slate-800 text-xs font-semibold focus:outline-none focus:border-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[9px] uppercase font-mono text-slate-450 font-bold mb-1">Payment Method</label>
                  <select
                    value={editFormFields.paymentMethod}
                    onChange={(e: any) => setEditFormFields({ ...editFormFields, paymentMethod: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-240 rounded-xl px-2.5 py-2 text-xs font-bold font-sans cursor-pointer focus:outline-none focus:border-slate-800 focus:bg-white"
                  >
                    <option value="Cash">Cash Channel</option>
                    <option value="Card">Visa / Master Card</option>
                    <option value="M-Pesa">M-Pesa Wallet</option>
                    <option value="MTN MoMo">MTN MoMo API</option>
                    <option value="Paystack">Direct Paystack Gateway</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="Credit">Issued Credit Sales</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-mono text-slate-450 font-bold mb-1">Adjust Amount Paid Initially</label>
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
                          <p className="font-bold text-slate-850 truncate">{item.productName}</p>
                          <p className="text-[10px] font-mono text-slate-450">
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
                            className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-650 cursor-pointer text-center font-bold font-sans text-xs flex items-center justify-center select-none"
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
                            className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-650 cursor-pointer text-center font-bold font-sans text-xs flex items-center justify-center select-none"
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
                              const items = editFormFields.items.filter((_, idx) => idx !== index);
                              setEditFormFields({ ...editFormFields, items });
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-800 rounded-lg transition-all cursor-pointer border-none"
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
                const taxAmt = Math.round(subAmt * activeTenant.taxRate);
                const totalAmt = subAmt + taxAmt;
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-600 flex justify-between">
                    <div>
                      <p className="text-[9px] uppercase font-sans text-slate-405 font-bold mb-0.5">VAT TAXES ESTIMATED ({activeTenant.taxRate * 100}%)</p>
                      <p className="font-bold text-slate-700">{currency}{taxAmt.toLocaleString()}</p>
                    </div>
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
                  setEditingSale(null);
                  setEditFormFields(null);
                }}
                className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs uppercase select-none"
              >
                Cancel Changes
              </button>
              
              <button
                type="button"
                onClick={() => {
                  if (!editingSale || !editFormFields || !onUpdateSales) return;
                  const itemSubtotal = editFormFields.items.reduce((sum, item) => {
                    const isItemCash = item.discountType === 'cash';
                    const priceAfterDiscount = isItemCash 
                      ? Math.max(0, item.price - item.discount)
                      : item.price * (1 - item.discount / 100);
                    return sum + (priceAfterDiscount * item.qty);
                  }, 0);
                  const calculatedTax = Math.round(itemSubtotal * activeTenant.taxRate);
                  const calculatedTotal = itemSubtotal + calculatedTax;

                  const updatedSale: Sale = {
                    ...editingSale,
                    customerName: editFormFields.customerName.trim() || undefined,
                    customerPhone: editFormFields.customerPhone.trim() || undefined,
                    paymentMethod: editFormFields.paymentMethod,
                    items: editFormFields.items,
                    tax: calculatedTax,
                    total: calculatedTotal,
                    amountPaid: editFormFields.amountPaid
                  };

                  const newSales = sales.map(s => s.id === editingSale.id ? updatedSale : s);
                  onUpdateSales(newSales);
                  setEditingSale(null);
                  setEditFormFields(null);
                }}
                className="px-5 py-2.5 bg-yellow-650 hover:bg-amber-600 text-white font-black rounded-xl border-none transition-all text-xs uppercase flex items-center space-x-1.5 cursor-pointer shadow-md select-none"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Save Adjusted Ledger</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: CONFIRM DELETE SALE (TICKET VOIDING) */}
      {/* ------------------------------------------------------------- */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col font-sans">
            
            {/* Header */}
            <div className="bg-rose-950 text-white px-6 py-4 flex items-center justify-between border-b border-rose-900 shrink-0 select-none border-b-none p-4">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-rose-400 animate-bounce" />
                <div>
                  <h4 className="text-sm font-black tracking-tight">Void Transaction Record</h4>
                  <span className="text-[10px] font-mono text-rose-450 uppercase tracking-widest block font-bold leading-none mt-1">WARNING: IRREVERSIBLE OPERATION</span>
                </div>
              </div>
              <button 
                onClick={() => setSaleToDelete(null)}
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
                  <p className="text-xs text-slate-750 font-semibold leading-relaxed">
                    You are attempting to completely erase checkouout record <strong className="font-bold text-rose-750 font-mono">{saleToDelete.reference || saleToDelete.id.toUpperCase()}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    This will void the receipt.
                  </p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-2.5 text-xs text-slate-600 font-sans">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-800">{saleToDelete.customerName || 'Walk-In Client'}</span>
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
            </div>

            {/* Actions Drawer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs uppercase select-none"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={() => {
                  if (onUpdateSales) {
                    const nextSales = sales.filter(s => s.id !== saleToDelete.id);
                    onUpdateSales(nextSales);
                  }
                  setSaleToDelete(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl border-none transition-all text-xs uppercase flex items-center space-x-1.5 cursor-pointer shadow-md select-none"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>Confirm Void Ticket</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DIALOG: NEW DOCUMENT CREATOR MODAL */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="relative bg-white border border-slate-205 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] font-sans">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-800">New Commercial Sales Document Wizard</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewDocModal(false)}
                className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-450 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Metadata config */}
              <div className="space-y-4">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">1. Document Settings & Header</span>
                
                <div>
                  <label className="block text-xs font-bold text-slate-650 mb-1">Select Document Class</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['price quote', 'price quote invoice'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewDocType(t)}
                        className={`py-2 px-3 border rounded-xl font-bold text-xs capitalize cursor-pointer transition-all ${
                          newDocType === t
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-650 mb-1">Client Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Lipa Traders Ltd"
                      value={newDocCustomerName}
                      onChange={(e) => setNewDocCustomerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-650 mb-1">Customer Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. +254 755 123 456"
                      value={newDocCustomerPhone}
                      onChange={(e) => setNewDocCustomerPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-650 mb-1">Billing & Delivery Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Pipeline St, Nairobi, Kenya"
                    value={newDocCustomerAddress}
                    onChange={(e) => setNewDocCustomerAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-650 mb-1">Document Date</label>
                    <input
                      type="date"
                      value={newDocDate}
                      onChange={(e) => setNewDocDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500 cursor-pointer"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-650 mb-1">Delivery / Transport Cost ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      value={newDocDeliveryCost || ''}
                      onChange={(e) => setNewDocDeliveryCost(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-650 mb-1">Payment Method</label>
                    <select
                      value={newDocPaymentMethod}
                      onChange={(e) => setNewDocPaymentMethod(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500"
                    >
                      {(systemSettings?.business?.paymentModes?.length ? systemSettings.business.paymentModes : ['Cash', 'Card', 'M-Pesa', 'Bank']).map(mode => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* VAT Toggle Choice */}
                <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <input
                    type="checkbox"
                    id="newDocHasVatCheckbox"
                    checked={newDocHasVat}
                    onChange={(e) => setNewDocHasVat(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                  />
                  <div className="leading-snug">
                    <label htmlFor="newDocHasVatCheckbox" className="text-xs font-bold text-slate-705 cursor-pointer select-none">
                      Compute VAT (Value Added Tax 18%)
                    </label>
                    <p className="text-[10px] text-slate-400">Hide VAT when unchecked.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-650 mb-1">Invoice Footer Tagline / Memo</label>
                  <textarea
                    rows={2}
                    placeholder="Footer note..."
                    value={newDocTagline}
                    onChange={(e) => setNewDocTagline(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500 resize-none font-sans"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Shown in document footer.</p>
                </div>
              </div>

              {/* Right Column: Adding Items and ledger preview */}
              <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-150 md:pl-8 pt-6 md:pt-0">
                <div className="space-y-4 font-sans">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">2. Itemized Ledger list ({newDocItems.length})</span>
                  
                  {/* Select product row with search box */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-450 font-mono">Product Search & Picker Tool</span>
                    <div className="space-y-2">
                      
                      {/* Search box for product code or barcode */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search product by name or barcode..."
                          value={docWizardProductSearchQuery}
                          onChange={(e) => setDocWizardProductSearchQuery(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs font-medium text-slate-850 focus:outline-emerald-500"
                        />
                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        {docWizardProductSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDocWizardProductSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <select
                        value={docWizardSelectedProductId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDocWizardSelectedProductId(val);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Product Item --</option>
                        {products
                          .filter(p => {
                            const query = docWizardProductSearchQuery.toLowerCase().trim();
                            if (!query) return true;
                            const matchName = p.name ? p.name.toLowerCase().includes(query) : false;
                            const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(query) : false;
                            return matchName || matchBarcode;
                          })
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.name} {p.barcode ? `[${p.barcode}]` : ''} ({currency}{p.sellingPrice.toLocaleString()})</option>
                          ))}
                      </select>

                      <div className="flex gap-2 font-sans">
                        <div className="w-1/2">
                          <label className="block text-[8px] uppercase text-slate-405 font-bold mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={docWizardSelectedQty}
                            onChange={(e) => setDocWizardSelectedQty(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-850 font-sans font-bold"
                          />
                        </div>
                        <div className="w-1/2">
                          <label className="block text-[8px] uppercase text-slate-405 font-bold mb-1">Disc (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={docWizardSelectedDiscount}
                            onChange={(e) => setDocWizardSelectedDiscount(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-850 font-sans font-bold"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!docWizardSelectedProductId) return;
                          const found = products.find(p => p.id === docWizardSelectedProductId);
                          if (!found) return;

                          const existingIdx = newDocItems.findIndex(x => x.productId === found.id);
                          if (existingIdx >= 0) {
                            const updated = [...newDocItems];
                            updated[existingIdx].qty += docWizardSelectedQty;
                            setNewDocItems(updated);
                          } else {
                            const newItem: SaleItem = {
                              productId: found.id,
                              productName: found.name,
                              qty: docWizardSelectedQty,
                              price: found.sellingPrice,
                              discount: docWizardSelectedDiscount,
                              discountType: 'percent'
                            };
                            setNewDocItems(prev => [...prev, newItem]);
                          }

                          setDocWizardSelectedProductId('');
                          setDocWizardSelectedQty(1);
                          setDocWizardSelectedDiscount(0);
                        }}
                        disabled={!docWizardSelectedProductId}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl border-none transition-all cursor-pointer disabled:bg-slate-200 disabled:cursor-not-allowed font-sans"
                      >
                        Append to Document List
                      </button>
                    </div>
                  </div>

                  {/* List of currently chosen items */}
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {newDocItems.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-xs font-sans">
                        <div>
                          <p className="font-bold text-slate-850">{item.productName}</p>
                          <span className="text-[10px] text-slate-500 font-mono">Qty: {item.qty} | Price: {currency}{item.price}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-mono text-slate-705">{currency}{Math.round(item.qty * item.price * (1 - item.discount / 100)).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => setNewDocItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 font-bold text-xs p-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {newDocItems.length === 0 && (
                      <p className="text-center italic text-slate-400 text-xs py-8">Select and add catalog items above.</p>
                    )}
                  </div>
                </div>

                {/* Sub Total and create document with rich ledger details */}
                <div className="pt-4 border-t border-slate-200 mt-4 space-y-3 font-sans">
                  {/* Detailed pricing ledger */}
                  <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                    <div className="flex justify-between">
                      <span>Subtotal ({newDocItems.length} styles):</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {currency}
                        {newDocItems.reduce((sum, item) => sum + (item.qty * item.price * (1 - item.discount / 100)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {newDocHasVat && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Value Added Tax (VAT 18%):</span>
                        <span className="font-bold font-mono">
                          +{currency}
                          {(newDocItems.reduce((sum, item) => sum + (item.qty * item.price * (1 - item.discount / 100)), 0) * 0.18).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {Number(newDocDeliveryCost) > 0 && (
                      <div className="flex justify-between text-indigo-700">
                        <span>Delivery / Logistic Cost:</span>
                        <span className="font-bold font-mono">
                          +{currency}
                          {Number(newDocDeliveryCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed border-slate-200 text-slate-900 font-bold">
                      <span>Computed Grand Total:</span>
                      <span className="font-black text-slate-950 font-mono text-base">
                        {currency}
                        {(() => {
                          const subSum = newDocItems.reduce((sum, item) => sum + (item.qty * item.price * (1 - item.discount / 100)), 0);
                          const taxSum = newDocHasVat ? subSum * 0.18 : 0;
                          const shippingSum = Number(newDocDeliveryCost) || 0;
                          return (subSum + taxSum + shippingSum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        })()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={newDocItems.length === 0}
                    onClick={() => {
                      const prefixMap = {
                        price quote: 'QUO',
                        'price quote invoice': 'PFI'
                      };
                      const prefix = prefixMap[newDocType] || 'DOC';
                      const nextNum = `${prefix}-2026-${Math.floor(1000 + Math.random() * 9000)}`;
                      
                      const subSum = newDocItems.reduce((sum, item) => sum + (item.qty * item.price * (1 - item.discount / 100)), 0);
                      const taxSum = newDocHasVat ? subSum * 0.18 : 0;
                      const shippingSum = Number(newDocDeliveryCost) || 0;
                      const totalSum = subSum + taxSum + shippingSum;

                      const nextDoc: SalesDocument = {
                        id: 'doc-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                        type: newDocType,
                        documentNumber: nextNum,
                        items: newDocItems,
                        total: totalSum,
                        tax: taxSum,
                        deliveryCost: shippingSum,
                        paymentMethod: newDocPaymentMethod,
                        hasVat: newDocHasVat,
                        customerName: newDocCustomerName.trim() || 'Walk-In Customer',
                        customerPhone: newDocCustomerPhone.trim() || undefined,
                        customerAddress: newDocCustomerAddress.trim() || undefined,
                        timestamp: new Date(newDocDate).toISOString(),
                        tenantId: activeTenant.id,
                        status: 'pending',
                        tagline: newDocTagline.trim() || undefined
                      };

                      setDocuments(prev => [nextDoc, ...prev]);
                      setShowNewDocModal(false);
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-xl border-none transition-all cursor-pointer shadow-md font-sans"
                  >
                    ✓ Save & Deploy {newDocType} slip
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: VIEW & PRINT A4 COMMERCIAL DOCUMENT LAYOUT */}
      {viewingDocument && (() => {
        const subTotal = viewingDocument.items.reduce((sum, item) => {
          const itemPrice = item.discountType === 'cash' ? Math.max(0, item.price - item.discount) : item.price * (1 - item.discount / 100);
          return sum + (itemPrice * item.qty);
        }, 0);

        const activeStaff = systemSettings?.staffs?.find(
          s => s.name.toLowerCase() === (currentUser?.name || '').toLowerCase()
        );
        const preparerName = activeStaff?.name || currentUser?.name || systemSettings?.invoiceSettings?.authorisedPerson || 'Lilian Mbawala';
        const preparerRole = activeStaff?.role || currentUser?.role || 'Accounts & Finance Dept';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in text-slate-800">
            <div className="relative bg-white border border-slate-205 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[95vh] font-sans" style={{overflow: 'clip'}}>
              
              {/* Header Action Tools */}
              <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur-md shrink-0 font-sans print:hidden">
                <div className="p-3 sm:p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Printer className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-black font-mono text-slate-800 uppercase truncate">A4 Office Print Preview Mode</span>
                  </div>
	                  <div className="hidden">
                    <button
                      type="button"
                      onClick={() => {
                        if (viewingDocument.customerPhone?.trim()) {
                          sharePdfDocument(viewingDocument, viewingDocument.customerPhone);
                        } else {
                          setDocumentSendOpen(prev => !prev);
                        }
                      }}
                      className="h-10 px-3 sm:px-4 bg-slate-900 hover:bg-slate-800 text-white text-[11px] sm:text-xs font-black uppercase rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm font-sans whitespace-nowrap"
                    >
                      <MessageSquare className="w-4 h-4 text-white" />
                      <span>Send</span>
                    </button>
                    <button
                      type="button"
                      disabled={viewingDocument.status !== 'pending'}
                      onClick={() => sendDocumentToSales(viewingDocument)}
                      className="h-10 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[11px] sm:text-xs font-black uppercase rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm font-sans whitespace-nowrap"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Record as Sale</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingDocument(null)}
                      className="h-10 px-3 sm:px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-650 text-[11px] sm:text-xs font-bold rounded-xl cursor-pointer transition-all font-sans whitespace-nowrap"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
	              </div>

              {/* Printable Area content representation matching layout templates */}
	              <div className="flex-1 overflow-auto bg-slate-200/70 p-3 sm:p-6 lg:p-10 print:p-0 print:bg-white print:overflow-visible" id="printable-a4-surface">
                <div id="sales-document-a4-pdf-template" className="w-full max-w-[794px] min-h-[1123px] mx-auto bg-white rounded-2xl sm:rounded-[2rem] shadow-xl border border-slate-200 p-6 sm:p-10 lg:p-14 space-y-8 font-sans print:max-w-none print:min-h-0 print:rounded-none print:shadow-none print:border-0 print:p-0">
                  
                  {/* Decorative corporate banner on top */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                    <div className="min-w-0">
                      {(systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant?.company_settings?.logo_url) ? (
                        <img 
                          src={systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant?.company_settings?.logo_url || undefined} 
                          alt="Merchant Logo" 
                          referrerPolicy="no-referrer"
                          className="max-h-16 max-w-[200px] object-contain rounded-xl select-none mb-3"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center text-sm mb-3 font-sans">
                          {activeTenant.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight uppercase tracking-tight break-words">{activeTenant.name}</h1>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5 select-all">{systemSettings?.company?.address || 'Merchant Head Office'}</p>
                      {systemSettings?.business?.businessEmail && (
                        <p className="text-[11px] text-slate-500 font-mono select-all mt-0.5">📧 {systemSettings.business.businessEmail}</p>
                      )}
                      <p className="text-[11px] text-slate-505 font-mono select-all mt-0.5">📞 {systemSettings?.company?.phone || '+254 Merchant Admin'}</p>
                    </div>

                    <div className="text-left sm:text-right font-sans shrink-0">
                      <span className="text-[11px] font-black uppercase tracking-widest font-mono text-slate-400">Document</span>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase mt-1 tracking-tight">
                        {viewingDocument.type === 'price quote' ? 'Quote' :
                         viewingDocument.type === 'price quote invoice' ? 'Quote' : 'Invoice'}
                      </h2>
                      <div className="mt-4 font-mono text-xs text-slate-600 space-y-1">
                        <div>
                          <span className="text-slate-400">
                            {viewingDocument.type === 'price quote' ? 'Quot No:' : 'Inv No:'}
                          </span>{' '}
                          <strong className="font-bold text-slate-800">{viewingDocument.documentNumber}</strong>
                        </div>
                        <div><span className="text-slate-400">Date:</span> <span className="font-medium text-slate-705">{new Date(viewingDocument.timestamp).toLocaleDateString()}</span></div>
                        <div><span className="text-slate-400">Branch:</span> <span className="font-medium text-slate-705">{activeTenant.city}, {activeTenant.country}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Client billed address template wrapper */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/85 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-450 mb-1">Customer (Client):</span>
                      <h4 className="font-bold text-slate-800 text-xs font-sans capitalize">{viewingDocument.customerName || 'Loyal Client'}</h4>
                      {viewingDocument.customerPhone && <p className="text-[11px] text-slate-500 font-mono mt-1">📞 {viewingDocument.customerPhone}</p>}
                    </div>
                    {viewingDocument.customerAddress ? (
                      <div className="sm:border-l border-slate-200 sm:pl-4 font-sans">
                        <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-450 mb-1">Delivery Address:</span>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-sans mt-0.5">{viewingDocument.customerAddress}</p>
                      </div>
                    ) : (
                      <div className="sm:border-l border-slate-200 sm:pl-4 font-sans">
                        {/* Blank */}
                      </div>
                    )}
                  </div>

                  {/* Ledger lines table with brand color header */}
                  <div className="border border-slate-200 rounded-2xl overflow-x-auto font-sans">
                    <table className="w-full min-w-[520px] text-left border-collapse text-xs">
                      <thead>
                        <tr 
                          className="text-[10px] text-white font-bold uppercase tracking-wider select-none font-sans"
                          style={{ backgroundColor: systemSettings?.invoiceSettings?.invoiceColor || '#1e3a8a' }}
                        >
                          <th className="p-3">No.</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3 text-right">Qty</th>
                          <th className="p-3 text-right">Price Each</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-105 font-medium font-sans">
                        {viewingDocument.items.map((item, index) => {
                          const itemPrice = item.discountType === 'cash' ? Math.max(0, item.price - item.discount) : item.price * (1 - item.discount / 100);
                          const itemProduct = products.find(p => p.id === item.productId);
                          return (
                            <tr key={index} className="hover:bg-slate-50/50 transition-colors text-slate-750">
                              <td className="p-3 font-mono text-[10px] text-slate-450">{String(index + 1).padStart(2, '0')}</td>
                              <td className="p-3 font-bold text-slate-800">{item.productName}</td>
                              <td className="p-3 text-right font-mono font-bold">{formatSaleItemQuantity(item, itemProduct)}</td>
                              <td className="p-3 text-right font-mono">{currency}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800">{currency}{(itemPrice * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial sum ledger columns and banking info columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 items-start font-sans">
                    
                    {/* Bank settling details */}
                    <div>
                      {systemSettings?.invoiceSettings?.bankName ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px] space-y-1">
                          <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 font-mono mb-1">Corporate Payment Account</span>
                          <div>Bank Name: <strong className="font-bold text-slate-800">{systemSettings.invoiceSettings.bankName}</strong></div>
                          <div>Account Number: <strong className="font-bold text-slate-850 font-mono select-all shrink-0">{systemSettings.invoiceSettings.accountNumber}</strong></div>
                          <div>Account Name: <strong className="font-bold text-slate-850">{systemSettings.invoiceSettings.accountName}</strong></div>
                          {systemSettings.invoiceSettings.tin && (
                            <div className="pt-1.5 mt-1.5 border-t border-dashed border-slate-200"><span className="text-slate-400">Merchant TIN:</span> <strong className="font-mono font-bold text-slate-800">{systemSettings.invoiceSettings.tin}</strong></div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px] space-y-1">
                          <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 font-mono">Payment Account</span>
                          <span className="text-slate-400 italic">Configure corporate accounts & bank keys in settings.</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom financial summary columns */}
                    <div className="space-y-2 text-xs text-slate-650 font-sans border-t-2 border-slate-200 pt-3">
                      <div className="flex justify-between">
                        <span>Items Sub-Total:</span>
                        <span className="font-bold text-slate-800 font-mono">{currency}{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      {/* Conditional VAT line */}
                      {!!viewingDocument.hasVat && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Output Tax (VAT 18%):</span>
                          <span className="font-bold font-mono">+{currency}{(viewingDocument.tax || subTotal * 0.18).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Conditional Shipping line */}
                      {!!viewingDocument.deliveryCost && viewingDocument.deliveryCost > 0 && (
                        <div className="flex justify-between text-indigo-700">
                          <span>Delivery / Freight Cost:</span>
                          <span className="font-bold font-mono">+{currency}{viewingDocument.deliveryCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      <div 
                        className="flex justify-between text-base font-black text-slate-900 border-t border-slate-250 pt-2.5 font-sans"
                        style={{ color: systemSettings?.invoiceSettings?.invoiceColor }}
                      >
                        <span>Total to Pay:</span>
                        <span className="font-mono font-black">{currency}{(viewingDocument.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Standard Terms list configuration dynamically loaded */}
                  {systemSettings?.invoiceSettings?.termsAndConditions && systemSettings.invoiceSettings.termsAndConditions.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-[10.5px] font-sans">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-450 font-mono mb-1.5">Standard terms & warranty clauses</span>
                      <ol className="list-decimal list-inside space-y-0.5 text-slate-600 font-medium">
                        {systemSettings.invoiceSettings.termsAndConditions.map((term, i) => (
                          <li key={i}>{term}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Representative Authorised Signature sections */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-100 items-end text-xs font-sans">
                    <div>
                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 font-mono mb-1">Prepared by</span>
                      <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 w-full max-w-xs">{preparerName}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Title: {preparerRole}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-450 font-mono mb-1">Signature</span>
                      <div className="border-b border-dashed border-slate-300 w-full max-w-xs ml-auto h-12 flex items-center justify-end overflow-hidden pb-1 select-none">
                        {activeStaff?.signatureImage ? (
                          <img 
                            src={activeStaff.signatureImage} 
                            className="max-h-12 w-auto object-contain transition-all" 
                            alt={`${preparerName} Signature`} 
                          />
                        ) : (
                          <span className="text-indigo-450 font-serif italic text-sm tracking-wider opacity-65">
                            {preparerName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Elegant decorative invoice footer with editable tagline */}
                  <div className="pt-8 border-t border-slate-200/60 text-center space-y-2.5">
                    <p className="text-[11.5px] italic font-sans text-slate-500 px-6 font-medium leading-relaxed">
                      "{viewingDocument.tagline || systemSettings?.business?.tagline || 'Thank you. We appreciate you!'}"
                    </p>
                  </div>

	                </div>
	              </div>

	              <div className="shrink-0 border-t border-slate-200 bg-white/98 p-3 sm:p-4 print:hidden shadow-[0_-12px_30px_rgba(15,23,42,0.08)]">
	                {documentSendOpen && (
	                  <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/45 p-3">
	                    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
	                      <label className="flex-1">
	                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">Customer WhatsApp Number</span>
	                        <input
	                          type="tel"
	                          value={documentSendPhone}
	                          onChange={(e) => setDocumentSendPhone(e.target.value.replace(/[^\d+\s-]/g, ''))}
	                          placeholder="+255 700 000 000"
	                          className="w-full h-12 px-3 rounded-xl border border-emerald-250 bg-white text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
	                        />
	                      </label>
	                      <button
	                        type="button"
	                        disabled={!documentSendPhone.trim()}
	                        onClick={() => sharePdfDocument(viewingDocument, documentSendPhone)}
	                        className={`h-12 px-5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${documentSendPhone.trim() ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' : 'bg-slate-200 text-slate-400 pointer-events-none'}`}
	                      >
	                        <MessageSquare className="w-4 h-4" />
	                        <span>Send PDF</span>
	                      </button>
	                    </div>
	                  </div>
	                )}
	                {pdfShareStatus && (
	                  <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-150 px-3 py-2 text-[11px] font-bold text-emerald-700">
	                    {pdfShareStatus}
	                  </div>
	                )}
	                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
	                  <button
	                    type="button"
	                    onClick={() => {
	                      if (viewingDocument.customerPhone?.trim()) {
	                        sharePdfDocument(viewingDocument, viewingDocument.customerPhone);
	                      } else {
	                        setDocumentSendOpen(prev => !prev);
	                      }
	                    }}
	                    className="h-12 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm font-sans whitespace-nowrap"
	                  >
	                    <MessageSquare className="w-4 h-4 text-white" />
	                    <span>Send</span>
	                  </button>
	                  <button
	                    type="button"
	                    disabled={viewingDocument.status !== 'pending'}
	                    onClick={() => sendDocumentToSales(viewingDocument)}
	                    className="h-12 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-black uppercase rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm font-sans whitespace-nowrap"
	                  >
	                    <ArrowRight className="w-4 h-4" />
	                    <span>Record as Sale</span>
	                  </button>
	                  <button
	                    type="button"
	                    onClick={() => setViewingDocument(null)}
	                    className="h-12 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-black uppercase rounded-xl cursor-pointer transition-all font-sans whitespace-nowrap"
	                  >
	                    Close
	                  </button>
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
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs env-padding-safe"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-3xl shadow-xl z-50 overflow-hidden font-sans flex flex-col max-h-[85vh] text-[#0f172a] border border-slate-100"
            >
              {/* Close Handle Bar */}
              <div className="w-full flex justify-center py-2 shrink-0">
                <div className="w-12 h-1 bg-slate-250 rounded-full" />
              </div>

              {/* Header Title Information */}
              <div className="px-5 pb-3 pt-1 text-left shrink-0">
                <h3 className="text-base font-extrabold text-slate-800 leading-tight">
                  {mobileActionsSale.customerName || 'Walk-In Customer'} — <span className="font-mono text-indigo-700">#{getSaleReference(mobileActionsSale)}</span>
                </h3>
                <p className="text-xs text-slate-450 mt-1 flex items-center justify-between">
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
                      items: [...mobileActionsSale.items]
                    });
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

                {/* 5. Invoice */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSale(mobileActionsSale);
                    setViewA4InvoiceOpen(true);
                    setMobileActionsSale(null);
                  }}
                  className="w-full h-14 min-h-[52px] bg-white hover:bg-slate-50 flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-3xs cursor-pointer text-left transition-colors font-semibold"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 select-none">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Invoice</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Print standard A4 PDF document</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Divider below main actions */}
                <div className="my-2 border-t border-slate-100" />

                {/* 6. Delete Sale */}
                <button
                  type="button"
                  onClick={() => {
                    setSaleToDelete(mobileActionsSale);
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
                      <span className={`text-sm font-black block ${rolePermissions && rolePermissions.deleteSale?.write === false ? 'text-slate-400' : 'text-rose-700'}`}>Delete Sale</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Void transaction indices permanently</span>
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
