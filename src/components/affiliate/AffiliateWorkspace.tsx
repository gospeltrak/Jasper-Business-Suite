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
  LoaderCircle,
  Pencil as PencilIcon,
  PlayCircle,
  RefreshCw,
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
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

type TabId = 'overview' | 'tasks' | 'ads' | 'meetings' | 'reports' | 'payouts';

export default function AffiliateWorkspace({ onLogout }: { onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<AffiliateWorkspaceData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
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
    try {
      const { getDynamicSupabaseClient } = await import('../../supabaseClient');
      const client: any = await getDynamicSupabaseClient();
      await client.from('affiliates').update({ promo_code: cleaned, referral_code: cleaned, referral_slug: cleaned.toLowerCase() }).eq('id', workspace.profile.id);
    } catch { /* offline — will sync later */ }
    // Update localStorage
    const updated = all.map((a: any) => a.id === workspace.profile.id ? { ...a, promoCode: cleaned } : a);
    localStorage.setItem('saas_immersive_affiliates', JSON.stringify(updated));
    const savedAff = JSON.parse(localStorage.getItem('jasper_logged_affiliate') || '{}');
    if (savedAff.id === workspace.profile.id) {
      savedAff.promoCode = cleaned;
      localStorage.setItem('jasper_logged_affiliate', JSON.stringify(savedAff));
    }
    setNotice(`✅ Promo code updated to ${cleaned}`);
    setEditingCode(false);
    setCodeError('');
    setSuggestions([]);
    await refresh();
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

  const metrics = useMemo(() => {
    const referrals = workspace?.referrals || [];
    const commissions = workspace?.commissions || [];
    const activities = workspace?.activities || [];
    const available = commissions.filter((commission) => commission.status === 'available').reduce((sum, commission) => sum + commission.net_payout, 0);
    const earned = commissions.filter((commission) => commission.status !== 'void').reduce((sum, commission) => sum + commission.net_payout, 0);
    const paid = commissions.filter((commission) => commission.status === 'paid').reduce((sum, commission) => sum + commission.net_payout, 0);
    return {
      clicks: referrals.filter((referral) => referral.status === 'clicked').length,
      registrations: referrals.filter((referral) => ['registered', 'converted'].includes(referral.status)).length,
      conversions: referrals.filter((referral) => referral.status === 'converted').length,
      downloads: activities.filter((event) => event.event_type === 'ad_download' || event.event_type === 'task_download').length,
      meetingJoins: activities.filter((event) => event.event_type === 'meeting_join').length,
      copiedLinks: activities.filter((event) => event.event_type === 'campaign_link_copy').length,
      available,
      earned,
      paid,
    };
  }, [workspace]);

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

  if (state === 'loading') {
    return <div className="min-h-[70vh] grid place-items-center bg-slate-50 text-slate-500"><LoaderCircle className="w-6 h-6 animate-spin" /></div>;
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
            <button type="button" onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold"><RefreshCw className="w-4 h-4" /> Retry</button>
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
    ['tasks', 'Tasks', ClipboardList],
    ['ads', 'Ads by JB', Film],
    ['meetings', 'Meetings', CalendarClock],
    ['reports', 'Reports', TrendingUp],
    ['payouts', 'Payouts', Wallet],
  ] as const;

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
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => handleTrackedLink('ad_download', 'campaign', campaign.id, campaign.media_url, campaign.media_name)} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white"><Download className="w-3.5 h-3.5" /> Download</button>
        {campaign.campaign_url ? <button type="button" onClick={() => handleTrackedLink('campaign_link_copy', 'campaign', campaign.id, campaign.campaign_url!)} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700"><Copy className="w-3.5 h-3.5" /> Copy link</button> : <span className="grid place-items-center rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-400">No link</span>}
      </div>
    </article>
  );

  return (
    <main className="bg-slate-50 text-slate-900 pb-24 lg:pb-8 min-h-[100dvh]">
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
              <Metric label="Registrations" value={metrics.registrations.toString()} />
              <Metric label="Conversions" value={metrics.conversions.toString()} />
              <Metric label="Downloads" value={metrics.downloads.toString()} />
              <Metric label="Available" value={currency.format(metrics.available)} />
            </section>

            {/* ── PROMO CODE + REFERRAL LINK CARD ── */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              {/* Promo code row */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Your Promo Code</p>
                <div className="flex items-center gap-2">
                  {editingCode ? (
                    <div className="flex-1 space-y-2">
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700 leading-relaxed">
                        ⚠️ Badilisha mara moja tu. Code mpya itaathiri ufuatiliaji wa taarifa na malipo yako.
                      </div>
                      <div className="flex gap-2">
                        <input autoFocus type="text" value={newCode} onChange={e => { setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'')); setCodeError(''); setSuggestions([]); }}
                          placeholder="NEW CODE" maxLength={20}
                          className={`flex-1 rounded-md px-3 py-2 text-sm font-mono font-bold uppercase text-slate-900 border outline-none ${codeError ? 'border-rose-400 bg-rose-50' : 'border-emerald-400 bg-slate-50'}`} />
                        <button type="button" onClick={saveCode} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-md cursor-pointer border-none">Save</button>
                        <button type="button" onClick={() => { setEditingCode(false); setCodeError(''); setSuggestions([]); }} className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-md cursor-pointer border-none">Cancel</button>
                      </div>
                      {codeError && (
                        <div className="space-y-1">
                          <p className="text-xs text-rose-600 font-semibold">{codeError}</p>
                          {suggestions.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              <span className="text-[10px] text-slate-500">Try:</span>
                              {suggestions.map(s => (
                                <button key={s} type="button" onClick={() => { setNewCode(s); setCodeError(''); setSuggestions([]); }}
                                  className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold cursor-pointer hover:bg-emerald-100">{s}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-3 bg-slate-100 rounded-md px-4 py-2.5">
                        <span className="font-black text-slate-900 text-base font-mono tracking-widest">{profile.referral_code}</span>
                      </div>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(profile.referral_code); setNotice('Promo code copied!'); }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer bg-white">
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </button>
                      <button type="button" onClick={() => { setEditingCode(true); setNewCode(profile.referral_code); }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer bg-white">
                        <PencilIcon className="h-3.5 w-3.5" /> Edit
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Referral link row */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Referral Link</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-slate-100 px-3 py-2.5 text-xs text-slate-700">{window.location.origin}/?ref={profile.referral_code}</code>
                  <button type="button" onClick={copyReferralLink} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white cursor-pointer border-none"><Copy className="h-4 w-4" /> Copy Link</button>
                </div>
              </div>
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              <Panel title="Latest tasks" action="View all" onAction={() => setActiveTab('tasks')}>
                {openTasks.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} busy={busyTaskId === task.id} onComplete={handleTaskComplete} onDownload={() => task.attachment_url && handleTrackedLink('task_download', 'task', task.id, task.attachment_url, task.attachment_name)} />)}
                {openTasks.length === 0 && <Empty text="No pending tasks from your agent." />}
              </Panel>
              <Panel title="Upcoming meetings" action="View all" onAction={() => setActiveTab('meetings')}>
                {upcomingMeetings.slice(0, 3).map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onJoin={() => handleTrackedLink('meeting_join', 'meeting', meeting.id, meeting.meeting_url)} />)}
                {upcomingMeetings.length === 0 && <Empty text="No upcoming meetings have been scheduled." />}
              </Panel>
            </section>
          </div>}

          {activeTab === 'tasks' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{workspace!.tasks.map((task) => <TaskRow key={task.id} task={task} busy={busyTaskId === task.id} onComplete={handleTaskComplete} onDownload={() => task.attachment_url && handleTrackedLink('task_download', 'task', task.id, task.attachment_url, task.attachment_name)} />)}{workspace!.tasks.length === 0 && <Empty text="No tasks, notes, or files have been assigned to you yet." />}</section>}
          {activeTab === 'ads' && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{workspace!.campaigns.map(renderCampaign)}{workspace!.campaigns.length === 0 && <div className="md:col-span-2 xl:col-span-3"><Empty text="No Ads by JB campaigns are assigned to your account." /></div>}</section>}
          {activeTab === 'meetings' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{workspace!.meetings.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onJoin={() => handleTrackedLink('meeting_join', 'meeting', meeting.id, meeting.meeting_url)} />)}{workspace!.meetings.length === 0 && <Empty text="No agent meetings are scheduled for your account." />}</section>}
          {activeTab === 'reports' && <section className="space-y-5"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Clicks" value={metrics.clicks.toString()} /><Metric label="Links copied" value={metrics.copiedLinks.toString()} /><Metric label="Meetings joined" value={metrics.meetingJoins.toString()} /><Metric label="Paid commission" value={currency.format(metrics.paid)} /></div><Panel title="Recent activity">{workspace!.activities.slice(0, 12).map((event) => <div key={event.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0"><div><p className="text-sm font-semibold capitalize text-slate-800">{event.event_type.replace(/_/g, ' ')}</p><p className="text-xs text-slate-500">{event.resource_type || 'workspace'} · {formatDateTime(event.created_at)}</p></div><span className="text-[11px] font-semibold uppercase text-slate-400">{event.resource_id ? 'tracked' : 'recorded'}</span></div>)}{workspace!.activities.length === 0 && <Empty text="No tracked affiliate activity yet." />}</Panel></section>}
          {activeTab === 'payouts' && <section className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Commission earned" value={currency.format(metrics.earned)} /><Metric label="Available" value={currency.format(metrics.available)} /><Metric label="Paid" value={currency.format(metrics.paid)} /></div><div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{workspace!.payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0"><div><p className="text-sm font-bold">{currency.format(payout.amount)}</p><p className="text-xs text-slate-500">{payout.payout_method || 'Payout method pending'} · {formatDateTime(payout.requested_at)}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">{payout.status}</span></div>)}{workspace!.payouts.length === 0 && <Empty text="No payout requests yet. Confirmed payouts will appear here." />}</div></section>}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {navItems.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`grid min-h-16 place-items-center gap-1 text-[10px] font-bold ${activeTab === id ? 'text-emerald-700' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{label}</button>)}
      </nav>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-black tracking-tight text-slate-950">{value}</p></div>;
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
