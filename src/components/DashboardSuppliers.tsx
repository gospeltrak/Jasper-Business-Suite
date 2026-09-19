import { useState, FormEvent } from 'react';
import { Supplier, Purchase, Sale, Tenant } from '../types';
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
  Store
} from 'lucide-react';

interface DashboardSuppliersProps {
  suppliers: Supplier[];
  onAddSupplier: (sup: Supplier) => void | Promise<boolean>;
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
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const getCustomersList = () => {
    const customersMap: Record<string, { name: string; phone: string; sales: Sale[]; totalSpent: number }> = {};
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
          totalSpent: 0
        };
      }
      customersMap[key].sales.push(s);
      customersMap[key].totalSpent += s.total;
    });
    return Object.values(customersMap)
      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  };

  const filteredSuppliers = suppliers.filter(sup =>
    sup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sup.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sup.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const customerList = getCustomersList();

  return (
    <div id="partners-view" className="space-y-6 p-2 md:p-0">
      {/* HEADER SECTION - NATIVE FEEL */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 p-4 md:p-6 rounded-3xl shadow-sm">
        <div className="text-center sm:text-left space-y-1">
          <h4 className="text-xl font-black text-slate-900 flex items-center justify-center sm:justify-start gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span className="tracking-tight">Partners Directory</span>
          </h4>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Vendor & Client Management
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
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

      {/* FORM - MODAL STYLE FOR MOBILE */}
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

      {/* CONTENT AREA - RESPONSIVE LAYOUT */}
      <div className="min-h-[400px]">
        {activePartnerTab === 'suppliers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map(sup => (
                <div key={sup.id} className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1">
                      {sup.categories.slice(0, 2).map((cat, i) => (
                        <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h6 className="text-sm font-black text-slate-900 truncate">{sup.name}</h6>
                      <p className="text-xs text-slate-500 truncate">{sup.contactPerson || 'No contact person'}</p>
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{sup.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{sup.email}</span>
                      </div>
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
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total Spent</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerList.length > 0 ? (
                    customerList.map((cust, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors group cursor-pointer">
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-slate-400 text-sm">No customers recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE/TABLET CARDS */}
            <div className="md:hidden grid grid-cols-1 gap-4 p-4">
              {customerList.length > 0 ? (
                customerList.map((cust, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-emerald-600 flex items-center justify-center font-bold shadow-sm">
                        {cust.name[0]}
                      </div>
                      <div className="text-left">
                        <h6 className="text-sm font-bold text-slate-900">{cust.name}</h6>
                        <p className="text-xs text-slate-500">{cust.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
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
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="p-6 bg-amber-50 rounded-full text-amber-600">
              <Award className="w-12 h-12" />
            </div>
            <div className="px-4">
              <h5 className="text-lg font-black text-slate-900">Partner Performance Analysis</h5>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Detailed metrics on vendor lead times, fulfillment rates, and client lifetime value are coming soon.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
