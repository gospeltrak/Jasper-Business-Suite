import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Award, BarChart3, Bell,
  CalendarPlus, Check, CheckCircle, ChevronRight, ClipboardPlus,
  Coins, Copy, Edit2, ExternalLink, Eye, FileText, Globe,
  HardDrive, Landmark, LoaderCircle, MessageSquare, Monitor,
  Package, PhoneCall, Plus, RefreshCw, Send, Settings,
  Shield, ShieldCheck, Trash2, TrendingUp, Users, Video,
  Wallet, XCircle, Zap,
} from 'lucide-react';
import {
  AffiliateAgentWorkspace,
  createAffiliateMeeting,
  createAffiliateTask,
  loadAffiliateAgentWorkspace,
} from '../../utils/affiliateWorkspace';

type DashTab = 'overview' | 'reconciliation' | 'affiliates' | 'tutorials' | 'conferencing' | 'hw-pos' | 'hw-inventory';

const NAV_TABS: { id: DashTab; label: string; icon: any; desc: string }[] = [
  { id: 'overview',        label: 'Network Overview',       icon: BarChart3,    desc: 'Your team performance & earnings' },
  { id: 'reconciliation',  label: 'Monthly Reconciliation', icon: Coins,        desc: 'Earnings breakdown & payout history' },
  { id: 'affiliates',      label: 'Manage Sub-Affiliates',  icon: Users,        desc: 'Recruit, enable, disable your team' },
  { id: 'tutorials',       label: 'Tutorials & Lessons',    icon: FileText,     desc: 'Training materials for your team' },
  { id: 'conferencing',    label: 'Video Conferencing',     icon: Video,        desc: 'Schedule team & client calls' },
  { id: 'hw-pos',          label: 'Hardware POS',           icon: Monitor,      desc: 'POS hardware orders in your network' },
  { id: 'hw-inventory',    label: 'Hardware Inventory',     icon: HardDrive,    desc: 'Devices assigned through your network' },
];

function formatTZS(n: number) {
  return 'TZS ' + (n || 0).toLocaleString();
}

