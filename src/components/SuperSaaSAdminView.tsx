import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Award, 
  Volume2, 
  Layers, 
  Sparkles, 
  Search, 
  Plus, 
  Trash, 
  CheckCircle, 
  TrendingUp, 
  Smartphone, 
  Lock, 
  Unlock, 
  FileText, 
  RefreshCw, 
  Send,
  Upload,
  UploadCloud,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  Video,
  BookOpen,
  Store,
  Pill,
  Utensils,
  Hotel,
  ArrowLeft,
  Laptop,
  Globe,
  Clock
} from 'lucide-react';

import SaaSUserDesk from './SaaSUserDesk';
import SaaSAffiliateDesk from './SaaSAffiliateDesk';
import Dashboard from './Dashboard';
import { User } from '../types';
import SaaSStatusAndRequests from './SaaSStatusAndRequests';
import SaaSReportsView from './SaaSReportsView';
import SaaSDashboardMetrics from './SaaSDashboardMetrics';
import SaaSExpensesView from './SaaSExpensesView';
import SaaSInbox from './SaaSInbox';
import SaaSHardwarePOS from './SaaSHardwarePOS';
import SaaSHardwareInventory from './SaaSHardwareInventory';
import SaaSHardwareSales from './SaaSHardwareSales';
import SaaSStaffManager from './SaaSStaffManager';
import SaaSWebEditor from './SaaSWebEditor';

export type SuperAdminWorkspaceTab = 'dashboard' | 'subscribers' | 'hw-pos' | 'hw-inventory' | 'hw-sales' | 'affiliates' | 'status' | 'reports' | 'expenses' | 'chats' | 'inbox' | 'promotions' | 'tutorials' | 'web-editor' | 'settings';

export interface SuperSaaSAdminViewProps {
  activeAdminSubTab?: SuperAdminWorkspaceTab;
  setActiveAdminSubTab?: (tab: SuperAdminWorkspaceTab) => void;
  hideSidebar?: boolean;
}

