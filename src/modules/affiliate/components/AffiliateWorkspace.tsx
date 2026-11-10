import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BarChart3, CalendarClock, CheckCircle2, ClipboardList, Copy, Download, ExternalLink, Film, Link as LinkIcon, LogOut, LoaderCircle, Menu, Pencil as PencilIcon, PlayCircle, RefreshCw, Settings, ShieldCheck, TrendingUp, Wallet, X, AlertCircle, ArrowDownToLine, Phone, User, ChevronRight, Clock, CheckCheck, Users, Search, MapPin, Building2, Calendar, Bell, type LucideIcon } from "lucide-react";
import {
  AffiliateCampaign,
  AffiliateNotification,
  AffiliateWorkspaceData,
  completeAffiliateTask,
  loadAffiliateWorkspace,
  markAffiliateNotificationRead,
  recordAffiliateActivity,
} from '../utils/affiliateWorkspace';
import {
  isOnline,
  initOfflineSync,
  dbWrite,
  flushSyncQueue,
} from '../utils/offlineSync';
import { ONLINE_ONLY_WRITE_MESSAGE } from '../../../shared/utils/onlineOnly';
import { isSettledPaymentStatus } from '../../../shared/utils/financialStatus';
import { formatLocalMonth } from '../../../shared/utils/localDate';
import { downloadExcelFileFromRows } from '../../../shared/utils/excelExport';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';
import { AFFILIATE_MIN_WITHDRAWAL_TZS, getAzamPayFee, getTanzaniaMonthEndWithdrawalDate, sumRewardBalance } from '../utils/affiliatePolicy';
import { getAffiliateDashboardSummary, getAffiliateCustomerState } from '../utils/affiliateDashboardSummary';

const currency = new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 });

const formatDateTime = (value: string) => new Intl.DateTimeFormat('en-TZ', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const formatBytes = (value: number | null) => {
  if (!value) return null;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const isSafeExternalUrl = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'https:' || url.protocol === 'http:') return true;
    return value.startsWith('data:image/') || value.startsWith('data:video/') || value.startsWith('data:text/');
  } catch {
    return false;
  }
};

type TabId = 'overview' | 'tenants' | 'code-link' | 'tasks' | 'ads' | 'meetings' | 'reports' | 'payouts' | 'settings';

interface AffiliateWorkspaceProps {
  onLogout: () => void;
  mirrorAffiliateId?: string;
  mirrorMode?: boolean;
}

