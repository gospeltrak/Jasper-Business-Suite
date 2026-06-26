import { useCallback, useEffect, useMemo, useState } from 'react';
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
  PlayCircle,
  RefreshCw,
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

interface AffiliateWorkspaceProps {
  onLogout: () => void;
}

export default function AffiliateWorkspace({ onLogout }: AffiliateWorkspaceProps) {
  const [workspace, setWorkspace] = useState<AffiliateWorkspaceData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'ads' | 'meetings' | 'payouts'>('overview');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    const available = commissions.filter((commission) => commission.status === 'available').reduce((sum, commission) => sum + commission.amount, 0);
    const earned = commissions.filter((commission) => commission.status !== 'void').reduce((sum, commission) => sum + commission.amount, 0);
    return {
      clicks: referrals.filter((referral) => referral.status === 'clicked').length,
      registrations: referrals.filter((referral) => ['registered', 'converted'].includes(referral.status)).length,
      conversions: referrals.filter((referral) => referral.status === 'converted').length,
      available,
      earned,
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

  const handleTrackedLink = async (
    eventType: 'ad_download' | 'campaign_link_copy' | 'task_download' | 'meeting_join',
    resourceType: string,
    resourceId: string,
    url: string,
  ) => {
    if (!isSafeExternalUrl(url)) {
      setNotice('This resource is unavailable because its file or link is invalid.');
      return;
    }
    try { await recordAffiliateActivity(eventType, resourceType, resourceId); } catch { /* Activity tracking must not block a valid file. */ }
    if (eventType === 'campaign_link_copy') {
      await navigator.clipboard.writeText(url);
      setNotice('Campaign link copied.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (state === 'loading') {
    return <div className="min-h-[68vh] grid place-items-center text-slate-500"><LoaderCircle className="w-6 h-6 animate-spin" /></div>;
  }

  if (state === 'missing' || state === 'error') {
    return (
      <main className="min-h-[68vh] grid place-items-center px-5 bg-slate-50">
        <section className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-7 text-center shadow-sm">
          <ClipboardList className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900">{state === 'missing' ? 'Affiliate workspace pending' : 'Workspace unavailable'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {state === 'missing'
              ? 'Your account is signed in, but an affiliate profile has not been assigned yet. Ask a Jasper administrator to activate your affiliate workspace.'
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
    ['payouts', 'Payouts', Wallet],
  ] as const;

  const renderCampaign = (campaign: AffiliateCampaign) => (
    <article key={campaign.id} className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex gap-3 justify-between">
        <div className="min-w-0"><p className="text-[11px] font-semibold text-emerald-700">Ads by JB · {campaign.campaign_name}</p><h3 className="mt-1 text-sm font-bold text-slate-900">{campaign.title}</h3></div>
        <Film className="w-5 h-5 text-slate-400 shrink-0" />
      </div>
      {campaign.description && <p className="mt-2 text-sm leading-5 text-slate-500">{campaign.description}</p>}
      {campaign.recommended_caption && <p className="mt-3 border-l-2 border-emerald-400 pl-3 text-xs leading-5 text-slate-600">{campaign.recommended_caption}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">{campaign.duration_seconds ? <span>{Math.ceil(campaign.duration_seconds / 60)} min video</span> : null}{formatBytes(campaign.media_size_bytes) ? <span>{formatBytes(campaign.media_size_bytes)}</span> : null}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => handleTrackedLink('ad_download', 'campaign', campaign.id, campaign.media_url)} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-semibold"><Download className="w-3.5 h-3.5" /> Download</button>
        {campaign.campaign_url && <button type="button" onClick={() => handleTrackedLink('campaign_link_copy', 'campaign', campaign.id, campaign.campaign_url!)} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-300 text-slate-700 text-xs font-semibold"><Copy className="w-3.5 h-3.5" /> Copy link</button>}
      </div>
    </article>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-24 lg:pb-8">
      <div className="max-w-[1440px] mx-auto lg:grid lg:grid-cols-[224px_minmax(0,1fr)] min-h-screen">
        <aside className="hidden lg:flex flex-col bg-slate-950 text-slate-300 p-5 sticky top-0 h-screen">
          <div className="flex items-center gap-2 text-white font-bold"><div className="w-8 h-8 bg-emerald-500 rounded-md grid place-items-center">JB</div><span>Affiliate</span></div>
          <nav className="mt-9 space-y-1" aria-label="Affiliate workspace navigation">
            {navItems.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-left ${activeTab === id ? 'bg-emerald-500 text-slate-950' : 'hover:bg-slate-900'}`}><Icon className="w-4 h-4" />{label}</button>)}
          </nav>
          <button type="button" onClick={onLogout} className="mt-auto rounded-md border border-slate-800 py-2.5 text-sm font-semibold hover:bg-slate-900">Sign out</button>
        </aside>
        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="flex items-start justify-between gap-4 mb-7"><div><p className="text-sm text-slate-500">Affiliate workspace</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Hello, {profile.display_name}</h1></div><button type="button" onClick={refresh} className="p-2.5 rounded-md border border-slate-300 text-slate-600" title="Refresh workspace"><RefreshCw className="w-4 h-4" /></button></header>
          {notice && <div className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{notice}</div>}

          {activeTab === 'overview' && <div className="space-y-6">
            <section className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric label="Referral clicks" value={metrics.clicks.toString()} /><Metric label="Registrations" value={metrics.registrations.toString()} /><Metric label="Conversions" value={metrics.conversions.toString()} /><Metric label="Commission available" value={currency.format(metrics.available)} /></section>
            <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5"><p className="text-xs font-semibold text-slate-500">Your referral link</p><div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3"><code className="flex-1 min-w-0 rounded-md bg-slate-100 px-3 py-2.5 text-xs text-slate-700 overflow-x-auto">{window.location.origin}/?ref={profile.referral_code}</code><button type="button" onClick={copyReferralLink} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-md bg-emerald-600 text-white text-sm font-semibold"><Copy className="w-4 h-4" /> Copy link</button></div><p className="mt-2 text-xs text-slate-500">Code: <strong className="text-slate-800">{profile.referral_code}</strong></p></section>
            <section className="grid xl:grid-cols-2 gap-5"><div className="bg-white border border-slate-200 rounded-lg"><div className="p-4 border-b border-slate-100 flex justify-between"><h2 className="font-bold">Agent tasks</h2><button type="button" onClick={() => setActiveTab('tasks')} className="text-sm text-emerald-700 font-semibold">View all</button></div><div className="divide-y divide-slate-100">{openTasks.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} busy={busyTaskId === task.id} onComplete={handleTaskComplete} onDownload={() => task.attachment_url && handleTrackedLink('task_download', 'task', task.id, task.attachment_url)} />)}{openTasks.length === 0 && <Empty text="No new tasks from your agent." />}</div></div><div className="bg-white border border-slate-200 rounded-lg"><div className="p-4 border-b border-slate-100 flex justify-between"><h2 className="font-bold">Upcoming meetings</h2><button type="button" onClick={() => setActiveTab('meetings')} className="text-sm text-emerald-700 font-semibold">View all</button></div><div className="divide-y divide-slate-100">{upcomingMeetings.slice(0, 3).map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onJoin={() => handleTrackedLink('meeting_join', 'meeting', meeting.id, meeting.meeting_url)} />)}{upcomingMeetings.length === 0 && <Empty text="No upcoming meetings have been scheduled." />}</div></div></section>
          </div>}
          {activeTab === 'tasks' && <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">{workspace!.tasks.map((task) => <TaskRow key={task.id} task={task} busy={busyTaskId === task.id} onComplete={handleTaskComplete} onDownload={() => task.attachment_url && handleTrackedLink('task_download', 'task', task.id, task.attachment_url)} />)}{workspace!.tasks.length === 0 && <Empty text="No tasks, notes, or files have been assigned to you yet." />}</section>}
          {activeTab === 'ads' && <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{workspace!.campaigns.map(renderCampaign)}{workspace!.campaigns.length === 0 && <div className="md:col-span-2 xl:col-span-3"><Empty text="No Ads by JB campaigns are assigned to your affiliate account." /></div>}</section>}
          {activeTab === 'meetings' && <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">{workspace!.meetings.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onJoin={() => handleTrackedLink('meeting_join', 'meeting', meeting.id, meeting.meeting_url)} />)}{workspace!.meetings.length === 0 && <Empty text="No agent meetings are scheduled for your account." />}</section>}
          {activeTab === 'payouts' && <section className="space-y-5"><div className="grid sm:grid-cols-2 gap-4"><Metric label="Commission earned" value={currency.format(metrics.earned)} /><Metric label="Available to withdraw" value={currency.format(metrics.available)} /></div><div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">{workspace!.payouts.map((payout) => <div key={payout.id} className="p-4 flex items-center justify-between gap-3"><div><p className="font-semibold text-sm">{currency.format(payout.amount)}</p><p className="text-xs text-slate-500">{payout.payout_method || 'Payout method pending'} · {formatDateTime(payout.requested_at)}</p></div><span className="text-xs font-semibold text-slate-600 capitalize">{payout.status}</span></div>)}{workspace!.payouts.length === 0 && <Empty text="No payout requests yet. Your confirmed payouts will appear here." />}</div></section>}
        </section>
      </div>
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-slate-200 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">{navItems.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`min-h-16 grid place-items-center gap-1 text-[10px] font-semibold ${activeTab === id ? 'text-emerald-700' : 'text-slate-500'}`}><Icon className="w-5 h-5" />{label}</button>)}</nav>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white border border-slate-200 rounded-lg p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="p-6 text-sm text-center text-slate-500">{text}</div>; }
function TaskRow({ task, busy, onComplete, onDownload }: { task: any; busy: boolean; onComplete: (id: string) => void; onDownload: () => void }) { return <article className="p-4"><div className="flex gap-3 justify-between"><div><p className="text-[11px] uppercase font-semibold tracking-wide text-slate-500">{task.task_type} · {task.status}</p><h3 className="mt-1 font-bold text-sm">{task.title}</h3>{task.body && <p className="mt-1 text-sm text-slate-500 leading-5">{task.body}</p>}<p className="mt-2 text-xs text-slate-400">{task.sender_name ? `From ${task.sender_name}` : 'From your assigned agent'}{task.due_at ? ` · Due ${formatDateTime(task.due_at)}` : ''}</p></div><ClipboardList className="w-5 h-5 text-slate-400 shrink-0" /></div><div className="mt-3 flex flex-wrap gap-2">{task.attachment_url ? <button type="button" onClick={onDownload} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 rounded-md"><Download className="w-3.5 h-3.5" /> {task.attachment_name || 'Download file'}</button> : null}{!['completed', 'reviewed'].includes(task.status) ? <button type="button" disabled={busy} onClick={() => onComplete(task.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md disabled:opacity-60"><CheckCircle2 className="w-3.5 h-3.5" /> {busy ? 'Updating' : 'Mark complete'}</button> : null}</div></article>; }
function MeetingRow({ meeting, onJoin }: { meeting: any; onJoin: () => void }) { return <article className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p className="text-[11px] uppercase font-semibold tracking-wide text-slate-500">{meeting.status}</p><h3 className="mt-1 font-bold text-sm">{meeting.title}</h3><p className="mt-1 text-sm text-slate-500">{formatDateTime(meeting.starts_at)}{meeting.host_name ? ` · ${meeting.host_name}` : ''}</p>{meeting.notes && <p className="mt-2 text-sm text-slate-500">{meeting.notes}</p>}</div>{['upcoming', 'live'].includes(meeting.status) && <button type="button" onClick={onJoin} className="inline-flex justify-center items-center gap-2 px-3 py-2.5 rounded-md bg-slate-900 text-white text-xs font-semibold"><PlayCircle className="w-4 h-4" /> Join call<ExternalLink className="w-3.5 h-3.5" /></button>}</article>; }