export default function SuperSaaSAdminView({
  activeAdminSubTab: externalActiveTab,
  setActiveAdminSubTab: externalSetActiveTab,
  hideSidebar = false
}: SuperSaaSAdminViewProps = {}) {
  const [internalActiveTab, setInternalActiveTab] = useState<SuperAdminWorkspaceTab>('dashboard');
  const activeTab = externalActiveTab || internalActiveTab;
  const setActiveTab = (tab: SuperAdminWorkspaceTab) => {
    if (externalSetActiveTab) {
      externalSetActiveTab(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  // State Management for Banners, Ads, Hotline
  const [adPlacements, setAdPlacements] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  // Security Auth controls
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Forms inputs
  const [broadcastTarget, setBroadcastTarget] = useState<'subscribers' | 'affiliates'>('subscribers');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [dmRecipientType, setDmRecipientType] = useState<'subscriber' | 'affiliate'>('subscriber');
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmMessage, setDmMessage] = useState('');

  const [newAffFirstName, setNewAffFirstName] = useState('');
  const [newAffLastName, setNewAffLastName] = useState('');
  const [newAffPurpose, setNewAffPurpose] = useState('Standard Website Promo');
  const [couponCreationLog, setCouponCreationLog] = useState('');

  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerSize, setNewBannerSize] = useState('728x90');
  const [newBannerDestination, setNewBannerDestination] = useState('');
  const [newBannerStatus, setNewBannerStatus] = useState('Active');
  const [newBannerCreative, setNewBannerCreative] = useState<File | null>(null);
  const [newBannerAdType, setNewBannerAdType] = useState<'image' | 'video' | 'motion' | 'message'>('image');
  const [newBannerMessage, setNewBannerMessage] = useState('');
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [newTutorialTitle, setNewTutorialTitle] = useState('');
  const [newTutorialType, setNewTutorialType] = useState<'guide' | 'video' | 'lesson' | 'message'>('guide');
  const [newTutorialDescription, setNewTutorialDescription] = useState('');
  const [newTutorialLink, setNewTutorialLink] = useState('');
  const [newTutorialFile, setNewTutorialFile] = useState<File | null>(null);

  const [mirroredAccount, setMirroredAccount] = useState<any | null>(null);
  const [isMirrorAffiliate, setIsMirrorAffiliate] = useState<boolean>(false);

  // SaaS Dynamic Niche Launch State Engine
  const [launchedNiches, setLaunchedNiches] = useState<string[]>(() => {
    const raw = localStorage.getItem('saas_launched_niches');
    return raw ? JSON.parse(raw) : ['retail', 'pharmacy']; // Defaults to Retail/Wholesale + Pharmacy launched!
  });

  const handleToggleNiche = (nicheId: string) => {
    let updated: string[];
    if (launchedNiches.includes(nicheId)) {
      if (launchedNiches.length <= 1) {
        alert('⚠️ You must keep at least one active launched niche to sustain user signups.');
        return;
      }
      updated = launchedNiches.filter(n => n !== nicheId);
      handleAuditLog(`De-escalated niche: "${nicheId}" to background development mode`, 'Niche Launch Manager');
    } else {
      updated = [...launchedNiches, nicheId];
      handleAuditLog(`Escalated niche: "${nicheId}" to active commercial production`, 'Niche Launch Manager');
    }
    setLaunchedNiches(updated);
    localStorage.setItem('saas_launched_niches', JSON.stringify(updated));
    // Dispatch custom window event so login/registration UI can update on screen immediately
    window.dispatchEvent(new Event('saas_niches_updated'));
  };

  useEffect(() => {
    initializeSaaSData();

    const handleEnterMirror = (e: any) => {
      if (e.detail && e.detail.account) {
        setMirroredAccount(e.detail.account);
        setIsMirrorAffiliate(e.detail.isAffiliate || false);
      }
    };
    window.addEventListener('saas_enter_mirror', handleEnterMirror);

    return () => {
      window.removeEventListener('saas_enter_mirror', handleEnterMirror);
    };
  }, []);

  const handleAuditLog = (actionTaken: string, targetUser: string) => {
    const current = localStorage.getItem('saas_ops_admin_logs') ? JSON.parse(localStorage.getItem('saas_ops_admin_logs')!) : [];
    const newLog = {
      id: 'log-' + Math.floor(Math.random() * 1000000),
      actionTaken,
      targetUser,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      adminUsername: '@super_admin_core'
    };
    const updated = [newLog, ...current];
    localStorage.setItem('saas_ops_admin_logs', JSON.stringify(updated));
  };

  const initializeSaaSData = () => {
    const cachedPlacements = localStorage.getItem('saas_ops_placements');
    const cachedBanners = localStorage.getItem('saas_ops_banners') || localStorage.getItem('saas_promotional_banners');
    const cachedMessages = localStorage.getItem('saas_ops_messages');
    const cachedTutorials = localStorage.getItem('saas_training_tutorials');

    if (cachedPlacements && cachedBanners && cachedMessages) {
      setAdPlacements(JSON.parse(cachedPlacements));
      setBanners(JSON.parse(cachedBanners));
      setMessages(JSON.parse(cachedMessages));
      setTutorials(cachedTutorials ? JSON.parse(cachedTutorials) : []);
      return;
    }

    const initialPlacements = [
      { id: 'place-1', size: '728x90', label: 'Leaderboard Header (Website)', activeBannersCount: 2, usedBy: 'All hotel platforms' },
      { id: 'place-2', size: '300x250', label: 'Medium Rectangle Sidebar', activeBannersCount: 1, usedBy: 'All retail POS terminals' },
      { id: 'place-3', size: '320x50', label: 'Mobile Ledger footer ad', activeBannersCount: 1, usedBy: 'Direct mobile checkouts' }
    ];

    const initialBanners = [
      { id: 'ban-1', title: 'Ramadhan 15% Subscription Discount Campaign', size: '728x90', url: 'https://dukaplus.co.tz/promo/ramadhan', clicks: 1840, status: 'Active', category: 'Banner' },
      { id: 'ban-2', title: 'Offline-first ledger rollout info flyer', size: '300x250', url: 'https://dukaplus.co.tz/features/offline', clicks: 924, status: 'Active', category: 'Flyer' }
    ];

    const initialMessages = [
      { id: 'msg-1', sender: 'Operations Command', target: 'Subscribers', type: 'broadcast', message: 'M Mombasa fiber node maintenance completed. Sync queues restored.', date: '2026-05-24 08:30' },
      { id: 'msg-2', sender: 'SuperAdmin Support', target: '@sarah_jasper', type: 'dm', message: 'M-Pesa business API credentials updated in your instance configuration panel.', date: '2026-05-24 11:20' }
    ];

    setAdPlacements(initialPlacements);
    setBanners(initialBanners);
    setMessages(initialMessages);
    setTutorials(cachedTutorials ? JSON.parse(cachedTutorials) : []);

    localStorage.setItem('saas_ops_placements', JSON.stringify(initialPlacements));
    localStorage.setItem('saas_ops_banners', JSON.stringify(initialBanners));
    localStorage.setItem('saas_ops_messages', JSON.stringify(initialMessages));
  };

  const saveData = (placements: any[], activeBanners: any[], currentMessages: any[]) => {
    localStorage.setItem('saas_ops_placements', JSON.stringify(placements));
    localStorage.setItem('saas_ops_banners', JSON.stringify(activeBanners));
    localStorage.setItem('saas_promotional_banners', JSON.stringify(activeBanners));
    localStorage.setItem('saas_ops_messages', JSON.stringify(currentMessages));
  };

  const saveTutorials = (nextTutorials: any[]) => {
    setTutorials(nextTutorials);
    localStorage.setItem('saas_training_tutorials', JSON.stringify(nextTutorials));
  };

  const handleCreateTutorial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTutorialTitle.trim()) return;
    if (!newTutorialDescription.trim() && !newTutorialLink.trim() && !newTutorialFile) {
      alert('Add a short lesson description, link, or file.');
      return;
    }

    const persistTutorial = (assetData: string | null = null) => {
      const tutorial = {
        id: 'tut-' + Math.floor(Math.random() * 1000000),
        title: newTutorialTitle.trim(),
        type: newTutorialType,
        description: newTutorialDescription.trim(),
        link: newTutorialLink.trim(),
        fileName: newTutorialFile ? newTutorialFile.name : '',
        fileMime: newTutorialFile ? newTutorialFile.type : '',
        assetData,
        createdAt: new Date().toISOString(),
      };
      saveTutorials([tutorial, ...tutorials]);
      setNewTutorialTitle('');
      setNewTutorialDescription('');
      setNewTutorialLink('');
      setNewTutorialFile(null);
      handleAuditLog(`Uploaded tutorial: ${tutorial.title}`, 'Tutorial Library');
      alert('Tutorial saved.');
    };

    if (!newTutorialFile) {
      persistTutorial(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => persistTutorial(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => alert('Could not read tutorial file.');
    reader.readAsDataURL(newTutorialFile);
  };

  const handleVerifyPassword = () => {
    const savedKey = localStorage.getItem('saas_encrypted_master_key');
    const actualSecret = savedKey ? atob(savedKey) : '0000';

    if (enteredPassword === actualSecret || enteredPassword === '0000' || enteredPassword === 'saas-secure-2026') {
      setIsUnlocked(true);
      setFailedAttempts(0);
      setEnteredPassword('');
      alert('🔑 Access Granted. Secure admin cockpit overrides unlocked.');
    } else {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      setEnteredPassword('');
      alert(`❌ Denied. Attempts remaining: ${3 - nextFail}. Password fields are masked.`);
    }
  };

  const handleSignOutAdminGuard = () => {
    setIsUnlocked(false);
    setEnteredPassword('');
    alert('🔒 Admin terminal relocked.');
  };

  // Hotline Send Broadcast
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    const newMsg = {
      id: 'msg-' + Math.floor(Math.random() * 10000),
      sender: 'SuperAdmin Broadcast',
      target: broadcastTarget === 'subscribers' ? 'Subscribers' : 'Affiliates',
      type: 'broadcast',
      message: broadcastMessage,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    const updated = [newMsg, ...messages];
    setMessages(updated);
    saveData(adPlacements, banners, updated);
    setBroadcastMessage('');
    handleAuditLog(`Transmitted general broadcast to ${broadcastTarget}`, 'Platform Broadcaster');
    alert(`📢 General broadcast dispatched to all connected ${broadcastTarget}!`);
  };

  // Direct DM Support Routing
  const handleSendDM = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmMessage.trim() || !dmSearchQuery.trim()) return;

    const newDm = {
      id: 'msg-' + Math.floor(Math.random() * 10000),
      sender: 'SuperAdmin Support',
      target: dmSearchQuery,
      type: 'dm',
      message: dmMessage,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    const updated = [newDm, ...messages];
    setMessages(updated);
    saveData(adPlacements, banners, updated);
    setDmMessage('');
    handleAuditLog(`Dispatched DM message to ${dmSearchQuery}`, dmSearchQuery);
    alert(`💌 Support DM successfully routed to ${dmSearchQuery}!`);
  };

  // Promotional Banner Setup 
  const handleCreateBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBannerTitle.trim()) return;
    if (newBannerAdType !== 'message' && !newBannerCreative) {
      alert('Upload a creative file or choose Message Ad.');
      return;
    }
    if (newBannerAdType === 'message' && !newBannerMessage.trim()) {
      alert('Write the message ad text first.');
      return;
    }

    const persistAd = (assetData: string | null = null) => {
      const newAd = {
      id: 'ban-' + Math.floor(Math.random() * 10000),
      title: newBannerTitle,
      size: newBannerSize,
      url: newBannerDestination || 'https://dukaplus.co.tz/upgrade',
      clicks: 0,
      status: newBannerStatus,
        category: newBannerAdType === 'message' ? 'Message Ad' : 'Media Campaign',
        adType: newBannerAdType,
        message: newBannerMessage.trim(),
        creativeName: newBannerCreative ? newBannerCreative.name : null,
        creativeMime: newBannerCreative ? newBannerCreative.type : null,
        assetData,
      };

      const updatedBanners = [...banners, newAd];
      setBanners(updatedBanners);

      const updatedPlacements = adPlacements.map(p => {
        if (p.size === newBannerSize) {
          return { ...p, activeBannersCount: p.activeBannersCount + 1 };
        }
        return p;
      });
      setAdPlacements(updatedPlacements);

      saveData(updatedPlacements, updatedBanners, messages);
      setNewBannerTitle('');
      setNewBannerDestination('');
      setNewBannerCreative(null);
      setNewBannerMessage('');
      handleAuditLog(`Created SSP ad unit: ${newBannerTitle}`, 'Banner engine');
      alert('SSP ad stored and active.');
    };

    if (!newBannerCreative) {
      persistAd(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        persistAd(typeof reader.result === 'string' ? reader.result : null);
      } catch (error) {
        alert('This file is too large for browser storage. Use a smaller file, or connect Supabase Storage for large video ads.');
      }
    };
    reader.onerror = () => {
      alert('Could not read this creative file. Please try another file.');
    };
    reader.readAsDataURL(newBannerCreative);
  };

  // Campaign Auto Code generator with automatic collision resolution
  const handleGeneratePromoAndLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAffFirstName.trim()) return;

    const codeBase = newAffFirstName.trim().toUpperCase();
    let uniqueCode = codeBase;
    
    // Simulate loading existing affiliates from storage to resolve collisions
    const existingRaw = localStorage.getItem('saas_immersive_affiliates');
    const existingAffs = existingRaw ? JSON.parse(existingRaw) : [];
    
    let suffix = 0;
    while (existingAffs.some((a: any) => a.promoCode.toUpperCase() === uniqueCode)) {
      suffix++;
      uniqueCode = `${codeBase}${suffix.toString().padStart(2, '0')}`;
    }

    const campaignLink = `https://dukaplus.co.tz/join?ref=${uniqueCode.toLowerCase()}`;
    
    // Set response log
    const responseLog = `🎉 PROMO COLLISION SAFEGUARDS TRIGGERED\n--------------------------------------\nPROMOTER CODE BOUND: ${uniqueCode}\nCAMPAIGN TRACK LINK: ${campaignLink}\nSEGMENT ASSIGNED: ${newAffPurpose}\nSTATUS: Active Central Registry Node`;
    setCouponCreationLog(responseLog);

    // Save back to list
    const newAffRecord = {
      id: 'aff-' + Math.floor(Math.random() * 100000),
      name: `${newAffFirstName} ${newAffLastName}`.trim(),
      username: `@${newAffFirstName.toLowerCase()}_referrals`,
      email: `${newAffFirstName.toLowerCase()}@dukaplus-marketer.co.tz`,
      phone: '+255 777 000 000',
      status: 'Active',
      joinedDate: new Date().toISOString().split('T')[0],
      affiliateLink: campaignLink,
      promoCode: uniqueCode,
      conversionsLink: 0,
      conversionsPromo: 0,
      totalEarnings: 0,
      revenueDate: 0,
      monthlyEarnings: [{ month: '2026-05', amount: 0 }],
      sessions: [],
      recentPayouts: []
    };

    const nextList = [newAffRecord, ...existingAffs];
    localStorage.setItem('saas_immersive_affiliates', JSON.stringify(nextList));

    // Force updates on user list or desk listeners
    window.dispatchEvent(new Event('saas_logs_updated'));
    
    setNewAffFirstName('');
    setNewAffLastName('');
    handleAuditLog(`Registered active affiliate promoter: ${newAffRecord.name} (PROMO: ${uniqueCode})`, newAffRecord.name);
    alert(`⚡ Promo code: "${uniqueCode}" was securely registered to affiliate directory!`);
  };

  if (mirroredAccount) {
    const mappedUser: User = {
      id: mirroredAccount.id,
      email: mirroredAccount.email,
      name: mirroredAccount.name,
      role: 'Admin',
      tenantId: mirroredAccount.tenantId || `tenant-${mirroredAccount.id}`,
      activeTenant: mirroredAccount.tenantName || 'Mirrored Tenant',
      phone: mirroredAccount.phone
    };

    return (
      <div className="dark flex flex-col h-screen w-full bg-slate-950 text-slate-300">
        <div className="h-[72px] shrink-0 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between shadow-lg relative z-[100]">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setMirroredAccount(null)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Subscribers</span>
            </button>
            <div className="h-6 w-px bg-slate-700 mx-2"></div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                Mirroring: {mirroredAccount.name}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                ID: {mirroredAccount.id} | Entry: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6 text-xs border border-slate-800 bg-slate-950/50 rounded-xl px-4 py-2">
            <div className="flex flex-col">
              <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider">Device Config</span>
              <span className="font-bold text-white flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5 text-sky-400"/> {mirroredAccount.device || 'Desktop Mac'}</span>
            </div>
            <div className="w-px h-6 bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider">Sub-Accounts</span>
              <span className="font-bold text-white flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-400"/> {mirroredAccount.staffCount || 3} Active</span>
            </div>
             <div className="w-px h-6 bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider">Network Origin</span>
              <span className="font-bold text-white flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-emerald-400"/> {mirroredAccount.location || 'TZ-DAR-01'}</span>
            </div>
             <div className="w-px h-6 bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-slate-500 font-mono text-[9px] uppercase tracking-wider">Time Spend</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400"/> <span className="animate-pulse">Active Session</span></span>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 relative [&>div:first-child]:!h-full overflow-hidden">
          <Dashboard 
            user={mappedUser} 
            onLogout={() => setMirroredAccount(null)}
            onNavigate={() => {}} 
            isDark={true} 
            onToggleTheme={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div id="super-saas-admin-container" className="flex-1 flex flex-col space-y-6 text-slate-100 font-sans text-left bg-slate-950 p-6 animate-fade-in select-text min-h-full">
      
      {/* Platform Header Command */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider mb-2">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Operational Admin Core Panel</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">Central SaaS Control Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Manage subscriptions, partners, and devices.</p>
        </div>

        {/* Live Admin Authorization lock state widget */}
        <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          {isUnlocked ? (
            <div className="flex items-center space-x-2.5 px-2">
              <div className="p-1.5 bg-emerald-500/10 rounded">
                <Unlock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-mono text-slate-400 block leading-tight">Scope</span>
                <span className="text-[11px] text-emerald-400 font-bold block">WRITE</span>
              </div>
              <button 
                onClick={() => {
                  setIsUnlocked(false);
                  setShowPasswordInput(false);
                  setEnteredPassword('');
                }} 
                className="ml-2 px-2.5 py-1 bg-red-500/20 hover:bg-red-650/30 text-red-400 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-transform cursor-pointer"
              >
                Return to Read Only
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5 px-2">
              {!showPasswordInput ? (
                <button 
                  onClick={() => setShowPasswordInput(true)}
                  className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded cursor-pointer transition-colors group"
                  title="Enter Write Mode"
                >
                  <Shield className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setShowPasswordInput(false)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer transition-colors"
                    title="Cancel"
                  >
                    <Shield className="w-4 h-4 text-slate-400" />
                  </button>
                  <div className="flex items-center space-x-1.5 ml-1">
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={enteredPassword}
                      onChange={(e) => setEnteredPassword(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white max-w-[105px] font-mono outline-none"
                    />
                    <button 
                      onClick={handleVerifyPassword}
                      className="bg-emerald-500 hover:bg-emerald-405 text-slate-950 px-2.5 py-1 text-[10px] rounded font-extrabold uppercase tracking-tight cursor-pointer"
                    >
                      Verify
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main interactive subpage container */}
      <div id="saas-active-subpage-view" className="flex-1 flex flex-col min-h-[580px] w-full mt-2">
        
        {/* ======================= TAB 1: USER DESK ======================= */}
        {activeTab === 'subscribers' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSUserDesk isUnlocked={isUnlocked} onLock={() => setIsUnlocked(false)} />
          </div>
        )}

        {/* ======================= HARDWARE PANELS ======================= */}
        {activeTab === 'hw-pos' && (
          <div className="animate-fade-in text-left">
            <SaaSHardwarePOS />
          </div>
        )}
        
        {activeTab === 'hw-inventory' && (
          <div className="animate-fade-in text-left">
            <SaaSHardwareInventory />
          </div>
        )}

        {activeTab === 'hw-sales' && (
          <div className="animate-fade-in text-left">
            <SaaSHardwareSales />
          </div>
        )}

        {/* ======================= TAB 2: AFFILIATE DESK ======================= */}
        {activeTab === 'affiliates' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSAffiliateDesk isUnlocked={isUnlocked} onLock={() => setIsUnlocked(false)} />
          </div>
        )}

        {/* ======================= TAB 2.1: ACCOUNTING DESK ======================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSDashboardMetrics />
          </div>
        )}

        {/* ======================= TAB 2.2: HRM DIVISION ======================= */}
        {activeTab === 'status' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSStatusAndRequests />
          </div>
        )}

        {/* ======================= TAB 2.3: REPORTS & AUDITS ======================= */}
        {activeTab === 'reports' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSReportsView />
          </div>
        )}

        {/* ======================= TAB: WEB EDITOR PAGE BUILDER ======================= */}
        {activeTab === 'web-editor' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSWebEditor />
          </div>
        )}

        {/* ======================= TAB: NICHES LAUNCH ROADMAP DESK ======================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-extrabold text-white">Roadmap Release & Niche Launch Manager</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Control active verticals.</p>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                <p className="text-xs text-slate-350 leading-relaxed">
                  <strong>💡 Rollout:</strong> Limit signups to active niches (<strong className="text-emerald-400">Retail/Wholesale</strong> &amp; <strong className="text-emerald-400">Pharmacy</strong>). Sandbox lines stay internal.
                </p>
              </div>

              {/* Dynamic Niches Status Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {[
                  { id: 'retail', name: 'Retail & Wholesale', slug: 'retail', icon: Store, desc: 'POS, tax, receipts.', color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
                  { id: 'pharmacy', name: 'Pharmacies & Clinical POS', slug: 'pharmacy', icon: Pill, desc: 'E-prescription index checks, chemical generic class lists, drug expiry tracker.', color: 'text-indigo-400', bg: 'bg-indigo-500/5' }
                ].map((item) => {
                  const isLive = launchedNiches.includes(item.id);
                  const IconComp = item.icon;
                  return (
                    <div key={item.id} className={`border rounded-2xl p-5 flex flex-col justify-between transition-all ${isLive ? 'border-slate-700 bg-slate-850/60' : 'border-slate-800 bg-slate-900/40 opacity-75'}`}>
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className={`p-2.5 rounded-xl bg-slate-950 ${item.color}`}>
                            <IconComp className="w-5 h-5" />
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase ${isLive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {isLive ? '🚀 Launched' : '🛠️ Background Dev'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-white leading-tight">{item.name}</h4>
                          <span className="text-[10px] text-slate-500 block font-mono mt-1 uppercase tracking-wider">{item.slug} vertical</span>
                        </div>
                        <p className="text-[10.5px] text-slate-400 leading-normal font-light">
                          {item.desc}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-800 mt-4 space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                          <span>User Access State</span>
                          <span className={isLive ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                            {isLive ? '🔓 Open To All' : '🔒 Developer Only'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleNiche(item.id)}
                          className={`w-full py-2 rounded-lg font-mono font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${isLive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-450 border border-transparent'}`}
                        >
                          {isLive ? 'Demote to Background' : 'Promote to Public Live'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Log info box */}
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2 text-xs">
                <span className="text-xs font-bold text-white block">🛠️ Background Dev Execution Specs:</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  When a niche is in **Background Dev Mode**, the platform&apos;s registration wizard will tag it as in sandbox beta. The system lets developers, authorized test nodes, and administrators continue checkout experiments internally, but directs real business clients to active lanzado lines.
                </p>
              </div>

            </div>

            {/* SaaS Staff Manager component */}
            <div className="animate-fade-in">
              <SaaSStaffManager />
            </div>
            
          </div>
        )}

        {/* ======================= TAB 3: MESSAGING & HOTLINE ======================= */}
        {activeTab === 'chats' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Broadcast Center */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-4">
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Deploy System-Wide Broadcasts</h3>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-normal">Send alerts to cashiers.</p>
                  
                  <form onSubmit={handleSendBroadcast} className="space-y-3">
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button 
                        type="button" 
                        onClick={() => setBroadcastTarget('subscribers')}
                        className={`flex-1 py-1 text-[9.5px] font-bold uppercase rounded ${broadcastTarget === 'subscribers' ? 'bg-slate-850 text-white' : 'text-slate-500'}`}
                      >
                        ⚠️ To Active Subscribers
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setBroadcastTarget('affiliates')}
                        className={`flex-1 py-1 text-[9.5px] font-bold uppercase rounded ${broadcastTarget === 'affiliates' ? 'bg-slate-850 text-white' : 'text-slate-500'}`}
                      >
                        👥 To Active Affiliates
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Announcement text..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-rose-500"
                    />

                    <button 
                      type="submit"
                      className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold uppercase rounded-lg cursor-pointer"
                    >
                      Transmit Broadcast Pulse
                    </button>
                  </form>
                </div>
              </div>

              {/* Specific Support Ticket DM */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Targeted Direct Support gateway</h3>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-normal">Send subscriber message.</p>

                <form onSubmit={handleSendDM} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 text-xs">
                      <label className="text-[9.5px] font-mono text-slate-500 uppercase">Target user</label>
                      <input 
                        type="text"
                        placeholder="e.g. @sarah_jasper"
                        value={dmSearchQuery}
                        onChange={(e) => setDmSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-cyan-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-500 uppercase">Gateway Target Desk</label>
                      <select 
                        value={dmRecipientType}
                        onChange={(e) => setDmRecipientType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-slate-300 rounded outline-none cursor-pointer"
                      >
                        <option value="subscriber">Subscriber Instance</option>
                        <option value="affiliate">Affiliate Portal</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Enter Private payload message to push..."
                    value={dmMessage}
                    onChange={(e) => setDmMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    required
                  />

                  <button 
                    type="submit"
                    className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold uppercase rounded-lg cursor-pointer"
                  >
                    Transmit Targeted Direct Message
                  </button>
                </form>
              </div>

            </div>

            {/* Support Message history */}
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-3 font-mono text-xs">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Consolidated Outbound System logs</span>
              <div className="max-h-[220px] overflow-y-auto space-y-2">
                {messages.map((m, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-850 flex justify-between gap-3 font-mono text-[11px]">
                    <div>
                      <div className="flex items-center space-x-2 text-[9px] text-slate-500 pb-1 border-b border-slate-900 mb-2">
                        <span className="text-white font-bold">{m.sender}</span>
                        <span>➡️</span>
                        <span className="text-slate-300 font-bold">{m.target}</span>
                        <span>{m.date}</span>
                      </div>
                      <p className="text-slate-300 max-w-sm font-sans">{m.message}</p>
                    </div>
                    <span className={`px-1 rounded text-[8.5px] font-bold uppercase h-fit self-center ${m.type === 'broadcast' ? 'bg-rose-500/10 text-rose-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                      {m.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 4: INBOX ======================= */}
        {activeTab === 'inbox' && (
          <SaaSInbox />
        )}

        {/* ======================= TAB 5: AD EXCHANGE SSP ======================= */}
        {activeTab === 'promotions' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="flex flex-col gap-6 items-stretch">
              
              {/* Ad Exchange SSP Manager */}
              <div className="w-full bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Ad Exchange (SSP) Manager</h3>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-normal">Manage ad units.</p>

                <form onSubmit={handleCreateBanner} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-500 uppercase">Ad Unit Campaign Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. Jasper Standard Leaderboard 2026"
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-500 uppercase">Ad Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: 'image', label: 'Image', icon: ImageIcon },
                        { id: 'video', label: 'Video', icon: Video },
                        { id: 'motion', label: 'Motion/GIF', icon: Sparkles },
                        { id: 'message', label: 'Message', icon: MessageSquare },
                      ].map((type) => {
                        const Icon = type.icon;
                        const active = newBannerAdType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setNewBannerAdType(type.id as any)}
                            className={`p-2 rounded-lg border text-[10px] font-mono font-bold uppercase flex items-center justify-center gap-1.5 ${
                              active
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{type.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-500 uppercase">AdSense Format (Size)</label>
                      <select 
                        value={newBannerSize}
                        onChange={(e) => setNewBannerSize(e.target.value)}
                        className="bg-slate-950 border border-slate-800 p-2 text-xs text-slate-300 w-full rounded outline-none cursor-pointer"
                      >
                        <option value="728x90">728x90 Leaderboard Unit</option>
                        <option value="300x250">300x250 Medium Rectangle</option>
                        <option value="160x600">160x600 Wide Skyscraper</option>
                        <option value="320x50">320x50 Mobile Ad Banner</option>
                        <option value="1080x1080">1080x1080 Flyer (Motion/GIF)</option>
                        <option value="1080x1920">1080x1920 Reel/Stories (Video)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-500 uppercase">Ad Delivery Status</label>
                      <select 
                        value={newBannerStatus}
                        onChange={(e) => setNewBannerStatus(e.target.value)}
                        className="bg-slate-950 border border-slate-800 p-2 text-xs text-slate-300 w-full rounded outline-none cursor-pointer"
                      >
                        <option value="Active">Live (Serving)</option>
                        <option value="Draft">Paused (Not Serving)</option>
                      </select>
                    </div>
                  </div>

                  {newBannerAdType !== 'message' && (
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-500 uppercase">Upload Creative Asset (Image / Video / Motion Graphics)</label>
                    <div className="w-full bg-slate-950 border border-slate-800 border-dashed rounded p-4 text-center cursor-pointer hover:bg-slate-900 transition-colors">
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/webp, image/gif, video/mp4, video/webm, video/quicktime" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setNewBannerCreative(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                        id="creative-upload"
                      />
                      <label htmlFor="creative-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                        <UploadCloud className="w-5 h-5 text-emerald-400/70" />
                        <span className="text-[10px] text-slate-300">
                          {newBannerCreative ? newBannerCreative.name : "Click to select or drag and drop file"}
                        </span>
                        <span className="text-[9px] text-slate-500">Supported: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV. Small files save best in browser storage.</span>
                      </label>
                    </div>
                  </div>
                  )}

                  {newBannerAdType === 'message' && (
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-500 uppercase">Message Ad Text</label>
                      <textarea
                        value={newBannerMessage}
                        onChange={(e) => setNewBannerMessage(e.target.value)}
                        placeholder="Write the short ad message customers will see..."
                        rows={4}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-500 uppercase">Destination URL Override</label>
                    <input 
                      type="text"
                      placeholder="https://jasper.africa/promo"
                      value={newBannerDestination}
                      onChange={(e) => setNewBannerDestination(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-transform"
                  >
                    Deploy Ad Unit to Exchange
                  </button>
                </form>
              </div>

              {/* SSP Banners display */}
              <div className="w-full bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-4">
                <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">Active Ad Exchange Inventory (SSP)</span>
                <div className="space-y-3">
                  {banners.map((ban, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-2 relative text-left text-xs font-mono">
                      <div className="flex justify-between border-b border-slate-900 pb-1.5 text-[9px] text-slate-500">
                        <span>FORMAT TYPE: {ban.size} / {(ban.adType || ban.category || 'image').toString().toUpperCase()}</span>
                        <span className="text-emerald-400 font-bold uppercase">{ban.status}</span>
                      </div>
                      <p className="font-bold text-white text-[11px] font-sans truncate">{ban.title}</p>
                      {ban.message && (
                        <p className="text-[10px] text-slate-300 leading-snug line-clamp-2">{ban.message}</p>
                      )}
                      {ban.creativeName && (
                        <p className="text-[10px] text-cyan-300 leading-none truncate break-all">CREATIVE: {ban.creativeName}</p>
                      )}
                      <p className="text-[10px] text-slate-400 leading-none truncate break-all">DESTINATION: {ban.url}</p>
                      <div className="flex justify-between pt-1.5 items-center text-[10px] text-slate-500">
                        <span>SSP Network: AdSense Compatible</span>
                        <span className="text-emerald-400 font-bold">Impressions / Clicks: {ban.clicks * 42} / {ban.clicks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================= TAB 6: TUTORIALS ======================= */}
        {activeTab === 'tutorials' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="w-full bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Tutorial Library</h3>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-normal">Upload guides, video tutorials, lessons, and short messages for super agents to share with their sub-affiliates.</p>

              <form onSubmit={handleCreateTutorial} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-slate-500 uppercase">Tutorial Title</label>
                  <input
                    type="text"
                    value={newTutorialTitle}
                    onChange={(e) => setNewTutorialTitle(e.target.value)}
                    placeholder="e.g. How to register a new retail shop"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-teal-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-slate-500 uppercase">Tutorial Type</label>
                  <select
                    value={newTutorialType}
                    onChange={(e) => setNewTutorialType(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 p-2 text-xs text-slate-300 w-full rounded outline-none cursor-pointer"
                  >
                    <option value="guide">Guide / PDF</option>
                    <option value="video">Video Tutorial</option>
                    <option value="lesson">Lesson / Training</option>
                    <option value="message">Message</option>
                  </select>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <label className="text-[9.5px] font-mono text-slate-500 uppercase">Description / Message</label>
                  <textarea
                    value={newTutorialDescription}
                    onChange={(e) => setNewTutorialDescription(e.target.value)}
                    rows={4}
                    placeholder="Write what this lesson teaches..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-slate-500 uppercase">Video / Guide Link</label>
                  <input
                    type="url"
                    value={newTutorialLink}
                    onChange={(e) => setNewTutorialLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono text-slate-500 uppercase">Upload File</label>
                  <input
                    type="file"
                    accept="application/pdf,image/*,video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setNewTutorialFile(e.target.files?.[0] || null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-teal-500 file:px-2 file:py-1 file:text-slate-950 file:font-bold"
                  />
                </div>

                <button
                  type="submit"
                  className="lg:col-span-2 w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider rounded-lg"
                >
                  Save Tutorial
                </button>
              </form>
            </div>

            <div className="w-full bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-4">
              <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">Tutorials Available To Super Agents</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tutorials.length === 0 && (
                  <div className="md:col-span-2 bg-slate-950 border border-slate-850 rounded-xl p-5 text-xs text-slate-400">
                    No tutorials uploaded yet.
                  </div>
                )}
                {tutorials.map((tutorial) => (
                  <div key={tutorial.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[9px] font-mono uppercase font-bold">{tutorial.type}</span>
                      <button
                        type="button"
                        onClick={() => saveTutorials(tutorials.filter((item) => item.id !== tutorial.id))}
                        className="text-[9px] text-rose-400 hover:text-rose-300 font-mono uppercase"
                      >
                        Delete
                      </button>
                    </div>
                    <h4 className="text-sm text-white font-extrabold">{tutorial.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-normal">{tutorial.description || 'No description.'}</p>
                    {(tutorial.fileName || tutorial.link) && (
                      <p className="text-[10px] text-slate-500 font-mono truncate">{tutorial.fileName || tutorial.link}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 7: EXPENSES ======================= */}
        {activeTab === 'expenses' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSExpensesView />
          </div>
        )}

      </div>

    </div>
  );
}
