import React, { useState, FormEvent } from 'react';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Share2, 
  FileImage, 
  Mail, 
  Settings as SettingsIcon, 
  Globe, 
  ArrowUpRight, 
  Upload, 
  Trash2, 
  ExternalLink,
  Plus,
  Send,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import duressData from '../../data/duress-fake-data.json';

interface DuressDashboardProps {
  onLogout: () => void;
  onNavigate?: (route: string) => void;
}

export default function DuressDashboard({ onLogout }: DuressDashboardProps) {
  const [activeTab, setActiveTab] = useState<'earnings' | 'subscribers' | 'traffic' | 'affiliates' | 'ads' | 'messages' | 'settings'>('earnings');
  const [language, setLanguage] = useState<'EN' | 'SW'>('EN');
  const [silentEmergency, setSilentEmergency] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // local editable decoy states (resets on reload, offline)
  const [adMaterials, setAdMaterials] = useState(duressData.adMaterials);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newAdCategory, setNewAdCategory] = useState('WEBSITE BANNERS');
  const [newAdSize, setNewAdSize] = useState('Instagram Post (1080x1080)');
  const [newAdFile, setNewAdFile] = useState('');
  
  // Message Form states
  const [broadcastSubText, setBroadcastSubText] = useState('');
  const [broadcastAffText, setBroadcastAffText] = useState('');
  const [directSubName, setDirectSubName] = useState('John Doe');
  const [directSubText, setDirectSubText] = useState('');
  const [directAffName, setDirectAffName] = useState('John Doe');
  const [directAffText, setDirectAffText] = useState('');
  const [sentHistory, setSentHistory] = useState(duressData.historyMessages);

  // Settings mock states
  const [decoySaaSTitle, setDecoySaaSTitle] = useState('Jasper SaaS Lite Console');
  const [billCycle, setBillCycle] = useState('Every 30 Days');
  const [webhookUrl, setWebhookUrl] = useState('https://api.jaspersaas.com/v1/webhooks/tz_notify');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleLanguageChange = (lang: 'EN' | 'SW') => {
    setLanguage(lang);
    if (lang === 'SW') {
      setSilentEmergency(true);
      showToast("⚠️ Mfumo umebadilishwa kuwa Kiswahili. (Emergency Sequence Initialized)");
    } else {
      setSilentEmergency(false);
      showToast("Language changed to English");
    }
  };

  // Add ad material
  const handleFakeUploadAd = (e: FormEvent) => {
    e.preventDefault();
    const fileName = newAdFile ? newAdFile.trim() : `Jasper_Material_${Math.floor(Math.random() * 9000 + 1000)}.jpg`;
    const newAd = {
      id: `ad-${Date.now()}`,
      file: fileName,
      category: newAdCategory,
      size: newAdSize,
      uploaded: 'Just now',
      downloads: 0
    };
    setAdMaterials(prev => [...prev, newAd]);
    setShowUploadForm(false);
    setNewAdFile('');
    showToast(`✅ Material "${fileName}" uploaded successfully to affiliate portal!`);
  };

  const handleFakeDeleteAd = (id: string, fileName: string) => {
    setAdMaterials(prev => prev.filter(ad => ad.id !== id));
    showToast(`🗑️ "${fileName}" offline index purged.`);
  };

  // Send message handlers
  const handleSendBroadcastSubliers = (e: FormEvent) => {
    e.preventDefault();
    if (!broadcastSubText.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      subject: broadcastSubText.length > 32 ? broadcastSubText.substring(0, 32) + '...' : broadcastSubText,
      target: 'All Subscribers',
      time: 'Just now',
      delivered: 10
    };
    setSentHistory(prev => [newMsg, ...prev]);
    setBroadcastSubText('');
    showToast("✅ Broadcast sent successfully to all 10 active subscribers!");
  };

  const handleSendBroadcastAffiliates = (e: FormEvent) => {
    e.preventDefault();
    if (!broadcastAffText.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      subject: broadcastAffText.length > 32 ? broadcastAffText.substring(0, 32) + '...' : broadcastAffText,
      target: 'All Affiliates',
      time: 'Just now',
      delivered: 4
    };
    setSentHistory(prev => [newMsg, ...prev]);
    setBroadcastAffText('');
    showToast("✅ Broadcast sent successfully to all 4 affiliates!");
  };

  const handleSendDirectSub = (e: FormEvent) => {
    e.preventDefault();
    if (!directSubText.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      subject: directSubText.length > 32 ? directSubText.substring(0, 32) + '...' : directSubText,
      target: `${directSubName} (Direct)`,
      time: 'Just now',
      delivered: 1
    };
    setSentHistory(prev => [newMsg, ...prev]);
    setDirectSubText('');
    showToast(`✅ Direct message sent successfully to subscriber ${directSubName}!`);
  };

  const handleSendDirectAff = (e: FormEvent) => {
    e.preventDefault();
    if (!directAffText.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      subject: directAffText.length > 32 ? directAffText.substring(0, 32) + '...' : directAffText,
      target: `${directAffName} (Direct)`,
      time: 'Just now',
      delivered: 1
    };
    setSentHistory(prev => [newMsg, ...prev]);
    setDirectAffText('');
    showToast(`✅ Direct message sent to affiliate ${directAffName}!`);
  };

  return (
    <div id="duress-main-page" className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans antialiased overflow-x-hidden">
      
      {/* HEADER BAR */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-left">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg font-mono">
            J
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">{decoySaaSTitle}</h1>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider block">TZS OPERATING NODE #441</span>
          </div>
        </div>

        {/* TOP RIGHT LANGUAGE SWITCH & LOGOUT */}
        <div className="flex items-center space-x-4">
          
          {/* Language selection triggers emergency sequence if set to Swahili */}
          <div className="relative">
            <button
              onClick={() => handleLanguageChange(language === 'EN' ? 'SW' : 'EN')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-705 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'EN' ? '🌐 English ▼' : '🌐 Kiswahili ▼'}</span>
            </button>
          </div>

          <button 
            type="button" 
            onClick={onLogout} 
            className="px-4 py-1.5 bg-red-950/20 border border-red-900 hover:bg-red-900 hover:text-white text-red-300 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* DUAL MAIN CONTAINER: LEFT SIDEBAR & CENTRAL CONTENT PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(110vh-73px)]">
        
        {/* LEFT SIDEBAR MENU PANEL */}
        <aside className="lg:col-span-2 bg-[#0d1424] border-r border-slate-800/80 p-5 space-y-2">
          <div className="pb-4 border-b border-slate-800 mb-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block pl-2">CONSOLE SECTIONS</span>
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('earnings')}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'earnings' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <DollarSign className="w-4 h-4 shrink-0" />
                <span>💰 Earnings</span>
              </span>
              {activeTab === 'earnings' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </button>

            <button
              onClick={() => setActiveTab('subscribers')}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'subscribers' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <Users className="w-4 h-4 shrink-0" />
                <span>👥 Subscribers</span>
              </span>
              {activeTab === 'subscribers' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </button>

            <button
              onClick={() => setActiveTab('traffic')}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'traffic' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>🔗 Traffic Sources</span>
              </span>
              {activeTab === 'traffic' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </button>

            <button
              onClick={() => setActiveTab('affiliates')}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'affiliates' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <Share2 className="w-4 h-4 shrink-0" />
                <span>🤝 Affiliates</span>
              </span>
              {activeTab === 'affiliates' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </button>

            <button
              onClick={() => setActiveTab('ads')}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'ads' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <FileImage className="w-4 h-4 shrink-0" />
                <span>📢 Affiliate Ads</span>
              </span>
              {activeTab === 'ads' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'messages' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <Mail className="w-4 h-4 shrink-0" />
                <span>✉️ Messages</span>
              </span>
              {activeTab === 'messages' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left px-3 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'settings' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center space-x-2.5">
                <SettingsIcon className="w-4 h-4 shrink-0" />
                <span>⚙️ Settings</span>
              </span>
              {activeTab === 'settings' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </button>
          </nav>

          {/* EMERGENCY TELEMETRY REPORT AREA - Visible only to operator */}
          <div className="pt-20">
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850 text-[11px] space-y-1.5 relative overflow-hidden">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase">
                <span>SECURITY HOOK</span>
                <span>STATE</span>
              </div>
              <p className="font-mono text-slate-400 font-semibold leading-tight text-[11.5px]">
                {silentEmergency ? "🚨 Emergency active. GPS Triangulation Lock broadcast." : "✓ Silent Duress Shield Connected"}
              </p>
              {silentEmergency && (
                <div className="w-full h-1 bg-red-500 rounded animate-pulse" />
              )}
            </div>
          </div>
        </aside>

        {/* CENTRAL VIEW CONTROLLER */}
        <main className="lg:col-span-10 p-6 space-y-6 bg-[#090b11]">
          
          {/* TOAST SYSTEM OR ALERT MESSAGE */}
          {toastMessage && (
            <div className="fixed bottom-5 right-5 z-50 p-4 bg-emerald-950 border border-emerald-500 text-emerald-200 font-sans shadow-2xl rounded-2xl flex items-center space-x-3 text-xs tracking-wide animate-slide-up">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* ==================== TAB 1: EARNINGS ==================== */}
          {activeTab === 'earnings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white font-sans">SaaS Financial Earnings Summary</h2>
                  <p className="text-xs text-slate-400">Regional payments.</p>
                </div>
                <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono font-bold text-slate-400 uppercase">
                  LOCAL DISPATCH: ON
                </span>
              </div>

              {/* FAKE OVERVIEW CARD */}
              <div className="bg-slate-905 border border-slate-850 p-5 rounded-3xl space-y-4">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                  TOTAL EARNINGS OVERVIEW
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div className="p-3.5 bg-[#0e1424] rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">Today</span>
                    <span className="text-lg font-bold font-mono text-white block mt-1">{duressData.earnings.summary.today}</span>
                  </div>

                  <div className="p-3.5 bg-[#0e1424] rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">This Week</span>
                    <span className="text-lg font-bold font-mono text-white block mt-1">{duressData.earnings.summary.week}</span>
                  </div>

                  <div className="p-3.5 bg-[#0e1424] rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono font-semibold text-emerald-400">This Month</span>
                    <span className="text-lg font-bold font-mono text-emerald-400 block mt-1">{duressData.earnings.summary.month}</span>
                  </div>

                  <div className="p-3.5 bg-[#0e1424] rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">This Year</span>
                    <span className="text-lg font-bold font-mono text-white block mt-1">{duressData.earnings.summary.year}</span>
                  </div>

                  <div className="p-3.5 bg-[#0e1424] rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-mono">All Time</span>
                    <span className="text-lg font-bold font-mono text-indigo-400 block mt-1">{duressData.earnings.summary.allTime}</span>
                  </div>
                </div>
              </div>

              {/* BAR CHART SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 6 months bar graph */}
                <div className="lg:col-span-2 bg-slate-905 border border-slate-850 p-5 rounded-3xl space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                      MONTHLY REVENUE BAR CHART (LAST 6 MONTHS)
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Stable Minimal Growth</span>
                  </div>

                  <div className="space-y-4 pt-2">
                    {duressData.earnings.history.map((h, i) => {
                      // Map monthly values to percentage widths: max is June index, 920,000
                      const amounts = [720, 680, 810, 750, 890, 920];
                      const widths = [75, 70, 85, 80, 95, 100];
                      return (
                        <div key={h.month} className="space-y-1.5">
                          <div className="flex justify-between text-xs text-slate-300 font-mono">
                            <span className="font-sans font-medium text-white">{h.month}</span>
                            <span className="font-bold">{h.amount}</span>
                          </div>
                          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-850/60">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                i === 5 ? 'bg-emerald-500' : 'bg-indigo-600/80'
                              }`}
                              style={{ width: `${widths[i]}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Statistics panel */}
                <div className="bg-slate-905 border border-slate-850 p-5 rounded-3xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                      MEMBERSHIP RATIOS
                    </span>

                    <div className="divide-y divide-slate-850/60 font-sans">
                      <div className="flex justify-between py-2 text-xs">
                        <span className="text-slate-400">Total Active Subscriptions:</span>
                        <span className="font-bold text-white">{duressData.earnings.stats.active}</span>
                      </div>
                      <div className="flex justify-between py-2 text-xs">
                        <span className="text-slate-400">Total Expired Subscriptions:</span>
                        <span className="font-bold text-amber-400">{duressData.earnings.stats.expired}</span>
                      </div>
                      <div className="flex justify-between py-2 text-xs">
                        <span className="text-slate-400">Total Suspended Accounts:</span>
                        <span className="font-bold text-red-400">{duressData.earnings.stats.suspended}</span>
                      </div>
                      <div className="flex justify-between py-2 text-xs">
                        <span className="text-slate-400">Total Subscribers Ever:</span>
                        <span className="font-bold text-slate-200">{duressData.earnings.stats.totalEver}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-1.5 mt-4">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">ESTIMATED MRR</span>
                    <span className="text-2xl font-black font-mono text-indigo-400 tracking-tight block">
                      {duressData.earnings.stats.mrr}
                    </span>
                    <p className="text-[9.5px] text-slate-500 font-sans leading-relaxed">Based on current active member profiles.</p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================== TAB 2: SUBSCRIBERS ==================== */}
          {activeTab === 'subscribers' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-white font-sans">Subscribers Registry Directory</h2>
                <p className="text-xs text-slate-400">Client archive.</p>
              </div>

              {/* THREE MAIN RATIO STAT CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-905 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-mono block">ACTIVE LICENSE HOOKS</span>
                  <span className="text-2xl font-black text-emerald-400 block mt-0.5">{duressData.earnings.stats.active}</span>
                </div>
                
                <div className="bg-slate-905 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-mono block">EXPIRED LICENSES</span>
                  <span className="text-2xl font-black text-amber-500 block mt-0.5">{duressData.earnings.stats.expired}</span>
                </div>

                <div className="bg-slate-905 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-mono block">SUSPENDED LICENSES</span>
                  <span className="text-2xl font-black text-rose-500 block mt-0.5">{duressData.earnings.stats.suspended}</span>
                </div>

                <div className="bg-slate-905 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-mono block">TOTAL SYSTEMS EVER</span>
                  <span className="text-2xl font-black text-indigo-400 block mt-0.5">18</span>
                </div>
              </div>

              {/* FULL TABLE LIST OF ALL 18 SUBSCRIBERS */}
              <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-slate-850 mb-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-black">REGISTERED MERCHANT GRID ({duressData.subscribers.length} total)</span>
                  <span className="text-xs text-slate-400 font-medium">RECURRING VALUE: <strong className="font-bold text-indigo-400 font-mono">{duressData.earnings.stats.mrr}</strong></span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-850/80 font-mono font-bold text-slate-400">
                        <th className="py-2.5">Subscriber Name</th>
                        <th className="py-2.5">Business / Outlet</th>
                        <th className="py-2.5">License Package</th>
                        <th className="py-2.5">Rate Amount</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5">Days Left / Overdue</th>
                        <th className="py-2.5">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50 font-sans">
                      {duressData.subscribers.map((sub, index) => {
                        let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                        if (sub.status.includes("Expired")) {
                          statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                        } else if (sub.status.includes("Suspended")) {
                          statusColor = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                        }
                        return (
                          <tr key={sub.name + '-' + index} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 font-semibold text-white">{sub.name}</td>
                            <td className="py-3 text-slate-300">{sub.business}</td>
                            <td className="py-3 font-mono text-[11px] text-slate-400">{sub.package}</td>
                            <td className="py-3 font-mono text-white">{sub.amount}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-medium tracking-wide inline-block ${statusColor}`}>
                                {sub.status}
                              </span>
                            </td>
                            <td className="py-3 font-mono text-xs">
                              {sub.daysLeft.includes("⚠️") || sub.daysLeft.includes("failed") || sub.daysLeft.includes("overdue") ? (
                                <span className="text-rose-400 font-bold">{sub.daysLeft}</span>
                              ) : (
                                <span className="text-slate-400">{sub.daysLeft}</span>
                              )}
                            </td>
                            <td className="py-3 text-slate-400 font-medium">{sub.source}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: TRAFFIC SOURCES ==================== */}
          {activeTab === 'traffic' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-white font-sans">Organic Conversion Channels & Leads</h2>
                <p className="text-xs text-slate-400">Traffic sources.</p>
              </div>

              {/* OVERVIEW SECTION BOX */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Traffic summary graph block */}
                <div className="bg-slate-905 border border-slate-850 p-5 rounded-3xl space-y-5">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                    WHERE MY SUBSCRIBERS COME FROM
                  </span>

                  {/* 50/50 Direct vs Affiliate bars */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" />
                          <span className="text-white">🌐 Website Direct</span>
                        </span>
                        <span className="text-slate-200 font-mono">9 subscribers (50%)</span>
                      </div>
                      <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '50%' }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                          <span className="text-white">🤝 Via Affiliates</span>
                        </span>
                        <span className="text-slate-200 font-mono">9 subscribers (50%)</span>
                      </div>
                      <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '50%' }} />
                      </div>
                    </div>
                  </div>

                  {/* Aesthetic visual illustration */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex items-center justify-between text-xs">
                    <div className="space-y-1 text-left">
                      <span className="font-bold text-white block">Traffic Conversion Balanced</span>
                      <p className="text-slate-400 text-[11px] leading-relaxed max-w-sm">
                        Perfect alignment between paid publisher recommendations and direct SEO content leads. Ensures reliable cost mitigation parameters.
                      </p>
                    </div>
                    <ArrowUpRight className="w-8 h-8 text-slate-700 shrink-0" />
                  </div>
                </div>

                {/* Affiliate Leaderboard breakdown */}
                <div className="bg-slate-905 border border-slate-850 p-5 rounded-3xl space-y-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                    AFFILIATE CHANNEL REFERRAL COUNT
                  </span>

                  <div className="divide-y divide-slate-850/60 pt-2 font-mono">
                    {duressData.traffic.affiliateTable.map((aff, index) => {
                      // Width percentages for the bars
                      const percentages = [80, 55, 55, 30, 30];
                      return (
                        <div key={aff.name} className="flex items-center justify-between py-2.5 text-xs">
                          <div className="flex-1 max-w-[120px] font-sans font-medium text-slate-300">
                            {aff.name}
                          </div>
                          
                          {/* Mini visual indicator */}
                          <div className="flex-1 px-4 text-left hidden sm:block">
                            <div className="w-full max-w-[140px] h-2 bg-slate-950 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${index === 0 ? 'bg-amber-500' : 'bg-emerald-500/80'}`} 
                                style={{ width: `${percentages[index]}%` }} 
                              />
                            </div>
                          </div>

                          <div className="font-bold text-white shrink-0">
                            {aff.count} subscriber{aff.count > 1 ? 's' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================== TAB 4: AFFILIATES ==================== */}
          {activeTab === 'affiliates' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-white font-sans">Affiliates & Partners Hub</h2>
                <p className="text-xs text-slate-400">Manage marketers.</p>
              </div>

              {/* OVERVIEW PANEL GROUP */}
              <div className="bg-slate-905 border border-slate-850 p-5 rounded-3xl space-y-4">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                  AFFILIATE NETWORK SUMMARY
                </span>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-mono">Total Marketers</span>
                    <span className="text-base font-black text-white block mt-0.5">{duressData.affiliateSummary.total} registered</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-mono">Active Nodes</span>
                    <span className="text-base font-black text-emerald-400 block mt-0.5">{duressData.affiliateSummary.active} active</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-mono">Suspended Nodes</span>
                    <span className="text-base font-black text-rose-400 block mt-0.5">{duressData.affiliateSummary.inactive} inactive</span>
                  </div>

                  <div className="p-3 bg-[#0d1424] rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-amber-400 block font-mono font-black">Commission Owed</span>
                    <span className="text-base font-black text-amber-400 block mt-0.5">{duressData.affiliateSummary.owedThisMonth} TZS</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-mono">Total Paid Ever</span>
                    <span className="text-base font-black text-indigo-400 block mt-0.5">{duressData.affiliateSummary.paidEver} TZS</span>
                  </div>
                </div>
              </div>

              {/* TWO PANEL DIVISION: CHANNELS & SETTLEMENT SCHEDULING */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Affiliates List */}
                <div className="lg:col-span-2 bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                    MARKETERS COMMISSION DETAIL DIRECTORY
                  </span>

                  <div className="space-y-3.5 pt-1">
                    {duressData.affiliates.map((aff) => {
                      const isInactive = aff.status === 'Inactive';
                      return (
                        <div 
                          key={aff.name}
                          className={`p-4 rounded-2xl border transition-colors ${
                            isInactive 
                              ? 'bg-slate-950/30 border-slate-900/40 text-slate-500' 
                              : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-100'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className={`font-bold font-sans text-xs ${isInactive ? 'text-slate-500' : 'text-white'}`}>{aff.name}</span>
                                {aff.performance && (
                                  <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[9px] font-mono font-bold">
                                    {aff.performance}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-550 block font-mono mt-0.5">Referred: {aff.referred}</span>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold uppercase ${
                              isInactive 
                                ? 'bg-slate-900 text-slate-600 border border-slate-800' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              {aff.status}
                            </span>
                          </div>

                          {/* Stat items inside affiliate */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-slate-900/60 font-mono text-[10.5px]">
                            <div>
                              <span className="text-slate-500 block">Monthly Sales</span>
                              <span className="font-bold text-slate-300">{aff.revenue}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Payout Rate</span>
                              <span className="font-bold text-slate-300">{aff.rate}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Owed This Period</span>
                              <span className="font-bold text-amber-400">{aff.owed}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Total Disbursed</span>
                              <span className="font-bold text-slate-300">{aff.paid}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-3.5 pt-2 border-t border-slate-900/40">
                            <span>Pending Payout Hook: <strong className="text-rose-400 font-bold">{aff.pending}</strong></span>
                            <span>Last active node: {aff.activeTime}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Total to pay affiliates this month ledger */}
                <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="text-[10px] font-mono text-slate-550 uppercase tracking-widest block font-black">
                      TOTAL TO PAY AFFILIATES
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans font-light">
                      Settlements compiled automatically from direct referrals. Clicking pay simulates transaction clearance safely.
                    </p>

                    <div className="space-y-3 pt-2 font-mono text-xs">
                      {duressData.affiliates.map((aff) => (
                        <div key={aff.name} className="flex justify-between items-center py-1 border-b border-slate-900">
                          <span className="text-slate-400 font-sans">{aff.name}:</span>
                          <span className="font-bold text-slate-200">{aff.owed} TZS</span>
                        </div>
                      ))}

                      <div className="flex justify-between items-center pt-2 text-stone-200 text-xs font-bold font-mono">
                        <span>TOTAL DUE THIS CYCLE:</span>
                        <span className="text-amber-400 font-black text-sm">{duressData.affiliateSummary.owedThisMonth}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      onClick={() => showToast("✅ All outstanding commissions settled successfully on offline ledger.")}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 hover:text-white transition-all text-white font-mono text-xs font-bold uppercase tracking-wider rounded-2xl cursor-pointer flex items-center justify-center space-x-2"
                    >
                      <span>Pay All Owed Commissions</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================== TAB 5: AFFILIATE ADS ==================== */}
          {activeTab === 'ads' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white font-sans">Affiliate Marketing Materials & Media</h2>
                  <p className="text-xs text-slate-400">Manage flyers.</p>
                </div>
                
                <button
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-505 text-white rounded-xl text-xs font-bold flex items-center space-x-2 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Upload New Ad Material</span>
                </button>
              </div>

              {/* FAKE UPLOAD MODAL FORM SHOWING ON DEMAND */}
              {showUploadForm && (
                <form onSubmit={handleFakeUploadAd} className="bg-slate-905 border border-slate-850 p-5 rounded-3xl space-y-4 animate-slide-up max-w-xl">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <span className="text-xs font-black text-white font-mono uppercase">UPLOAD NEW PROMOTIONAL AD MATERIAL</span>
                    <button 
                      type="button" 
                      onClick={() => setShowUploadForm(false)} 
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-black">Promotion Ad Type Select</label>
                      <select
                        value={newAdCategory}
                        onChange={(e) => setNewAdCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 p-2 text-white text-xs focus:outline-none rounded cursor-pointer"
                      >
                        <option value="WEBSITE BANNERS">Website Banners</option>
                        <option value="SOCIAL MEDIA">Social Media Content (Instagram / TikTok)</option>
                        <option value="PRINT FLYER">A4 / A5 Print Flyer</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-black font-mono">Format Layout Dimensions</label>
                      <select
                        value={newAdSize}
                        onChange={(e) => setNewAdSize(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 p-2 text-white text-xs focus:outline-none rounded cursor-pointer"
                      >
                        <option value="Leaderboard (728x90)">Leaderboard (728x90)</option>
                        <option value="Medium Rectangle (300x250)">Medium Rectangle (300x250)</option>
                        <option value="Half Page (300x600)">Half Page (300x600)</option>
                        <option value="Instagram Post (1080x1080)">Instagram Post (1080x1080)</option>
                        <option value="Story/TikTok (1080x1920)">Story/TikTok (1080x1920)</option>
                        <option value="Facebook/YouTube (1920x1080)">Facebook/YouTube (1920x1080)</option>
                        <option value="Flyer A4 (210x297mm)">Flyer A4</option>
                        <option value="Flyer A5 (148x210mm)">Flyer A5</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-mono">Simulated Ad Image Filename</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jasper_Spring_Promo_Mobile.jpg"
                      value={newAdFile}
                      onChange={(e) => setNewAdFile(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-white text-xs focus:outline-none rounded"
                    />
                  </div>

                  {/* Drag-and-drop placeholder */}
                  <div className="border border-dashed border-slate-800 bg-slate-950/40 rounded-2xl p-6 text-center space-y-1.5 cursor-pointer hover:border-slate-700 transition-colors">
                    <Upload className="w-5 h-5 text-slate-500 mx-auto" />
                    <span className="block text-xs font-bold text-slate-300">Drag promo image flyer or select from disk</span>
                    <span className="text-[10px] text-slate-550 block">PNG, JPEG or SVG files supported up to 5MB</span>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadForm(false)}
                      className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs hover:text-white transition-colors text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-505 rounded-xl text-xs text-white font-bold cursor-pointer font-sans"
                    >
                      Simulate Upload
                    </button>
                  </div>
                </form>
              )}

              {/* TWO SECTIONS FOR BANNER LISTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Website banners */}
                <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                    WEBSITE DIRECT BANNER CAMPAIGNS ({adMaterials.filter(a => a.category === 'WEBSITE BANNERS').length} ads)
                  </span>

                  <div className="space-y-3 pt-1">
                    {adMaterials.filter(a => a.category === 'WEBSITE BANNERS').map(ad => (
                      <div key={ad.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-850 flex items-center justify-between gap-4 hover:border-slate-800 transition-colors">
                        <div className="flex items-center space-x-3 text-left">
                          <div className="p-2.5 bg-indigo-500/5 text-indigo-400 rounded-xl border border-indigo-500/10 h-10 w-10 flex items-center justify-center shrink-0">
                            <FileImage className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-200 truncate max-w-[200px]">{ad.file}</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Size: {ad.size} • Uploaded {ad.uploaded}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span className="text-[10.5px] font-mono text-slate-400 font-bold">{ad.downloads} downloads</span>
                          <button
                            onClick={() => alert(`📂 Mocking template preview for "${ad.file}" [${ad.size}] successfully.`)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white rounded text-[10.5px] text-slate-300 font-sans cursor-pointer"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => handleFakeDeleteAd(ad.id, ad.file)}
                            className="p-1.5 bg-red-950/20 text-red-400 hover:bg-red-900 hover:text-white rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Media Content */}
                <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                    SOCIAL MEDIA PLATFORM TEMPLATES ({adMaterials.filter(a => a.category === 'SOCIAL MEDIA').length} ads)
                  </span>

                  <div className="space-y-3 pt-1">
                    {adMaterials.filter(a => a.category === 'SOCIAL MEDIA').map(ad => (
                      <div key={ad.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-850 flex items-center justify-between gap-4 hover:border-slate-800 transition-colors">
                        <div className="flex items-center space-x-3 text-left">
                          <div className="p-2.5 bg-emerald-500/5 text-emerald-400 rounded-xl border border-emerald-500/15 h-10 w-10 flex items-center justify-center shrink-0">
                            <FileImage className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-200 truncate max-w-[200px]">{ad.file}</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Size: {ad.size} • Uploaded {ad.uploaded}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span className="text-[10.5px] font-mono text-slate-400 font-bold">{ad.downloads} downloads</span>
                          <button
                            onClick={() => alert(`📂 Mocking template preview for "${ad.file}" [${ad.size}] successfully.`)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white rounded text-[10.5px] text-slate-300 font-sans cursor-pointer"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => handleFakeDeleteAd(ad.id, ad.file)}
                            className="p-1.5 bg-red-950/20 text-red-400 hover:bg-red-900 hover:text-white rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================== TAB 6: MESSAGES ==================== */}
          {activeTab === 'messages' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-white font-sans">Dispatch Broadcast Notifications & Inbox</h2>
                <p className="text-xs text-slate-400">Send updates.</p>
              </div>

              {/* BROADCAST vs DIRECT PANELS CONTAINER */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. BROADCAST MESSAGES */}
                <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black border-b border-slate-900 pb-2">
                    📢 BROADCAST MESSAGES
                  </span>

                  {/* Broadcast to all 10 active subscribers */}
                  <form onSubmit={handleSendBroadcastSubliers} className="p-4 bg-slate-950 rounded-2xl border border-slate-850 space-y-3">
                    <span className="text-[10px] text-indigo-400 uppercase font-mono font-bold block">SEND TO ALL ACTIVE SUBSCRIBERS</span>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block">Message Body</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Write update..."
                        className="w-full bg-slate-900 border border-slate-850 p-2 text-white text-xs focus:outline-none rounded font-sans resize-none"
                        value={broadcastSubText}
                        onChange={(e) => setBroadcastSubText(e.target.value)}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#0e1424] hover:bg-slate-900 border border-slate-800 text-xs font-mono font-bold uppercase rounded-xl hover:text-white cursor-pointer transition-colors"
                    >
                      [Send to All 10 Active Subscribers]
                    </button>
                  </form>

                  {/* Broadcast to all affiliates */}
                  <form onSubmit={handleSendBroadcastAffiliates} className="p-4 bg-slate-950 rounded-2xl border border-slate-850 space-y-3">
                    <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold block">SEND TO ALL REGISTERED AFFILIATES</span>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block">Message Body</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Write message..."
                        className="w-full bg-slate-900 border border-slate-850 p-2 text-white text-xs focus:outline-none rounded font-sans resize-none"
                        value={broadcastAffText}
                        onChange={(e) => setBroadcastAffText(e.target.value)}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#0e1424] hover:bg-slate-900 border border-slate-800 text-xs font-mono font-bold uppercase rounded-xl hover:text-white cursor-pointer transition-colors"
                    >
                      [Send to All 4 Affiliates]
                    </button>
                  </form>

                </div>

                {/* 2. DIRECT MESSAGES */}
                <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-4">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black border-b border-slate-900 pb-2">
                    ✉️ DIRECT CHANNELS
                  </span>

                  {/* Specific subscriber */}
                  <form onSubmit={handleSendDirectSub} className="p-4 bg-slate-950 rounded-2xl border border-slate-850 space-y-3">
                    <span className="text-[10px] text-slate-300 uppercase font-bold block">SEND TO SPECIFIC SUBSCRIBER</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 block">Select Recipient</label>
                        <select
                          className="w-full bg-slate-900 border border-slate-850 p-1.5 text-white text-xs focus:outline-none rounded cursor-pointer font-bold"
                          value={directSubName}
                          onChange={(e) => setDirectSubName(e.target.value)}
                        >
                          {duressData.subscribers.map((s, index) => (
                            <option key={`sub-opt-${index}`} value={s.name}>{s.name} ({s.business})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 block">Quick Text Body</label>
                        <input
                          type="text"
                          required
                          placeholder="Compose brief direct notification..."
                          className="w-full bg-slate-900 border border-slate-850 p-1.5 text-white text-xs focus:outline-none rounded"
                          value={directSubText}
                          onChange={(e) => setDirectSubText(e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-1.5 bg-[#0e1424] hover:bg-[#131d34] border border-slate-800 text-xs font-mono font-bold uppercase rounded-xl text-slate-300 hover:text-white cursor-pointer transition-colors flex items-center justify-center space-x-2"
                    >
                      <Send className="w-3 h-3" />
                      <span>[Send Message]</span>
                    </button>
                  </form>

                  {/* Specific Affiliate */}
                  <form onSubmit={handleSendDirectAff} className="p-4 bg-slate-950 rounded-2xl border border-slate-850 space-y-3">
                    <span className="text-[10px] text-slate-300 uppercase font-bold block">SEND TO SPECIFIC AFFILIATE</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 block font-mono">Select Affiliate Partner</label>
                        <select
                          className="w-full bg-slate-900 border border-slate-850 p-1.5 text-white text-xs focus:outline-none rounded cursor-pointer font-bold"
                          value={directAffName}
                          onChange={(e) => setDirectAffName(e.target.value)}
                        >
                          <option value="John Doe">John Doe</option>
                          <option value="Jane Doe">Jane Doe</option>
                          <option value="Jane Doe">Jane Doe</option>
                          <option value="John Doe">John Doe</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 block font-mono">Message Text</label>
                        <input
                          type="text"
                          required
                          placeholder="Referred campaign notes..."
                          className="w-full bg-slate-900 border border-slate-850 p-1.5 text-white text-xs focus:outline-none rounded"
                          value={directAffText}
                          onChange={(e) => setDirectAffText(e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-1.5 bg-[#0e1424] hover:bg-[#131d34] border border-slate-800 text-xs font-mono font-bold uppercase rounded-xl text-slate-300 hover:text-white cursor-pointer transition-colors flex items-center justify-center space-x-2"
                    >
                      <Send className="w-3 h-3" />
                      <span>[Send Message]</span>
                    </button>
                  </form>

                </div>

              </div>

              {/* RECENT MESSAGE HISTORY */}
              <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-4">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black border-b border-slate-900 pb-2">
                  📜 RECENT MESSAGE HISTORY & TRANSMISSION CODES (LAST 5 SENT)
                </span>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 font-sans">
                    <thead>
                      <tr className="border-b border-slate-850 font-mono font-bold text-slate-400">
                        <th className="py-2">Message Label Description</th>
                        <th className="py-2">Sent Recipient</th>
                        <th className="py-2">Timestamp</th>
                        <th className="py-2 text-right">Delivered Hooks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50">
                      {sentHistory.slice(0, 6).map((msg, index) => (
                        <tr key={msg.id || index} className="hover:bg-slate-900/20 transition-colors">
                          <td className="py-2.5 font-semibold text-white flex items-center space-x-2">
                            <span>✉️</span>
                            <span className="truncate max-w-[280px]">{msg.subject}</span>
                          </td>
                          <td className="py-2.5 font-medium text-slate-400">{msg.target}</td>
                          <td className="py-2.5 font-mono text-stone-500 text-[10.5px]">{msg.time}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                            {msg.delivered} ✅
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ==================== TAB 7: SETTINGS ==================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-white font-sans">System & Decoy Configuration Settings</h2>
                <p className="text-xs text-slate-400">Edit display settings.</p>
              </div>

              <div className="bg-slate-905 border border-slate-850 rounded-3xl p-5 space-y-5 max-w-2xl">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-black">
                  DECOY PLATFORM PARAMS
                </span>

                <div className="space-y-4 font-sans text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Fake SaaS Interface Title</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-850 p-2 text-white focus:outline-none rounded font-sans"
                      value={decoySaaSTitle}
                      onChange={(e) => setDecoySaaSTitle(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Recurring Billing Period</label>
                      <select
                        className="w-full bg-slate-900 border border-slate-850 p-2 text-white focus:outline-none rounded cursor-pointer font-bold"
                        value={billCycle}
                        onChange={(e) => setBillCycle(e.target.value)}
                      >
                        <option value="Every 30 Days">Every 30 Days</option>
                        <option value="Bi-Weekly Sync">Bi-Weekly Sync</option>
                        <option value="Annual License Plan">Annual License Plan</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block uppercase font-mono font-bold">Mock Region Code Currency</label>
                      <input
                        type="text"
                        disabled
                        className="w-full bg-slate-950 border border-slate-850/60 p-2 text-slate-500 focus:outline-none rounded font-mono font-bold"
                        value="TZS (Tanzania Shillings)"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block uppercase font-mono tracking-tight">System Outbound TLS Webhook Log Target</label>
                    <input
                      type="url"
                      className="w-full bg-slate-900 border border-slate-850 p-2 text-white focus:outline-none rounded font-mono"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => showToast("💾 Custom interface parameters stored securely index offline.")}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-505 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

      </div>
    </div>
  );
}
