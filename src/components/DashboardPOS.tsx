import { useState, useEffect } from 'react';
import { Tenant, Product, Sale, SaleItem, SystemSettings } from '../types';
import {
  calculateWeightedAverageCost,
  deductBatchesForSale,
  getPosSellingPriceForCostingMethod,
  getProductCostingMethod,
} from '../utils/inventoryCosting';
import { formatProductQuantity } from '../utils/unitFormatter';
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
  RefreshCw,
  X,
  Scan,
  Sparkles,
  Printer,
  MessageSquare,
  Pill,
  Coins,
  ShieldAlert,
  Lock,
  Unlock,
  History,
  UserCheck,
  Calendar,
  Settings,
  ChevronDown
} from 'lucide-react';
import DashboardBarcodeScanner from './DashboardBarcodeScanner';
import { generateWhatsAppMessage, buildWhatsAppLink } from '../utils/whatsapp';
import CachedImage from './CachedImage';

// Web Audio API helper for offline-friendly beep sound
const playBeep = (frequency = 800, duration = 80) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = frequency;
    osc.type = 'sine';
    
    // Smooth envelope to prevent clicking noises
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (duration / 1000));
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (duration / 1000));
  } catch (e) {
    // silently fail
  }
};

const playErrorBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // silently fail
  }
};

const playWarningBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First short beep (medium frequency 400Hz, duration 120ms)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.setValueAtTime(400, ctx.currentTime);
    osc1.type = 'sine';
    
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);

    // Second short beep starting after a 60ms gap (at 0.18s)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(400, ctx.currentTime + 0.18);
    osc2.type = 'sine';
    
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.18);
    gain2.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.19);
    gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.30);
    
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.30);
  } catch (e) {
    // silently fail
  }
};

const playOutOfStockBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First beep: 400Hz, 150ms
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 400;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Second beep: 250Hz, 150ms, starting immediately after
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 250;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    gain2.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.16);
    gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.30);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.30);
  } catch (e) {
    // silently fail
  }
};

interface DashboardPOSProps {
  activeTenant: Tenant;
  products: Product[];
  onUpdateStocks: (updatedProducts: Product[]) => void;
  onAddSale: (sale: Sale) => void;
  userName: string;
  isOfflineMode: boolean;
  systemSettings?: SystemSettings;
  preloadedCart?: { items: SaleItem[], backdate?: string } | null;
  onClearPreloadedCart?: () => void;
}

