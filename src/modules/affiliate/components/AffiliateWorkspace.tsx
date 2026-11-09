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
import { canShowDashboardAd, useGlobalAdSettings } from '../../../shared/utils/adPlacement';
import { sanitizeTrustedHtml } from '../../../shared/utils/safeHtml';
import { isSettledPaymentStatus } from '../../../shared/utils/financialStatus';
import GlobalStickyAd from '../../../shared/components/GlobalStickyAd';
import { formatLocalMonth } from '../../../shared/utils/localDate';
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
  const [profileDraft, setProfileDraft] = useState({ displayName: '', payoutMethod: '', payoutAccount: '' });
  const [profilePrefs, setProfilePrefs] = useState({ emailUpdates: true, compactView: false });
  const [reportMonth, setReportMonth] = useState(formatLocalMonth());
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('all');
  const [withdrawForm, setWithdrawForm] = useState({ name: '', phone: '', amount: '', password: '' });
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  // Tenants tab state
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<string>('all');
  const [tenantPlanFilter, setTenantPlanFilter] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const payoutWindow = getTanzaniaMonthEndWithdrawalDate();
  const transferFee = getAzamPayFee(workspace?.profile?.payout_method);
  const adSettings = useGlobalAdSettings();

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
    let cloudAffiliateCodes: any[] = [];
    try {
      const { getSecureDataBridgeClient } = await import('../../../shared/dataBridge/secureDataBridge');
      const client: any = await getSecureDataBridgeClient();
      const { data, error } = await client.from('affiliates').select('id, promo_code, referral_code');
      if (error) throw error;
      cloudAffiliateCodes = Array.isArray(data) ? data : [];
    } catch (error: any) {
      setCodeError(error?.message || ONLINE_ONLY_WRITE_MESSAGE);
      return;
    }

    const taken = cloudAffiliateCodes.some((a: any) => (
      String(a.promo_code || a.referral_code || '').toUpperCase() === cleaned &&
      a.id !== workspace.profile.id
    ));
    if (taken) {
      const sugg: string[] = [];
      for (const sfx of ['1','2','3','_TZ','_EA','_PRO']) {
        const s = `${cleaned}${sfx}`;
        if (!cloudAffiliateCodes.some((a: any) => String(a.promo_code || a.referral_code || '').toUpperCase() === s)) { sugg.push(s); if (sugg.length >= 3) break; }
      }
      setCodeError(`"${cleaned}" is already taken.`);
      setSuggestions(sugg);
      return;
    }
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
    setNotice(`✅ Promo code updated to ${cleaned}`);
    setEditingCode(false);
    setCodeError('');
    setSuggestions([]);
    refresh(); // background refresh — savedCode already showing correct value
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

  const monthStats = useMemo(() => {
    const monthlyRewards = (workspace?.rewards || []).filter(reward => reward.created_at.slice(0,7) === reportMonth);
    const registrationBonuses = monthlyRewards.filter(reward => reward.reward_type === 'registration_bonus');
    const paidCommissions = monthlyRewards.filter(reward => reward.reward_type === 'subscription_commission');
    const revenue = paidCommissions.reduce((sum, reward) => sum + Number(reward.source_revenue || 0), 0);
    const grossCommission = paidCommissions.reduce((sum, reward) => sum + Number(reward.gross_amount || 0), 0);
    const withholding = monthlyRewards.reduce((sum, reward) => sum + Number(reward.withholding_tax || 0), 0);
    const bonus = registrationBonuses.reduce((sum, reward) => sum + Number(reward.gross_amount || 0), 0);
    const payout = monthlyRewards.reduce((sum, reward) => sum + Number(reward.net_amount || 0), 0);
    return {
      registrations: monthlySubscribers.length,
      active: monthlySubscribers.filter((subscriber) => subscriber.status === 'active').length,
      inactive: monthlySubscribers.filter((subscriber) => subscriber.status !== 'active').length,
      revenue, grossCommission, withholding, bonus, payout,
    };
  }, [monthlySubscribers, workspace?.rewards, reportMonth]);

  const taskProgress = useMemo(() => {
    const tasks = workspace?.tasks || [];
    const total = tasks.length;
    const completed = tasks.filter((task) => ['completed', 'reviewed'].includes(task.status)).length;
    const pending = total - completed;
    const overdue = tasks.filter((task) => task.due_at && !['completed', 'reviewed'].includes(task.status) && new Date(task.due_at).getTime() < Date.now()).length;
    const monthTasks = tasks.filter((task) => (task.created_at || '').slice(0, 7) === reportMonth || (task.due_at || '').slice(0, 7) === reportMonth);
    const monthCompleted = monthTasks.filter((task) => ['completed', 'reviewed'].includes(task.status)).length;
    return {
      total,
      completed,
      pending,
      overdue,
      progress: total ? Math.round((completed / total) * 100) : 0,
      monthTotal: monthTasks.length,
      monthCompleted,
      monthProgress: monthTasks.length ? Math.round((monthCompleted / monthTasks.length) * 100) : 0,
    };
  }, [workspace?.tasks, reportMonth]);

  const taskGoalCards = useMemo(() => {
    const subscribers = workspace?.subscribers || [];
    const totalRegistrations = subscribers.length;
    const currentMonthRegistrations = subscribers.filter((subscriber) => (subscriber.created_at || '').slice(0, 7) === reportMonth).length;
    return (workspace?.tasks || [])
      .map((task: any) => {
        const content = `${task.title || ''} ${task.body || ''}`.toLowerCase();
        const explicitTarget = Number(task.target_count || task.targetCount || task.goal_count || task.goalCount || task.metadata?.target_count || 0);
        const parsedTarget = explicitTarget || Number(content.match(/(?:target|goal|fikisha|fikia|reach|pata|sajili)\s*(\d+)/)?.[1] || 0);
        if (!parsedTarget) return null;
        const isMonthly = content.includes('month') || content.includes('mwezi') || content.includes(reportMonth);
        const progressValue = Number(task.progress_count || task.progressCount || task.metadata?.progress_count || (isMonthly ? currentMonthRegistrations : totalRegistrations));
        const progress = Math.min(100, Math.round((progressValue / parsedTarget) * 100));
        return {
          id: task.id,
          title: task.title,
          target: parsedTarget,
          progressValue,
          progress,
          dueAt: task.due_at,
          status: task.status,
          scope: isMonthly ? 'This month' : 'All time',
        };
      })
      .filter(Boolean) as Array<{ id: string; title: string; target: number; progressValue: number; progress: number; dueAt?: string | null; status: string; scope: string }>;
  }, [workspace?.tasks, workspace?.subscribers, reportMonth]);

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
    const prefsKey = `jasper_affiliate_preferences_${workspace.profile.id}`;
    const result = await dbWrite(
      'affiliates',
      'update',
      { display_name: displayName, payout_method: payoutMethod, payout_account: payoutAccount },
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
    ['tasks', 'Messages & Tasks', ClipboardList],
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
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Ads by JB</p>
          <h3 className="mt-1 text-sm font-bold text-slate-950">{campaign.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{campaign.campaign_name}</p>
        </div>
        <Film className="w-5 h-5 text-slate-400 shrink-0" />
      </div>
      {campaign.description && <p className="mt-3 text-sm leading-5 text-slate-600">{campaign.description}</p>}
      {campaign.recommended_caption && <p className="mt-3 rounded-md border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">{campaign.recommended_caption}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        {campaign.duration_seconds ? <span>{Math.ceil(campaign.duration_seconds / 60)} min video</span> : null}
        {formatBytes(campaign.media_size_bytes) ? <span>{formatBytes(campaign.media_size_bytes)}</span> : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => handleTrackedLink('ad_download', 'campaign', campaign.id, campaign.media_url, campaign.media_name)} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white"><Download className="w-3.5 h-3.5" /> Download</button>
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
            {canShowDashboardAd(adSettings) && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-emerald-900 dark:bg-[#092c21]">
                <div className="mx-auto w-full max-w-[728px] overflow-hidden [&>*]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: sanitizeTrustedHtml(adSettings.dashboardAdCode) }} />
              </div>
            )}
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
              {workspace!.campaigns.some(c => c.status === 'active') ? (
                <div className="grid gap-2.5 p-3 sm:grid-cols-2">
                  {workspace!.campaigns.filter(c => c.status === 'active').slice(0,2).map(c => (
                    <button key={c.id} type="button" onClick={() => setActiveTab('ads')}
                      className="flex min-w-0 items-center gap-2.5 rounded-lg bg-emerald-50 px-3 py-3 text-left dark:bg-emerald-950/70">
                      <Film className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-900 dark:text-white">{c.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : <p className="p-4 text-xs text-slate-500 dark:text-emerald-100/65">Campaigns will appear here.</p>}
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
                    Change this code carefully. A new code will affect referral tracking.
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
                    {!mirrorMode && <button type="button" onClick={() => { setEditingCode(true); setNewCode(getLiveCode(profile) || profile.referral_code); }}
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

          {activeTab === 'tasks' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{workspace!.tasks.map((task) => <TaskRow key={task.id} task={task} busy={busyTaskId === task.id} readOnly={mirrorMode} onComplete={handleTaskComplete} onDownload={() => task.attachment_url && handleTrackedLink('task_download', 'task', task.id, task.attachment_url, task.attachment_name)} />)}{workspace!.tasks.length === 0 && <Empty text="No tasks, notes, or files have been assigned to you yet." />}</section>}
          {activeTab === 'ads' && (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workspace!.campaigns.map(renderCampaign)}
              {workspace!.campaigns.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3"><Empty text="No Ads by JB campaigns are assigned to your account." /></div>
              )}
            </section>
          )}
          {activeTab === 'meetings' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{workspace!.meetings.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onJoin={() => handleTrackedLink('meeting_join', 'meeting', meeting.id, meeting.meeting_url)} />)}{workspace!.meetings.length === 0 && <Empty text="No agent meetings are scheduled for your account." />}</section>}
          {activeTab === 'reports' && (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Affiliate Reports</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Measure subscriber, payment, and task progress by month.</p>
                </div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Report month
                  <input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Metric label="Subscriber report" value={monthStats.registrations.toString()} sub={`${monthStats.active} active · ${monthStats.inactive} inactive`} />
                <Metric label="Payment report" value={currency.format(monthStats.revenue)} sub="Amount entered system" />
                <Metric label="Commission" value={currency.format(monthStats.grossCommission)} sub="10% of monthly payments" />
                <Metric label="Task report" value={`${taskProgress.monthProgress}%`} sub={`${taskProgress.monthCompleted}/${taskProgress.monthTotal} monthly tasks`} />
              </div>

              <Panel title="Subscriber report">
                {monthlySubscribers.length === 0 ? <Empty text="No subscribers found for the selected month." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Subscriber</th>
                          <th className="px-4 py-3">Region</th>
                          <th className="px-4 py-3">Package</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Paid</th>
                          <th className="px-4 py-3 text-right">Commission</th>
                          <th className="px-4 py-3 text-right">Days left</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {monthlySubscribers.map((subscriber) => {
                          const isPaidSubscriber = isSettledPaymentStatus(subscriber.payment_status);
                          const paidAmount = isPaidSubscriber ? subscriber.amount_paid : 0;
                          const commission = (workspace?.rewards || [])
                            .filter(reward => reward.reward_type === 'subscription_commission'
                              && reward.tenant_id === subscriber.tenant_id
                              && reward.created_at.startsWith(reportMonth))
                            .reduce((sum, reward) => sum + Number(reward.gross_amount || 0), 0);
                          return (
                            <tr key={subscriber.id}>
                              <td className="px-4 py-3">
                                <p className="font-black text-slate-950">{subscriber.customer_name}</p>
                                <p className="text-xs text-slate-500">{subscriber.phone_number || 'No phone'} · {subscriber.promo_code_used || subscriber.referral_code_used || profile.referral_code}</p>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{subscriber.region || subscriber.location || 'Not set'}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{subscriber.package_name}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${subscriber.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{subscriber.status}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold">{currency.format(paidAmount)}</td>
                              <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">{currency.format(commission)}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold">{subscriber.days_remaining}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Payment report">
                <div className="grid gap-3 p-4 sm:grid-cols-4">
                  <Metric label="Entered system" value={currency.format(monthStats.revenue)} />
                  <Metric label="Commission (10%)" value={currency.format(monthStats.grossCommission)} />
                  <Metric label="Withholding" value={currency.format(monthStats.withholding)} />
                  <Metric label="Jumla ya mapato" value={currency.format(monthStats.payout)} />
                </div>
              </Panel>

              <Panel title="Task report">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-slate-950">{taskProgress.monthCompleted}/{taskProgress.monthTotal} tasks completed in {reportMonth}</p>
                      <p className="mt-1 text-xs text-slate-500">All-time progress: {taskProgress.completed}/{taskProgress.total} tasks complete.</p>
                    </div>
                    <span className="text-2xl font-black text-emerald-700">{taskProgress.monthProgress}%</span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${taskProgress.monthProgress}%` }} />
                  </div>
                  {taskGoalCards.length > 0 && (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {taskGoalCards.map((goal) => (
                        <div key={goal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-950">{goal.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{goal.scope} target · {goal.status}</p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">{goal.progress}%</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>{goal.progressValue} done</span>
                            <span>Goal {goal.target}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${goal.progress}%` }} />
                          </div>
                          {goal.dueAt && <p className="mt-2 text-[11px] text-slate-400">Due {formatDateTime(goal.dueAt)}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            </section>
          )}
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
                  <button type="button" onClick={onLogout} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" /> Sign out</button>
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

      {!mirrorMode && (
        <GlobalStickyAd
          bottomOffsetClass="bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-4"
          leftOffsetClass="left-3 lg:left-1/2 lg:-translate-x-1/2"
          maxWidthClass="max-w-[640px]"
        />
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
  return <article className="p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{task.task_type} · {task.status}</p><h3 className="mt-1 text-sm font-bold text-slate-950">{task.title}</h3>{task.body && <p className="mt-1 text-sm leading-5 text-slate-600">{task.body}</p>}<p className="mt-2 text-xs text-slate-400">{task.sender_name ? `From ${task.sender_name}` : 'From assigned agent'}{task.due_at ? ` · Due ${formatDateTime(task.due_at)}` : ''}</p></div><ClipboardList className="h-5 w-5 shrink-0 text-slate-400" /></div><div className="mt-3 flex flex-wrap gap-2">{task.attachment_url ? <button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> {task.attachment_name || 'Download file'}</button> : null}{!readOnly && !['completed', 'reviewed'].includes(task.status) ? <button type="button" disabled={busy} onClick={() => onComplete(task.id)} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> {busy ? 'Updating' : 'Mark complete'}</button> : null}</div></article>;
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
  return <article className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{meeting.status}</p><h3 className="mt-1 text-sm font-bold text-slate-950">{meeting.title}</h3><p className="mt-1 text-sm text-slate-500">{formatDateTime(meeting.starts_at)}{meeting.host_name ? ` · ${meeting.host_name}` : ''}</p>{meeting.notes && <p className="mt-2 text-sm text-slate-600">{meeting.notes}</p>}</div>{['upcoming', 'live'].includes(meeting.status) && <button type="button" onClick={onJoin} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white"><PlayCircle className="h-4 w-4" /> Join<ExternalLink className="h-3.5 w-3.5" /></button>}</article>;
}

