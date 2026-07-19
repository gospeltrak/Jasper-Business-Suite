import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Tenant, Product, Sale, SaleItem, SystemSettings } from '../types';
import {
  calculateWeightedAverageCost,
  deductBatchesForSale,
  getPosSellingPriceForCostingMethod,
  getProductCostingMethod,
} from '../utils/inventoryCosting';
import { formatProductQuantity, formatSaleItemQuantity } from '../utils/unitFormatter';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Tag, 
  ShoppingCart, 
  Receipt, 
  CreditCard, 
  CheckCircle, 
  Smartphone,
  X,
  Scan,
  Sparkles,
  Printer,
  MessageSquare,
  Pill,
  Coins,
  ShieldAlert,

  History,
  UserCheck,
  Calendar,
  Settings,
  ChevronDown
} from 'lucide-react';
import DashboardBarcodeScanner from './DashboardBarcodeScanner';
import CachedImage from './CachedImage';
import { createReceiptPdfFromData, printPdfFile, sharePosReceiptPdf, ReceiptData } from '../utils/pdfShare';

// Web Audio API helper for offline-friendly beep sound
// Shared AudioContext singleton — created once, reused for all beeps (eliminates init lag)
let _sharedAudioCtx: AudioContext | null = null;
const getAudioCtx = (): AudioContext | null => {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
      _sharedAudioCtx = new AC();
    }
    if (_sharedAudioCtx.state === 'suspended') {
      _sharedAudioCtx.resume();
    }
    return _sharedAudioCtx;
  } catch { return null; }
};

const playBeep = (frequency = 800, duration = 80) => {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = frequency; osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (duration / 1000));
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + (duration / 1000));
  } catch (e) {}
};

// Keep audible feedback outside the cart update's critical render path.
const playCartSuccessBeepAfterPaint = () => {
  window.requestAnimationFrame(() => {
    window.setTimeout(() => playBeep(800, 80), 0);
  });
};

// ── BUZZ SOUNDS — supermarket / security gate style ──────────────────────
// Square wave at low frequency = harsh buzz like a real till error

// Out of stock: single long BUZZZZ (like when item can't be sold)
const playOutOfStockBeep = () => {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const t = ctx.currentTime;

    // Main buzz — square wave, low pitch, ~500ms
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(90, t + 0.5);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.setValueAtTime(0.35, t + 0.42);
    gain.gain.linearRampToValueAtTime(0, t + 0.5);
    osc.start(t); osc.stop(t + 0.5);
  } catch (e) {}
};

// Barcode not found / product not found: double buzz "BUZZ BUZZ"
// Classic supermarket scanner error
const playErrorBeep = () => {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const t = ctx.currentTime;

    [0, 0.32].forEach(startAt => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(110, t + startAt);
      gain.gain.setValueAtTime(0, t + startAt);
      gain.gain.linearRampToValueAtTime(0.3, t + startAt + 0.02);
      gain.gain.setValueAtTime(0.3, t + startAt + 0.22);
      gain.gain.linearRampToValueAtTime(0, t + startAt + 0.28);
      osc.start(t + startAt); osc.stop(t + startAt + 0.3);
    });
  } catch (e) {}
};

// Warning: two short high beeps (low stock alert — less harsh than error)
const playWarningBeep = () => {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    [0, 0.18].forEach((startAt) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(400, ctx.currentTime + startAt);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + startAt + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + 0.12);
      osc.start(ctx.currentTime + startAt); osc.stop(ctx.currentTime + startAt + 0.12);
    });
  } catch (e) {}
};

interface DashboardPOSProps {
  activeTenant: Tenant;
  products: Product[];
  onUpdateStocks: (updatedProducts: Product[]) => void;
  onAddSale: (sale: Sale) => void;
  userName: string;
  isOfflineMode: boolean;
  systemSettings?: SystemSettings;
  preloadedCart?: {
    items: SaleItem[];
    backdate?: string;
    deliveryCost?: number;
    paymentMethod?: string;
    customerName?: string;
    customerPhone?: string;
    hasVat?: boolean;
  } | null;
  onClearPreloadedCart?: () => void;
}

const getProductImage = (prod: Product): string => {
  // Only return an image if the user personally uploaded and saved one.
  // null / undefined / empty / broken → return '' (blank).
  // Do NOT assign demo, placeholder, or Unsplash images.
  if (
    prod.image &&
    typeof prod.image === 'string' &&
    prod.image.trim() !== '' &&
    (prod.image.startsWith('http') || prod.image.startsWith('data:'))
  ) {
    return prod.image;
  }
  return '';
};