export default function AffiliateAgentDesk({ onLogout }: { onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<AffiliateAgentWorkspace | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Affiliate management state
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState('');
  const [editingAffiliate, setEditingAffiliate] = useState<any>(null);

  // Task/meeting state
  const [taskTab, setTaskTab] = useState<'task' | 'meeting'>('task');
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

  // Tutorial state
  const [tutorials, setTutorials] = useState<any[]>([]);

  // HW state
  const [hwOrders, setHwOrders] = useState<any[]>([]);
  const [hwInventory, setHwInventory] = useState<any[]>([]);

  // Reconciliation state
  const [payouts] = useState([
    { month: 'June 2026',  direct: 0, override: 0, total: 0, status: 'Pending' },
    { month: 'May 2026',   direct: 0, override: 0, total: 0, status: 'Paid' },
  ]);

  // Load partner name from localStorage as fallback
  const partnerName = useMemo(() => {
    try {
      const s = localStorage.getItem('jasper_logged_affiliate');
      if (s) return JSON.parse(s)?.name || workspace?.agentName || 'Partner';
    } catch {}
    return workspace?.agentName || 'Partner';
  }, [workspace]);

  const partnerCode = useMemo(() => {
    try {
      const s = localStorage.getItem('jasper_logged_affiliate');
      if (s) return JSON.parse(s)?.promoCode || '';
    } catch {}
    return '';
  }, []);

  const refresh = useCallback(async () => {
    setState('loading');
    try {
      const next = await loadAffiliateAgentWorkspace();
      setWorkspace(next ?? { agentName: partnerName, affiliates: [], assignments: [] } as any);
      if (next?.affiliates?.length) {
        setAffiliates(next.affiliates);
        setSelectedAffiliateId(next.affiliates[0]?.id || '');
      }
      setState('ready');
    } catch {
      // Fallback to localStorage affiliates
      try {
        const all = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
        const myCode = partnerCode.toUpperCase();
        const mine = myCode ? all.filter((a: any) => a.parentSuperId === myCode || a.parentSuperCode?.toUpperCase() === myCode) : all;
        setAffiliates(mine);
        setWorkspace({ agentName: partnerName, affiliates: mine, assignments: [] } as any);
        setState('ready');
      } catch {
        setState('error');
      }
    }
    // Load tutorials
    try {
      const t = JSON.parse(localStorage.getItem('saas_training_tutorials') || '[]');
      setTutorials(t);
    } catch {}
    // Load HW data
    try {
      const hw = JSON.parse(localStorage.getItem('saas_hw_orders') || '[]');
      setHwOrders(hw);
      const inv = JSON.parse(localStorage.getItem('saas_hw_inventory') || '[]');
      setHwInventory(inv);
    } catch {}
  }, [partnerName, partnerCode]);

  useEffect(() => { refresh(); }, [refresh]);

  // Also load affiliates from localStorage on mount
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
      if (all.length > 0 && affiliates.length === 0) {
        const myCode = partnerCode.toUpperCase();
        const mine = myCode ? all.filter((a: any) =>
          a.parentSuperId === myCode || a.parentSuperCode?.toUpperCase() === myCode || a.isSuper === false
        ) : all.filter((a: any) => a.isSuper === false);
        if (mine.length > 0) setAffiliates(mine);
      }
    } catch {}
  }, [partnerCode, affiliates.length]);

  // Stats
  const totalDirectEarnings = affiliates.reduce((s: number, a: any) => s + (a.totalEarnings || 0) * 0.15, 0);
  const totalOverrideEarnings = affiliates.reduce((s: number, a: any) => s + (a.totalEarnings || 0) * 0.05, 0);
  const totalNetwork = affiliates.length;
  const activeAffiliates = affiliates.filter((a: any) => !a.isDisabled).length;

  const handleToggleAffiliate = (aff: any) => {
    const updated = affiliates.map((a: any) =>
      a.id === aff.id ? { ...a, isDisabled: !a.isDisabled, status: a.isDisabled ? 'Active' : 'Disabled' } : a
    );
    setAffiliates(updated);
    // Persist
    try {
      const all = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
      const next = all.map((a: any) => a.id === aff.id ? { ...a, isDisabled: !aff.isDisabled, status: aff.isDisabled ? 'Active' : 'Disabled' } : a);
      localStorage.setItem('saas_immersive_affiliates', JSON.stringify(next));
    } catch {}
  };

  const handleDeleteAffiliate = (aff: any) => {
    if (!confirm(`Remove ${aff.name} from your network? This cannot be undone.`)) return;
    const updated = affiliates.filter((a: any) => a.id !== aff.id);
    setAffiliates(updated);
    try {
      const all = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
      localStorage.setItem('saas_immersive_affiliates', JSON.stringify(all.filter((a: any) => a.id !== aff.id)));
    } catch {}
  };

  const sendTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAffiliateId) { setNotice('Select an affiliate first.'); return; }
    setSubmitting(true);
    try {
      await createAffiliateTask({ affiliateId: selectedAffiliateId, senderName: partnerName, title: taskTitle, body: taskBody, taskType, attachmentUrl, attachmentName });
      setTaskTitle(''); setTaskBody(''); setAttachmentUrl(''); setAttachmentName('');
      setNotice('✅ Task sent to affiliate workspace.');
    } catch (e: any) {
      setNotice(e?.message || 'Task could not be sent.');
    } finally { setSubmitting(false); }
  };

  const scheduleMeeting = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAffiliateId) { setNotice('Select an affiliate first.'); return; }
    setSubmitting(true);
    try {
      await createAffiliateMeeting({ affiliateId: selectedAffiliateId, hostName: partnerName, title: meetingTitle, meetingUrl, startsAt: new Date(meetingStartsAt).toISOString(), notes: meetingNotes });
      setMeetingTitle(''); setMeetingUrl(''); setMeetingStartsAt(''); setMeetingNotes('');
      setNotice('✅ Meeting link sent to affiliate.');
    } catch (e: any) {
      setNotice(e?.message || 'Meeting could not be scheduled.');
    } finally { setSubmitting(false); }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <LoaderCircle className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
          <p className="text-slate-400 text-sm">Loading Partner Dashboard...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center max-w-sm w-full space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-white font-black text-lg">Connection Error</h2>
          <p className="text-slate-400 text-sm">{notice || 'Could not load partner workspace.'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={refresh} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold cursor-pointer border-none">Retry</button>
            <button onClick={onLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold cursor-pointer border-none">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* ── TOP HEADER ── */}
      <header style={{ background: 'linear-gradient(135deg,#0a0f1e,#0d1b2e)' }}
        className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 bg-slate-800 rounded-lg cursor-pointer border-none text-white">
            <Activity className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest font-mono">Partner Dashboard</p>
            <h1 className="text-sm font-black text-white leading-tight">{partnerName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {partnerCode && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-black font-mono text-amber-400 uppercase tracking-widest">
              <Zap className="w-3 h-3" /> {partnerCode}
            </span>
          )}
          <button onClick={refresh} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer border-none text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onLogout} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold cursor-pointer transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR NAV ── */}
        <aside className={`
          ${sidebarOpen ? 'block' : 'hidden'} md:block
          w-64 border-r border-slate-800 bg-slate-900/50 flex-shrink-0
          absolute md:relative z-10 h-full md:h-auto
        `}>
          <nav className="p-3 space-y-1">
            {NAV_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all cursor-pointer border-none ${active ? 'bg-amber-500/15 border border-amber-500/20 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-amber-400' : ''}`} />
                  <div>
                    <p className={`text-[11px] font-bold leading-tight ${active ? 'text-amber-300' : ''}`}>{tab.label}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 hidden lg:block">{tab.desc}</p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Partner code card */}
          {partnerCode && (
            <div className="m-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[9px] text-amber-400/70 uppercase font-bold tracking-wider mb-1">Your Partner Code</p>
              <p className="text-lg font-black text-amber-400 font-mono tracking-widest">{partnerCode}</p>
              <p className="text-[9px] text-slate-500 mt-1">Share this with affiliates you recruit</p>
            </div>
          )}
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {notice && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4 shrink-0" /> {notice}
              <button onClick={() => setNotice(null)} className="ml-auto text-slate-500 hover:text-white cursor-pointer border-none bg-transparent">✕</button>
            </div>
          )}

          {/* ══ OVERVIEW TAB ══ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Network Overview</h2>
                <p className="text-sm text-slate-400 mt-0.5">Your team's performance and total earnings</p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Affiliates',    value: totalNetwork,                        sub: `${activeAffiliates} active`,           color: 'text-white',         icon: <Users className="w-5 h-5" />,      bg: 'bg-slate-800' },
                  { label: 'Direct Earnings',     value: formatTZS(totalDirectEarnings),      sub: '15% on your referrals',                color: 'text-emerald-400',   icon: <Coins className="w-5 h-5" />,      bg: 'bg-emerald-500/10' },
                  { label: 'Override Earnings',   value: formatTZS(totalOverrideEarnings),    sub: '5% on team referrals',                 color: 'text-amber-400',     icon: <TrendingUp className="w-5 h-5" />, bg: 'bg-amber-500/10' },
                  { label: 'Total Network',       value: formatTZS(totalDirectEarnings + totalOverrideEarnings), sub: 'combined earnings', color: 'text-blue-400',   icon: <Award className="w-5 h-5" />,      bg: 'bg-blue-500/10' },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} border border-slate-800 rounded-2xl p-4 space-y-2`}>
                    <div className={`${k.color} opacity-70`}>{k.icon}</div>
                    <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
                      <p className="text-[9px] text-slate-500">{k.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Affiliate list summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-black text-white text-sm">Your Affiliates</h3>
                  <button onClick={() => setActiveTab('affiliates')} className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer border-none bg-transparent font-bold">
                    Manage all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {affiliates.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <Users className="w-8 h-8 text-slate-700 mx-auto" />
                    <p className="text-slate-500 text-sm font-semibold">No affiliates in your network yet</p>
                    <p className="text-slate-600 text-xs">Share your partner code <strong className="text-amber-400">{partnerCode}</strong> to start recruiting</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {affiliates.slice(0, 5).map((aff: any) => (
                      <div key={aff.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{aff.name || aff.display_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{aff.promoCode || aff.referral_code} · {aff.isDisabled ? 'Disabled' : 'Active'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-400">{formatTZS((aff.totalEarnings || 0) * 0.05)}</p>
                          <p className="text-[9px] text-slate-500">your 5% override</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ RECONCILIATION TAB ══ */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Monthly Reconciliation</h2>
                <p className="text-sm text-slate-400 mt-0.5">Earnings breakdown: 15% direct + 5% team override, paid last Friday of every month</p>
              </div>

              {/* Commission summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
                  <p className="text-[10px] text-emerald-400/70 uppercase font-bold tracking-wider">Direct (15%)</p>
                  <p className="text-2xl font-black text-emerald-400 mt-2">{formatTZS(totalDirectEarnings)}</p>
                  <p className="text-xs text-slate-400 mt-1">From your own referrals</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                  <p className="text-[10px] text-amber-400/70 uppercase font-bold tracking-wider">Override (5%)</p>
                  <p className="text-2xl font-black text-amber-400 mt-2">{formatTZS(totalOverrideEarnings)}</p>
                  <p className="text-xs text-slate-400 mt-1">From your team's referrals</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
                  <p className="text-[10px] text-blue-400/70 uppercase font-bold tracking-wider">Total Pending</p>
                  <p className="text-2xl font-black text-blue-400 mt-2">{formatTZS(totalDirectEarnings + totalOverrideEarnings)}</p>
                  <p className="text-xs text-slate-400 mt-1">Next payout: last Friday</p>
                </div>
              </div>

              {/* Payout history */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <h3 className="font-black text-white text-sm">Payout History</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/40">
                      <th className="py-3 px-5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider">Month</th>
                      <th className="py-3 px-5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider">Direct (15%)</th>
                      <th className="py-3 px-5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider">Override (5%)</th>
                      <th className="py-3 px-5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total</th>
                      <th className="py-3 px-5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map(p => (
                      <tr key={p.month} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-3 px-5 font-semibold text-white">{p.month}</td>
                        <td className="py-3 px-5 text-right text-emerald-400 font-mono">{formatTZS(p.direct)}</td>
                        <td className="py-3 px-5 text-right text-amber-400 font-mono">{formatTZS(p.override)}</td>
                        <td className="py-3 px-5 text-right font-black text-white font-mono">{formatTZS(p.total)}</td>
                        <td className="py-3 px-5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${p.status === 'Paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 text-[10px] text-slate-500">Payouts dispatched every last Friday of the month via mobile money</div>
              </div>
            </div>
          )}

          {/* ══ MANAGE AFFILIATES TAB ══ */}
          {activeTab === 'affiliates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white">Manage Sub-Affiliates</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{affiliates.length} affiliate{affiliates.length !== 1 ? 's' : ''} in your network</p>
                </div>
                <div className="flex items-center gap-2">
                  {partnerCode && (
                    <span className="text-[10px] text-slate-400 hidden sm:block">Your code: <strong className="text-amber-400 font-mono">{partnerCode}</strong></span>
                  )}
                </div>
              </div>

              {affiliates.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-4">
                  <Users className="w-12 h-12 text-slate-700 mx-auto" />
                  <div>
                    <p className="text-white font-black text-base">No affiliates yet</p>
                    <p className="text-slate-400 text-sm mt-1">Share your partner code to recruit affiliates</p>
                    {partnerCode && (
                      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-500/15 border border-amber-500/20 rounded-xl">
                        <span className="text-amber-400 font-black font-mono text-lg tracking-widest">{partnerCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {affiliates.map((aff: any) => (
                    <div key={aff.id} className={`bg-slate-900 border rounded-2xl overflow-hidden ${aff.isDisabled ? 'border-rose-900/50 opacity-75' : 'border-slate-800'}`}>
                      <div className="h-1" style={{ background: aff.isDisabled ? '#7f1d1d' : 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
                      <div className="p-4 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-black text-white text-sm">{aff.name || aff.display_name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{aff.phone || aff.email}</p>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full font-mono tracking-widest ${aff.isDisabled ? 'bg-slate-800 text-slate-500 line-through' : 'bg-amber-500/20 text-amber-400'}`}>
                            {aff.promoCode || aff.referral_code}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800 rounded-xl p-2.5">
                            <p className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Earnings</p>
                            <p className="text-sm font-black text-emerald-400 mt-0.5">{formatTZS(aff.totalEarnings || 0)}</p>
                          </div>
                          <div className="bg-slate-800 rounded-xl p-2.5">
                            <p className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Your 5%</p>
                            <p className="text-sm font-black text-amber-400 mt-0.5">{formatTZS((aff.totalEarnings || 0) * 0.05)}</p>
                          </div>
                        </div>

                        {aff.isDisabled && (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                            <XCircle className="w-3 h-3" /> Disabled
                          </span>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button onClick={() => { setSelectedAffiliateId(aff.id); setActiveTab('conferencing'); }}
                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 text-[10px] font-bold rounded-xl cursor-pointer border-none flex items-center justify-center gap-1 transition-colors">
                            <MessageSquare className="w-3 h-3" /> Message
                          </button>
                          <button onClick={() => handleToggleAffiliate(aff)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold cursor-pointer border transition-colors flex items-center gap-1 ${aff.isDisabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}>
                            {aff.isDisabled ? <><CheckCircle className="w-3 h-3" /> Enable</> : <><XCircle className="w-3 h-3" /> Disable</>}
                          </button>
                          <button onClick={() => handleDeleteAffiliate(aff)}
                            className="p-2 bg-slate-800 hover:bg-rose-500/10 text-rose-500 rounded-xl cursor-pointer border border-slate-700 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ TUTORIALS TAB ══ */}
          {activeTab === 'tutorials' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Tutorials & Lessons</h2>
                <p className="text-sm text-slate-400 mt-0.5">Training materials and instructions assigned to your team</p>
              </div>

              {/* Send task to affiliate */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ClipboardPlus className="w-4 h-4 text-amber-400" />
                  <h3 className="font-black text-white text-sm">Send Task / Instruction to Affiliate</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Select Affiliate</label>
                    <select value={selectedAffiliateId} onChange={e => setSelectedAffiliateId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 cursor-pointer">
                      <option value="">Choose affiliate...</option>
                      {affiliates.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.name || a.display_name} ({a.promoCode || a.referral_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Type</label>
                    <select value={taskType} onChange={e => setTaskType(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 cursor-pointer">
                      <option value="task">Task</option>
                      <option value="note">Note</option>
                      <option value="instruction">Instruction</option>
                    </select>
                  </div>
                </div>

                <form onSubmit={sendTask} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Title</label>
                    <input required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Complete your profile setup"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Message</label>
                    <textarea value={taskBody} onChange={e => setTaskBody(e.target.value)} rows={4} placeholder="Write your instructions here..."
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" />
                  </div>
                  <button type="submit" disabled={submitting || !selectedAffiliateId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl cursor-pointer border-none transition-colors">
                    <Send className="w-4 h-4" /> {submitting ? 'Sending...' : 'Send to Affiliate'}
                  </button>
                </form>
              </div>

              {/* Tutorials library */}
              {tutorials.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center space-y-3">
                  <FileText className="w-10 h-10 text-slate-700 mx-auto" />
                  <p className="text-slate-400 text-sm">No tutorials assigned yet</p>
                  <p className="text-slate-600 text-xs">Tutorials added by Super Admin will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tutorials.map((t: any) => (
                    <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{t.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{t.duration || 'Self-paced'}</p>
                        </div>
                      </div>
                      {t.url && (
                        <a href={t.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 font-bold">
                          <ExternalLink className="w-3.5 h-3.5" /> Open Tutorial
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ VIDEO CONFERENCING TAB ══ */}
          {activeTab === 'conferencing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Video Conferencing</h2>
                <p className="text-sm text-slate-400 mt-0.5">Schedule and host video calls with your team or clients</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Video className="w-4 h-4 text-amber-400" />
                  <h3 className="font-black text-white text-sm">Schedule a Meeting</h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Send to Affiliate</label>
                  <select value={selectedAffiliateId} onChange={e => setSelectedAffiliateId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 cursor-pointer">
                    <option value="">Choose affiliate...</option>
                    {affiliates.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name || a.display_name}</option>
                    ))}
                  </select>
                </div>

                <form onSubmit={scheduleMeeting} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Meeting Title</label>
                      <input required value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="e.g. Weekly Team Sync"
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date & Time</label>
                      <input required type="datetime-local" value={meetingStartsAt} onChange={e => setMeetingStartsAt(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Meeting Link (Google Meet / Zoom / Teams)</label>
                    <input required type="url" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..."
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Notes (optional)</label>
                    <textarea value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} rows={3} placeholder="Agenda, instructions..."
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" />
                  </div>
                  <button type="submit" disabled={submitting || !selectedAffiliateId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl cursor-pointer border-none transition-colors">
                    <CalendarPlus className="w-4 h-4" /> {submitting ? 'Scheduling...' : 'Send Meeting Link'}
                  </button>
                </form>
              </div>

              {/* Quick join links */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-black text-white text-sm mb-4">Quick Meeting Tools</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { name: 'Google Meet', url: 'https://meet.google.com/new', color: 'text-green-400' },
                    { name: 'Zoom',        url: 'https://zoom.us/start/videomeeting', color: 'text-blue-400' },
                    { name: 'Microsoft Teams', url: 'https://teams.microsoft.com', color: 'text-purple-400' },
                  ].map(tool => (
                    <a key={tool.name} href={tool.url} target="_blank" rel="noreferrer"
                      className={`flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold ${tool.color} transition-colors no-underline`}>
                      <Video className="w-4 h-4" /> {tool.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ HARDWARE POS TAB ══ */}
          {activeTab === 'hw-pos' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Hardware POS</h2>
                <p className="text-sm text-slate-400 mt-0.5">POS hardware orders linked to your partner network</p>
              </div>
              {hwOrders.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
                  <Monitor className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-white font-black">No Hardware POS Orders</p>
                  <p className="text-slate-400 text-sm">Hardware orders placed through your network will appear here</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/40">
                        <th className="py-3 px-5 text-left text-[9px] font-bold text-slate-400 uppercase">Order</th>
                        <th className="py-3 px-5 text-left text-[9px] font-bold text-slate-400 uppercase">Client</th>
                        <th className="py-3 px-5 text-left text-[9px] font-bold text-slate-400 uppercase">Device</th>
                        <th className="py-3 px-5 text-right text-[9px] font-bold text-slate-400 uppercase">Amount</th>
                        <th className="py-3 px-5 text-center text-[9px] font-bold text-slate-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hwOrders.map((o: any) => (
                        <tr key={o.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-3 px-5 font-mono text-[11px] text-slate-400">{o.id}</td>
                          <td className="py-3 px-5 font-semibold text-white">{o.client}</td>
                          <td className="py-3 px-5 text-slate-300">{o.device}</td>
                          <td className="py-3 px-5 text-right font-black text-emerald-400 font-mono">{formatTZS(o.amount)}</td>
                          <td className="py-3 px-5 text-center"><span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full text-[9px] font-bold">{o.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ HARDWARE INVENTORY TAB ══ */}
          {activeTab === 'hw-inventory' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Hardware Inventory</h2>
                <p className="text-sm text-slate-400 mt-0.5">Devices assigned through your partner network</p>
              </div>
              {hwInventory.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
                  <HardDrive className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-white font-black">No Inventory Items</p>
                  <p className="text-slate-400 text-sm">Hardware devices assigned through your network will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {hwInventory.map((item: any) => (
                    <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                          <HardDrive className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{item.serial}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{item.assignedTo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${item.status === 'Active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
