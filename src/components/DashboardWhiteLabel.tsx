import { useState } from 'react';
import { Tenant } from '../types';
import { 
  Palette, 
  Code, 
  Layers, 
  Globe, 
  Sparkles, 
  CheckCircle, 
  ExternalLink,
  Laptop, 
  ShieldAlert, 
  CreditCard,
  FileCode,
  Copy,
  Layout,
  RefreshCw,
  Sliders,
  Check,
  Smartphone,
  Info
} from 'lucide-react';

interface DashboardWhiteLabelProps {
  activeTenant: Tenant;
}

export default function DashboardWhiteLabel({ activeTenant }: DashboardWhiteLabelProps) {
  // Brand customizations state
  const [customBrandName, setCustomBrandName] = useState(activeTenant.name);
  const [customSlogan, setCustomSlogan] = useState(
    activeTenant.businessType === 'pharmacy' 
      ? 'Clinical Pharmacy Dispensary Integrated Suite' 
      : activeTenant.businessType === 'restaurant'
        ? 'Digital Restaurant Dining & Kitchen ERP'
        : activeTenant.businessType === 'hotel'
          ? 'Hotel PMS & Guest Management Suite'
          : 'Unified Merchant Retail Administration'
  );
  const [primaryColor, setPrimaryColor] = useState('#6366f1'); // Default Indigo
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'glass'>('light');
  const [hideJasperBranding, setHideJasperBranding] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [customDomain, setCustomDomain] = useState('erp.clientwebsite.com');
  const [restrictOfflineDb, setRestrictOfflineDb] = useState(false);
  
  // Custom scope variable supporting either pos-only or the entire administrative system
  const [embedScope, setEmbedScope] = useState<'pos' | 'entire-niche'>('entire-niche');
  const [simulatedActiveView, setSimulatedActiveView] = useState<'checkout' | 'inventory' | 'reports_crm' | 'suppliers'>('inventory');

  // Available Presets
  const colorPresets = [
    { Name: 'Indigo Blue', Hex: '#6366f1', hoverClass: 'bg-indigo-500' },
    { Name: 'Emerald Green', Hex: '#10b981', hoverClass: 'bg-emerald-500' },
    { Name: 'Sunset Orange', Hex: '#f97316', hoverClass: 'bg-orange-500' },
    { Name: 'Royal Cyan', Hex: '#06b6d4', hoverClass: 'bg-cyan-500' },
    { Name: 'Deep Crimson', Hex: '#e11d48', hoverClass: 'bg-rose-500' },
    { Name: 'Cosmic Charcoal', Hex: '#334155', hoverClass: 'bg-slate-700' },
  ];

  // Generated code string
  const embedCode = `<div class="iframe-container" style="position: relative; width: 100%; height: 750px; overflow: hidden; border-radius: 20px; box-shadow: 0 12px 40px -15px rgba(0,0,0,0.2); border: 1px solid rgba(0,0,0,0.08);">
  <iframe 
    src="https://jaspersuite.app/embed/${activeTenant.id}?scope=${embedScope}&theme=${themeMode}&primary=${primaryColor.replace('#', '')}&hideHeader=${hideJasperBranding ? 'true' : 'false'}&localdb=${restrictOfflineDb ? 'restricted' : 'active'}" 
    width="100%" 
    height="100%" 
    style="border: none;"
    allow="clipboard-write"
    title="${customBrandName} Embedded Niche Manager"
  ></iframe>
</div>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Visual Hub Title Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 relative overflow-hidden shadow-lg border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-550/15 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-mono uppercase tracking-widest font-black">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Agency White-Label Suite</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight font-sans">Embedded Portal Studio</h1>
            <p className="text-slate-400 text-sm leading-relaxed font-light">
              Transform Jasper Suite into a premium, white-labeled inventory and Point of Sale module integrated seamlessly into your client&apos;s existing site. Sell website design services with a fully branded ERP engine running silently in the background!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Embed Mode</span>
              <span className="text-xs font-bold text-emerald-400 font-mono uppercase mt-1 block">✓ API Active</span>
            </div>
            <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Custom Domain CNAME</span>
              <span className="text-xs font-bold text-indigo-400 font-mono uppercase mt-1 block">Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Controls & Branding Dashboard (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Custom Branding Controller */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-5">
            <h3 className="text-xs font-black tracking-widest text-slate-450 uppercase font-mono flex items-center space-x-2">
              <Palette className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>1. Customize Look & Feel</span>
            </h3>

            <div className="space-y-4">
              {/* Client brand display name */}
              <div>
                <label className="block text-[10px] font-mono text-slate-450 uppercase font-bold tracking-wider mb-1.5">Client Brand Name</label>
                <input
                  type="text"
                  value={customBrandName}
                  onChange={(e) => setCustomBrandName(e.target.value)}
                  placeholder="e.g. Star Pharmacy Ltd."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all font-sans"
                />
              </div>

              {/* Sub-label slogan */}
              <div>
                <label className="block text-[10px] font-mono text-slate-450 uppercase font-bold tracking-wider mb-1.5">Slogan / Descriptor text</label>
                <input
                  type="text"
                  value={customSlogan}
                  onChange={(e) => setCustomSlogan(e.target.value)}
                  placeholder="e.g. Health & Clinical Dispensary"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all font-sans"
                />
              </div>

              {/* Preset Theme Mode selectors */}
              <div>
                <label className="block text-[10px] font-mono text-slate-450 uppercase font-bold tracking-wider mb-1.5">App Theme Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'glass'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setThemeMode(mode)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase font-mono cursor-pointer border transition-all ${
                        themeMode === mode 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme color selectors preset bubbles */}
              <div>
                <label className="block text-[10px] font-mono text-slate-450 uppercase font-bold tracking-wider mb-1.5">Client Accent Hue</label>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.Hex}
                      type="button"
                      onClick={() => setPrimaryColor(preset.Hex)}
                      className={`w-6 h-6 rounded-full border border-black/10 transition-transform active:scale-90 relative ${preset.hoverClass} cursor-pointer`}
                      title={preset.Name}
                    >
                      {primaryColor.toLowerCase() === preset.Hex.toLowerCase() && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Embedding System Scope Option */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-mono text-slate-450 uppercase font-bold tracking-wider mb-2">Embedding System Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmbedScope('pos');
                      setCustomSlogan(
                        activeTenant.businessType === 'pharmacy' ? 'Clinical POS Dispensary Till' : 'POS Checkout Till'
                      );
                    }}
                    className={`py-2 px-1 rounded-xl text-[11px] font-black uppercase font-mono cursor-pointer border transition-all truncate text-center ${
                      embedScope === 'pos' 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                    }`}
                  >
                    1. Direct POS Till
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmbedScope('entire-niche');
                      setCustomSlogan(
                        activeTenant.businessType === 'pharmacy' 
                          ? 'Clinical Pharmacy Dispensary Integrated Suite' 
                          : activeTenant.businessType === 'restaurant'
                            ? 'Digital Restaurant Dining & Kitchen ERP'
                            : activeTenant.businessType === 'hotel'
                              ? 'Hotel PMS & Guest Management Suite'
                              : 'Unified Merchant Retail Administration'
                      );
                    }}
                    className={`py-2 px-1 rounded-xl text-[11px] font-black uppercase font-mono cursor-pointer border transition-all truncate text-center ${
                      embedScope === 'entire-niche' 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                    }`}
                  >
                    2. Entire ERP Suite
                  </button>
                </div>
                <p className="text-[10px] text-slate-450 mt-1.5 leading-normal">
                  {embedScope === 'pos' 
                    ? `✓ Loads only the isolated checkout registers/till layout for ${activeTenant.businessType.toUpperCase()} cashier counters.` 
                    : `✓ Embeds the full ERP system including inventory catalogs, supplier databases, reports, analytics and logs.`}
                </p>
              </div>

              {/* White label settings toggles */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Strict White-Labeling</span>
                    <span className="text-[10px] text-slate-400 font-light block">Hide any references to &quot;Jasper Suite&quot;</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hideJasperBranding}
                    onChange={(e) => setHideJasperBranding(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-305 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Offline LocalStorage Guard</span>
                    <span className="text-[10px] text-slate-400 font-light block">Restrict database synchronization to target domain ONLY</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={restrictOfflineDb}
                    onChange={(e) => setRestrictOfflineDb(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-305 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Integration Iframe Generator Panel */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black tracking-widest text-slate-450 uppercase font-mono flex items-center space-x-2">
                <Code className="w-4 h-4 text-indigo-650 shrink-0" />
                <span>2. Integration Snippet</span>
              </h3>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-all active:scale-95 flex items-center space-x-1 cursor-pointer"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'COPIED!' : 'COPY CODE'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Paste this fluid `&lt;iframe&gt;` code into the code manager of your client’s WordPress, Wix, Custom React/HTML, or custom CSS website.
            </p>

            <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto border border-slate-800 font-mono text-[9px] leading-relaxed text-slate-300 select-all max-h-48 scrollbar-thin">
              <pre>{embedCode}</pre>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Live Simulator Sandbox (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Live Simulator Header Area */}
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Live Website Integration Sandbox</h3>
              <p className="text-xs text-slate-450">Simulates are real embedded representation on a client website.</p>
            </div>
            <div className="font-mono text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-150 px-2.5 py-1 rounded-full font-black animate-pulse">
              ● REAL TIME FEED
            </div>
          </div>

          {/* Visual Canvas of Client Website Frame */}
          <div className="border-4 border-slate-800 rounded-3xl overflow-hidden bg-slate-900 shadow-xl flex flex-col">
            
            {/* Mock Web Browser Chrome Header */}
            <div className="bg-slate-800 px-4 py-2.5 border-b border-slate-700/80 flex items-center justify-between gap-4 font-mono select-none">
              {/* Colored Dots */}
              <div className="flex space-x-1.5 shrink-0">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block" />
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block" />
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" />
              </div>
              
              {/* Mock Address Bar */}
              <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg text-[9.5px] px-3 py-1 text-slate-400 flex items-center justify-between w-full max-w-sm truncate text-left">
                <div className="flex items-center space-x-1 truncate">
                  <span className="text-emerald-500">https://</span>
                  <span className="font-bold text-slate-350">{customDomain}</span>
                  <span className="text-slate-500">/pos-counter</span>
                </div>
                <RefreshCw className="w-3 h-3 text-slate-500 ml-2" />
              </div>

              {/* Right indicators */}
              <div className="flex items-center space-x-2 shrink-0">
                <Laptop className="w-3.5 h-3.5 text-slate-400" />
                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>

            {/* Simulated Live Embedded Container Frame */}
            <div className="bg-[#f8fafc] p-6 text-slate-800">
              
              {/* Outer Custom Website Header Header */}
              <div className="flex items-center justify-between border-b border-slate-205 pb-3 mb-4 shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <span className="font-sans font-black text-xs text-slate-900 uppercase tracking-tight">{customBrandName} &apos;s Portal</span>
                </div>
                {/* Mock Client Menu */}
                <div className="flex space-x-3 text-[10px] font-sans text-slate-450 font-bold uppercase">
                  <span className="hover:text-slate-805 cursor-pointer">Our Services</span>
                  <span className="hover:text-slate-805 cursor-pointer">Locations</span>
                  <span className="font-bold text-slate-905 border-b-2" style={{ borderColor: primaryColor }}>Admin Register</span>
                </div>
              </div>

              {/* Simulated Embedded Iframe Content - Reconstructs the exact styling on selected color preset to prove beautiful custom branding */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[420px] flex flex-col justify-between relative">
                
                {/* Brand Frame Top line */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center border text-white font-extrabold text-sm shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {customBrandName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-slate-800 leading-none">{customBrandName}</h4>
                      <p className="text-[9px] text-slate-450 font-mono mt-1 font-light uppercase tracking-wider">{customSlogan}</p>
                    </div>
                  </div>

                  <div className="text-right text-[10px] font-mono font-medium text-slate-400">
                    {hideJasperBranding ? (
                      <span className="px-2 py-0.5 bg-slate-150 rounded-md text-[8.5px] tracking-wide font-black uppercase text-slate-500">Secure White-Label Connection</span>
                    ) : (
                      <span>Engine: <span className="text-slate-600 font-bold">Jasper Suite Enterprise</span></span>
                    )}
                  </div>
                </div>

                {/* Sub-menubar supporting the entire niche system tabs when of the complete suite */}
                {embedScope === 'entire-niche' && (
                  <div className="px-5 py-2 bg-slate-100 border-b border-slate-200/60 flex flex-wrap gap-1.5">
                    {[
                      { id: 'inventory', label: 'Inventory & Stock' },
                      { id: 'checkout', label: 'Checkout Till (POS)' },
                      { id: 'reports_crm', label: 'Commercial Audits' },
                      { id: 'suppliers', label: activeTenant.businessType === 'pharmacy' ? 'Labs & Med Vendors' : 'Supply Partners' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSimulatedActiveView(tab.id as any)}
                        style={{
                          backgroundColor: simulatedActiveView === tab.id ? primaryColor : 'transparent',
                          color: simulatedActiveView === tab.id ? '#ffffff' : '#64748b'
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[9.5px] font-mono font-black uppercase transition-all duration-200 cursor-pointer ${
                          simulatedActiveView === tab.id ? 'shadow-xs' : 'hover:bg-slate-200 text-slate-500'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Simulated Content Area with Multi-Niche Tab Previews */}
                <div className={`p-6 flex-grow flex flex-col justify-between min-h-[350px] transition-colors ${
                  themeMode === 'dark' ? 'bg-slate-950 text-slate-200' : themeMode === 'glass' ? 'bg-slate-50/40 backdrop-blur-md text-slate-800' : 'bg-white text-slate-800'
                }`}>

                  {/* 1. ISOLATED CHECKOUT REGISTER PREVIEW */}
                  {(embedScope === 'pos' || simulatedActiveView === 'checkout') && (
                    <div className="space-y-4 my-auto">
                      <div className="max-w-md mx-auto space-y-3 text-center">
                        <div 
                          className="w-12 h-12 rounded-full mx-auto flex items-center justify-center animate-bounce duration-1000 shadow-md"
                          style={{ backgroundColor: `${primaryColor}20` }}
                        >
                          <CheckCircle className="w-5 h-5" style={{ color: primaryColor }} />
                        </div>
                        
                        <h5 className="font-bold text-sm text-slate-800">
                          Secure Cash Desk Registers Active
                        </h5>
                        
                        <p className="text-[11px] text-slate-450 leading-relaxed font-light">
                          This represents the white-labeled register till loaded specifically for your client counters. Products, pricing catalogs, promos and cash receipts registered here bypass any Jasper branding, displaying only client colors (<span className="font-mono font-bold" style={{ color: primaryColor }}>{primaryColor}</span>) flawlessly.
                        </p>
                      </div>

                      {/* Micro simulated POS list for visual validation */}
                      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-1">
                        <div className="p-2.5 border border-slate-100 rounded-xl bg-slate-50/50 text-left">
                          <span className="text-[8px] text-slate-400 font-mono font-semibold uppercase block">In-Store Stock</span>
                          <span className="text-[10px] font-bold text-slate-755 mt-0.5 block truncate">Available Items</span>
                          <span className="text-[10px] font-mono font-bold mt-1 inline-block px-1.5 py-0.2 rounded" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>342 Units</span>
                        </div>

                        <div className="p-2.5 border border-slate-100 rounded-xl bg-slate-50/50 text-left">
                          <span className="text-[8px] text-slate-400 font-mono font-semibold uppercase block">Staff Shift</span>
                          <span className="text-[10px] font-bold text-slate-755 mt-0.5 block truncate">Pharmacist Desk</span>
                          <span className="text-[10px] font-mono font-bold text-slate-600 mt-1 inline-block px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded">2 Tickets</span>
                        </div>

                        <div className="p-2.5 border border-slate-100 rounded-xl bg-slate-50/50 text-left">
                          <span className="text-[8px] text-slate-400 font-mono font-semibold uppercase block">Daily Margin</span>
                          <span className="text-[10px] font-bold text-slate-755 mt-0.5 block truncate">Net Revenue</span>
                          <span className="text-[10px] font-mono text-slate-600 font-bold mt-1 inline-block px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded">+12.4%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. DYNAMIC SKU INVENTORY CATALOG PREVIEW */}
                  {embedScope === 'entire-niche' && simulatedActiveView === 'inventory' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider font-mono">Dynamic Stock Master Catalog</h5>
                          <p className="text-[10px] text-slate-400">Totaling 12 active therapeutic categories registered on database.</p>
                        </div>
                        <button 
                          style={{ backgroundColor: primaryColor }}
                          className="px-2.5 py-1 text-white text-[9.5px] font-mono font-bold rounded-lg uppercase tracking-wider"
                        >
                          + ADD BULK ITEMS
                        </button>
                      </div>

                      <div className="border border-slate-200/60 rounded-xl overflow-hidden text-[11px] text-left bg-white/65">
                        <div className="grid grid-cols-12 font-mono text-[8px] text-slate-400 font-extrabold uppercase bg-slate-50 p-2.5 border-b border-slate-200/50">
                          <span className="col-span-1">CODE</span>
                          <span className="col-span-5">PRODUCT DESIGNATION</span>
                          <span className="col-span-3">SHELF STATUS</span>
                          <span className="col-span-3 text-right">UNIT PRICE</span>
                        </div>
                        <div className="divide-y divide-slate-100 space-y-0.5">
                          {[
                            { code: 'A103', name: 'Albeva Amoxicillin cap 500mg', status: 'Optimal (210 Blisters Left)', price: 'TZS 15,000' },
                            { code: 'C289', name: 'Zingiber Cough suppressant lozenges', status: 'Warning Level (9 left)', price: 'TZS 4,500' },
                            { code: 'D902', name: 'Clinical Methylated Spirits 95% 500ml', status: 'Optimal (45 Bottles)', price: 'TZS 8,000' }
                          ].map((x) => (
                            <div key={x.code} className="grid grid-cols-12 p-2.5 items-center hover:bg-slate-50/55">
                              <span className="col-span-1 font-mono text-[9px] font-bold text-slate-400">{x.code}</span>
                              <span className="col-span-5 font-bold text-slate-805 truncate">{x.name}</span>
                              <span className="col-span-3">
                                <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  x.status.includes('Warning') ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-800'
                                }`}>
                                  {x.status}
                                </span>
                              </span>
                              <span className="col-span-3 text-right font-mono font-black text-slate-900">{x.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. AUDITS & COMMERCIAL LEDGER PREVIEW */}
                  {embedScope === 'entire-niche' && simulatedActiveView === 'reports_crm' && (
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider font-mono">Custom Audits & CRM Analytics</h5>
                        <p className="text-[10px] text-slate-400">Integrated audit reporting showing VAT ledger computations with TRA compliance indicators.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                          <span className="text-[8.5px] font-mono text-slate-400 uppercase tracking-widest font-black block">Cumulative Turnover</span>
                          <h4 className="text-xl font-black text-slate-850 mt-1 font-mono">TZS 1,482,000</h4>
                          <span className="text-[9.5px] text-slate-450 mt-1 block">Compiled based on 54 customer vouchers</span>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                          <span className="text-[8.5px] font-mono text-slate-400 uppercase tracking-widest font-black block">VFD VAT Collected</span>
                          <h4 className="text-xl font-black text-slate-850 mt-1 font-mono" style={{ color: primaryColor }}>TZS 266,760</h4>
                          <span className="text-[9.5px] text-slate-450 mt-1 block">Consolidated TRA regulatory status: <span className="text-emerald-700 font-bold">VERIFIED</span></span>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50/40 border border-emerald-100/80 rounded-2xl text-left flex items-start space-x-2">
                        <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <p className="text-[10px] leading-relaxed text-slate-600">
                          <strong>Automatic Locks Enforcement:</strong> Under this White-Label structure, if the end-customer fails to renew their custom designer subscription, you can disable their custom embedded portal instantly via your primary Jasper panel.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 4. CLINICAL PHARMACY LABS & SUPPLIERS DIRECTORY */}
                  {embedScope === 'entire-niche' && simulatedActiveView === 'suppliers' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider font-mono">Clinical Vendor Directory</h5>
                          <p className="text-[10px] text-slate-400">Supplier partnerships, credit lines, and procurement logs.</p>
                        </div>
                        <span className="text-[9.5px] font-semibold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                          Active Sync Enabled
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-[11px]">
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>Prime Labs Tanzania Ltd.</span>
                            <span className="text-[9.5px] font-mono font-black" style={{ color: primaryColor }}>TZ-MED-03</span>
                          </div>
                          <p className="text-[10px] text-slate-450">Antibiotics, injectable fluids and high-volume clinical fluids.</p>
                          <div className="text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-100">Contact: +255 784 102 938</div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>Astra Zen Pharmaceuticals</span>
                            <span className="text-[9.5px] font-mono font-black text-indigo-700">AZ-UK-INT</span>
                          </div>
                          <p className="text-[10px] text-slate-400">Cardiovascular drugs, blood regulators and imported vaccines.</p>
                          <div className="text-[9px] font-mono text-slate-450 pt-1 border-t border-slate-100">Contact: partner-support@astrazen.com</div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Brand simulated footer */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{customBrandName} &bull; ERP Secure Portal</span>
                  <span>{activeTenant.city}, West Africa Ops</span>
                </div>

              </div>

            </div>

          </div>

          {/* Explanation on How Subscriptions Function (Requirement 4) */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-3">
            <h4 className="text-xs font-black tracking-widest text-indigo-700 uppercase font-mono flex items-center space-x-2">
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Normal Billing Cycles & Subscription Mechanics</span>
            </h4>
            
            <p className="text-xs text-slate-500 leading-normal">
              You asked about the billing rules: <span className="italic text-slate-750 font-bold">&quot;no only pos but whole niche system can be white labeled... at the end of subscription he subscribes like any other clients&quot;</span>. 
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 bg-white border border-slate-150 rounded-2xl space-y-2">
                <span className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span>Integrated Unified Billing</span>
                </span>
                <p className="text-[10.5px] text-slate-450 leading-relaxed font-light">
                  Whether your clients embed the isolated cashier POS till or the <strong>entire administrative niche suite</strong> on their domain, the system links to our unified database. When their subscription cycles end, they renew using the exact same billing rules as direct clients.
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-150 rounded-2xl space-y-2">
                <span className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                  <span>Automatic Expiry Lock</span>
                </span>
                <p className="text-[10.5px] text-slate-450 leading-relaxed font-light">
                  If the client fails to subscribe at the end of their period, the custom embedded script triggers a secure lock. Instead of showing the inventory system or cashier options, it displays a polite subscription renewal prompt branded with their own logo, requiring payment to continue.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
