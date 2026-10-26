import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download, Eye, LoaderCircle, MoreVertical, Pencil, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  AffiliateMonitoringData,
  AgentMonitoringRow,
  loadAffiliateMonitoringData,
  loadSuperAffiliateDetail,
  SubAffiliateMonitoringRow,
  SuperAffiliateRow,
  updateSuperAffiliate,
  deleteSubAffiliate,
  deletePartner,
} from '../utils/superAffiliateAdmin';
import { verifySuperAdminPassword } from '../utils/superAdminData';
import { formatLocalDate } from '../../../shared/utils/localDate';
import { downloadExcelFileFromRows } from '../../../shared/utils/excelExport';

const money = new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 });
const emptyData: AffiliateMonitoringData = { affiliates: [], organicSubscribers: [], agents: [], subAffiliates: [] };

type AffiliateCenterTab = 'agents' | 'subAffiliates';

const openAffiliateMirror = (row: SubAffiliateMonitoringRow) => {
  window.dispatchEvent(new CustomEvent('saas_enter_mirror', {
    detail: {
      accountType: 'affiliate',
      isAffiliate: true,
      account: {
        id: row.id,
        affiliateId: row.id,
        userId: row.userId,
        mirrorKey: `affiliate:${row.id}`,
        accountType: 'affiliate',
        name: row.name,
        role: 'Affiliate',
        phone: row.phone,
      },
    },
  }));
};