const getProductImage = (prod: Product): string => {
  if (prod.image && (prod.image.startsWith('http') || prod.image.startsWith('data:'))) {
    return prod.image;
  }

  const name = prod.name.toLowerCase();
  const category = (prod.category || '').toLowerCase();

  // Medical / Pharmacy matching
  if (name.includes('amoxicillin') || name.includes('antibiotic')) {
    return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('paracetamol') || name.includes('panadol') || name.includes('analgesic') || name.includes('pain')) {
    return 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('metformin') || name.includes('diabetic') || name.includes('insulin')) {
    return 'https://images.unsplash.com/photo-1628771065518-0d82f1110530?auto=format&fit=crop&w=400&q=80';
  }
  if (category.includes('antibiotic') || category.includes('analgesic') || category.includes('pharma') || category.includes('medicine') || category.includes('health') || name.includes('pill') || name.includes('tablet')) {
    return 'https://images.unsplash.com/photo-1607619056574-7b8d304a2c06?auto=format&fit=crop&w=400&q=80';
  }

  // Grocery food items matching
  if (name.includes('sugar')) {
    return 'https://images.unsplash.com/photo-1581781894086-484b1d9bc490?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('flour') || name.includes('wheat') || name.includes('baking')) {
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('noodle') || name.includes('indomie') || name.includes('ramen')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('oil') || name.includes('cooking') || name.includes('vegetable')) {
    return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('milk') || name.includes('dairy') || name.includes('peak')) {
    return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('pasta') || name.includes('spaghetti')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('maize') || name.includes('pembe') || name.includes('jogoo') || name.includes('corn')) {
    return 'https://images.unsplash.com/photo-1551754626-7ed702cc07db?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('tea') || name.includes('ketepa') || name.includes('beverage')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('soap') || name.includes('menengai') || name.includes('cleanser') || name.includes('shampoo')) {
    return 'https://images.unsplash.com/photo-1607006342411-92df36c53697?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('water') || name.includes('voltic') || name.includes('moja')) {
    return 'https://images.unsplash.com/photo-1550096141-7263640ab4ba?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('rice') || name.includes('gino')) {
    return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('sardine') || name.includes('canned') || name.includes('enapa') || name.includes('fish')) {
    return 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=400&q=80';
  }
  if (name.includes('milo') || name.includes('chocolate') || name.includes('cocoa')) {
    return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80';
  }

  // Categories fallback
  if (category.includes('beverage') || category.includes('drink')) {
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80';
  }
  if (category.includes('grain') || category.includes('cereal')) {
    return 'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?auto=format&fit=crop&w=400&q=80';
  }
  if (category.includes('grocery') || category.includes('food')) {
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
  }
  if (category.includes('household') || category.includes('clean') || category.includes('hygiene')) {
    return 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=400&q=80';
  }
  if (category.includes('canned') || category.includes('can')) {
    return 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=400&q=80';
  }

  // Fallback to neat default retail store shelf image
  return 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Array<{ 
    product: Product; 
    qty: number; 
    discount: number; 
    discountType: 'percent' | 'cash';
    dosageType?: 'full' | 'half' | 'tabs';
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

  // Effect to absorb preloaded cart items (such as Quotation or Proforma conversion)
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
  const [autoInsertOnScan, setAutoInsertOnScan] = useState(true);
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
        playWarningBeep();
        addScanToast('warning', `📦 Out of stock — ${matchedProduct.name} has no available stock`);
      } else {
        if (autoInsertOnScan) {
          playBeep(800, 80);
          addToCart(matchedProduct);
          addScanToast('success', `Scanned & direct added "${matchedProduct.name}" to till basket!`);
        } else {
          playBeep(800, 80);
          setSearchTerm(scannedCode);
          addScanToast('success', `Scanned match found: ${matchedProduct.name}`);
        }
      }
    } else {
      playErrorBeep();
      addScanToast('error', `⚠️ Product not found — this item is not in the system`);
    }

    setIsScannerOpen(false);
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
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'verify' | 'completed'>('idle');
  const [referenceCode, setReferenceCode] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [receiptResult, setReceiptResult] = useState<Sale | null>(null);
  const [recipientWhatsApp, setRecipientWhatsApp] = useState('');

  // Dual-channel context (Retail vs. Wholesale)
  const [sellingChannel, setSellingChannel] = useState<'retail' | 'wholesale'>('retail');
  const [posWarning, setPosWarning] = useState<string | null>(null);

  // Live security, pin validation and manager overrides
  const [supervisorPin, setSupervisorPin] = useState('');
  const [supervisorError, setSupervisorError] = useState<string | null>(null);
  const [isWholesaleBypassed, setIsWholesaleBypassed] = useState(false);
  const [isDiscountBypassed, setIsDiscountBypassed] = useState(false);
  const [isVoidBypassed, setIsVoidBypassed] = useState(false);

  // Persistent-like dynamic logs tracker for reports
  const [approvals, setApprovals] = useState<Array<{
    id: string;
    timestamp: string;
    type: 'wholesale_qty' | 'discount' | 'void';
    description: string;
    status: 'PENDING' | 'BYPASSED' | 'CANCELLED';
  }>>([
    {
      id: 'app-101',
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString().replace('T', ' ').substring(0, 16),
      type: 'wholesale_qty',
      description: 'Metformin 850mg - Qty 8 (Wholesale Min: 15) for Kunle Adebayo',
      status: 'BYPASSED'
    },
    {
      id: 'app-102',
      timestamp: new Date(Date.now() - 3600000 * 12).toISOString().replace('T', ' ').substring(0, 16),
      type: 'discount',
      description: 'Grace Eze - 15% custom item discount authorized by manager pin.',
      status: 'BYPASSED'
    }
  ]);

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
  
  // Custom categories list loaded dynamic from branch store settings
  const configuredCategories = systemSettings?.productStore?.categories && systemSettings.productStore.categories.length > 0
    ? systemSettings.productStore.categories
    : Array.from(new Set(products.map(p => p.category)));
  const categories = ['All', ...configuredCategories];

  // Filtering products for current tenant active list
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (prod: Product) => {
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
    const initialDosage = isPharmacy ? 'full' : undefined;
    const initialTabs = isPharmacy && prod.tabsPerPack ? Math.max(1, Math.round(prod.tabsPerPack / 2)) : undefined;

    setCart(prev => {
      const existing = prev.find(i => i.product.id === prod.id);
      if (existing) {
        // limit by stock with weight checks
        const activeType = existing.dosageType || 'full';
        const boxWeight = activeType === 'full' 
          ? 1 
          : activeType === 'half' 
            ? 0.5 
            : (existing.tabsSelected || 1) / (existing.product.tabsPerPack || 30);
        
        const nextQty = existing.qty + 1;
        if (nextQty * boxWeight > shopQty) {
          setPosWarning(`Stock Limit: Cannot add more than ${formatProductQuantity(shopQty, prod)} of "${prod.name}" to the register basket!`);
          return prev;
        }
        return prev.map(i => i.product.id === prod.id ? { ...i, qty: nextQty } : i);
      }
      return [...prev, { 
        product: prod, 
        qty: prod.isBulkProduct && (prod.sellingMode === 'scale' || prod.sellingMode === 'hybrid') ? (prod.sellUnitQty || 1) : 1, 
        discount: 0, 
        discountType: 'percent',
        dosageType: initialDosage,
        tabsSelected: initialTabs,
        bulkSellMode: prod.isBulkProduct ? (prod.sellingMode === 'hybrid' ? 'scale' : prod.sellingMode) : undefined
      }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.product.id === id) {
          const nextQty = i.qty + delta;
          if (nextQty <= 0) return null;
          
          const shopQty = i.product.shopStockQty ?? 0;
          const activeType = i.dosageType || 'full';
          const boxWeight = activeType === 'full' 
            ? 1 
            : activeType === 'half' 
              ? 0.5 
              : (i.tabsSelected || 1) / (i.product.tabsPerPack || 30);

          if (nextQty * boxWeight > shopQty) {
            setPosWarning(`Stock Limit: Cannot exceed active shop stock of ${formatProductQuantity(shopQty, i.product)} for "${i.product.name}"!`);
            return i;
          }
          return { ...i, qty: nextQty };
        }
        return i;
      }).filter(Boolean) as any;
    });
  };

  const updateCartQtyDirect = (id: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => {
      return prev.map(i => {
        if (i.product.id === id) {
          const shopQty = i.product.shopStockQty ?? 0;
          const activeType = i.dosageType || 'full';
          const boxWeight = activeType === 'full' 
            ? 1 
            : activeType === 'half' 
              ? 0.5 
              : (i.tabsSelected || 1) / (i.product.tabsPerPack || 30);

          if (newQty * boxWeight > shopQty) {
            const maxQty = Math.max(1, Math.floor(shopQty / boxWeight));
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

  const updateCartDosage = (productId: string, dosageType: 'full' | 'half' | 'tabs', customTabs?: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const tPerPack = item.product.tabsPerPack || 30;
          const defaultTabs = customTabs !== undefined 
            ? customTabs 
            : dosageType === 'half' 
              ? Math.max(1, Math.round(tPerPack / 2)) 
              : 1;

          // Recalculate if qty is still valid for stock when weight changes
          const shopQty = item.product.shopStockQty ?? 0;
          const boxWeight = dosageType === 'full' 
            ? 1 
            : dosageType === 'half' 
              ? 0.5 
              : defaultTabs / tPerPack;

          let newQty = item.qty;
          if (newQty * boxWeight > shopQty) {
            newQty = Math.max(1, Math.floor(shopQty / boxWeight));
          }

          return { 
            ...item, 
            dosageType, 
            tabsSelected: dosageType === 'tabs' ? defaultTabs : undefined,
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
          const tPerPack = item.product.tabsPerPack || 30;
          const sanitizedTabs = Math.max(1, Math.min(tPerPack, tabsCount));
          
          const shopQty = item.product.shopStockQty ?? 0;
          const boxWeight = sanitizedTabs / tPerPack;
          
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

  const getBatchAwareChannelPrice = (product: Product) => {
    const fallbackPrice = sellingChannel === 'wholesale'
      ? (product.wholesalePrice ?? product.sellingPrice)
      : product.sellingPrice;

    return getPosSellingPriceForCostingMethod(product, fallbackPrice);
  };

  const getCartUnitPrice = (item: {
    product: Product;
    bulkSellMode?: 'scale' | 'pcs';
    dosageType?: 'full' | 'half' | 'tabs';
    tabsSelected?: number;
  }) => {
    const isPharmacy = activeTenant.businessType === 'pharmacy';
    const channelBasePrice = getBatchAwareChannelPrice(item.product);
    let unitPrice = channelBasePrice;

    if (item.product.isBulkProduct) {
      const bMode = item.bulkSellMode || (item.product.sellingMode === 'hybrid' ? 'scale' : item.product.sellingMode);
      if (bMode === 'scale') {
        unitPrice = (item.product.sellUnitPrice || channelBasePrice) / (item.product.sellUnitQty || 1);
      } else if (bMode === 'pcs') {
        unitPrice = item.product.sellUnitPrice || channelBasePrice;
      }
    }

    if (isPharmacy) {
      const dType = item.dosageType || 'full';
      if (dType === 'half') {
        unitPrice = channelBasePrice / 2;
      } else if (dType === 'tabs') {
        const tPerPack = item.product.tabsPerPack || 30;
        const tSelected = item.tabsSelected || 1;
        unitPrice = (channelBasePrice / tPerPack) * tSelected;
      }
    }

    return unitPrice;
  };

  // Pricing calculations
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const unitPrice = getCartUnitPrice(item);

      const itemType = item.discountType || 'percent';
      const discountedPrice = itemType === 'cash'
        ? Math.max(0, unitPrice - item.discount)
        : unitPrice * (1 - item.discount / 100);
      return sum + (discountedPrice * item.qty);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const orderDiscountAmt = orderDiscountType === 'cash'
    ? Math.max(0, Math.min(subtotal, orderDiscount))
    : subtotal * (Math.max(0, Math.min(100, orderDiscount)) / 100);
  const taxableSubtotal = Math.max(0, subtotal - orderDiscountAmt);
  const tax = vatStatus === 'vat' ? taxableSubtotal * activeTenant.taxRate : 0;
  const grandTotal = taxableSubtotal + tax + deliveryCost;

  // Checkout Execution
  const triggerCheckout = () => {
    if (cart.length === 0) return;

    // Check if there are active, un-bypassed security exceptions
    const hasPendingWholesale = sellingChannel === 'wholesale' && 
      cart.some(item => item.qty < (item.product.minWholesaleQty || 1)) && 
      !isWholesaleBypassed;
    
    const hasPendingDiscount = (cart.some(item => item.discount > 0) || orderDiscount > 0) && 
      !isDiscountBypassed;

    const hasPendingVoid = approvals.some(app => app.type === 'void' && app.status === 'PENDING') && 
      !isVoidBypassed;

    if (hasPendingWholesale || hasPendingDiscount || hasPendingVoid) {
      setPosWarning("CHECKOUT LOCKED: You have pending manager review overrides. Please enter the Supervisor pin code in the Security Station at the bottom right before checking out.");
      return;
    }

    setPaymentStatus('idle');
    setPaymentMethod('Cash');
    const availableDeliveryModes = systemSettings?.business?.deliveryPaymentModes && systemSettings.business.deliveryPaymentModes.length > 0 
      ? systemSettings.business.deliveryPaymentModes 
      : (systemSettings?.business?.paymentModes || ['Cash']);
    setDeliveryPaymentMethod(availableDeliveryModes[0]);
    setMultiCashAmount(Math.round(grandTotal / 2));
    setMultiBankAmount(grandTotal - Math.round(grandTotal / 2));
    setReferenceCode('');
    setPinCode('');
    setIsCheckoutOpen(true);
  };

  const submitPayment = () => {
    setPaymentStatus('processing');
    
    // Simulate real localized channel validation delay
    setTimeout(() => {
      const isCash = paymentMethod.toLowerCase().includes('cash');
      const isBank = paymentMethod.toLowerCase().includes('bank') || paymentMethod.toLowerCase().includes('card') || paymentMethod === 'Multi-Channel';
      if (isCash || isBank) {
        finalizeSale();
      } else {
        // Mobile Money triggers PIN/Ref matching prompt!
        setPaymentStatus('verify');
        // generate realistic transactional auth codes
        const dict = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ2';
        let code = 'MPESA-';
        for (let i = 0; i < 8; i++) {
          code += dict.charAt(Math.floor(Math.random() * dict.length));
        }
        setReferenceCode(code);
      }
    }, 1500);
  };

  const verifyMoMoPIN = () => {
    setPaymentStatus('processing');
    setTimeout(() => {
      finalizeSale();
    }, 1000);
  };

  const finalizeSale = () => {
    const pendingBatchUpdates: Record<string, import('../types').ProductBatch[]> = {};

    // Generate sale item models
    const saleItems: SaleItem[] = cart.map(i => {
      const isPharmacy = activeTenant.businessType === 'pharmacy';
      const dType = i.dosageType || 'full';
      
      const channelBasePrice = getBatchAwareChannelPrice(i.product);

      const isBulk = i.product.isBulkProduct;
      const bMode = i.bulkSellMode || (isBulk ? (i.product.sellingMode === 'hybrid' ? 'scale' : i.product.sellingMode) : 'standard');

      let unitPrice = channelBasePrice;
      let ratioScaling = 1;

      if (isBulk) {
        if (bMode === 'scale') {
           unitPrice = (i.product.sellUnitPrice || 0) / (i.product.sellUnitQty || 1);
        } else if (bMode === 'pcs') {
           unitPrice = i.product.sellUnitPrice || 0;
           ratioScaling = (Number(i.product.bulkPurchaseQty) || 1) / (Number(i.product.sellUnitQty) || 1);
        }
      }

      if (isPharmacy) {
        if (dType === 'half') {
          unitPrice = channelBasePrice / 2;
          ratioScaling = 2;
        } else if (dType === 'tabs') {
          const tPerPack = i.product.tabsPerPack || 30;
          const tSelected = i.tabsSelected || 1;
          unitPrice = (channelBasePrice / tPerPack) * tSelected;
          ratioScaling = tPerPack / tSelected;
        }
      }

      // Process Batches deduction!
      let deductQtyReal = i.qty;
      if (bMode === 'pcs' && isBulk) {
          deductQtyReal = i.qty / Math.max(ratioScaling, 1);
      } else if (isPharmacy && dType !== 'full') {
          deductQtyReal = i.qty / ratioScaling;
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

      return {
        productId: i.product.id,
        productName: isPharmacy && dType !== 'full' 
          ? `${i.product.name} [${dType === 'half' ? '½ Box Dosage' : `${i.tabsSelected} Tabs Split`}]`
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
        sellUnit: i.product.sellUnit,
        sellMode: bMode as 'scale' | 'pcs',
        batchesUsed: batchesUsed.length > 0 ? batchesUsed : undefined,
        baseQuantityDeducted: Number(deductQtyReal.toFixed(3)),
        costingMethodUsed: sellMethod,
        costPriceAtSale: Number(blendedCost.toFixed(2))
      };
    });

    const isVat = vatStatus === 'vat';
    const vfdControlNo = isVat ? 'TZ-VFD-TRA-' + Math.floor(Math.random() * 9000000000 + 1000000000) : undefined;
    const vfdSignature = isVat ? 'TRA-VERIFY-' + Math.random().toString(36).substr(2, 6).toUpperCase() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase() : undefined;

    const newSale: Sale = {
      id: 'sl-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: saleItems,
      total: grandTotal,
      tax: tax,
      deliveryCost: deliveryCost,
      deliveryPaymentMethod: deliveryCost > 0 ? deliveryPaymentMethod : undefined,
      discount: orderDiscount,
      discountType: orderDiscountType,
      paymentMethod: paymentMethod as any,
      reference: referenceCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
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
      customerName: customerName ? customerName : 'Walk-In Customer',
      customerPhone: customerPhone ? customerPhone : undefined,
      staffName: userName,
      vatStatus: vatStatus,
      vfdControlNo,
      vfdSignature,
      multiCashAmount: paymentMethod === 'Multi-Channel' ? multiCashAmount : undefined,
      multiBankAmount: paymentMethod === 'Multi-Channel' ? multiBankAmount : undefined,
      channel: sellingChannel,
      approvals: approvals
    };

    // Deduct stock quantities directly from shop stock taking fractional dosages into account
    const updatedProducts = products.map(prod => {
      const soldItem = cart.find(i => i.product.id === prod.id);
      if (soldItem) {
        let deductQty = soldItem.qty;
        
        if (prod.isBulkProduct) {
          const bMode = soldItem.bulkSellMode || (prod.sellingMode === 'hybrid' ? 'scale' : prod.sellingMode);
          if (bMode === 'scale') {
            deductQty = soldItem.qty;
          } else if (bMode === 'pcs') {
            const ratio = (Number(prod.bulkPurchaseQty) || 1) / (Number(prod.sellUnitQty) || 1);
            deductQty = soldItem.qty / Math.max(ratio, 1);
          }
        } else if (activeTenant.businessType === 'pharmacy') {
          const dType = soldItem.dosageType || 'full';
          if (dType === 'half') {
            deductQty = soldItem.qty * 0.5;
          } else if (dType === 'tabs') {
            const tPerPack = soldItem.product.tabsPerPack || 30;
            const tSelected = soldItem.tabsSelected || 1;
            deductQty = soldItem.qty * (tSelected / tPerPack);
          }
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
    setIsWholesaleBypassed(false);
    setIsDiscountBypassed(false);
    setIsVoidBypassed(false);
    setSupervisorPin('');
    setSupervisorError(null);
  };

  // Handlers for security overrides & manager validations
  const handleRequestVoid = () => {
    // Add pending void override!
    const newPendingVoid = {
      id: 'app-void-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type: 'void' as const,
      description: `Void request for cash basket carrying ${cart.length} unique items (Subtotal ${currency}${Math.round(subtotal).toLocaleString()})`,
      status: 'PENDING' as const
    };
    
    setApprovals(prev => [newPendingVoid, ...prev]);
    setIsVoidBypassed(false);
    setPosWarning("CRITICAL: Basket Void cancellation requires Supervisor Pin validation!");
  };

  const handleEnterSupervisorPin = (pin: string) => {
    if (pin === '5544') {
      // Find pending ones and bypass them
      setApprovals(prev => prev.map(app => app.status === 'PENDING' ? { ...app, status: 'BYPASSED' } : app));
      
      // Clear bypass flags
      setIsWholesaleBypassed(true);
      setIsDiscountBypassed(true);
      
      // If there was a pending void, clear the Cart too!
      const hasPendingVoid = approvals.some(app => app.type === 'void' && app.status === 'PENDING');
      if (hasPendingVoid) {
        setCart([]);
        setIsVoidBypassed(true);
        setPosWarning("SUCCESS: Till basket void approved. Shop register reset.");
      } else {
        setPosWarning("SUCCESS: Supervisor overrides approved. Checkout authorized.");
      }
      
      setSupervisorPin('');
      setSupervisorError(null);
    } else {
      setSupervisorError("Invalid Code. Master Security override PIN required.");
    }
  };

  const handleSimulateSwipeApproval = () => {
    // Direct simulate button click for quick sandbox evaluation
    setApprovals(prev => prev.map(app => app.status === 'PENDING' ? { ...app, status: 'BYPASSED' } : app));
    setIsWholesaleBypassed(true);
    setIsDiscountBypassed(true);
    
    const hasPendingVoid = approvals.some(app => app.type === 'void' && app.status === 'PENDING');
    if (hasPendingVoid) {
      setCart([]);
      setIsVoidBypassed(true);
      setPosWarning("DEMO OVERRIDE: Till basket void approved dynamically.");
    } else {
      setPosWarning("DEMO OVERRIDE: Supervisor swipe bypass completed.");
    }
    setSupervisorPin('');
    setSupervisorError(null);
  };

  const handleRejectPendingOverrides = () => {
    setApprovals(prev => prev.map(app => app.status === 'PENDING' ? { ...app, status: 'CANCELLED' } : app));
    setIsWholesaleBypassed(false);
    setIsDiscountBypassed(false);
    setIsVoidBypassed(false);
    setSupervisorPin('');
    setSupervisorError(null);
    setPosWarning("MANAGER ACTION: Pending overrides rejected.");
  };

  // Automated effect to detect violations when cart/rules mutate
  useEffect(() => {
    if (cart.length === 0) return;

    // 1. Verify wholesale minimum bounds
    if (sellingChannel === 'wholesale') {
      const failedItems = cart.filter(item => {
        const minQty = item.product.minWholesaleQty || 1;
        return item.qty < minQty;
      });
      
      if (failedItems.length > 0 && !isWholesaleBypassed) {
        const alreadyExists = approvals.some(app => app.type === 'wholesale_qty' && app.status === 'PENDING');
        if (!alreadyExists) {
          const itemNames = failedItems.map(i => `${i.product.name} (Qty ${i.qty}/${i.product.minWholesaleQty || 1})`).join(', ');
          const newExc = {
            id: 'app-w-' + Math.floor(Math.random() * 1000),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            type: 'wholesale_qty' as const,
            description: `Wholesale exception: ${itemNames}`,
            status: 'PENDING' as const
          };
          setApprovals(prev => {
            const filtered = prev.filter(app => !(app.type === 'wholesale_qty' && app.status === 'PENDING'));
            return [newExc, ...filtered];
          });
        }
      } else if (failedItems.length === 0 && isWholesaleBypassed) {
        setIsWholesaleBypassed(false);
      }
    }

    // 2. Verify line item or grand total custom discounts
    const lineDiscountItems = cart.filter(item => item.discount > 0);
    const hasDiscount = lineDiscountItems.length > 0 || orderDiscount > 0;
    
    if (hasDiscount && !isDiscountBypassed) {
      const alreadyExists = approvals.some(app => app.type === 'discount' && app.status === 'PENDING');
      if (!alreadyExists) {
        const desc = lineDiscountItems.length > 0 
          ? `Discount exceptions: ${lineDiscountItems.map(i => `${i.product.name} (-${i.discount}${i.discountType === 'cash' ? currency : '%'})`).join(', ')}`
          : `Total order discount (-${orderDiscount}${orderDiscountType === 'cash' ? currency : '%'}) applied`;
        
        const newExc = {
          id: 'app-d-' + Math.floor(Math.random() * 1000),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'discount' as const,
          description: desc,
          status: 'PENDING' as const
        };
        setApprovals(prev => {
          const filtered = prev.filter(app => !(app.type === 'discount' && app.status === 'PENDING'));
          return [newExc, ...filtered];
        });
      }
    } else if (!hasDiscount && isDiscountBypassed) {
      setIsDiscountBypassed(false);
    }
  }, [cart, sellingChannel, orderDiscount, orderDiscountType, isWholesaleBypassed, isDiscountBypassed]);

  return (
    <div id="pos-view-container" className="relative pb-[160px] md:pb-0 pt-[56px] md:pt-0">
      
      {/* SCAN FEEDBACK INDEPENDENT TOAST STACK */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none">
        <AnimatePresence>
          {scanToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
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
                className="text-white hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer p-1 font-extrabold text-xs select-none"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Top Header (mobile only) */}
      <div className="md:hidden fixed top-0 left-0 w-full h-[56px] bg-white border-b border-slate-100 flex items-center justify-between px-4 z-50 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">POS</h1>
        <div className="flex items-center space-x-3">
          <button className="text-slate-500 hover:text-emerald-600 transition-colors" title="History/Receipts">
            <History className="w-5 h-5" />
          </button>
          <button className="text-slate-500 hover:text-emerald-600 transition-colors" title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div id="pos-view" className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        
        {/* Product selection grid (8/12 scope) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4 md:space-y-6">
          {/* Search and Categories controls */}
          <div className="bg-white px-3 py-3 md:border border-slate-200 md:p-6 rounded-none md:rounded-3xl space-y-4 shadow-none md:shadow-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/70 border border-slate-200 rounded-2xl p-1.5 relative md:mx-0">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Code, Barcode or Title..."
                  className="w-full bg-transparent text-sm pl-10 pr-24 py-2.5 text-slate-800 placeholder-slate-400 font-sans font-medium outline-none border-none focus:ring-0"
                />
                <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                
                {/* SCAN BARCODE ICON BUTTON IN THE RIGHT OF SEARCH BAR */}
                <button 
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="absolute right-2 top-1.5 p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-600 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1 select-none"
                  title="Scan Barcode / QR EAN code with reader"
                >
                  <Scan className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="hidden md:inline text-[9px] font-bold font-mono text-slate-500 tracking-wider">SCAN CODE</span>
                </button>
              </div>

              {/* Direct insert checkbox control */}
              <div className="hidden md:flex items-center space-x-2 px-3 border-t sm:border-t-0 sm:border-l border-slate-250 pt-2 sm:pt-0 shrink-0">
                <input 
                  type="checkbox"
                  id="auto-insert-toggle"
                  checked={autoInsertOnScan}
                  onChange={(e) => setAutoInsertOnScan(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="auto-insert-toggle" className="text-[10px] font-bold text-slate-500 cursor-pointer uppercase select-none">
                  Auto-Add on Scan
                </label>
              </div>
            </div>

          {/* Selling Channel Selector and Warnings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-fit">
              <button
                type="button"
                onClick={() => {
                  setSellingChannel('retail');
                  setPosWarning('Selling channel switched to RETAIL. Standard checkout prices applied.');
                }}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  sellingChannel === 'retail'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-650 hover:text-slate-800'
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
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  sellingChannel === 'wholesale'
                    ? 'bg-teal-650 text-white shadow-sm'
                    : 'text-slate-650 hover:text-slate-800'
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
            <div className="bg-amber-55 border border-amber-200 rounded-2xl py-3 px-4 flex items-center justify-between text-[11.5px] text-amber-900 animate-fade-in font-medium shadow-xs">
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
          <div className="hidden md:flex flex-wrap items-center gap-2 pt-0.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all uppercase cursor-pointer ${
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
          <div className="md:hidden px-2 pt-0.5">
            <div className="relative">
              <select
                value={selectedCategory || 'All'}
                onChange={(e) => setSelectedCategory(e.target.value === 'All' ? null : e.target.value)}
                className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
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

        {/* Product listing grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 px-2 md:px-0">
          {filteredProducts.length === 0 ? (
            <div className="sm:col-span-3 text-center py-16 text-sm font-mono text-slate-500 bg-white border border-slate-200 rounded-3xl shadow-sm">
              No matching {activeTenant.businessType === 'pharmacy' ? 'pharmaceutical products' : 'retail items'} in stock.
            </div>
          ) : (
            filteredProducts.map(prod => {
              const shopQty = prod.shopStockQty ?? 0;
              const isLow = shopQty <= prod.alertQty;
              const isOut = shopQty <= 0;
              return (
                <div 
                  key={prod.id}
                  onClick={() => {
                    if (!isOut) {
                      playBeep(800, 80);
                      addToCart(prod);
                    } else {
                      playOutOfStockBeep();
                    }
                  }}
                  className={`bg-white border md:rounded-3xl rounded-xl p-0 md:p-5 flex flex-col justify-between transition-all select-none relative shadow-xs active:scale-95 group overflow-hidden md:overflow-visible ${
                    isOut 
                      ? 'border-slate-200 opacity-55 cursor-not-allowed bg-slate-50' 
                      : 'border-slate-200 hover:border-slate-350 hover:shadow-md cursor-pointer md:hover:-translate-y-0.5'
                  }`}
                >
                  {/* Proportional Product Image Container (cached) */}
                  <div className="w-full h-[120px] md:h-36 bg-slate-50 border-b md:border border-slate-100 rounded-t-xl md:rounded-2xl overflow-hidden flex items-center justify-center relative shrink-0">
                    <CachedImage 
                      src={getProductImage(prod)} 
                      alt={prod.name} 
                      className={`w-full h-full transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none ${
                        prod.image && prod.image.startsWith('data:') ? 'object-contain p-2.5' : 'object-cover'
                      }`}
                      referrerPolicy="no-referrer"
                    />
                    {isLow && !isOut && (
                      <span className="absolute top-1.5 left-1.5 md:top-2.5 md:left-2.5 bg-amber-500 text-white px-1.5 md:px-2 py-0.5 rounded-lg text-[8px] md:text-[8px] font-black tracking-wider uppercase font-mono shadow-xs">
                        LOW ({shopQty})
                      </span>
                    )}
                    {isOut && (
                      <span className="absolute top-1.5 left-1.5 md:top-2.5 md:left-2.5 bg-red-600 text-white px-1.5 md:px-2 py-0.5 rounded-lg text-[8px] md:text-[8px] font-black tracking-wider uppercase font-mono shadow-xs animate-pulse">
                        OUT
                      </span>
                    )}
                  </div>

                  {/* Text details and bottom panel wrapper */}
                  <div className="flex-grow flex flex-col justify-between min-w-0 mt-2 px-3 pb-3 md:px-0 md:pb-0">
                    {/* Product Metadata & Text layout */}
                    <div className="space-y-1">
                      <div className="hidden md:flex items-center justify-between">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-xs leading-none">
                          {prod.category}
                        </span>
                        <span className="text-[9px] font-mono text-slate-450 font-bold bg-slate-100 px-1.5 py-0.5 rounded-xs leading-none">
                          {formatProductQuantity(shopQty, prod)} left
                        </span>
                      </div>
                      <h5 className="font-extrabold text-xs text-slate-800 line-clamp-2 leading-snug md:min-h-[2.25rem] pt-0.5 select-all" title={prod.name}>
                        {prod.name}
                      </h5>
                      <p className="hidden md:block text-[9.5px] text-slate-400 font-mono font-medium truncate">SKU: {prod.sku || prod.barcode || 'N/A'}</p>
                    </div>

                    {/* Pricing and Select CTA trigger */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2 shrink-0">
                      <div className="space-y-0.5">
                        <p className="hidden md:block border-none bg-transparent text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">Price</p>
                        <span className="text-sm md:text-[14px] font-black text-emerald-700 md:text-slate-900 leading-none">{currency}{Math.round(getBatchAwareChannelPrice(prod)).toLocaleString()}</span>
                        {prod.batches && prod.batches.some(batch => batch.status === 'active') && (
                          <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {getProductCostingMethod(prod).replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {!isOut ? (
                        <div className="text-right">
                          <span className="bg-emerald-600 hover:bg-emerald-700 group-hover:bg-emerald-700 text-white text-[9px] md:text-[9.5px] font-black px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg md:rounded-xl uppercase tracking-wider transition-all shadow-xs inline-flex items-center space-x-1">
                            <span>+ Add</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                          Out
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Cart Summary right panel (4/12 scope) */}
      <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-3xl lg:max-h-[calc(100vh-130px)] max-h-none sticky top-24 flex flex-col justify-between overflow-y-auto lg:overflow-hidden shadow-sm animate-fade-in">
        {/* Cart Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-4 h-4 text-emerald-650" />
            <span className="font-bold text-slate-800 text-sm">Shopping Till Basket</span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            <span className="text-xs font-mono font-bold bg-white border border-slate-200 px-3 py-1 rounded-lg text-slate-700 shadow-xs">
              {cart.reduce((sum, i) => sum + i.qty, 0)} items
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
          <div className="bg-slate-100 border-b border-slate-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in animate-duration-200">
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
            cart.map(item => {
              const isPharmacy = activeTenant.businessType === 'pharmacy';
              const dosageType = item.dosageType || 'full';
              const tabsPerPack = item.product.tabsPerPack || 30;
              const tabsSelected = item.tabsSelected || 15;

              let basePrice = getCartUnitPrice(item);

              let dosageLabel = 'Full Dose';

              if (isPharmacy) {
                if (dosageType === 'half') {
                  dosageLabel = 'Half Dose Split';
                } else if (dosageType === 'tabs') {
                  const tPerPack = item.product.tabsPerPack || 30;
                  dosageLabel = `${tabsSelected} Tabs off Pack [${tPerPack}]`;
                }
              }

              const isCash = item.discountType === 'cash';
              const discountPrice = isCash
                ? Math.max(0, basePrice - item.discount)
                : basePrice * (1 - item.discount / 100);

              return (
                <div key={item.product.id} className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1.5 relative group animate-fade-in text-left">
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
                      {isPharmacy && dosageType !== 'full' && (
                        <div className="text-[10px] text-indigo-750 font-bold bg-indigo-50/70 py-0.5 px-1.5 mt-0.5 rounded truncate w-max">
                          {dosageLabel}
                        </div>
                      )}
                    </div>

                    {/* Right: Quantity increment/decrement box + delete button */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {item.product.isBulkProduct ? (
                        <div className="flex flex-col items-end space-y-1">
                          {(item.product.sellingMode === 'hybrid') && (
                            <div className="flex bg-slate-100 rounded p-0.5 border border-slate-200 text-[9px] font-bold">
                              <button type="button" onClick={() => updateCartBulkMode(item.product.id, 'scale')} className={`px-1.5 py-0.5 rounded ${item.bulkSellMode !== 'pcs' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Scale</button>
                              <button type="button" onClick={() => updateCartBulkMode(item.product.id, 'pcs')} className={`px-1.5 py-0.5 rounded ${item.bulkSellMode === 'pcs' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Pcs</button>
                            </div>
                          )}
                          {((item.bulkSellMode || (item.product.sellingMode === 'hybrid' ? 'scale' : item.product.sellingMode)) === 'scale') ? (
                            <div className="flex space-x-1">
                              {[{ label: '1/4', val: 0.25 }, { label: '1/2', val: 0.5 }, { label: '3/4', val: 0.75 }, { label: '1', val: 1 }].map(f => (
                                <button type="button" key={f.label} onClick={() => updateCartQtyDirect(item.product.id, f.val)} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-700 hover:bg-slate-50">{f.label}</button>
                              ))}
                              <input type="number" step="0.01" value={item.qty} onChange={(e) => updateCartQtyDirect(item.product.id, Number(e.target.value))} className="w-12 text-center font-black font-mono text-slate-800 bg-white border border-slate-200 rounded py-0.5 text-[10px] focus:outline-emerald-500" />
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
                              const val = parseInt(e.target.value) || 1;
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
                        <span className="font-mono font-black text-slate-800 text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-150">
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
                          onChange={(e) => updateCartDosage(item.product.id, e.target.value as 'full' | 'half' | 'tabs')}
                          className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[9.5px] font-bold text-slate-600 focus:outline-none cursor-pointer"
                        >
                          <option value="full">Full Dose</option>
                          <option value="half">Half Dose</option>
                          <option value="tabs">By Tabs</option>
                        </select>
                        {dosageType === 'tabs' && (
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
                              className="w-6 text-center font-mono font-bold text-[9px] text-slate-805 bg-transparent outline-none focus:ring-0"
                            />
                            <span className="text-[8px] font-mono text-slate-400">/{tabsPerPack}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Totals and checkout */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 space-y-4">
          <div className="space-y-1.5 text-xs font-bold font-sans">
            <div className="flex justify-between text-slate-500">
              <span>Till Subtotal</span>
              <span className="font-mono">{currency}{Math.round(subtotal).toLocaleString()}</span>
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
                <span className="font-bold text-slate-600 font-sans">Compliance Choice:</span>
                <span className="text-[9.5px] text-slate-400 font-sans">Customer VAT status</span>
              </div>
              <select
                value={vatStatus}
                onChange={(e) => setVatStatus(e.target.value as 'vat' | 'non-vat')}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10.5px] font-extrabold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
              >
                <option value="non-vat">Non-VAT (0% Normal)</option>
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
              <span className="font-mono text-emerald-600 text-lg">{currency}{Math.round(grandTotal).toLocaleString()}</span>
            </div>
          </div>

          <button
            id="pos-checkout-btn"
            disabled={cart.length === 0}
            onClick={triggerCheckout}
            className="hidden md:flex w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer items-center justify-center space-x-2 shadow-lg shadow-emerald-500/15 active:scale-98"
          >
            <span>Proceed to Payment</span>
          </button>
        </div>
      </div>

      {/* Mobile Sticky Cart Summary */}
      <div className="md:hidden fixed bottom-[60px] left-0 w-full bg-white border-t border-slate-200 px-4 py-3 z-40 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-slate-700" />
                {cart.reduce((sum, item) => sum + item.qty, 0) > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full border border-white">
                    {cart.reduce((sum, item) => sum + item.qty, 0)}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Cart Total</span>
            </div>
            <span className="text-emerald-700 font-black font-mono text-base">{currency}{Math.round(grandTotal).toLocaleString()}</span>
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

      {/* 🔒 Jasper Live Security & Manager Override Station */}
      <div className="lg:col-span-5 xl:col-span-4 bg-slate-900 text-slate-100 rounded-3xl p-5 space-y-4 shadow-xl border border-slate-950/20 animate-fade-in self-start mt-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
              <Lock className="w-4 h-4 text-amber-500 animate-pulse" />
            </div>
            <div className="text-left">
              <h5 className="font-extrabold text-[11px] font-sans tracking-wide uppercase text-slate-100">Jasper Security Rails</h5>
              <p className="text-[9px] font-mono text-slate-400">Live Manager Override Station</p>
            </div>
          </div>
          <span className="text-[8.5px] font-mono font-black tracking-widest bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-md">
            ● SHIELD ACTIVE
          </span>
        </div>

        {/* Dynamic Exception Analysis Block */}
        {(() => {
          const pendingWholesale = sellingChannel === 'wholesale' && 
            cart.filter(item => item.qty < (item.product.minWholesaleQty || 1));
          
          const pendingDiscount = (cart.filter(item => item.discount > 0).length > 0 || orderDiscount > 0);
          
          const pendingVoid = approvals.some(app => app.type === 'void' && app.status === 'PENDING');

          const hasExceptions = (pendingWholesale && pendingWholesale.length > 0 && !isWholesaleBypassed) || 
                                (pendingDiscount && !isDiscountBypassed) || 
                                (pendingVoid && !isVoidBypassed);

          return (
            <div className="space-y-3.5">
              {/* Active Security Threat Status Indicator */}
              {hasExceptions ? (
                <div className="bg-red-950/40 border border-red-900/45 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-start space-x-2 text-left">
                    <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-black uppercase text-rose-400 tracking-wider">🔒 Exception Blockade Alert</p>
                      <p className="text-[9.5px] text-slate-450 leading-snug font-sans">Till basket checkout suspended until supervisor pin authorization is completed.</p>
                    </div>
                  </div>

                  {/* Bullet out conflict lists details */}
                  <div className="space-y-1.5 border-t border-slate-850 pt-2 text-[10px] font-mono text-slate-300 bg-black/20 p-2 rounded-xl text-left leading-relaxed">
                    {pendingWholesale && pendingWholesale.length > 0 && !isWholesaleBypassed && (
                      <div className="flex items-start space-x-1.5">
                        <span className="text-amber-500">•</span>
                        <span>
                          Wholesale minimum is violated: {pendingWholesale.map(i => `${i.product.name} (Qty ${i.qty}/${i.product.minWholesaleQty || 1})`).join(', ')}
                        </span>
                      </div>
                    )}
                    {pendingDiscount && !isDiscountBypassed && (
                      <div className="flex items-start space-x-1.5">
                        <span className="text-amber-500">•</span>
                        <span>
                          Discount exceptions: Custom cashier discounts applied without authorization.
                        </span>
                      </div>
                    )}
                    {pendingVoid && !isVoidBypassed && (
                      <div className="flex items-start space-x-1.5">
                        <span className="text-rose-500">•</span>
                        <span>
                          Till void requested: basket wipe carries security exception logs.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* PIN Input & Simulator Blocks */}
                  <div className="space-y-2 border-t border-slate-850 pt-2.5 text-left">
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Enter Supervisor Override Code (PIN: 5544)</label>
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        placeholder="PIN"
                        maxLength={4}
                        value={supervisorPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setSupervisorPin(val);
                          if (val.length === 4) {
                            handleEnterSupervisorPin(val);
                          }
                        }}
                        className="bg-slate-950/80 border border-slate-800 focus:border-amber-500 text-center font-black font-mono text-xs tracking-widest px-2.5 py-1.5 rounded-xl w-20 text-slate-100 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleEnterSupervisorPin(supervisorPin)}
                        className="bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded-xl px-2.5 outline-none cursor-pointer transition-all flex-grow font-sans active:scale-95"
                      >
                        Verify Override PIN
                      </button>
                    </div>

                    {supervisorError && (
                      <p className="text-[9.5px] font-mono text-rose-450 font-bold bg-rose-950/30 border border-rose-900 p-1.5 rounded-lg text-center">
                        {supervisorError}
                      </p>
                    )}

                    {/* Simulation Sandboxed Assist actions */}
                    <div className="flex gap-1 pt-1">
                      <button
                        type="button"
                        onClick={handleSimulateSwipeApproval}
                        className="bg-indigo-955/90 hover:bg-indigo-900 border border-indigo-900/40 text-indigo-405 text-[8.5px] font-extrabold py-1.5 rounded-lg cursor-pointer transition-colors flex-grow text-center"
                        title="Directly simulate biometric manager bypass swipe"
                      >
                        ⚡ Simulate Owner Overpass
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectPendingOverrides}
                        className="bg-slate-805 hover:bg-slate-700 text-slate-350 text-[8.5px] font-bold py-1.5 rounded-lg cursor-pointer transition-colors px-2 text-center"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-955/30 border border-emerald-900/30 rounded-2xl p-4 flex items-center space-x-2.5 text-left">
                  <Unlock className="w-5 h-5 text-emerald-450 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">🔒 Verified Compliance Mode</p>
                    <p className="text-[9.5px] text-slate-400 leading-relaxed font-sans font-medium">
                      All transaction lines fully match retail/wholesale guidelines. No blockades.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Live Logs Table Header */}
        <div className="space-y-2 text-left pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 tracking-tight uppercase block font-sans">Conflict Overrides Action Log</span>
            <span className="text-[8px] font-mono text-slate-500 font-extrabold uppercase">Audit Mode</span>
          </div>
          <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-850">
            {approvals.map(app => (
              <div key={app.id} className="p-2.5 bg-slate-950/40 border border-slate-800/45 rounded-xl space-y-0.5 flex flex-col hover:bg-slate-950/60 transition-colors">
                <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-500 font-bold">
                  <span>ID: {app.id.toUpperCase()} • {app.timestamp}</span>
                  <span className={`px-1.5 rounded font-black text-[7.5px] border shrink-0 ${
                    app.status === 'PENDING'
                      ? 'bg-amber-950 text-amber-500 border-amber-900 active:animate-ping'
                      : app.status === 'BYPASSED'
                        ? 'bg-emerald-950 text-emerald-450 border-emerald-900'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}>
                    {app.status}
                  </span>
                </div>
                <p className="text-[9px] text-slate-300 font-mono leading-normal font-medium break-words">{app.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CHECKOUT MODAL SYSTEM */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 md:slide-in-from-bottom-0">
          <div className="relative bg-white border border-slate-205 md:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col mt-auto md:mt-0 animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0">
            {/* Mobile Drag Handle */}
            <div className="w-full flex justify-center pt-3 pb-2 md:hidden bg-slate-50">
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
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                <div className="text-center py-2 space-y-1">
                  <p className="text-3xl font-black text-slate-950">{currency}{Math.round(grandTotal).toLocaleString()}</p>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">Awaiting layout selection and customer assignment</p>
                </div>

                {/* Customer Assignment (New feature) */}
                <div className="space-y-2 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Customer Identity (Required for Store Credit)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Client Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2 rounded-xl text-slate-800 outline-none transition-all"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number (Optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2 rounded-xl text-slate-800 outline-none transition-all font-mono"
                    />
                  </div>
                  
                  {/* Preset quick tap list */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[9px] text-slate-400 py-0.5">Quick Presets:</span>
                    {[
                      { name: 'Kunle Adebayo', phone: '+234 803 444 5555' },
                      { name: 'Grace Eze', phone: '+234 812 777 8888' },
                      { name: 'Mary Atieno', phone: '+254 722 000 111' },
                      { name: 'Emmanuel Osei', phone: '+233 244 111 222' }
                    ].map(preset => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setCustomerName(preset.name);
                          setCustomerPhone(preset.phone);
                        }}
                        className="text-[9px] bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-bold border border-slate-200 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                      >
                        {preset.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gateway channels selectors */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Select Active Payment Rail</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(() => {
                      const baseModes = systemSettings?.business?.paymentModes && systemSettings.business.paymentModes.length > 0
                        ? systemSettings.business.paymentModes
                        : ['Cash', 'Mobile Money', 'Bank'];
                      const enabledModes = [...baseModes, 'Multi-Channel'];
                      
                      return enabledModes.map(mode => {
                        const isSelected = paymentMethod === mode;
                        const isCash = mode.toLowerCase().includes('cash');
                        const isMomo = mode.toLowerCase().includes('pesa') || mode.toLowerCase().includes('momo') || mode.toLowerCase().includes('mobile') || mode.toLowerCase().includes('mtn') || mode.toLowerCase().includes('paystack');
                        const isMulti = mode === 'Multi-Channel';
                        
                        return (
                          <div key={mode} className="space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod(mode);
                                if (mode === 'Multi-Channel') {
                                  setMultiCashAmount(Math.round(grandTotal / 2));
                                  setMultiBankAmount(grandTotal - Math.round(grandTotal / 2));
                                }
                              }}
                              className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer text-left w-full ${
                                isSelected 
                                  ? 'bg-emerald-50 text-emerald-755 border-emerald-450' 
                                  : 'bg-slate-50 text-slate-650 border-slate-250 hover:border-slate-350'
                              }`}
                            >
                              <div className="flex items-center space-x-3 text-xs">
                                {isCash ? (
                                  <Receipt className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-405'}`} />
                                ) : isMomo ? (
                                  <Smartphone className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-405'}`} />
                                ) : isMulti ? (
                                  <Coins className={`w-4 h-4 ${isSelected ? 'text-indigo-600 animate-pulse' : 'text-slate-405'}`} />
                                ) : (
                                  <CreditCard className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-405'}`} />
                                )}
                                <div>
                                  <p className="font-bold text-slate-800">{mode}</p>
                                  <p className="text-[10px] text-slate-450 font-light mt-0.5">
                                    {isCash ? 'Collect paper currency, log to system till vault' : 
                                     isMomo ? 'Initiate push payment request or validation token' :
                                     isMulti ? 'Split invoice cost between Cash and Bank/Card channels' :
                                     'Initialize checkout terminal or log transfer confirmation'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold tracking-widest bg-slate-250 border border-slate-300 px-2 py-0.5 rounded font-mono uppercase text-slate-700">
                                {isCash ? 'CASH' : isMomo ? 'MOMO' : isMulti ? 'SPLIT' : 'BANK'}
                              </span>
                            </button>

                            {isMulti && isSelected && (
                              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3 animate-fade-in shadow-xs">
                                <p className="text-[10px] font-mono font-black text-indigo-700 uppercase tracking-wider">Multi-Channel Split Breakdown</p>
                                <div className="grid grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="block text-[9.5px] uppercase font-bold text-slate-450 mb-1">Cash In ({currency})</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={grandTotal}
                                      value={multiCashAmount}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const boundedVal = Math.min(grandTotal, val);
                                        setMultiCashAmount(boundedVal);
                                        setMultiBankAmount(grandTotal - boundedVal);
                                      }}
                                      className="w-full bg-slate-50 border border-slate-205 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono font-bold text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9.5px] uppercase font-bold text-slate-450 mb-1">Bank / Card ({currency})</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={grandTotal}
                                      value={multiBankAmount}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const boundedVal = Math.min(grandTotal, val);
                                        setMultiBankAmount(boundedVal);
                                        setMultiCashAmount(grandTotal - boundedVal);
                                      }}
                                      className="w-full bg-slate-50 border border-slate-205 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono font-bold text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="text-[10px] uppercase font-black text-emerald-800 text-center bg-emerald-50 py-1.5 rounded-xl border border-emerald-100 font-sans">
                                  Combined: {currency}{multiCashAmount.toLocaleString()} Cash + {currency}{multiBankAmount.toLocaleString()} Bank = {currency}{(multiCashAmount + multiBankAmount).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Delivery Payment Mode removed (moved to basket) */}

                {(() => {
                  const hasPendingWholesale = sellingChannel === 'wholesale' && 
                    cart.some(item => item.qty < (item.product.minWholesaleQty || 1)) && 
                    !isWholesaleBypassed;
                  
                  const hasPendingDiscount = (cart.some(item => item.discount > 0) || orderDiscount > 0) && 
                    !isDiscountBypassed;

                  const hasPendingVoid = approvals.some(app => app.type === 'void' && app.status === 'PENDING') && 
                    !isVoidBypassed;

                  const isBlocked = hasPendingWholesale || hasPendingDiscount || hasPendingVoid;

                  return (
                    <button
                      type="button"
                      disabled={isBlocked}
                      onClick={submitPayment}
                      className={`w-full py-4 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-98 shadow-md ${
                        isBlocked
                          ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed shadow-none'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10'
                      }`}
                    >
                      {isBlocked ? (
                        <span className="flex items-center justify-center space-x-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>🔒 Awaiting Manager Pin Authentication...</span>
                        </span>
                      ) : (
                        <span>Confirm & Initialize Payment</span>
                      )}
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Spinner processing state */}
            {paymentStatus === 'processing' && (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
                <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin" />
                <div className="space-y-1">
                  <h5 className="font-bold text-sm uppercase tracking-wider text-slate-800">Communicating with Payment Server</h5>
                  <p className="text-xs text-slate-450">Verifying customer account token & authenticating gateway rails...</p>
                </div>
              </div>
            )}

            {/* Verification code MoMo */}
            {paymentStatus === 'verify' && (
              <div className="p-6 space-y-5">
                <div className="p-4 bg-emerald-50 rounded-2xl text-xs text-emerald-800 border border-emerald-100 text-center leading-relaxed font-sans">
                  <p className="font-bold uppercase tracking-wider mb-1">Simulated push dispatched!</p>
                  <p className="font-medium text-[11px] text-slate-605">
                    A secure authentication popup has been sent. To mimic client USSD responses, check details or input cash pin.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Simulated USSD PIN Code</label>
                    <input
                      type="password"
                      placeholder="••••"
                      maxLength={4}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full text-center bg-slate-50 border border-slate-200 focus:border-emerald-500 mt-1 px-4 py-3 rounded-2xl font-mono text-xl text-emerald-600 font-black tracking-widest outline-none"
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transaction ID:</span>
                      <span className="text-slate-800 font-bold">{referenceCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-505">Target Value:</span>
                      <span className="text-slate-800 font-bold">{currency}{Math.round(grandTotal).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setPaymentStatus('idle')}
                    className="py-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer text-slate-600 font-bold font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={pinCode.length < 4}
                    onClick={verifyMoMoPIN}
                    className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer font-sans"
                  >
                    Confirm PIN
                  </button>
                </div>
              </div>
            )}

            {/* Completed state / Receipt print */}
            {paymentStatus === 'completed' && receiptResult && (
              <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto bg-slate-50">
                <div className="flex flex-col items-center text-center space-y-2 py-2">
                  <div className="p-2.5 bg-emerald-100 rounded-full border border-emerald-200 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-850 uppercase tracking-widest">TRANSACTION APPROVED</h4>
                  <p className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                    {isOfflineMode ? 'SAFE QUEUED TO LOCAL CACHE (OFFLINE)' : 'ONLINE STREAM SYNCED SUCCESSFULLY'}
                  </p>
                </div>

                {/* PHYSICAL RECEIPT GRAPHIC CONTAINER */}
                <div className="bg-white text-slate-905 p-5 rounded-3xl font-mono text-xs space-y-4 shadow-xl border-dashed border-2 border-slate-250">
                  <div className="text-center space-y-2 border-b border-dashed border-slate-200 pb-3 flex flex-col items-center">
                    {(systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || systemSettings?.business?.businessLogoDark || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant?.company_settings?.logo_url) && (
                      <CachedImage 
                        src={systemSettings?.company?.logo || systemSettings?.business?.businessLogoLight || systemSettings?.business?.businessLogo || systemSettings?.business?.businessLogoDark || localStorage.getItem(`jasper_tenant_logo_${activeTenant.id}`) || activeTenant?.company_settings?.logo_url || undefined} 
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
                          <span className="col-span-2 text-center">{item.qty}</span>
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
                    <p className="font-sans font-medium">{systemSettings?.business?.tagline || "Thank you for shopping at our outlet."}</p>
                    <p className="uppercase tracking-wider text-[8px] text-slate-400 font-mono">Cloud synchronized ledger node</p>
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
                          placeholder="Phone number (digits with country code e.g. 234803...)"
                          value={recipientWhatsApp}
                          onChange={(e) => setRecipientWhatsApp(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-white border border-slate-250 rounded-xl text-xs pl-6 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 font-mono placeholder:font-sans placeholder:text-slate-400"
                        />
                      </div>
                      <a
                        href={buildWhatsAppLink(generateWhatsAppMessage(receiptResult, activeTenant), recipientWhatsApp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm hover:shadow active:scale-95 text-center justify-center decoration-transparent"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span>Share Receipt</span>
                      </a>
                    </div>
                    <p className="text-[9.5px] text-slate-450 leading-relaxed">
                      Tip: Input country code (e.g. *254* or *234*) without "+" or spaces. Leave empty to select recipient on WhatsApp directly.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => window.print()}
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
