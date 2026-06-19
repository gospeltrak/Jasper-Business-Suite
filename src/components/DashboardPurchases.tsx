import { useState } from 'react';
import { Product, Supplier, Purchase, PurchaseItem, Tenant } from '../types';
import { addBatchToProduct, createInventoryBatch } from '../utils/inventoryCosting';
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
  ArrowUpDown
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

  // History ledger search, filter and sort states
  const [historySearch, setHistorySearch] = useState('');
  const [historyDestination, setHistoryDestination] = useState<'all' | 'shop' | 'store'>('all');
  const [historyDeliveryStatus, setHistoryDeliveryStatus] = useState<string>('all');
  const [historyPaymentStatus, setHistoryPaymentStatus] = useState<'all' | 'paid' | 'due'>('all');
  const [historySortBy, setHistorySortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'supplier-asc'>('date-desc');

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

      const matchesDestination = 
        historyDestination === 'all' || pc.destination === historyDestination;

      const matchesDelivery = 
        historyDeliveryStatus === 'all' || pc.deliveryStatus === historyDeliveryStatus;

      const matchesPayment = 
        historyPaymentStatus === 'all' ||
        (historyPaymentStatus === 'paid' && pc.amountDue <= 0) ||
        (historyPaymentStatus === 'due' && pc.amountDue > 0);

      return matchesSearch && matchesDestination && matchesDelivery && matchesPayment;
    })
    .sort((a, b) => {
      if (historySortBy === 'date-desc') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      if (historySortBy === 'date-asc') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      if (historySortBy === 'amount-desc') {
        return b.totalAmount - a.totalAmount;
      }
      if (historySortBy === 'amount-asc') {
        return a.totalAmount - b.totalAmount;
      }
      if (historySortBy === 'supplier-asc') {
        return a.supplierName.localeCompare(b.supplierName);
      }
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

  // Modify Cart Qty
  const handleUpdateQty = (productId: string, val: number) => {
    if (val <= 0) {
      setCart(cart.filter(item => item.product.id !== productId));
    } else {
      setCart(cart.map(item => 
        item.product.id === productId ? { ...item, qty: val } : item
      ));
    }
  };

  // Modify unit cost in procurement till
  const handleUpdateCostPrice = (productId: string, cost: number) => {
    setCart(cart.map(item => 
      item.product.id === productId ? { ...item, costPrice: Math.max(0, cost) } : item
    ));
  };

  // Summary tallies
  const subtotal = cart.reduce((sum, item) => sum + (item.costPrice * item.qty), 0);
  const discountAmount = purchaseDiscountType === 'percentage'
    ? (subtotal * purchaseDiscount) / 100
    : purchaseDiscount;
  const totalAmount = Math.max(0, subtotal - discountAmount) + deliveryFee;
  const amountDue = Math.max(0, totalAmount - amountPaid);

  // Commit purchase
  const handleCommitPurchase = () => {
    if (cart.length === 0) return;
    if (!selectedSupplierId) {
      alert("Please select a valid supplier first!");
      return;
    }

    const supplier = availableSuppliers.find(s => s.id === selectedSupplierId) || availableSuppliers[0];

    // Create purchase transaction
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

    // Update product stock inventory
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

  return (
    <div id="purchases-view-container" className="space-y-6">
      
      {/* Tab Navigation header card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs">
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <span>{activeTenant.businessType === 'pharmacy' ? 'Pharmaceutical & Drug Stock Procurement' : 'Wholesale Resource Purchases (Procurement)'}</span>
          </h4>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Supply Chain Registry & Storage Restocking Ledger
          </p>
        </div>

        {/* Action Tabs Slider */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeSubTab === 'history'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Purchases History Ledger</span>
          </button>
          
          <button
            onClick={() => setActiveSubTab('till')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeSubTab === 'till'
                ? 'bg-white text-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Supplier Purchase (Till)</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout switches */}
      {activeSubTab === 'history' ? (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          
          {/* List title & meta banner */}
          <div className="px-6 py-5 border-b border-slate-150 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
            <h5 className="text-xs font-black uppercase tracking-widest text-slate-600">
              Procured Supply Records List ({purchases.length})
            </h5>
            <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Restock actions recorded instantly change active branch valuations</span>
            </div>
          </div>

          {/* Quick Filters Row */}
          {purchases.length > 0 && (
            <div className="p-5 border-b border-slate-200 bg-slate-50/30 grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Search input field */}
              <div className="relative md:col-span-4">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 select-none" />
                <input
                  type="text"
                  placeholder="Search supplier, item name or ref ID..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              {/* Destination selectivity dropdown */}
              <div className="md:col-span-2">
                <select
                  value={historyDestination}
                  onChange={(e) => setHistoryDestination(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs px-2.5 py-2.5 text-slate-650 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Targets</option>
                  <option value="shop">Shop Shelves</option>
                  <option value="store">Backroom Store</option>
                </select>
              </div>

              {/* Deliver status selectivity dropdown */}
              <div className="md:col-span-2">
                <select
                  value={historyDeliveryStatus}
                  onChange={(e) => setHistoryDeliveryStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs px-2.5 py-2.5 text-slate-650 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Deliveries</option>
                  <option value="Full order delivered">Fully Delivered</option>
                  <option value="Partial">Partial Deliveries</option>
                  <option value="Pending">Pending Delivery</option>
                </select>
              </div>

              {/* Payment status filter */}
              <div className="md:col-span-2">
                <select
                  value={historyPaymentStatus}
                  onChange={(e) => setHistoryPaymentStatus(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs px-2.5 py-2.5 text-slate-650 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid (In Full)</option>
                  <option value="due">Credit Outstanding</option>
                </select>
              </div>

              {/* Sorting selectors */}
              <div className="md:col-span-2">
                <div className="relative">
                  <select
                    value={historySortBy}
                    onChange={(e) => setHistorySortBy(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl text-xs pl-8 pr-2.5 py-2.5 text-slate-705 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="amount-desc">Amount: High-Low</option>
                    <option value="amount-asc">Amount: Low-High</option>
                    <option value="supplier-asc">Supplier (A-Z)</option>
                  </select>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Table display */}
          {purchases.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 border border-slate-200">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h6 className="font-bold text-slate-700 text-sm">No Purchases History Recorded Yet</h6>
              <p className="text-slate-400 max-w-sm mx-auto text-xs font-sans">
                Procure stock logs directly from authorized logistics suppliers in our active register. Add items to increase the store shelves or backroom storage.
              </p>
              <button
                onClick={() => setActiveSubTab('till')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase cursor-pointer transition-all mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Launch Purchase Rec Till</span>
              </button>
            </div>
          ) : filteredAndSortedPurchases.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 border border-slate-200">
                <Search className="w-6 h-6 text-slate-500" />
              </div>
              <h6 className="font-bold text-slate-750 text-sm">No Procurement Matches</h6>
              <p className="text-slate-455 max-w-sm mx-auto text-xs font-sans">
                No purchases matched the active search keywords or filter criteria for this branch.
              </p>
              <button
                onClick={resetFilters}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase cursor-pointer transition-all mt-2"
              >
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" id="purchases-table">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-4 px-6">Timestamp / Date</th>
                    <th className="py-4 px-6">Purchase ID</th>
                    <th className="py-4 px-6">Warehouse Supplier</th>
                    <th className="py-4 px-6">Restock Target</th>
                    <th className="py-4 px-6">Procured Item Details</th>
                    <th className="py-4 px-6 text-right">Invoice Sum</th>
                    <th className="py-4 px-6 text-right">Settled Amount</th>
                    <th className="py-4 px-6 text-right">Outstanding Credit</th>
                    <th className="py-4 px-6 text-center">Dispatch Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredAndSortedPurchases.map(pc => {
                    const diffSum = pc.totalAmount - pc.amountPaid;
                    const isCredit = diffSum > 0;
                    return (
                      <tr key={pc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4.5 px-6 font-mono font-medium text-slate-500">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{new Date(pc.timestamp).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="py-4.5 px-6 font-mono font-bold text-slate-800">
                          {pc.id}
                        </td>
                        <td className="py-4.5 px-6 font-bold text-slate-800 font-sans">
                          {pc.supplierName}
                        </td>
                        <td className="py-4.5 px-6">
                          {pc.destination === 'shop' ? (
                            <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 border border-sky-100 text-[10px] font-extrabold uppercase py-1 px-2.5 rounded-lg font-sans">
                              <Store className="w-3 h-3 text-sky-600" />
                              <span>Shop Shelf</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-extrabold uppercase py-1 px-2.5 rounded-lg font-sans">
                              <Archive className="w-3 h-3 text-amber-600" />
                              <span>Backroom Store</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4.5 px-6">
                          <div className="max-w-xs space-y-1">
                            {pc.items.map((it, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] font-mono border-b border-dashed border-slate-100 pb-0.5">
                                <span className="text-slate-650 truncate max-w-[160px]">{it.productName}</span>
                                <span className="font-extrabold text-slate-800 shrink-0">x{it.qty}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-4.5 px-6 text-right font-mono">
                          <span className="font-mono font-black text-slate-800 block">
                            {currency}{Math.round(pc.totalAmount).toLocaleString()}
                          </span>
                          {(pc.discount && pc.discount > 0) || (pc.deliveryFee && pc.deliveryFee > 0) ? (
                            <div className="text-[10px] text-slate-400 space-y-0.5 leading-none mt-1">
                              {pc.discount ? (
                                <span className="block text-amber-600">
                                  Disc: {pc.discountType === 'percentage' ? `${pc.discount}%` : `${currency}${pc.discount}`}
                                </span>
                              ) : null}
                              {pc.deliveryFee ? (
                                <span className="block text-sky-600">
                                  Del: {currency}{pc.deliveryFee}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-4.5 px-6 text-right font-mono font-bold text-emerald-600">
                          {currency}{Math.round(pc.amountPaid).toLocaleString()}
                        </td>
                        <td className="py-4.5 px-6 text-right font-mono font-bold text-slate-900">
                          {isCredit ? (
                            <span className="text-amber-600 font-black">
                              {currency}{Math.round(diffSum).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Paid In Full</span>
                          )}
                        </td>
                        <td className="py-4.5 px-6 text-center">
                          {pc.deliveryStatus === 'Full order delivered' ? (
                            <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-extrabold py-1 px-2.5 rounded-lg font-bold">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Full Delivered</span>
                            </span>
                          ) : pc.deliveryStatus === 'Partial' ? (
                            <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-extrabold py-1 px-2.5 rounded-lg font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Partial Dispatch</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 bg-slate-50 text-slate-700 border border-slate-100 text-[10px] font-extrabold py-1 px-2.5 rounded-lg font-bold animate-pulse">
                              <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                              <span>Pending Delivery</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* TAB CONTENT: Interactive Procurement Recording Till */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Product Selector catalog */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h5 className="font-black text-slate-800 text-sm font-sans">Active Product Registry</h5>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Select Catalog Items to Procure</p>
              </div>

              {/* Search bar widget */}
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Scan barcode, code, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white pl-9 text-slate-800 font-sans"
                />
              </div>
            </div>

            {/* Product card selection list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
              {filteredProducts.map(prod => {
                return (
                  <div 
                    key={prod.id}
                    onClick={() => handleAddToCart(prod)}
                    className="border border-slate-200 hover:border-emerald-505 bg-slate-50/50 hover:bg-emerald-50/15 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer transition-all hover:shadow-xs group"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="inline-block text-[9px] font-mono tracking-wider font-extrabold bg-slate-200/60 px-2 py-0.5 rounded text-slate-505">
                          {prod.sku}
                        </span>
                        <span className="text-[9.5px] font-bold text-slate-400 font-mono">
                          Curr. stock: {prod.stockQty}
                        </span>
                      </div>
                      <h6 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-emerald-700">{prod.name}</h6>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Buying default: </span>
                        <span className="font-bold text-slate-700 font-mono">{currency}{prod.costPrice.toLocaleString()}</span>
                      </div>
                      <div className="text-emerald-600 bg-emerald-50 font-black p-1 rounded-lg">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-2 text-center p-12 space-y-2 text-slate-450 text-xs">
                  <Package className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold">No registered products matched filter</p>
                </div>
              )}
            </div>

          </div>

          {/* Right panel: Active Till Cart & Order Metadata options */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
            
            {/* Header / Supplier Selector */}
            <div className="space-y-3 border-b border-slate-150 pb-4">
              <h5 className="font-extrabold text-slate-800 text-sm">Target Supplier & Restock Destination</h5>
              
              <div className="space-y-3.5">
                {/* Supplier Dropdown */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Active Vendor Partner</label>
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

                {/* Restocking Destination Dropdown */}
                <div id="restock-destination" className="space-y-1">
                  <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Taken To Area (Stock Destination)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDestination('shop')}
                      className={`py-2 rounded-xl text-xs font-bold font-mono uppercase border cursor-pointer flex items-center justify-center space-x-1.5 transition-all ${
                        destination === 'shop'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 text-slate-550 hover:bg-slate-50'
                      }`}
                    >
                      <Store className="w-4 h-4" />
                      <span>Shop Shelves</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestination('store')}
                      className={`py-2 rounded-xl text-xs font-bold font-mono uppercase border cursor-pointer flex items-center justify-center space-x-1.5 transition-all ${
                        destination === 'store'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 text-slate-555 hover:bg-slate-50'
                      }`}
                    >
                      <Archive className="w-4 h-4" />
                      <span>Backroom Store</span>
                    </button>
                  </div>
                </div>

                {/* Logistics status selector */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Order Delivery State</label>
                  <select
                    value={deliveryStatus}
                    onChange={(e) => setDeliveryStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2 rounded-xl text-slate-800 font-bold outline-none cursor-pointer"
                  >
                    <option value="Full order delivered">Full Order Delivered Immediately</option>
                    <option value="Partial">Partial Order Delivered</option>
                    <option value="Pending">Pending / Ordered but not Shipped</option>
                  </select>
                </div>

                {/* Supplier discount selection & Delivery/Freight fees */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Supplier Discount */}
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Supplier Discount</label>
                    <div className="flex rounded-xl bg-slate-50 border border-slate-200 overflow-hidden text-xs">
                      <select
                        value={purchaseDiscountType}
                        onChange={(e) => {
                          setPurchaseDiscountType(e.target.value as 'percentage' | 'cash');
                          setPurchaseDiscount(0);
                        }}
                        className="bg-slate-100 border-r border-slate-200 px-1.5 text-[10px] py-1.5 font-bold font-sans cursor-pointer focus:outline-none"
                      >
                        <option value="percentage">%</option>
                        <option value="cash">{currency}</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={purchaseDiscount || ''}
                        onChange={(e) => setPurchaseDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full bg-transparent px-2 text-xs font-bold font-mono focus:outline-none text-right pr-2 py-1"
                      />
                    </div>
                  </div>

                  {/* Delivery Transport Fee */}
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Delivery Transport Fee</label>
                    <div className="flex rounded-xl bg-slate-50 border border-slate-200 overflow-hidden text-xs text-slate-800">
                      <span className="bg-slate-100 border-r border-slate-200 px-2 py-1.5 text-[10px] font-mono font-bold">{currency}</span>
                      <input
                        type="number"
                        min="0"
                        value={deliveryFee || ''}
                        onChange={(e) => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full bg-transparent px-2 text-xs font-bold font-mono focus:outline-none text-right pr-2 py-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cart Items editable inputs */}
            <div className="space-y-3.5">
              <h6 className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 font-mono">Procured Elements ({cart.length})</h6>
              
              {cart.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 space-y-1">
                  <ClipboardList className="w-7 h-7 mx-auto text-slate-305" />
                  <p className="font-bold">Purchase bucket is empty</p>
                  <p className="text-[10px] text-slate-400 font-sans">Click products on the left catalog grid to buy</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {cart.map(item => {
                    return (
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

                        {/* Cost negotiative override and Qty adjustments */}
                        <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-200/60 font-mono text-xs">
                          {/* Unit Cost price override input */}
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400 text-[10px] font-black">COST:</span>
                            <div className="flex items-center bg-white border border-slate-250 rounded-lg px-2 py-0.5">
                              <span className="text-slate-500 font-bold text-[10px]">{currency}</span>
                              <input 
                                type="number"
                                min="0"
                                value={item.costPrice || ''}
                                onChange={(e) => handleUpdateCostPrice(item.product.id, parseFloat(e.target.value) || 0)}
                                className="w-16 bg-transparent text-slate-800 font-black focus:outline-none focus:ring-0 text-right border-0 text-xs py-0.5"
                                placeholder="Cost"
                              />
                            </div>
                          </div>

                          {/* Action Counter */}
                          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-2xs">
                            <button 
                              type="button"
                              onClick={() => handleUpdateQty(item.product.id, item.qty - 1)}
                              className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-extrabold text-slate-800 text-xs">{item.qty}</span>
                            <button 
                              type="button"
                              onClick={() => handleUpdateQty(item.product.id, item.qty + 1)}
                              className="p-1 text-slate-550 hover:text-slate-800 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Calculated Sub */}
                        <div className="text-right text-[10.5px] font-mono text-slate-505 pt-0.5">
                          <span>Total: </span>
                          <span className="font-black text-slate-705">{currency}{(item.costPrice * item.qty).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Calculations and payment layout */}
            {cart.length > 0 && (
              <div className="border-t border-slate-150 pt-4 space-y-4 font-sans text-xs">
                
                {/* Financial overview tallies */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-2 font-mono text-[11px] text-slate-650">
                  <div className="flex justify-between font-bold text-slate-755">
                    <span>ITEMS GROSS COST</span>
                    <span>{currency}{Math.round(subtotal).toLocaleString()}</span>
                  </div>
                  {purchaseDiscount > 0 && (
                    <div className="flex justify-between text-amber-600 text-[10.5px]">
                      <span>SUPPLIER DISCOUNT ({purchaseDiscountType === 'percentage' ? `${purchaseDiscount}%` : currency + purchaseDiscount})</span>
                      <span>-{currency}{Math.round(discountAmount).toLocaleString()}</span>
                    </div>
                  )}
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sky-600 text-[10.5px]">
                      <span>TRANSPORT / LOGISTICS FEE</span>
                      <span>+{currency}{Math.round(deliveryFee).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-2 text-xs">
                    <span>GRAND TOTAL NET COST</span>
                    <span className="text-emerald-600">{currency}{Math.round(totalAmount).toLocaleString()}</span>
                  </div>
                </div>

                {/* Settle amount paid */}
                <div className="space-y-1.5 font-sans">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block font-mono">Amount Paid Immediately</label>
                    <button 
                      type="button"
                      onClick={() => setAmountPaid(totalAmount)}
                      className="text-[9.5px] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded font-black font-sans uppercase"
                    >
                      Settle Full Sum
                    </button>
                  </div>
                  <div className="flex items-center bg-slate-50 border border-slate-250 focus-within:border-emerald-500 px-3 py-2.5 rounded-xl transition-all">
                    <span className="text-slate-500 font-bold font-mono mr-1.5">{currency}</span>
                    <input 
                      type="number"
                      min="0"
                      max={totalAmount}
                      value={amountPaid || ''}
                      onChange={(e) => setAmountPaid(Math.min(totalAmount, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="bg-transparent w-full text-xs text-slate-800 font-black font-mono focus:outline-none text-right placeholder-slate-400"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-1.5 font-sans">
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

                {/* Due Credit Display */}
                <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-650 border-t border-dashed border-slate-250 pt-2.5">
                  <span>OUTSTANDING BALANCE (VEND CREDIT)</span>
                  {amountDue > 0 ? (
                    <span className="text-amber-600 font-black">
                      {currency}{Math.round(amountDue).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-black">
                      Paid in Full (No credit debt)
                    </span>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  disabled={purchaseSuccess}
                  onClick={handleCommitPurchase}
                  className="w-full bg-slate-905 hover:bg-slate-800 disabled:bg-slate-100 text-white font-black py-4 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98"
                >
                  {purchaseSuccess ? (
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">RESTOCK COMPLETED & LOGGED!</span>
                    </div>
                  ) : (
                    <>
                      <span>Log Supplier Purchase & Restock ({cart.length} items)</span>
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
  );
}
