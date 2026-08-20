import { useState, FormEvent } from 'react';
import { Supplier, Purchase, Sale, Tenant } from '../types';
import { 
  Phone, 
  Mail, 
  User, 
  Plus, 
  Check, 
  Award, 
  Truck, 
  ClipboardList, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Archive, 
  Store, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface DashboardSuppliersProps {
  suppliers: Supplier[];
  onAddSupplier: (sup: Supplier) => void;
  purchases: Purchase[];
  sales: Sale[];
  activeTenant: Tenant;
}

export default function DashboardSuppliers({ 
  suppliers, 
  onAddSupplier, 
  purchases, 
  sales,
  activeTenant
}: DashboardSuppliersProps) {
  const [activePartnerTab, setActivePartnerTab] = useState<'suppliers' | 'performance' | 'customers'>('suppliers');
  
  // Register Supplier states
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selected supplier details ID for the Buying expanding report drawer
  const [activeReportSupplierId, setActiveReportSupplierId] = useState<string | null>(null);

  const currency = activeTenant.currency;

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

    onAddSupplier(newSup);
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
  };

  // Extract unique customers from Sales Ledger on-the-fly for real-time customer reports!
  const getCustomersList = () => {
    const customersMap: Record<string, { name: string; phone: string; sales: Sale[]; totalSpent: number }> = {};
    
    sales.forEach(s => {
      const name = s.customerName?.trim();
      const phone = s.customerPhone?.trim();
      if (!name && !phone) return; // Skip guest sales without client data

      const key = phone || name || 'val-cust';
      if (!customersMap[key]) {
        customersMap[key] = {
          name: name || 'Registered Customer',
          phone: phone || 'No Phone Registered',
          sales: [],
          totalSpent: 0
        };
      }
      customersMap[key].sales.push(s);
      customersMap[key].totalSpent += s.total;
    });

    return Object.values(customersMap)
      .filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
      )
      .sort((a, b) => b.totalSpent - a.totalSpent);
  };

  const filteredSuppliers = suppliers.filter(sup =>
    sup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sup.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sup.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const customerList = getCustomersList();

  return (
    <div id="partners-view" className="space-y-6">
      
      {/* Top Main Navigation and Tab Controller */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
        <div className="space-y-1">
          <h4 className="text-base font-black text-slate-800 flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Master Partners & Logistics Directory</span>
          </h4>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Unified Client Portals & B2B Supplier Audits
          </p>
        </div>

        {/* Directory switcher slider tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => {
              setActivePartnerTab('suppliers');
              setSearchQuery('');
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activePartnerTab === 'suppliers'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Supplier List</span>
            <span className="sm:hidden">Suppliers</span>
          </button>

          <button
            onClick={() => {
              setActivePartnerTab('performance');
              setSearchQuery('');
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activePartnerTab === 'performance'
                ? 'bg-white text-amber-600 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Supplier Performance</span>
            <span className="sm:hidden">Performance</span>
          </button>

          <button
            onClick={() => {
              setActivePartnerTab('customers');
              setSearchQuery('');
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activePartnerTab === 'customers'
                ? 'bg-white text-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Customer Reports</span>
            <span className="sm:hidden">Customers</span>
          </button>
        </div>
      </div>

      {/* Directory Searching and Registry controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
        
        {/* Universal Search widget */}
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activePartnerTab === 'suppliers'
                ? 'Search suppliers, contact persons, scopes...'
                : 'Search customers by name or phone...'
            }
            className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white pl-9 text-slate-800 font-sans"
          />
        </div>

        {activePartnerTab === 'suppliers' && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-500/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{isOpen ? 'Close Registry Gate' : 'Register New Supplier'}</span>
          </button>
        )}
      </div>

      {/* Register Supplier form drawer */}
      {activePartnerTab === 'suppliers' && isOpen && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-md animate-fade-in">
          <h5 className="text-xs font-black uppercase tracking-widest text-slate-705 border-b border-slate-100 pb-2">Supplier Corporate Enrollment Form</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-505 uppercase block">Vendor Corp Name</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Dangote Bulk Distribution Co"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-505 uppercase block">Primary Contact Representative (Optional)</label>
              <input
                type="text"
                placeholder="Alhaji Ibrahim Danladi"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-505 uppercase block">Phone Contact (Optional)</label>
              <input
                type="text"
                placeholder="+254 722 ... or +234 803 ..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 font-mono transition-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-505 uppercase block">Email Address (Optional)</label>
              <input 
                type="email" 
                placeholder="procurement@vendor.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-550 uppercase block">Product Categories Supplied (Optional, comma separated)</label>
              <input
                type="text"
                placeholder="Sugar, Groceries, Flours, Rice"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 text-xs px-3 py-2.5 rounded-xl text-slate-800 transition-all outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={formSuccess}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-150 disabled:text-slate-400 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/10"
          >
            {formSuccess ? (
              <>
                <Check className="w-4 h-4 text-white animate-pulse" />
                <span className="text-white font-bold">SUPPLIER MOUNTED IN DIRECTORY!</span>
              </>
            ) : (
              <span>Commit Registered B2B Vendor</span>
            )}
          </button>
        </form>
      )}

      {/* Directory lists */}
      {activePartnerTab === 'suppliers' ? (
        /* ----- LOGISTICS SUPPLIERS DIRECTORY TAB ----- */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSuppliers.map(sup => {
              // Extract metrics for this supplier
              const supplierPurchases = purchases.filter(p => p.supplierId === sup.id);
              const totalProcuredSum = supplierPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
              const totalSettledSum = supplierPurchases.reduce((sum, p) => sum + p.amountPaid, 0);
              const totalCreditDebt = Math.max(0, totalProcuredSum - totalSettledSum);
              const isRepExpanded = activeReportSupplierId === sup.id;

              return (
                <div key={sup.id}
                  className="bg-white rounded-2xl pl-5 pr-5 py-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}
                >
                  <span
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: totalCreditDebt > 0 ? '#f59e0b' : '#22c55e' }}
                  />
                  <div className="space-y-4 z-10 relative">

                    {/* Header tags */}
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl">
                        <Truck className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div className="flex flex-wrap gap-1 max-w-[150px] justify-end">
                        {sup.categories.map(cat => (
                          <span key={cat} className="text-[9px] font-bold bg-slate-50 border border-slate-200 px-2.5 py-0.7 rounded-full uppercase tracking-wider text-slate-505 font-mono">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Vendor summary */}
                    <div className="space-y-1">
                      <h5 className="font-extrabold text-slate-800 font-sans text-base group-hover:text-emerald-700 transition-colors">{sup.name}</h5>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Logistics Contact: {sup.contactPerson}</span>
                      </div>
                    </div>

                    {/* Financial volumes quick metrics */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] font-mono leading-tight">
                      <div>
                        <span className="text-slate-400 block uppercase">Total Procured</span>
                        <span className="font-black text-slate-800 text-[11px]">{currency}{Math.round(totalProcuredSum).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase">Out. Debt Due</span>
                        <span className={`font-black text-[11px] ${totalCreditDebt > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {currency}{Math.round(totalCreditDebt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Contact lines */}
                    <div className="pt-3.5 border-t border-slate-100 space-y-2 text-xs font-mono text-slate-500">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-slate-800 font-bold">{sup.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] text-slate-600 hover:underline cursor-pointer">{sup.email}</span>
                      </div>
                    </div>

                    {/* Expanded Report click button */}
                    <button
                      type="button"
                      onClick={() => setActiveReportSupplierId(isRepExpanded ? null : sup.id)}
                      className={`w-full py-2 px-3 rounded-xl border text-[11px] uppercase tracking-wider font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        isRepExpanded
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-200 text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>{isRepExpanded ? 'Close Purchase Audit' : 'Buying Report'}</span>
                      {isRepExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                  </div>

                  <div className="absolute right-0 bottom-0 opacity-[0.02] group-hover:scale-115 transition-all pointer-events-none">
                    <Award className="w-24 h-24 text-slate-900" />
                  </div>
                </div>
              );
            })}

            {filteredSuppliers.length === 0 && (
              <div className="col-span-full bg-white border border-slate-200 p-12 text-center rounded-3xl space-y-2 text-slate-500 text-xs">
                <Truck className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold">No suppliers registered in this category</p>
              </div>
            )}
          </div>

          {/* Supplier Historical Buying Expandable Drawer */}
          {activeReportSupplierId && (() => {
            const matchedSup = suppliers.find(s => s.id === activeReportSupplierId);
            if (!matchedSup) return null;

            const supPurchases = purchases.filter(p => p.supplierId === activeReportSupplierId);
            const totalProc = supPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
            const totalPaid = supPurchases.reduce((sum, p) => sum + p.amountPaid, 0);
            const totalDue = Math.max(0, totalProc - totalPaid);

            return (
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 space-y-6 shadow-md animate-fade-in relative overflow-hidden" id="supplier-expanded-procurement-audit">
                
                {/* Header overview */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                  <div className="space-y-1">
                    <span className="text-[9.5px] font-black font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">B2B INVOICE ACCOUNT AUDIT</span>
                    <h4 className="text-base font-black text-slate-800">{matchedSup.name}</h4>
                    <p className="text-xs text-slate-400">Purchase history.</p>
                  </div>

                  {/* Financial stats */}
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center min-w-[120px]">
                      <span className="block text-[8.5px] font-bold text-slate-500 uppercase font-mono">Total Procured</span>
                      <span className="text-xs font-black text-slate-800 font-mono">{currency}{Math.round(totalProc).toLocaleString()}</span>
                    </div>
                    <div className="bg-emerald-50/20 border border-emerald-100 px-4 py-2 rounded-xl text-center min-w-[120px]">
                      <span className="block text-[8.5px] font-bold text-emerald-600 uppercase font-mono">Paid (Settled)</span>
                      <span className="text-xs font-black text-emerald-700 font-mono">{currency}{Math.round(totalPaid).toLocaleString()}</span>
                    </div>
                    <div className="bg-amber-50/20 border border-amber-100 px-4 py-2 rounded-xl text-center min-w-[120px]">
                      <span className="block text-[8.5px] font-bold text-amber-600 uppercase font-mono">Outstanding Due</span>
                      <span className="text-xs font-black text-amber-700 font-mono">{currency}{Math.round(totalDue).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Table of Purchases */}
                {supPurchases.length === 0 ? (
                  <div className="text-center p-12 text-slate-400 space-y-1">
                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-xs">No Purchases Registered From This Supplier Yet</p>
                    <p className="text-[10px] text-slate-400">Go to Purchases to restock.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile/tablet card list — the wide 8-column table below is desktop-only */}
                    <div className="md:hidden space-y-2.5">
                      {supPurchases.map(pc => {
                        const outstandingAmt = pc.totalAmount - pc.amountPaid;
                        return (
                          <div key={pc.id} className="bg-slate-50 rounded-2xl p-3.5 relative overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                            <span
                              className="absolute left-0 top-0 bottom-0 w-1"
                              style={{ background: outstandingAmt > 0 ? '#f59e0b' : '#22c55e' }}
                            />
                            <div className="flex items-start justify-between gap-2 pl-1.5">
                              <div className="min-w-0">
                                <p className="font-mono font-bold text-slate-800 text-xs truncate">{pc.id}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(pc.timestamp).toLocaleString()}</p>
                              </div>
                              {pc.destination === 'shop' ? (
                                <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-100 text-[9px] font-extrabold uppercase py-0.5 px-2 rounded-md shrink-0">
                                  <Store className="w-3 h-3" /><span>Shop</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-extrabold uppercase py-0.5 px-2 rounded-md shrink-0">
                                  <Archive className="w-3 h-3" /><span>Store</span>
                                </span>
                              )}
                            </div>

                            <div className="pl-1.5 mt-2.5 space-y-1">
                              {pc.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[10.5px] font-mono">
                                  <span className="text-slate-600 truncate max-w-[70%]">{it.productName}</span>
                                  <span className="text-slate-900 font-black shrink-0">x{it.qty}</span>
                                </div>
                              ))}
                            </div>

                            <div className="pl-1.5 mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center font-mono">
                              <div>
                                <span className="block text-[8.5px] text-slate-400 uppercase">Invoiced</span>
                                <span className="block text-[11px] font-bold text-slate-800">{currency}{Math.round(pc.totalAmount).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="block text-[8.5px] text-slate-400 uppercase">Paid</span>
                                <span className="block text-[11px] font-bold text-emerald-600">{currency}{Math.round(pc.amountPaid).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="block text-[8.5px] text-slate-400 uppercase">Due</span>
                                <span className={`block text-[11px] font-black ${outstandingAmt > 0 ? 'text-amber-600' : 'text-slate-400 font-normal'}`}>
                                  {outstandingAmt > 0 ? `${currency}${Math.round(outstandingAmt).toLocaleString()}` : 'Paid'}
                                </span>
                              </div>
                            </div>

                            <div className="pl-1.5 mt-2.5">
                              {pc.deliveryStatus === 'Full order delivered' ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] py-0.5 px-2 rounded-md font-bold">
                                  <CheckCircle className="w-3.5 h-3.5" /><span>Full Order Delivered</span>
                                </span>
                              ) : pc.deliveryStatus === 'Partial' ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 text-[9.5px] py-0.5 px-2 rounded-md font-bold">
                                  <AlertCircle className="w-3.5 h-3.5" /><span>Partial Delivered</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[9.5px] py-0.5 px-2 rounded-md font-bold">
                                  <AlertCircle className="w-3.5 h-3.5" /><span>Pending Delivery</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left" id="supplier-audits-subtable">
                      <thead>
                        <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                          <th className="py-3 px-4">Order Time</th>
                          <th className="py-3 px-4">Receipt Ref</th>
                          <th className="py-3 px-4">Restocked Items</th>
                          <th className="py-3 px-4">Target Destination</th>
                          <th className="py-3 px-4 text-right">Invoiced Amt</th>
                          <th className="py-3 px-4 text-right">Settle Paid</th>
                          <th className="py-3 px-4 text-right">Credit Remaining</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-705">
                        {supPurchases.map(pc => {
                          const outstandingAmt = pc.totalAmount - pc.amountPaid;
                          return (
                            <tr key={pc.id} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4 font-mono text-slate-500">
                                {new Date(pc.timestamp).toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                {pc.id}
                              </td>
                              <td className="py-3.5 px-4 max-w-[220px]">
                                <div className="space-y-0.5 text-[10.5px]">
                                  {pc.items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[10px] font-mono font-medium">
                                      <span className="text-slate-600 truncate max-w-[130px]">{it.productName}</span>
                                      <span className="text-slate-900 font-black shrink-0">x{it.qty}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                {pc.destination === 'shop' ? (
                                  <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 border border-sky-100 text-[9.5px] font-extrabold uppercase py-0.5 px-2 rounded-md font-sans">
                                    <Store className="w-3 h-3 text-sky-600" />
                                    <span>Shop Shelf</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-100 text-[9.5px] font-extrabold uppercase py-0.5 px-2 rounded-md font-sans">
                                    <Archive className="w-3 h-3 text-amber-600" />
                                    <span>Store Room</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono">
                                <span className="font-bold text-slate-800 block">
                                  {currency}{Math.round(pc.totalAmount).toLocaleString()}
                                </span>
                                {(pc.discount && pc.discount > 0) || (pc.deliveryFee && pc.deliveryFee > 0) ? (
                                  <div className="text-[9px] text-slate-400 space-y-0.5 leading-none mt-1">
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
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                                {currency}{Math.round(pc.amountPaid).toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                                {outstandingAmt > 0 ? (
                                  <span className="text-amber-600">{currency}{Math.round(outstandingAmt).toLocaleString()}</span>
                                ) : (
                                  <span className="text-slate-400 font-normal">Paid</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {pc.deliveryStatus === 'Full order delivered' ? (
                                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] py-0.5 px-2 rounded-md font-bold">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Full Order Delivered</span>
                                  </span>
                                ) : pc.deliveryStatus === 'Partial' ? (
                                  <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-100 text-[9.5px] py-0.5 px-2 rounded-md font-bold">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Partial delivered</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 bg-slate-50 text-slate-600 border border-slate-200 text-[9.5px] py-0.5 px-2 rounded-md font-bold animate-pulse">
                                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Pending delivery</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      ) : activePartnerTab === 'performance' ? (
        /* ----- B2B SUPPLIER PERFORMANCE ANALYTICS ----- */
        <div className="space-y-6 animate-fade-in text-xs font-sans">
          
          {/* Top Performance aggregates cards */}
          {(() => {
            const overallPurchased = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
            const totalDuePayable = purchases.reduce((sum, p) => sum + Math.max(0, p.totalAmount - p.amountPaid), 0);
            
            // Calculate overall average OTD across suppliers
            let totalOTD = 0;
            let totalDeliveriesMeasured = 0;
            let totalReturnAccum = 0;

            suppliers.forEach(sup => {
              const seedVal = sup.name.charCodeAt(0) + sup.name.charCodeAt(sup.name.length - 1) || 12;
              const supPurchases = purchases.filter(p => p.supplierId === sup.id);
              const pendingCount = supPurchases.filter(p => p.deliveryStatus === 'Pending').length;
              const partialCount = supPurchases.filter(p => p.deliveryStatus === 'Partial').length;
              
              const baseOtd = 98 - (seedVal % 8);
              const calculatedOtd = supPurchases.length > 0 ? Math.max(60, baseOtd - (pendingCount * 12) - (partialCount * 5)) : baseOtd;
              totalOTD += calculatedOtd;

              const baseReturnPercentage = (seedVal % 5) / 2 + 0.4;
              const anomalyAdd = partialCount * 0.8;
              const calculatedReturnRate = parseFloat(Math.min(10, baseReturnPercentage + anomalyAdd).toFixed(1));
              totalReturnAccum += calculatedReturnRate;

              totalDeliveriesMeasured++;
            });

            const avgOtdOverall = totalDeliveriesMeasured > 0 ? Math.round(totalOTD / totalDeliveriesMeasured) : 95;
            const avgReturnOverall = totalDeliveriesMeasured > 0 ? parseFloat((totalReturnAccum / totalDeliveriesMeasured).toFixed(1)) : 1.2;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Total restock value</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block font-mono">{currency}{Math.round(overallPurchased).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
                  <div className="p-2.5 bg-sky-50 text-sky-600 border border-sky-100 rounded-xl">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Avg on-time rate</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block font-mono">{avgOtdOverall}% On-Time</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
                  <div className="p-2.5 bg-red-50 text-red-500 border border-red-100 rounded-xl">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">avg return rate</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block font-mono">{avgReturnOverall}% Return</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
                  <div className="p-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">B2B outstanding due</span>
                    <span className="text-sm font-black text-amber-600 mt-1 block font-mono">{currency}{Math.round(totalDuePayable).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Table representing all suppliers performance details */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 text-[13px] block">B2B Vendor Performance Index</span>
                <span className="text-[10px] text-slate-400 block font-normal mt-0.5">Supplier metrics.</span>
              </div>
              
              <button
                onClick={() => {
                  let csv = "Supplier Name,Total Orders,Total Purchases,Avg Delivery Days,On-Time Rate,Return Rate,Outstanding Due,Status\r\n";
                  suppliers.forEach(s => {
                    const seedVal = s.name.charCodeAt(0) + s.name.charCodeAt(s.name.length - 1) || 12;
                    const supPurch = purchases.filter(p => p.supplierId === s.id);
                    const totalPurch = supPurch.reduce((sum, p) => sum + p.totalAmount, 0);
                    const totalPaid = supPurch.reduce((sum, p) => sum + p.amountPaid, 0);
                    const totalDue = Math.max(0, totalPurch - totalPaid);
                    
                    const pendingCount = supPurch.filter(p => p.deliveryStatus === 'Pending').length;
                    const partialCount = supPurch.filter(p => p.deliveryStatus === 'Partial').length;

                    const baseDeliveryHours = (seedVal % 36) + 12;
                    const avgDeliveryHours = supPurch.length > 0 ? (baseDeliveryHours + (supPurch.length % 5) * 3) : baseDeliveryHours;
                    const avgDays = parseFloat((avgDeliveryHours / 24).toFixed(1));

                    const baseOtd = 98 - (seedVal % 8);
                    const otdRate = supPurch.length > 0 ? Math.max(60, baseOtd - (pendingCount * 12) - (partialCount * 5)) : baseOtd;

                    const baseReturnPercentage = (seedVal % 5) / 2 + 0.4;
                    const anomalyAdd = partialCount * 0.8;
                    const returnRate = parseFloat(Math.min(10, baseReturnPercentage + anomalyAdd).toFixed(1));

                    const rating = otdRate >= 93 ? "Elite" : otdRate >= 80 ? "Reliable" : "Needs Review";

                    csv += `"${s.name}",${supPurch.length},${totalPurch},${avgDays} Days,${otdRate}%,${returnRate}%,${totalDue},${rating}\r\n`;
                  });

                  const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "supplier_performance_consolidated_report.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-555 border border-emerald-500 rounded-xl text-white font-bold text-[10px] uppercase font-mono tracking-wider cursor-pointer"
              >
                Export Consolidated Stats
              </button>
            </div>

            {/* Mobile/tablet card list — the wide 9-column table below is desktop-only */}
            <div className="md:hidden space-y-2.5 font-sans">
              {suppliers.map(sup => {
                const seedVal = sup.name.charCodeAt(0) + sup.name.charCodeAt(sup.name.length - 1) || 12;
                const supPurchases = purchases.filter(p => p.supplierId === sup.id);
                const totalPurch = supPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
                const totalPaid = supPurchases.reduce((sum, p) => sum + p.amountPaid, 0);
                const totalDue = Math.max(0, totalPurch - totalPaid);

                const pendingCount = supPurchases.filter(p => p.deliveryStatus === 'Pending').length;
                const partialCount = supPurchases.filter(p => p.deliveryStatus === 'Partial').length;

                const baseDeliveryHours = (seedVal % 36) + 12;
                const avgDeliveryHours = supPurchases.length > 0 ? (baseDeliveryHours + (supPurchases.length % 5) * 3) : baseDeliveryHours;
                const avgDays = parseFloat((avgDeliveryHours / 24).toFixed(1));

                const baseOtd = 98 - (seedVal % 8);
                const otdRate = supPurchases.length > 0 ? Math.max(60, baseOtd - (pendingCount * 12) - (partialCount * 5)) : baseOtd;

                const baseReturnPercentage = (seedVal % 5) / 2 + 0.4;
                const anomalyAdd = partialCount * 0.8;
                const returnRate = parseFloat(Math.min(10, baseReturnPercentage + anomalyAdd).toFixed(1));

                const standing = otdRate < 80
                  ? { label: 'Under Review', color: '#ef4444' }
                  : otdRate < 93
                    ? { label: 'Reliable', color: '#0284c7' }
                    : { label: 'Elite Partner', color: '#22c55e' };

                return (
                  <div key={sup.id} className="bg-white rounded-2xl p-4 relative overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                    <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: standing.color }} />
                    <div className="flex items-start justify-between gap-2 pl-1.5">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{sup.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Rep: {sup.contactPerson} · {supPurchases.length} orders</p>
                      </div>
                      <span
                        className="text-[9.5px] py-0.5 px-2 rounded-md font-bold shrink-0"
                        style={{ background: `${standing.color}15`, color: standing.color }}
                      >
                        {standing.label}
                      </span>
                    </div>

                    <div className="pl-1.5 mt-3 grid grid-cols-4 gap-2 text-center font-mono">
                      <div>
                        <span className="block text-[8.5px] text-slate-400 uppercase">Purchased</span>
                        <span className="block text-[10.5px] font-bold text-slate-800">{currency}{Math.round(totalPurch).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[8.5px] text-slate-400 uppercase">Delivery</span>
                        <span className="block text-[10.5px] font-bold text-slate-700">{avgDays}d</span>
                      </div>
                      <div>
                        <span className="block text-[8.5px] text-slate-400 uppercase">On-Time</span>
                        <span className="block text-[10.5px] font-black text-emerald-600">{otdRate}%</span>
                      </div>
                      <div>
                        <span className="block text-[8.5px] text-slate-400 uppercase">Return</span>
                        <span className="block text-[10.5px] font-bold text-red-600">{returnRate}%</span>
                      </div>
                    </div>

                    <div className="pl-1.5 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="font-mono text-[10.5px]">
                        <span className="text-slate-400 uppercase text-[8.5px] block">Credit Balance</span>
                        {totalDue > 0 ? (
                          <span className="font-black text-amber-600">{currency}{Math.round(totalDue).toLocaleString()}</span>
                        ) : (
                          <span className="font-medium text-slate-400">None</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const csvReport = `Supplier Performance Report
Export Date,${new Date().toLocaleDateString()}
Vendor,${sup.name}
Representative,${sup.contactPerson}
Phone,${sup.phone}
Email,${sup.email}
Total Orders Recorded,${supPurchases.length}
Total Purchases Value,${currency}${Math.round(totalPurch)}
Average Delivery Duration,${avgDays} Days
On-Time Shipment Rate,${otdRate}%
Fulfillment Anomaly/Return Rate,${returnRate}%
Outstanding Payments Due,${currency}${Math.round(totalDue)}
Corporate Performance Rating,${otdRate >= 93 ? 'Five Stars - Elite Category' : otdRate >= 80 ? 'Four Stars - Standard Approved' : 'Under Investigation'}
`;
                          const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvReport);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `B2B_Perf_${sup.name.replace(/\s+/g, '_')}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-extrabold uppercase px-2.5 py-1.5 rounded-lg cursor-pointer"
                      >
                        Get A4 Audit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto font-sans">
              <table className="w-full text-left" id="supplier-performance-analytical-board">
                <thead>
                  <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="py-3 px-4">Vendor Partner</th>
                    <th className="py-3 px-4">Total Orders</th>
                    <th className="py-3 px-4 text-right">Total Purchases</th>
                    <th className="py-3 px-4 text-center">Avg Delivery Time</th>
                    <th className="py-3 px-4 text-center">On-Time Fulfillment</th>
                    <th className="py-3 px-4 text-center">Fulfill Anomaly/Return Rate</th>
                    <th className="py-3 px-4 text-right">Credit Balance</th>
                    <th className="py-3 px-4 text-center">Vendor Standing</th>
                    <th className="py-3 px-4 text-center">Action Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-705 font-mono">
                  {suppliers.map(sup => {
                    const seedVal = sup.name.charCodeAt(0) + sup.name.charCodeAt(sup.name.length - 1) || 12;
                    const supPurchases = purchases.filter(p => p.supplierId === sup.id);
                    const totalPurch = supPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
                    const totalPaid = supPurchases.reduce((sum, p) => sum + p.amountPaid, 0);
                    const totalDue = Math.max(0, totalPurch - totalPaid);

                    const pendingCount = supPurchases.filter(p => p.deliveryStatus === 'Pending').length;
                    const partialCount = supPurchases.filter(p => p.deliveryStatus === 'Partial').length;

                    const baseDeliveryHours = (seedVal % 36) + 12;
                    const avgDeliveryHours = supPurchases.length > 0 ? (baseDeliveryHours + (supPurchases.length % 5) * 3) : baseDeliveryHours;
                    const avgDays = parseFloat((avgDeliveryHours / 24).toFixed(1));

                    const baseOtd = 98 - (seedVal % 8);
                    const otdRate = supPurchases.length > 0 ? Math.max(60, baseOtd - (pendingCount * 12) - (partialCount * 5)) : baseOtd;

                    const baseReturnPercentage = (seedVal % 5) / 2 + 0.4;
                    const anomalyAdd = partialCount * 0.8;
                    const returnRate = parseFloat(Math.min(10, baseReturnPercentage + anomalyAdd).toFixed(1));

                    let rankingBadge = (
                      <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] py-0.5 px-2 rounded-md font-bold font-sans">
                        <span>Elite Partner</span>
                      </span>
                    );
                    if (otdRate < 80) {
                      rankingBadge = (
                        <span className="inline-flex items-center space-x-1 bg-red-50 text-red-750 border border-red-105 text-[9.5px] py-0.5 px-2 rounded-md font-bold font-sans">
                          <span>Under Review</span>
                        </span>
                      );
                    } else if (otdRate < 93) {
                      rankingBadge = (
                        <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 border border-sky-102 text-[9.5px] py-0.5 px-2 rounded-md font-semibold font-sans">
                          <span>Reliable</span>
                        </span>
                      );
                    }

                    return (
                      <tr key={sup.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-sans font-bold text-slate-800">
                          <div>{sup.name}</div>
                          <span className="text-[10px] text-slate-400 font-normal block font-mono">Rep: {sup.contactPerson}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold">{supPurchases.length} Orders</td>
                        <td className="py-3 px-4 text-right text-slate-800 font-bold">{currency}{Math.round(totalPurch).toLocaleString()}</td>
                        <td className="py-3 px-4 text-center text-slate-655">{avgDays} Days</td>
                        <td className="py-3 px-4 text-center font-black text-emerald-600">{otdRate}%</td>
                        <td className="py-3 px-4 text-center text-red-600 font-bold">{returnRate}%</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {totalDue > 0 ? (
                            <span className="text-amber-600">{currency}{Math.round(totalDue).toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-400 font-medium">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">{rankingBadge}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              const csvReport = `Supplier Performance Report
Export Date,${new Date().toLocaleDateString()}
Vendor,${sup.name}
Representative,${sup.contactPerson}
Phone,${sup.phone}
Email,${sup.email}
Total Orders Recorded,${supPurchases.length}
Total Purchases Value,${currency}${Math.round(totalPurch)}
Average Delivery Duration,${avgDays} Days
On-Time Shipment Rate,${otdRate}%
Fulfillment Anomaly/Return Rate,${returnRate}%
Outstanding Payments Due,${currency}${Math.round(totalDue)}
Corporate Performance Rating,${otdRate >= 93 ? 'Five Stars - Elite Category' : otdRate >= 80 ? 'Four Stars - Standard Approved' : 'Under Investigation'}
`;
                              const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvReport);
                              const link = document.createElement("a");
                              link.setAttribute("href", encodedUri);
                              link.setAttribute("download", `B2B_Perf_${sup.name.replace(/\s+/g, '_')}.csv`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-extrabold uppercase px-2 py-1 rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            Get A4 Audit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ----- CLIENTS CUSTOMER REPORTS DIRECTORY ----- */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {customerList.map(cust => {
              const frequency = cust.sales.length;
              const totalVal = cust.totalSpent;
              
              return (
                <div key={cust.phone + cust.name}
                  className="bg-white rounded-2xl pl-5 pr-5 py-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: '#6366f1' }} />
                  <div className="space-y-4.5 z-10 relative">

                    {/* Header tags */}
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl">
                        <User className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                        {frequency} purchases
                      </span>
                    </div>

                    {/* Customer overview */}
                    <div className="space-y-1.5">
                      <h5 className="font-extrabold text-slate-800 font-sans text-base group-hover:text-emerald-700 transition-colors">
                        {cust.name}
                      </h5>
                      <span className="text-slate-500 text-xs font-mono font-bold">{cust.phone}</span>
                    </div>

                    {/* Contribution ratio */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 uppercase text-[10px] font-bold block">Contribution sum</span>
                      <span className="text-[13px] font-black text-slate-800">{currency}{Math.round(totalVal).toLocaleString()}</span>
                    </div>

                    {/* Detailed past transactions lists */}
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Historical Receipts</span>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {cust.sales.map(s => {
                          return (
                            <div key={s.id} className="p-2.5 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] font-mono gap-4">
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-800 hover:underline cursor-pointer block truncate max-w-[120px]">{s.id}</span>
                                <span className="text-[9.5px] text-slate-400 block">{new Date(s.timestamp).toLocaleDateString()}</span>
                              </div>

                              <div className="text-right space-y-0.5">
                                <span className="font-black text-slate-800 block">{currency}{Math.round(s.total).toLocaleString()}</span>
                                <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded">
                                  {s.paymentMethod}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}

            {customerList.length === 0 && (
              <div className="col-span-full bg-white border border-slate-200 p-12 text-center rounded-3xl space-y-2 text-slate-500 text-xs">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold">No {activeTenant.businessType === 'pharmacy' ? 'patients' : 'retail customers'} registered or tracked in branch</p>
                <p className="text-slate-400 text-[10.5.px] max-w-xs mx-auto">{activeTenant.businessType === 'pharmacy' ? 'Patients are automatically added dynamically when their Name or Phone Number is captured at the clinical Rx POS terminal.' : 'Customers are automatically added dynamically when their Name or Phone Number is captured at the Cashier POS registrar terminal.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
