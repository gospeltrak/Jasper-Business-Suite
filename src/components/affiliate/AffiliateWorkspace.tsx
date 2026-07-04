import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  Film,
  Link as LinkIcon,
  LogOut,
  LoaderCircle,
  Menu,
  Pencil as PencilIcon,
  PlayCircle,
  RefreshCw,
  Settings,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  AffiliateCampaign,
  AffiliateWorkspaceData,
  completeAffiliateTask,
  loadAffiliateWorkspace,
  recordAffiliateActivity,
} from '../../utils/affiliateWorkspace';
import {
  isOnline,
  initOfflineSync,
  dbWrite,
  flushSyncQueue,
} from '../../utils/offlineSync';
import { useGlobalAdSettings } from '../../utils/adPlacement';
import { sanitizeTrustedHtml } from '../../utils/safeHtml';
import GlobalStickyAd from '../GlobalStickyAd';

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

type TabId = 'overview' | 'code-link' | 'tasks' | 'ads' | 'meetings' | 'reports' | 'payouts' | 'settings';

export default function AffiliateWorkspace({ onLogout }: { onLogout: () => void }) {
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
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const adSettings = useGlobalAdSettings();

  useEffect(() => {
    initOfflineSync((result) => {
      setNotice(`✅ ${result.synced} changes synced.`);
    });
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
    const cleaned = newCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleaned) { setCodeError('Code must contain letters or numbers only.'); return; }
    // Check duplicates in localStorage
    const all: any[] = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
    const taken = all.some(a => a.promoCode?.toUpperCase() === cleaned && a.id !== workspace.profile.id);
    if (taken) {
      const sugg: string[] = [];
      for (const sfx of ['1','2','3','_TZ','_EA','_PRO']) {
        const s = `${cleaned}${sfx}`;
        if (!all.some(a => a.promoCode?.toUpperCase() === s)) { sugg.push(s); if (sugg.length >= 3) break; }
      }
      setCodeError(`"${cleaned}" is already taken.`);
      setSuggestions(sugg);
      return;
    }
    // Save to DB — queues automatically if offline, syncs when connected
    await dbWrite('affiliates', 'update',
      { promo_code: cleaned, referral_code: cleaned, referral_slug: cleaned.toLowerCase() },
      { column: 'id', value: workspace.profile.id },
      workspace.profile.id
    );
    // Update localStorage
    const updated = all.map((a: any) => a.id === workspace.profile.id ? { ...a, promoCode: cleaned } : a);
    localStorage.setItem('saas_immersive_affiliates', JSON.stringify(updated));
    const savedAff = JSON.parse(localStorage.getItem('jasper_logged_affiliate') || '{}');
    if (savedAff.id === workspace.profile.id) {
      savedAff.promoCode = cleaned;
      localStorage.setItem('jasper_logged_affiliate', JSON.stringify(savedAff));
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
      const nextWorkspace = await loadAffiliateWorkspace();
      setWorkspace(nextWorkspace);
      setState(nextWorkspace ? 'ready' : 'missing');
    } catch (nextError: any) {
      setError(nextError?.message || 'Unable to load your affiliate workspace.');
      setState('error');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!workspace?.profile) return;
    const prefsKey = `jasper_affiliate_preferences_${workspace.profile.id}`;
    let savedPrefs = profilePrefs;
    try {
      savedPrefs = { ...profilePrefs, ...JSON.parse(localStorage.getItem(prefsKey) || '{}') };
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
    const totalRevenue = subscribers.reduce((sum, subscriber) => sum + Number(subscriber.amount_paid || 0), 0);
    const grossCommission15 = totalRevenue * 0.15;
    const withholdingTax5 = grossCommission15 * 0.05;
    const totalPayout = grossCommission15 - withholdingTax5;
    const available = commissions.filter((commission) => commission.status === 'available').reduce((sum, commission) => sum + commission.net_payout, 0);
    const earned = commissions.filter((commission) => commission.status !== 'void').reduce((sum, commission) => sum + commission.net_payout, 0);
    const paid = commissions.filter((commission) => commission.status === 'paid').reduce((sum, commission) => sum + commission.net_payout, 0);
    return {
      clicks: referrals.filter((referral) => referral.status === 'clicked').length,
      registrations: subscribers.length || referrals.filter((referral) => ['registered', 'converted'].includes(referral.status)).length,
      conversions: referrals.filter((referral) => referral.status === 'converted').length,
      downloads: activities.filter((event) => event.event_type === 'ad_download' || event.event_type === 'task_download').length,
      meetingJoins: activities.filter((event) => event.event_type === 'meeting_join').length,
      copiedLinks: activities.filter((event) => event.event_type === 'campaign_link_copy').length,
      totalRevenue,
      grossCommission15,
      withholdingTax5,
      totalPayout,
      available,
      earned,
      paid,
    };
  }, [workspace]);

  const monthlySubscribers = useMemo(() => {
    const subscribers = workspace?.subscribers || [];
    return subscribers.filter((subscriber) => (subscriber.created_at || '').slice(0, 7) === reportMonth);
  }, [workspace?.subscribers, reportMonth]);

  const monthStats = useMemo(() => {
    const revenue = monthlySubscribers.reduce((sum, subscriber) => sum + Number(subscriber.amount_paid || 0), 0);
    const grossCommission = revenue * 0.15;
    const withholding = grossCommission * 0.05;
    const payout = grossCommission - withholding;
    return {
      registrations: monthlySubscribers.length,
      active: monthlySubscribers.filter((subscriber) => subscriber.status === 'active').length,
      inactive: monthlySubscribers.filter((subscriber) => subscriber.status !== 'active').length,
      revenue,
      grossCommission,
      withholding,
      payout,
    };
  }, [monthlySubscribers]);

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
  const canWithdraw = monthStats.payout >= 5000 && isAgentApprovedForWithdrawals;

  const copyReferralLink = async () => {
    if (!workspace) return;
    const link = `${window.location.origin}/?ref=${encodeURIComponent(workspace.profile.referral_code)}`;
    await navigator.clipboard.writeText(link);
    setNotice('Referral link copied.');
    window.setTimeout(() => setNotice(null), 2500);
  };

  const handleTaskComplete = async (taskId: string) => {
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

  const saveAffiliateSettings = async () => {
    if (!workspace?.profile) return;
    const displayName = profileDraft.displayName.trim() || workspace.profile.display_name;
    const payoutMethod = profileDraft.payoutMethod.trim() || null;
    const payoutAccount = profileDraft.payoutAccount.trim() || null;
    const prefsKey = `jasper_affiliate_preferences_${workspace.profile.id}`;
    localStorage.setItem(prefsKey, JSON.stringify(profilePrefs));
    setWorkspace({
      ...workspace,
      profile: {
        ...workspace.profile,
        display_name: displayName,
        payout_method: payoutMethod,
        payout_account: payoutAccount,
      },
    });
    const result = await dbWrite(
      'affiliates',
      'update',
      { display_name: displayName, payout_method: payoutMethod, payout_account: payoutAccount },
      { column: 'id', value: workspace.profile.id },
      workspace.profile.id,
    );
    setNotice(result.queued ? 'Profile saved locally and will sync when online.' : 'Profile settings saved.');
  };

  const requestWithdrawal = async () => {
    if (!workspace?.profile) return;
    if (!isAgentApprovedForWithdrawals) {
      setNotice('Your affiliate agent must approve withdrawals before you can withdraw.');
      return;
    }
    if (monthStats.payout < 5000) {
      setNotice('Minimum withdrawal threshold is TZS 5,000.');
      return;
    }
    const result = await dbWrite(
      'affiliate_payouts',
      'insert',
      {
        affiliate_id: workspace.profile.id,
        amount: Math.round(monthStats.payout),
        currency: 'TZS',
        payout_method: workspace.profile.payout_method,
        payout_reference: null,
        status: 'requested',
        requested_at: new Date().toISOString(),
        notes: `ZamPay disbursement request for ${reportMonth}. Gross 15% commission: ${Math.round(monthStats.grossCommission).toLocaleString()}; WHT 5% of commission: ${Math.round(monthStats.withholding).toLocaleString()}.`,
      },
      workspace.profile.id,
    );
    setNotice(result.queued ? 'Withdrawal request saved locally and will sync when online.' : 'Withdrawal request submitted for ZamPay disbursement review.');
    await refresh();
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
    try { await recordAffiliateActivity(eventType, resourceType, resourceId); } catch { /* Tracking should not block a valid resource. */ }
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
    try { await recordAffiliateActivity('campaign_link_copy', 'campaign', campaign.id); } catch { /* Tracking should not block copying. */ }
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
  const navItems = [
    ['overview', 'Overview', BarChart3],
    ['code-link', 'Code & Link', LinkIcon],
    ['tasks', 'Tasks', ClipboardList],
    ['ads', 'Ads by JB', Film],
    ['meetings', 'Meetings', CalendarClock],
    ['reports', 'Reports', TrendingUp],
    ['payouts', 'Payouts', Wallet],
    ['settings', 'Settings', Settings],
  ] as const;
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
    <main className="bg-slate-50 text-slate-900 pb-24 lg:pb-8 min-h-[100dvh]">
      {/* Offline banner */}
      {!isNetworkOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 text-slate-950 text-xs font-bold py-2 px-4">
          ⚠️ Offline — Unafanya kazi bila intaneti. Mabadiliko yatasync ukiunganika. | Changes will sync when connected.
        </div>
      )}
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden h-screen sticky top-0 lg:flex flex-col border-r border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-600 text-sm font-black text-white">JB</div>
            <div><p className="text-sm font-black text-slate-950">Affiliate</p><p className="text-[11px] text-slate-500">Live workspace</p></div>
          </div>
          <nav className="mt-8 space-y-1" aria-label="Affiliate workspace navigation">
            {navItems.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold ${activeTab === id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>)}
          </nav>
          <button type="button" onClick={onLogout} className="mt-auto rounded-md border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Connected affiliate account</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Hello, {profile.display_name}</h1>
                <p className="mt-1 text-sm text-slate-500">Code {profile.referral_code} · {profile.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyReferralLink} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><LinkIcon className="h-4 w-4" /> Share link</button>
                <button type="button" onClick={refresh} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" /> Refresh</button>
              </div>
            </div>
          </header>

          {notice && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</div>}

          {activeTab === 'overview' && <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric label="Registrations" value={metrics.registrations.toString()} sub="Subscribers using your promo code" />
              <Metric label="Total amount entered" value={currency.format(metrics.totalRevenue)} sub="All-time subscriber payments" />
              <Metric label="Your 15%" value={currency.format(metrics.grossCommission15)} sub="Gross affiliate commission" />
              <Metric label="Total payout" value={currency.format(metrics.totalPayout)} sub="15% commission minus 5% WHT" />
            </section>

            {(() => {
              const adCode = adSettings.dashboardAdCode?.trim();
              if (adSettings.dashboardAdEnabled && adCode) {
                return (
                  <div className="flex min-h-[90px] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div
                      className="min-h-[90px] w-full max-w-[728px] overflow-hidden [&>*]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: sanitizeTrustedHtml(adCode) }}
                    />
                  </div>
                );
              }

              return (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors"
                  onClick={() => setActiveTab('code-link')}>
                  <LinkIcon className="h-4 w-4 text-emerald-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-900">{profile.referral_code}</p>
                    <p className="text-xs text-emerald-700 truncate">{window.location.origin}/?ref={profile.referral_code}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">Code & Link →</span>
                </div>
              );
            })()}
            <section className="grid gap-5 xl:grid-cols-2">
              <Panel title="Latest tasks" action="View all" onAction={() => setActiveTab('tasks')}>
                {openTasks.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} busy={busyTaskId === task.id} onComplete={handleTaskComplete} onDownload={() => task.attachment_url && handleTrackedLink('task_download', 'task', task.id, task.attachment_url, task.attachment_name)} />)}
                {openTasks.length === 0 && <Empty text="No pending tasks from your agent." />}
              </Panel>
              <Panel title="Task target progress" action="View report" onAction={() => setActiveTab('reports')}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">{taskProgress.completed}/{taskProgress.total} tasks completed</p>
                      <p className="mt-1 text-xs text-slate-500">{taskProgress.pending} pending · {taskProgress.overdue} overdue</p>
                    </div>
                    <span className="text-2xl font-black text-emerald-700">{taskProgress.progress}%</span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${taskProgress.progress}%` }} />
                  </div>
                  {taskGoalCards.slice(0, 2).map((goal) => (
                    <div key={goal.id} className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-900">{goal.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{goal.scope}: {goal.progressValue}/{goal.target}</p>
                        </div>
                        <span className="text-sm font-black text-emerald-700">{goal.progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${goal.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
            <Panel title="Upcoming meetings" action="View all" onAction={() => setActiveTab('meetings')}>
              {upcomingMeetings.slice(0, 3).map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onJoin={() => handleTrackedLink('meeting_join', 'meeting', meeting.id, meeting.meeting_url)} />)}
              {upcomingMeetings.length === 0 && <Empty text="No upcoming meetings have been scheduled." />}
            </Panel>
          </div>}

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
                    ⚠️ Badilisha mara moja tu. Code mpya itaathiri ufuatiliaji wa taarifa na malipo yako.
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
                    <button type="button" onClick={() => { setEditingCode(true); setNewCode(getLiveCode(profile) || profile.referral_code); }}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer border-none flex items-center justify-center gap-2 text-sm">
                      <PencilIcon className="h-4 w-4" /> Edit Code
                    </button>
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

          {activeTab === 'tasks' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{workspace!.tasks.map((task) => <TaskRow key={task.id} task={task} busy={busyTaskId === task.id} onComplete={handleTaskComplete} onDownload={() => task.attachment_url && handleTrackedLink('task_download', 'task', task.id, task.attachment_url, task.attachment_name)} />)}{workspace!.tasks.length === 0 && <Empty text="No tasks, notes, or files have been assigned to you yet." />}</section>}
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
                <Metric label="Commission" value={currency.format(monthStats.grossCommission)} sub="15% for this month" />
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
                          const commission = subscriber.commission_amount || subscriber.amount_paid * 0.15;
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
                              <td className="px-4 py-3 text-right font-mono font-bold">{currency.format(subscriber.amount_paid)}</td>
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
                  <Metric label="Your 15%" value={currency.format(monthStats.grossCommission)} />
                  <Metric label="Withholding 5%" value={currency.format(monthStats.withholding)} />
                  <Metric label="Total payout" value={currency.format(monthStats.payout)} />
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
            <section className="space-y-5">
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Payout</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Monthly earned commission, withholding tax, and ZamPay withdrawal eligibility.</p>
                </div>
                <input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500" />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label="Earned commission" value={currency.format(monthStats.grossCommission)} sub="15% for selected month" />
                <Metric label="Withholding tax" value={currency.format(monthStats.withholding)} sub="5% of commission" />
                <Metric label="Total payout amount" value={currency.format(monthStats.payout)} sub="Can withdraw after approval" />
                <Metric label="Threshold" value="TZS 5,000" sub={monthStats.payout >= 5000 ? 'Reached' : 'Not reached'} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">ZamPay disbursement withdrawal</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Status: {isAgentApprovedForWithdrawals ? 'Agent approved for withdrawals' : 'Waiting for affiliate agent approval'} · Minimum withdrawal TZS 5,000.
                    </p>
                  </div>
                  <button type="button" disabled={!canWithdraw} onClick={requestWithdrawal} className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                    Withdraw {currency.format(monthStats.payout)}
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{workspace!.payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0"><div><p className="text-sm font-bold">{currency.format(payout.amount)}</p><p className="text-xs text-slate-500">{payout.payout_method || 'Payout method pending'} · {formatDateTime(payout.requested_at)}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">{payout.status}</span></div>)}{workspace!.payouts.length === 0 && <Empty text="No payout requests yet. Confirmed payouts will appear here." />}</div>
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

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {mobilePrimaryNav.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => { setActiveTab(id); setMobileMoreOpen(false); }} className={`grid min-h-16 place-items-center gap-1 text-[10px] font-bold ${activeTab === id ? 'text-emerald-700' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{label}</button>)}
        <button type="button" onClick={() => setMobileMoreOpen(true)} className={`grid min-h-16 place-items-center gap-1 text-[10px] font-bold ${mobileMoreOpen || mobileMoreNav.some(([id]) => id === activeTab) ? 'text-emerald-700' : 'text-slate-500'}`}><Menu className="h-5 w-5" />More</button>
      </nav>
      {mobileMoreOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setMobileMoreOpen(false)}>
          <section className="absolute inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="grid grid-cols-3 gap-3">
              {mobileMoreNav.map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => { setActiveTab(id); setMobileMoreOpen(false); }} className={`grid gap-1 rounded-xl border px-2 py-3 text-center text-[11px] font-bold ${activeTab === id ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-600'}`}>
                  <Icon className="mx-auto h-5 w-5" />{label}
                </button>
              ))}
              <button type="button" onClick={() => { setMobileMoreOpen(false); onLogout(); }} className="grid gap-1 rounded-xl border border-rose-100 px-2 py-3 text-center text-[11px] font-bold text-rose-600">
                <LogOut className="mx-auto h-5 w-5" />Sign out
              </button>
            </div>
          </section>
        </div>
      )}

      <GlobalStickyAd
        bottomOffsetClass="bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-4"
        leftOffsetClass="left-3 lg:left-1/2 lg:-translate-x-1/2"
        maxWidthClass="max-w-[640px]"
      />

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

