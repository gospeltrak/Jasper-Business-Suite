import { useState } from 'react';
import { Product, Supplier, Purchase, PurchaseItem, Tenant } from '../types';
import { addBatchToProduct, createInventoryBatch } from '../utils/inventoryCosting';
import { formatProductQuantity } from '../utils/unitFormatter';
import { 
  Truck, 
  Package, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  ClipboardList,
  Store,
  Archive,
  FileSpreadsheet,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Eye,
  Pencil,
  X,
  ChevronDown
} from 'lucide-react';

interface DashboardPurchasesProps {
  activeTenant: Tenant;
  products: Product[];
  suppliers: Supplier[];
  onUpdateStocks: (updatedProducts: Product[]) => void;
  purchases: Purchase[];
  onAddPurchase: (purchase: Purchase) => void;
}

export default function DashboardPurchases({
  activeTenant,
  products,
  suppliers,
  onUpdateStocks,
  purchases,
  onAddPurchase
}: DashboardPurchasesProps) {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'till'>('history');

  // Recording Till Form States
  const defaultSupplierId = 'sup-walk-in';
  const availableSuppliers = suppliers.length > 0 ? suppliers : [{
    id: defaultSupplierId,
    name: 'One-time Vendor',
    contactPerson: 'N/A',
    phone: '',
    email: '',
    categories: [],
    tenantId: activeTenant.id
  } as any];

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || defaultSupplierId);
  const [destination, setDestination] = useState<'shop' | 'store'>('store');
  const [deliveryStatus, setDeliveryStatus] = useState<'Pending' | 'Partial' | 'Full order delivered'>('Full order delivered');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<Array<{ product: Product; qty: number; costPrice: number }>>([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // Discount & Delivery Fee states
  const [purchaseDiscount, setPurchaseDiscount] = useState<number>(0);
  const [purchaseDiscountType, setPurchaseDiscountType] = useState<'percentage' | 'cash'>('percentage');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  const currency = activeTenant.currency;

  // History search, filter and sort states
  const [historySearch, setHistorySearch] = useState('');
  const [historyDestination, setHistoryDestination] = useState<'all' | 'shop' | 'store'>('all');
  const [historyDeliveryStatus, setHistoryDeliveryStatus] = useState<string>('all');
  const [historyPaymentStatus, setHistoryPaymentStatus] = useState<'all' | 'paid' | 'due'>('all');
  const [historySortBy, setHistorySortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'supplier-asc'>('date-desc');

  // Row action menu & modal state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null);

  const resetFilters = () => {
    setHistorySearch('');
    setHistoryDestination('all');
    setHistoryDeliveryStatus('all');
    setHistoryPaymentStatus('all');
    setHistorySortBy('date-desc');
  };

  // Filter and sort the purchases list
  const filteredAndSortedPurchases = purchases
    .filter(pc => {
      const searchLower = historySearch.toLowerCase();
      const matchesSearch = 
        pc.id.toLowerCase().includes(searchLower) ||
        pc.supplierName.toLowerCase().includes(searchLower) ||
        pc.items.some(item => item.productName.toLowerCase().includes(searchLower));
      const matchesDestination = historyDestination === 'all' || pc.destination === historyDestination;
      const matchesDelivery = historyDeliveryStatus === 'all' || pc.deliveryStatus === historyDeliveryStatus;
      const matchesPayment = 
        historyPaymentStatus === 'all' ||
        (historyPaymentStatus === 'paid' && pc.amountDue <= 0) ||
        (historyPaymentStatus === 'due' && pc.amountDue > 0);
      return matchesSearch && matchesDestination && matchesDelivery && matchesPayment;
    })
    .sort((a, b) => {
      if (historySortBy === 'date-desc') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (historySortBy === 'date-asc') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (historySortBy === 'amount-desc') return b.totalAmount - a.totalAmount;
      if (historySortBy === 'amount-asc') return a.totalAmount - b.totalAmount;
      if (historySortBy === 'supplier-asc') return a.supplierName.localeCompare(b.supplierName);
      return 0;
    });

  // Filtered products for till search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode.includes(searchTerm)
  );

  // Add Product to Cart
  const handleAddToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, qty: 1, costPrice: product.costPrice }]);
    }
  };

  const handleUpdateQty = (productId: string, val: number) => {
    if (val <= 0) {
      setCart(cart.filter(item => item.product.id !== productId));
    } else {
      setCart(cart.map(item => 
        item.product.id === productId ? { ...item, qty: val } : item
      ));
    }
  };

  const handleUpdateCostPrice = (productId: string, cost: number) => {
    setCart(cart.map(item => 
      item.product.id === productId ? { ...item, costPrice: Math.max(0, cost) } : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.costPrice * item.qty), 0);
  const discountAmount = purchaseDiscountType === 'percentage'
    ? (subtotal * purchaseDiscount) / 100
    : purchaseDiscount;
  const totalAmount = Math.max(0, subtotal - discountAmount) + deliveryFee;
  const amountDue = Math.max(0, totalAmount - amountPaid);

  const handleCommitPurchase = () => {
    if (cart.length === 0) return;
    if (!selectedSupplierId) {
      alert("Please select a valid supplier first!");
      return;
    }

    const supplier = availableSuppliers.find(s => s.id === selectedSupplierId) || availableSuppliers[0];

    const purchaseItems: PurchaseItem[] = cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      qty: item.qty,
      costPrice: item.costPrice
    }));

    const newPurchase: Purchase = {
      id: 'PC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: purchaseItems,
      totalAmount,
      amountPaid,
      amountDue,
      paymentMethod,
      destination,
      deliveryStatus,
      timestamp: new Date().toISOString(),
      tenantId: activeTenant.id,
      discount: purchaseDiscount,
      discountType: purchaseDiscountType,
      deliveryFee: deliveryFee
    };

    const updatedProductsList = products.map(prod => {
      const cartItem = cart.find(item => item.product.id === prod.id);
      if (cartItem) {
        const addedQty = cartItem.qty;
        let newShopQty = prod.shopStockQty;
        let newStoreQty = prod.storeStockQty;
        if (destination === 'shop') {
          newShopQty += addedQty;
        } else {
          newStoreQty += addedQty;
        }
        const batch = createInventoryBatch(prod, addedQty, cartItem.costPrice, {
          supplierName: supplier.name,
          finalSellingPrice: prod.sellingPrice,
          purchaseDate: newPurchase.timestamp,
        });
        const updatedWithBatch = addBatchToProduct(prod, batch, destination);
        return {
          ...updatedWithBatch,
          shopStockQty: Number(newShopQty.toFixed(3)),
          storeStockQty: Number(newStoreQty.toFixed(3)),
          stockQty: Number((newShopQty + newStoreQty).toFixed(3))
        };
      }
      return prod;
    });

    onUpdateStocks(updatedProductsList);
    onAddPurchase(newPurchase);

    setPurchaseSuccess(true);
    setTimeout(() => {
      setCart([]);
      setAmountPaid(0);
      setPurchaseDiscount(0);
      setPurchaseDiscountType('percentage');
      setDeliveryFee(0);
      setSearchTerm('');
      setPurchaseSuccess(false);
      setActiveSubTab('history');
    }, 1500);
  };

  // ── VIEW MODAL ──────────────────────────────────────────────────────────────
  const ViewModal = ({ pc }: { pc: Purchase }) => {
    const diff = pc.totalAmount - pc.amountPaid;
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewPurchase(null)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
          onClick={e => e.stopPropagation()}
          style={{ animation: 'slideUp 0.28s cubic-bezier(.32,1.2,.6,1) both' }}
        >
          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-800 text-base">{pc.id}</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{new Date(pc.timestamp).toLocaleString()}</p>
            </div>
            <button onClick={() => setViewPurchase(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          {/* Body */}
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono mb-1">Supplier</p>
                <p className="font-bold text-slate-800 text-sm">{pc.supplierName}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono mb-1">Destination</p>
                <p className="font-bold text-slate-800 text-sm capitalize">{pc.destination === 'shop' ? '🏪 Shop Shelf' : '📦 Store Room'}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono mb-1">Payment</p>
                <p className="font-bold text-slate-800 text-sm">{pc.paymentMethod}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono mb-1">Delivery</p>
                <p className="font-bold text-slate-800 text-sm">{pc.deliveryStatus}</p>
              </div>
            </div>
            {/* Items */}
            <div>
              <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono mb-2">Items Purchased</p>
              <div className="space-y-2">
                {pc.items.map((it, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 rounded-xl px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-[55%]">{it.productName}</span>
                    <div className="text-right">
                      <span className="font-black text-slate-800 font-mono">×{it.qty}</span>
                      <span className="text-slate-400 ml-2 font-mono">{currency}{it.costPrice?.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Financial */}
            <div className="bg-slate-900 rounded-2xl p-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>GROSS TOTAL</span>
                <span className="text-white font-black">{currency}{Math.round(pc.totalAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>AMOUNT PAID</span>
                <span className="text-emerald-400 font-black">{currency}{Math.round(pc.amountPaid).toLocaleString()}</span>
              </div>
              {diff > 0 && (
                <div className="flex justify-between border-t border-slate-700 pt-2">
                  <span className="text-slate-400">BALANCE DUE</span>
                  <span className="text-amber-400 font-black">{currency}{Math.round(diff).toLocaleString()}</span>
                </div>
              )}
              {diff <= 0 && (
                <div className="flex justify-between border-t border-slate-700 pt-2">
                  <span className="text-slate-400">STATUS</span>
                  <span className="text-emerald-400 font-black">✓ PAID IN FULL</span>
                </div>
              )}
            </div>
          </div>
          {/* Footer actions */}
          <div className="px-6 pb-6 pt-2 flex gap-3">
            <button
              onClick={() => { setViewPurchase(null); setEditPurchase(pc); }}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => { setViewPurchase(null); setDeletePurchaseId(pc.id); }}
              className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-2xl flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── DELETE CONFIRM MODAL ────────────────────────────────────────────────────
  const DeleteModal = ({ id }: { id: string }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDeletePurchaseId(null)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.28s cubic-bezier(.32,1.2,.6,1) both' }}
      >
        <div className="flex justify-center pt-1 pb-3 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="font-black text-slate-800 text-lg text-center mb-1">Delete Purchase?</h3>
        <p className="text-slate-400 text-sm text-center mb-6 font-sans">This action cannot be undone. The purchase record <span className="font-bold text-slate-600">{id}</span> will be permanently removed.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeletePurchaseId(null)}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-black rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // In a real app: call onDeletePurchase(id)
              setDeletePurchaseId(null);
            }}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-black rounded-2xl transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  // ── EDIT MODAL (simple stub — real edit would use a form like the till) ─────
  const EditModal = ({ pc }: { pc: Purchase }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditPurchase(null)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.28s cubic-bezier(.32,1.2,.6,1) both' }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-6 pt-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-800 text-base">Edit Purchase</h3>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{pc.id}</p>
          </div>
          <button onClick={() => setEditPurchase(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono">Amount Paid</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 focus-within:border-emerald-500 px-3 py-2.5 rounded-xl transition-all">
              <span className="text-slate-500 font-bold font-mono mr-1.5">{currency}</span>
              <input type="number" defaultValue={pc.amountPaid} className="bg-transparent w-full text-sm text-slate-800 font-black font-mono focus:outline-none text-right" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono">Delivery Status</label>
            <select defaultValue={pc.deliveryStatus} className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-sm px-3 py-2.5 rounded-xl text-slate-800 font-bold outline-none cursor-pointer">
              <option value="Full order delivered">Full Order Delivered</option>
              <option value="Partial">Partial Delivery</option>
              <option value="Pending">Pending / Not Shipped</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest font-mono">Payment Method</label>
            <select defaultValue={pc.paymentMethod} className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-sm px-3 py-2.5 rounded-xl text-slate-800 font-bold outline-none cursor-pointer">
              <option value="Cash">Cash</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Credit/Debit Card</option>
            </select>
          </div>
        </div>
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={() => setEditPurchase(null)}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Slide-up keyframe */}
      <style>{`@keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      <div id="purchases-view-container" className="space-y-6 pb-8">
        
        {/* Tab Navigation header card */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl shadow-xs">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              <span>{activeTenant.businessType === 'pharmacy' ? 'Pharmaceutical & Drug Stock Buying' : 'Wholesale Resource Purchases (Buying)'}</span>
            </h4>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              Supply Chain Registry & Storage Restocking
            </p>
          </div>

          {/* Modern pill tab switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto gap-1">
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'history'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Purchase History</span>
            </button>
            
            <button
              onClick={() => setActiveSubTab('till')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'till'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Purchase</span>
            </button>
          </div>
        </div>

        {/* ── HISTORY TAB ─────────────────────────────────────────────────── */}
        {activeSubTab === 'history' ? (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs">
            
            {/* List title banner */}
            <div className="px-6 py-5 border-b border-slate-150 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-600">
                Purchase History ({purchases.length})
              </h5>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Restocks update stock value.</span>
              </div>
            </div>

            {/* Quick Filters Row */}
            {purchases.length > 0 && (
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/30 grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search */}
                <div className="relative md:col-span-4">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 select-none" />
                  <input
                    type="text"
                    placeholder="Search supplier, item or ref..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                {/* Destination */}
                <div className="md:col-span-2 relative">
                  <select
                    value={historyDestination}
                    onChange={(e) => setHistoryDestination(e.target.value as any)}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl text-xs px-3 py-2.5 pr-8 text-slate-700 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">All Targets</option>
                    <option value="shop">Shop Shelves</option>
                    <option value="store">Store Room</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Delivery status */}
                <div className="md:col-span-2 relative">
                  <select
                    value={historyDeliveryStatus}
                    onChange={(e) => setHistoryDeliveryStatus(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl text-xs px-3 py-2.5 pr-8 text-slate-700 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">All Deliveries</option>
                    <option value="Full order delivered">Fully Delivered</option>
                    <option value="Partial">Partial</option>
                    <option value="Pending">Pending</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Payment status */}
                <div className="md:col-span-2 relative">
                  <select
                    value={historyPaymentStatus}
                    onChange={(e) => setHistoryPaymentStatus(e.target.value as any)}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl text-xs px-3 py-2.5 pr-8 text-slate-700 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">All Payments</option>
                    <option value="paid">Paid in Full</option>
                    <option value="due">Credit Outstanding</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Sort */}
                <div className="md:col-span-2 relative">
                  <select
                    value={historySortBy}
                    onChange={(e) => setHistorySortBy(e.target.value as any)}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-xl text-xs pl-8 pr-2.5 py-2.5 text-slate-700 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="amount-desc">Amount: High–Low</option>
                    <option value="amount-asc">Amount: Low–High</option>
                    <option value="supplier-asc">Supplier (A–Z)</option>
                  </select>
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Table / Empty States */}
            {purchases.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 border border-slate-200">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h6 className="font-bold text-slate-700 text-sm">No Purchases Recorded Yet</h6>
                <p className="text-slate-400 max-w-sm mx-auto text-xs font-sans">
                  Record your first supplier purchase to start tracking inventory costs and stock restocking history.
                </p>
                <button
                  onClick={() => setActiveSubTab('till')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase cursor-pointer transition-all mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Purchase</span>
                </button>
              </div>
            ) : filteredAndSortedPurchases.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto border border-slate-200">
                  <Search className="w-6 h-6 text-slate-500" />
                </div>
                <h6 className="font-bold text-slate-750 text-sm">No Matches Found</h6>
                <p className="text-slate-455 max-w-sm mx-auto text-xs font-sans">
                  No purchases matched the active filters.
                </p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase cursor-pointer transition-all mt-2"
                >
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              <>
                {/* ── DESKTOP TABLE ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left" id="purchases-table">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-4 px-5">Date</th>
                        <th className="py-4 px-5">Ref #</th>
                        <th className="py-4 px-5">Supplier</th>
                        <th className="py-4 px-5">Destination</th>
                        <th className="py-4 px-5">Items</th>
                        <th className="py-4 px-5 text-right">Total</th>
                        <th className="py-4 px-5 text-right">Paid</th>
                        <th className="py-4 px-5 text-right">Balance</th>
                        <th className="py-4 px-5 text-center">Delivery</th>
                        <th className="py-4 px-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredAndSortedPurchases.map(pc => {
                        const diffSum = pc.totalAmount - pc.amountPaid;
                        const isCredit = diffSum > 0;
                        return (
                          <tr key={pc.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-5 font-mono font-medium text-slate-500 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{new Date(pc.timestamp).toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="py-4 px-5 font-mono font-bold text-slate-800 whitespace-nowrap">{pc.id}</td>
                            <td className="py-4 px-5 font-bold text-slate-800 font-sans whitespace-nowrap">{pc.supplierName}</td>
                            <td className="py-4 px-5">
                              {pc.destination === 'shop' ? (
                                <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-100 text-[10px] font-extrabold uppercase py-1 px-2.5 rounded-lg">
                                  <Store className="w-3 h-3" /><span>Shop</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-extrabold uppercase py-1 px-2.5 rounded-lg">
                                  <Archive className="w-3 h-3" /><span>Store</span>
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-5">
                              <div className="max-w-xs space-y-1">
                                {pc.items.map((it, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[11px] font-mono border-b border-dashed border-slate-100 pb-0.5">
                                    <span className="text-slate-650 truncate max-w-[140px]">{it.productName}</span>
                                    <span className="font-extrabold text-slate-800 shrink-0 ml-2">×{it.qty}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-4 px-5 text-right font-mono whitespace-nowrap">
                              <span className="font-black text-slate-800">{currency}{Math.round(pc.totalAmount).toLocaleString()}</span>
                              {((pc.discount && pc.discount > 0) || (pc.deliveryFee && pc.deliveryFee > 0)) ? (
                                <div className="text-[10px] text-slate-400 space-y-0.5 mt-1">
                                  {pc.discount ? <span className="block text-amber-600">Disc: {pc.discountType === 'percentage' ? `${pc.discount}%` : `${currency}${pc.discount}`}</span> : null}
                                  {pc.deliveryFee ? <span className="block text-sky-600">Del: {currency}{pc.deliveryFee}</span> : null}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-4 px-5 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {currency}{Math.round(pc.amountPaid).toLocaleString()}
                            </td>
                            <td className="py-4 px-5 text-right font-mono font-bold whitespace-nowrap">
                              {isCredit ? (
                                <span className="text-amber-600 font-black">{currency}{Math.round(diffSum).toLocaleString()}</span>
                              ) : (
                                <span className="text-slate-400 font-normal text-[11px]">Paid In Full</span>
                              )}
                            </td>
                            <td className="py-4 px-5 text-center whitespace-nowrap">
                              {pc.deliveryStatus === 'Full order delivered' ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-extrabold py-1 px-2.5 rounded-lg">
                                  <CheckCircle className="w-3.5 h-3.5" /><span>Delivered</span>
                                </span>
                              ) : pc.deliveryStatus === 'Partial' ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-extrabold py-1 px-2.5 rounded-lg">
                                  <AlertCircle className="w-3.5 h-3.5" /><span>Partial</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-extrabold py-1 px-2.5 rounded-lg animate-pulse">
                                  <AlertCircle className="w-3.5 h-3.5" /><span>Pending</span>
                                </span>
                              )}
                            </td>
                            {/* Desktop actions dropdown */}
                            <td className="py-4 px-5 text-center relative">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === pc.id ? null : pc.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors mx-auto"
                              >
                                <MoreVertical className="w-4 h-4 text-slate-500" />
                              </button>
                              {openMenuId === pc.id && (
                                <>
                                  <div className="fixed inset-0 z-[60]" onClick={() => setOpenMenuId(null)} />
                                  <div className="absolute right-0 top-full mt-1 z-[70] bg-white border border-slate-200 rounded-2xl shadow-2xl w-44 py-1"
                                    style={{boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)'}}
                                  >
                                    <button
                                      onClick={() => { setOpenMenuId(null); setViewPurchase(pc); }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-slate-400" /> View Details
                                    </button>
                                    <button
                                      onClick={() => { setOpenMenuId(null); setEditPurchase(pc); }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-slate-400" /> Edit Purchase
                                    </button>
                                    <div className="h-px bg-slate-100 mx-3 my-1" />
                                    <button
                                      onClick={() => { setOpenMenuId(null); setDeletePurchaseId(pc.id); }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── MOBILE CARDS ── */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredAndSortedPurchases.map(pc => {
                    const diff = pc.totalAmount - pc.amountPaid;
                    return (
                      <div key={pc.id} className="p-4 flex items-center justify-between gap-3">
                        {/* Left info */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-800 text-xs font-mono">{pc.id}</span>
                            {pc.deliveryStatus === 'Full order delivered' ? (
                              <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] font-extrabold py-0.5 px-2 rounded-md">
                                <CheckCircle className="w-2.5 h-2.5" /> Delivered
                              </span>
                            ) : pc.deliveryStatus === 'Partial' ? (
                              <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[9.5px] font-extrabold py-0.5 px-2 rounded-md">
                                <AlertCircle className="w-2.5 h-2.5" /> Partial
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-600 text-[9.5px] font-extrabold py-0.5 px-2 rounded-md">
                                <AlertCircle className="w-2.5 h-2.5" /> Pending
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-600 truncate">{pc.supplierName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{new Date(pc.timestamp).toLocaleDateString()}</p>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-800 text-xs font-mono">{currency}{Math.round(pc.totalAmount).toLocaleString()}</span>
                            {diff > 0 ? (
                              <span className="text-[10px] text-amber-600 font-bold">Due: {currency}{Math.round(diff).toLocaleString()}</span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-bold">✓ Paid</span>
                            )}
                          </div>
                        </div>
                        {/* Menu button */}
                        <button
                          onClick={() => setViewPurchase(pc)}
                          className="shrink-0 flex items-center gap-1.5 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 rounded-xl"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        ) : (
          /* ── ADD PURCHASE TAB ─────────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left panel: Product List */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h5 className="font-black text-slate-800 text-sm font-sans hidden sm:block">Product List</h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono hidden sm:block">Select items to procure</p>
                </div>

                {/* Search bar */}
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Scan barcode, code, or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white pl-9 text-slate-800 font-sans"
                  />
                </div>
              </div>

              {/* Product cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredProducts.map(prod => (
                  <div 
                    key={prod.id}
                    onClick={() => handleAddToCart(prod)}
                    className="border border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer transition-all hover:shadow-sm group"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="inline-block text-[9px] font-mono tracking-wider font-extrabold bg-slate-200/60 px-2 py-0.5 rounded text-slate-500">
                          {prod.sku}
                        </span>
                        <span className="text-[9.5px] font-bold text-slate-400 font-mono">
                          Stock: {formatProductQuantity(prod.stockQty, prod)}
                        </span>
                      </div>
                      <h6 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-emerald-700">{prod.name}</h6>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Cost: </span>
                        <span className="font-bold text-slate-700 font-mono">{currency}{prod.costPrice.toLocaleString()}</span>
                      </div>
                      <div className="text-emerald-600 bg-emerald-50 font-black p-1 rounded-lg">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center p-12 space-y-2 text-slate-450 text-xs">
                    <Package className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold">No products matched</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: Cart & Order Metadata */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
              
              {/* Supplier & Destination */}
              <div className="space-y-3 border-b border-slate-150 pb-4">
                <h5 className="font-extrabold text-slate-800 text-sm">Supplier & Destination</h5>
                
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Vendor / Supplier</label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-bold outline-none cursor-pointer"
                    >
                      {availableSuppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.contactPerson})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div id="restock-destination" className="space-y-1">
                    <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Stock Destination</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDestination('shop')}
                        className={`py-2.5 rounded-xl text-xs font-bold font-mono uppercase border cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                          destination === 'shop'
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-200 text-slate-550 hover:bg-slate-50'
                        }`}
                      >
                        <Store className="w-4 h-4" />
                        <span>Shop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDestination('store')}
                        className={`py-2.5 rounded-xl text-xs font-bold font-mono uppercase border cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                          destination === 'store'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-555 hover:bg-slate-50'
                        }`}
                      >
                        <Archive className="w-4 h-4" />
                        <span>Store Room</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Order Delivery State</label>
                    <select
                      value={deliveryStatus}
                      onChange={(e) => setDeliveryStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2 rounded-xl text-slate-800 font-bold outline-none cursor-pointer"
                    >
                      <option value="Full order delivered">Full Order Delivered</option>
                      <option value="Partial">Partial Order Delivered</option>
                      <option value="Pending">Pending / Not Shipped Yet</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Supplier Discount</label>
                      <div className="flex rounded-xl bg-slate-50 border border-slate-200 overflow-hidden text-xs">
                        <select
                          value={purchaseDiscountType}
                          onChange={(e) => { setPurchaseDiscountType(e.target.value as any); setPurchaseDiscount(0); }}
                          className="bg-slate-100 border-r border-slate-200 px-1.5 text-[10px] py-1.5 font-bold cursor-pointer focus:outline-none"
                        >
                          <option value="percentage">%</option>
                          <option value="cash">{currency}</option>
                        </select>
                        <input
                          type="number" min="0" value={purchaseDiscount || ''}
                          onChange={(e) => setPurchaseDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full bg-transparent px-2 text-xs font-bold font-mono focus:outline-none text-right pr-2 py-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Transport Fee</label>
                      <div className="flex rounded-xl bg-slate-50 border border-slate-200 overflow-hidden text-xs text-slate-800">
                        <span className="bg-slate-100 border-r border-slate-200 px-2 py-1.5 text-[10px] font-mono font-bold">{currency}</span>
                        <input
                          type="number" min="0" value={deliveryFee || ''}
                          onChange={(e) => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full bg-transparent px-2 text-xs font-bold font-mono focus:outline-none text-right pr-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cart */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search & add product to cart..."
                    className="flex-1 bg-transparent border-none outline-none text-xs text-slate-700 placeholder-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button type="button" className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg whitespace-nowrap">📷 Scan</button>
                </div>
                <h6 className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 font-mono flex items-center justify-between">
                  <span>Purchased Items ({cart.length})</span>
                  {cart.length > 0 && <span className="text-emerald-600">{currency}{cart.reduce((s,i) => s + i.costPrice * i.qty, 0).toLocaleString()}</span>}
                </h6>
                
                {cart.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 space-y-1">
                    <ClipboardList className="w-7 h-7 mx-auto text-slate-300" />
                    <p className="font-bold">Cart is empty</p>
                    <p className="text-[10px] text-slate-400 font-sans">Click products on the left to add them</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.product.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-xs text-slate-800 line-clamp-1">{item.product.name}</span>
                          <button 
                            type="button" 
                            onClick={() => handleUpdateQty(item.product.id, 0)}
                            className="text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-200/60 font-mono text-xs">
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400 text-[10px] font-black">COST:</span>
                            <div className="flex items-center bg-white border border-slate-250 rounded-lg px-2 py-0.5">
                              <span className="text-slate-500 font-bold text-[10px]">{currency}</span>
                              <input 
                                type="number" min="0" value={item.costPrice || ''}
                                onChange={(e) => handleUpdateCostPrice(item.product.id, parseFloat(e.target.value) || 0)}
                                className="w-16 bg-transparent text-slate-800 font-black focus:outline-none focus:ring-0 text-right border-0 text-xs py-0.5"
                                placeholder="Cost"
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-2xs">
                            <button type="button" onClick={() => handleUpdateQty(item.product.id, item.qty - 1)} className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-extrabold text-slate-800 text-xs">{item.qty}</span>
                            <button type="button" onClick={() => handleUpdateQty(item.product.id, item.qty + 1)} className="p-1 text-slate-550 hover:text-slate-800 cursor-pointer">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-right text-[10.5px] font-mono text-slate-505 pt-0.5">
                          <span>Total: </span>
                          <span className="font-black text-slate-705">{currency}{(item.costPrice * item.qty).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment section */}
              {cart.length > 0 && (
                <div className="border-t border-slate-150 pt-4 space-y-4 font-sans text-xs">
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 font-mono text-[11px] text-slate-650">
                    <div className="flex justify-between font-bold text-slate-755">
                      <span>ITEMS GROSS COST</span>
                      <span>{currency}{Math.round(subtotal).toLocaleString()}</span>
                    </div>
                    {purchaseDiscount > 0 && (
                      <div className="flex justify-between text-amber-600 text-[10.5px]">
                        <span>DISCOUNT ({purchaseDiscountType === 'percentage' ? `${purchaseDiscount}%` : currency + purchaseDiscount})</span>
                        <span>-{currency}{Math.round(discountAmount).toLocaleString()}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sky-600 text-[10.5px]">
                        <span>TRANSPORT FEE</span>
                        <span>+{currency}{Math.round(deliveryFee).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-2 text-xs">
                      <span>GRAND TOTAL</span>
                      <span className="text-emerald-600">{currency}{Math.round(totalAmount).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block font-mono">Amount Paid Now</label>
                      <button 
                        type="button"
                        onClick={() => setAmountPaid(totalAmount)}
                        className="text-[9.5px] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded font-black font-sans uppercase"
                      >
                        Settle Full
                      </button>
                    </div>
                    <div className="flex items-center bg-slate-50 border border-slate-250 focus-within:border-emerald-500 px-3 py-2.5 rounded-xl transition-all">
                      <span className="text-slate-500 font-bold font-mono mr-1.5">{currency}</span>
                      <input 
                        type="number" min="0"
                        value={amountPaid || ''}
                        onChange={(e) => setAmountPaid(Math.min(totalAmount, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="bg-transparent w-full text-xs text-slate-800 font-black font-mono focus:outline-none text-right placeholder-slate-400"
                        placeholder="0 (leave empty if not paid yet)"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block font-mono">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-white border border-slate-250 focus:border-emerald-500 px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Credit/Debit Card</option>
                    </select>
                  </div>

                  <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-650 border-t border-dashed border-slate-250 pt-2.5">
                    <span>OUTSTANDING BALANCE</span>
                    {amountDue > 0 ? (
                      <span className="text-amber-600 font-black">{currency}{Math.round(amountDue).toLocaleString()}</span>
                    ) : (
                      <span className="text-emerald-600 font-black">Paid in Full</span>
                    )}
                  </div>

                  {/* Modern CTA button */}
                  <button
                    type="button"
                    disabled={purchaseSuccess}
                    onClick={handleCommitPurchase}
                    className="w-full relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 disabled:from-slate-200 disabled:to-slate-100 text-white font-black py-4 px-4 rounded-2xl text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                  >
                    {purchaseSuccess ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Purchase Saved & Restocked!</span>
                      </div>
                    ) : (
                      <>
                        <span>Purchase & Restock ({cart.length} items)</span>
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                      </>
                    )}
                  </button>

                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {viewPurchase && <ViewModal pc={viewPurchase} />}
      {editPurchase && <EditModal pc={editPurchase} />}
      {deletePurchaseId && <DeleteModal id={deletePurchaseId} />}
    </>
  );
}