export default function SuperAffiliateControlCenter({ initialTab = 'agents', isUnlocked = false }: { initialTab?: AffiliateCenterTab; isUnlocked?: boolean }) {
  const [data, setData] = useState<AffiliateMonitoringData>(emptyData);
  const [activeTab, setActiveTab] = useState<AffiliateCenterTab>(initialTab);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SuperAffiliateRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingAffiliateId, setLoadingAffiliateId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; kind: 'partner' | 'subAffiliate' } | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setState('loading');
    try {
      setData(await loadAffiliateMonitoringData());
      setError('');
      setState('ready');
    } catch (e: any) {
      setError(e?.message || 'Unable to load live affiliate monitoring data.');
      setState('error');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  const q = query.trim().toLowerCase();
  const agentRows = useMemo(() => data.agents.filter((row) =>
    (!q || `${row.agentName} ${row.phone} ${row.agentCode}`.toLowerCase().includes(q)) &&
    (status === 'all' || row.status === status)
  ), [data.agents, q, status]);
  const subAffiliateRows = useMemo(() => data.subAffiliates.filter((row) =>
    (!q || `${row.name} ${row.parentAgentName} ${row.promoCode} ${row.phone}`.toLowerCase().includes(q)) &&
    (status === 'all' || row.status === status || row.payoutStatus === status) &&
    (agentFilter === 'all' || row.parentAgentId === agentFilter)
  ), [data.subAffiliates, q, status, agentFilter]);

  const agentTotals = useMemo(() => agentRows.reduce((acc, row) => ({
    revenue: acc.revenue + row.revenue,
    pool: acc.pool + row.poolTotal,
    agentCut: acc.agentCut + row.agentCut,
    subPool: acc.subPool + row.subAffiliatePool,
  }), { revenue: 0, pool: 0, agentCut: 0, subPool: 0 }), [agentRows]);
  const subTotals = useMemo(() => subAffiliateRows.reduce((acc, row) => ({
    revenue: acc.revenue + row.revenue,
    commission: acc.commission + row.commission,
    tax: acc.tax + row.withholdingTax,
    net: acc.net + row.netPayout,
  }), { revenue: 0, commission: 0, tax: 0, net: 0 }), [subAffiliateRows]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateSuperAffiliate(selected.id, {
        status: selected.status,
        nida_number: selected.nida_number,
        tin_number: selected.tin_number,
        payout_method: selected.payout_method,
        payout_account: selected.payout_account,
        phone_whatsapp: selected.phone_whatsapp,
        mobile_money_number: selected.mobile_money_number,
        mobile_money_provider: selected.mobile_money_provider
      });
      setSelected(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const openAffiliateEditor = async (row: SubAffiliateMonitoringRow) => {
    setLoadingAffiliateId(row.id);
    setError('');
    try {
      setSelected(await loadSuperAffiliateDetail(row.id));
    } catch (e: any) {
      setError(e?.message || 'Unable to load the selected affiliate.');
    } finally {
      setLoadingAffiliateId('');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    let verified = false;
    try {
      verified = await verifySuperAdminPassword(deletePassword);
    } catch (error: any) {
      setDeleteError(error?.message || 'Password verification is temporarily unavailable.');
      return;
    }
    if (!verified) {
      setDeleteError('Incorrect Super Admin password.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      if (deleteTarget.kind === 'partner') {
        await deletePartner(deleteTarget.id, deleteTarget.name);
      } else {
        await deleteSubAffiliate(deleteTarget.id, deleteTarget.name);
      }
      setDeleteTarget(null);
      setDeletePassword('');
      await refresh();
    } catch (e: any) {
      setDeleteError(e?.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = (filename: string, headers: string[], rows: unknown[][]) => {
    downloadExcelFileFromRows(`${filename}-${formatLocalDate()}`, [{ name: 'Export', aoa: [headers, ...rows] }]);
  };

  const exportAgentPayouts = () => exportCsv('agent-monitoring-payouts', ['Agent Name', 'Agent ID', 'Phone', 'Agent Code', 'Agent Link', 'Sub-affiliates', 'Subscribers', 'Revenue', '20% Pool', 'Agent 5% Cut', 'Sub-affiliate 15% Allocation', '5% WHT on Agent Cut', 'Agent Net', 'Mobile Money Number', 'Provider', 'Status'], agentRows.map((row) => [row.agentName, row.agentId, row.phone, row.agentCode, row.agentLink, row.subAffiliates, row.subscribers, row.revenue, row.poolTotal, row.agentCut, row.subAffiliatePool, row.withholdingTax, row.netPayout, row.mobileMoneyNumber, row.mobileMoneyProvider, row.status]));
  const exportSubPayouts = () => exportCsv('sub-affiliate-monitoring-payouts', ['Sub-affiliate Name', 'Sub-affiliate ID', 'Parent Agent', 'Agent Code', 'Phone', 'Promo Code', 'Referral Link', 'Subscribers', 'Revenue', '15% Commission', '5% WHT', 'Net Payout', 'Mobile Money Number', 'Provider', 'Payout Status', 'Account Status'], subAffiliateRows.map((row) => [row.name, row.id, row.parentAgentName, row.parentAgentCode, row.phone, row.promoCode, row.referralLink, row.subscribers, row.revenue, row.commission, row.withholdingTax, row.netPayout, row.mobileMoneyNumber, row.mobileMoneyProvider, row.payoutStatus, row.status]));

  if (state === 'loading') return <div className="min-h-[420px] grid place-items-center text-slate-400"><LoaderCircle className="animate-spin w-6 h-6" /></div>;
  if (state === 'error') return <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 text-center shadow-sm shadow-black/20"><ShieldCheck className="mx-auto w-7 h-7 text-amber-400" /><h2 className="mt-3 font-bold text-white">Live Super Admin access required</h2><p className="mt-2 text-sm text-slate-400">{error}</p><button onClick={refresh} className="mt-4 rounded-xl bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"><RefreshCw className="inline w-4 h-4 mr-2" />Retry</button></div>;

  return (
    <section className="space-y-5 text-left pt-1">
      <header className="flex flex-col gap-3 md:flex-row md:justify-between md:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Live Supabase source tracking</p>
          <h1 className="mt-1 text-lg font-bold text-white sm:text-xl">Super Admin Affiliates Menu</h1>
        </div>
        <button onClick={refresh} className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-200 shadow-sm shadow-black/20 transition-colors hover:bg-slate-800"><RefreshCw className="inline w-4 h-4 mr-2" />Refresh</button>
      </header>

      <div className="flex gap-2">
        <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')} label="Affiliate Agents" />
        <TabButton active={activeTab === 'subAffiliates'} onClick={() => setActiveTab('subAffiliates')} label="Sub-Affiliates" />
      </div>

      <div className="space-y-2.5">
        <label className="relative block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this monitoring section" className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-slate-700" />
        </label>
        <div className="affiliate-filter-grid gap-2.5">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-slate-700">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="paid">Paid</option>
            <option value="available">Available</option>
          </select>
          {activeTab === 'subAffiliates' ? (
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-slate-700">
              <option value="all">All agents</option>
              {data.agents.map((agent) => <option key={agent.agentId} value={agent.agentId}>{agent.agentName}</option>)}
            </select>
          ) : <div />}
        </div>
      </div>

      {activeTab === 'agents' && <AgentMonitoringSection rows={agentRows} totals={agentTotals} onExport={exportAgentPayouts} isUnlocked={isUnlocked} onDelete={(row) => setDeleteTarget({ id: row.agentId, name: row.agentName, kind: 'partner' })} />}
      {activeTab === 'subAffiliates' && <SubAffiliateSection rows={subAffiliateRows} totals={subTotals} onExport={exportSubPayouts} onEdit={openAffiliateEditor} loadingAffiliateId={loadingAffiliateId} isUnlocked={isUnlocked} onDelete={(row) => setDeleteTarget({ id: row.id, name: row.name, kind: 'subAffiliate' })} />}

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950 p-5 shadow-sm shadow-black/20">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Affiliate profile</h2>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"><X className="h-3.5 w-3.5" /></button>
            </div>
            <p className="text-xs text-slate-400">Edits are limited to approved identity, payout, and status fields. Commission math remains database-derived.</p>
            <Field label="Phone / WhatsApp" value={selected.phone_whatsapp || ''} onChange={(v) => setSelected({ ...selected, phone_whatsapp: v })} />
            <Field label="NIDA" value={selected.nida_number || ''} onChange={(v) => setSelected({ ...selected, nida_number: v })} />
            <Field label="TIN" value={selected.tin_number || ''} onChange={(v) => setSelected({ ...selected, tin_number: v })} />
            <Field label="Mobile money number" value={selected.mobile_money_number || selected.payout_account || ''} onChange={(v) => setSelected({ ...selected, mobile_money_number: v, payout_account: v })} />
            <Field label="Mobile money provider" value={selected.mobile_money_provider || selected.payout_method || ''} onChange={(v) => setSelected({ ...selected, mobile_money_provider: v, payout_method: v })} />
            <label className="block text-xs font-semibold text-slate-300">
              Status
              <select value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-700">
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <button disabled={saving} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm shadow-black/20 transition-colors hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save profile'}</button>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 grid place-items-center">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-rose-900/60 bg-slate-950 p-5 shadow-sm shadow-black/20">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                <h2 className="text-sm font-bold text-rose-400">
                  Delete {deleteTarget.kind === 'partner' ? 'Partner' : 'Sub-Affiliate'}
                </h2>
              </div>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }} className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"><X className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-sm text-slate-300">
              You are about to <strong className="text-rose-400">permanently delete</strong> <strong translate="no">{deleteTarget.name}</strong>.
              This action cannot be undone.
            </p>
            {deleteTarget.kind === 'partner' && (
              <p className="text-xs text-amber-400">
                This will fail if the partner still has sub-affiliates assigned to them — reassign or delete those first.
              </p>
            )}
            <label className="block text-xs font-semibold text-slate-300">
              Super Admin override password
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                placeholder="Enter override password to confirm"
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-700"
                autoFocus
              />
            </label>
            {deleteError && <p className="text-sm text-rose-400">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || !deletePassword}
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white shadow-sm shadow-black/20 transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AgentMonitoringSection({ rows, totals, onExport, isUnlocked, onDelete }: { rows: AgentMonitoringRow[]; totals: { revenue: number; pool: number; agentCut: number; subPool: number }; onExport: () => void; isUnlocked: boolean; onDelete: (row: AgentMonitoringRow) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onExport} className="rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm shadow-black/20 transition-colors hover:bg-emerald-700">
          <Download className="inline w-4 h-4 mr-2" />Download payout spreadsheet
        </button>
      </div>
      <div className="affiliate-summary-metrics-grid gap-3">
        <Metric label="Agents" value={rows.length.toLocaleString()} />
        <Metric label="Network revenue" value={totals.revenue > 0 ? money.format(totals.revenue) : 'No earnings yet'} />
        <Metric label="20% pool" value={totals.pool > 0 ? money.format(totals.pool) : '—'} />
        <Metric label="Agent 5% cut" value={totals.agentCut > 0 ? money.format(totals.agentCut) : '—'} />
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-800/80 shadow-sm shadow-black/20 lg:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-xs text-slate-400">
            <tr>
              <th className="p-3 text-left">Agent</th><th className="p-3 text-left">Code / link</th><th className="p-3 text-center">Sub-affiliates</th><th className="p-3 text-center">Subscribers</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">20% pool</th><th className="p-3 text-right">5% cut</th><th className="p-3 text-right">15% sub allocation</th><th className="p-3 text-right">Net</th><th className="p-3 text-left">Status</th><th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 bg-slate-900">
            {rows.map((row) => (
              <tr key={row.agentId}>
                <td className="p-3"><b>{row.agentName}</b><span className="block text-xs text-slate-500">{row.phone || 'No phone'}</span><span className="block text-xs text-slate-500">{row.mobileMoneyProvider || 'No provider'} · {row.mobileMoneyNumber || '—'}</span></td>
                <td className="p-3"><span className="font-mono text-xs text-emerald-300">{row.agentCode || 'Not assigned'}</span><span className="block text-[11px] text-slate-500">{row.agentLink || 'No link'}</span></td>
                <td className="p-3 text-center">{row.subAffiliates}</td>
                <td className="p-3 text-center">{row.subscribers}</td>
                <td className="p-3 text-right">{row.revenue > 0 ? money.format(row.revenue) : '—'}</td>
                <td className="p-3 text-right">{row.poolTotal > 0 ? money.format(row.poolTotal) : '—'}</td>
                <td className="p-3 text-right">{row.agentCut > 0 ? money.format(row.agentCut) : '—'}</td>
                <td className="p-3 text-right">{row.subAffiliatePool > 0 ? money.format(row.subAffiliatePool) : '—'}</td>
                <td className="p-3 text-right font-bold text-emerald-300">{row.netPayout > 0 ? money.format(row.netPayout) : '—'}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3 text-right">{isUnlocked && <button onClick={() => onDelete(row)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-950" title="Delete partner"><Trash2 className="w-4 h-4" /></button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={11} className="p-8 text-center text-slate-500">No agent accounts found yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <article key={row.agentId} className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900 p-4 shadow-sm shadow-black/20">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-black text-white">{row.agentName}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{row.agentCode || 'No code'} · {row.status}</p>
              </div>
              {isUnlocked && <button onClick={() => onDelete(row)} className="shrink-0 rounded-xl bg-slate-800 p-2 text-rose-500 hover:bg-rose-950" title="Delete partner"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="affiliate-card-stat-grid gap-2 text-sm">
              <div><span className="text-xs text-slate-500">Sub-affiliates</span><p className="font-semibold text-white">{row.subAffiliates}</p></div>
              <div><span className="text-xs text-slate-500">Subscribers</span><p className="font-semibold text-white">{row.subscribers}</p></div>
              <div><span className="text-xs text-slate-500">Revenue</span><p className="font-semibold text-white">{row.revenue > 0 ? money.format(row.revenue) : 'No earnings yet'}</p></div>
              <div><span className="text-xs text-slate-500">Agent cut</span><p className="font-semibold text-white">{row.agentCut > 0 ? money.format(row.agentCut) : '—'}</p></div>
            </div>
          </article>
        ))}
        {!rows.length && <EmptyCard text="No agent accounts found yet." />}
      </div>
    </div>
  );
}

function SubAffiliateSection({ rows, totals, onExport, onEdit, loadingAffiliateId, isUnlocked, onDelete }: { rows: SubAffiliateMonitoringRow[]; totals: { revenue: number; commission: number; tax: number; net: number }; onExport: () => void; onEdit: (row: SubAffiliateMonitoringRow) => void; loadingAffiliateId: string; isUnlocked: boolean; onDelete: (row: SubAffiliateMonitoringRow) => void }) {
  const [cardActionsFor, setCardActionsFor] = useState<SubAffiliateMonitoringRow | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onExport} className="rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm shadow-black/20 transition-colors hover:bg-emerald-700">
          <Download className="inline w-4 h-4 mr-2" />Download payout spreadsheet
        </button>
      </div>
      <div className="affiliate-summary-metrics-grid gap-3">
        <Metric label="Sub-affiliates" value={rows.length.toLocaleString()} />
        <Metric label="Revenue" value={money.format(totals.revenue)} />
        <Metric label="15% commission" value={money.format(totals.commission)} />
        <Metric label="5% WHT (future)" value={money.format(totals.tax)} />
      </div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-800/80 shadow-sm shadow-black/20 lg:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-xs text-slate-400">
            <tr>
              <th className="p-3 text-left">Sub-affiliate</th>
              <th className="p-3 text-left">Parent agent</th>
              <th className="p-3 text-left">Promo / link</th>
              <th className="p-3 text-center">Subscribers</th>
              <th className="p-3 text-right">Revenue</th>
              <th className="p-3 text-right">15% Gross</th>
              <th className="p-3 text-right">5% WHT</th>
              <th className="p-3 text-right">Net Payout</th>
              <th className="p-3 text-left">Payout Info</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 bg-slate-900">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-3"><b translate="no">{row.name}</b><span className="block text-xs text-slate-500">{row.phone || 'No phone'} · {row.status}</span></td>
                <td className="p-3">{row.parentAgentName}<span className="block text-xs text-slate-500">{row.parentAgentCode || '—'}</span></td>
                <td className="p-3"><span className="font-mono text-xs text-emerald-300">{row.promoCode}</span><span className="block text-[11px] text-slate-500 truncate max-w-[200px]">{row.referralLink}</span></td>
                <td className="p-3 text-center">{row.subscribers}</td>
                <td className="p-3 text-right">{money.format(row.revenue)}</td>
                <td className="p-3 text-right text-emerald-300">{money.format(row.commission)}</td>
                <td className="p-3 text-right">
                  <span className="text-amber-300">{money.format(row.withholdingTax)}</span>
                  <span className="block text-[9px] text-slate-600 italic">Not yet active</span>
                </td>
                <td className="p-3 text-right text-emerald-300 font-bold">{money.format(row.netPayout)}</td>
                <td className="p-3 text-xs">{row.mobileMoneyProvider || 'No provider'}<span className="block text-slate-500">{row.mobileMoneyNumber || '—'} · {row.payoutStatus}</span></td>
                <td className="p-3 text-right">
                  <button onClick={() => openAffiliateMirror(row)} className="p-2 rounded hover:bg-slate-800" title="Mirror affiliate"><Eye className="w-4 h-4" /></button>
                  <button disabled={loadingAffiliateId === row.id} onClick={() => onEdit(row)} className="p-2 rounded hover:bg-slate-800 disabled:opacity-50" title="Load affiliate details"><Pencil className="w-4 h-4" /></button>
                  {isUnlocked && <button onClick={() => onDelete(row)} className="p-2 rounded hover:bg-rose-950 text-rose-500" title="Delete sub-affiliate"><Trash2 className="w-4 h-4" /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="p-8 text-center text-slate-500">No sub-affiliates found yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900 shadow-sm shadow-black/20">
            <div className={`absolute inset-y-0 left-0 w-1 ${row.status === 'active' ? 'bg-emerald-500' : row.status === 'suspended' ? 'bg-rose-500' : 'bg-amber-500'}`} />
            <div className="py-3.5 pl-4 pr-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p translate="no" className="truncate text-[14px] font-extrabold leading-tight text-white">{row.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{row.parentAgentName} · <span className="text-emerald-400">{row.promoCode}</span></p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <div className="text-right">
                    <p className="text-[15px] font-black leading-tight text-blue-400">{money.format(row.netPayout)}</p>
                    <p className="text-[9px] text-slate-500">owed</p>
                  </div>
                  <button onClick={() => setCardActionsFor(row)} className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700" title="Sub-affiliate actions"><MoreVertical className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/60 pt-2.5 text-[10px] font-mono text-slate-500">
                <span>{row.subscribers} subscriber{row.subscribers === 1 ? '' : 's'}</span>
                <span className={row.payoutStatus === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>{row.payoutStatus}</span>
              </div>
            </div>
          </article>
        ))}
        {!rows.length && <EmptyCard text="No sub-affiliates found yet." />}
      </div>

      {cardActionsFor && (
        <>
          <div onClick={() => setCardActionsFor(null)} className="fixed inset-0 z-[110] bg-black/60" />
          <div
            className="fixed left-0 right-0 z-[120] mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-950 shadow-xl"
            style={{ bottom: 'calc(var(--dashboard-bottom-nav-height, 56px) + env(safe-area-inset-bottom))' }}
          >
            <div className="flex justify-center py-2"><div className="h-1 w-12 rounded-full bg-slate-700" /></div>
            <div className="px-5 pb-1 pt-1 text-left">
              <h3 translate="no" className="text-sm font-extrabold leading-tight text-white">{cardActionsFor.name}</h3>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">{cardActionsFor.parentAgentName} · <span className="text-emerald-400">{cardActionsFor.promoCode}</span></p>
            </div>
            <div className="space-y-2 p-4">
              <button
                type="button"
                onClick={() => { openAffiliateMirror(cardActionsFor); setCardActionsFor(null); }}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3 text-left transition-colors hover:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400"><Eye className="h-4 w-4" /></div>
                  <div>
                    <span className="block text-sm font-bold text-white">View Sub-Affiliate</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">See their full details</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
              <button
                type="button"
                disabled={loadingAffiliateId === cardActionsFor.id}
                onClick={() => { onEdit(cardActionsFor); setCardActionsFor(null); }}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3 text-left transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><Pencil className="h-4 w-4" /></div>
                  <div>
                    <span className="block text-sm font-bold text-white">Edit Sub-Affiliate</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">Update their profile details</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
              {isUnlocked && (
                <button
                  type="button"
                  onClick={() => { onDelete(cardActionsFor); setCardActionsFor(null); }}
                  className="flex w-full items-center justify-between rounded-2xl border border-rose-900/50 bg-rose-500/5 px-3.5 py-3 text-left transition-colors hover:bg-rose-500/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400"><Trash2 className="h-4 w-4" /></div>
                    <div>
                      <span className="block text-sm font-bold text-rose-400">Delete Sub-Affiliate</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">Permanently remove this account</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setCardActionsFor(null)}
                className="w-full rounded-2xl py-2.5 text-center text-sm font-bold text-slate-400 transition-colors hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors sm:flex-none sm:px-5 ${
        active
          ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-black/20'
          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-3.5 shadow-sm shadow-black/20">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-tight text-white sm:text-base">{value}</p>
    </div>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-slate-300">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-700" />
    </label>
  );
}
function EmptyCard({ text }: { text: string }) { return <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 text-center text-sm text-slate-500 shadow-sm shadow-black/20">{text}</div>; }