function TaskRow({ task, busy, onComplete, onDownload }: { key?: unknown; task: any; busy: boolean; onComplete: (id: string) => void; onDownload: () => void }) {
  return <article className="p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{task.task_type} · {task.status}</p><h3 className="mt-1 text-sm font-bold text-slate-950">{task.title}</h3>{task.body && <p className="mt-1 text-sm leading-5 text-slate-600">{task.body}</p>}<p className="mt-2 text-xs text-slate-400">{task.sender_name ? `From ${task.sender_name}` : 'From assigned agent'}{task.due_at ? ` · Due ${formatDateTime(task.due_at)}` : ''}</p></div><ClipboardList className="h-5 w-5 shrink-0 text-slate-400" /></div><div className="mt-3 flex flex-wrap gap-2">{task.attachment_url ? <button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><Download className="h-3.5 w-3.5" /> {task.attachment_name || 'Download file'}</button> : null}{!['completed', 'reviewed'].includes(task.status) ? <button type="button" disabled={busy} onClick={() => onComplete(task.id)} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> {busy ? 'Updating' : 'Mark complete'}</button> : null}</div></article>;
}

function MeetingRow({ meeting, onJoin }: { key?: unknown; meeting: any; onJoin: () => void }) {
  return <article className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{meeting.status}</p><h3 className="mt-1 text-sm font-bold text-slate-950">{meeting.title}</h3><p className="mt-1 text-sm text-slate-500">{formatDateTime(meeting.starts_at)}{meeting.host_name ? ` · ${meeting.host_name}` : ''}</p>{meeting.notes && <p className="mt-2 text-sm text-slate-600">{meeting.notes}</p>}</div>{['upcoming', 'live'].includes(meeting.status) && <button type="button" onClick={onJoin} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white"><PlayCircle className="h-4 w-4" /> Join<ExternalLink className="h-3.5 w-3.5" /></button>}</article>;
}
