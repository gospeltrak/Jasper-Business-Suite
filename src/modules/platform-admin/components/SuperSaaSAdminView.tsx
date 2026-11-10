import React, { useState, useEffect } from 'react';
import { Shield, Users, Volume2, Sparkles, Unlock, UploadCloud, Image as ImageIcon, MessageSquare, Video, BookOpen, Store, Pill, ArrowLeft, Laptop, Globe, Clock } from "lucide-react";

const SaaSUserDesk = React.lazy(() => import('./SaaSUserDesk'));
const OrvixProAdminPanel = React.lazy(() => import('./OrvixProAdminPanel'));

const SuperAffiliateControlCenter = React.lazy(() => import('./SuperAffiliateNetworkOverview'));
const Dashboard = React.lazy(() => import('../../../components/Dashboard'));
const AffiliateWorkspace = React.lazy(() => import('../../affiliate/components/AffiliateWorkspace'));
import { User } from '../../../types';
const SaaSStatusAndRequests = React.lazy(() => import('./SaaSStatusAndRequests'));
const SaaSReportsView = React.lazy(() => import('./SaaSReportsView'));
const SaaSUserActivityView = React.lazy(() => import('./SaaSUserActivityView'));
const SaaSDashboardMetrics = React.lazy(() => import('./SaaSDashboardMetrics'));
const SaaSExpensesView = React.lazy(() => import('./SaaSExpensesView'));
const SaaSInbox = React.lazy(() => import('./SaaSInbox'));
const SecurityActivityView = React.lazy(() => import('./SecurityActivityView'));
const SaaSHardwarePOS = React.lazy(() => import('../../../shared/components/SaaSHardwarePOS'));
const SaaSHardwareInventory = React.lazy(() => import('../../../shared/components/SaaSHardwareInventory'));
const SaaSHardwareSales = React.lazy(() => import('./SaaSHardwareSales'));
const SaaSStaffManager = React.lazy(() => import('./SaaSStaffManager'));
import { initPlatformSync } from '../utils/superAdminPlatformRecords';
const SaaSWebEditor = React.lazy(() => import('./SaaSWebEditor'));
const SaaSAdPlacementsPanel = React.lazy(() => import('./SaaSAdPlacementsPanel'));
import { loadPlatformRecord, savePlatformRecord } from '../utils/superAdminPlatformRecords';
import { ONLINE_ONLY_WRITE_MESSAGE, canWriteBusinessDataOnline } from '../../../shared/utils/onlineOnly';

import { prepareSuperAdminMfa, SuperAdminMfaPrompt, verifySuperAdminMfa } from '../utils/superAdminMfa';

export type SuperAdminWorkspaceTab = 'dashboard' | 'subscribers' | 'orvix-pro' | 'hw-pos' | 'hw-inventory' | 'hw-sales' | 'affiliates' | 'affiliate-agents' | 'sub-affiliates' | 'status' | 'reports' | 'user-activity' | 'expenses' | 'chats' | 'inbox' | 'security' | 'promotions' | 'tutorials' | 'ad-placements' | 'web-editor' | 'settings';

export interface SuperSaaSAdminViewProps {
  activeAdminSubTab?: SuperAdminWorkspaceTab;
  setActiveAdminSubTab?: (tab: SuperAdminWorkspaceTab) => void;
  hideSidebar?: boolean;
  user?: { id?: string; name?: string; phone?: string; email?: string; profileImage?: string; role?: string } | null;
}

