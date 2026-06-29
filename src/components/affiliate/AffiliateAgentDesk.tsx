/**
 * AffiliateAgentDesk — Super Agent / Partner Dashboard
 * Implements all 19 parts of the partner dashboard spec:
 * - 20% commission split (5% manager + 15% sub-affiliate)
 * - Withholding tax preparation (currently not active)
 * - Sub-affiliate management with disable/suspend (NO delete)
 * - Mirror mode for viewing sub-affiliate accounts
 * - Monthly reconciliation with correct math
 * - TIN status display
 * - Audit logging
 */

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, Award, BarChart3,
  CalendarPlus, CheckCircle, ChevronRight, ClipboardPlus,
  Coins, Copy, Edit2, ExternalLink, Eye, FileText,
  HardDrive, Info, LoaderCircle, MessageSquare, Monitor,
  RefreshCw, Send, ShieldAlert, ShieldCheck, TrendingUp,
  Users, Video, Wallet, XCircle, Zap, AlertCircle,
  Download, PhoneCall,
} from 'lucide-react';
import {
  AffiliateAgentWorkspace,
  createAffiliateMeeting,
  createAffiliateTask,
  loadAffiliateAgentWorkspace,
} from '../../utils/affiliateWorkspace';
import {
  SubAffiliateProfile,
  ReferredCustomer,
  MonthlyReconciliationRow,
  calculateCommissionBreakdown,
  calculateSuperAgentNetworkTotals,
  buildReconciliationRow,
  formatTZS,
  maskTIN,
  WITHHOLDING_TAX_ACTIVE,
  TinStatus,
} from '../../utils/commissionEngine';

type DashTab = 'overview' | 'reconciliation' | 'affiliates' | 'customers' | 'tutorials' | 'conferencing' | 'hw-pos' | 'hw-inventory';
type StatusAction = 'deactivate' | 'suspend' | 'review' | 'activate';