export default function AffiliateWorkspace({ onLogout, mirrorAffiliateId, mirrorMode = false }: AffiliateWorkspaceProps) {
  const [workspace, setWorkspace] = useState<AffiliateWorkspaceData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isNetworkOnline, setIsNetworkOnline] = useState(isOnline());
  const [profileDraft, setProfileDraft] = useState({ displayName: '', payoutMethod: '', payoutAccount: '', country: 'Tanzania', region: '', district: '', location: '' });
  const [profilePrefs, setProfilePrefs] = useState({ emailUpdates: true, compactView: false });
  const [reportMonth, setReportMonth] = useState(formatLocalMonth());
  const [reportTab, setReportTab] = useState<'subscribers' | 'payments' | 'tasks'>('subscribers');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('all');
  const [withdrawForm, setWithdrawForm] = useState({ name: '', phone: '', amount: '', password: '' });
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  // Tenants tab state
  const [tenantSearch, setTenantSearch] = useState('');
  const [contentTab, setContentTab] = useState<'advertisements' | 'tutorials'>('advertisements');
  const [contentSlide, setContentSlide] = useState(0);
  const [tenantStatusFilter, setTenantStatusFilter] = useState<string>('all');
  const [tenantPlanFilter, setTenantPlanFilter] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const payoutWindow = getTanzaniaMonthEndWithdrawalDate();
  const transferFee = getAzamPayFee(workspace?.profile?.payout_method);

  useEffect(() => {
    initOfflineSync();
    const up   = () => { setIsNetworkOnline(true);  flushSyncQueue(); };
    const down = () => setIsNetworkOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online',  up);
      window.removeEventListener('offline', down);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [savedCode, setSavedCode] = useState(''); // overrides profile.referral_code immediately after save
  // Live referral link — derived from input while editing, or savedCode after save
  const getLiveCode = (prof: any) => {
    if (editingCode && newCode) return newCode;
    if (savedCode) return savedCode;
    // promo_code is what gets updated on edit — prioritize it
    return prof?.promo_code || prof?.referral_code || '';
  };
  const [codeError, setCodeError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const saveCode = async () => {
    if (!workspace || !newCode.trim()) return;
    if (!isNetworkOnline) {
      setCodeError(ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    const cleaned = newCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleaned) { setCodeError('Code must contain letters or numbers only.'); return; }
    if (workspace.profile.promo_code_changed_at) {
      setCodeError('Promo code can only be changed once.');
      return;
    }
    if (cleaned.length < 3 || cleaned.length > 20) {
      setCodeError('Promo code must be between 3 and 20 characters.');
      return;
    }
    if (cleaned === (savedCode || workspace.profile.referral_code || '').toUpperCase()) {
      setCodeError('Please choose a different code.');
      return;
    }
    // Database unique indexes and authenticated row trigger check collisions
    // and one-time eligibility atomically. Never load all Affiliate codes.
    // Save to DB first; local cache follows only after cloud confirms.
    const result = await dbWrite('affiliates', 'update',
      { promo_code: cleaned, referral_code: cleaned, referral_slug: cleaned.toLowerCase() },
      { column: 'id', value: workspace.profile.id },
      workspace.profile.id
    );
    if (!result.success) {
      setCodeError(result.error || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    // Confirmed in Supabase; local cache can now follow.
    const all: any[] = JSON.parse(onlineStorage.getItem('saas_immersive_affiliates') || '[]');
    const updated = all.map((a: any) => a.id === workspace.profile.id ? { ...a, promoCode: cleaned } : a);
    onlineStorage.setItem('saas_immersive_affiliates', JSON.stringify(updated));
    const savedAff = JSON.parse(onlineStorage.getItem('jasper_logged_affiliate') || '{}');
    if (savedAff.id === workspace.profile.id) {
      savedAff.promoCode = cleaned;
      onlineStorage.setItem('jasper_logged_affiliate', JSON.stringify(savedAff));
    }
    setSavedCode(cleaned); // update display immediately
    setWorkspace(current => current ? { ...current, profile: {
      ...current.profile,
      referral_code: cleaned,
      referral_slug: cleaned.toLowerCase(),
      promo_code_changed_at: new Date().toISOString(),
    } } : current);
    setNotice(`Promo code updated to ${cleaned}. You cannot change it again.`);
    setEditingCode(false);
    setCodeError('');
    setSuggestions([]);
    // No full workspace refresh: the profile is updated locally after verified save.
  };

  const refresh = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const nextWorkspace = await loadAffiliateWorkspace({ affiliateId: mirrorAffiliateId });
      setWorkspace(nextWorkspace);
      setState(nextWorkspace ? 'ready' : 'missing');
    } catch (nextError: any) {
      setError(nextError?.message || 'Unable to load your affiliate workspace.');
      setState('error');
    }
  }, [mirrorAffiliateId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!workspace?.profile) return;
    const prefsKey = `jasper_affiliate_preferences_${workspace.profile.id}`;
    let savedPrefs = profilePrefs;
    try {
      savedPrefs = { ...profilePrefs, ...JSON.parse(onlineStorage.getItem(prefsKey) || '{}') };
    } catch {}
    setProfileDraft({
      displayName: workspace.profile.display_name || '',
      payoutMethod: workspace.profile.payout_method || '',
      payoutAccount: workspace.profile.payout_account || '',
      country: workspace.profile.country || 'Tanzania',
      region: workspace.profile.region || '',
      district: workspace.profile.district || '',
      location: workspace.profile.location || '',
    });
    setProfilePrefs(savedPrefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.profile?.id]);

  // Newly registered accounts can briefly show 'missing' if the database
  // insert hasn't fully propagated by the time this first loads. Auto-retry
  // a few times with a short delay before asking the user to do it manually.
  useEffect(() => {
    if (state !== 'missing' || autoRetryCount >= 3) return;
    const delay = 1200 * (autoRetryCount + 1);
    const timer = setTimeout(() => {
      setAutoRetryCount((c) => c + 1);
      refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [state, autoRetryCount, refresh]);

  // Autoplay rotates cards only on the overview; no automatic media playback.
  useEffect(() => {
    if (activeTab !== 'overview' || !workspace?.campaigns?.length || workspace.campaigns.length < 2) return;
    const timer = window.setInterval(() => setContentSlide(index => (index + 1) % workspace.campaigns.length), 5500);
    return () => window.clearInterval(timer);
  }, [activeTab, workspace?.campaigns]);

  const metrics = useMemo(() => {
    const referrals = workspace?.referrals || [];
    const commissions = workspace?.commissions || [];
    const activities = workspace?.activities || [];
    const subscribers = workspace?.subscribers || [];
    const rewards = workspace?.rewards || [];
    const balance = workspace?.walletSummary || sumRewardBalance(rewards);
    const totalRevenue = rewards.filter(reward => reward.reward_type === 'subscription_commission')
      .reduce((sum, reward) => sum + Number(reward.source_revenue || 0), 0);
    const grossCommission10 = rewards.filter(reward => reward.reward_type === 'subscription_commission')
      .reduce((sum, reward) => sum + Number(reward.gross_amount || 0), 0);
    const withholdingTax = rewards.reduce((sum, reward) => sum + Number(reward.withholding_tax || 0), 0);
    const earnedRewards = rewards.filter(reward => reward.status !== 'void');
    const available = balance.bonus + balance.commission;
    const earned = earnedRewards.reduce((sum, reward) => sum + Number(reward.net_amount || 0), 0);
    const paid = rewards.filter(reward => reward.status === 'paid')
      .reduce((sum, reward) => sum + Number(reward.net_amount || 0), 0);
    void commissions; // Historical commissions are displayed separately and never silently recalculated.
    return {
      clicks: referrals.filter((referral) => referral.status === 'clicked').length,
      registrations: subscribers.length || referrals.filter((referral) => ['registered','converted'].includes(referral.status)).length,
      conversions: referrals.filter((referral) => referral.status === 'converted').length,
      downloads: activities.filter((event) => event.event_type === 'ad_download' || event.event_type === 'task_download').length,
      meetingJoins: activities.filter((event) => event.event_type === 'meeting_join').length,
      copiedLinks: activities.filter((event) => event.event_type === 'campaign_link_copy').length,
      totalRevenue: workspace?.walletSummary?.totalRevenue ?? totalRevenue,
      grossCommission10: workspace?.walletSummary?.grossCommission ?? grossCommission10,
      withholdingTax: workspace?.walletSummary?.withholding ?? withholdingTax,
      totalPayout: workspace?.walletSummary?.earned ?? earned,
      bonusAvailable: balance.bonus,
      commissionAvailable: balance.commission,
      available,
      earned: workspace?.walletSummary?.earned ?? earned,
      paid: workspace?.walletSummary?.paid ?? paid,
    };
  }, [workspace]);

  const monthlySubscribers = useMemo(() => {
    const subscribers = workspace?.subscribers || [];
    return subscribers.filter((subscriber) => (subscriber.created_at || '').slice(0, 7) === reportMonth);
  }, [workspace?.subscribers, reportMonth]);

  const isAgentApprovedForWithdrawals = workspace?.profile?.status === 'active';
  const hasMonthWithdrawal = (workspace?.payouts || []).some(payout =>
    payout.payout_month?.slice(0,7) === payoutWindow.currentMonth
  );
  const canWithdraw = metrics.available >= AFFILIATE_MIN_WITHDRAWAL_TZS
    && payoutWindow.isLastFriday && !hasMonthWithdrawal && isAgentApprovedForWithdrawals;

  const copyReferralLink = async () => {
    if (!workspace) return;
    const link = `${window.location.origin}/?ref=${encodeURIComponent(workspace.profile.referral_code)}`;
    await navigator.clipboard.writeText(link);
    setNotice('Referral link copied.');
    window.setTimeout(() => setNotice(null), 2500);
  };

  const handleTaskComplete = async (taskId: string) => {
    if (mirrorMode) return;
    setBusyTaskId(taskId);
    try {
      await completeAffiliateTask(taskId);
      await refresh();
    } catch (taskError: any) {
      setNotice(taskError?.message || 'Task status could not be updated.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    if (mirrorMode) return;
    setWorkspace((prev) => prev ? {
      ...prev,
      notifications: prev.notifications.map((n) => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n),
    } : prev);
    try {
      await markAffiliateNotificationRead(notificationId);
    } catch {
      // Best-effort — the read marker is not critical enough to surface an error for.
    }
  };

  const saveAffiliateSettings = async () => {
    if (!workspace?.profile) return;
    if (!isNetworkOnline) {
      setNotice(ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    const displayName = profileDraft.displayName.trim() || workspace.profile.display_name;
    const payoutMethod = profileDraft.payoutMethod.trim() || null;
    const payoutAccount = profileDraft.payoutAccount.trim() || null;
    if (![profileDraft.country,profileDraft.region,profileDraft.district,profileDraft.location].every(v=>v.trim())) {
      setNotice('Please complete country, region, district and area before saving.');
      return;
    }
    const locationFields = { country: profileDraft.country.trim(), region: profileDraft.region.trim(), district: profileDraft.district.trim(), location: profileDraft.location.trim() };
    const prefsKey = `jasper_affiliate_preferences_${workspace.profile.id}`;
    const result = await dbWrite(
      'affiliates',
      'update',
      { display_name: displayName, payout_method: payoutMethod, payout_account: payoutAccount, ...locationFields },
      { column: 'id', value: workspace.profile.id },
      workspace.profile.id,
    );
    if (!result.success) {
      setNotice(result.error || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }
    onlineStorage.setItem(prefsKey, JSON.stringify(profilePrefs));
    setWorkspace({
      ...workspace,
      profile: {
        ...workspace.profile,
        display_name: displayName,
        payout_method: payoutMethod,
        payout_account: payoutAccount,
        ...locationFields,
      },
    });
    setNotice('Profile settings saved.');
  };

  const handleWithdrawSubmit = async () => {
    if (!workspace?.profile || withdrawing) return;
    if (!isNetworkOnline) { setWithdrawError(ONLINE_ONLY_WRITE_MESSAGE); return; }
    if (!canWithdraw) {
      setWithdrawError('You can request your full balance on the last Friday of the month, starting at TZS 10,000.');
      return;
    }
    const name = workspace.profile.display_name || '';
    const phone = workspace.profile.phone_whatsapp || '';
    if (name.trim().length < 2 || phone.replace(/\D/g,'').length < 10) {
      setWithdrawError('A valid registered phone number is required.');
      return;
    }
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      // Atomic, server-validated RPC: no self-reported balance, fee or payout date.
      const client = await getSecureDataBridgeClient();
      const { data, error } = await client.rpc('request_affiliate_month_end_withdrawal_v2', {
        p_recipient_name: name.trim(),
        p_recipient_phone: phone.trim(),
        p_provider: workspace.profile.payout_method || 'm-pesa',
      });
      if (error) throw error;
      setShowWithdrawModal(false);
      setWithdrawForm({ name:'', phone:'', amount:'', password:'' });
      setNotice(`Request received: TZS ${Number(data?.net || 0).toLocaleString()} after fees. Awaiting manual review.`);
      await refresh();
    } catch (error: any) {
      setWithdrawError(error?.message || 'Withdrawal request failed.');
    } finally {
      setWithdrawing(false);
    }
  };

  const downloadUrl = (url: string, fileName?: string | null) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    if (fileName) anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleTrackedLink = async (
    eventType: 'ad_download' | 'campaign_link_copy' | 'task_download' | 'meeting_join',
    resourceType: string,
    resourceId: string,
    url: string,
    fileName?: string | null,
  ) => {
    if (!isSafeExternalUrl(url)) {
      setNotice('This resource is unavailable because its file or link is missing.');
      return;
    }
    if (!mirrorMode) {
      try { await recordAffiliateActivity(eventType, resourceType, resourceId); } catch { /* Tracking should not block a valid resource. */ }
    }
    if (eventType === 'campaign_link_copy') {
      await navigator.clipboard.writeText(url);
      setNotice('Campaign link copied.');
      return;
    }
    downloadUrl(url, fileName);
  };

  const copyCampaignMaterial = async (campaign: AffiliateCampaign) => {
    const copyValue = campaign.recommended_caption || campaign.description || campaign.campaign_url || campaign.media_url;
    if (!copyValue) {
      setNotice('This campaign has no text or link to copy.');
      return;
    }
    if (!mirrorMode) {
      try { await recordAffiliateActivity('campaign_link_copy', 'campaign', campaign.id); } catch { /* Tracking should not block copying. */ }
    }
    await navigator.clipboard.writeText(copyValue);
    setNotice('Promo material copied.');
  };

  if (state === 'loading') {
    return <div className="min-h-[70vh] grid place-items-center bg-slate-50 text-slate-500"><LoaderCircle className="w-6 h-6 animate-spin" /></div>;
  }

  if (state === 'missing' && autoRetryCount < 3) {
    return (
      <div className="min-h-[70vh] grid place-items-center bg-slate-50 text-slate-500 gap-3">
        <LoaderCircle className="w-6 h-6 animate-spin" />
        <p className="text-sm">Setting up your account...</p>
      </div>
    );
  }

  if (state === 'missing' || state === 'error') {
    return (
      <main className="min-h-[70vh] grid place-items-center px-5 bg-slate-50">
        <section className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-7 text-center shadow-sm">
          <ShieldCheck className="w-9 h-9 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900">{state === 'missing' ? 'Affiliate workspace pending' : 'Workspace unavailable'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {state === 'missing'
              ? 'You are signed in, but no active affiliate profile is connected to this account yet.'
              : error}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button type="button" onClick={() => { setAutoRetryCount(0); refresh(); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold"><RefreshCw className="w-4 h-4" /> Retry</button>
            <button type="button" onClick={onLogout} className="px-4 py-2.5 rounded-md border border-slate-300 text-slate-700 text-sm font-semibold">Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  const profile = workspace!.profile;
  const openTasks = workspace!.tasks.filter((task) => !['completed', 'reviewed'].includes(task.status));
  const upcomingMeetings = workspace!.meetings.filter((meeting) => ['upcoming', 'live'].includes(meeting.status));
  const notifications = workspace!.notifications || [];
  const earnedByType = (workspace?.rewards || []).filter(reward => reward.status !== 'void').reduce(
    (value, reward) => {
      if (reward.reward_type === 'registration_bonus') value.bonus += Number(reward.net_amount || 0);
      if (reward.reward_type === 'subscription_commission') value.commission += Number(reward.net_amount || 0);
      return value;
    }, { bonus: 0, commission: 0 }
  );
  const customerSummary = getAffiliateDashboardSummary(workspace?.subscribers || []);
  const recentCustomers = [...(workspace?.subscribers || [])]
    .sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0,3);
  const allNavItems: ReadonlyArray<readonly [TabId, string, LucideIcon]> = [
    ['overview', 'Overview', BarChart3],
    ['payouts', 'Payment Status', Wallet],
    ['tenants', 'Customers', Users],
    ['reports', 'Reports', TrendingUp],
    ['tasks', 'Tasks', ClipboardList],
    ['ads', 'Ads & Tutorials', Film],
    ['meetings', 'Meetings', CalendarClock],
    ['code-link', 'Code & Link', LinkIcon],
    ['settings', 'Settings', Settings],
  ];
  const navItems = allNavItems.filter(([id]) => !mirrorMode || id !== 'settings');
  const mobilePrimaryNav = navItems.slice(0, 3);
  const mobileMoreNav = navItems.slice(3);

  const renderCampaign = (campaign: AffiliateCampaign) => (
    <article key={campaign.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3 justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{campaign.content_type === 'tutorial' ? 'Affiliate Tutorial' : 'Promotion Material'}</p>
          <h3 className="mt-1 text-sm font-bold text-slate-950">{campaign.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{campaign.campaign_name}</p>
        </div>
        <Film className="w-5 h-5 text-slate-400 shrink-0" />
      </div>
      {(campaign.thumbnail_url || (campaign.media_mime_type?.startsWith('image/') ? campaign.media_url : null)) && isSafeExternalUrl(campaign.thumbnail_url || campaign.media_url) && (
        <div className="mt-3 flex h-44 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-50 dark:bg-emerald-950/50">
          <img src={campaign.thumbnail_url || campaign.media_url} alt={campaign.title} loading="lazy" decoding="async" className="h-full w-full object-contain" />
        </div>
      )}
      {!campaign.thumbnail_url && campaign.media_mime_type?.startsWith('video/') && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
          <Film className="mx-auto h-6 w-6 text-emerald-700"/>
          <p className="mt-2 text-xs text-slate-500">Video available on demand · no autoplay</p>
        </div>
      )}
      {campaign.description && <p className="mt-3 text-sm leading-5 text-slate-600">{campaign.description}</p>}
      {campaign.recommended_caption && <p className="mt-3 rounded-md border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">{campaign.recommended_caption}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        {campaign.duration_seconds ? <span>{Math.ceil(campaign.duration_seconds / 60)} min video</span> : null}
        {formatBytes(campaign.media_size_bytes) ? <span>{formatBytes(campaign.media_size_bytes)}</span> : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {campaign.content_type === 'tutorial' ? (
          <button type="button" disabled={!campaign.campaign_url} onClick={() => campaign.campaign_url && handleTrackedLink('ad_download', 'tutorial', campaign.id, campaign.campaign_url)} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><ExternalLink className="w-3.5 h-3.5" /> Open tutorial</button>
        ) : <button type="button" disabled={!campaign.media_url} onClick={() => handleTrackedLink('ad_download', 'campaign', campaign.id, campaign.media_url, campaign.media_name)} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Download className="w-3.5 h-3.5" /> Download</button>}
        <button type="button" onClick={() => copyCampaignMaterial(campaign)} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700"><Copy className="w-3.5 h-3.5" /> Copy text</button>
        {campaign.campaign_url ? <button type="button" onClick={() => handleTrackedLink('campaign_link_copy', 'campaign', campaign.id, campaign.campaign_url!)} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700"><Copy className="w-3.5 h-3.5" /> Copy link</button> : <span className="grid place-items-center rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-400">No link</span>}
      </div>
    </article>
  );

  return (
    <main className="bg-slate-50 text-slate-900 dark:bg-[#061b16] dark:text-white pb-24 lg:pb-8 min-h-[100dvh]">
      {mirrorMode && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-cyan-300 bg-slate-950 px-4 py-3 text-white shadow-lg sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Super Admin · Read-only mirror</p>
            <p className="truncate text-sm font-bold">Affiliate ID: {mirrorAffiliateId}</p>
          </div>
          <button type="button" onClick={onLogout} className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold hover:bg-slate-800">
            Back to Super Admin
          </button>
        </div>
      )}
      {/* Offline banner */}
      {!isNetworkOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 text-slate-950 text-xs font-bold py-2 px-4">
          ⚠️ Offline — Reconnect before saving changes. No offline sync will run automatically.
        </div>
      )}
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden h-screen sticky top-0 lg:flex flex-col border-r border-emerald-900 bg-[#063b2a] p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-700 text-sm font-semibold text-white">O</div>
            <div><p className="text-sm font-semibold text-white">Affiliate</p><p className="text-[11px] text-emerald-100/70">Orvix</p></div>
          </div>
          <nav className="mt-8 space-y-1" aria-label="Affiliate workspace navigation">
            {navItems.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold ${activeTab === id ? 'bg-emerald-600 text-white' : 'text-emerald-100/80 hover:bg-emerald-900/50'}`}><Icon className="h-4 w-4" />{label}</button>)}
          </nav>
          <button type="button" onClick={onLogout} className="mt-auto rounded-md border border-emerald-800 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-900">{mirrorMode ? 'Back to Super Admin' : 'Sign out'}</button>
        </aside>

        <section className="min-w-0 px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
          {activeTab === 'overview' && (
            <header className="mb-4 px-0.5">
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white sm:text-xl">
                Welcome, {profile.display_name}
              </h1>
            </header>
          )}

          {notice && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</div>}

          {activeTab === 'overview' && <div className="space-y-4 sm:space-y-5">
            <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
              {[
                ['My Customers', String(customerSummary.total), 'tenants'],
                ['Paid Customers', String(customerSummary.paid), 'tenants'],
                ['Unpaid Customers', String(customerSummary.unpaid), 'tenants'],
                ['Commission & Referrals', currency.format(metrics.earned), 'payouts'],
              ].map(([label, value, target]) => (
                <button key={label} type="button" onClick={() => setActiveTab(target as TabId)}
                  className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-300 dark:border-emerald-900 dark:bg-[#092c21] sm:p-4">
                  <p className="text-[10px] font-medium text-slate-500 dark:text-emerald-100/70 sm:text-xs">{label}</p>
                  <p className="mt-1.5 break-words text-base font-semibold tabular-nums text-slate-950 dark:text-white sm:text-xl">{value}</p>
                </button>
              ))}
            </section>
            <div className="grid gap-3 xl:grid-cols-2">
              <section data-testid="affiliate-plan-summary" className="relative isolate min-w-0 overflow-hidden rounded-xl border border-emerald-700/50 bg-[linear-gradient(112deg,#075c45_0%,#087658_58%,#086b51_100%)] text-white shadow-[0_9px_24px_-13px_rgba(5,112,78,0.48)] dark:border-emerald-700/50 dark:bg-[linear-gradient(112deg,#064c3a_0%,#076048_60%,#075640_100%)] dark:shadow-[0_12px_26px_-13px_rgba(0,0,0,0.55)]">
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-9 z-0 h-32 w-32 rounded-full border border-white/[0.08]" />
                <div aria-hidden="true" className="pointer-events-none absolute -right-3 -top-3 z-0 h-24 w-24 rounded-full border border-white/[0.07]" />
                <BarChart3 aria-hidden="true" className="pointer-events-none absolute bottom-1 right-4 z-0 h-16 w-16 -rotate-12 text-white/[0.06]" />
                <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/15 px-3.5 py-3">
                  <h2 className="text-xs font-semibold text-white sm:text-sm">Free Trial & Plans</h2>
                  <button type="button" onClick={() => setActiveTab('tenants')} className="rounded-md px-2 py-1 text-[11px] font-medium text-emerald-50 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">View all</button>
                </div>
                <div className="relative z-10 grid grid-cols-4 divide-x divide-white/15 px-1 py-4 sm:px-2">
                  {[
                    ['Trial', customerSummary.trial],
                    ['Ruby', customerSummary.ruby],
                    ['Diamond', customerSummary.diamond],
                    ['Tanzanite', customerSummary.tanzanite],
                  ].map(([label, total]) => (
                    <div key={label} className="min-w-0 px-1 text-center sm:px-2">
                      <p className="truncate text-[10px] font-medium text-emerald-100/85">{label}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{total}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="min-w-0 rounded-xl border border-slate-200 bg-white dark:border-emerald-900 dark:bg-[#092c21]">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-3 dark:border-emerald-900">
                  <h2 className="text-xs font-semibold text-slate-950 dark:text-white sm:text-sm">Recent Customers</h2>
                  <button type="button" onClick={() => setActiveTab('tenants')} className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">View all</button>
                </div>
                {recentCustomers.length ? (
                  <div className="divide-y divide-slate-100 dark:divide-emerald-900">
                    {recentCustomers.map(customer => (
                      <details key={customer.id} className="group px-3.5 py-2.5">
                        <summary className="flex cursor-pointer list-none items-center gap-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-slate-900 dark:text-white">{customer.customer_name}</span>
                            <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-emerald-100/65">{customer.package_name || 'No plan'}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-emerald-700 dark:text-emerald-300">
                            {getAffiliateCustomerState(customer) === 'paid' ? 'Paid' : getAffiliateCustomerState(customer) === 'trial' ? 'Trial' : 'Unpaid'}
                          </span>
                        </summary>
                        <div className="mt-2 flex justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500 dark:border-emerald-900 dark:text-emerald-100/65">
                          <span>{customer.region || customer.location || '—'}</span>
                          <span>{customer.created_at?.slice(0,10) || '—'}</span>
                        </div>
                      </details>
                    ))}
                  </div>
                ) : <p className="p-4 text-xs text-slate-500 dark:text-emerald-100/65">No customers yet.</p>}
              </section>
            </div>
            <section className="rounded-xl border border-slate-200 bg-white dark:border-emerald-900 dark:bg-[#092c21]">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-3 dark:border-emerald-900">
                <h2 className="text-xs font-semibold text-slate-950 dark:text-white sm:text-sm">Ads & Tutorials</h2>
                <button type="button" onClick={() => setActiveTab('ads')} className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">View all</button>
              </div>
              {workspace!.campaigns.some(c => c.status === 'active') ? (() => {
                const slides = workspace!.campaigns.filter(c => c.status === 'active');
                const selected = slides[contentSlide % slides.length];
                return (
                  <div className="min-w-0 space-y-3 p-3">
                    <button type="button"
                      onClick={() => { setContentTab(selected.content_type === 'tutorial' ? 'tutorials' : 'advertisements'); setActiveTab('ads'); }}
                      className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-emerald-50 p-2 text-left dark:border-emerald-900 dark:bg-emerald-950/70">
                      <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-emerald-900/60 sm:h-24 sm:w-40">
                        {(selected.thumbnail_url || (selected.media_mime_type?.startsWith('image/') ? selected.media_url : null)) && isSafeExternalUrl(selected.thumbnail_url || selected.media_url)
                          ? <img src={selected.thumbnail_url || selected.media_url} loading="lazy" alt={selected.title} className="h-full w-full object-contain" />
                          : <Film className="h-7 w-7 text-emerald-600 dark:text-emerald-300" />}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">{selected.content_type === 'tutorial' ? 'Tutorial' : 'Advertisement'}</span>
                        <span className="block line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{selected.title}</span>
                        <span className="mt-1 block text-xs text-slate-500 dark:text-emerald-100/65">{selected.platform || 'Orvix content'}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    </button>
                    {slides.length > 1 && (
                      <div className="flex items-center justify-center gap-2" aria-label="Content carousel controls">
                        {slides.slice(0, 12).map((slide, index) => (
                          <button key={slide.id} type="button" onClick={() => setContentSlide(index)}
                            aria-label={'Show content ' + (index + 1)}
                            aria-current={contentSlide % slides.length === index ? 'true' : undefined}
                            className={`h-2 rounded-full transition-all ${contentSlide % slides.length === index ? 'w-6 bg-emerald-600' : 'w-2 bg-slate-300 dark:bg-emerald-800'}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })() : <p className="p-4 text-xs text-slate-500 dark:text-emerald-100/65">Published Ads and Tutorials will appear here.</p>}
            </section>
            {(openTasks.length > 0 || notifications.length > 0) && (
              <button type="button" onClick={() => setActiveTab('tasks')}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 dark:border-emerald-900 dark:bg-[#092c21] dark:text-white">
                <span>Messages & Targets</span><span className="text-emerald-700 dark:text-emerald-300">{openTasks.length + notifications.length} new</span>
              </button>
            )}
          </div>}

          {activeTab === 'tenants' && (() => {
            const subs = workspace!.subscribers || [];
            const formatPlan = (s: typeof subs[number]) => {
              const plan = String(s.package_name || s.package_id || '').trim();
              if (/^(free[_ -]?trial|trial)$/i.test(plan) || s.payment_status === 'trial') return 'Free Trial';
              if (/ruby/i.test(plan)) return 'Ruby';
              if (/diamond/i.test(plan)) return 'Diamond';
              if (/tanzanite/i.test(plan)) return 'Tanzanite';
              return plan || 'Unassigned';
            };
            const getStatus = (s: typeof subs[number]) => {
              const state = getAffiliateCustomerState(s);
              const expired = s.subscription_end_date && new Date(s.subscription_end_date).getTime() < Date.now();
              const suspended = ['suspended','cancelled'].includes(String(s.payment_status || '').toLowerCase());
              if (suspended) return { key: 'unpaid', label: 'Inactive', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200' };
              if (expired) return { key: 'expired', label: 'Expired', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200' };
              if (state === 'paid') return { key: 'paid', label: 'Paid', style: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100' };
              if (state === 'trial') return { key: 'trial', label: 'Free Trial', style: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100' };
              return { key: 'unpaid', label: 'Pending', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200' };
            };
            const countPaid = subs.filter(s => getStatus(s).key === 'paid').length;
            const countTrial = subs.filter(s => getStatus(s).key === 'trial').length;
            const countUnpaid = subs.length - countPaid - countTrial;
            const formatDate = (value?: string | null) => {
              if (!value) return 'Not recorded';
              const date = new Date(value);
              return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-TZ') : 'Not recorded';
            };
            const formatActivity = (value?: string | null) => {
              if (!value) return 'Not recorded';
              const time = new Date(value).getTime();
              if (!Number.isFinite(time) || time > Date.now()) return 'Not recorded';
              const days = Math.floor((Date.now() - time) / 86400000);
              if (days === 0) return 'Today';
              if (days === 1) return 'Yesterday';
              if (days < 7) return `${days} days ago`;
              return formatDate(value);
            };
            const filtered = subs.filter(s => {
              const plan = formatPlan(s);
              const state = getStatus(s).key;
              const q = tenantSearch.trim().toLowerCase();
              const searchable = [s.customer_name,s.owner_name,s.email,s.phone_number,s.region,s.location,plan]
                .filter(Boolean).join(' ').toLowerCase();
              return (tenantPlanFilter === 'all' || plan.toLowerCase() === tenantPlanFilter)
                && (tenantStatusFilter === 'all' || state === tenantStatusFilter)
                && (!q || searchable.includes(q));
            });
            const summary = [
              ['Total Customers', subs.length],
              ['Paid', countPaid],
              ['Free Trial', countTrial],
              ['Unpaid / Expired', countUnpaid],
            ] as const;
            const plans = [
              ['all','All'],
              ['free trial','Free Trial'],
              ['ruby','Ruby'],
              ['diamond','Diamond'],
              ['tanzanite','Tanzanite'],
            ] as const;
            const customerFields = selectedTenant ? [
              ['Business', selectedTenant.customer_name || 'Name not provided'],
              ['Owner', selectedTenant.owner_name || 'Not provided'],
              ['Location', [selectedTenant.location, selectedTenant.region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Not provided'],
              ['Phone', selectedTenant.phone_number || 'Not provided'],
              ['Email', selectedTenant.email || 'Not provided'],
              ['Package', formatPlan(selectedTenant)],
              ['Subscription Status', getStatus(selectedTenant).label],
              ['Registration Date', formatDate(selectedTenant.created_at)],
              ['Amount Paid', currency.format(Number(selectedTenant.amount_paid || 0))],
              ['Subscription Start', formatDate(selectedTenant.subscription_start_date)],
              ['Subscription Expiry', formatDate(selectedTenant.subscription_end_date)],
              ['Last Activity', formatActivity(selectedTenant.last_activity_at)],
            ] as const : [];
            return (
              <section className="space-y-4 sm:space-y-5">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">My Subscribers</h2>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4" data-testid="subscriber-summary">
                  {summary.map(([label,total]) => (
                    <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-[0_5px_18px_-11px_rgba(6,78,59,0.27)] dark:border-emerald-900/70 dark:bg-[#092c21] sm:px-4 sm:py-4">
                      <p className="text-[11px] font-medium leading-4 text-slate-500 dark:text-emerald-100/70">{label}</p>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-950 dark:text-white sm:text-2xl">{total}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_5px_18px_-11px_rgba(6,78,59,0.2)] dark:border-emerald-900/70 dark:bg-[#092c21] sm:p-4">
                  <div className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-2 [-webkit-overflow-scrolling:touch]" role="group" aria-label="Filter by subscription plan" data-testid="subscriber-plan-filters">
                    {plans.map(([value,label]) => (
                      <button key={value} type="button" onClick={() => setTenantPlanFilter(value)}
                        aria-pressed={tenantPlanFilter === value}
                        className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors sm:text-xs ${
                          tenantPlanFilter === value
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                        }`}>{label}</button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_170px]">
                    <label className="relative block min-w-0">
                      <span className="sr-only">Search customers</span>
                      <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input value={tenantSearch} onChange={e => setTenantSearch(e.target.value)}
                        placeholder="Search customers..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-emerald-900 dark:bg-emerald-950 dark:text-white sm:text-sm"/>
                    </label>
                    <label className="block">
                      <span className="sr-only">Filter by customer status</span>
                      <select value={tenantStatusFilter} onChange={e => setTenantStatusFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-emerald-500 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 sm:text-sm">
                        <option value="all">All Statuses</option>
                        <option value="paid">Paid</option>
                        <option value="trial">Free Trial</option>
                        <option value="unpaid">Pending / Unpaid</option>
                        <option value="expired">Expired</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_5px_18px_-11px_rgba(6,78,59,0.2)] dark:border-emerald-900/70 dark:bg-[#092c21]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3 dark:border-emerald-900/60 sm:px-4">
                    <h3 className="text-xs font-semibold text-slate-950 dark:text-white sm:text-sm">Customers</h3>
                    <span className="text-[11px] tabular-nums text-slate-500 dark:text-emerald-100/70">{filtered.length} results</span>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <Users aria-hidden="true" className="mx-auto mb-2 h-6 w-6 text-emerald-500/60"/>
                      <p className="text-xs text-slate-500 dark:text-emerald-100/70">{subs.length === 0 ? 'No customers yet.' : 'No customers match your filters.'}</p>
                    </div>
                  ) : <div className="divide-y divide-slate-100 dark:divide-emerald-900/40" data-testid="subscriber-list">
                    {filtered.map(s => {
                      const state = getStatus(s);
                      return (
                        <button key={s.id} type="button" onClick={() => setSelectedTenant(s)}
                          aria-label={`View details for ${s.customer_name || 'subscriber'}`}
                          className="flex w-full min-w-0 items-center gap-2.5 px-3.5 py-3.5 text-left transition-colors hover:bg-emerald-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600 dark:hover:bg-emerald-900/30 sm:gap-4 sm:px-4">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white sm:text-sm">{s.customer_name || 'Name not provided'}</span>
                            <span className="mt-1 block truncate text-[10px] text-slate-500 dark:text-emerald-100/65 sm:text-xs">
                              {formatPlan(s)} · {s.location || s.region || 'Location not provided'}
                            </span>
                          </span>
                          <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${state.style}`}>{state.label}</span>
                          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 dark:text-emerald-100/60"/>
                        </button>
                      );
                    })}
                  </div>}
                </div>

                {selectedTenant && (
                  <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
                    onClick={e => { if (e.target === e.currentTarget) setSelectedTenant(null); }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="subscriber-detail-heading"
                      className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-emerald-900 dark:bg-[#092c21] sm:rounded-2xl">
                      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-emerald-900">
                        <h3 id="subscriber-detail-heading" className="text-sm font-semibold text-slate-950 dark:text-white">Customer Details</h3>
                        <button type="button" onClick={() => setSelectedTenant(null)} aria-label="Close details"
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-emerald-100 dark:hover:bg-emerald-900/40"><X className="h-4 w-4"/></button>
                      </div>
                      <dl className="min-h-0 space-y-0 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-1 sm:px-5">
                        {customerFields.map(([label,value]) => (
                          <div key={label} className="grid grid-cols-[minmax(105px,0.85fr)_minmax(0,1.15fr)] gap-3 border-b border-slate-100 py-3 text-xs last:border-0 dark:border-emerald-900/40 sm:text-sm">
                            <dt className="text-slate-500 dark:text-emerald-100/70">{label}</dt>
                            <dd className="min-w-0 break-words text-right font-medium text-slate-900 dark:text-white">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  </div>
                )}
              </section>
            );
          })()}

          {activeTab === 'code-link' && <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="text-xl font-black text-slate-950">Code & Link</h2>
              <p className="text-sm text-slate-500 mt-0.5">Your affiliate promo code and referral link</p>
            </div>

            {/* Promo code card */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <LinkIcon className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Promo Code</p>
                  <p className="text-xs text-slate-400">Share with customers to track your referrals</p>
                </div>
              </div>

              {editingCode ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700 leading-relaxed">
                    You can change your promo code only once. Your referral link will update automatically.
                  </div>
                  <input autoFocus type="text" value={newCode}
                    onChange={e => { setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'')); setCodeError(''); setSuggestions([]); }}
                    placeholder="ENTER NEW CODE" maxLength={20}
                    className={`w-full rounded-lg px-4 py-3 text-lg font-mono font-black uppercase tracking-widest text-slate-900 border-2 outline-none ${codeError ? 'border-rose-400 bg-rose-50' : 'border-emerald-400 bg-slate-50'}`} />
                  {codeError && (
                    <div className="space-y-2">
                      <p className="text-sm text-rose-600 font-semibold">⚠️ {codeError}</p>
                      {suggestions.length > 0 && (
                        <div className="flex gap-2 flex-wrap items-center">
                          <span className="text-xs text-slate-500">Available:</span>
                          {suggestions.map(s => (
                            <button key={s} type="button" onClick={() => { setNewCode(s); setCodeError(''); setSuggestions([]); }}
                              className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg font-bold cursor-pointer hover:bg-emerald-100">{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button type="button" onClick={saveCode}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg cursor-pointer border-none text-sm">
                      Save
                    </button>
                    <button type="button" onClick={() => { setEditingCode(false); setCodeError(''); setSuggestions([]); }}
                      className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer border-none text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <span className="flex-1 font-black text-slate-900 font-mono tracking-[0.2em] text-2xl">{getLiveCode(profile) || profile.referral_code}</span>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { navigator.clipboard.writeText(getLiveCode(profile) || profile.referral_code); setNotice('✅ Promo code copied!'); }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer border-none flex items-center justify-center gap-2 text-sm">
                      <Copy className="h-4 w-4" /> Copy Code
                    </button>
                    {!mirrorMode && !profile.promo_code_changed_at && <button type="button" onClick={() => { setEditingCode(true); setNewCode(getLiveCode(profile) || profile.referral_code); }}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer border-none flex items-center justify-center gap-2 text-sm">
                      <PencilIcon className="h-4 w-4" /> Edit Code
                    </button>}
                  </div>
                </div>
              )}
            </section>

            {/* Referral link card */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <ExternalLink className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Referral Link</p>
                  <p className="text-xs text-slate-400">New signups via this link are tracked to your account</p>
                </div>
              </div>
              <code className="block w-full overflow-x-auto rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 font-mono break-all">
                {window.location.origin}/?ref={getLiveCode(profile)}
              </code>
              <button type="button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${getLiveCode(profile) || profile.referral_code}`); setNotice('✅ Referral link copied!'); }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer border-none flex items-center justify-center gap-2 text-sm">
                <Copy className="h-4 w-4" /> Copy Referral Link
              </button>
            </section>
          </div>}

          {activeTab === 'tasks' && (
            <section className="space-y-3" data-testid="affiliate-lightweight-tasks">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Tasks</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-emerald-900 dark:bg-[#092a20]">
                {workspace!.tasks.map(task=><TaskRow key={task.id} task={task} busy={busyTaskId===task.id} readOnly={mirrorMode}
                  onComplete={handleTaskComplete} onDownload={()=>task.attachment_url && handleTrackedLink('task_download','task',task.id,task.attachment_url,task.attachment_name)}/>)}
                {workspace!.tasks.length===0&&<div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <ClipboardList className="h-8 w-8 text-emerald-700/55"/>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">No tasks assigned</p>
                  <p className="text-xs text-slate-500 dark:text-emerald-100/60">Tasks from your Agent will appear here.</p>
                </div>}
              </div>
            </section>
          )}
          {activeTab === 'ads' && (
            <section className="space-y-3" data-testid="affiliate-lightweight-content">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Ads & Tutorials</h2>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-emerald-900 dark:bg-[#092a20]">
                {([['advertisements','Advertisements'],['tutorials','Tutorials']] as const).map(([id,label])=>(
                  <button key={id} type="button" aria-pressed={contentTab===id} onClick={()=>setContentTab(id)}
                    className={`rounded-lg px-2 py-2.5 text-xs font-medium sm:text-sm ${contentTab===id?'bg-emerald-700 text-white':'text-slate-600 dark:text-emerald-100'}`}>{label}</button>
                ))}
              </div>
              {contentTab==='advertisements'
                ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {workspace!.campaigns.filter(c=>c.content_type !== 'tutorial' && !(!c.content_type && /(tutorial|training|guide)/i.test(c.title+' '+c.campaign_name))).map(renderCampaign)}
                    {workspace!.campaigns.filter(c=>c.content_type !== 'tutorial' && !(!c.content_type && /(tutorial|training|guide)/i.test(c.title+' '+c.campaign_name))).length===0&&<div className="col-span-full flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-12 dark:border-emerald-900 dark:bg-[#092a20]">
                      <Film className="h-8 w-8 text-emerald-700/55"/>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">No advertisements assigned</p>
                      <p className="text-xs text-slate-500 dark:text-emerald-100/60">Images, videos and campaign text will appear here.</p>
                    </div>}
                  </div>
                : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {workspace!.campaigns.filter(c=>c.content_type === 'tutorial' || (!c.content_type && /(tutorial|training|guide)/i.test(c.title+' '+c.campaign_name))).map(renderCampaign)}
                    {!workspace!.campaigns.some(c=>c.content_type === 'tutorial' || (!c.content_type && /(tutorial|training|guide)/i.test(c.title+' '+c.campaign_name)))&&
                      <div className="col-span-full rounded-xl border border-slate-200 bg-white px-4 py-12 text-center dark:border-emerald-900 dark:bg-[#092a20]">
                        <Film className="mx-auto mb-3 h-8 w-8 text-emerald-700/55"/>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">No tutorials assigned</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/60">Training material will appear here when available. Videos do not autoplay.</p>
                      </div>}
                  </div>}
            </section>
          )}
          {activeTab === 'meetings' && (
            <section className="space-y-3" data-testid="affiliate-lightweight-meetings">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Meetings</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-emerald-900 dark:bg-[#092a20]">
                {workspace!.meetings.map(meeting=><MeetingRow key={meeting.id} meeting={meeting} onJoin={()=>handleTrackedLink('meeting_join','meeting',meeting.id,meeting.meeting_url)}/>)}
                {workspace!.meetings.length===0&&<div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <CalendarClock className="h-8 w-8 text-emerald-700/55"/>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">No upcoming meetings</p>
                  <p className="text-xs text-slate-500 dark:text-emerald-100/60">Meeting dates and joining links will appear here when scheduled.</p>
                </div>}
              </div>
            </section>
          )}
          {activeTab === 'reports' && (() => {
            const subscribers = monthlySubscribers;
            const rewards = (workspace?.rewards || []).filter(r => String(r.created_at || '').slice(0,7) === reportMonth && r.status !== 'void');
            const payouts = (workspace?.payouts || []).filter(p => String(p.requested_at || '').slice(0,7) === reportMonth);
            const tasks = (workspace?.tasks || []).filter(t => (t.created_at || '').slice(0,7) === reportMonth || (t.due_at || '').slice(0,7) === reportMonth);
            const paidSubscribers = subscribers.filter(s => isSettledPaymentStatus(s.payment_status)).length;
            const trials = subscribers.filter(s => /trial/i.test(s.package_name || '') && !isSettledPaymentStatus(s.payment_status)).length;
            const awaiting = tasks.filter(t => t.status === 'completed').length;
            const approved = tasks.filter(t => t.status === 'reviewed').length;
            const pending = tasks.filter(t => t.status === 'new' || t.status === 'pending').length;
            const bonus = rewards.filter(r => r.reward_type === 'registration_bonus').reduce((v,r)=>v+Number(r.net_amount||0),0);
            const commission = rewards.filter(r => r.reward_type === 'subscription_commission').reduce((v,r)=>v+Number(r.net_amount||0),0);
            const pendingPayout = payouts.filter(p=>p.status==='requested'||p.status==='processing').reduce((v,p)=>v+Number(p.amount||0),0);
            const paidPayout = payouts.filter(p=>p.status==='paid').reduce((v,p)=>v+Number(p.amount||0),0);
            // Six compact history bars, calculated from the rows already in memory.
            // No extra API, polling, timers or chart dependency.
            const [selectedYear,selectedMonth] = reportMonth.split('-').map(Number);
            const historyMonths = Array.from({length:6},(_,index)=>{
              const date = new Date(selectedYear,selectedMonth - 1 - (5-index),1);
              return {key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,label:date.toLocaleDateString('en-TZ',{month:'short'})};
            });
            const subscriberHistory = new Map<string,number>();
            for (const subscriber of workspace?.subscribers || []) {
              const key = String(subscriber.created_at||'').slice(0,7);
              subscriberHistory.set(key,(subscriberHistory.get(key)||0)+1);
            }
            const earningsHistory = new Map<string,number>();
            for (const reward of workspace?.rewards || []) {
              if (reward.status==='void') continue;
              const key = String(reward.created_at||'').slice(0,7);
              earningsHistory.set(key,(earningsHistory.get(key)||0)+Number(reward.net_amount||0));
            }
            const history = historyMonths.map(month=>({...month,value:reportTab==='subscribers'?(subscriberHistory.get(month.key)||0):(earningsHistory.get(month.key)||0)}));
            const historyMax = Math.max(1,...history.map(month=>month.value));
            const reportCards = reportTab === 'subscribers'
              ? [['New Subscribers',subscribers.length],['Paid',paidSubscribers],['Free Trial',trials],['Other',subscribers.length-paidSubscribers-trials]]
              : reportTab === 'payments'
                ? [['Referral Bonus',currency.format(bonus)],['Commission (10%)',currency.format(commission)],['Pending Withdrawal',currency.format(pendingPayout)],['Paid Out',currency.format(paidPayout)]]
                : [['Assigned',tasks.length],['Approved',approved],['Awaiting Review',awaiting],['Pending',pending]];
            const planCounts = ['Free Trial','Ruby','Diamond','Tanzanite'].map(plan => ({
              plan,count:subscribers.filter(s=>String(s.package_name||'').toLowerCase().includes(plan.toLowerCase().replace('free ',''))).length,
            }));
            const exportRows: (string|number)[][] = reportTab === 'subscribers'
              ? [['Business','Location','Package','Status','Amount Paid','Last Activity'],...subscribers.map(s=>[s.customer_name,s.region||s.location||'',s.package_name,s.payment_status,Number(s.amount_paid||0),s.last_activity_at||'Not recorded'])]
              : reportTab === 'payments'
                ? [['Request Date','Amount','Net Amount','Status','Reference','Rejection Reason'],...payouts.map(p=>[p.requested_at,Number(p.amount||0),Number(p.net_payout||0),p.status,p.payout_reference||'',p.status==='rejected'?p.notes||'':''])]
                : [['Task','Assigned Date','Due Date','Status'],...tasks.map(t=>[t.title,t.created_at,t.due_at||'',t.status==='completed'?'Awaiting Review':t.status==='reviewed'?'Approved':t.status])];
            return <section className="space-y-4 sm:space-y-5" data-testid="affiliate-lightweight-reports">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Reports</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="month" aria-label="Report month" value={reportMonth} onChange={e=>setReportMonth(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-emerald-900 dark:bg-[#092c21] dark:text-white"/>
                  <button type="button" onClick={()=>downloadExcelFileFromRows(`orvix-${reportTab}-${reportMonth}.xlsx`,[{name: 'Report',aoa: exportRows}])}
                    className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-[#092c21] dark:text-emerald-100">Export Excel</button>
                  <button type="button" onClick={()=>window.print()}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-emerald-900 dark:bg-[#092c21] dark:text-white">Print / PDF</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-emerald-900 dark:bg-[#092c21]" role="tablist" aria-label="Report type">
                {([['subscribers','Subscribers'],['payments','Payments'],['tasks','Tasks']] as const).map(([key,label])=>(
                  <button key={key} role="tab" aria-selected={reportTab===key} onClick={()=>setReportTab(key)}
                    className={`min-w-0 rounded-lg px-2 py-2.5 text-xs font-medium sm:text-sm ${reportTab===key?'bg-emerald-700 text-white':'text-slate-600 hover:bg-slate-50 dark:text-emerald-100 dark:hover:bg-emerald-900/40'}`}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {reportCards.map(([label,value])=><div key={String(label)} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_5px_18px_-11px_rgba(6,78,59,0.2)] dark:border-emerald-900 dark:bg-[#092c21]">
                  <p className="text-[11px] text-slate-500 dark:text-emerald-100/70">{label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950 dark:text-white sm:text-xl">{value}</p>
                </div>)}
              </div>
              {(reportTab==='subscribers'||reportTab==='payments') && <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-emerald-900 dark:bg-[#092c21]" aria-label={reportTab==='subscribers'?'Subscriber growth':'Monthly earnings'}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{reportTab==='subscribers'?'Subscriber Growth':'Monthly Earnings'}</h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-emerald-100/70">Last six months · from existing records</p>
                <div className="mt-4 grid grid-cols-6 items-end gap-2 sm:gap-3">
                  {history.map(month=><div key={month.key} className="flex min-w-0 flex-col items-center justify-end gap-1.5">
                    <span className="truncate text-[10px] tabular-nums text-slate-600 dark:text-emerald-100/80">{reportTab==='subscribers'?month.value:month.value?Math.round(month.value/1000)+'k':'0'}</span>
                    <div className="flex h-20 w-full max-w-10 items-end overflow-hidden rounded-md bg-emerald-50 dark:bg-emerald-950/60" title={`${month.key}: ${reportTab==='subscribers'?month.value:currency.format(month.value)}`}>
                      <div className="w-full rounded-t-md bg-emerald-700" style={{height:`${Math.max(2,Math.round(month.value/historyMax*100))}%`}}/>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-emerald-100/60">{month.label}</span>
                  </div>)}
                </div>
                {reportTab==='payments' && <p className="mt-2 text-[10px] text-slate-500 dark:text-emerald-100/60">Values shown in thousands of TZS (k).</p>}
              </section>}
              {reportTab==='subscribers' && <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-emerald-900 dark:bg-[#092c21]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Subscribers by Plan</h3>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-emerald-100/70">New registrations in the selected month</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {planCounts.map(row=><div key={row.plan} className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-emerald-950/50">
                      <p className="text-[11px] text-slate-500 dark:text-emerald-100/70">{row.plan}</p><p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{row.count}</p>
                    </div>)}
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-emerald-900 dark:bg-[#092c21]">
                  <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-emerald-900 dark:text-white">Subscriber Details</h3>
                  {subscribers.length===0?<p className="p-4 text-xs text-slate-500">No new subscribers in this month.</p>:subscribers.map(s=><div key={s.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-0 dark:border-emerald-900/50">
                    <div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-white">{s.customer_name}</p>
                      <p className="mt-1 truncate text-slate-500 dark:text-emerald-100/60">{s.package_name} · {s.region||s.location||'Location not provided'}</p></div>
                    <div className="shrink-0 text-right"><p className="font-medium text-slate-900 dark:text-white">{currency.format(Number(s.amount_paid||0))}</p><p className="mt-1 text-slate-500 dark:text-emerald-100/60">{s.payment_status}</p></div>
                  </div>)}
                </div>
              </div>}
              {reportTab==='payments' && <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-emerald-900 dark:bg-[#092c21]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Earnings Breakdown</h3>
                  <p className="mt-2 text-xs text-slate-500 dark:text-emerald-100/70">Referral bonuses and eligible subscription commissions; excludes void rewards.</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-emerald-900 dark:bg-[#092c21]">
                  <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-emerald-900 dark:text-white">Withdrawal History</h3>
                  {payouts.length===0?<p className="p-4 text-xs text-slate-500">No withdrawal requests in this month.</p>:payouts.map(p=><div key={p.id} className="border-b border-slate-100 px-4 py-3 text-xs last:border-0 dark:border-emerald-900/40">
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500 dark:text-emerald-100/70">{new Date(p.requested_at).toLocaleDateString('en-TZ')}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{currency.format(Number(p.amount||0))}</span>
                      <span className="capitalize text-emerald-700 dark:text-emerald-300">{p.status}</span></div>
                    {p.status==='paid' && <p className="mt-2 text-slate-500 dark:text-emerald-100/70">Reference: {p.payout_reference||'Not recorded'}</p>}
                    {p.status==='rejected' && <p className="mt-2 text-slate-500 dark:text-emerald-100/70">Reason: {p.notes||'Not recorded'}</p>}
                  </div>)}
                </div>
              </div>}
              {reportTab==='tasks' && <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-emerald-900 dark:bg-[#092c21]">
                  <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Approved Completion</h3>
                    <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{tasks.length?Math.round(approved/tasks.length*100):0}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-950">
                    <div className="h-full rounded-full bg-emerald-700" style={{width:`${tasks.length?approved/tasks.length*100:0}%`}}/>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-emerald-100/70">Submitted tasks require Agent approval. No background monitoring.</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-emerald-900 dark:bg-[#092c21]">
                  <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-emerald-900 dark:text-white">Task Details</h3>
                  {tasks.length===0?<p className="p-4 text-xs text-slate-500">No tasks in this month.</p>:tasks.map(t=><div key={t.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-0 dark:border-emerald-900/40">
                    <div className="min-w-0"><p className="font-semibold text-slate-900 dark:text-white">{t.title}</p><p className="mt-1 text-slate-500 dark:text-emerald-100/70">{t.due_at?`Due ${new Date(t.due_at).toLocaleDateString('en-TZ')}`:'No deadline'}</p></div>
                    <span className="shrink-0 text-emerald-700 dark:text-emerald-300">{t.status==='completed'?'Awaiting Review':t.status==='reviewed'?'Approved':'Pending'}</span>
                  </div>)}
                </div>
              </div>}
            </section>;
          })()}
          {activeTab === 'payouts' && (
            <section className="space-y-4 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payment Status</h2>
                <input type="month" aria-label="Select payout month"
                  value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                  className="max-w-[172px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-emerald-500 dark:border-emerald-900 dark:bg-[#092c21] dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-100 bg-white p-3.5 shadow-[0_5px_18px_-10px_rgba(5,77,54,0.28)] dark:border-emerald-900 dark:bg-[#092c21] sm:p-4">
                  <p className="text-[11px] text-slate-500 dark:text-emerald-100/65">Referral Bonus</p>
                  <p className="mt-2 text-base font-semibold tabular-nums text-slate-950 dark:text-white sm:text-xl">{currency.format(earnedByType.bonus)}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white p-3.5 shadow-[0_5px_18px_-10px_rgba(5,77,54,0.28)] dark:border-emerald-900 dark:bg-[#092c21] sm:p-4">
                  <p className="text-[11px] text-slate-500 dark:text-emerald-100/65">Commission (10%)</p>
                  <p className="mt-2 text-base font-semibold tabular-nums text-slate-950 dark:text-white sm:text-xl">{currency.format(earnedByType.commission)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-[0_4px_16px_-9px_rgba(5,77,54,0.25)] dark:border-emerald-900 dark:bg-[#092c21]">
                <span className="text-xs font-medium text-slate-600 dark:text-emerald-100/75">Available Balance</span>
                <span className="text-lg font-semibold tabular-nums text-emerald-800 dark:text-emerald-300" data-testid="affiliate-available-balance">{currency.format(metrics.available)}</span>
              </div>

              <button type="button" onClick={() => {
                if (mirrorMode) return;
                setWithdrawForm({
                  name: workspace?.profile?.display_name || '',
                  phone: workspace?.profile?.phone_whatsapp || '',
                  amount: String(Math.round(metrics.available)),
                  password: '',
                });
                setWithdrawError(null);
                setShowWithdrawModal(true);
              }} disabled={mirrorMode}
                className="flex w-full items-center gap-3 rounded-xl border border-emerald-500 bg-emerald-700 px-4 py-4 text-left text-white shadow-[0_10px_22px_-10px_rgba(4,120,87,0.7)] transition-colors hover:bg-emerald-800 disabled:opacity-60 dark:border-emerald-600 dark:bg-emerald-700">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"><Wallet className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Request Funds</span>
                  <span className="mt-0.5 block text-[11px] text-emerald-50/85">
                    {metrics.available < AFFILIATE_MIN_WITHDRAWAL_TZS
                      ? 'Minimum balance TZS 10,000'
                      : hasMonthWithdrawal ? 'Monthly request already submitted'
                      : !payoutWindow.isLastFriday ? `Next payout day: ${payoutWindow.dateISO}`
                      : 'Request your full available balance'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
              </button>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_5px_18px_-10px_rgba(5,77,54,0.2)] dark:border-emerald-900 dark:bg-[#092c21] sm:p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">Withdrawal Summary</h3>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['Pending', (workspace?.payouts || []).filter(p => p.status === 'requested' || p.status === 'processing')],
                    ['Paid', (workspace?.payouts || []).filter(p => p.status === 'paid')],
                    ['Rejected', (workspace?.payouts || []).filter(p => p.status === 'rejected' || p.status === 'cancelled')],
                  ] as const).map(([label, items]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-slate-50 px-1.5 py-3 text-center dark:bg-emerald-950/60 sm:px-2">
                      <p className="text-[10px] text-slate-500 dark:text-emerald-100/70">{label}</p>
                      <p className="mt-1 break-words text-[11px] font-semibold tabular-nums text-slate-950 dark:text-white sm:text-sm">
                        {currency.format(items.reduce((sum, item) => sum + Number(item.amount || 0), 0))}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-emerald-100/60">{items.length} requests</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_5px_18px_-10px_rgba(5,77,54,0.2)] dark:border-emerald-900 dark:bg-[#092c21]">
                <div className="px-3.5 pt-3.5 pb-2 sm:px-4">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Withdrawal History</h3>
                  <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter withdrawal history">
                    {([
                      ['all', 'All'],
                      ['pending', 'Pending'],
                      ['paid', 'Paid'],
                      ['rejected', 'Rejected'],
                    ] as const).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setPayoutFilter(key)}
                        aria-pressed={payoutFilter === key}
                        className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                          payoutFilter === key
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const filtered = (workspace?.payouts || []).filter(payout => {
                    if (reportMonth && payout.requested_at?.slice(0, 7) !== reportMonth) return false;
                    if (payoutFilter === 'all') return true;
                    if (payoutFilter === 'pending') return payout.status === 'requested' || payout.status === 'processing';
                    if (payoutFilter === 'rejected') return payout.status === 'rejected' || payout.status === 'cancelled';
                    return payout.status === 'paid';
                  });
                  if (!filtered.length) return <p className="px-4 py-7 text-center text-xs text-slate-500 dark:text-emerald-100/70">No {payoutFilter === 'all' ? '' : payoutFilter + ' '}withdrawal requests.</p>;
                  return <div className="divide-y divide-slate-100 dark:divide-emerald-900/50">
                    {filtered.map(payout => (
                      <details key={payout.id} className="group px-3.5 py-3 sm:px-4">
                        <summary className="flex cursor-pointer list-none items-center gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold tabular-nums text-slate-950 dark:text-white">{currency.format(payout.amount)}</span>
                            <span className="mt-1 block text-[10px] text-slate-500 dark:text-emerald-100/65">{formatDateTime(payout.requested_at)}</span>
                          </span>
                          <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${
                            payout.status === 'paid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100'
                            : payout.status === 'rejected' || payout.status === 'cancelled' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
                          }`}>{payout.status === 'requested' || payout.status === 'processing' ? 'Pending' : payout.status === 'paid' ? 'Paid' : 'Rejected'}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                        </summary>
                        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-emerald-900/50">
                          <div><dt className="text-slate-500 dark:text-emerald-100/65">Method</dt><dd className="mt-1 text-slate-900 dark:text-white">{payout.payout_method || 'Mobile Money'}</dd></div>
                          <div><dt className="text-slate-500 dark:text-emerald-100/65">Net payout</dt><dd className="mt-1 text-slate-900 dark:text-white">{currency.format(payout.net_payout ?? payout.amount)}</dd></div>
                          {payout.payout_reference && <div className="col-span-2"><dt className="text-slate-500 dark:text-emerald-100/65">Reference</dt><dd className="mt-1 break-all text-slate-900 dark:text-white">{payout.payout_reference}</dd></div>}
                          {(payout.status === 'rejected' || payout.status === 'cancelled') && (
                            <div className="col-span-2"><dt className="text-rose-600">Reason for rejection</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-800 dark:text-rose-100">{payout.notes?.trim() || 'Please contact support for the rejection reason.'}</dd></div>
                          )}
                        </dl>
                      </details>
                    ))}
                  </div>;
                })()}
              </section>

              {/* Compact, full-balance withdrawal review. The saved registration
                  number is read-only: affiliates cannot substitute a payout recipient. */}
              {showWithdrawModal && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
                  onClick={e => { if (e.target === e.currentTarget && !withdrawing) setShowWithdrawModal(false); }}>
                  <div role="dialog" aria-modal="true" aria-labelledby="withdraw-title" className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-[#09251d] sm:rounded-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-emerald-900">
                      <h3 id="withdraw-title" className="text-base font-semibold text-slate-900 dark:text-white">Request Funds</h3>
                      <button type="button" onClick={() => setShowWithdrawModal(false)} aria-label="Close request"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-emerald-100 dark:hover:bg-emerald-900/40">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-3.5 px-4 py-4">
                      {!canWithdraw && (
                        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                          {metrics.available < AFFILIATE_MIN_WITHDRAWAL_TZS
                            ? 'Minimum balance: TZS 10,000.'
                            : hasMonthWithdrawal ? 'Already requested this month.'
                            : !isAgentApprovedForWithdrawals ? 'Account approval required.'
                            : `Next request date: ${payoutWindow.dateISO}.`}
                        </p>
                      )}

                      <div className="space-y-1">
                        <label htmlFor="affiliate-registered-phone" className="block text-[11px] font-medium text-slate-500 dark:text-emerald-100/70">Registered phone</label>
                        <input id="affiliate-registered-phone" type="tel" readOnly aria-readonly="true"
                          value={workspace?.profile?.phone_whatsapp || ''} placeholder="No registered phone"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white" />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-emerald-800 dark:bg-emerald-950">
                        <span className="text-xs text-slate-500 dark:text-emerald-100/75">Request amount</span>
                        <strong className="text-base tabular-nums text-slate-900 dark:text-white">{currency.format(metrics.available)}</strong>
                      </div>
                      <div className="space-y-1 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-900/25">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-800 dark:text-emerald-100">
                          <span>Transfer fee (estimate)</span><span>{currency.format(transferFee)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                          <span>Estimated payout</span><span>{currency.format(Math.max(0, metrics.available - transferFee))}</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-200">Fee is deducted from your payout. Final fee is verified on submission.</p>
                      </div>
                      {!workspace?.profile?.phone_whatsapp?.trim() && (
                        <p role="alert" className="text-xs text-rose-700 dark:text-rose-200">Add a registered phone number to your affiliate profile first.</p>
                      )}
                      {withdrawError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">{withdrawError}</p>}
                      <button type="button" onClick={handleWithdrawSubmit}
                        disabled={withdrawing || !canWithdraw || mirrorMode || !workspace?.profile?.phone_whatsapp?.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                        {withdrawing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        {withdrawing ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
          {activeTab === 'settings' && (
            <section className="max-w-3xl space-y-5">
              <div>
                <h2 className="text-xl font-black text-slate-950">Profile Settings</h2>
                <p className="mt-0.5 text-sm text-slate-500">Update your affiliate profile, payout details, and workspace preferences.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    Display name
                    <input value={profileDraft.displayName} onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    Payout method
                    <input value={profileDraft.payoutMethod} onChange={(event) => setProfileDraft({ ...profileDraft, payoutMethod: event.target.value })} placeholder="M-Pesa, Airtel Money..." className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                  </label>
                  {([
                    ['country','Country','Tanzania'],
                    ['region','Region','Dar es Salaam'],
                    ['district','District','Kinondoni'],
                    ['location','Area / Ward','Tegeta'],
                  ] as const).map(([key,label,placeholder])=>(
                    <label key={key} className="min-w-0 space-y-1 text-sm font-semibold text-slate-700">
                      {label}
                      <input required maxLength={key==='location'?160:100} value={profileDraft[key]}
                        onChange={event=>setProfileDraft({...profileDraft,[key]:event.target.value})}
                        placeholder={placeholder}
                        className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                    </label>
                  ))}
                  <label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">
                    Payout account / phone
                    <input value={profileDraft.payoutAccount} onChange={(event) => setProfileDraft({ ...profileDraft, payoutAccount: event.target.value })} placeholder="+255..." className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                  </label>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
                    Email updates
                    <input type="checkbox" checked={profilePrefs.emailUpdates} onChange={(event) => setProfilePrefs({ ...profilePrefs, emailUpdates: event.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
                    Compact dashboard
                    <input type="checkbox" checked={profilePrefs.compactView} onChange={(event) => setProfilePrefs({ ...profilePrefs, compactView: event.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  </label>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={saveAffiliateSettings} className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500">Save Settings</button>

                </div>
              </div>
            </section>
          )}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-emerald-900 dark:bg-[#08271d] lg:hidden">
        {mobilePrimaryNav.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => { setActiveTab(id); setMobileMoreOpen(false); }} className={`grid min-h-16 place-items-center gap-1 text-[10px] font-bold ${activeTab === id ? 'text-emerald-700' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{label}</button>)}
        <button type="button" onClick={() => setMobileMoreOpen(true)} className={`grid min-h-16 place-items-center gap-1 text-[10px] font-bold ${mobileMoreOpen || mobileMoreNav.some(([id]) => id === activeTab) ? 'text-emerald-700' : 'text-slate-500'}`}><Menu className="h-5 w-5" />More</button>
      </nav>
      {mobileMoreOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setMobileMoreOpen(false)}>
          <section className="absolute inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mobile-more-features-grid gap-3">
              {mobileMoreNav.map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => { setActiveTab(id); setMobileMoreOpen(false); }} className={`grid gap-1 rounded-xl border px-2 py-3 text-center text-[11px] font-bold ${activeTab === id ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-600'}`}>
                  <Icon className="mx-auto h-5 w-5" />{label}
                </button>
              ))}
              <button type="button" onClick={() => { setMobileMoreOpen(false); onLogout(); }} className="grid gap-1 rounded-xl border border-rose-100 px-2 py-3 text-center text-[11px] font-bold text-rose-600">
                <LogOut className="mx-auto h-5 w-5" />{mirrorMode ? 'Back' : 'Sign out'}
              </button>
            </div>
          </section>
        </div>
      )}


    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-black tracking-tight text-slate-950">{value}</p>{sub && <p className="mt-1 text-[11px] font-semibold text-slate-400">{sub}</p>}</div>;
}

function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-4"><h2 className="font-black text-slate-950">{title}</h2>{action && <button type="button" onClick={onAction} className="text-sm font-bold text-emerald-700">{action}</button>}</div><div className="divide-y divide-slate-100">{children}</div></section>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}

function TaskRow({ task, busy, readOnly = false, onComplete, onDownload }: { key?: unknown; task: any; busy: boolean; readOnly?: boolean; onComplete: (id: string) => void; onDownload: () => void }) {
  return <article className="p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{task.task_type} · {task.status === 'completed' ? 'Awaiting Review' : task.status === 'reviewed' ? 'Approved' : task.status}</p><h3 className="mt-1 text-sm font-bold text-slate-950">{task.title}</h3>{task.body && <p className="mt-1 text-sm leading-5 text-slate-600">{task.body}</p>}<p className="mt-2 text-xs text-slate-400">{task.sender_name ? `From ${task.sender_name}` : 'From assigned agent'}{task.due_at ? ` · Due ${formatDateTime(task.due_at)}` : ''}</p></div><ClipboardList className="h-5 w-5 shrink-0 text-slate-400" /></div><div className="mt-3 flex flex-wrap gap-2">{task.attachment_url ? <button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> {task.attachment_name || 'Download file'}</button> : null}{!readOnly && !['completed', 'reviewed'].includes(task.status) ? <button type="button" disabled={busy} onClick={() => onComplete(task.id)} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> {busy ? 'Updating' : 'Mark as Done'}</button> : null}</div></article>;
}

function NotificationRow({ notification, onMarkRead }: { key?: unknown; notification: AffiliateNotification; onMarkRead: (id: string) => void }) {
  const priorityColor = notification.priority === 'critical' || notification.priority === 'high'
    ? 'text-rose-600'
    : 'text-emerald-700';
  return (
    <article className={`flex items-start gap-3 p-4 ${!notification.read_at ? 'bg-emerald-50/40' : ''}`} onClick={() => !notification.read_at && onMarkRead(notification.id)}>
      <Bell className={`h-4 w-4 shrink-0 ${priorityColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-950">{notification.title}</h3>
          {!notification.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />}
        </div>
        <p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p>
        <p className="mt-2 text-xs text-slate-400">{formatDateTime(notification.created_at)}</p>
      </div>
    </article>
  );
}

function MeetingRow({ meeting, onJoin }: { key?: unknown; meeting: any; onJoin: () => void }) {
  const start = new Date(meeting.starts_at).getTime();
  const validStart = Number.isFinite(start);
  const withinJoinWindow = validStart && Date.now() >= start - 30*60*1000;
  const joinEnabled = ['upcoming','live'].includes(meeting.status) && withinJoinWindow && !!meeting.meeting_url;
  return <article className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 last:border-0 dark:border-emerald-900/40 sm:flex-row sm:items-center">
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-200">{meeting.status}</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{meeting.title}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/65">{formatDateTime(meeting.starts_at)}{meeting.host_name ? ` · ${meeting.host_name}` : ''}</p>
      {meeting.notes && <p className="mt-2 text-xs text-slate-600 dark:text-emerald-100/70">{meeting.notes}</p>}
    </div>
    {['upcoming','live'].includes(meeting.status) && (joinEnabled
      ? <button type="button" onClick={onJoin} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white"><PlayCircle className="h-4 w-4"/> Join Meeting</button>
      : <span className="shrink-0 text-[11px] text-slate-500 dark:text-emerald-100/60">Link available near meeting time</span>)}
  </article>;
}

