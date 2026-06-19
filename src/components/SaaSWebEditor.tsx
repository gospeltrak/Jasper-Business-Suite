import React, { useState, useEffect } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  Save, 
  RotateCcw, 
  Sparkles, 
  ExternalLink, 
  Phone, 
  Mail, 
  Layout, 
  Type, 
  ToggleLeft, 
  Globe, 
  CheckCircle,
  HelpCircle,
  Award,
  Users,
  Trash2
} from 'lucide-react';

const DEFAULT_SECTIONS = [
  { id: 'landing-hero', label: 'Hero Section', desc: 'Main title, subtitle, registration call-to-action, and animated illustrations.' },
  { id: 'about', label: 'Niche Selector / About Us', desc: 'Detailed business types (Retail, Pharmacy, Restaurant, Hotel) and regional metrics.' },
  { id: 'features', label: 'Advanced Features Grid', desc: 'Working offline state, multi-currency ledger, and mobile money check validation.' },
  { id: 'marquee-partners', label: 'Partner Logos Marquee', desc: 'Infinite scrolling layout showcasing trusted business partners and logos.' },
  { id: 'testimonials', label: 'Success Stories', desc: 'What shop owners say (testimonials from Mustafa, Kwame, Fatuma).' },
  { id: 'pricing', label: 'Subscription Pricing Plans', desc: 'Price card matrix displaying Essential, Standard, and Premium packages.' },
  { id: 'faqs', label: 'FAQ Accordion Matrix', desc: 'Collapsible frequently asked questions for client objections self-service.' },
  { id: 'contact', label: 'Assistance CTA Panel', desc: 'Direct phone & email links to dispatch localized service installer agents.' }
];

const DEFAULT_TRANSLATIONS: Record<string, string> = {
  coreBadge: "Simple Business System",
  headlinePre: "Stop Managing.",
  headlinePost: "Start Growing.",
  tagline: "Your business deserves a partner that works as hard as you do.",
  aboutTitle: "Offline Sales Support For All Businesses",
  aboutDesc: "We created Jasper because unstable internet should never stop your sales desk. Whether you are in Dar, Mbeya, or Nairobi, your cash drawer keeps working.",
  aboutSupport: "Real support offices around East Africa",
  aboutCurrency: "Automatic local tax settings",
  aboutEndpoints: "Over 2,400 active stores registered",
  contactPhone: "+255754002991",
  contactPhoneLabel: "Call Local Agent",
  contactEmail: "deployments@jasper.africa",
  contactEmailLabel: "Contact Deployments",
  footerCol1Title: "Company Suite",
  footerHome: "Home Page",
  footerFaq: "FAQ",
  footerPrivacy: "Privacy Policy",
  footerTerms: "Terms and Conditions",
  footerContact: "Contact Support",
  footerCol2Title: "Affiliates",
  footerJoinAffiliate: "Join Affiliate Program",
  footerAffiliateLogin: "Affiliate Log In",
  footerCol3Title: "Becoming a Partner",
  footerBecomePartner: "Become a Partner",
  footerPartnerLogin: "Partner Log In",
  footerCol4Title: "Follow Us",
  socialYoutube: "https://youtube.com",
  socialInstagram: "https://instagram.com",
  socialTiktok: "https://tiktok.com",
  socialFacebook: "https://facebook.com",
  footerCopyright: "© 2026 Jasper Business Suite Network. All rights reserved."
};