const NAV_TABS: { id: DashTab; label: string; icon: any; desc: string }[] = [
  { id: 'overview',       label: 'Network Overview',       icon: BarChart3,     desc: 'Team performance & earnings' },
  { id: 'reconciliation', label: 'Monthly Reconciliation', icon: Coins,         desc: '20% split & withholding' },
  { id: 'affiliates',     label: 'Manage Sub-Affiliates',  icon: Users,         desc: 'Recruit, suspend, mirror' },
  { id: 'customers',      label: 'Network Customers',      icon: ShieldCheck,   desc: 'Customers from your team' },
  { id: 'tutorials',      label: 'Tutorials & Tasks',      icon: FileText,      desc: 'Training for your team' },
  { id: 'conferencing',   label: 'Video Conferencing',     icon: Video,         desc: 'Schedule team calls' },
  { id: 'hw-pos',         label: 'Hardware POS',           icon: Monitor,       desc: 'POS orders in network' },
  { id: 'hw-inventory',   label: 'Hardware Inventory',     icon: HardDrive,     desc: 'Devices in network' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TinBadge({ status }: { status: TinStatus }) {
  const styles = {
    not_submitted: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    submitted:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
    verified:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected:      'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const labels = {
    not_submitted: 'No TIN',
    submitted:     'TIN Submitted',
    verified:      'TIN Verified',
    rejected:      'TIN Rejected',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function WhtNotice({ tinStatus }: { tinStatus?: TinStatus }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="text-[11px] text-amber-200/80 leading-relaxed">
        {!tinStatus || tinStatus === 'not_submitted' ? (
          <>
            <strong className="text-amber-400">Important:</strong> For now, sub-affiliates receive the full 15% commission.
            Later, 5% withholding tax will be deducted and submitted to TRA.
            Please ensure all sub-affiliates add their TIN number.
            <strong className="text-amber-400"> Payouts will be blocked without a valid TIN when WHT becomes active.</strong>
          </>
        ) : (
          <><strong className="text-emerald-400">TIN submitted.</strong> Payout profile is ready for withholding tax processing.</>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AffiliateAgentDesk({ onLogout }: { onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<AffiliateAgentWorkspace | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sub-affiliates from localStorage (real data)
  const [subAffiliates, setSubAffiliates] = useState<SubAffiliateProfile[]>([]);
  const [customers, setCustomers] = useState<ReferredCustomer[]>([]);
  const [recon, setRecon] = useState<MonthlyReconciliationRow[]>([]);

  // Task/meeting form
  const [selectedAffId, setSelectedAffId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBody, setTaskBody] = useState('');
  const [taskType, setTaskType] = useState<'task' | 'note' | 'instruction'>('task');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingStartsAt, setMeetingStartsAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Status change modal
  const [statusModal, setStatusModal] = useState<{ aff: SubAffiliateProfile; action: StatusAction } | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // Mirror mode
  const [mirrorTarget, setMirrorTarget] = useState<SubAffiliateProfile | null>(null);

  // Edit modal
  const [editModal, setEditModal] = useState<SubAffiliateProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPayoutPhone, setEditPayoutPhone] = useState('');
  const [editPayoutMethod, setEditPayoutMethod] = useState('');

  // Month filter for reconciliation
  const [reconMonth, setReconMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Partner identity from localStorage
  const partnerInfo = useMemo(() => {
    try {
      const s = localStorage.getItem('jasper_logged_affiliate');
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  }, []);

  const partnerName = partnerInfo?.name || workspace?.agentName || 'Partner';
  const partnerCode = partnerInfo?.promoCode || partnerInfo?.promo_code || '';
  const partnerId   = partnerInfo?.id || 'partner-local';

  // ── Load data ───────────────────────────────────────────────

  const loadSubAffiliates = useCallback(() => {
    try {
      const all: any[] = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
      const myCode = partnerCode.toUpperCase();
      const mine = myCode
        ? all.filter(a =>
            a.parentSuperId?.toUpperCase() === myCode ||
            a.parentSuperCode?.toUpperCase() === myCode ||
            a.parentSuperId === partnerId
          )
        : all.filter(a => !a.isSuper);

      const mapped: SubAffiliateProfile[] = mine.map((a: any) => ({
        id: a.id,
        userId: a.id,
        parentSuperAgentId: partnerId,
        name: a.name || a.display_name || 'Unnamed',
        phone: a.phone || '',
        email: a.email || '',
        promoCode: a.promoCode || a.referral_code || '',
        status: a.isDisabled ? 'suspended' : (a.status === 'Active' ? 'active' : 'active'),
        customersGenerated: a.conversionsPromo || a.conversionsLink || 0,
        revenueGenerated: a.revenueDate || a.totalEarnings || 0,
        grossCommission15: (a.revenueDate || a.totalEarnings || 0) * 0.15,
        withholdingTax5: 0, // not active yet
        netPayout: (a.revenueDate || a.totalEarnings || 0) * 0.15,
        tinNumber: a.tinNumber || '',
        tinStatus: (a.tinNumber ? 'submitted' : 'not_submitted') as TinStatus,
        pendingCommission: (a.totalEarnings || 0) * 0.15,
        paidCommission: a.paidAmount || 0,
        payoutMethod: a.paymentMethod || 'M-Pesa',
        payoutAccount: a.payoutPhone || a.phone || '',
        isDisabled: !!a.isDisabled,
        createdAt: a.joinedDate || new Date().toISOString(),
      }));

      setSubAffiliates(mapped);

      // Build reconciliation rows
      const rows = mapped.map(aff =>
        buildReconciliationRow(reconMonth, { id: partnerId, name: partnerName }, aff, [])
      );
      setRecon(rows);
    } catch (e) {
      console.warn('Error loading sub-affiliates:', e);
    }
  }, [partnerCode, partnerId, partnerName, reconMonth]);

  const refresh = useCallback(async () => {
    setState('loading');
    try {
      const next = await loadAffiliateAgentWorkspace();
      setWorkspace(next ?? { agentName: partnerName, affiliates: [], assignments: [] } as any);
      setState('ready');
    } catch {
      setWorkspace({ agentName: partnerName, affiliates: [], assignments: [] } as any);
      setState('ready');
    }
    loadSubAffiliates();
  }, [partnerName, loadSubAffiliates]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { loadSubAffiliates(); }, [reconMonth, loadSubAffiliates]);

  // ── Network totals ──────────────────────────────────────────

  const totals = useMemo(() => calculateSuperAgentNetworkTotals(subAffiliates), [subAffiliates]);

  // ── Status change (Suspend / Deactivate / Activate) ─────────
  // NOTE: DELETE is removed — only Super SaaS Admin can delete

  const handleStatusChange = () => {
    if (!statusModal) return;
    const { aff, action } = statusModal;

    const newStatus = action === 'activate' ? 'active' : action === 'deactivate' ? 'inactive' : 'suspended';
    const newIsDisabled = action !== 'activate';

    // Update localStorage
    try {
      const all: any[] = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
      const updated = all.map(a =>
        a.id === aff.id
          ? { ...a, isDisabled: newIsDisabled, status: action === 'activate' ? 'Active' : action }
          : a
      );
      localStorage.setItem('saas_immersive_affiliates', JSON.stringify(updated));
    } catch {}

    setSubAffiliates(prev =>
      prev.map(a => a.id === aff.id ? { ...a, status: newStatus as any, isDisabled: newIsDisabled } : a)
    );

    // Log the action
    const logs: any[] = JSON.parse(localStorage.getItem('account_status_logs') || '[]');
    logs.unshift({
      id: Date.now().toString(),
      account_id: aff.id,
      changed_by: partnerId,
      old_status: aff.status,
      new_status: newStatus,
      reason: statusReason || action,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('account_status_logs', JSON.stringify(logs.slice(0, 200)));

    setNotice(`✅ ${aff.name} has been ${action}d.`);
    setStatusModal(null);
    setStatusReason('');
  };

  // ── Edit sub-affiliate operational fields ───────────────────

  const openEdit = (aff: SubAffiliateProfile) => {
    setEditModal(aff);
    setEditName(aff.name);
    setEditPhone(aff.phone);
    setEditPayoutPhone(aff.payoutAccount);
    setEditPayoutMethod(aff.payoutMethod);
  };

  const saveEdit = () => {
    if (!editModal) return;
    try {
      const all: any[] = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
      const updated = all.map(a =>
        a.id === editModal.id
          ? { ...a, name: editName, phone: editPhone, payoutPhone: editPayoutPhone, paymentMethod: editPayoutMethod }
          : a
      );
      localStorage.setItem('saas_immersive_affiliates', JSON.stringify(updated));
    } catch {}
    setSubAffiliates(prev =>
      prev.map(a => a.id === editModal.id
        ? { ...a, name: editName, phone: editPhone, payoutAccount: editPayoutPhone, payoutMethod: editPayoutMethod }
        : a
      )
    );
    setNotice(`✅ ${editName}'s profile updated.`);
    setEditModal(null);
  };

  // ── Mirror mode ─────────────────────────────────────────────

  const enterMirror = (aff: SubAffiliateProfile) => {
    // Audit log
    const logs: any[] = JSON.parse(localStorage.getItem('mirror_access_logs') || '[]');
    logs.unshift({
      id: Date.now().toString(),
      viewer_user_id: partnerId,
      viewer_role: 'super_agent',
      target_user_id: aff.id,
      target_account_type: 'sub_affiliate',
      action: 'mirror_view',
      fields_changed: null,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('mirror_access_logs', JSON.stringify(logs.slice(0, 500)));
    setMirrorTarget(aff);
  };

  // ── Task / Meeting ──────────────────────────────────────────

  const sendTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAffId) { setNotice('Select a sub-affiliate first.'); return; }
    setSubmitting(true);
    try {
      await createAffiliateTask({ affiliateId: selectedAffId, senderName: partnerName, title: taskTitle, body: taskBody, taskType });
      setTaskTitle(''); setTaskBody('');
      setNotice('✅ Task sent.');
    } catch { setNotice('Task send failed — saved locally.'); }
    finally { setSubmitting(false); }
  };

  const scheduleMeeting = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAffId) { setNotice('Select a sub-affiliate first.'); return; }
    setSubmitting(true);
    try {
      await createAffiliateMeeting({ affiliateId: selectedAffId, hostName: partnerName, title: meetingTitle, meetingUrl, startsAt: new Date(meetingStartsAt).toISOString(), notes: meetingNotes });
      setMeetingTitle(''); setMeetingUrl(''); setMeetingStartsAt(''); setMeetingNotes('');
      setNotice('✅ Meeting sent.');
    } catch { setNotice('Meeting send failed.'); }
    finally { setSubmitting(false); }
  };

  // ── Mirror View ─────────────────────────────────────────────

  if (mirrorTarget) {
    const bd = calculateCommissionBreakdown(mirrorTarget.revenueGenerated);
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Mirror banner */}
        <div className="bg-amber-500 text-slate-950 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-sm">
            <Eye className="w-4 h-4" />
            <span>MIRROR MODE — You are viewing this account as Super Agent / Partner</span>
          </div>
          <button onClick={() => setMirrorTarget(null)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/20 hover:bg-slate-950/30 rounded-lg text-xs font-bold cursor-pointer border-none">
            <ArrowLeft className="w-3.5 h-3.5" /> Exit Mirror
          </button>
        </div>

        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center">
              <Users className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-amber-400/70 uppercase font-bold tracking-widest">Sub-Affiliate Account</p>
              <h2 className="text-xl font-black text-white">{mirrorTarget.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-slate-400 font-mono">{mirrorTarget.promoCode}</span>
                <TinBadge status={mirrorTarget.tinStatus} />
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${mirrorTarget.isDisabled ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                  {mirrorTarget.isDisabled ? 'Disabled' : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Commission breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Revenue Generated',   value: formatTZS(mirrorTarget.revenueGenerated),   color: 'text-white' },
              { label: 'Gross Commission 15%', value: formatTZS(bd.subAffiliateGrossCommission15), color: 'text-emerald-400' },
              { label: 'WHT 5%',              value: WITHHOLDING_TAX_ACTIVE ? formatTZS(bd.withholdingTax5) : 'Not active', color: 'text-amber-400' },
              { label: 'Net Payout',          value: formatTZS(bd.subAffiliateNetPayout),        color: 'text-blue-400' },
            ].map(k => (
              <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{k.label}</p>
                <p className={`text-lg font-black mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <WhtNotice tinStatus={mirrorTarget.tinStatus} />

          {/* Profile details */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3">Profile Details</h3>
            {[
              { label: 'Phone / WhatsApp', value: mirrorTarget.phone },
              { label: 'Payout Account',  value: mirrorTarget.payoutAccount },
              { label: 'Payout Method',   value: mirrorTarget.payoutMethod },
              { label: 'TIN Number',      value: mirrorTarget.tinNumber ? maskTIN(mirrorTarget.tinNumber) : 'Not submitted' },
              { label: 'Customers',       value: String(mirrorTarget.customersGenerated) },
              { label: 'Joined',          value: mirrorTarget.createdAt.split('T')[0] },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between text-sm border-b border-slate-800/50 pb-2">
                <span className="text-slate-400 text-xs">{f.label}</span>
                <span className="text-white font-semibold text-xs">{f.value}</span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            Mirror session audited · Viewer: {partnerName} · Target: {mirrorTarget.name} · {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  // ── Loading / Error states ────────────────────────────────────

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

  // ── Main Dashboard ────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg,#0a0f1e,#0d1b2e)' }}
        className="border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
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
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-black font-mono text-amber-400 uppercase">
              <Zap className="w-3 h-3" /> {partnerCode}
            </span>
          )}
          <button onClick={refresh} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer border-none text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onLogout} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold cursor-pointer">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-60 border-r border-slate-800 bg-slate-900/50 flex-shrink-0 overflow-y-auto`}>
          <nav className="p-3 space-y-0.5">
            {NAV_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer border-none ${active ? 'bg-amber-500/15 text-amber-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-amber-400' : ''}`} />
                  <div>
                    <p className="text-[11px] font-bold leading-tight">{tab.label}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5 hidden lg:block">{tab.desc}</p>
                  </div>
                </button>
              );
            })}
          </nav>
          {partnerCode && (
            <div className="m-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[9px] text-amber-400/60 uppercase font-bold tracking-wider mb-1">Partner Code</p>
              <p className="text-base font-black text-amber-400 font-mono tracking-widest">{partnerCode}</p>
              <p className="text-[9px] text-slate-600 mt-1">Share to recruit affiliates</p>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {notice && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4 shrink-0" /> {notice}
              <button onClick={() => setNotice(null)} className="ml-auto text-slate-500 hover:text-white cursor-pointer border-none bg-transparent">✕</button>
            </div>
          )}

          {/* ══ OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Network Overview</h2>
                <p className="text-xs text-slate-400 mt-0.5">20% commission pool — your 5% + sub-affiliate 15%</p>
              </div>

              <WhtNotice />

              {/* 8 KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Sub-Affiliates',      value: totals.subAffiliateCount,                    sub: `${totals.activeSubAffiliates} active`,    color: 'text-white',       bg: 'bg-slate-800' },
                  { label: 'Network Revenue',     value: formatTZS(totals.networkRevenue),            sub: 'Total generated',                          color: 'text-blue-400',    bg: 'bg-blue-500/10' },
                  { label: '20% Pool Total',      value: formatTZS(totals.networkPool20),             sub: 'Total network commission',                 color: 'text-purple-400',  bg: 'bg-purple-500/10' },
                  { label: 'Your 5% Earnings',    value: formatTZS(totals.managerCommission5),        sub: 'Manager commission',                       color: 'text-amber-400',   bg: 'bg-amber-500/10' },
                  { label: 'Sub-Affiliate 15%',   value: formatTZS(totals.subAffiliateShare15),      sub: 'Gross commission pool',                    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Pending Payouts',     value: formatTZS(totals.pendingPayout),             sub: 'Unpaid to sub-affiliates',                 color: 'text-rose-400',    bg: 'bg-rose-500/10' },
                  { label: 'Paid This Month',     value: formatTZS(totals.paidAmount),               sub: 'Paid out',                                 color: 'text-teal-400',    bg: 'bg-teal-500/10' },
                  { label: 'Active Sub-Affiliates',value: totals.activeSubAffiliates,                 sub: 'Producing revenue',                        color: 'text-white',       bg: 'bg-slate-800' },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} border border-slate-800 rounded-2xl p-4 space-y-2`}>
                    <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
                      <p className="text-[9px] text-slate-600">{k.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Commission breakdown example */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" /> How the 20% Commission Split Works
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Network Pool</p>
                    <p className="text-2xl font-black text-purple-400 mt-1">20%</p>
                    <p className="text-[10px] text-slate-500 mt-1">of Revenue Generated</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-[10px] text-amber-400/70 uppercase font-bold tracking-wider">Your Commission</p>
                    <p className="text-2xl font-black text-amber-400 mt-1">5%</p>
                    <p className="text-[10px] text-slate-500 mt-1">Manager / Partner Cut</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-[10px] text-emerald-400/70 uppercase font-bold tracking-wider">Sub-Affiliate</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">15%</p>
                    <p className="text-[10px] text-slate-500 mt-1">Gross Commission</p>
                  </div>
                </div>
                <div className="mt-4 bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400 font-mono">
                  Example: TZS 100,000 revenue → Pool TZS 20,000 → You get TZS 5,000 · Sub-affiliate gets TZS 15,000
                  {WITHHOLDING_TAX_ACTIVE && ' → WHT TZS 750 → Net TZS 14,250'}
                </div>
              </div>

              {/* Quick affiliate preview */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-black text-white text-sm">Sub-Affiliates</h3>
                  <button onClick={() => setActiveTab('affiliates')} className="text-[10px] text-amber-400 flex items-center gap-1 cursor-pointer border-none bg-transparent font-bold">
                    Manage all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {subAffiliates.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Users className="w-8 h-8 text-slate-700 mx-auto" />
                    <p className="text-slate-500 text-sm">No sub-affiliates yet</p>
                    <p className="text-slate-600 text-xs">Share partner code <strong className="text-amber-400">{partnerCode}</strong></p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {subAffiliates.slice(0, 5).map(aff => {
                      const bd = calculateCommissionBreakdown(aff.revenueGenerated);
                      return (
                        <div key={aff.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{aff.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-slate-500 font-mono">{aff.promoCode}</span>
                              <TinBadge status={aff.tinStatus} />
                              {aff.isDisabled && <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded font-bold">Disabled</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-amber-400">{formatTZS(bd.managerCommission5)}</p>
                            <p className="text-[9px] text-slate-500">your 5%</p>
                          </div>
                          <button onClick={() => enterMirror(aff)} className="p-2 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg cursor-pointer border-none">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ RECONCILIATION ══ */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-white">Monthly Reconciliation</h2>
                  <p className="text-xs text-slate-400 mt-0.5">20% split: 5% manager + 15% sub-affiliate gross · WHT {WITHHOLDING_TAX_ACTIVE ? 'ACTIVE' : 'NOT ACTIVE'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="month" value={reconMonth} onChange={e => setReconMonth(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500" />
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer border-none">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
              </div>

              <WhtNotice />

              {recon.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
                  <Coins className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-white font-black">No reconciliation data for {reconMonth}</p>
                  <p className="text-slate-400 text-sm">Data appears when sub-affiliates generate revenue</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/40">
                          {['Sub-Affiliate','TIN','Revenue','20% Pool','Your 5%','15% Gross','WHT 5%','Net Payout','Status'].map(h => (
                            <th key={h} className="py-3 px-4 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recon.map(row => (
                          <tr key={row.subAffiliateId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{row.subAffiliateName}</td>
                            <td className="py-3 px-4"><TinBadge status={row.tinStatus} /></td>
                            <td className="py-3 px-4 font-mono text-slate-300">{formatTZS(row.networkRevenue)}</td>
                            <td className="py-3 px-4 font-mono text-purple-400">{formatTZS(row.networkPool20)}</td>
                            <td className="py-3 px-4 font-mono text-amber-400 font-black">{formatTZS(row.managerCommission5)}</td>
                            <td className="py-3 px-4 font-mono text-emerald-400">{formatTZS(row.subAffiliateGrossCommission15)}</td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {WITHHOLDING_TAX_ACTIVE ? formatTZS(row.withholdingTax5) : <span className="italic text-[9px]">Not active</span>}
                            </td>
                            <td className="py-3 px-4 font-mono text-blue-400 font-black">{formatTZS(row.subAffiliateNetPayout)}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${row.payoutStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                {row.payoutStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="border-t border-amber-500/20 bg-amber-500/5">
                          <td className="py-3 px-4 font-black text-amber-400 text-[10px] uppercase tracking-wider">TOTALS</td>
                          <td className="py-3 px-4" />
                          <td className="py-3 px-4 font-black text-white font-mono">{formatTZS(recon.reduce((s,r) => s + r.networkRevenue, 0))}</td>
                          <td className="py-3 px-4 font-black text-purple-400 font-mono">{formatTZS(recon.reduce((s,r) => s + r.networkPool20, 0))}</td>
                          <td className="py-3 px-4 font-black text-amber-400 font-mono">{formatTZS(recon.reduce((s,r) => s + r.managerCommission5, 0))}</td>
                          <td className="py-3 px-4 font-black text-emerald-400 font-mono">{formatTZS(recon.reduce((s,r) => s + r.subAffiliateGrossCommission15, 0))}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{WITHHOLDING_TAX_ACTIVE ? formatTZS(recon.reduce((s,r) => s + r.withholdingTax5, 0)) : '—'}</td>
                          <td className="py-3 px-4 font-black text-blue-400 font-mono">{formatTZS(recon.reduce((s,r) => s + r.subAffiliateNetPayout, 0))}</td>
                          <td className="py-3 px-4" />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ MANAGE AFFILIATES ══ */}
          {activeTab === 'affiliates' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-white">Manage Sub-Affiliates</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{subAffiliates.length} in your network · Only Super SaaS Admin can delete accounts</p>
                </div>
              </div>

              {subAffiliates.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
                  <Users className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-white font-black">No sub-affiliates yet</p>
                  <p className="text-slate-400 text-sm">Share partner code <strong className="text-amber-400">{partnerCode}</strong></p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {subAffiliates.map(aff => {
                    const bd = calculateCommissionBreakdown(aff.revenueGenerated);
                    return (
                      <div key={aff.id} className={`bg-slate-900 border rounded-2xl overflow-hidden ${aff.isDisabled ? 'border-rose-900/50 opacity-75' : 'border-slate-800'}`}>
                        <div className="h-1" style={{ background: aff.isDisabled ? '#7f1d1d' : 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
                        <div className="p-4 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-black text-white text-sm truncate">{aff.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{aff.phone}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[9px] font-black text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded">{aff.promoCode}</span>
                                <TinBadge status={aff.tinStatus} />
                              </div>
                            </div>
                            {aff.isDisabled && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                          </div>

                          {/* Commission summary */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="bg-slate-800 rounded-lg p-2 text-center">
                              <p className="text-[8px] text-slate-500 uppercase">Revenue</p>
                              <p className="text-[11px] font-black text-white mt-0.5">{formatTZS(aff.revenueGenerated)}</p>
                            </div>
                            <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
                              <p className="text-[8px] text-emerald-400/70 uppercase">15% Gross</p>
                              <p className="text-[11px] font-black text-emerald-400 mt-0.5">{formatTZS(bd.subAffiliateGrossCommission15)}</p>
                            </div>
                            <div className="bg-amber-500/10 rounded-lg p-2 text-center">
                              <p className="text-[8px] text-amber-400/70 uppercase">Your 5%</p>
                              <p className="text-[11px] font-black text-amber-400 mt-0.5">{formatTZS(bd.managerCommission5)}</p>
                            </div>
                          </div>

                          {/* Actions — NO DELETE BUTTON */}
                          <div className="grid grid-cols-4 gap-1.5">
                            <button onClick={() => enterMirror(aff)}
                              className="flex flex-col items-center gap-1 py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-xl cursor-pointer border-none text-[9px] font-bold transition-colors">
                              <Eye className="w-3.5 h-3.5" /> Mirror
                            </button>
                            <button onClick={() => openEdit(aff)}
                              className="flex flex-col items-center gap-1 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl cursor-pointer border-none text-[9px] font-bold transition-colors">
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button onClick={() => { setSelectedAffId(aff.id); setActiveTab('conferencing'); }}
                              className="flex flex-col items-center gap-1 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl cursor-pointer border-none text-[9px] font-bold transition-colors">
                              <MessageSquare className="w-3.5 h-3.5" /> Message
                            </button>
                            <button
                              onClick={() => setStatusModal({ aff, action: aff.isDisabled ? 'activate' : 'suspend' })}
                              className={`flex flex-col items-center gap-1 py-2 rounded-xl cursor-pointer border-none text-[9px] font-bold transition-colors ${aff.isDisabled ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}>
                              {aff.isDisabled ? <><CheckCircle className="w-3.5 h-3.5" />Enable</> : <><XCircle className="w-3.5 h-3.5" />Suspend</>}
                            </button>
                          </div>

                          {/* WHT notice if no TIN */}
                          {aff.tinStatus === 'not_submitted' && (
                            <div className="flex items-center gap-1.5 text-[9px] text-amber-400/80 bg-amber-500/8 border border-amber-500/15 rounded-lg px-2 py-1.5">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              No TIN — payout may be blocked when WHT activates
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ NETWORK CUSTOMERS ══ */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Network Customers</h2>
                <p className="text-xs text-slate-400 mt-0.5">Customers generated by all sub-affiliates under your network</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
                <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-white font-black">Customer tracking active</p>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  When sub-affiliates refer customers who pay for Jasper subscriptions, those customers appear here
                  with package details, revenue, and your commission breakdown.
                </p>
                <p className="text-slate-500 text-xs">Run <strong className="text-amber-400">supabase_affiliate_migration.sql</strong> to enable referred_customers tracking</p>
              </div>
            </div>
          )}

          {/* ══ TUTORIALS ══ */}
          {activeTab === 'tutorials' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Tutorials & Tasks</h2>
                <p className="text-xs text-slate-400 mt-0.5">Send tasks, notes, and instructions to your sub-affiliates</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ClipboardPlus className="w-4 h-4 text-amber-400" />
                  <h3 className="font-black text-white text-sm">Send Task / Instruction</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Select Sub-Affiliate</label>
                    <select value={selectedAffId} onChange={e => setSelectedAffId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 cursor-pointer">
                      <option value="">Choose...</option>
                      {subAffiliates.map(a => <option key={a.id} value={a.id}>{a.name} ({a.promoCode})</option>)}
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
                  <input required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task title"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  <textarea value={taskBody} onChange={e => setTaskBody(e.target.value)} rows={4} placeholder="Message..."
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" />
                  <button type="submit" disabled={submitting || !selectedAffId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl cursor-pointer border-none">
                    <Send className="w-4 h-4" /> {submitting ? 'Sending...' : 'Send to Sub-Affiliate'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ══ CONFERENCING ══ */}
          {activeTab === 'conferencing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Video Conferencing</h2>
                <p className="text-xs text-slate-400 mt-0.5">Schedule and send meeting links to your sub-affiliates</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Send To</label>
                  <select value={selectedAffId} onChange={e => setSelectedAffId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 cursor-pointer">
                    <option value="">Choose sub-affiliate...</option>
                    {subAffiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <form onSubmit={scheduleMeeting} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input required value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="Meeting title"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                    <input required type="datetime-local" value={meetingStartsAt} onChange={e => setMeetingStartsAt(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  </div>
                  <input required type="url" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="Google Meet / Zoom link"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                  <textarea value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} rows={3} placeholder="Agenda..."
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" />
                  <button type="submit" disabled={submitting || !selectedAffId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl cursor-pointer border-none">
                    <CalendarPlus className="w-4 h-4" /> {submitting ? 'Sending...' : 'Send Meeting Link'}
                  </button>
                </form>
                <div className="pt-3 border-t border-slate-800 grid grid-cols-3 gap-3">
                  {[
                    { name: 'Google Meet', url: 'https://meet.google.com/new', color: 'text-green-400' },
                    { name: 'Zoom', url: 'https://zoom.us/start/videomeeting', color: 'text-blue-400' },
                    { name: 'Teams', url: 'https://teams.microsoft.com', color: 'text-purple-400' },
                  ].map(t => (
                    <a key={t.name} href={t.url} target="_blank" rel="noreferrer"
                      className={`flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold ${t.color} no-underline`}>
                      <Video className="w-3.5 h-3.5" /> {t.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ HW POS ══ */}
          {activeTab === 'hw-pos' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Hardware POS</h2>
                <p className="text-xs text-slate-400 mt-0.5">POS hardware orders linked to your partner network</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
                <Monitor className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-white font-black">No Hardware POS Orders</p>
                <p className="text-slate-400 text-sm">Hardware orders placed through your network will appear here</p>
              </div>
            </div>
          )}

          {/* ══ HW INVENTORY ══ */}
          {activeTab === 'hw-inventory' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Hardware Inventory</h2>
                <p className="text-xs text-slate-400 mt-0.5">Devices assigned through your partner network</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center space-y-3">
                <HardDrive className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-white font-black">No Inventory</p>
                <p className="text-slate-400 text-sm">Hardware devices in your network will appear here</p>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── STATUS CHANGE MODAL (Suspend/Deactivate — NO DELETE) ── */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusModal.action === 'activate' ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                <ShieldAlert className={`w-5 h-5 ${statusModal.action === 'activate' ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
              <div>
                <p className="font-black text-white capitalize">{statusModal.action} Account</p>
                <p className="text-xs text-slate-400">{statusModal.aff.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              {statusModal.action === 'suspend'
                ? 'This will temporarily block the sub-affiliate from earning commissions. You can re-activate at any time.'
                : statusModal.action === 'deactivate'
                ? 'This will deactivate the account. Contact Super SaaS Admin to delete permanently.'
                : 'This will re-activate the sub-affiliate account.'}
            </p>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reason (optional)</label>
              <input value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="Reason for this action..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setStatusModal(null); setStatusReason(''); }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold cursor-pointer border-none">
                Cancel
              </button>
              <button onClick={handleStatusChange}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer border-none ${statusModal.action === 'activate' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'}`}>
                Confirm {statusModal.action}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL (operational fields only) ── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">Edit Sub-Affiliate</h3>
              <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-white cursor-pointer border-none bg-transparent">✕</button>
            </div>
            <p className="text-[10px] text-slate-500">Operational fields only. Commission %, TIN, and NIDA can only be changed by Super SaaS Admin.</p>
            <div className="space-y-3">
              {[
                { label: 'Name', value: editName, set: setEditName, placeholder: 'Full name' },
                { label: 'Phone', value: editPhone, set: setEditPhone, placeholder: '+255 7XX XXX XXX' },
                { label: 'Payout Phone', value: editPayoutPhone, set: setEditPayoutPhone, placeholder: 'Mobile money number' },
              ].map(f => (
                <div key={f.label} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{f.label}</label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payout Provider</label>
                <select value={editPayoutMethod} onChange={e => setEditPayoutMethod(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none cursor-pointer">
                  {['M-Pesa','Mixx by Yas','Airtel Money','Halopesa'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold cursor-pointer border-none">Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-black cursor-pointer border-none">Save Changes</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
