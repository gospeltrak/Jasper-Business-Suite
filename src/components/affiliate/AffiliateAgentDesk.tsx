import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarPlus, ClipboardPlus, LoaderCircle, RefreshCw, Users } from 'lucide-react';
import {
  AffiliateAgentWorkspace,
  createAffiliateMeeting,
  createAffiliateTask,
  loadAffiliateAgentWorkspace,
} from '../../utils/affiliateWorkspace';

export default function AffiliateAgentDesk({ onLogout }: { onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<AffiliateAgentWorkspace | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState('');
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
      setWorkspace(next);
      setSelectedAffiliateId((current) => current || next?.affiliates[0]?.id || '');
      setState(next?.affiliates.length ? 'ready' : 'missing');
    } catch (error: any) {
      setNotice(error?.message || 'Unable to load assigned affiliates.');
      setState('error');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
      await createAffiliateTask({ affiliateId: selectedAffiliateId, senderName: workspace.agentName, title: taskTitle, body: taskBody, taskType, attachmentUrl, attachmentName });
      setTaskTitle(''); setTaskBody(''); setAttachmentUrl(''); setAttachmentName('');
      setNotice('Task sent to the selected affiliate.');
    } catch (error: any) { setNotice(error?.message || 'Task could not be sent.'); } finally { setSubmitting(false); }
  };

  const scheduleMeeting = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace || !requireTarget()) return;
    setSubmitting(true);
    try {
      await createAffiliateMeeting({ affiliateId: selectedAffiliateId, hostName: workspace.agentName, title: meetingTitle, meetingUrl, startsAt: new Date(meetingStartsAt).toISOString(), notes: meetingNotes });
      setMeetingTitle(''); setMeetingUrl(''); setMeetingStartsAt(''); setMeetingNotes('');
      setNotice('Meeting link sent to the selected affiliate.');
    } catch (error: any) { setNotice(error?.message || 'Meeting could not be scheduled.'); } finally { setSubmitting(false); }
  };

  if (state === 'loading') return <div className="min-h-[68vh] grid place-items-center"><LoaderCircle className="w-6 h-6 text-slate-500 animate-spin" /></div>;
  if (state !== 'ready' || !workspace) return <main className="min-h-[68vh] grid place-items-center p-5 bg-slate-50"><section className="max-w-md w-full text-center bg-white border border-slate-200 rounded-lg p-7"><Users className="w-8 h-8 text-emerald-600 mx-auto" /><h1 className="mt-3 text-lg font-bold">No affiliate assignments</h1><p className="mt-2 text-sm leading-6 text-slate-500">Your agent account has no active affiliates assigned in the database. An administrator can assign affiliates before you send work or meetings.</p><div className="mt-5 flex justify-center gap-3"><button type="button" onClick={refresh} className="px-4 py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold">Retry</button><button type="button" onClick={onLogout} className="px-4 py-2.5 rounded-md border border-slate-300 text-sm font-semibold">Sign out</button></div></section></main>;

  return <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8"><div className="max-w-6xl mx-auto"><header className="flex justify-between items-start gap-4 mb-7"><div><p className="text-sm text-slate-500">Affiliate agent desk</p><h1 className="mt-1 text-2xl font-bold">{workspace.agentName}</h1></div><div className="flex gap-2"><button type="button" onClick={refresh} className="p-2.5 rounded-md border border-slate-300"><RefreshCw className="w-4 h-4" /></button><button type="button" onClick={onLogout} className="px-3 py-2 border border-slate-300 rounded-md text-sm font-semibold">Sign out</button></div></header>{notice && <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>}<div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-5"><aside className="bg-white border border-slate-200 rounded-lg p-4"><h2 className="font-bold">Assigned affiliates</h2><div className="mt-3 space-y-2">{workspace.affiliates.map((affiliate) => <button type="button" key={affiliate.id} onClick={() => setSelectedAffiliateId(affiliate.id)} className={`w-full p-3 rounded-md text-left border ${affiliate.id === selectedAffiliateId ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}><p className="text-sm font-semibold">{affiliate.display_name}</p><p className="mt-1 text-xs text-slate-500">{affiliate.referral_code} · {affiliate.status}</p></button>)}</div></aside><section className="grid xl:grid-cols-2 gap-5"><form onSubmit={sendTask} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"><div className="flex items-center gap-2"><ClipboardPlus className="w-5 h-5 text-emerald-600" /><h2 className="font-bold">Send task or note</h2></div><label className="block text-sm font-medium">Type<select value={taskType} onChange={(event) => setTaskType(event.target.value as any)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5"><option value="task">Task</option><option value="note">Note</option><option value="instruction">Instruction</option></select></label><label className="block text-sm font-medium">Title<input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><label className="block text-sm font-medium">Message<textarea value={taskBody} onChange={(event) => setTaskBody(event.target.value)} rows={4} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><label className="block text-sm font-medium">File URL <span className="text-slate-400 font-normal">(optional)</span><input type="url" value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="https://..." className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><label className="block text-sm font-medium">File name<input value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><button disabled={submitting} className="w-full py-2.5 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60">{submitting ? 'Sending...' : 'Send to affiliate'}</button></form><form onSubmit={scheduleMeeting} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"><div className="flex items-center gap-2"><CalendarPlus className="w-5 h-5 text-indigo-600" /><h2 className="font-bold">Schedule video meeting</h2></div><label className="block text-sm font-medium">Meeting title<input required value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><label className="block text-sm font-medium">Meeting link<input required type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="Google Meet or Zoom URL" className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><label className="block text-sm font-medium">Date and time<input required type="datetime-local" value={meetingStartsAt} onChange={(event) => setMeetingStartsAt(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><label className="block text-sm font-medium">Notes<textarea value={meetingNotes} onChange={(event) => setMeetingNotes(event.target.value)} rows={4} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5" /></label><button disabled={submitting} className="w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">{submitting ? 'Scheduling...' : 'Send meeting link'}</button></form></section></div></div></main>;
}
