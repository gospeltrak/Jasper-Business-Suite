import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  ClipboardPlus,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import {
  AffiliateAgentWorkspace,
  createAffiliateMeeting,
  createAffiliateTask,
  loadAffiliateAgentWorkspace,
} from '../../utils/affiliateWorkspace';

type DeskTab = 'task' | 'meeting';

export default function AffiliateAgentDesk({ onLogout }: { onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<AffiliateAgentWorkspace | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState('');
  const [activeTab, setActiveTab] = useState<DeskTab>('task');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBody, setTaskBody] = useState('');
  const [taskType, setTaskType] = useState<'task' | 'note' | 'instruction'>('task');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingStartsAt, setMeetingStartsAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setState('loading');
    try {
      const next = await loadAffiliateAgentWorkspace();
      // Always show dashboard — new partners start with 0 affiliates
      setWorkspace(next ?? { agentName: 'Partner', affiliates: [], assignments: [] } as any);
      setSelectedAffiliateId((current) => current || next?.affiliates[0]?.id || '');
      setState('ready');
    } catch (error: any) {
      // Supabase unavailable — use localStorage session as fallback
      const saved = localStorage.getItem('jasper_logged_affiliate');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setWorkspace({ agentName: parsed.name || 'Partner', affiliates: [], assignments: [] } as any);
          setState('ready');
          return;
        } catch {}
      }
      setNotice(error?.message || 'Unable to load workspace.');
      setState('error');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const selectedAffiliate = useMemo(
    () => workspace?.affiliates.find((affiliate) => affiliate.id === selectedAffiliateId) || null,
    [workspace, selectedAffiliateId],
  );

  const requireTarget = () => {
    if (!selectedAffiliateId) {
      setNotice('Choose one of your assigned affiliates first.');
      return false;
    }
    return true;
  };

  const sendTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !requireTarget()) return;
    setSubmitting(true);
    try {
      await createAffiliateTask({
        affiliateId: selectedAffiliateId,
        senderName: workspace.agentName,
        title: taskTitle,
        body: taskBody,
        taskType,
        attachmentUrl,
        attachmentName,
      });
      setTaskTitle('');
      setTaskBody('');
      setAttachmentUrl('');
      setAttachmentName('');
      setNotice('Task sent to the selected affiliate workspace.');
    } catch (error: any) {
      setNotice(error?.message || 'Task could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleMeeting = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !requireTarget()) return;
    setSubmitting(true);
    try {
      await createAffiliateMeeting({
        affiliateId: selectedAffiliateId,
        hostName: workspace.agentName,
        title: meetingTitle,
        meetingUrl,
        startsAt: new Date(meetingStartsAt).toISOString(),
        notes: meetingNotes,
      });
      setMeetingTitle('');
      setMeetingUrl('');
      setMeetingStartsAt('');
      setMeetingNotes('');
      setNotice('Meeting link sent to the selected affiliate workspace.');
    } catch (error: any) {
      setNotice(error?.message || 'Meeting could not be scheduled.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return <div className="min-h-[70vh] grid place-items-center bg-slate-50"><LoaderCircle className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }

  if (state !== 'ready' || !workspace) {
    return (
      <main className="min-h-[70vh] grid place-items-center bg-slate-50 p-5">
        <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 text-center shadow-sm">
          <Users className="mx-auto h-9 w-9 text-emerald-600" />
          <h1 className="mt-3 text-lg font-black text-slate-950">{state === 'missing' ? 'No affiliate assignments' : 'Agent desk unavailable'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {state === 'missing'
              ? 'Your agent account has no active affiliates assigned in the database.'
              : notice || 'Unable to load this agent workspace.'}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button type="button" onClick={refresh} className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Retry</button>
            <button type="button" onClick={onLogout} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Partner Dashboard — Super Affiliate Agent</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{workspace.agentName}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {workspace.affiliates.length === 0
                  ? 'No affiliates yet — share your partner code to start recruiting'
                  : `${workspace.affiliates.length} assigned affiliate${workspace.affiliates.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" /> Refresh</button>
              <button type="button" onClick={onLogout} className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Sign out</button>
            </div>
          </div>
        </header>

        {notice && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</div>}

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">Assigned affiliates</h2>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="space-y-2">
              {workspace.affiliates.map((affiliate) => (
                <button
                  type="button"
                  key={affiliate.id}
                  onClick={() => setSelectedAffiliateId(affiliate.id)}
                  className={`w-full rounded-md border p-3 text-left transition ${affiliate.id === selectedAffiliateId ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <p className="text-sm font-bold text-slate-950">{affiliate.display_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{affiliate.referral_code} · {affiliate.status}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Sending to</p>
                  <h2 className="text-lg font-black text-slate-950">{selectedAffiliate?.display_name || 'Select affiliate'}</h2>
                </div>
                <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1">
                  <button type="button" onClick={() => setActiveTab('task')} className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-bold ${activeTab === 'task' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><ClipboardPlus className="h-4 w-4" /> Task</button>
                  <button type="button" onClick={() => setActiveTab('meeting')} className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-bold ${activeTab === 'meeting' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><Video className="h-4 w-4" /> Meeting</button>
                </div>
              </div>
            </div>

            {activeTab === 'task' ? (
              <form onSubmit={sendTask} className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Type<select value={taskType} onChange={(event) => setTaskType(event.target.value as any)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"><option value="task">Task</option><option value="note">Note</option><option value="instruction">Instruction</option></select></label>
                <label className="block text-sm font-semibold text-slate-700">Title<input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-semibold text-slate-700 xl:col-span-2">Message<textarea value={taskBody} onChange={(event) => setTaskBody(event.target.value)} rows={5} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-semibold text-slate-700">File URL<input type="url" value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-semibold text-slate-700">File name<input value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <div className="xl:col-span-2"><button disabled={submitting || !selectedAffiliateId} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"><Send className="h-4 w-4" /> {submitting ? 'Sending...' : 'Send to affiliate'}</button></div>
              </form>
            ) : (
              <form onSubmit={scheduleMeeting} className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Meeting title<input required value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-semibold text-slate-700">Date and time<input required type="datetime-local" value={meetingStartsAt} onChange={(event) => setMeetingStartsAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-semibold text-slate-700 xl:col-span-2">Meeting link<input required type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="Google Meet, Zoom, or Teams URL" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-semibold text-slate-700 xl:col-span-2">Notes<textarea value={meetingNotes} onChange={(event) => setMeetingNotes(event.target.value)} rows={5} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm" /></label>
                <div className="xl:col-span-2"><button disabled={submitting || !selectedAffiliateId} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"><CalendarPlus className="h-4 w-4" /> {submitting ? 'Scheduling...' : 'Send meeting link'}</button></div>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