export default function SaaSWebEditor() {
  // Sections order state
  const [sectionsOrder, setSectionsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jasper_landing_sections_order');
      return saved ? JSON.parse(saved) : DEFAULT_SECTIONS.map(s => s.id);
    } catch {
      return DEFAULT_SECTIONS.map(s => s.id);
    }
  });

  // Hidden sections tracker
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('jasper_landing_hidden_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Form custom text override values
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('jasper_landing_custom_values');
      return saved ? JSON.parse(saved) : DEFAULT_TRANSLATIONS;
    } catch {
      return DEFAULT_TRANSLATIONS;
    }
  });

  const [activeSubTab, setActiveSubTab] = useState<'ordering' | 'texts' | 'links' | 'partners'>('ordering');
  const [partnerCapacity, setPartnerCapacity] = useState<number>(() => {
    const saved = localStorage.getItem('jasper_partner_capacity');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [partnerWaitlist, setPartnerWaitlist] = useState<any[]>(() => {
    const saved = localStorage.getItem('jasper_partner_waitlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  useEffect(() => {
    const handleWaitlistReload = () => {
      const saved = localStorage.getItem('jasper_partner_waitlist');
      setPartnerWaitlist(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener('jasper_partner_waitlist_updated', handleWaitlistReload);
    return () => {
      window.removeEventListener('jasper_partner_waitlist_updated', handleWaitlistReload);
    };
  }, []);

  // Helper for shifting order
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sectionsOrder];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;

    // Swap
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setSectionsOrder(newOrder);
  };

  // Toggle Visibility
  const toggleVisibility = (id: string) => {
    setHiddenSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Handle Input Changes
  const handleInputChange = (key: string, val: string) => {
    setCustomValues(prev => ({
      ...prev,
      [key]: val
    }));
  };

  // Reset to default settings
  const handleReset = () => {
    if (window.confirm("Are you sure you want to revert home page website layout and texts to system default? This cannot be undone.")) {
      localStorage.removeItem('jasper_landing_sections_order');
      localStorage.removeItem('jasper_landing_hidden_sections');
      localStorage.removeItem('jasper_landing_custom_values');
      
      setSectionsOrder(DEFAULT_SECTIONS.map(s => s.id));
      setHiddenSections({});
      setCustomValues(DEFAULT_TRANSLATIONS);

      // Broadcast update event
      window.dispatchEvent(new Event('saas_landing_page_updated'));
      
      showToast("Home page restored successfully to factory defaults!");
    }
  };

  // Save changes
  const handleSave = () => {
    try {
      localStorage.setItem('jasper_landing_sections_order', JSON.stringify(sectionsOrder));
      localStorage.setItem('jasper_landing_hidden_sections', JSON.stringify(hiddenSections));
      localStorage.setItem('jasper_landing_custom_values', JSON.stringify(customValues));
      localStorage.setItem('jasper_partner_capacity', partnerCapacity.toString());

      // Dispatch custom document broadcast event to reload parent/iFrame Landing Page immediately!
      window.dispatchEvent(new Event('saas_landing_page_updated'));
      window.dispatchEvent(new CustomEvent('jasper_partner_settings_updated', { detail: { capacity: partnerCapacity } }));

      showToast("Changes applied and published live successfully!");
    } catch (e) {
      alert("Error saving settings to browser localstorage database");
    }
  };

  const showToast = (msg: string) => {
    setSaveNotification(msg);
    setTimeout(() => {
      setSaveNotification(null);
    }, 4000);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      
      {/* HEADER CONTROLS CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Globe className="w-48 h-48 text-emerald-400" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
          <div className="space-y-1.5Packed font-sans">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                STOREFRONT ENGINE CONTROL UNIT
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              🖥️ Portal Website Home Page Builder
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Edit homepage text, order, contacts, and sections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={handleReset}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-mono transition-colors uppercase cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Factory</span>
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-405 text-slate-950 hover:bg-emerald-400 font-bold rounded-xl text-xs font-mono transition-transform active:scale-95 duration-100 uppercase cursor-pointer shadow-lg shadow-emerald-500/15"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Publish Live</span>
            </button>
          </div>
        </div>

        {saveNotification && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl p-3 text-xs font-sans flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 animate-bounce" />
            <span className="font-medium font-sans">{saveNotification}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: BUILDER WORKBENCH CONTROLS */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col p-6 space-y-6">
          
          {/* Builder Tabs */}
          <div className="flex border-b border-slate-800 pb-1.5 gap-2 select-none">
            <button
              onClick={() => setActiveSubTab('ordering')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-colors ${
                activeSubTab === 'ordering' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Section Arranger (Drag & Drop)</span>
            </button>
            
            <button
              onClick={() => setActiveSubTab('texts')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-colors ${
                activeSubTab === 'texts' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Headline & Texts</span>
            </button>

            <button
              onClick={() => setActiveSubTab('links')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-colors ${
                activeSubTab === 'links' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Button Links & Emails</span>
            </button>

            <button
              onClick={() => setActiveSubTab('partners')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-colors ${
                activeSubTab === 'partners' 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Partnership & Waitlist</span>
            </button>
          </div>

          {/* TAB CONTENT: ORDERING SECTION BUILDER */}
          {activeSubTab === 'ordering' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  <strong>Sections</strong>: reorder or hide homepage blocks.
                </p>
              </div>

              <div className="space-y-2.5">
                {sectionsOrder.map((sid, idx) => {
                  const sectionMeta = DEFAULT_SECTIONS.find(item => item.id === sid) || { label: sid, desc: 'Custom element component' };
                  const isHidden = !!hiddenSections[sid];
                  
                  return (
                    <div 
                      key={sid} 
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isHidden 
                          ? 'bg-slate-950/60 border-slate-900 opacity-60 text-slate-500' 
                          : 'bg-slate-950/25 border-slate-850 hover:bg-slate-950/50 hover:border-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-4 space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-slate-500 font-bold px-1.5 py-0.5 bg-slate-900 border border-slate-805 rounded">
                            0{idx + 1}
                          </span>
                          <h4 className={`text-xs font-bold font-sans ${isHidden ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                            {sectionMeta.label}
                          </h4>
                          {isHidden ? (
                            <span className="text-[9px] uppercase font-mono font-bold text-red-400 bg-red-450/10 px-1 rounded">Hidden</span>
                          ) : (
                            <span className="text-[9px] uppercase font-mono font-bold text-emerald-400 bg-emerald-400/10 px-1 rounded">Active</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-450 leading-relaxed truncate font-light text-slate-450">
                          {sectionMeta.desc}
                        </p>
                      </div>

                      {/* Controls rows spacing */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Shifter action items */}
                        <button
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, 'up')}
                          className={`p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-colors ${
                            idx === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-slate-800 cursor-pointer'
                          }`}
                          title="Move Section Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          disabled={idx === sectionsOrder.length - 1}
                          onClick={() => moveSection(idx, 'down')}
                          className={`p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-colors ${
                            idx === sectionsOrder.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-slate-800 cursor-pointer'
                          }`}
                          title="Move Section Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <div className="w-[1px] h-6 bg-slate-850 mx-1" />

                        {/* Hide / Show toggle */}
                        <button
                          onClick={() => toggleVisibility(sid)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isHidden 
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 hover:text-rose-400 border-rose-500/30' 
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border-emerald-500/30'
                          }`}
                          title={isHidden ? 'Click to show section' : 'Click to hide section'}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB CONTENT: TEXT FIELDS */}
          {activeSubTab === 'texts' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  📝  <strong>SaaS Brand Language Override</strong>: Modifying these strings re-wires English and default translation lookups on the live public portal instantly!
                </p>
              </div>

              {/* Form entries */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* System Logo Override */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">System Hub Logo URL (Circle)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                      {(customValues.systemLogo) ? (
                        <img src={customValues.systemLogo} alt="Logo Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Globe className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <input 
                      type="text" 
                      value={customValues.systemLogo || ''}
                      onChange={(e) => handleInputChange('systemLogo', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                      placeholder="Image URL (e.g. https://example.com/logo.png)"
                    />
                  </div>
                </div>

                {/* Hero Headline part A */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Hero Headline (Pre-Word)</label>
                  <input 
                    type="text" 
                    value={customValues.headlinePre || ''}
                    onChange={(e) => handleInputChange('headlinePre', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                    placeholder="e.g. Stop Managing."
                  />
                </div>

                {/* Hero Headline part B */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Hero Headline (Post-Word)</label>
                  <input 
                    type="text" 
                    value={customValues.headlinePost || ''}
                    onChange={(e) => handleInputChange('headlinePost', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                    placeholder="e.g. Start Growing."
                  />
                </div>

                {/* Core Badge top header text */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Product Core Category Badge</label>
                  <input 
                    type="text" 
                    value={customValues.coreBadge || ''}
                    onChange={(e) => handleInputChange('coreBadge', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                    placeholder="e.g. Simple Business System"
                  />
                </div>

                {/* Hero Tagline sentence */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Main Product Tagline Sentence</label>
                  <textarea 
                    rows={2}
                    value={customValues.tagline || ''}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans resize-none"
                    placeholder="Your long brand tagline descriptor"
                  />
                </div>

                {/* About us badge label */}
                <div className="space-y-1.5 md:col-span-2">
                  <hr className="border-slate-800 my-2" />
                  <span className="text-[10px] font-mono font-bold text-teal-400 block uppercase tracking-widest mb-1">Company Info / About Us Metrics Section</span>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Metrics Title Headline</label>
                  <input 
                    type="text" 
                    value={customValues.aboutTitle || ''}
                    onChange={(e) => handleInputChange('aboutTitle', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                    placeholder="e.g. Offline Sales Support For All Businesses"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Metrics Detailed Paragraph Text</label>
                  <textarea 
                    rows={3}
                    value={customValues.aboutDesc || ''}
                    onChange={(e) => handleInputChange('aboutDesc', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans resize-none"
                    placeholder="We created Jasper because..."
                  />
                </div>

                {/* Stat metric points */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Metric Point 1 Logo Header</label>
                  <input 
                    type="text" 
                    value={customValues.aboutEndpoints || ''}
                    onChange={(e) => handleInputChange('aboutEndpoints', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Metric Point 2 Logo Header</label>
                  <input 
                    type="text" 
                    value={customValues.aboutSupport || ''}
                    onChange={(e) => handleInputChange('aboutSupport', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Metric Point 3 Logo Header</label>
                  <input 
                    type="text" 
                    value={customValues.aboutCurrency || ''}
                    onChange={(e) => handleInputChange('aboutCurrency', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                {/* Footer and Legal Content Section */}
                <div className="space-y-1.5 md:col-span-2">
                  <hr className="border-slate-800 my-2" />
                  <span className="text-[10px] font-mono font-bold text-teal-400 block uppercase tracking-widest mb-1">Footer Titles & Copyright Customizer</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Footer Column 1 Title</label>
                  <input 
                    type="text" 
                    value={customValues.footerCol1Title || ''}
                    onChange={(e) => handleInputChange('footerCol1Title', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. Company Suite"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Footer Column 2 Title</label>
                  <input 
                    type="text" 
                    value={customValues.footerCol2Title || ''}
                    onChange={(e) => handleInputChange('footerCol2Title', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. Affiliates"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Footer Column 3 Title</label>
                  <input 
                    type="text" 
                    value={customValues.footerCol3Title || ''}
                    onChange={(e) => handleInputChange('footerCol3Title', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. Becoming a Partner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Footer Column 4 Title</label>
                  <input 
                    type="text" 
                    value={customValues.footerCol4Title || ''}
                    onChange={(e) => handleInputChange('footerCol4Title', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. Follow Us"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Footer Copyright Notice</label>
                  <input 
                    type="text" 
                    value={customValues.footerCopyright || ''}
                    onChange={(e) => handleInputChange('footerCopyright', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. © 2026 Jasper Business Suite Network. All rights reserved."
                  />
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: CONTACT BUTTONS & TARGET DETAILS */}
          {activeSubTab === 'links' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  📞 <strong>Installer Agent & Deployment Anchors</strong>: Setup the phone numbers and local emails displayed inside the buttons at the bottom of the landing page. Setting these allows visitors to tap the buttons to initiate calls or send deployment requests!
                </p>
              </div>

              <div className="space-y-4">
                
                {/* Agent phone settings */}
                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4.5 space-y-4">
                  <span className="text-[10px] font-mono font-bold text-amber-500 block uppercase tracking-widest flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Agent Hotline Settings
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-450 uppercase tracking-wider">Button Text Label</label>
                      <input 
                        type="text" 
                        value={customValues.contactPhoneLabel || ''}
                        onChange={(e) => handleInputChange('contactPhoneLabel', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                        placeholder="e.g. Call Local Agent"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-450 uppercase tracking-wider">Telephone Number (URI)</label>
                      <input 
                        type="text" 
                        value={customValues.contactPhone || ''}
                        onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                        placeholder="e.g. +255754002991"
                      />
                    </div>
                  </div>
                </div>

                {/* Email settings */}
                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4.5 space-y-4">
                  <span className="text-[10px] font-mono font-bold text-teal-450 text-teal-400 block uppercase tracking-widest flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Deployments Mailbox Settings
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-455 text-slate-400 uppercase tracking-wider">Button Text Label</label>
                      <input 
                        type="text" 
                        value={customValues.contactEmailLabel || ''}
                        onChange={(e) => handleInputChange('contactEmailLabel', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                        placeholder="e.g. Contact Deployments"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-455 text-slate-400 uppercase tracking-wider">Email Address</label>
                      <input 
                        type="text" 
                        value={customValues.contactEmail || ''}
                        onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                        placeholder="e.g. deployments@jasper.africa"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Portal Links & Social URLs */}
                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4.5 space-y-4">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 block uppercase tracking-widest flex items-center gap-1.5">
                    🌐 Footer Column 1: Links Customizer
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Home Page Link Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerHome || ''}
                        onChange={(e) => handleInputChange('footerHome', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">FAQ Link Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerFaq || ''}
                        onChange={(e) => handleInputChange('footerFaq', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Privacy Policy Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerPrivacy || ''}
                        onChange={(e) => handleInputChange('footerPrivacy', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Terms & Conditions Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerTerms || ''}
                        onChange={(e) => handleInputChange('footerTerms', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Contact Link Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerContact || ''}
                        onChange={(e) => handleInputChange('footerContact', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4.5 space-y-4">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 block uppercase tracking-widest flex items-center gap-1.5">
                    🤝 Footer Affiliate & Partner Links
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Join Affiliate Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerJoinAffiliate || ''}
                        onChange={(e) => handleInputChange('footerJoinAffiliate', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Affiliate Log In Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerAffiliateLogin || ''}
                        onChange={(e) => handleInputChange('footerAffiliateLogin', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Become a Partner Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerBecomePartner || ''}
                        onChange={(e) => handleInputChange('footerBecomePartner', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">Partner Log In Label</label>
                      <input 
                        type="text" 
                        value={customValues.footerPartnerLogin || ''}
                        onChange={(e) => handleInputChange('footerPartnerLogin', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4.5 space-y-4">
                  <span className="text-[10px] font-mono font-bold text-pink-400 block uppercase tracking-widest flex items-center gap-1.5">
                    📱 Footer Social Media Channels
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] uppercase tracking-wider font-bold">YouTube Channel URL</label>
                      <input 
                        type="text" 
                        value={customValues.socialYoutube || ''}
                        onChange={(e) => handleInputChange('socialYoutube', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] uppercase tracking-wider font-bold">Instagram Profile URL</label>
                      <input 
                        type="text" 
                        value={customValues.socialInstagram || ''}
                        onChange={(e) => handleInputChange('socialInstagram', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] uppercase tracking-wider font-bold">TikTok URL</label>
                      <input 
                        type="text" 
                        value={customValues.socialTiktok || ''}
                        onChange={(e) => handleInputChange('socialTiktok', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] uppercase tracking-wider font-bold">Facebook Page URL</label>
                      <input 
                        type="text" 
                        value={customValues.socialFacebook || ''}
                        onChange={(e) => handleInputChange('socialFacebook', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: PARTNERS & WAITLIST SETTINGS */}
          {activeSubTab === 'partners' && (
            <div className="space-y-6">
              <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  <strong>Partner Limit</strong>: set maximum active partners.
                </p>
              </div>

              {/* Threshold control card */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-mono font-bold text-amber-500 block uppercase tracking-widest flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> partner limit registry
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">Max Allowed Partners</label>
                    <input 
                      type="number" 
                      min={1}
                      max={100}
                      value={partnerCapacity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 5;
                        setPartnerCapacity(val);
                        localStorage.setItem('jasper_partner_capacity', val.toString());
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                    />
                    <p className="text-[10.5px] text-slate-500 leading-relaxed font-sans">
                      Current threshold is set to <strong>{partnerCapacity}</strong> recruitment partners.
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-center space-y-1">
                    <span className="text-[10.5px] font-mono text-slate-400 uppercase">Active Partners</span>
                    <span className="text-2xl font-black font-mono text-white">
                      {(() => {
                        try {
                          const list = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
                          return list.filter((a: any) => a.isSuper === true || a.isSuper === 'true').length;
                        } catch (e) {
                          return 0;
                        }
                      })()}
                      <span className="text-xs text-slate-500 font-normal"> / {partnerCapacity}</span>
                    </span>
                    <span className="text-[9.5px] uppercase font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded self-start mt-1">
                      {(() => {
                        try {
                          const list = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
                          const count = list.filter((a: any) => a.isSuper === true || a.isSuper === 'true').length;
                          return count >= partnerCapacity ? "WAITLIST ACTIVE" : "SLOTS OPEN";
                        } catch (e) {
                          return "SLOTS OPEN";
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Waitlist collector table */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-mono font-bold text-teal-400 block uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> collected partner waitlist leads ({partnerWaitlist.length})
                </span>

                {partnerWaitlist.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 space-y-1.5">
                    <div className="text-xl">📭</div>
                    <h5 className="text-xs uppercase font-mono font-bold">No waitlisted users found</h5>
                    <p className="text-[10px] leading-relaxed font-sans">
                      All partner slots are open or no leads have registered under the threshold waitlist.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-950/20">
                    <table className="w-full text-xs font-mono text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                          <th className="p-3">Lead Full Name</th>
                          <th className="p-3">Phone Connection</th>
                          <th className="p-3">Added At</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {partnerWaitlist.map((lead: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/50 text-slate-200">
                            <td className="p-3 font-semibold font-sans">{lead.fullName}</td>
                            <td className="p-3 text-emerald-400">{lead.phoneNumber}</td>
                            <td className="p-3 text-slate-500">{lead.addedAt || 'N/A'}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete ${lead.fullName} from the waitlist?`)) {
                                    const updated = partnerWaitlist.filter((_, i) => i !== idx);
                                    setPartnerWaitlist(updated);
                                    localStorage.setItem('jasper_partner_waitlist', JSON.stringify(updated));
                                  }
                                }}
                                className="p-1 px-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/35 rounded-lg transition-colors cursor-pointer"
                                title="Remove Lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: OUTLINE FLOW PREVIEW */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-tight flex items-center gap-2">
                📱 Storefront Structural Layout Outline
              </h3>
              <span className="text-[9px] uppercase font-mono font-bold text-slate-400 bg-slate-850 px-2 py-0.5 rounded">
                Live Preview Map
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Below is how the frontpage looks right now. The hierarchy maps perfectly to standard HTML flow layout engine guidelines.
            </p>

            {/* MOCKUP CONTAINER LIST */}
            <div className="p-3 bg-slate-950/80 border border-slate-850 rounded-2xl space-y-2 max-h-[360px] overflow-y-auto">
              {/* Header mockup block */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono flex items-center justify-between text-slate-400">
                <span className="font-bold text-white flex items-center gap-1">🌐 Navigation Header</span>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-slate-950 text-emerald-400 border border-emerald-500/10 rounded">Pinned</span>
              </div>

              {/* Dynamic sections ordered */}
              {sectionsOrder.map((sectionId, index) => {
                const isSectionHidden = !!hiddenSections[sectionId];
                const section = DEFAULT_SECTIONS.find(item => item.id === sectionId);
                
                if (isSectionHidden) {
                  return (
                    <div key={sectionId} className="bg-slate-955/20 border border-dashed border-red-500/10 p-2.5 rounded-lg text-[10px] font-mono flex items-center justify-between text-red-500/50">
                      <span>{section?.label || sectionId} (HIDDEN)</span>
                      <span>--</span>
                    </div>
                  );
                }

                return (
                  <div key={sectionId} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-[10px] font-mono flex flex-col space-y-1.5">
                    <div className="flex justify-between items-center text-slate-350">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        📦 Block 0{index + 1}: {section?.label}
                      </span>
                      <span className="text-[8px] tracking-wider text-slate-500 uppercase">Order {index + 1}</span>
                    </div>

                    {/* Show dynamic overviews based on section type */}
                    {sectionId === 'landing-hero' && (
                      <div className="p-1 px-1.5 bg-slate-950 rounded text-[9px] text-slate-400 border border-slate-850 space-y-0.5">
                        <div className="flex justify-between"><span className="text-slate-500">Badge:</span> <span className="text-slate-300 font-bold">{customValues.coreBadge}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Title:</span> <span className="text-emerald-400 font-bold">{customValues.headlinePre} {customValues.headlinePost}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Tagline:</span> <span className="text-slate-300 truncate max-w-[180px]">{customValues.tagline}</span></div>
                      </div>
                    )}

                    {sectionId === 'about' && (
                      <div className="p-1 px-1.5 bg-slate-950 rounded text-[9px] text-slate-400 border border-slate-850 space-y-0.5">
                        <div className="flex justify-between"><span className="text-slate-500">Title:</span> <span className="text-slate-300 font-bold">{customValues.aboutTitle}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Registry:</span> <span className="text-teal-400">{customValues.aboutEndpoints}</span></div>
                      </div>
                    )}

                    {sectionId === 'contact' && (
                      <div className="p-1 px-1.5 bg-slate-950 rounded text-[9px] text-slate-400 border border-slate-850 space-y-0.5">
                        <div className="flex justify-between"><span className="text-slate-500">Phone button:</span> <span className="text-slate-300">{customValues.contactPhoneLabel} ({customValues.contactPhone})</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Email button:</span> <span className="text-slate-300">{customValues.contactEmailLabel} ({customValues.contactEmail})</span></div>
                      </div>
                    )}
                    
                    {['features', 'marquee-partners', 'testimonials', 'pricing', 'faqs'].includes(sectionId) && (
                      <div className="text-[9px] text-slate-500 italic pl-1">
                        Uses standard responsive cards & structured local lists data
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Footer mockup block */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-805 text-[10px] font-mono flex items-center justify-between text-slate-400">
                <span className="font-bold text-white">🏢 System Footer</span>
                <span className="text-[8px] text-slate-500">© 2026 JASPER SUITE</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Live Storefront Shortcut</span>
            <a 
              href="/" 
              target="_blank" 
              className="flex items-center justify-center space-x-1.5 w-full bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white p-3 rounded-xl border border-slate-700 hover:border-slate-655 text-xs font-mono transition-colors cursor-pointer text-center"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Launch Website Landing Page</span>
            </a>
          </div>

        </div>

      </div>

    </div>
  );
}
