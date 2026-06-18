import React, { useState } from 'react';
import { useMicroSoko } from './MicroSokoContext';
import { loadDemoData, clearDemoData, hasDemoData } from './microSokoDemoData';
import { Building2, Palette, PackageSearch, Scale, Replace, CreditCard, ShoppingCart, Tags, Settings2, Plus, Save, X, Edit2, CheckCircle, Database, Factory } from 'lucide-react';
import { MsBusinessSettings, MsBrandingSettings, MsExpenseCategory, MsItem, MsUnit, MsPaymentMethod, MsConversion, MsRecipe, MsRecipeMaterial } from './MicroSokoTypes';

export const MicroSokoSettings: React.FC = () => {
  const ctx = useMicroSoko();
  const { 
    businessSettings, setBusinessSettings, 
    brandingSettings, setBrandingSettings,
    units, setUnits, conversions, setConversions,
    paymentMethods, setPaymentMethods,
    expenseCategories, setExpenseCategories,
    items, addItem, updateItem,
    recipes, addRecipe, updateRecipe, deleteRecipe
  } = ctx;

  const [activeTab, setActiveTab] = useState<'business' | 'branding' | 'items' | 'recipes' | 'units' | 'conversions' | 'payments' | 'selling_method' | 'expenses' | 'pos' | 'demo'>('business');

  const tabs = [
    { id: 'business', label: 'Business Setup', icon: Building2 },
    { id: 'branding', label: 'Branding Settings', icon: Palette },
    { id: 'items', label: 'Items Setup', icon: PackageSearch },
    { id: 'recipes', label: 'Production Recipes', icon: Factory },
    { id: 'units', label: 'Units Setup', icon: Scale },
    { id: 'conversions', label: 'Unit Conversions', icon: Replace },
    { id: 'payments', label: 'Payment Methods', icon: CreditCard },
    { id: 'selling_method', label: 'Selling Method', icon: ShoppingCart },
    { id: 'expenses', label: 'Expense Categories', icon: Tags },
    { id: 'pos', label: 'POS Product Settings', icon: Settings2 },
    { id: 'demo', label: 'Demo Data', icon: Database }
  ] as const;

  return (
    <div className="flex h-full flex-col font-sans">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">Settings</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Configure your MicroSoko</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Settings Sidebar */}
        <div className="md:w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto">
          <div className="p-4 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center p-3 rounded-xl transition-all ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <tab.icon className={`w-5 h-5 mr-3 ${activeTab === tab.id ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="font-bold text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white">
          <div className="max-w-3xl mx-auto space-y-8">
            {activeTab === 'business' && (
              <BusinessSetupTab settings={businessSettings} onSave={setBusinessSettings} />
            )}
            {activeTab === 'branding' && (
              <BrandingSetupTab settings={brandingSettings} onSave={setBrandingSettings} />
            )}
            {activeTab === 'units' && (
              <UnitsSetupTab units={units} onSave={setUnits} />
            )}
            {activeTab === 'payments' && (
              <PaymentMethodsTab methods={paymentMethods} onSave={setPaymentMethods} />
            )}
            {activeTab === 'expenses' && (
              <ExpenseCategoriesTab categories={expenseCategories} onSave={setExpenseCategories} />
            )}
            {activeTab === 'selling_method' && (
              <SellingMethodTab settings={businessSettings} onSave={setBusinessSettings} />
            )}
            {activeTab === 'pos' && (
              <PosSettingsTab items={items} onUpdate={updateItem} />
            )}
            {activeTab === 'items' && (
              <ItemsSetupTab items={items} units={units} onAdd={addItem} onUpdate={updateItem} />
            )}
            {activeTab === 'recipes' && (
              <RecipesSetupTab recipes={recipes} items={items} units={units} addRecipe={addRecipe} updateRecipe={updateRecipe} deleteRecipe={deleteRecipe} />
            )}
            {activeTab === 'conversions' && (
              <ConversionsSetupTab conversions={conversions} items={items} units={units} onSave={setConversions} />
            )}
            {activeTab === 'demo' && (
              <DemoDataTab ctx={ctx} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 10. Demo Data Settings
const DemoDataTab = ({ ctx }: { ctx: any }) => {
  const isDemoLoaded = hasDemoData(ctx);

  const [confirmLoad, setConfirmLoad] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleLoadDemo = () => {
    if (!confirmLoad) {
      setConfirmLoad(true);
      setTimeout(() => setConfirmLoad(false), 3000);
      return;
    }
    loadDemoData(ctx);
    setConfirmLoad(false);
  };

  const handleClearDemo = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearDemoData(ctx);
    setConfirmClear(false);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-slate-800 border-b pb-2">Demo Data</h3>
      <p className="text-slate-600 text-sm mb-4">
        Load optional test product batches, units, active sales, metrics, and more, strictly tagged as sample records. Helps new users orient to MicroSoko setup.
      </p>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h4 className="font-bold text-slate-800 mb-2">Demo Data Status</h4>
        <div className="flex items-center space-x-2 mb-6">
          <div className={`w-3 h-3 rounded-full ${isDemoLoaded ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
          <span className="text-sm font-semibold text-slate-600">{isDemoLoaded ? 'Demo Data is Currently Loaded' : 'No Demo Data Available'}</span>
        </div>

        <div className="flex space-x-4">
           <button 
             disabled={isDemoLoaded}
             onClick={handleLoadDemo} 
             className={`px-6 py-3 rounded-xl font-bold flex items-center transition-colors ${
               isDemoLoaded ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : (confirmLoad ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800')
             }`}
           >
             <Database className="w-5 h-5 mr-2" /> {confirmLoad ? 'Click again to confirm' : 'Load Demo Data'}
           </button>
           
           <button 
             disabled={!isDemoLoaded}
             onClick={handleClearDemo} 
             className={`px-6 py-3 rounded-xl font-bold flex items-center transition-colors ${
               !isDemoLoaded ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : (confirmClear ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200')
             }`}
           >
             <X className="w-5 h-5 mr-2" /> {confirmClear ? 'Click again to confirm' : 'Clear Demo Data'}
           </button>
        </div>
      </div>
    </div>
  );
};

// 1. Business Setup
const BusinessSetupTab = ({ settings, onSave }: { settings: MsBusinessSettings, onSave: (s: MsBusinessSettings) => void }) => {
  const [formData, setFormData] = useState(settings);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-slate-800 border-b pb-2">Business Setup</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Business Name</label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Owner Name</label>
          <input type="text" value={formData.ownerName} onChange={e => setFormData({ ...formData, ownerName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Phone Number</label>
          <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Email <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Business Address</label>
          <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Region / City</label>
          <input type="text" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Currency</label>
          <input type="text" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" placeholder="TZS" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tax Identification Number (TIN) <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input type="text" value={formData.tin || ''} onChange={e => setFormData({ ...formData, tin: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Business Registration (VRN) <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input type="text" value={formData.vrn || ''} onChange={e => setFormData({ ...formData, vrn: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={() => onSave(formData)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-slate-800">
          <Save className="w-4 h-4 mr-2" /> Save Business Setup
        </button>
      </div>
    </div>
  );
};

// 2. Branding Settings
const BrandingSetupTab = ({ settings, onSave }: { settings: MsBrandingSettings, onSave: (s: MsBrandingSettings) => void }) => {
  const [formData, setFormData] = useState(settings);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-slate-800 border-b pb-2">Branding Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Dashboard Theme Color</label>
          <div className="flex items-center space-x-2">
            <input type="color" value={formData.themeColor} onChange={e => setFormData({ ...formData, themeColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
            <input type="text" value={formData.themeColor} onChange={e => setFormData({ ...formData, themeColor: e.target.value })} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Secondary Theme Color <span className="text-slate-400 font-normal">(Optional)</span></label>
          <div className="flex items-center space-x-2">
            <input type="color" value={formData.secondaryColor || '#ffffff'} onChange={e => setFormData({ ...formData, secondaryColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
            <input type="text" value={formData.secondaryColor || ''} onChange={e => setFormData({ ...formData, secondaryColor: e.target.value })} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Receipt Header Name</label>
          <input type="text" value={formData.receiptHeader} onChange={e => setFormData({ ...formData, receiptHeader: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Receipt Footer Message</label>
          <input type="text" value={formData.receiptFooter} onChange={e => setFormData({ ...formData, receiptFooter: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Business Slogan <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input type="text" value={formData.slogan || ''} onChange={e => setFormData({ ...formData, slogan: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">WhatsApp Number <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input type="tel" value={formData.whatsapp || ''} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Website / Social Media Link <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input type="url" value={formData.website || ''} onChange={e => setFormData({ ...formData, website: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" />
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={() => onSave(formData)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-slate-800">
          <Save className="w-4 h-4 mr-2" /> Save Branding Settings
        </button>
      </div>
    </div>
  );
};

// 7. Selling Method Settings
const SellingMethodTab = ({ settings, onSave }: { settings: MsBusinessSettings, onSave: (s: MsBusinessSettings) => void }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-slate-800 border-b pb-2">Selling Method Settings</h3>
      <p className="text-slate-600 text-sm">Choose the default costing and batch selection method for your items when making sales.</p>
      
      <div className="space-y-3">
        <label onClick={() => onSave({ ...settings, defaultSellingMethod: 'fifo' })} className={`p-4 border rounded-xl flex items-start cursor-pointer transition-colors ${settings.defaultSellingMethod === 'fifo' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
          <input type="radio" checked={settings.defaultSellingMethod === 'fifo'} readOnly className="mt-1 mr-3" />
          <div>
            <div className="font-bold text-slate-800">FIFO (First In, First Out) <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded ml-2">Recommended</span></div>
            <div className="text-sm text-slate-500 mt-1">Stock ya zamani inauzwa kwanza.</div>
          </div>
        </label>
        
        <label onClick={() => onSave({ ...settings, defaultSellingMethod: 'average_cost' })} className={`p-4 border rounded-xl flex items-start cursor-pointer transition-colors ${settings.defaultSellingMethod === 'average_cost' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
          <input type="radio" checked={settings.defaultSellingMethod === 'average_cost'} readOnly className="mt-1 mr-3" />
          <div>
            <div className="font-bold text-slate-800">Average Cost</div>
            <div className="text-sm text-slate-500 mt-1">Mfumo unatumia wastani wa gharama badala ya batch maalum.</div>
          </div>
        </label>
        
        <label onClick={() => onSave({ ...settings, defaultSellingMethod: 'manual' })} className={`p-4 border rounded-xl flex items-start cursor-pointer transition-colors ${settings.defaultSellingMethod === 'manual' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
          <input type="radio" checked={settings.defaultSellingMethod === 'manual'} readOnly className="mt-1 mr-3" />
          <div>
            <div className="font-bold text-slate-800">Manual Batch Selection</div>
            <div className="text-sm text-slate-500 mt-1">Muuza/chagua batch wakati wa kuuza.</div>
          </div>
        </label>
      </div>
      
      <div className="bg-slate-100 p-4 rounded-xl text-sm text-slate-600">
        <span className="font-bold">Note:</span> You can also override the selling method per-product in the Items Setup or POS Product Settings.
      </div>
    </div>
  );
};

// Generic Setting List Management components
const GenericListManager = ({ 
  title, items, onSave, placeholderName = "New Item" 
}: { 
  title: string, items: any[], onSave: (items: any[]) => void, placeholderName?: string 
}) => {
  const [list, setList] = React.useState(items);
  const [newItemName, setNewItemName] = React.useState('');

  React.useEffect(() => {
    setList(items);
  }, [items]);

  const handleAdd = () => {
    if (!newItemName.trim()) return;
    const newItem = { id: Math.random().toString(), name: newItemName, isActive: true };
    setList([...list, newItem]);
    setNewItemName('');
  };

  const toggleActive = (id: string) => {
    setList(list.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i));
  };

  const handleSave = () => {
    onSave(list);
    alert(`${title} saved successfully.`);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-slate-800 border-b pb-2">{title}</h3>
      
      <div className="flex space-x-2">
        <input 
          type="text" 
          value={newItemName} 
          onChange={e => setNewItemName(e.target.value)} 
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-slate-800" 
          placeholder={placeholderName} 
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button type="button" onClick={handleAdd} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center hover:bg-emerald-700">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Name</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(item => (
              <tr key={item.id} className="bg-white hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                <td className="px-4 py-3 text-right">
                  <button 
                    type="button"
                    onClick={() => toggleActive(item.id)}
                    className={`px-3 py-1 rounded text-xs font-bold ${item.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {item.isActive !== false ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-slate-500">No items found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-4">
        <button onClick={handleSave} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-slate-800">
          <Save className="w-4 h-4 mr-2" /> Save {title}
        </button>
      </div>
    </div>
  );
};

const UnitsSetupTab = ({ units, onSave }: any) => <GenericListManager title="Units Setup" items={units} onSave={onSave} placeholderName="e.g. Ndoo, Gunia, Piece" />;
const PaymentMethodsTab = ({ methods, onSave }: any) => <GenericListManager title="Payment Methods" items={methods} onSave={onSave} placeholderName="e.g. M-Pesa, Cash" />;
const ExpenseCategoriesTab = ({ categories, onSave }: any) => <GenericListManager title="Expense Categories" items={categories} onSave={onSave} placeholderName="e.g. Rent, Salary" />;

// 9. POS Product Settings
const PosSettingsTab = ({ items, onUpdate }: { items: MsItem[], onUpdate: (item: MsItem) => void }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-slate-800 border-b pb-2">POS Product Settings</h3>
      <p className="text-slate-600 text-sm">Choose which products appear in Fast POS and how they look.</p>
      
      <div className="space-y-4">
        {items.filter(i => i.type === 'finished_product').map(item => (
          <div key={item.id} className="bg-white border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <div className="font-bold text-slate-800 text-lg mb-1">{item.name}</div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={item.showOnPos} onChange={e => onUpdate({ ...item, showOnPos: e.target.checked })} className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                  <span className="text-sm font-semibold text-slate-700">Show on POS</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={item.allowDiscount} onChange={e => onUpdate({ ...item, allowDiscount: e.target.checked })} className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                  <span className="text-sm font-semibold text-slate-700">Allow Discount</span>
                </label>
              </div>
            </div>
            
            <div className="w-full md:w-auto grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">POS Name</label>
                <input type="text" value={item.posDisplayName || item.name} onChange={e => onUpdate({ ...item, posDisplayName: e.target.value })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-slate-500" placeholder="Short name" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Color</label>
                <input type="color" value={item.posColor || '#10b981'} onChange={e => onUpdate({ ...item, posColor: e.target.value })} className="w-full bg-white border border-slate-200 rounded px-1 py-1 h-7 cursor-pointer" />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Default Price</label>
                <input type="number" value={item.sellingPrice} onChange={e => onUpdate({ ...item, sellingPrice: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-slate-500" />
              </div>
            </div>
          </div>
        ))}
        {items.filter(i => i.type === 'finished_product').length === 0 && (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center">
            <PackageSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No finished products found.</p>
            <p className="text-slate-400 text-sm mt-1">Add finished products in "Items Setup" first.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 3. Items Setup
const ItemsSetupTab = ({ items, units, onAdd, onUpdate }: { items: MsItem[], units: MsUnit[], onAdd: (i: MsItem) => void, onUpdate: (i: MsItem) => void }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MsItem>>({
    name: '', type: 'finished_product', unitId: '', stock: 0, averageCost: 0, latestCost: 0, sellingPrice: 0, showOnPos: true, lowStockAlert: 10, sellingMethod: 'fifo', batches: []
  });

  const handleSave = () => {
    if (!newItem.name || !newItem.unitId) return;
    onAdd({ ...newItem, id: Math.random().toString() } as MsItem);
    setShowAddForm(false);
    setNewItem({ name: '', type: 'finished_product', unitId: '', stock: 0, averageCost: 0, latestCost: 0, sellingPrice: 0, showOnPos: true, lowStockAlert: 10, sellingMethod: 'fifo', batches: [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b pb-2">
        <h3 className="text-xl font-black text-slate-800">Items Setup</h3>
        <button onClick={() => setShowAddForm(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative mb-6">
          <button onClick={() => setShowAddForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5"/></button>
          <h4 className="font-bold text-slate-800 mb-4">Add New Item</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Item Name</label>
              <input type="text" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Item Type</label>
              <select value={newItem.type} onChange={e => setNewItem({ ...newItem, type: e.target.value as any })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500">
                <option value="raw_material">Raw Material / Malighafi</option>
                <option value="finished_product">Finished Product / Bidhaa ya kuuza</option>
                <option value="by_product">By-product / Bidhaa ya ziada</option>
                <option value="packaging">Packaging / Kifungashio</option>
                <option value="label">Label / Lebo</option>
                <option value="operational_cost">Operational Cost Item</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Default Unit</label>
              <select value={newItem.unitId} onChange={e => setNewItem({ ...newItem, unitId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500">
                <option value="">Select Unit...</option>
                {units.filter(u => u.isActive !== false).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Opening Stock (Optional)</label>
              <input type="number" value={newItem.stock} onChange={e => setNewItem({ ...newItem, stock: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Low Stock Alert</label>
              <input type="number" value={newItem.lowStockAlert} onChange={e => setNewItem({ ...newItem, lowStockAlert: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Current Selling Price</label>
              <input type="number" value={newItem.sellingPrice} onChange={e => setNewItem({ ...newItem, sellingPrice: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleSave} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold">Save Item</button>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Name</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Unit</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const u = units.find(u => u.id === item.unitId);
              return (
              <tr key={item.id} className="bg-white hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600 capitalize">{item.type.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{u?.name || 'Unknown'}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{item.stock}</td>
              </tr>
            )})}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No items found. Create your first item above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 4b. Production Recipes
const RecipesSetupTab = ({ recipes, items, units, addRecipe, updateRecipe, deleteRecipe }: any) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<MsRecipe>>({
    name: '', finishedProductId: '', expectedOutput: 1, outputUnitId: '', materials: [], notes: '', isActive: true
  });

  const handleEdit = (recipe: MsRecipe) => {
    setFormData(recipe);
    setEditingId(recipe.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.finishedProductId || !formData.expectedOutput || !formData.outputUnitId || formData.materials!.length === 0) {
      alert("Please fill all required fields and add at least one material.");
      return;
    }
    if (editingId) {
      updateRecipe(formData as MsRecipe);
    } else {
      addRecipe({ ...formData, id: Math.random().toString() } as MsRecipe);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const getUnitName = (id: string) => units.find((u: any) => u.id === id)?.name || id;
  const getItemName = (id: string) => items.find((i: any) => i.id === id)?.name || id;

  const addMaterialRow = () => {
    setFormData({
      ...formData,
      materials: [...(formData.materials || []), { id: Math.random().toString(), itemId: '', quantity: 1, unitId: '', role: 'raw_material' }]
    });
  };

  const updateMaterial = (idx: number, field: string, val: any) => {
    const updated = [...(formData.materials || [])];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormData({ ...formData, materials: updated });
  };
  
  const removeMaterial = (idx: number) => {
    const updated = [...(formData.materials || [])];
    updated.splice(idx, 1);
    setFormData({ ...formData, materials: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b pb-2">
        <div>
          <h3 className="text-xl font-black text-slate-800">Production Recipes</h3>
          <p className="text-slate-500 text-sm">Teach MicroSoko how you produce your products to track efficiency and costs.</p>
        </div>
        <button onClick={() => {
          setEditingId(null);
          setFormData({ name: '', finishedProductId: '', expectedOutput: 1, outputUnitId: '', materials: [], notes: '', isActive: true });
          setShowForm(true);
        }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" /> Add Recipe
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative mb-6">
          <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5"/></button>
          <h4 className="font-bold text-slate-800 mb-6 text-lg">{editingId ? 'Edit Recipe' : 'New Recipe Setup'}</h4>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Recipe Name <span className="text-rose-500">*</span></label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Rice Beans Meat Plate" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Finished Product <span className="text-rose-500">*</span></label>
                <select value={formData.finishedProductId} onChange={e => setFormData({ ...formData, finishedProductId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500">
                  <option value="">Select product you produce...</option>
                  {items.filter((i: any) => i.type === 'finished_product').map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white border text-sm border-slate-200 rounded-xl p-4">
              <h5 className="font-bold text-slate-800 mb-4 pb-2 border-b flex justify-between items-center">
                <span>Materials & Costs Used <span className="text-rose-500">*</span></span>
                <button onClick={addMaterialRow} className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg hover:bg-emerald-100 flex items-center font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </button>
              </h5>
              
              <div className="space-y-3">
                {formData.materials?.map((mat, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-2 relative">
                    <select value={mat.role} onChange={e => updateMaterial(idx, 'role', e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:border-emerald-500 font-semibold md:w-36">
                      <option value="raw_material">Raw Mat.</option>
                      <option value="packaging">Packaging</option>
                      <option value="direct_cost">Direct Cost</option>
                      <option value="by_product">By Product</option>
                    </select>
                    <select value={mat.itemId} onChange={e => {
                        const item = items.find((i: any) => i.id === e.target.value);
                        updateMaterial(idx, 'itemId', e.target.value);
                        if(item) updateMaterial(idx, 'unitId', item.unitId);
                      }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:border-emerald-500 font-semibold"
                    >
                      <option value="">Select Item...</option>
                      {items.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="number" value={mat.quantity} onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)} placeholder="Qty" className="w-full md:w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-center focus:border-emerald-500 flex-shrink-0" />
                    <select value={mat.unitId} onChange={e => updateMaterial(idx, 'unitId', e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:border-emerald-500 font-semibold md:w-32">
                      <option value="">Unit...</option>
                      {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button onClick={() => removeMaterial(idx)} className="text-slate-400 hover:text-rose-500 p-2"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {(!formData.materials || formData.materials.length === 0) && (
                  <p className="text-slate-500 italic text-center py-4">No materials added. Click "Add" to specify ingredients or costs.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Expected Output Qty <span className="text-rose-500">*</span></label>
                <input type="number" value={formData.expectedOutput} onChange={e => setFormData({ ...formData, expectedOutput: parseFloat(e.target.value) || 0 })} placeholder="e.g. 12" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold text-center outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Output Unit <span className="text-rose-500">*</span></label>
                <select value={formData.outputUnitId} onChange={e => setFormData({ ...formData, outputUnitId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500">
                  <option value="">Select Output Unit...</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Notes</label>
              <textarea rows={2} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any instructions or notes..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500"></textarea>
            </div>

          </div>
          
          <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-200">
             {editingId ? (
                <button onClick={() => { if(window.confirm('Delete this recipe?')) deleteRecipe(editingId); setShowForm(false); }} className="text-rose-500 hover:text-rose-600 font-bold px-4 py-2 rounded-xl bg-rose-50">Delete Recipe</button>
             ) : <div></div>}
             <button onClick={handleSave} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-emerald-700">
               <Save className="w-5 h-5 mr-2" /> Save Recipe
             </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map((recipe: MsRecipe) => (
          <div key={recipe.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-500 transition-colors cursor-pointer" onClick={() => handleEdit(recipe)}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-slate-800 text-lg">{recipe.name}</h4>
              <Edit2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-4">{getItemName(recipe.finishedProductId)}</p>
            
            <div className="space-y-1 mb-4 border-l-2 border-emerald-100 pl-3">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Expected Output</p>
              <p className="font-bold text-emerald-600">{recipe.expectedOutput} {getUnitName(recipe.outputUnitId)}</p>
            </div>

            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-2">Materials & Costs</p>
            <ul className="text-sm text-slate-600 space-y-1 truncate">
              {recipe.materials.slice(0, 3).map(m => (
                <li key={m.id}>• {m.quantity} {getUnitName(m.unitId)} {getItemName(m.itemId)}</li>
              ))}
              {recipe.materials.length > 3 && (
                <li className="text-slate-400 italic">• + {recipe.materials.length - 3} more</li>
              )}
            </ul>
          </div>
        ))}
        {recipes.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <Factory className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h4 className="font-bold text-slate-800 mb-2">No Recipes Added</h4>
            <p className="text-slate-500 max-w-sm mx-auto">Teach MicroSoko how you create your products to automatically track costs and inventory.</p>
            <button onClick={() => setShowForm(true)} className="mt-6 bg-slate-900 border border-slate-800 text-white px-6 py-2 rounded-xl font-bold inline-flex items-center hover:bg-slate-800">
               <Plus className="w-4 h-4 mr-2" /> Create First Recipe
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 5. Unit Conversions
const ConversionsSetupTab = ({ conversions, items, units, onSave }: any) => {
  const [list, setList] = useState<MsConversion[]>(conversions);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConv, setNewConv] = useState<Partial<MsConversion>>({ itemId: '', fromUnit: '', fromQty: 1, toUnit: '', toQty: 1, notes: '' });

  const handleSaveList = () => onSave(list);
  const handleAdd = () => {
    if (!newConv.itemId || !newConv.fromUnit || !newConv.toUnit) return;
    const item = { ...newConv, id: Math.random().toString() } as MsConversion;
    setList([...list, item]);
    setShowAddForm(false);
    setNewConv({ itemId: '', fromUnit: '', fromQty: 1, toUnit: '', toQty: 1, notes: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b pb-2">
        <h3 className="text-xl font-black text-slate-800">Unit Conversions</h3>
        <button onClick={() => setShowAddForm(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" /> Add Conversion
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative mb-6">
          <button onClick={() => setShowAddForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5"/></button>
          <h4 className="font-bold text-slate-800 mb-4">Add New Unit Conversion</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Item</label>
              <select value={newConv.itemId} onChange={e => setNewConv({ ...newConv, itemId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500">
                <option value="">Select Item...</option>
                {items.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">From Quantity</label>
              <input type="number" value={newConv.fromQty} onChange={e => setNewConv({ ...newConv, fromQty: parseFloat(e.target.value) || 1 })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">From Unit</label>
              <select value={newConv.fromUnit} onChange={e => setNewConv({ ...newConv, fromUnit: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500">
                <option value="">Select Unit...</option>
                {units.filter((u:any) => u.isActive !== false).map((u:any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">To Quantity</label>
              <input type="number" value={newConv.toQty} onChange={e => setNewConv({ ...newConv, toQty: parseFloat(e.target.value) || 1 })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">To Unit</label>
              <select value={newConv.toUnit} onChange={e => setNewConv({ ...newConv, toUnit: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-semibold outline-none focus:border-emerald-500">
                <option value="">Select Unit...</option>
                {units.filter((u:any) => u.isActive !== false).map((u:any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleAdd} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold">Add to List</button>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Item</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Conversion Rule</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(c => {
              const uFrom = units.find((u:any) => u.id === c.fromUnit);
              const uTo = units.find((u:any) => u.id === c.toUnit);
              const item = items.find((i:any) => i.id === c.itemId);
              return (
              <tr key={c.id} className="bg-white hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{item?.name || 'Unknown'}</td>
                <td className="px-4 py-3 font-bold text-slate-600">{c.fromQty} {uFrom?.name} = {c.toQty} {uTo?.name}</td>
              </tr>
            )})}
            {list.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-slate-500">No conversions setup.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={handleSaveList} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-slate-800">
          <Save className="w-4 h-4 mr-2" /> Save Conversions
        </button>
      </div>
    </div>
  );
};