export default function SuperSaaSAdminView({
  activeAdminSubTab: externalActiveTab,
  setActiveAdminSubTab: externalSetActiveTab,
  hideSidebar = false,
  user: adminUser = null,
}: SuperSaaSAdminViewProps = {}) {
  const [internalActiveTab, setInternalActiveTab] = useState<SuperAdminWorkspaceTab>('dashboard');

  // Init legacy queue preservation for platform records. Writes are online-only.
  useEffect(() => { initPlatformSync(); }, []);
  const activeTab = externalActiveTab || internalActiveTab;
  

  // State Management for Banners, Ads, Hotline
  const [adPlacements, setAdPlacements] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  // Security Auth controls
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [mfaPrompt, setMfaPrompt] = useState<SuperAdminMfaPrompt | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [shieldClickCount, setShieldClickCount] = useState(0);
  const [shieldClickTimer, setShieldClickTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Security: the unlock control must be clicked 5 times in quick succession
  // before the password input is revealed, so it can't be triggered
  // accidentally or by a casual tap from someone glancing at the screen.
  // The counter resets if more than 3 seconds pass between clicks.
  const handleShieldClick = () => {
    if (shieldClickTimer) clearTimeout(shieldClickTimer);
    setShieldClickCount((count) => {
      const next = count + 1;
      if (next >= 5) {
        setShowPasswordInput(true);
        return 0;
      }
      return next;
    });
    const timer = setTimeout(() => setShieldClickCount(0), 3000);
    setShieldClickTimer(timer);
  };
  const [failedAttempts, setFailedAttempts] = useState(0);

  const beginMfaVerification = async () => {
    setMfaBusy(true);
    setMfaError('');
    try {
      const prompt = await prepareSuperAdminMfa(true);
      if (!prompt) {
        setIsUnlocked(true);
        return;
      }
      setMfaPrompt(prompt);
    } catch (error: any) {
      setMfaError(error?.message || 'MFA setup is temporarily unavailable.');
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmMfaVerification = async () => {
    if (!mfaPrompt || !mfaCode.trim()) return;
    setMfaBusy(true);
    setMfaError('');
    try {
      await verifySuperAdminMfa(mfaPrompt, mfaCode);
      setMfaPrompt(null);
      setMfaCode('');
      setFailedAttempts(0);
      setIsUnlocked(true);
      setShowPasswordInput(false);
    } catch (error: any) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setMfaCode('');
      if (nextAttempts >= 3) {
        const client = await import('../../../shared/dataBridge/secureDataBridge').then(module => module.getSecureDataBridgeClient());
        await client.auth.signOut({ scope: 'global' }).catch(() => null);
        window.location.assign('/admin');
        return;
      }
      setMfaError(`Authenticator code rejected. ${3 - nextAttempts} attempt(s) remaining.`);
    } finally {
      setMfaBusy(false);
    }
  };

  // Forms inputs
  const [broadcastTarget, setBroadcastTarget] = useState<'subscribers' | 'affiliates'>('subscribers');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [dmRecipientType, setDmRecipientType] = useState<'subscriber' | 'affiliate'>('subscriber');
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmMessage, setDmMessage] = useState('');


  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerSize, setNewBannerSize] = useState('728x90');
  const [newBannerDestination, setNewBannerDestination] = useState('');
  const [newBannerStatus, setNewBannerStatus] = useState('Active');
  const [newBannerCreative, setNewBannerCreative] = useState<File | null>(null);
  const [newBannerAdType, setNewBannerAdType] = useState<'image' | 'video' | 'motion' | 'message'>('image');
  const [newBannerMessage, setNewBannerMessage] = useState('');
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [newTutorialTitle, setNewTutorialTitle] = useState('');
  const [newTutorialType, setNewTutorialType] = useState<'guide' | 'video' | 'lesson' | 'message'>('guide');
  const [newTutorialDescription, setNewTutorialDescription] = useState('');
  const [newTutorialLink, setNewTutorialLink] = useState('');
  const [newTutorialFile, setNewTutorialFile] = useState<File | null>(null);
  const [newTutorialPlatform, setNewTutorialPlatform] = useState<'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'website' | 'none'>('youtube');
  const [newTutorialOrientation, setNewTutorialOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [newTutorialStatus, setNewTutorialStatus] = useState<'Active' | 'Draft'>('Active');
  const [editingTutorialId, setEditingTutorialId] = useState<string | null>(null);

  const [mirroredAccount, setMirroredAccount] = useState<any | null>(null);
  const [isMirrorAffiliate, setIsMirrorAffiliate] = useState<boolean>(false);

  // SaaS Dynamic Niche Launch State Engine
  const [launchedNiches, setLaunchedNiches] = useState<string[]>(() => {
    const raw = onlineStorage.getItem('saas_launched_niches');
    return raw ? JSON.parse(raw) : ['retail', 'pharmacy']; // Defaults to Retail/Wholesale + Pharmacy launched!
  });

  const handleToggleNiche = async (nicheId: string) => {
    if (!canWriteBusinessDataOnline()) {
      alert(ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    let updated: string[];
    let auditMessage: string;
    if (launchedNiches.includes(nicheId)) {
      if (launchedNiches.length <= 1) {
        alert('⚠️ You must keep at least one active launched niche to sustain user signups.');
        return;
      }
      updated = launchedNiches.filter(n => n !== nicheId);
      auditMessage = `De-escalated niche: "${nicheId}" to background development mode`;
    } else {
      updated = [...launchedNiches, nicheId];
      auditMessage = `Escalated niche: "${nicheId}" to active commercial production`;
    }
    try {
      await savePlatformRecord('saas_launched_niches', 'global', updated);
      setLaunchedNiches(updated);
      onlineStorage.setItem('saas_launched_niches', JSON.stringify(updated));
    } catch (error: any) {
      alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    handleAuditLog(auditMessage, 'Niche Launch Manager');
    // Dispatch custom window event so login/registration UI can update on screen immediately
    window.dispatchEvent(new Event('saas_niches_updated'));
  };

  useEffect(() => {
    // Load marketing records only when their workspace is actually opened.
    // The ordinary dashboard must not fetch creatives, messages or tutorials.
    const handleEnterMirror = (e: any) => {
      if (e.detail && e.detail.account) {
        setMirroredAccount(e.detail.account);
        setIsMirrorAffiliate(e.detail.accountType === 'affiliate' || e.detail.account?.accountType === 'affiliate' || e.detail.isAffiliate === true);
      }
    };
    window.addEventListener('saas_enter_mirror', handleEnterMirror);

    return () => {
      window.removeEventListener('saas_enter_mirror', handleEnterMirror);
    };
  }, []);

  const handleAuditLog = (actionTaken: string, targetUser: string) => {
    const current = onlineStorage.getItem('saas_ops_admin_logs') ? JSON.parse(onlineStorage.getItem('saas_ops_admin_logs')!) : [];
    const newLog = {
      id: 'log-' + Math.floor(Math.random() * 1000000),
      actionTaken,
      targetUser,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      adminUsername: '@super_admin_core'
    };
    const updated = [newLog, ...current];
    savePlatformRecord('saas_ops_admin_logs', 'global', updated).catch((error) => {
      console.warn('[super-admin] audit log save blocked:', error);
    });
  };

  // Fetch only the active workspace's records. Opening Chats never fetches
  // creative media, while opening Tutorials never reads ad placements.
  const initializeSaaSData = async (section: SuperAdminWorkspaceTab) => {
    if (section === 'promotions') {
      const [placements, activeBanners] = await Promise.all([
        loadPlatformRecord<any[]>('ad_placements', 'global', [
          { id: 'place-1', size: '728x90', label: 'Leaderboard Header (Website)', activeBannersCount: 0, usedBy: 'Public landing pages' },
          { id: 'place-2', size: '300x250', label: 'Medium Rectangle Sidebar', activeBannersCount: 0, usedBy: 'Dashboard placements' },
          { id: 'place-3', size: '320x50', label: 'Mobile Ledger footer ad', activeBannersCount: 0, usedBy: 'Mobile screens' }
        ]),
        loadPlatformRecord<any[]>('promotional_banners', 'global', [])
      ]);
      setAdPlacements(placements);
      setBanners(activeBanners);
    } else if (section === 'chats') {
      setMessages(await loadPlatformRecord<any[]>('platform_messages', 'global', []));
    } else if (section === 'tutorials') {
      setTutorials(await loadPlatformRecord<any[]>('training_tutorials', 'global', []));
    }
  };

  useEffect(() => {
    if (!['promotions', 'chats', 'tutorials'].includes(activeTab)) return;
    void initializeSaaSData(activeTab).catch((error) => {
      console.warn('[super-admin] Active workspace records unavailable:', error);
    });
  }, [activeTab]);

  const saveMessages = async (nextMessages: any[]) => {
    await savePlatformRecord('platform_messages', 'global', nextMessages);
  };

  const saveCampaignData = async (placements: any[], activeBanners: any[]) => {
    await Promise.all([
      savePlatformRecord('ad_placements', 'global', placements),
      savePlatformRecord('promotional_banners', 'global', activeBanners)
    ]);
  };

  const saveTutorials = async (nextTutorials: any[]) => {
    await savePlatformRecord('training_tutorials', 'global', nextTutorials);
    setTutorials(nextTutorials);
  };

  const resetTutorialForm = () => {
    setEditingTutorialId(null);
    setNewTutorialTitle('');
    setNewTutorialType('guide');
    setNewTutorialDescription('');
    setNewTutorialLink('');
    setNewTutorialFile(null);
    setNewTutorialPlatform('youtube');
    setNewTutorialOrientation('horizontal');
    setNewTutorialStatus('Active');
  };

  const handleEditTutorial = (tutorial: any) => {
    setEditingTutorialId(tutorial.id);
    setNewTutorialTitle(tutorial.title || '');
    setNewTutorialType(tutorial.type || 'guide');
    setNewTutorialDescription(tutorial.description || '');
    setNewTutorialLink(tutorial.link || '');
    setNewTutorialPlatform(tutorial.platform || 'youtube');
    setNewTutorialOrientation(tutorial.orientation || 'horizontal');
    setNewTutorialStatus(tutorial.status || 'Active');
    setNewTutorialFile(null);
  };

  const handleCreateTutorial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTutorialTitle.trim()) return;
    if (!newTutorialDescription.trim() && !newTutorialLink.trim()) {
      alert('Add a message or an external video link.');
      return;
    }
    if (newTutorialType === 'video' && !newTutorialLink.trim()) {
      alert('Video tutorials need an external link.');
      return;
    }
    if (newTutorialLink.trim()) {
      try {
        const parsed = new URL(newTutorialLink.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
        const host = parsed.hostname.toLowerCase();
        const approvedHosts: Record<string, string[]> = {
          youtube: ['youtube.com', 'youtu.be'],
          tiktok: ['tiktok.com'],
          instagram: ['instagram.com'],
          facebook: ['facebook.com', 'fb.watch', 'fb.com'],
        };
        const expected = approvedHosts[newTutorialPlatform];
        if (expected && !expected.some(value => host === value || host.endsWith('.' + value))) {
          alert('This link does not match the selected platform.');
          return;
        }
      } catch {
        alert('Enter a valid https:// video or website URL.');
        return;
      }
    }
    const current = editingTutorialId ? tutorials.find(t => t.id === editingTutorialId) : null;
    if (!newTutorialFile && !current?.thumbnailData) {
      alert('Every tutorial needs a cover thumbnail.');
      return;
    }
    if (newTutorialFile && (!newTutorialFile.type.startsWith('image/') || newTutorialFile.size > 800 * 1024)) {
      alert('Use a JPG, PNG or WEBP thumbnail smaller than 800 KB.');
      return;
    }
    const saveWithThumbnail = async (thumbnailData: string | null) => {
      const tutorial = {
        id: editingTutorialId || 'tut-' + Math.floor(Math.random() * 1000000),
        title: newTutorialTitle.trim(),
        type: newTutorialType,
        description: newTutorialDescription.trim(),
        link: newTutorialLink.trim(),
        platform: newTutorialLink.trim() ? newTutorialPlatform : 'none',
        orientation: newTutorialOrientation,
        status: newTutorialStatus,
        thumbnailData: thumbnailData || current?.thumbnailData || null,
        fileName: newTutorialFile?.name || current?.fileName || '',
        fileMime: newTutorialFile?.type || current?.fileMime || '',
        createdAt: current?.createdAt || new Date().toISOString(),
      };
      try {
        await saveTutorials(editingTutorialId
          ? tutorials.map(item => item.id === editingTutorialId ? tutorial : item)
          : [tutorial, ...tutorials]);
        resetTutorialForm();
        handleAuditLog('Saved tutorial: ' + tutorial.title, 'Tutorial Library');
        alert('Tutorial saved successfully.');
      } catch (error: any) {
        alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      }
    };
    if (!newTutorialFile) { void saveWithThumbnail(null); return; }
    const reader = new FileReader();
    reader.onload = () => { void saveWithThumbnail(typeof reader.result === 'string' ? reader.result : null); };
    reader.onerror = () => alert('Thumbnail could not be read.');
    reader.readAsDataURL(newTutorialFile);
  };

  /* Password-based Super Admin write-mode unlock permanently removed.
    if (!mfaConfirmed) {
      setMfaError('Verify MFA before unlocking write mode.');
      return;
    }
    let verified = false;
    try {
      verified = await verifySuperAdminPassword(enteredPassword);
    } catch (error: any) {
      alert(error?.message || 'Password verification is temporarily unavailable.');
      return;
    }
    if (verified) {
      setIsUnlocked(true);
      setMfaConfirmed(false);
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

  */
  

  // Hotline Send Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
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
    try {
      await saveMessages(updated);
      setMessages(updated);
    } catch (error: any) {
      alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    setBroadcastMessage('');
    handleAuditLog(`Transmitted general broadcast to ${broadcastTarget}`, 'Platform Broadcaster');
    alert(`📢 General broadcast dispatched to all connected ${broadcastTarget}!`);
  };

  // Direct DM Support Routing
  const handleSendDM = async (e: React.FormEvent) => {
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
    try {
      await saveMessages(updated);
      setMessages(updated);
    } catch (error: any) {
      alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    setDmMessage('');
    handleAuditLog(`Dispatched DM message to ${dmSearchQuery}`, dmSearchQuery);
    alert(`💌 Support DM successfully routed to ${dmSearchQuery}!`);
  };

  // Promotional Banner Setup 
  const resetBannerForm = () => {
    setEditingBannerId(null);
    setNewBannerTitle('');
    setNewBannerDestination('');
    setNewBannerCreative(null);
    setNewBannerMessage('');
    setNewBannerStatus('Active');
    setNewBannerSize('728x90');
    setNewBannerAdType('image');
  };

  const handleEditBanner = (banner: any) => {
    setEditingBannerId(banner.id);
    setNewBannerTitle(banner.title || '');
    setNewBannerSize(banner.size || '728x90');
    setNewBannerDestination(banner.url || '');
    setNewBannerStatus(banner.status || 'Active');
    setNewBannerAdType((banner.adType || 'image') as any);
    setNewBannerMessage(banner.message || '');
    setNewBannerCreative(null);
  };

  const handleDeleteBanner = async (bannerId: string) => {
    const target = banners.find((banner) => banner.id === bannerId);
    if (!target) return;
    if (!confirm(`Delete SSP ad "${target.title}"? Affiliates will no longer see this material.`)) return;

    const updatedBanners = banners.filter((banner) => banner.id !== bannerId);
    const updatedPlacements = adPlacements.map((placement) => {
      if (placement.size !== target.size) return placement;
      return { ...placement, activeBannersCount: Math.max(0, Number(placement.activeBannersCount || 0) - 1) };
    });
    try {
      await saveCampaignData(updatedPlacements, updatedBanners);
      setBanners(updatedBanners);
      setAdPlacements(updatedPlacements);
    } catch (error: any) {
      alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    if (editingBannerId === bannerId) resetBannerForm();
    handleAuditLog(`Deleted SSP ad unit: ${target.title}`, 'Banner engine');
  };

  const handleCreateBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBannerTitle.trim()) return;
    const existingBanner = editingBannerId ? banners.find((banner) => banner.id === editingBannerId) : null;
    if (newBannerAdType !== 'message' && !newBannerCreative && !existingBanner?.assetData) {
      alert('Upload a creative file or choose Message Ad.');
      return;
    }
    if (newBannerAdType === 'message' && !newBannerCreative && !existingBanner?.thumbnailData) {
      alert('Message advertisements need a thumbnail image.');
      return;
    }
    if (newBannerAdType === 'message' && newBannerCreative && (!newBannerCreative.type.startsWith('image/') || newBannerCreative.size > 800 * 1024)) {
      alert('Use a thumbnail image under 800 KB for message ads.');
      return;
    }
    if (newBannerAdType === 'message' && !newBannerMessage.trim()) {
      alert('Write the message ad text first.');
      return;
    }

    const persistAd = async (assetData: string | null = null) => {
      const finalAssetData = assetData ?? (editingBannerId ? existingBanner?.assetData || null : null);
      const finalCreativeName = newBannerCreative ? newBannerCreative.name : existingBanner?.creativeName || null;
      const finalCreativeMime = newBannerCreative ? newBannerCreative.type : existingBanner?.creativeMime || null;
      const nextAd = {
        id: editingBannerId || 'ban-' + Math.floor(Math.random() * 10000),
        title: newBannerTitle,
        size: newBannerSize,
        url: newBannerDestination || 'https://dukaplus.co.tz/upgrade',
        clicks: existingBanner?.clicks || 0,
        status: newBannerStatus,
        category: newBannerAdType === 'message' ? 'Message Ad' : 'Media Campaign',
        adType: newBannerAdType,
        message: newBannerMessage.trim(),
        creativeName: newBannerAdType === 'message' ? null : finalCreativeName,
        creativeMime: newBannerAdType === 'message' ? null : finalCreativeMime,
        assetData: newBannerAdType === 'message' ? null : finalAssetData,
        thumbnailData: newBannerAdType === 'message' ? (finalAssetData || existingBanner?.thumbnailData || null) : (String(finalCreativeMime || '').startsWith('image/') ? finalAssetData : existingBanner?.thumbnailData || null),
      };

      const updatedBanners = editingBannerId
        ? banners.map((banner) => banner.id === editingBannerId ? nextAd : banner)
        : [...banners, nextAd];

      const updatedPlacements = adPlacements.map(p => {
        const count = Number(p.activeBannersCount || 0);
        if (!editingBannerId && p.size === newBannerSize) {
          return { ...p, activeBannersCount: count + 1 };
        }
        if (editingBannerId && existingBanner?.size !== newBannerSize) {
          if (p.size === existingBanner?.size) return { ...p, activeBannersCount: Math.max(0, count - 1) };
          if (p.size === newBannerSize) return { ...p, activeBannersCount: count + 1 };
        }
        return p;
      });

      try {
        await saveCampaignData(updatedPlacements, updatedBanners);
        setBanners(updatedBanners);
        setAdPlacements(updatedPlacements);
      } catch (error: any) {
        alert(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
        return;
      }
      resetBannerForm();
      handleAuditLog(`${editingBannerId ? 'Updated' : 'Created'} SSP ad unit: ${newBannerTitle}`, 'Banner engine');
      alert(`SSP ad ${editingBannerId ? 'updated' : 'stored'} and active.`);
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
  

  if (mirroredAccount) {
    if (isMirrorAffiliate) {
      return (
        <AffiliateWorkspace
          onLogout={() => {
            setMirroredAccount(null);
            setIsMirrorAffiliate(false);
          }}
          mirrorAffiliateId={mirroredAccount.affiliateId || mirroredAccount.id}
          mirrorMode
        />
      );
    }

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
            mirrorMode
          />
        </div>
      </div>
    );
  }

  return (
    <div id="super-saas-admin-container" className="dark flex-1 min-h-0 flex flex-col text-slate-100 font-sans text-left bg-slate-950 animate-fade-in select-text">

      {/* ── MOBILE HEADER (md:hidden) ─────────────────────────── */}
      <div className="md:hidden sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {adminUser?.profileImage ? (
            <img src={adminUser.profileImage} alt={adminUser.name || 'Admin'} className="w-7 h-7 rounded-full object-cover border border-emerald-500/30" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
          )}
          <div>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider leading-none">Super Admin</p>
            <p className="text-xs font-black text-white leading-tight">{adminUser?.name || 'Control Portal'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <button onClick={() => { setIsUnlocked(false); setShowPasswordInput(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-bold cursor-pointer">
              <Unlock className="w-3 h-3" /> WRITE
            </button>
          ) : (
            <button onClick={handleShieldClick}
              className="p-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl cursor-default">
              <Shield className="w-4 h-4 text-amber-400" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile password input */}
      {showPasswordInput && !isUnlocked && (
        <div className="md:hidden px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <button onClick={beginMfaVerification} disabled={mfaBusy}
            className="w-full px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-semibold disabled:opacity-50">
            {mfaBusy ? 'Preparing MFA…' : 'Verify Authenticator'}
          </button>
        </div>
      )}

      {/* ── DESKTOP HEADER (hidden on mobile) ────────────────────── */}
      <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 m-6 mb-0">
        <div>
          <div className="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider mb-2">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Operational Admin Core Panel</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">Central SaaS Control Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Manage subscriptions, partners, and devices.</p>
        </div>
        <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          {/* Real admin profile */}
          {adminUser && (
            <div className="flex items-center gap-2.5 pl-1 pr-3 border-r border-slate-700 mr-1">
              {adminUser.profileImage ? (
                <img src={adminUser.profileImage} alt={adminUser.name || 'Admin'} className="w-8 h-8 rounded-full object-cover border border-emerald-500/30" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-xs">
                  {(adminUser.name || 'SA').substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-[11px] font-black text-white leading-tight">{adminUser.name || 'Super Admin'}</p>
                <p className="text-[9px] text-slate-400 leading-tight font-mono">{adminUser.phone || adminUser.email || 'Admin'}</p>
              </div>
            </div>
          )}
          {isUnlocked ? (
            <div className="flex items-center space-x-2.5 px-2">
              <div className="p-1.5 bg-emerald-500/10 rounded"><Unlock className="w-4 h-4 text-emerald-400" /></div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-mono text-slate-400 block leading-tight">Scope</span>
                <span className="text-[11px] text-emerald-400 font-bold block">WRITE</span>
              </div>
              <button onClick={() => { setIsUnlocked(false); setShowPasswordInput(false); }}
                className="ml-2 px-2.5 py-1 bg-red-500/20 text-red-400 text-[10px] font-mono uppercase tracking-wider rounded-lg cursor-pointer">
                Return to Read Only
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5 px-2">
              {!showPasswordInput ? (
                <button onClick={handleShieldClick}
                  className="p-1.5 bg-amber-500/10 rounded cursor-default">
                  <Shield className="w-4 h-4 text-amber-400" />
                </button>
              ) : (
                <>
                  <button onClick={() => setShowPasswordInput(false)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer">
                    <Shield className="w-4 h-4 text-slate-400" />
                  </button>
                  <div className="flex items-center space-x-1.5 ml-1">
                    <button onClick={beginMfaVerification} disabled={mfaBusy}
                      className="bg-emerald-500 text-slate-950 px-3 py-1.5 text-xs rounded-lg font-semibold disabled:opacity-50">
                      {mfaBusy ? 'Preparing…' : 'Verify MFA'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {mfaPrompt && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">
                {mfaPrompt.mode === 'enroll' ? 'Set up Super Admin MFA' : 'Verify Super Admin MFA'}
              </h3>
            </div>
            {mfaPrompt.mode === 'enroll' && (
              <>
                <p className="text-xs text-slate-300 mb-3">Scan this QR code using an authenticator app, then enter its current 6-digit code.</p>
                {mfaPrompt.qrCode && <img src={mfaPrompt.qrCode} alt="Authenticator QR code" className="mx-auto w-48 h-48 rounded-xl bg-white p-2" />}
                {mfaPrompt.secret && <p className="mt-2 break-all rounded-lg bg-slate-950 p-2 text-[10px] font-mono text-slate-300">Manual key: {mfaPrompt.secret}</p>}
              </>
            )}
            {mfaPrompt.mode === 'challenge' && <p className="text-xs text-slate-300 mb-3">Enter the current 6-digit code from your authenticator app.</p>}
            <input value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
              className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-emerald-500" />
            {mfaError && <p className="mt-2 text-xs text-rose-400">{mfaError}</p>}
            <button onClick={confirmMfaVerification} disabled={mfaBusy || mfaCode.length !== 6}
              className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
              {mfaBusy ? 'Verifying…' : 'Verify code'}
            </button>
          </div>
        </div>
      )}

      {/* Main interactive subpage container */}
      <div id="saas-active-subpage-view" className="flex-1 min-h-0 overflow-y-auto flex flex-col w-full min-w-0 p-4 sm:p-5 lg:p-7 space-y-5 lg:space-y-7 pb-3 md:pb-8">
        <React.Suspense fallback={<div role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">Loading workspace…</div>}>
        
        {/* ======================= TAB 1: USER DESK ======================= */}
        {activeTab === 'subscribers' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSUserDesk isUnlocked={isUnlocked} onLock={() => setIsUnlocked(false)} />
          </div>
        )}

        {/* Private Pro workspace: read-only until server-authorized billing and ledger land. */}
        {activeTab === 'orvix-pro' && (
          <OrvixProAdminPanel onOpenSubscribers={() => setActiveTab('subscribers')} />
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
        {(activeTab === 'affiliates' || activeTab === 'affiliate-agents' || activeTab === 'sub-affiliates') && (
          <div className="space-y-6 animate-fade-in text-left">
            <SuperAffiliateControlCenter
              initialTab={
                activeTab === 'affiliate-agents'
                  ? 'agents'
                  : activeTab === 'sub-affiliates'
                    ? 'subAffiliates'
                    : 'overview'
              }
              isUnlocked={isUnlocked}
            />
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

        {/* ======================= TAB: USER ACTIVITY & ONLINE ======================= */}
        {activeTab === 'user-activity' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSUserActivityView />
          </div>
        )}

        {/* ======================= TAB: WEB EDITOR PAGE BUILDER ======================= */}
        {activeTab === 'web-editor' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSWebEditor />
          </div>
        )}

        {/* ======================= TAB: AD PLACEMENTS ======================= */}
        {activeTab === 'ad-placements' && (
          <div className="animate-fade-in text-left">
            <SaaSAdPlacementsPanel />
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
                <p className="text-xs text-slate-400 leading-relaxed">
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
                          <h4 translate="no" className="font-extrabold text-xs text-white leading-tight">{item.name}</h4>
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
            <div className="space-y-5">
              <header className="space-y-1 px-1">
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Chats & Broadcasts</h2>
                <p className="text-sm leading-relaxed text-slate-400">Send announcements and direct support messages from one place.</p>
              </header>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch lg:gap-6">
              
              {/* Broadcast Center */}
              <div className="min-w-0 lg:col-span-5">
                <section aria-label="Broadcast announcement" className="h-full space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm sm:p-6">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 text-rose-400" />
                    <h3 className="text-base font-bold tracking-tight text-white">Broadcast Announcement</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-400">Send announcements to active subscribers or affiliates.</p>
                  
                  <form onSubmit={handleSendBroadcast} className="space-y-5">
                    <div role="group" aria-label="Broadcast audience" className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1.5">
                      <button 
                        type="button" 
                        onClick={() => setBroadcastTarget('subscribers')}
                        className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-center text-xs font-semibold leading-snug transition-colors ${broadcastTarget === 'subscribers' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}
                      >
                        Subscribers
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setBroadcastTarget('affiliates')}
                        className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-center text-xs font-semibold leading-snug transition-colors ${broadcastTarget === 'affiliates' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}
                      >
                        Affiliates
                      </button>
                    </div>

                    <label htmlFor="admin-broadcast-message" className="mb-2 block text-xs font-semibold text-slate-300">Announcement message</label>
                    <textarea
                      id="admin-broadcast-message"
                      rows={5}
                      placeholder="Write your announcement... "
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      className="block min-h-32 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-slate-500 outline-none transition-colors focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                    />

                    <button 
                      type="submit"
                      disabled={!broadcastMessage.trim()}
                      className="min-h-12 w-full rounded-xl border border-rose-500/30 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-300 transition-colors hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Send Broadcast
                    </button>
                  </form>
                </section>
              </div>

              {/* Specific Support Ticket DM */}
              <section aria-label="Direct support" className="min-w-0 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm sm:p-6 lg:col-span-7">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-base font-bold tracking-tight text-white">Direct Support Message</h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">Send a private message to a specific subscriber or affiliate.</p>

                <form onSubmit={handleSendDM} className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                      <label htmlFor="admin-dm-target" className="block text-xs font-semibold text-slate-300">Target user</label>
                      <input 
                        id="admin-dm-target"
                        type="text"
                        placeholder="e.g. @sarah_orvix"
                        value={dmSearchQuery}
                        onChange={(e) => setDmSearchQuery(e.target.value)}
                        className="min-h-12 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                        required
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <label htmlFor="admin-dm-desk" className="block text-xs font-semibold text-slate-300">Recipient desk</label>
                      <select 
                        id="admin-dm-desk"
                        value={dmRecipientType}
                        onChange={(e) => setDmRecipientType(e.target.value as any)}
                        className="min-h-12 w-full min-w-0 cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                      >
                        <option value="subscriber">Subscriber Instance</option>
                        <option value="affiliate">Affiliate Portal</option>
                      </select>
                    </div>
                  </div>

                  <label htmlFor="admin-dm-message" className="mb-2 block text-xs font-semibold text-slate-300">Private message</label>
                  <textarea
                    id="admin-dm-message"
                    rows={5}
                    placeholder="Write your private message..."
                    value={dmMessage}
                    onChange={(e) => setDmMessage(e.target.value)}
                    className="block min-h-32 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-slate-500 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                    required
                  />

                  <button 
                    type="submit"
                    disabled={!dmSearchQuery.trim() || !dmMessage.trim()}
                    className="min-h-12 w-full rounded-xl border border-cyan-500/30 bg-cyan-500/20 px-4 py-3 text-sm font-bold text-cyan-300 transition-colors hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send Direct Message
                  </button>
                </form>
              </section>
              </div>
            </div>

            {/* Support Message history */}
            <section aria-label="Outbound message history" className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
              <h3 className="text-base font-bold tracking-tight text-white">Outbound Message History</h3>
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {messages.map((m, idx) => (
                  <div key={idx} className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs sm:p-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                        <span className="text-white font-bold">{m.sender}</span>
                        <span>➡️</span>
                        <span className="text-slate-300 font-bold">{m.target}</span>
                        <span>{m.date}</span>
                      </div>
                      <p className="break-words text-sm leading-relaxed text-slate-200">{m.message}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${m.type === 'broadcast' ? 'bg-rose-500/10 text-rose-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                      {m.type}
                    </span>
                  </div>
                ))}
                {messages.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">No outbound messages yet.</p>}
              </div>
            </section>
          </div>
        )}

        {/* ======================= TAB 4: INBOX ======================= */}
        {activeTab === 'inbox' && (
          <SaaSInbox />
        )}

        {/* ======================= TAB: SECURITY ACTIVITY ======================= */}
        {activeTab === 'security' && (
          <SecurityActivityView />
        )}

        {/* ======================= TAB 5: AD EXCHANGE SSP ======================= */}
        {activeTab === 'promotions' && (
          <div className="space-y-5 animate-fade-in text-left">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
              
              {/* Ad Exchange SSP Manager */}
              <div className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    {editingBannerId ? 'Edit Affiliate Promotion' : 'Affiliate Promotion Materials'}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">Publish images, videos, animations and message cards for affiliate campaigns. Placements for tenants and staff are managed separately.</p>

                <form onSubmit={handleCreateBanner} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-500 uppercase">Ad Unit Campaign Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. Orvix Standard Leaderboard 2026"
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                      className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono text-slate-500 uppercase">Ad Type</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                            className={`min-h-11 min-w-0 p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
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
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-mono text-slate-500 uppercase">AdSense Format (Size)</label>
                      <select 
                        value={newBannerSize}
                        onChange={(e) => setNewBannerSize(e.target.value)}
                        className="min-h-11 w-full min-w-0 cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
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
                        className="min-h-11 w-full min-w-0 cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
                      >
                        <option value="Active">Live (Serving)</option>
                        <option value="Draft">Paused (Not Serving)</option>
                      </select>
                    </div>
                  </div>

                  {true && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">{newBannerAdType === 'message' ? 'Thumbnail image (required)' : 'Creative media'}</label>
                    <div className="w-full bg-slate-950 border border-slate-800 border-dashed rounded p-4 text-center cursor-pointer hover:bg-slate-900 transition-colors">
                      <input 
                        type="file" 
                        accept={newBannerAdType === 'message' ? 'image/png,image/jpeg,image/webp' : 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime'} 
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
                        <span className="text-[9px] text-slate-500">{newBannerAdType === 'message' ? 'Thumbnail: JPG, PNG, WEBP (max 800 KB)' : 'Supported: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV.'}</span>
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
                      placeholder="https://orvix.africa/promo"
                      value={newBannerDestination}
                      onChange={(e) => setNewBannerDestination(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <button 
                      type="submit"
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-transform"
                    >
                      {editingBannerId ? 'Update SSP Ad Unit' : 'Deploy Ad Unit to Exchange'}
                    </button>
                    {editingBannerId && (
                      <button
                        type="button"
                        onClick={resetBannerForm}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs uppercase tracking-wider rounded-lg"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* SSP Banners display */}
              <div className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 space-y-4">
                <h3 className="text-base font-bold text-white">Promotion Library ({banners.length})</h3>
                <div className="grid min-w-0 gap-3">
                  {banners.map((ban, idx) => (
                    <div key={idx} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-black text-white">{ban.title}</p>
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">{ban.status}</span>
                            <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{ban.size}</span>
                            <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{(ban.adType || ban.category || 'image').toString()}</span>
                          </div>
                          <div className="grid gap-1 text-[10px] font-mono text-slate-500 sm:grid-cols-2 xl:grid-cols-3">
                            <p className="truncate">Creative: <span className="text-cyan-300">{ban.creativeName || (ban.message ? 'Message ad' : 'Stored asset')}</span></p>
                            <p className="truncate">Destination: <span className="text-slate-300">{ban.url}</span></p>
                            <p className="truncate">Clicks: <span className="text-emerald-300">{ban.clicks || 0}</span></p>
                          </div>
                          {ban.message && (
                            <p className="line-clamp-1 text-[10px] text-slate-400">{ban.message}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                          <button
                            type="button"
                            onClick={() => handleEditBanner(ban)}
                            className="rounded-lg bg-slate-800 px-4 py-2 text-[10px] font-bold uppercase text-cyan-300 hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBanner(ban.id)}
                            className="rounded-lg bg-slate-800 px-4 py-2 text-[10px] font-bold uppercase text-rose-400 hover:bg-slate-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {banners.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 p-5 text-center text-xs text-slate-500">
                      No SSP materials uploaded yet.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================= TAB 6: TUTORIALS ======================= */}
        {activeTab === 'tutorials' && (
          <div className="space-y-5 animate-fade-in text-left">
            <header className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white sm:text-xl">Affiliate Tutorials</h2>
              </div>
              <p className="mt-2 text-sm text-slate-400">Publish learning materials with a required thumbnail and an external YouTube, TikTok, Instagram or Facebook link. Videos are never uploaded to Orvix.</p>
            </header>
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
                <h3 className="mb-4 text-base font-bold text-white">{editingTutorialId ? 'Edit Tutorial' : 'New Tutorial'}</h3>
                <form onSubmit={handleCreateTutorial} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="tutorial-title" className="text-xs font-semibold text-slate-300">Tutorial title</label>
                    <input id="tutorial-title" type="text" required value={newTutorialTitle} onChange={e=>setNewTutorialTitle(e.target.value)}
                      placeholder="How to promote Orvix" className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-teal-400" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Content type</label>
                      <select value={newTutorialType} onChange={e=>setNewTutorialType(e.target.value as any)}
                        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white">
                        <option value="video">External video</option><option value="guide">Guide</option><option value="lesson">Lesson</option><option value="message">Message</option>
                      </select>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Platform</label>
                      <select value={newTutorialPlatform} onChange={e=>setNewTutorialPlatform(e.target.value as any)}
                        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white">
                        <option value="youtube">YouTube</option><option value="tiktok">TikTok</option>
                        <option value="instagram">Instagram</option><option value="facebook">Facebook</option>
                        <option value="website">Other website</option><option value="none">Message only</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">External link (required for video)</label>
                    <input type="url" value={newTutorialLink} onChange={e=>setNewTutorialLink(e.target.value)}
                      placeholder="https://..." className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-teal-400" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Description / message</label>
                    <textarea rows={3} value={newTutorialDescription} onChange={e=>setNewTutorialDescription(e.target.value)}
                      placeholder="What will affiliates learn?" className="w-full min-w-0 resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-teal-400" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Thumbnail orientation</label>
                      <select value={newTutorialOrientation} onChange={e=>setNewTutorialOrientation(e.target.value as any)}
                        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white">
                        <option value="horizontal">Horizontal (16:9)</option><option value="vertical">Vertical (9:16)</option>
                      </select>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Publish status</label>
                      <select value={newTutorialStatus} onChange={e=>setNewTutorialStatus(e.target.value as any)}
                        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white">
                        <option value="Active">Published</option><option value="Draft">Draft</option>
                      </select>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Thumbnail image (required)</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setNewTutorialFile(e.target.files?.[0] || null)}
                      className="w-full min-w-0 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-3 text-xs text-slate-200 file:mr-2 file:rounded file:border-none file:bg-teal-500 file:px-3 file:py-2 file:font-bold file:text-slate-950" />
                    <p className="text-xs text-slate-500">JPG, PNG or WEBP, max 800 KB. No video upload.</p>
                    {editingTutorialId && <p className="text-xs text-teal-300">Existing cover is retained unless replaced.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="min-h-11 flex-1 rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400">{editingTutorialId?'Update Tutorial':'Publish Tutorial'}</button>
                    {editingTutorialId && <button type="button" onClick={resetTutorialForm} className="min-h-11 rounded-xl bg-slate-800 px-4 text-sm text-white">Cancel</button>}
                  </div>
                </form>
              </section>
              <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
                <h3 className="mb-4 text-base font-bold text-white">Tutorial Library ({tutorials.length})</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {tutorials.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">No tutorials yet. Add the first thumbnail and link.</p>}
                  {tutorials.map((tutorial:any)=>(
                    <article key={tutorial.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3">
                      {tutorial.thumbnailData && <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                        <img src={tutorial.thumbnailData} alt={tutorial.title+' cover'} loading="lazy" className="h-full w-full object-contain" />
                      </div>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase">
                        <span className="text-teal-300">{tutorial.type}</span><span className="text-slate-400">{tutorial.platform||'legacy'}</span>
                        <span className={tutorial.status==='Draft'?'text-amber-400':'text-emerald-400'}>{tutorial.status||'Legacy'}</span>
                      </div>
                      <h4 className="mt-1 truncate text-sm font-semibold text-white">{tutorial.title}</h4>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{tutorial.description}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={()=>handleEditTutorial(tutorial)} className="min-h-9 rounded-lg bg-slate-800 text-xs font-semibold text-cyan-300">Edit</button>
                        <button type="button" onClick={async()=>{if(!confirm('Delete this tutorial?'))return;try{await saveTutorials(tutorials.filter(item=>item.id!==tutorial.id));}catch(error:any){alert(error?.message||ONLINE_ONLY_WRITE_MESSAGE);}}} className="min-h-9 rounded-lg bg-slate-800 text-xs font-semibold text-rose-300">Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ======================= TAB 7: EXPENSES ======================= */}
        {activeTab === 'expenses' && (
          <div className="space-y-6 animate-fade-in text-left">
            <SaaSExpensesView />
          </div>
        )}
        </React.Suspense>
      </div>

    </div>
  );
}

