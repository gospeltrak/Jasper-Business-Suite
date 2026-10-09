import { useState, FormEvent } from 'react';
import { Supplier, Purchase, Product, Sale, Tenant } from '../../types';
import {
  Phone,
  Mail,
  User,
  Plus,
  X,
  Award,
  Truck,
  Users,
  Search,
  Store,
  Calendar,
  Receipt
} from 'lucide-react';

interface DashboardSuppliersProps {
  suppliers: Supplier[];
  onAddSupplier: (sup: Supplier) => void | Promise<boolean>;
  purchases: Purchase[];
  sales: Sale[];
  products: Product[];
  activeTenant: Tenant;
}

export default function DashboardSuppliers({
  suppliers,
  onAddSupplier,
  purchases,
  sales,
  products,
  activeTenant
}: DashboardSuppliersProps) {
  const [activePartnerTab, setActivePartnerTab] = useState<'suppliers' | 'performance' | 'customers'>('suppliers');
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingCustomer, setViewingCustomer] = useState<{ name: string; phone: string; sales: Sale[]; totalSpent: number; totalDue: number } | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const newSup: Supplier = {
      id: 's-' + Math.random().toString(36).substr(2, 9),
      name,
      contactPerson,
      phone,
      email: email || 'procurement@' + name.toLowerCase().replace(/\s+/g, '') + '.com',
      categories: categoryInput ? categoryInput.split(',').map(s => s.trim()) : ['Groceries'],
    };

    setFormError('');
    void Promise.resolve(onAddSupplier(newSup)).then(saved => {
      if (saved === false) {
        setFormError('Supplier could not be saved. Please try again.');
        return;
      }
      setFormSuccess(true);
      setTimeout(() => {
        setName('');
        setContactPerson('');
        setPhone('');
        setEmail('');
        setCategoryInput('');
        setIsOpen(false);
        setFormSuccess(false);
      }, 1000);
    });
  };

  // A sale's own amountPaid already reflects any installments recorded
  // against it (Sales tab's Add Payment writes straight through to the
  // sale record), so the customer's outstanding balance can be summed
  // purely from sales/amountPaid here without needing the Sales tab's
  // local installment log.
  const getSaleDue = (s: Sale) => {
    const paid = s.amountPaid !== undefined ? s.amountPaid : (s.paymentMethod === 'Credit' ? 0 : s.total);
    return Math.max(0, s.total - paid);
  };

  const getCustomersList = () => {
    const customersMap: Record<string, { name: string; phone: string; sales: Sale[]; totalSpent: number; totalDue: number }> = {};
    sales.forEach(s => {
      const name = s.customerName?.trim();
      const phone = s.customerPhone?.trim();
      if (!name && !phone) return;
      const key = phone || name || 'val-cust';
      if (!customersMap[key]) {
        customersMap[key] = {
          name: name || 'Registered Customer',
          phone: phone || 'No Phone Registered',
          sales: [],
          totalSpent: 0,
          totalDue: 0
        };
      }
      customersMap[key].sales.push(s);
      customersMap[key].totalSpent += s.total;
      customersMap[key].totalDue += getSaleDue(s);
    });
    return Object.values(customersMap)
      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  };

  // Partner Performance Analysis: attributes profit back to the supplier
  // that originally sold each unit, by tracing Sale -> SaleItem.batchesUsed
  // -> the matching ProductBatch -> its purchaseId -> that Purchase's
  // supplierId. Only uses data already recorded on sales/purchases/batches;
  // nothing here is estimated or guessed.
  const getSupplierPerformance = () => {
    const batchSupplierMap = new Map<string, string>();
    products.forEach(product => {
      (product.batches || []).forEach(batch => {
        if (!batch.purchaseId) return;
        const purchase = purchases.find(p => p.id === batch.purchaseId);
        if (purchase) batchSupplierMap.set(batch.id, purchase.supplierId);
      });
    });

    const revenueBySupplier: Record<string, number> = {};
    const profitBySupplier: Record<string, number> = {};
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        (item.batchesUsed || []).forEach(batchInfo => {
          const supplierId = batchSupplierMap.get(batchInfo.batchId);
          if (!supplierId) return;
          const qty = batchInfo.qty || 0;
          const revenue = (item.price || 0) * qty;
          const cost = (batchInfo.buyingPrice || 0) * qty;
          revenueBySupplier[supplierId] = (revenueBySupplier[supplierId] || 0) + revenue;
          profitBySupplier[supplierId] = (profitBySupplier[supplierId] || 0) + (revenue - cost);
        });
      });
    });

    return suppliers
      .map(supplier => {
        const supplierPurchases = purchases.filter(p => p.supplierId === supplier.id);
        const totalSpend = supplierPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
        const outstandingBalance = supplierPurchases.reduce((sum, p) => sum + (p.amountDue || 0), 0);
        const distinctProducts = new Set<string>();
        supplierPurchases.forEach(p => (p.items || []).forEach(i => distinctProducts.add(i.productId)));
        const revenue = revenueBySupplier[supplier.id] || 0;
        const profit = profitBySupplier[supplier.id] || 0;

        // Payment status per purchase -- read straight off amountPaid/
        // amountDue, same definition the Purchases screen itself uses.
        const paidCount = supplierPurchases.filter(p => (p.amountDue || 0) <= 0 && (p.amountPaid || 0) > 0).length;
        const partialPaidCount = supplierPurchases.filter(p => (p.amountPaid || 0) > 0 && (p.amountDue || 0) > 0).length;
        const creditCount = supplierPurchases.filter(p => (p.amountPaid || 0) <= 0).length;

        // Delivery status per purchase -- read straight off the
        // deliveryStatus already recorded on the Purchases form (Pending /
        // Partial / Full order delivered); a "Pending" or "Partial" count
        // is stock this vendor still owes the tenant.
        const deliveredCount = supplierPurchases.filter(p => p.deliveryStatus === 'Full order delivered').length;
        const partialDeliveryCount = supplierPurchases.filter(p => p.deliveryStatus === 'Partial').length;
        const pendingDeliveryCount = supplierPurchases.filter(p => p.deliveryStatus === 'Pending').length;

        return {
          supplier,
          totalSpend,
          outstandingBalance,
          purchaseCount: supplierPurchases.length,
          distinctProductCount: distinctProducts.size,
          profitMarginPct: revenue > 0 ? (profit / revenue) * 100 : null,
          paidCount,
          partialPaidCount,
          creditCount,
          deliveredCount,
          partialDeliveryCount,
          pendingDeliveryCount,
        };
      })
      .filter(perf => !searchQuery.trim()
        || perf.supplier.name.toLowerCase().includes(searchQuery.toLowerCase())
        || perf.supplier.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  };

  const filteredSuppliers = suppliers.filter(sup =>
    sup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sup.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sup.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const customerList = getCustomersList();
  const supplierPerformance = getSupplierPerformance();

  return (
    <div id="partners-view" className="space-y-6 p-2 md:p-0">
      {/* CLEAN TABS ONLY - NO HEADER CARD */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full max-w-md mx-auto sm:mx-0 overflow-x-auto no-scrollbar">
        {[
          { id: 'suppliers', label: 'Suppliers', icon: Truck },
          { id: 'performance', label: 'Performance', icon: Award },
          { id: 'customers', label: 'Customers', icon: User },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActivePartnerTab(tab.id as any); setSearchQuery(''); }}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              activePartnerTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${activePartnerTab === tab.id ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-200 p-4 md:p-6 rounded-3xl shadow-sm">
        <div className="relative w-full max-w-md group">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-emerald-500" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search partners..."
            className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
          />
        </div>

        {activePartnerTab === 'suppliers' && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            <Plus className="w-4 h-4" />
            <span>{isOpen ? 'Close' : 'Add Supplier'}</span>
          </button>
        )}
      </div>

      {/* FORM - MODAL STYLE */}
      {activePartnerTab === 'suppliers' && isOpen && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-3xl space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h5 className="text-sm font-black text-slate-800 uppercase">New Supplier Details</h5>
              <button type="button" onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Vendor Name</label>
                <input type="text" required placeholder="e.g. Global Tech Supplies" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Contact Person</label>
                <input type="text" placeholder="Full Name" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="+255..." value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="email" placeholder="email@company.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Categories (comma separated)</label>
                <input type="text" placeholder="Electronics, Logistics, Office Supplies" value={categoryInput} onChange={e => setCategoryInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsOpen(false)} className="px-6 py-3 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-100">Save Supplier</button>
            </div>
          </form>
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="min-h-[400px]">
        {activePartnerTab === 'suppliers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map(sup => (
                <div key={sup.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between hover:bg-white hover:shadow-sm transition-all group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-emerald-600 flex items-center justify-center font-bold shadow-sm">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h6 className="text-sm font-bold text-slate-900">{sup.name}</h6>
                      <p className="text-xs text-slate-500">{sup.contactPerson || 'No contact person'}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="flex gap-1 justify-end">
                      {sup.categories.slice(0, 1).map((cat, i) => (
                        <span key={i} className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <div className="inline-flex p-4 bg-slate-50 rounded-full text-slate-300 mb-4">
                  <Truck className="w-8 h-8" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No suppliers found matching your search.</p>
              </div>
            )}
          </div>
        )}

        {activePartnerTab === 'customers' && (
          <div className="overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total Spent</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Orders</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerList.length > 0 ? (
                    customerList.map((cust, i) => (
                      <tr key={i} onClick={() => setViewingCustomer(cust)} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                              {cust.name[0]}
                            </div>
                            <span className="text-sm font-bold text-slate-800">{cust.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{cust.phone}</td>
                        <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">{activeTenant.currency}{cust.totalSpent.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 text-center">{cust.sales.length}</td>
                        <td className="px-6 py-4 text-right">
                          {cust.totalDue > 0 ? (
                            <span className="inline-flex items-center text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">
                              Ana Deni: {activeTenant.currency}{Math.round(cust.totalDue).toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                              Amelipa
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-400 text-sm">No customers recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden grid grid-cols-1 gap-4 p-4">
              {customerList.length > 0 ? (
                customerList.map((cust, i) => (
                  <div key={i} onClick={() => setViewingCustomer(cust)} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer active:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-emerald-600 flex items-center justify-center font-bold shadow-sm shrink-0">
                        {cust.name[0]}
                      </div>
                      <div className="text-left min-w-0">
                        <h6 className="text-sm font-bold text-slate-900 truncate">{cust.name}</h6>
                        <p className="text-xs text-slate-500 truncate">{cust.phone}</p>
                        {cust.totalDue > 0 ? (
                          <span className="inline-flex items-center mt-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                            Ana Deni: {activeTenant.currency}{Math.round(cust.totalDue).toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center mt-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            Amelipa
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-slate-900">{activeTenant.currency}{cust.totalSpent.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{cust.sales.length} Orders</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-slate-400 text-sm">No customers recorded yet.</div>
              )}
            </div>
          </div>
        )}

        {activePartnerTab === 'performance' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {supplierPerformance.length > 0 ? (
              supplierPerformance.map(perf => (
                <div key={perf.supplier.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h6 className="text-sm font-bold text-slate-900 truncate">{perf.supplier.name}</h6>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {perf.purchaseCount} purchase{perf.purchaseCount !== 1 ? 's' : ''} · {perf.distinctProductCount} product{perf.distinctProductCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-xl px-2.5 py-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Margin</p>
                      <p className={`text-sm font-black ${perf.profitMarginPct === null ? 'text-slate-400' : perf.profitMarginPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {perf.profitMarginPct === null ? '—' : `${perf.profitMarginPct.toFixed(1)}%`}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-2.5 py-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Spend</p>
                      <p className="text-sm font-black text-slate-900 truncate">{activeTenant.currency}{Math.round(perf.totalSpend).toLocaleString()}</p>
                    </div>
                  </div>

                  {perf.outstandingBalance > 0 && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-2">
                      <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wide">We Owe</span>
                      <span className="text-xs font-black text-amber-700">{activeTenant.currency}{Math.round(perf.outstandingBalance).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Payment status pills -- only non-zero buckets shown, so
                      a supplier with all-paid orders stays a short card. */}
                  <div className="flex flex-wrap gap-1">
                    {perf.paidCount > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{perf.paidCount} Paid</span>
                    )}
                    {perf.partialPaidCount > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">{perf.partialPaidCount} Partial</span>
                    )}
                    {perf.creditCount > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-700">{perf.creditCount} Credit</span>
                    )}
                  </div>

                  {/* Delivery status pills -- "Pending"/"Partial" is stock
                      this vendor still owes the tenant, read straight off
                      deliveryStatus already recorded on the Purchases form. */}
                  <div className="flex flex-wrap gap-1">
                    {perf.deliveredCount > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">{perf.deliveredCount} Delivered</span>
                    )}
                    {perf.partialDeliveryCount > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">{perf.partialDeliveryCount} Partial Delivery</span>
                    )}
                    {perf.pendingDeliveryCount > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-700">{perf.pendingDeliveryCount} Owes Delivery</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <div className="inline-flex p-4 bg-slate-50 rounded-full text-slate-300 mb-4">
                  <Award className="w-8 h-8" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No supplier performance data yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer purchase history -- date/receipt/amount paid per past
          sale, as requested; deliberately no line-item breakdown here. */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
          style={{padding:'calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 12px) 12px'}}>
          <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{maxHeight:'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))'}}>
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  {viewingCustomer.name[0]}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black tracking-tight truncate">{viewingCustomer.name}</h4>
                  <p className="text-[10px] font-mono text-slate-400 truncate">{viewingCustomer.phone}</p>
                </div>
              </div>
              <button onClick={() => setViewingCustomer(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer bg-transparent border-none shrink-0 ml-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* reports-split-grid, not grid-cols-2: see index.css's
                [class*="grid-cols-2"] mobile safety net, which would
                otherwise silently collapse this to one column on phone. */}
            <div className="px-5 py-3.5 border-b border-slate-100 reports-split-grid gap-3">
              <div className="bg-slate-50 rounded-2xl p-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Jumla Alizotumia</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{activeTenant.currency}{viewingCustomer.totalSpent.toLocaleString()}</p>
              </div>
              <div className={`rounded-2xl p-3 ${viewingCustomer.totalDue > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${viewingCustomer.totalDue > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>Deni</p>
                <p className={`text-sm font-black mt-0.5 ${viewingCustomer.totalDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {viewingCustomer.totalDue > 0 ? `${activeTenant.currency}${Math.round(viewingCustomer.totalDue).toLocaleString()}` : 'Amelipa'}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historia ya Manunuzi</p>
              {[...viewingCustomer.sales]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map(sale => {
                  const due = getSaleDue(sale);
                  return (
                    <div key={sale.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800">
                            {new Date(sale.timestamp).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})}
                            {' · '}
                            {new Date(sale.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <Receipt className="w-3 h-3 shrink-0" /> {sale.reference || sale.id.toUpperCase().slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-slate-900">{activeTenant.currency}{Math.round(sale.amountPaid !== undefined ? sale.amountPaid : (sale.paymentMethod === 'Credit' ? 0 : sale.total)).toLocaleString()}</p>
                        {due > 0 && <p className="text-[9.5px] font-bold text-rose-500">-{activeTenant.currency}{Math.round(due).toLocaleString()} due</p>}
                      </div>
                    </div>
                  );
                })}
              {viewingCustomer.sales.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No purchases recorded yet.</p>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex justify-end shrink-0">
              <button
                onClick={() => setViewingCustomer(null)}
                className="px-6 py-2.5 bg-slate-900 text-white text-[11px] tracking-wider uppercase font-extrabold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer select-none border-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