export default function DashboardPOS({ 
  activeTenant, 
  products, 
  onUpdateStocks, 
  onAddSale, 
  userName,
  isOfflineMode,
  systemSettings,
  preloadedCart,
  onClearPreloadedCart
}: DashboardPOSProps) {
  const showProductImages = systemSettings?.posSettings?.showProductImages !== false;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Array<{ 
    product: Product; 
    qty: number; 
    discount: number; 
    discountType: 'percent' | 'cash';
    dosageType?: 'packet' | 'full' | 'half' | 'tabs' | 'strip' | 'dose' | 'unit';
    tabsSelected?: number;
    bulkSellMode?: 'scale' | 'pcs';
  }>>([]);
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [orderDiscountType, setOrderDiscountType] = useState<'percent' | 'cash'>('percent');

  // Backdate date picker / Past day sales logic
  const [saleDate, setSaleDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Effect to absorb preloaded cart items (such as Quote or Quote conversion)
  useEffect(() => {
    if (preloadedCart && preloadedCart.items && preloadedCart.items.length > 0) {
      const mapped = preloadedCart.items.map(item => {
        const prod = products.find(p => p.id === item.productId || p.name === item.productName);
        return {
          product: prod || {
            id: item.productId,
            name: item.productName,
            sku: 'DRAFT',
            barcode: '',
            category: 'Miscellaneous',
            costPrice: item.price * 0.7,
            sellingPrice: item.price,
            stockQty: 9999,
            shopStockQty: 9999,
            storeStockQty: 0,
            alertQty: 0
          },
          qty: item.qty,
          discount: item.discount,
          discountType: (item.discountType || 'percent') as 'percent' | 'cash',
          dosageType: item.dosageType,
          tabsSelected: item.tabsSelected
        };
      });
      setCart(mapped);
      setDeliveryCost(Math.max(0, Number(preloadedCart.deliveryCost) || 0));
      setPaymentMethod(preloadedCart.paymentMethod || 'Cash');
      setCustomerName(preloadedCart.customerName || '');
      setCustomerPhone(preloadedCart.customerPhone || '');
      setVatStatus(preloadedCart.hasVat ? 'vat' : 'non-vat');
      setOrderDiscount(0);
      setOrderDiscountType('percent');
      
      if (preloadedCart.backdate) {
        setSaleDate(preloadedCart.backdate.split('T')[0]);
      }
      
      if (onClearPreloadedCart) {
        onClearPreloadedCart();
      }
    }
  }, [preloadedCart, products]);

  // Barcode Scanner integrated states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [autoInsertOnScan] = useState(true); // always on — supermarket style
  const [barcodeToast, setBarcodeToast] = useState<string | null>(null);

  interface ScanToast {
    id: string;
    type: 'error' | 'warning' | 'success';
    message: string;
  }
  const [scanToasts, setScanToasts] = useState<ScanToast[]>([]);

  const addScanToast = (type: 'error' | 'warning' | 'success', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setScanToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setScanToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleScanSuccess = (scannedCode: string, matchedProduct: Product | null) => {
    if (matchedProduct) {
      const isOOS = (matchedProduct.shopStockQty ?? 0) <= 0 || (matchedProduct.stockQty ?? 0) <= 0;
      if (isOOS) {
        playOutOfStockBeep(); // single buzz
        addScanToast('warning', `📦 Out of stock — ${matchedProduct.name}`);
      } else {
        addToCart(matchedProduct);
        addScanToast('success', `✓ ${matchedProduct.name} added`);
        playCartSuccessBeepAfterPaint();
      }
    } else {
      playErrorBeep(); // double buzz
      addScanToast('error', `⚠️ Not found — ${scannedCode}`);
    }
    // Keep scanner open for next scan — supermarket multi-scan
  };
  
  // Checkout Modal system
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState<string>('');
  const [multiCashAmount, setMultiCashAmount] = useState<number>(0);
  const [multiBankAmount, setMultiBankAmount] = useState<number>(0);
  const [vatStatus, setVatStatus] = useState<'vat' | 'non-vat'>('non-vat');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'completed'>('idle');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [referenceCode, setReferenceCode] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [receiptResult, setReceiptResult] = useState<Sale | null>(null);
  const [recipientWhatsApp, setRecipientWhatsApp] = useState('');
  const [receiptPdfStatus, setReceiptPdfStatus] = useState<string | null>(null);

  const buildReceiptPdfData = (): ReceiptData | null => {
    if (!receiptResult) return null;
    const stores = systemSettings?.business?.registeredStores || [];
    const activeBranch = stores[0];
    const branchBranding = activeBranch ? systemSettings?.business?.branchBranding?.[activeBranch] : undefined;
    const rawTerms = systemSettings?.invoiceSettings?.termsAndConditions;
    const terms = Array.isArray(rawTerms) ? rawTerms : rawTerms ? String(rawTerms).split('\n').filter(Boolean) : [];
    return {
        businessName: systemSettings?.business?.businessName || activeTenant.name,
        businessAddress: systemSettings?.business?.businessAddress || activeTenant.city || undefined,
        businessPhone: systemSettings?.business?.businessPhone || undefined,
        businessEmail: systemSettings?.business?.businessEmail || undefined,
        businessCity: activeTenant.city || undefined,
        businessLogo: branchBranding?.businessLogoLight || branchBranding?.businessLogo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogoDark || systemSettings?.business?.businessLogo || undefined,
        receiptId: receiptResult.reference || receiptResult.id,
        timestamp: receiptResult.timestamp,
        cashierName: receiptResult.cashierName || userName || undefined,
        customerName: receiptResult.customerName || undefined,
        customerPhone: receiptResult.customerPhone || customerPhone || undefined,
        paymentMethod: receiptResult.paymentMethod,
        items: receiptResult.items.map(item => {
          const prod = products.find(p => p.id === item.productId);
          return {
            name: item.productName || prod?.name || 'Item',
            qty: item.qty,
            price: item.price,
            total: item.qty * item.price,
            unit: prod?.unit || undefined,
          };
        }),
        subtotal: receiptResult.items.reduce((s, i) => s + i.qty * i.price, 0),
        tax: receiptResult.tax || 0,
        discount: receiptResult.discount || 0,
        deliveryCost: receiptResult.deliveryCost || 0,
        productTotal: receiptResult.productTotal ?? (receiptResult.total - (receiptResult.deliveryCost || 0)),
        grandTotal: receiptResult.total,
        currency: activeTenant.currency || 'TZS',
        amountPaid: receiptResult.amountPaid ?? receiptResult.total,
        change: receiptResult.change ?? 0,
        vatNumber: (systemSettings?.business as any)?.vatNumber || undefined,
        documentTitle: 'A4 Receipt',
        status: (receiptResult.amountPaid ?? receiptResult.total) >= receiptResult.total ? 'Paid' : 'Pending',
        preparedByRole: 'Cashier',
        terms,
        footer: 'Powered by Ndiva Suite',
      };
  };

  const sharePosReceiptPdfHandler = async () => {
    if (!receiptResult) return;
    try {
      setReceiptPdfStatus('Preparing receipt PDF...');

      // Build receipt data for real PDF generation (no screenshot)
      const receiptData = buildReceiptPdfData();
      if (!receiptData) return;

      const result = await sharePosReceiptPdf(
        receiptData,
        recipientWhatsApp,
        `Hello ${receiptResult.customerName || 'valued customer'}, please find your receipt attached from ${systemSettings?.business?.businessName || activeTenant.name}. Thank you for your business!`
      );

      if (result.method === 'native-share') {
        setReceiptPdfStatus('✅ Receipt shared successfully.');
      } else {
        setReceiptPdfStatus('📥 PDF downloaded. Open WhatsApp → attach the file → send.');
      }
    } catch (err: any) {
      if (err?.message === 'Share cancelled') {
        setReceiptPdfStatus(null);
        return;
      }
      setReceiptPdfStatus(err?.message || 'Could not prepare PDF.');
    } finally {
      setTimeout(() => setReceiptPdfStatus(null), 6000);
    }
  };

  const printPosReceiptPdfHandler = () => {
    const receiptData = buildReceiptPdfData();
    if (!receiptData) return;
    try {
      setReceiptPdfStatus('Generating printable receipt PDF...');
      const pdfFile = createReceiptPdfFromData(receiptData);
      printPdfFile(pdfFile);
      setReceiptPdfStatus('PDF opened for printing.');
    } catch (err: any) {
      setReceiptPdfStatus(err?.message || 'Could not prepare receipt PDF.');
    } finally {
      setTimeout(() => setReceiptPdfStatus(null), 6000);
    }
  };

  // Dual-channel context (Retail vs. Wholesale)
  const [sellingChannel, setSellingChannel] = useState<'retail' | 'wholesale'>('retail');
  const [posWarning, setPosWarning] = useState<string | null>(null);



  const currency = systemSettings?.company?.currency || activeTenant.currency;

  // Determine if wholesale mode should be available based on product registrations
  const hasAnyWholesaleProduct = products.some(p => p.sellInWholesale === true);

  // Fall back to retail if wholesale is active but no wholesale products are registered
  useEffect(() => {
    if (!hasAnyWholesaleProduct && sellingChannel === 'wholesale') {
      setSellingChannel('retail');
    }
  }, [products, hasAnyWholesaleProduct, sellingChannel]);

  // Auto-dismiss safety warnings in 4 seconds
  useEffect(() => {
    if (posWarning) {
      const timer = setTimeout(() => {
        setPosWarning(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [posWarning]);
  
  // Custom categories list loaded dynamic from branch store settings.
  // Deduplicate case-insensitively — "Groceries" and "groceries" are the same.
  const configuredCategories = (() => {
    const raw: string[] = systemSettings?.productStore?.categories && systemSettings.productStore.categories.length > 0
      ? systemSettings.productStore.categories
      : products.map(p => p.category?.trim()).filter(Boolean) as string[];
    // Deduplicate: keep first occurrence of each case-insensitive value
    const seen = new Set<string>();
    return raw.filter(c => {
      const key = c.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  const categories = ['All', ...configuredCategories];

  const getPharmacyDoseConfig = useCallback((product: Product) => {
    const hierarchyLevels = product.pharmacyUnitLevels && product.pharmacyUnitLevels.length > 0
      ? product.pharmacyUnitLevels
      : null;
    if (hierarchyLevels) {
      const topLevel = hierarchyLevels[0];
      const doseLevel = hierarchyLevels.find(level => level.id === 'dose') || hierarchyLevels[1] || topLevel;
      const baseLevel = hierarchyLevels[hierarchyLevels.length - 1];
      const tabsPerPacket = Math.max(1, Number(topLevel.quantityToBaseUnit || product.conversionToBaseUnit || product.tabsPerPack || 1));
      const tabsPerDose = Math.max(1, Number(doseLevel.quantityToBaseUnit || product.tabsPerDose || 1));
      const packetPrice = Number(product.packetPrice || product.sellingPrice || 0);
      const tabPrice = Number(product.tabPrice || product.defaultPricePerBaseUnit || product.inventorySettings?.defaultPricePerBaseUnit || (packetPrice / tabsPerPacket));
      const fullDosePrice = Number(product.fullDosePrice || (tabPrice * tabsPerDose));
      const halfDoseTabs = Math.max(1, Math.ceil(tabsPerDose / 2));
      const halfDosePrice = Number(product.halfDosePrice || (tabPrice * halfDoseTabs));
      return { dosesPerPacket: tabsPerPacket, tabsPerDose, tabsPerPacket, halfDoseTabs, packetPrice, fullDosePrice, halfDosePrice, tabPrice, hierarchyLevels, baseUnit: product.pharmacyBaseUnit || baseLevel.unit };
    }
    const dosesPerPacket = Math.max(1, Number(product.dosesPerPacket || product.pharmacyUnitBreakdown?.stripsPerBox || 1));
    const tabsPerDose = Math.max(1, Number(product.tabsPerDose || product.pharmacyUnitBreakdown?.tabletsPerStrip || product.tabsPerPack || 1));
    const tabsPerPacket = Math.max(1, Number(product.tabsPerPack || (dosesPerPacket * tabsPerDose)));
    const halfDoseTabs = Math.max(1, Math.ceil(tabsPerDose / 2));
    const packetPrice = Number(product.packetPrice || product.sellingPrice || 0);
    const fullDosePrice = Number(product.fullDosePrice || (packetPrice / dosesPerPacket));
    const halfDosePrice = Number(product.halfDosePrice || (fullDosePrice / 2));
    const tabPrice = Number(product.tabPrice || (packetPrice / tabsPerPacket));
    return { dosesPerPacket, tabsPerDose, tabsPerPacket, halfDoseTabs, packetPrice, fullDosePrice, halfDosePrice, tabPrice, hierarchyLevels: null, baseUnit: product.pharmacyBaseUnit || product.pharmacyUnitBreakdown?.baseUnit || 'Tab' };
  }, []); // product fields are stable — no external deps needed

  const getPharmacyDoseWeight = (product: Product, dosageType: 'packet' | 'full' | 'half' | 'tabs' | 'strip' | 'dose' | 'unit' = 'packet', tabsSelected?: number) => {
    const cfg = getPharmacyDoseConfig(product);
    if (cfg.hierarchyLevels) {
      if (dosageType === 'tabs' || dosageType === 'unit') return Math.max(1, tabsSelected || 1);
      const level = cfg.hierarchyLevels.find(item => item.id === dosageType)
        || (dosageType === 'full' ? cfg.hierarchyLevels.find(item => item.id === 'dose') : undefined)
        || (dosageType === 'half' ? cfg.hierarchyLevels.find(item => item.id === 'dose') : undefined)
        || cfg.hierarchyLevels[0];
      const baseQty = Math.max(1, Number(level.quantityToBaseUnit || 1));
      return dosageType === 'half' ? Math.max(1, Math.ceil(baseQty / 2)) : baseQty;
    }
    if (dosageType === 'packet') return cfg.tabsPerPacket;
    if (dosageType === 'full' || dosageType === 'dose') return cfg.tabsPerDose;
    if (dosageType === 'half') return cfg.halfDoseTabs;
    return Math.max(1, tabsSelected || 1);
  };

  const formatPharmacyRemaining = (baseQuantity: number, product: Product) => {
    const cfg = getPharmacyDoseConfig(product);
    const totalBase = Math.max(0, Math.round(baseQuantity));
    if (cfg.hierarchyLevels) {
      let remaining = totalBase;
      const parts: string[] = [];
      cfg.hierarchyLevels.forEach((level, index) => {
        const unitSize = Math.max(1, Math.round(level.quantityToBaseUnit || 1));
        const count = index === cfg.hierarchyLevels!.length - 1 ? remaining : Math.floor(remaining / unitSize);
        remaining = index === cfg.hierarchyLevels!.length - 1 ? 0 : remaining % unitSize;
        if (count > 0 || index === cfg.hierarchyLevels!.length - 1) parts.push(`${count} ${level.unit}${count === 1 ? '' : 's'}`);
      });
      return parts.join(' / ');
    }
    const fullPackets = Math.floor(totalBase / cfg.tabsPerPacket);
    const afterPackets = totalBase % cfg.tabsPerPacket;
    const fullDoses = Math.floor(afterPackets / cfg.tabsPerDose);
    const tabs = afterPackets % cfg.tabsPerDose;
    return `${fullPackets} packet${fullPackets === 1 ? '' : 's'}, ${fullDoses} dose${fullDoses === 1 ? '' : 's'}, ${tabs} ${cfg.baseUnit}${tabs === 1 ? '' : 's'}`;
  };

  const getRetailPackageConfig = useCallback((product: Product) => {
    const isMeasuredProduct = !!product.isBulkProduct || !!product.allowScaleSelling ||
      !!product.inventorySettings?.allowScaleSelling || product.sellingMode === 'scale' || product.sellingMode === 'hybrid';
    const baseUnit = isMeasuredProduct
      ? product.inventorySettings?.baseUnit || product.baseUnit || product.sellUnit || product.unit || 'unit'
      : product.unit || product.inventorySettings?.baseUnit || product.baseUnit || product.sellUnit || 'unit';
    const purchaseUnit = product.inventorySettings?.purchaseUnit || product.purchaseUnit || product.bulkUnit || 'package';
    const conversionToBaseUnit = Math.max(0.001, Number(product.inventorySettings?.conversionToBaseUnit || product.conversionToBaseUnit || product.bulkPurchaseQty || 1));
    const pricePerBaseUnit = Number(product.inventorySettings?.defaultPricePerBaseUnit || product.defaultPricePerBaseUnit || product.packageUnitPrice || product.sellUnitPrice || product.sellingPrice || 0);
    return {
      baseUnit,
      purchaseUnit,
      conversionToBaseUnit,
      pricePerBaseUnit,
      wholePrice: pricePerBaseUnit * conversionToBaseUnit,
      halfPrice: pricePerBaseUnit * (conversionToBaseUnit / 2),
    };
  }, []); // product fields are stable

  const supportsMeasuredRetail = (product: Product) => (
    !!product.isBulkProduct ||
    !!product.allowScaleSelling ||
    !!product.inventorySettings?.allowScaleSelling ||
    product.sellingMode === 'scale' ||
    product.sellingMode === 'hybrid'
  );

  const formatRetailPackageRemaining = (baseQty: number, product: Product) => {
    const cfg = getRetailPackageConfig(product);
    if (!product.isBulkProduct) return `${formatProductQuantity(baseQty, product)} left`;
    const safeQty = Math.max(0, Number(baseQty || 0));
    const wholePackages = Math.floor(safeQty / cfg.conversionToBaseUnit);
    const remainingBase = Number((safeQty - (wholePackages * cfg.conversionToBaseUnit)).toFixed(3));
    return `${formatProductQuantity(safeQty, { ...product, unit: cfg.baseUnit } as Product)} left (${wholePackages} ${cfg.purchaseUnit}, ${formatProductQuantity(remainingBase, { ...product, unit: cfg.baseUnit } as Product)})`;
  };

  // Filtering products for current tenant active list
  const filteredProducts = useMemo(() => products.filter(p => {
    const shopQty = Number(p.shopStockQty ?? p.stockQty ?? 0);
    if (shopQty <= 0) return false;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'All' || 
      p.category?.trim().toLowerCase() === selectedCategory.trim().toLowerCase();
    const inStock = (p.shopStockQty ?? p.stockQty ?? 0) > 0;
    return matchesSearch && matchesCategory && inStock;
  }), [products, searchTerm, selectedCategory]);

  const addToCart = useCallback((prod: Product) => {
    // Channel selling permissions validation
    if (sellingChannel === 'retail' && prod.sellInRetail === false) {
      setPosWarning(`Product "${prod.name}" is wholesale-only. Change channel to Wholesale to sell this product.`);
      return;
    }
    if (sellingChannel === 'wholesale' && prod.sellInWholesale === false) {
      setPosWarning(`Product "${prod.name}" is retail-only. Change channel to Retail to sell this product.`);
      return;
    }

    const shopQty = prod.shopStockQty ?? 0;
    if (shopQty <= 0) {
      setPosWarning(`Stock Limit: "${prod.name}" is completely out of stock in the shop!`);
      return;
    }

    const isPharmacy = activeTenant.businessType === 'pharmacy';
    const initialDosage = isPharmacy ? 'packet' : undefined;
    const initialTabs = isPharmacy ? 1 : undefined;

    setCart(prev => {
      const existing = prev.find(i => i.product.id === prod.id);
      if (existing) {
        // limit by stock with weight checks
        const activeType = existing.dosageType || 'packet';
        const boxWeight = isPharmacy ? getPharmacyDoseWeight(existing.product, activeType, existing.tabsSelected) : 1;
        
        const nextQty = existing.qty + 1;
        if (nextQty * boxWeight > shopQty) {
          setPosWarning(`Stock Limit: Cannot add more than ${formatProductQuantity(shopQty, prod)} of "${prod.name}" to the register basket!`);
          return prev;
        }
        return prev.map(i => i.product.id === prod.id ? { ...i, qty: nextQty } : i);
      }
      return [...prev, { 
        product: prod, 
        qty: supportsMeasuredRetail(prod) ? (prod.sellUnitQty || 1) : 1,
        discount: 0, 
        discountType: 'percent',
        dosageType: initialDosage,
        tabsSelected: initialTabs,
        bulkSellMode: prod.isBulkProduct ? (prod.sellingMode === 'hybrid' ? 'scale' : prod.sellingMode) : undefined
      }];
    });
  }, [sellingChannel, activeTenant.businessType]);

  const updateCartQty = useCallback((id: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.product.id === id) {
          const nextQty = i.qty + delta;
          if (nextQty <= 0) return null;
          
          const shopQty = i.product.shopStockQty ?? 0;
          const activeType = i.dosageType || 'packet';
          const boxWeight = activeTenant.businessType === 'pharmacy' ? getPharmacyDoseWeight(i.product, activeType, i.tabsSelected) : 1;

          if (nextQty * boxWeight > shopQty) {
            setPosWarning(`Stock Limit: Cannot exceed active shop stock of ${formatProductQuantity(shopQty, i.product)} for "${i.product.name}"!`);
            return i;
          }
          return { ...i, qty: nextQty };
        }
        return i;
      }).filter(Boolean) as any;
    });
  }, [activeTenant.businessType]);

  const updateCartQtyDirect = (id: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => {
      return prev.map(i => {
        if (i.product.id === id) {
          const shopQty = i.product.shopStockQty ?? 0;
          const activeType = i.dosageType || 'packet';
          const boxWeight = activeTenant.businessType === 'pharmacy' ? getPharmacyDoseWeight(i.product, activeType, i.tabsSelected) : 1;

          if (newQty * boxWeight > shopQty) {
            const maxQty = activeTenant.businessType === 'pharmacy'
              ? Math.max(1, Math.floor(shopQty / boxWeight))
              : Number(shopQty.toFixed(3));
            setPosWarning(`Stock Limit: Maximum possible quantity for "${i.product.name}" is ${formatProductQuantity(maxQty, i.product)} based on stock!`);
            return { ...i, qty: maxQty };
          }
          return { ...i, qty: newQty };
        }
        return i;
      });
    });
  };

  const updateCartBulkMode = (id: string, mode: 'scale' | 'pcs') => {
    setCart(prev => prev.map(i => {
      if (i.product.id === id) {
         return { ...i, bulkSellMode: mode, qty: mode === 'scale' ? (i.product.sellUnitQty || 1) : 1 };
      }
      return i;
    }));
  };

  const updateCartDosage = (productId: string, dosageType: 'packet' | 'full' | 'half' | 'tabs' | 'strip' | 'dose' | 'unit', customTabs?: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const doseCfg = getPharmacyDoseConfig(item.product);
          const defaultTabs = customTabs !== undefined 
            ? customTabs 
            : dosageType === 'half' 
              ? doseCfg.halfDoseTabs 
              : 1;

          // Recalculate if qty is still valid for stock when weight changes
          const shopQty = item.product.shopStockQty ?? 0;
          const boxWeight = getPharmacyDoseWeight(item.product, dosageType, defaultTabs);

          let newQty = item.qty;
          if (newQty * boxWeight > shopQty) {
            newQty = Math.max(1, Math.floor(shopQty / boxWeight));
          }

          return { 
            ...item, 
            dosageType, 
            tabsSelected: dosageType === 'tabs' || dosageType === 'unit' ? defaultTabs : undefined,
            qty: newQty
          };
        }
        return item;
      });
    });
  };

  const updateCartTabsSelected = (productId: string, tabsCount: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const doseCfg = getPharmacyDoseConfig(item.product);
          const sanitizedTabs = Math.max(1, Math.min(doseCfg.tabsPerPacket, tabsCount));
          
          const shopQty = item.product.shopStockQty ?? 0;
          const boxWeight = getPharmacyDoseWeight(item.product, 'tabs', sanitizedTabs);
          
          let newQty = item.qty;
          if (newQty * boxWeight > shopQty) {
            newQty = Math.max(1, Math.floor(shopQty / boxWeight));
          }

          return { 
            ...item, 
            tabsSelected: sanitizedTabs,
            qty: newQty
          };
        }
        return item;
      });
    });
  };

  const updateCartDiscount = (id: string, discount: number, type?: 'percent' | 'cash') => {
    setCart(prev => {
      return prev.map(i => {
        if (i.product.id === id) {
          const actualType = type !== undefined ? type : (i.discountType || 'percent');
          const limit = actualType === 'percent' ? 100 : i.product.sellingPrice;
          const finalDiscount = Math.max(0, Math.min(limit, discount));
          return { ...i, discount: finalDiscount, discountType: actualType };
        }
        return i;
      });
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.product.id !== id));
  };

  const getBatchAwareChannelPrice = useCallback((product: Product) => {
    const fallbackPrice = sellingChannel === 'wholesale'
      ? (product.wholesalePrice ?? product.sellingPrice)
      : product.sellingPrice;

    if (activeTenant.businessType !== 'pharmacy' && product.isBulkProduct) {
      return getRetailPackageConfig(product).pricePerBaseUnit || fallbackPrice;
    }

    return getPosSellingPriceForCostingMethod(product, fallbackPrice);
  }, [sellingChannel, activeTenant.businessType, getRetailPackageConfig]);

  // Price cache keyed by product id + batch count + selling price
  // Avoids re-running getPosSellingPriceForCostingMethod (which does array spread/filter/sort)
  // on every render for products whose batches/price haven't changed
  const batchPriceCache = useMemo(() => {
    const cache = new Map<string, number>();
    const allProducts = [...(products || [])];
    allProducts.forEach(p => {
      const cacheKey = `${p.id}:${(p.batches || []).length}:${p.sellingPrice}:${sellingChannel}`;
      if (!cache.has(cacheKey)) {
        const fallbackPrice = sellingChannel === 'wholesale'
          ? (p.wholesalePrice ?? p.sellingPrice)
          : p.sellingPrice;
        if (activeTenant.businessType !== 'pharmacy' && p.isBulkProduct) {
          cache.set(cacheKey, getRetailPackageConfig(p).pricePerBaseUnit || fallbackPrice);
        } else {
          cache.set(cacheKey, getPosSellingPriceForCostingMethod(p, fallbackPrice));
        }
      }
    });
    return cache;
  }, [products, sellingChannel, activeTenant.businessType]);

  // Fast price lookup — uses batchPriceCache, falls back to direct calculation
  const getChannelPrice = useCallback((product: Product): number => {
    const cacheKey = `${product.id}:${(product.batches || []).length}:${product.sellingPrice}:${sellingChannel}`;
    const cached = batchPriceCache.get(cacheKey);
    if (cached !== undefined) return cached;
    return getBatchAwareChannelPrice(product);
  }, [batchPriceCache, getBatchAwareChannelPrice, sellingChannel]);

  const getCartUnitPrice = useCallback((item: {
    product: Product;
    bulkSellMode?: 'scale' | 'pcs';
    dosageType?: 'packet' | 'full' | 'half' | 'tabs' | 'strip' | 'dose' | 'unit';
    tabsSelected?: number;
  }) => {
    const isPharmacy = activeTenant.businessType === 'pharmacy';
    const channelBasePrice = getChannelPrice(item.product); // uses batchPriceCache — instant
    let unitPrice = channelBasePrice;

    if (item.product.isBulkProduct) {
      const bMode = item.bulkSellMode || (item.product.sellingMode === 'hybrid' ? 'scale' : item.product.sellingMode);
      if (bMode === 'scale' || bMode === 'pcs') {
        unitPrice = getRetailPackageConfig(item.product).pricePerBaseUnit || channelBasePrice;
      }
    }

    if (isPharmacy) {
      const dType = item.dosageType || 'packet';
      const doseCfg = getPharmacyDoseConfig(item.product);
      if (doseCfg.hierarchyLevels) {
        const selectedLevel = doseCfg.hierarchyLevels.find(level => level.id === dType) || doseCfg.hierarchyLevels[0];
        const baseUnits = dType === 'tabs' || dType === 'unit'
          ? Math.max(1, item.tabsSelected || 1)
          : Math.max(1, Number(selectedLevel.quantityToBaseUnit || 1));
        unitPrice = doseCfg.tabPrice * baseUnits;
      } else if (dType === 'packet') {
        unitPrice = doseCfg.packetPrice || channelBasePrice;
      } else if (dType === 'full') {
        unitPrice = doseCfg.fullDosePrice;
      } else if (dType === 'half') {
        unitPrice = doseCfg.halfDosePrice;
      } else if (dType === 'tabs') {
        const tSelected = item.tabsSelected || 1;
        unitPrice = doseCfg.tabPrice * tSelected;
      }
    }

    return unitPrice;
  }, [activeTenant.businessType, getChannelPrice, getPharmacyDoseConfig, getRetailPackageConfig]);

  // Pre-compute prices for ALL filtered products once — not per card per render
  const productPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredProducts.forEach(p => map.set(p.id, getChannelPrice(p)));
    return map;
  }, [filteredProducts, getBatchAwareChannelPrice]);

  // Pre-compute remaining stock labels once per render
  const productRemainingMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredProducts.forEach(p => {
      const shopQty = p.shopStockQty ?? 0;
      map.set(p.id, activeTenant.businessType === 'pharmacy'
        ? formatPharmacyRemaining(shopQty, p)
        : formatRetailPackageRemaining(shopQty, p));
    });
    return map;
  }, [filteredProducts, activeTenant.businessType]);

  // Pre-compute ALL cart item display values once — avoids calling getPharmacyDoseConfig etc per render
  const cartDisplayData = useMemo(() => {
    return cart.map(item => {
      const isPharmacy = activeTenant.businessType === 'pharmacy';
      const dosageType = item.dosageType || 'packet';
      const doseCfg = getPharmacyDoseConfig(item.product);
      const tabsSelected = item.tabsSelected || 1;
      const basePrice = getCartUnitPrice(item);
      const isCash = item.discountType === 'cash';
      const discountPrice = isCash
        ? Math.max(0, basePrice - item.discount)
        : basePrice * (1 - item.discount / 100);
      let dosageLabel = 'Packet';
      if (isPharmacy) {
        const selectedLevel = doseCfg.hierarchyLevels?.find(level => level.id === dosageType);
        if (selectedLevel) dosageLabel = selectedLevel.unit;
        else if (dosageType === 'full') dosageLabel = `Full Dose (${doseCfg.tabsPerDose} ${doseCfg.baseUnit})`;
        else if (dosageType === 'half') dosageLabel = `Half Dose (${doseCfg.halfDoseTabs} tabs)`;
        else if (dosageType === 'tabs' || dosageType === 'unit') dosageLabel = `${tabsSelected} ${doseCfg.baseUnit}`;
      }
      const projectedRemaining = isPharmacy
        ? formatPharmacyRemaining((item.product.shopStockQty || 0) - (item.qty * getPharmacyDoseWeight(item.product, dosageType, item.tabsSelected)), item.product)
        : supportsMeasuredRetail(item.product)
          ? formatRetailPackageRemaining((item.product.shopStockQty || 0) - item.qty, item.product)
          : '';
      return { item, dosageType, doseCfg, tabsSelected, basePrice, discountPrice, dosageLabel, projectedRemaining, isPharmacy };
    });
  }, [cart, activeTenant.businessType, getCartUnitPrice]);

  // Pricing calculations — fully memoized for instant updates
  // subtotal depends ONLY on cart + sellingChannel — zero external prop dependencies.
  // cart items carry item.product.sellingPrice already set at add-to-cart time.
  // This guarantees subtotal updates in the EXACT same render as any cart change.
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const basePrice = sellingChannel === 'wholesale'
        ? (item.product.wholesalePrice ?? item.product.sellingPrice ?? 0)
        : (item.product.sellingPrice ?? 0);
      const isCash = item.discountType === 'cash';
      const discountPrice = isCash
        ? Math.max(0, basePrice - (item.discount || 0))
        : basePrice * (1 - (item.discount || 0) / 100);
      return sum + (discountPrice * item.qty);
    }, 0);
  }, [cart, sellingChannel]);

  const orderDiscountAmt = useMemo(() =>
    orderDiscountType === 'cash'
      ? Math.max(0, Math.min(subtotal, orderDiscount))
      : subtotal * (Math.max(0, Math.min(100, orderDiscount)) / 100),
  [subtotal, orderDiscountType, orderDiscount]);

  const taxableSubtotal = useMemo(() =>
    Math.max(0, subtotal - orderDiscountAmt),
  [subtotal, orderDiscountAmt]);

  const tax = useMemo(() =>
    vatStatus === 'vat' ? taxableSubtotal * activeTenant.taxRate : 0,
  [vatStatus, taxableSubtotal, activeTenant.taxRate]);

  const grandTotal = useMemo(() =>
    taxableSubtotal + tax + deliveryCost,
  [taxableSubtotal, tax, deliveryCost]);

  // Memoized total item count — avoids inline cart.reduce in JSX on every render
  const cartTotalQty = useMemo(() =>
    cart.reduce((sum, i) => sum + i.qty, 0),
  [cart]);

  // Checkout Execution
  const triggerCheckout = () => {
    if (cart.length === 0) return;

    setPaymentStatus('idle');
    setPaymentMethod('Cash');
    const availableDeliveryModes = systemSettings?.business?.deliveryPaymentModes && systemSettings.business.deliveryPaymentModes.length > 0 
      ? systemSettings.business.deliveryPaymentModes 
      : (systemSettings?.business?.paymentModes || ['Cash']);
    setDeliveryPaymentMethod(availableDeliveryModes[0]);
    setMultiCashAmount(Math.round(grandTotal / 2));
    setMultiBankAmount(grandTotal - Math.round(grandTotal / 2));
    setAmountPaid(Number(grandTotal.toFixed(2)));
    setReferenceCode('');
    setPaymentNote('');
    setIsCheckoutOpen(true);
  };

  const submitPayment = () => {
    finalizeSale();
  };

  const finalizeSale = () => {
    const pendingBatchUpdates: Record<string, import('../types').ProductBatch[]> = {};

    // Generate sale item models
    const saleItems: SaleItem[] = cart.map(i => {
      const isPharmacy = activeTenant.businessType === 'pharmacy';
      const dType = i.dosageType || 'packet';
      
      const channelBasePrice = getChannelPrice(i.product); // cached — no repeated batch sort

      const isBulk = i.product.isBulkProduct;
      const bMode = i.bulkSellMode || (isBulk ? (i.product.sellingMode === 'hybrid' ? 'scale' : i.product.sellingMode) : 'standard');

      let unitPrice = channelBasePrice;
      let ratioScaling = 1;

      if (isBulk) {
        if (bMode === 'scale' || bMode === 'pcs') {
           unitPrice = getRetailPackageConfig(i.product).pricePerBaseUnit || channelBasePrice;
        }
      }

      if (isPharmacy) {
        const doseCfg = getPharmacyDoseConfig(i.product);
        if (doseCfg.hierarchyLevels) {
          const selectedLevel = doseCfg.hierarchyLevels.find(level => level.id === dType) || doseCfg.hierarchyLevels[0];
          const baseUnits = dType === 'tabs' || dType === 'unit'
            ? Math.max(1, i.tabsSelected || 1)
            : Math.max(1, Number(selectedLevel.quantityToBaseUnit || 1));
          unitPrice = doseCfg.tabPrice * baseUnits;
          ratioScaling = baseUnits;
        } else if (dType === 'packet') {
          unitPrice = doseCfg.packetPrice || channelBasePrice;
          ratioScaling = doseCfg.tabsPerPacket;
        } else if (dType === 'full') {
          unitPrice = doseCfg.fullDosePrice;
          ratioScaling = doseCfg.tabsPerDose;
        } else if (dType === 'half') {
          unitPrice = doseCfg.halfDosePrice;
          ratioScaling = doseCfg.halfDoseTabs;
        } else if (dType === 'tabs') {
          const tSelected = i.tabsSelected || 1;
          unitPrice = doseCfg.tabPrice * tSelected;
          ratioScaling = tSelected;
        }
      }

      // Process Batches deduction!
      let deductQtyReal = i.qty;
      if (isPharmacy) {
          deductQtyReal = i.qty * ratioScaling;
      }
      
      const sellMethod = getProductCostingMethod(i.product);
      const batchesUsed: import('../types').SaleBatchInfo[] = [];
      let blendedCost = i.product.costPrice;

      if (i.product.batches && i.product.batches.length > 0) {
          const deduction = deductBatchesForSale(i.product, deductQtyReal, pendingBatchUpdates[i.product.id]);
          batchesUsed.push(...deduction.batchesUsed);
          pendingBatchUpdates[i.product.id] = deduction.updatedBatches;

          if (sellMethod === 'average_price') {
              blendedCost = i.product.averageBuyingCost || calculateWeightedAverageCost(i.product.batches, i.product.costPrice);
              unitPrice = getPosSellingPriceForCostingMethod(i.product, unitPrice, 'average_price');
          } else if (sellMethod === 'batch_price') {
              blendedCost = deduction.batchesUsed[0]?.buyingPrice || i.product.latestBuyingPrice || i.product.costPrice;
              unitPrice = deduction.batchesUsed[0]?.sellingPrice || unitPrice;
          } else {
              blendedCost = deduction.unitCost;
              unitPrice = deduction.batchesUsed[0]?.sellingPrice || unitPrice;
          }
      }
      const saleUnitCost = i.qty > 0 ? blendedCost * (deductQtyReal / i.qty) : blendedCost;

      const pharmacyCfg = isPharmacy ? getPharmacyDoseConfig(i.product) : null;
      const pharmacyLevelLabel = pharmacyCfg?.hierarchyLevels?.find(level => level.id === dType)?.unit
        || (dType === 'packet' ? 'Packet' : dType === 'full' ? 'Full Dose' : dType === 'half' ? 'Half Dose' : `${i.tabsSelected || 1} ${pharmacyCfg?.baseUnit || 'Units'}`);

      return {
        productId: i.product.id,
        productName: isPharmacy && dType !== 'packet' 
          ? `${i.product.name} [${pharmacyLevelLabel}]`
          : i.product.name,
        qty: i.qty,
        price: unitPrice,
        discount: i.discount,
        discountType: i.discountType || 'percent',
        dosageType: i.dosageType,
        tabsSelected: i.tabsSelected,
        tabsPerPack: i.product.tabsPerPack,
        channel: sellingChannel,
        isBulkProduct: isBulk,
        unit: isPharmacy ? (pharmacyCfg?.baseUnit || i.product.baseUnit || 'Unit') : getRetailPackageConfig(i.product).baseUnit,
        baseUnit: isPharmacy ? (pharmacyCfg?.baseUnit || i.product.baseUnit || 'Unit') : getRetailPackageConfig(i.product).baseUnit,
        conversionToBaseUnit: isPharmacy ? ratioScaling : getRetailPackageConfig(i.product).conversionToBaseUnit,
        sellUnit: isPharmacy ? pharmacyLevelLabel : getRetailPackageConfig(i.product).baseUnit,
        sellMode: bMode as 'scale' | 'pcs',
        batchesUsed: batchesUsed.length > 0 ? batchesUsed : undefined,
        baseQuantityDeducted: Number(deductQtyReal.toFixed(3)),
        costingMethodUsed: sellMethod,
        costPriceAtSale: Number(saleUnitCost.toFixed(2))
      };
    });

    const isVat = vatStatus === 'vat';
    const vfdControlNo = isVat ? 'TZ-VFD-TRA-' + Math.floor(Math.random() * 9000000000 + 1000000000) : undefined;
    const vfdSignature = isVat ? 'TRA-VERIFY-' + Math.random().toString(36).substr(2, 6).toUpperCase() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;
    const normalizedAmountPaid = paymentMethod === 'Multi-Channel'
      ? Number((multiCashAmount + multiBankAmount).toFixed(2))
      : Math.max(0, Number(amountPaid || 0));
    const amountDue = Math.max(0, Number((grandTotal - normalizedAmountPaid).toFixed(2)));
    const manualPaymentStatus: Sale['paymentStatus'] = amountDue <= 0
      ? 'paid'
      : normalizedAmountPaid > 0
        ? 'partial'
        : 'unpaid';
    const cleanTransactionReference = referenceCode.trim();
    const cleanPaymentNote = paymentNote.trim();

    const newSale: Sale = {
      id: 'sl-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: saleItems,
      total: grandTotal,
      productTotal: grandTotal - deliveryCost, // revenue excluding delivery fee
      tax: tax,
      deliveryCost: deliveryCost,
      deliveryPaymentMethod: deliveryCost > 0 ? deliveryPaymentMethod : undefined,
      discount: orderDiscount,
      discountType: orderDiscountType,
      paymentMethod: paymentMethod as any,
      reference: cleanTransactionReference || Math.random().toString(36).substring(2, 8).toUpperCase(),
      tenantId: activeTenant.id,
      timestamp: (() => {
        if (saleDate) {
          try {
            const now = new Date();
            const target = new Date(`${saleDate}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.000Z`);
            return isNaN(target.getTime()) ? new Date().toISOString() : target.toISOString();
          } catch (e) {
            return new Date().toISOString();
          }
        }
        return new Date().toISOString();
      })(),
      actualTimestamp: new Date().toISOString(),
      syncStatus: isOfflineMode ? 'pending' : 'synced',
      cashierName: userName,
      amountPaid: normalizedAmountPaid,
      amountDue,
      paymentStatus: manualPaymentStatus,
      transactionReference: cleanTransactionReference || undefined,
      paymentNote: cleanPaymentNote || undefined,
      isManualPayment: true,
      gatewayProvider: null,
      gatewayTransactionId: null,
      customerName: customerName ? customerName : 'Walk-In Customer',
      customerPhone: customerPhone ? customerPhone : undefined,
      staffName: userName,
      vatStatus: vatStatus,
      vfdControlNo,
      vfdSignature,
      multiCashAmount: paymentMethod === 'Multi-Channel' ? multiCashAmount : undefined,
      multiBankAmount: paymentMethod === 'Multi-Channel' ? multiBankAmount : undefined,
      paymentBreakdown: paymentMethod === 'Multi-Channel'
        ? [
            { method: 'Cash', amount: Math.max(0, Number(multiCashAmount || 0)) },
            { method: 'Bank', amount: Math.max(0, Number(multiBankAmount || 0)) },
          ].filter(part => part.amount > 0)
        : [{ method: paymentMethod, amount: normalizedAmountPaid }],
      channel: sellingChannel,

    };

    // Deduct stock quantities directly from shop stock taking fractional dosages into account
    const updatedProducts = products.map(prod => {
      const soldItem = cart.find(i => i.product.id === prod.id);
      if (soldItem) {
        let deductQty = soldItem.qty;
        
        if (prod.isBulkProduct) {
          const bMode = soldItem.bulkSellMode || (prod.sellingMode === 'hybrid' ? 'scale' : prod.sellingMode);
          deductQty = soldItem.qty;
        } else if (activeTenant.businessType === 'pharmacy') {
          const dType = soldItem.dosageType || 'packet';
          deductQty = soldItem.qty * getPharmacyDoseWeight(soldItem.product, dType, soldItem.tabsSelected);
        }

        const nextShopQty = Math.max(0, (prod.shopStockQty ?? 0) - deductQty);
        
        // Use nice rounded decimals to avoid IEEE float problems
        const roundedShop = Number(nextShopQty.toFixed(3));
        const roundedTotal = Number((roundedShop + (prod.storeStockQty ?? 0)).toFixed(3));
        const updatedBatches = pendingBatchUpdates[prod.id] || prod.batches;

        return {
          ...prod,
          shopStockQty: roundedShop,
          stockQty: roundedTotal,
          batches: updatedBatches,
          averageBuyingCost: updatedBatches ? calculateWeightedAverageCost(updatedBatches, prod.costPrice) : prod.averageBuyingCost,
        };
      }
      return prod;
    });

    onUpdateStocks(updatedProducts);
    onAddSale(newSale);
    setReceiptResult(newSale);
    setRecipientWhatsApp(customerPhone || '');
    setPaymentStatus('completed');
    setCart([]);
    setDeliveryCost(0);
    setOrderDiscount(0);
    setOrderDiscountType('percent');
    setCustomerName('');
    setCustomerPhone('');
    setAmountPaid(0);
    setReferenceCode('');
    setPaymentNote('');
  };

  const handleRequestVoid = () => {
    setCart([]);
    setPosWarning("Till basket cleared.");
  };

  return (
    <div id="pos-view-container" className="relative">
      
      {/* SCAN FEEDBACK TOAST STACK */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none">
        <AnimatePresence>
          {scanToasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl shadow-md border text-sm font-semibold text-white flex items-center justify-between gap-3 ${
                toast.type === 'error'
                  ? 'bg-rose-600 border-rose-500'
                  : toast.type === 'warning'
                  ? 'bg-amber-500 border-amber-450'
                  : 'bg-emerald-600 border-emerald-500'
              }`}
            >
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScanToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="text-white hover:opacity-80 bg-transparent border-none cursor-pointer p-1 font-extrabold text-xs select-none"
              >
                ✕
              </button>
            </div>
          ))}
        </AnimatePresence>
      </div>

      <div id="pos-view" className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 lg:h-[calc(100dvh-130px)] lg:overflow-hidden">
        
        {/* Product selection grid (8/12 scope) */}
        <div className="lg:col-span-7 xl:col-span-8 min-h-0 flex flex-col space-y-4 md:space-y-6">
          {/* Search and Categories controls */}
          <div className="bg-white px-3 py-2 md:border border-slate-200 md:p-4 rounded-none md:rounded-2xl space-y-3 shadow-none md:shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/70 border border-slate-200 rounded-2xl p-1.5 relative md:mx-0">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Code, Barcode or Title..."
                  className="w-full bg-transparent text-[13px] pl-9 pr-24 py-1.5 text-slate-800 placeholder-slate-400 font-sans font-medium outline-none border-none focus:ring-0"
                />
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400 pointer-events-none" />
                
                {/* SCAN BARCODE ICON BUTTON IN THE RIGHT OF SEARCH BAR */}
                <button 
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="absolute right-2 top-1.5 p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-600 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1 select-none"
                  title="Scan Barcode / QR EAN code with reader"
                >
                  <Scan className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="hidden xl:inline text-[9px] font-bold font-mono text-slate-500 tracking-wider">SCAN CODE</span>
                </button>
              </div>

            </div>

          {/* Selling Channel Selector and Warnings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-fit">
              <button
                type="button"
                onClick={() => {
                  setSellingChannel('retail');
                  setPosWarning('Selling channel switched to RETAIL. Standard checkout prices applied.');
                }}
                className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  sellingChannel === 'retail'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <span>🛒 Retail Channel</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSellingChannel('wholesale');
                  setPosWarning('Selling channel switched to WHOLESALE. wholesale prices & min-qty check active.');
                }}
                className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  sellingChannel === 'wholesale'
                    ? 'bg-teal-650 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <span>📦 Wholesale Channel</span>
              </button>
            </div>

            <div className="text-right flex items-center space-x-2">
              <span className={`px-2.5 py-1 text-[9px] font-black tracking-widest uppercase rounded-lg border ${
                sellingChannel === 'wholesale'
                  ? 'bg-teal-50 text-teal-800 border-teal-200 animate-pulse'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                ACTIVE SELLING CHANNEL: {sellingChannel.toUpperCase()}
              </span>
            </div>
          </div>

          {posWarning && (
            <div className="bg-amber-55 border border-amber-200 rounded-2xl py-3 px-4 flex items-center justify-between text-[11.5px] text-amber-900 font-medium shadow-xs">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{posWarning}</span>
              </div>
              <button 
                type="button"
                onClick={() => setPosWarning(null)}
                className="text-amber-500 hover:text-amber-705 font-bold text-[10px] uppercase tracking-wider cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* BARCODE FEEDBACK BANNER */}
          {barcodeToast && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl py-2.5 px-4 mx-2 md:mx-0 flex items-center justify-between text-[11px] text-emerald-800 animate-pulse font-medium shadow-xs">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{barcodeToast}</span>
              </div>
              <button 
                onClick={() => setBarcodeToast(null)}
                className="text-emerald-500 hover:text-emerald-800 text-xs font-bold bg-transparent border-none cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Desktop Categories Pill List */}
          <div className="hidden xl:flex flex-wrap items-center gap-2 pt-0.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all uppercase cursor-pointer ${
                  (cat === 'All' && !selectedCategory) || (selectedCategory === cat)
                    ? 'bg-emerald-600 text-white font-bold shadow-xs' 
                    : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Mobile Categories Dropdown */}
          <div className="xl:hidden px-2 pt-0.5">
            <div className="relative">
              <select
                value={selectedCategory || 'All'}
                onChange={(e) => setSelectedCategory(e.target.value === 'All' ? null : e.target.value)}
                className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 text-[13px] font-medium text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-emerald-600">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Product listing grid — 3 cols mobile/tablet, 4 cols desktop */}
        <div
          className="lg:flex-1 lg:overflow-y-auto lg:pr-2 scrollbar-thin scrollbar-thumb-slate-200 w-full pos-product-grid"
          style={showProductImages ? {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            padding: '8px 10px',
            alignItems: 'start',
          } : {
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '8px 10px',
          }}
        >
          {filteredProducts.length === 0 ? (
            <div className="sm:col-span-3 text-center py-16 text-sm font-mono text-slate-500 bg-white border border-slate-200 rounded-3xl shadow-sm">
              No matching {activeTenant.businessType === 'pharmacy' ? 'pharmaceutical products' : 'retail items'} in stock.
            </div>
          ) : (
            filteredProducts.map(prod => {
              const shopQty = prod.shopStockQty ?? 0;
              const isLow = shopQty <= prod.alertQty;
              const isOut = shopQty <= 0;
              const displayPrice = productPriceMap.get(prod.id) ?? prod.sellingPrice;
              const remainingLabel = productRemainingMap.get(prod.id) ?? '';
              return (
                <div
                  key={prod.id}
                  onClick={() => {
                    if (!isOut) { addToCart(prod); playCartSuccessBeepAfterPaint(); }
                    else { playOutOfStockBeep(); }
                  }}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    cursor: isOut ? 'not-allowed' : 'pointer',
                    opacity: isOut ? 0.6 : 1,
                    display: 'flex',
                    flexDirection: showProductImages ? 'column' : 'row',
                    alignItems: showProductImages ? 'stretch' : 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    userSelect: 'none',
                    minHeight: showProductImages ? 190 : 44,
                  }}
                  onMouseEnter={e => { if (!isOut) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'; }}}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                >
                  {/* ── IMAGE ── */}
                  {showProductImages && (
                    <div style={{ position: 'relative', width: '100%', height: 130, background: '#f8fafc', flexShrink: 0, overflow: 'hidden', display: 'block', borderRadius: '16px 16px 0 0' }}>
                      {getProductImage(prod) !== '' ? (
                        <img
                          src={getProductImage(prod)}
                          alt={prod.name}
                          referrerPolicy="no-referrer"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                        />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 32, fontWeight: 900, color: '#e2e8f0' }}>{prod.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}

                      {/* Stock badge — top right */}
                      {!isOut && remainingLabel && (
                        <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.92)', color: '#475569', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                          {remainingLabel}
                        </span>
                      )}

                      {/* Low stock badge — top left */}
                      {isLow && !isOut && (
                        <span style={{ position: 'absolute', top: 6, left: 6, background: '#f59e0b', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 99, textTransform: 'uppercase' }}>
                          Low
                        </span>
                      )}

                      {/* Out of stock overlay */}
                      {isOut && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── BODY ── */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: showProductImages ? '8px 10px' : '8px 10px',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {/* Name + divider + price */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {prod.name}
                      </p>
                      {/* Accent line */}
                      <div style={{ width: 28, height: 2, background: '#10b981', borderRadius: 99, margin: '4px 0' }} />
                      <p style={{ fontSize: 12, fontWeight: 800, color: '#059669', margin: 0, lineHeight: 1 }}>
                        {currency}{Math.round(displayPrice).toLocaleString()}
                      </p>
                    </div>

                    {/* Add button */}
                    {!isOut && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); addToCart(prod); playCartSuccessBeepAfterPaint(); }}
                        style={{
                          width: 28, height: 28, borderRadius: 9,
                          background: '#10b981', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'background 0.15s, transform 0.1s',
                          boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#059669')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#10b981')}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 2v8M2 6h8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })

          )}
        </div>
      </div>

      {/* Cart Summary right panel (4/12 scope) */}
      <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-3xl lg:h-full max-h-none lg:sticky lg:top-0 flex flex-col justify-between overflow-hidden shadow-sm">
        {/* Cart Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-800 text-sm">Shopping Cart</span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            <span className="text-xs font-mono font-bold bg-white border border-slate-200 px-3 py-1 rounded-lg text-slate-700 shadow-xs">
              {cartTotalQty} items
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleRequestVoid}
                className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg px-2 py-1 transition-colors flex items-center space-x-1 cursor-pointer select-none"
                title="Void / Clear entire basket"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Void</span>
              </button>
            )}
          </div>
        </div>

        {/* Sale Date Picker / Backdate controller */}
        <div className="bg-amber-50/50 border-b border-amber-100 p-3 flex items-center justify-between text-xs gap-3 font-sans shrink-0">
          <div className="flex items-center space-x-1.5 text-amber-800 font-medium">
            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-bold text-slate-705">Sale Entry Date:</span>
          </div>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-bold font-mono text-slate-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          />
        </div>

        {/* 🛒 / 📦 Highly prominent Dual-Channel Selector inside the Basket column - only visible if wholesale is enabled for at least 1 product */}
        {hasAnyWholesaleProduct && (
          <div className="bg-slate-100 border-b border-slate-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1 font-sans">
              Choose Channel:
            </span>
            <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-inner w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setSellingChannel('retail');
                  setPosWarning('Selling channel switched to RETAIL. Standard checkout prices applied.');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                  sellingChannel === 'retail'
                    ? 'bg-emerald-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-800 bg-transparent'
                }`}
              >
                <span>🛒 Retail Channel</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSellingChannel('wholesale');
                  setPosWarning('Selling channel switched to WHOLESALE. wholesale prices & min-qty check active.');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                  sellingChannel === 'wholesale'
                    ? 'bg-teal-650 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-800 bg-transparent'
                }`}
              >
                <span>📦 Wholesale Channel</span>
              </button>
            </div>
          </div>
        )}

        {/* Cart items list scroll context - dynamically adapts height and scroll posture neatly */}
        <div className="p-4 overflow-y-auto space-y-2.5 max-h-[272px] scrollbar-thin scrollbar-thumb-slate-200 flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center space-y-3 text-slate-400 h-full py-12">
              <ShoppingCart className="w-8 h-8 text-slate-300 stroke-[1.25]" />
            </div>
          ) : (
            cartDisplayData.map(({ item, dosageType, doseCfg, tabsSelected, basePrice, discountPrice, dosageLabel, projectedRemaining, isPharmacy }) => {
              const tabsPerPack = doseCfg.tabsPerPacket;

              return (
                <div key={item.product.id} className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1.5 relative group text-left">
                  {/* Main Line: Name + price on Left, Qty Controls + Total Price on Right */}
                  <div className="flex items-center justify-between gap-2.5">
                    {/* Left: Name and price directly below it */}
                    <div className="text-left font-sans flex-grow min-w-0">
                      <h6 className="text-[11.5px] font-bold text-slate-800 line-clamp-1 flex items-center gap-1">
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[8px] font-black font-mono leading-none border shrink-0 ${
                          sellingChannel === 'wholesale' 
                            ? 'bg-teal-50 text-teal-850 border-teal-250' 
                            : 'bg-sky-50 text-sky-750 border-sky-200'
                        }`} title={sellingChannel === 'wholesale' ? 'Wholesale Price Active' : 'Retail Price Active'}>
                          {sellingChannel === 'wholesale' ? 'W' : 'R'}
                        </span>
                        <span className="truncate">{item.product.name}</span>
                      </h6>
                      
                      {/* Price below name - Simplified as requested */}
                      {isPharmacy && (
                        <div className="text-[10px] text-indigo-750 font-bold bg-indigo-50/70 py-0.5 px-1.5 mt-0.5 rounded truncate w-max">
                          {dosageLabel}
                        </div>
                      )}
                    </div>

                    {/* Right: Quantity increment/decrement box + delete button */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {supportsMeasuredRetail(item.product) ? (
                        <div className="flex flex-col items-end space-y-1">
                          {item.product.isBulkProduct && item.product.sellingMode === 'hybrid' && (
                            <div className="flex bg-slate-100 rounded p-0.5 border border-slate-200 text-[9px] font-bold">
                              <button type="button" onClick={() => updateCartBulkMode(item.product.id, 'scale')} className={`px-1.5 py-0.5 rounded ${item.bulkSellMode !== 'pcs' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Scale</button>
                              <button type="button" onClick={() => updateCartBulkMode(item.product.id, 'pcs')} className={`px-1.5 py-0.5 rounded ${item.bulkSellMode === 'pcs' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Pcs</button>
                            </div>
                          )}
                          {(!item.product.isBulkProduct || (item.bulkSellMode || (item.product.sellingMode === 'hybrid' ? 'scale' : item.product.sellingMode)) === 'scale') ? (
                            <div className="flex flex-wrap justify-end gap-1 max-w-[190px]">
                              {(() => {
                                const baseUnit = getRetailPackageConfig(item.product).baseUnit;
                                return [
                                  { label: `1/4 ${baseUnit}`, val: 0.25 },
                                  { label: `1/2 ${baseUnit}`, val: 0.5 },
                                  { label: `3/4 ${baseUnit}`, val: 0.75 },
                                  { label: `1 ${baseUnit}`, val: 1 },
                                ].map(f => (
                                  <button type="button" key={f.label} onClick={() => updateCartQtyDirect(item.product.id, f.val)} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-700 hover:bg-slate-50">{f.label}</button>
                                ));
                              })()}
                            </div>
                          ) : (
                            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                              <button type="button" onClick={() => updateCartQty(item.product.id, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"><Minus className="w-2.5 h-2.5" /></button>
                              <input type="number" min="1" value={item.qty} onChange={(e) => updateCartQtyDirect(item.product.id, parseInt(e.target.value) || 1)} className="w-8 text-center font-black font-mono text-slate-800 bg-transparent py-0 text-[10.5px] focus:outline-none border-none" />
                              <button type="button" onClick={() => updateCartQty(item.product.id, 1)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"><Plus className="w-2.5 h-2.5" /></button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                          <button 
                            type="button"
                            onClick={() => updateCartQty(item.product.id, -1)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <input 
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              updateCartQtyDirect(item.product.id, val);
                            }}
                            className="w-8 text-center font-black font-mono text-slate-800 bg-transparent py-0 text-[10.5px] focus:outline-none border-none"
                          />
                          <button 
                            type="button"
                            onClick={() => updateCartQty(item.product.id, 1)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Total price for this line item and trash icon */}
                      <div className="flex items-center space-x-1.5 text-right pl-1">
                        <span className="font-mono font-black text-slate-800 text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {currency}{(discountPrice * item.qty).toLocaleString()}
                        </span>
                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1 rounded hover:bg-slate-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Supplemental Options Box: Dosage option selector for Pharmacies */}
                  {isPharmacy && (
                    <div className="pt-1.5 border-t border-dashed border-slate-200/50 flex flex-wrap gap-1.5 justify-start items-center text-[10px]">
                      <div className="flex items-center space-x-1">
                        <select
                          value={dosageType}
                          onChange={(e) => updateCartDosage(item.product.id, e.target.value as any)}
                          className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[9.5px] font-bold text-slate-600 focus:outline-none cursor-pointer"
                        >
                          {doseCfg.hierarchyLevels ? (
                            doseCfg.hierarchyLevels.map(level => (
                              <option key={level.id} value={level.id}>{level.unit}</option>
                            ))
                          ) : (
                            <>
                              <option value="packet">Packet</option>
                              <option value="full">Full Dose</option>
                              <option value="half">Half Dose</option>
                              <option value="tabs">By Tabs</option>
                            </>
                          )}
                        </select>
                        {(dosageType === 'tabs' || dosageType === 'unit') && (
                          <div className="flex items-center space-x-1 border border-slate-200 bg-white rounded px-1 py-0.5">
                            <input
                              type="number"
                              min="1"
                              max={tabsPerPack}
                              value={tabsSelected}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                updateCartTabsSelected(item.product.id, val);
                              }}
                              className="w-6 text-center font-mono font-bold text-[9px] text-slate-800 bg-transparent outline-none focus:ring-0"
                            />
                            <span className="text-[8px] font-mono text-slate-400">/{tabsPerPack}</span>
                          </div>
                        )}
                        <span className="text-[8.5px] font-mono text-slate-400">
                          Remain: {projectedRemaining}
                        </span>
                      </div>
                    </div>
                  )}
                  {!isPharmacy && supportsMeasuredRetail(item.product) && (
                    <div className="pt-1.5 border-t border-dashed border-slate-200/50 flex flex-wrap gap-1.5 justify-start items-center text-[9px] font-mono text-slate-400">
                      <span>
                        {formatProductQuantity(item.qty, { ...item.product, unit: getRetailPackageConfig(item.product).baseUnit } as Product)} x {currency}{Math.round(getRetailPackageConfig(item.product).pricePerBaseUnit).toLocaleString()}
                      </span>
                      <span>Remain: {projectedRemaining}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Totals and checkout */}
        <div
          key={`pos-totals-${cart.length}-${subtotal}-${grandTotal}`}
          data-testid="pos-totals"
          className="p-4 bg-slate-50 border-t border-slate-200/80 space-y-4"
        >
          <div className="space-y-1.5 text-xs font-bold font-sans">
            <div className="flex justify-between text-slate-500">
              <span>Till Subtotal</span>
              <span data-testid="pos-subtotal" className="font-mono">{currency}{Math.round(subtotal).toLocaleString()}</span>
            </div>

            {/* Global Order level Discount manual input with toggle */}
            <div className="flex justify-between items-center text-slate-500 py-1 border-t border-dashed border-slate-200">
              <span className="font-bold text-slate-600 flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-500" />
                <span>Order Discount:</span>
              </span>
              <div className="flex items-center space-x-1.5">
                <select
                  value={orderDiscountType}
                  onChange={(e) => {
                    setOrderDiscountType(e.target.value as 'percent' | 'cash');
                    setOrderDiscount(0);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-extrabold text-slate-600 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                >
                  <option value="percent">% Pct</option>
                  <option value="cash">{currency} Cash</option>
                </select>
                <input 
                  type="number" 
                  min="0"
                  max={orderDiscountType === 'percent' ? 100 : subtotal}
                  value={orderDiscount || ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    const limit = orderDiscountType === 'percent' ? 100 : subtotal;
                    setOrderDiscount(Math.min(limit, val));
                  }}
                  placeholder="0"
                  className="w-18 bg-white text-right text-emerald-600 px-2 py-1 rounded-lg border border-slate-200 font-extrabold font-mono focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-slate-500 border-t border-dashed border-slate-200 py-1.5">
              <div className="flex flex-col">
                <span className="font-bold text-slate-600 font-sans">Tax Type:</span>
                <span className="text-[9.5px] text-slate-400 font-sans">Customer VAT status</span>
              </div>
              <select
                value={vatStatus}
                onChange={(e) => setVatStatus(e.target.value as 'vat' | 'non-vat')}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10.5px] font-extrabold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
              >
                <option value="non-vat">No Tax (0%)</option>
                <option value="vat">VAT ({Math.round(activeTenant.taxRate * 100)}% TRA VFD)</option>
              </select>
            </div>

            {vatStatus === 'vat' && (
              <div className="flex justify-between text-slate-500 border-t border-dashed border-slate-200 pt-1.5">
                <span>VAT ({Math.round(activeTenant.taxRate * 100)}% Local Law)</span>
                <span className="font-mono">{currency}{Math.round(tax).toLocaleString()}</span>
              </div>
            )}
            
            {/* Delivery Cost manual input */}
            <div className="flex flex-col py-1 border-t border-b border-dashed border-slate-200 my-1">
              <div className="flex justify-between items-center text-slate-500">
                <span className="font-bold text-slate-600">Delivery Charges ({currency})</span>
                <input 
                  type="number" 
                  min="0"
                  value={deliveryCost === 0 ? '' : deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-20 bg-white text-right text-slate-800 px-2 py-1 rounded-lg border border-slate-200 font-black font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              {deliveryCost > 0 && (
                <div className="flex justify-between items-center text-slate-500 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Method</span>
                  <select
                    value={deliveryPaymentMethod}
                    onChange={(e) => setDeliveryPaymentMethod(e.target.value)}
                    className="bg-white text-xs text-slate-700 px-2 py-1 rounded-lg border border-slate-200 font-bold focus:outline-none focus:border-emerald-500"
                  >
                    {(() => {
                      const availableDeliveryModes = systemSettings?.business?.deliveryPaymentModes && systemSettings.business.deliveryPaymentModes.length > 0 
                        ? systemSettings.business.deliveryPaymentModes 
                        : (systemSettings?.business?.paymentModes || ['Cash', 'Mobile Money', 'Bank']);
                      return availableDeliveryModes.map(mode => (
                        <option key={mode} value={mode}>{mode}</option>
                      ));
                    })()}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-between text-base font-black text-slate-900 pt-1">
              <span>ORDER TOTAL</span>
              <span data-testid="pos-grand-total" className="font-mono text-emerald-600 text-lg">{currency}{Math.round(grandTotal).toLocaleString()}</span>
            </div>
          </div>

          <button
            id="pos-checkout-btn"
            disabled={cart.length === 0}
            onClick={triggerCheckout}
            className="hidden xl:flex w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer items-center justify-center space-x-2 shadow-lg shadow-emerald-500/15 active:scale-98"
          >
            <span>Proceed to Payment</span>
          </button>
        </div>
      </div>

      {/* Mobile Sticky Cart Summary */}
      <div
        key={`pos-mobile-total-${cart.length}-${grandTotal}`}
        className="xl:hidden fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 w-full bg-white border-t border-slate-200 px-4 py-3 z-40 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]"
      >
        <div className="flex flex-col space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-slate-700" />
                {cartTotalQty > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full border border-white">
                    {cartTotalQty}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Cart Total</span>
            </div>
            <span data-testid="pos-mobile-grand-total" className="text-emerald-700 font-black font-mono text-base">{currency}{Math.round(grandTotal).toLocaleString()}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={triggerCheckout}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-bold py-3.5 rounded-xl text-sm transition-all active:scale-95 text-center shadow-lg shadow-emerald-500/20"
          >
            Checkout
          </button>
        </div>
      </div>



      {/* CHECKOUT MODAL SYSTEM */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-950/70" style={{paddingBottom: 'calc(var(--dashboard-bottom-nav-height, 0px) + env(safe-area-inset-bottom))'}}>
          <div className="relative bg-white border border-slate-200 md:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{maxHeight: 'calc(100dvh - var(--dashboard-bottom-nav-height, 60px) - env(safe-area-inset-bottom) - env(safe-area-inset-top))' }}>
            {/* Mobile Drag Handle */}
            <div className="w-full flex justify-center pt-3 pb-2 xl:hidden bg-slate-50">
              <div className="w-12 h-1.5 bg-slate-300/50 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 md:py-5 bg-slate-50 border-b border-slate-250 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Payment Mode Till</h4>
              </div>
              <button 
                onClick={() => { setIsCheckoutOpen(false); setPaymentStatus('idle'); }}
                className="text-slate-400 hover:text-slate-705 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Steps router */}
            {paymentStatus === 'idle' && (
              <div className="p-5 space-y-4 overflow-y-auto flex-1" style={{paddingBottom: '1.5rem'}}>

                {/* Grand total — clean, no subtitle text */}
                <div className="text-center py-1">
                  <p className="text-3xl font-black text-slate-950">{currency}{Math.round(grandTotal).toLocaleString()}</p>
                </div>

                {/* Customer — name and phone in ONE row, no label */}
                <div className="grid grid-cols-2 gap-2 pb-3 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Client name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 outline-none transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Phone (optional)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 outline-none transition-all font-mono"
                  />
                </div>

                {/* Payment Method — 2-col grid with logos */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Payment Method</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    {(() => {
                      const rawModes = systemSettings?.business?.paymentModes || [];
                      const modes: Array<{name: string; logoUrl?: string}> = (rawModes as any[]).map((m: any) =>
                        typeof m === 'string' ? { name: m } : m
                      );
                      const allModes = [...modes, { name: 'Multi-Channel' }];

                      return allModes.map(mode => {
                        const isSelected = paymentMethod === mode.name;
                        const isCreditMode = /credit|mkopo|due|debt/i.test(mode.name);
                        const hasLogo = !!mode.logoUrl;

                        return (
                          <button
                            key={mode.name}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(mode.name);
                              setAmountPaid(isCreditMode ? 0 : Number(grandTotal.toFixed(2)));
                              setReferenceCode('');
                              setPaymentNote('');
                              if (mode.name === 'Multi-Channel') {
                                setMultiCashAmount(Math.round(grandTotal / 2));
                                setMultiBankAmount(grandTotal - Math.round(grandTotal / 2));
                              }
                            }}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              padding: '10px 6px',
                              borderRadius: 14,
                              border: isSelected ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                              background: isSelected ? '#16a34a' : '#fff',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              boxShadow: isSelected ? '0 2px 10px rgba(22,163,74,0.25)' : '0 1px 3px rgba(0,0,0,0.04)',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                              position: 'relative',
                              overflow: 'hidden',
                              minHeight: 68,
                            }}
                          >
                            {/* Logo or abbrev circle */}
                            <div style={{
                              width: 32, height: 32, borderRadius: 10,
                              background: isSelected ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', flexShrink: 0,
                            }}>
                              {hasLogo ? (
                                <img src={mode.logoUrl} alt={mode.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: isSelected ? '#fff' : '#64748b' }}>
                                  {mode.name.slice(0, 3)}
                                </span>
                              )}
                            </div>
                            {/* Name */}
                            <span style={{
                              fontSize: 9.5, fontWeight: 700, lineHeight: 1.2, textAlign: 'center',
                              color: isSelected ? '#fff' : '#334155',
                              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical', maxWidth: '100%',
                            }}>
                              {mode.name}
                            </span>
                            {/* Check badge */}
                            {isSelected && (
                              <div style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                                  <path d="M1 3L2.8 4.8L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {paymentMethod !== 'Multi-Channel' && (
                  <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[9.5px] uppercase font-bold text-slate-500 mb-1 block">Amount Paid ({currency})</span>
                        <input
                          type="number"
                          min="0"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono font-bold text-xs text-slate-800"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[9.5px] uppercase font-bold text-slate-500 mb-1 block">Transaction Ref (optional)</span>
                        <input
                          type="text"
                          value={referenceCode}
                          onChange={(e) => setReferenceCode(e.target.value)}
                          placeholder="M-Pesa SMS, bank slip, card ref"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono text-xs text-slate-800"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[9.5px] uppercase font-bold text-slate-500 mb-1 block">Payment Note (optional)</span>
                      <input
                        type="text"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="Manual confirmation note"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 text-xs text-slate-800"
                      />
                    </label>
                    <div className={`text-[10px] uppercase font-black text-center py-1.5 rounded-xl border font-sans ${
                      amountPaid >= grandTotal
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                        : amountPaid > 0
                          ? 'bg-amber-50 text-amber-800 border-amber-100'
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {amountPaid >= grandTotal
                        ? `Paid in full. Change: ${currency}${Math.max(0, amountPaid - grandTotal).toLocaleString()}`
                        : amountPaid > 0
                          ? `Partial payment. Due: ${currency}${Math.max(0, grandTotal - amountPaid).toLocaleString()}`
                          : `Unpaid / credit. Due: ${currency}${grandTotal.toLocaleString()}`}
                    </div>
                  </div>
                )}

                {/* Delivery Payment Mode removed (moved to basket) */}

                <button
                  type="button"
                  onClick={submitPayment}
                  className="w-full py-4 font-bold rounded-2xl text-xs uppercase tracking-wider cursor-pointer active:scale-98 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10"
                >
                  <span>Confirm Payment</span>
                </button>
              </div>
            )}

            {/* Completed state / Receipt print */}
            {paymentStatus === 'completed' && receiptResult && (
              <div className="p-6 space-y-5 max-h-[calc(100dvh-56px-env(safe-area-inset-bottom))] overflow-y-auto bg-slate-50">
                <div className="flex flex-col items-center text-center space-y-2 py-2">
                  <div className="p-2.5 bg-emerald-100 rounded-full border border-emerald-200 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">TRANSACTION APPROVED</h4>
                  <p className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                    {isOfflineMode ? 'MANUAL PAYMENT QUEUED OFFLINE' : 'MANUAL PAYMENT RECORDED SUCCESSFULLY'}
                  </p>
                </div>

                {/* PHYSICAL RECEIPT GRAPHIC CONTAINER */}
                <div id="pos-receipt-pdf-template" className="bg-white text-slate-900 p-5 rounded-3xl font-mono text-xs space-y-4 shadow-xl border-dashed border-2 border-slate-250">
                  <div className="text-center space-y-2 border-b border-dashed border-slate-200 pb-3 flex flex-col items-center">
                    {(((() => { const stores = systemSettings?.business?.registeredStores || []; const activeBranch = stores[0]; const bb = activeBranch && systemSettings?.business?.branchBranding?.[activeBranch]; return bb?.businessLogoLight || bb?.businessLogo || null; })()) || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogoDark || systemSettings?.business?.businessLogo) && (
                      <CachedImage 
                        src={((() => { const stores = systemSettings?.business?.registeredStores || []; const activeBranch = stores[0]; const bb = activeBranch && systemSettings?.business?.branchBranding?.[activeBranch]; return bb?.businessLogoLight || bb?.businessLogo || null; })()) || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogoDark || systemSettings?.business?.businessLogo || undefined} 
                        alt="Logo" 
                        className="w-12 h-12 object-contain mb-1 rounded-lg border border-slate-200 p-0.5" 
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <h5 className="font-bold text-sm uppercase">
                      {systemSettings?.business?.businessName || activeTenant.name}
                    </h5>
                    <p className="text-[10.5px] text-slate-500">
                      {systemSettings?.business?.businessAddress || `${activeTenant.city}, ${activeTenant.country}`}
                    </p>
                    <p className="text-[9.5px] text-slate-500">
                      Tel: {systemSettings?.business?.businessPhone || '+234 (0) 700 9000'}
                    </p>
                  </div>

                  <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-200 pb-2">
                    <div className="flex justify-between">
                      <span>Receipt Ref:</span>
                      <span className="font-bold">{receiptResult.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{new Date(receiptResult.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{activeTenant.businessType === 'pharmacy' ? 'Pharmacist:' : 'Cashier:'}</span>
                      <span>{receiptResult.cashierName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Mode:</span>
                      <span className="font-bold uppercase">{receiptResult.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Receipt Items list */}
                  <div className="space-y-2 border-b border-dashed border-slate-200 pb-3">
                    <div className="grid grid-cols-12 font-bold text-[10.5px]">
                      <span className="col-span-6">Item Description</span>
                      <span className="col-span-2 text-center">Qty</span>
                      <span className="col-span-4 text-right">Sum</span>
                    </div>
                    {receiptResult.items.map((item, i) => {
                      const finalItemPrice = (item.discountType === 'cash' 
                        ? Math.max(0, item.price - item.discount) 
                        : item.price * (1 - item.discount / 100)
                      ) * item.qty;
                      return (
                        <div key={i} className="grid grid-cols-12 text-[10.5px] gap-y-0.5">
                          <span className="col-span-6 line-clamp-1">{item.productName}</span>
                          <span className="col-span-2 text-center">{formatSaleItemQuantity(item)}</span>
                          <span className="col-span-4 text-right">
                            {currency}{Math.round(finalItemPrice).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Calculations */}
                  <div className="space-y-1.5 text-right font-bold text-xs">
                    {(() => {
                      const itemsSubtotal = receiptResult.items.reduce((sum, item) => {
                        const itemDiscPrice = item.discountType === 'cash'
                          ? Math.max(0, item.price - item.discount)
                          : item.price * (1 - item.discount / 100);
                        return sum + (itemDiscPrice * item.qty);
                      }, 0);

                      const orderDiscountAmt = receiptResult.discountType === 'cash'
                        ? receiptResult.discount
                        : itemsSubtotal * (receiptResult.discount / 100);

                      return (
                        <>
                          <div className="flex justify-between text-slate-600 font-normal">
                            <span>Subtotal</span>
                            <span>{currency}{Math.round(itemsSubtotal).toLocaleString()}</span>
                          </div>
                          {orderDiscountAmt > 0 && (
                            <div className="flex justify-between text-emerald-700 font-mono text-[10px] font-normal">
                              <span>Order Discount {receiptResult.discountType === 'percent' ? `(${receiptResult.discount}%)` : ''}</span>
                              <span>-{currency}{Math.round(orderDiscountAmt).toLocaleString()}</span>
                            </div>
                          )}
                          {receiptResult.vatStatus === 'vat' && (
                            <div className="flex justify-between text-slate-600 font-normal">
                              <span>TRA VAT Compliant ({Math.round(activeTenant.taxRate * 100)}%)</span>
                              <span>{currency}{Math.round(receiptResult.tax || 0).toLocaleString()}</span>
                            </div>
                          )}
                          {receiptResult.deliveryCost ? (
                            <div className="flex justify-between text-slate-600 font-normal">
                              <span>Delivery Fee</span>
                              <span>{currency}{Math.round(receiptResult.deliveryCost).toLocaleString()}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between text-base border-t border-slate-200 pt-2 text-slate-900 font-black">
                            <span>PAID TOTAL</span>
                            <span>{currency}{Math.round(receiptResult.total).toLocaleString()}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* TRA VFD fiscal signature block if VAT was charged */}
                  {receiptResult.vatStatus === 'vat' && receiptResult.vfdControlNo && (
                    <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-3 space-y-1 text-[9.5px] leading-relaxed text-slate-700 text-left">
                      <p className="font-bold text-[10px] text-emerald-800 uppercase tracking-widest text-center border-b border-dashed border-emerald-250 pb-1 mb-1.5 font-sans">
                        TRA VFD FISCAL RECEIPT
                      </p>
                      <div className="flex justify-between font-mono">
                        <span>VFD Serial No:</span>
                        <span className="font-bold text-slate-800">TZ-VFD-REG-847294B</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>TRA Control No:</span>
                        <span className="font-bold text-emerald-900">{receiptResult.vfdControlNo}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Receipt Verification PIN:</span>
                        <span className="font-black text-rose-850 shrink-0 select-all">{receiptResult.vfdSignature}</span>
                      </div>
                      <p className="text-[8px] text-emerald-700 text-center italic mt-1.5 font-sans font-semibold">
                        ✓ Registered with Tanzania Revenue Authority Gateway VFD Server.
                      </p>
                    </div>
                  )}

                  <div className="text-center font-normal text-[9.5px] text-slate-500 border-t border-dashed border-slate-200 pt-3 space-y-1">
                    <p className="font-sans font-medium">Thank you for shopping with us!</p>
                    <p className="text-[8px] text-slate-400 font-mono">Powered by: jasper.africa</p>
                  </div>
                </div>

                {/* WHATSAPP & PRINT & COMPLETE CHANNELS ROW */}
                <div className="space-y-4">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-3">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">
                      Send Digital Receipt via WhatsApp
                    </span>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">+</span>
                        <input
                          type="text"
                          placeholder="Phone with country code..."
                          value={recipientWhatsApp}
                          onChange={(e) => setRecipientWhatsApp(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-white border border-slate-250 rounded-xl text-xs pl-6 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 font-mono placeholder:font-sans placeholder:text-slate-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={sharePosReceiptPdfHandler}
                        className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm hover:shadow active:scale-95 text-center justify-center decoration-transparent"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span>Send PDF</span>
                      </button>
                    </div>
                    {receiptPdfStatus && (
                      <p className="text-[10px] font-bold text-emerald-700">{receiptPdfStatus}</p>
                    )}
                    <p className="text-[9.5px] text-slate-500 leading-relaxed">
                      On mobile: tap Send PDF → select WhatsApp → PDF attaches automatically.<br/>
                      On desktop: PDF downloads, then WhatsApp opens — attach manually.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={printPosReceiptPdfHandler}
                      className="w-full py-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs uppercase cursor-pointer flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-slate-550" />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      onClick={() => setIsCheckoutOpen(false)}
                      className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase cursor-pointer transition-colors"
                    >
                      Finish Sale
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Integrated Barcode Scanning Dialog desk */}
      <DashboardBarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onScanSuccess={handleScanSuccess}
      />
    </div>
    </div>
  );
}
