import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, LoaderCircle, Pencil, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  AffiliateMonitoringData,
  AgentMonitoringRow,
  loadAffiliateMonitoringData,
  SubAffiliateMonitoringRow,
  SuperAffiliateRow,
  updateSuperAffiliate,
  deleteSubAffiliate,
  deletePartner,
  verifyAdminOverridePassword,
} from '../utils/superAffiliateAdmin';

const money = new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 });
const csvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const emptyData: AffiliateMonitoringData = { affiliates: [], organicSubscribers: [], agents: [], subAffiliates: [] };

type AffiliateCenterTab = 'agents' | 'subAffiliates';

export default function SuperAffiliateControlCenter({ initialTab = 'agents' }: { initialTab?: AffiliateCenterTab }) {
  const [data, setData] = useState<AffiliateMonitoringData>(emptyData);
  const [activeTab, setActiveTab] = useState<AffiliateCenterTab>(initialTab);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SuperAffiliateRow | null>(null);
  const [saving, setSaving] = useState(false);
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!verifyAdminOverridePassword(deletePassword)) {
      setDeleteError('Incorrect override password.');
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
    const blob = new Blob([[headers.map(csvValue).join(','), ...rows.map((row) => row.map(csvValue).join(','))].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAgentPayouts = () => exportCsv('agent-monitoring-payouts', ['Agent Name', 'Agent ID', 'Phone', 'Agent Code', 'Agent Link', 'Sub-affiliates', 'Subscribers', 'Revenue', '20% Pool', 'Agent 5% Cut', 'Sub-affiliate 15% Allocation', '5% WHT on Agent Cut', 'Agent Net', 'Mobile Money Number', 'Provider', 'Status'], agentRows.map((row) => [row.agentName, row.agentId, row.phone, row.agentCode, row.agentLink, row.subAffiliates, row.subscribers, row.revenue, row.poolTotal, row.agentCut, row.subAffiliatePool, row.withholdingTax, row.netPayout, row.mobileMoneyNumber, row.mobileMoneyProvider, row.status]));
  const exportSubPayouts = () => exportCsv('sub-affiliate-monitoring-payouts', ['Sub-affiliate Name', 'Sub-affiliate ID', 'Parent Agent', 'Agent Code', 'Phone', 'Promo Code', 'Referral Link', 'Subscribers', 'Revenue', '15% Commission', '5% WHT', 'Net Payout', 'Mobile Money Number', 'Provider', 'Payout Status', 'Account Status'], subAffiliateRows.map((row) => [row.name, row.id, row.parentAgentName, row.parentAgentCode, row.phone, row.promoCode, row.referralLink, row.subscribers, row.revenue, row.commission, row.withholdingTax, row.netPayout, row.mobileMoneyNumber, row.mobileMoneyProvider, row.payoutStatus, row.status]));

  if (state === 'loading') return <div className="min-h-[420px] grid place-items-center text-slate-400"><LoaderCircle className="animate-spin w-6 h-6" /></div>;
  if (state === 'error') return <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center"><ShieldCheck className="mx-auto w-7 h-7 text-amber-400" /><h2 className="mt-3 font-bold text-white">Live Super Admin access required</h2><p className="mt-2 text-sm text-slate-400">{error}</p><button onClick={refresh} className="mt-4 px-3 py-2 bg-slate-800 rounded-md text-sm font-semibold"><RefreshCw className="inline w-4 h-4 mr-2" />Retry</button></div>;

  return (
    <section className="space-y-5 text-left pt-1">
      <header className="flex flex-col gap-3 md:flex-row md:justify-between md:items-end">
        <div>
          <p className="text-xs text-emerald-400 font-semibold">Live Supabase source tracking</p>
          <h1 className="mt-1 text-xl font-bold text-white">Super Admin Affiliates Menu</h1>
          <p className="mt-1 text-xs text-slate-400">Every affiliate is recruited by a Partner. Partner networks and their sub-affiliates are tracked below.</p>
        </div>
        <button onClick={refresh} className="px-3 py-2 rounded-md border border-slate-700 text-sm shrink-0"><RefreshCw className="inline w-4 h-4 mr-2" />Refresh</button>
      </header>

      <div className="flex flex-wrap gap-2.5">
        <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')} label="1. Affiliate Agents (Partners)" />
        <TabButton active={activeTab === 'subAffiliates'} onClick={() => setActiveTab('subAffiliates')} label="2. Sub-Affiliates" />
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_160px_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this monitoring section" className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 pl-9 pr-3 text-sm" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md px-3 text-sm">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="paid">Paid</option>
          <option value="available">Available</option>
        </select>
        {activeTab === 'subAffiliates' ? (
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md px-3 text-sm">
            <option value="all">All agents</option>
            {data.agents.map((agent) => <option key={agent.agentId} value={agent.agentId}>{agent.agentName}</option>)}
          </select>
        ) : <div />}
      </div>

      {activeTab === 'agents' && <AgentMonitoringSection rows={agentRows} totals={agentTotals} onExport={exportAgentPayouts} onDelete={(row) => setDeleteTarget({ id: row.agentId, name: row.agentName, kind: 'partner' })} />}
      {activeTab === 'subAffiliates' && <SubAffiliateSection rows={subAffiliateRows} totals={subTotals} onExport={exportSubPayouts} onEdit={(row) => setSelected(data.affiliates.find((affiliate) => affiliate.id === row.id) || null)} onDelete={(row) => setDeleteTarget({ id: row.id, name: row.name, kind: 'subAffiliate' })} />}

      {selected && <div className="fixed inset-0 z-50 bg-black/70 p-4 grid place-items-center"><form onSubmit={(e) => { e.preventDefault(); save(); }} className="w-full max-w-lg bg-slate-950 border border-slate-700 rounded-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"><div className="flex justify-between"><h2 className="font-bold">Affiliate profile</h2><button type="button" onClick={() => setSelected(null)}>Close</button></div><p className="text-sm text-slate-400">Edits are limited to approved identity, payout, and status fields. Commission math remains database-derived.</p><Field label="Phone / WhatsApp" value={selected.phone_whatsapp || ''} onChange={(v) => setSelected({ ...selected, phone_whatsapp: v })} /><Field label="NIDA" value={selected.nida_number || ''} onChange={(v) => setSelected({ ...selected, nida_number: v })} /><Field label="TIN" value={selected.tin_number || ''} onChange={(v) => setSelected({ ...selected, tin_number: v })} /><Field label="Mobile money number" value={selected.mobile_money_number || selected.payout_account || ''} onChange={(v) => setSelected({ ...selected, mobile_money_number: v, payout_account: v })} /><Field label="Mobile money provider" value={selected.mobile_money_provider || selected.payout_method || ''} onChange={(v) => setSelected({ ...selected, mobile_money_provider: v, payout_method: v })} /><label className="block text-sm">Status<select value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value })} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></label><button disabled={saving} className="w-full bg-emerald-600 text-white rounded-md py-2.5 font-semibold">{saving ? 'Saving...' : 'Save profile'}</button></form></div>}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 grid place-items-center">
          <div className="w-full max-w-md bg-slate-950 border border-rose-900 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                <h2 className="font-bold text-rose-400">
                  Delete {deleteTarget.kind === 'partner' ? 'Partner' : 'Sub-Affiliate'}
                </h2>
              </div>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-300">
              You are about to <strong className="text-rose-400">permanently delete</strong> <strong>{deleteTarget.name}</strong>.
              This action cannot be undone.
            </p>
            {deleteTarget.kind === 'partner' && (
              <p className="text-xs text-amber-400">
                This will fail if the partner still has sub-affiliates assigned to them — reassign or delete those first.
              </p>
            )}
            <label className="block text-sm">
              Super Admin override password
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                placeholder="Enter override password to confirm"
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2"
                autoFocus
              />
            </label>
            {deleteError && <p className="text-sm text-rose-400">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
                className="flex-1 bg-slate-800 text-white rounded-md py-2.5 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || !deletePassword}
                onClick={confirmDelete}
                className="flex-1 bg-rose-600 disabled:opacity-50 text-white rounded-md py-2.5 font-semibold"
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

function AgentMonitoringSection({ rows, totals, onExport, onDelete }: { rows: AgentMonitoringRow[]; totals: { revenue: number; pool: number; agentCut: number; subPool: number }; onExport: () => void; onDelete: (row: AgentMonitoringRow) => void }) {
  return <div className="space-y-4"><div className="flex justify-end"><button onClick={onExport} className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold"><Download className="inline w-4 h-4 mr-2" />Download payout spreadsheet</button></div><div className="grid gap-3 md:grid-cols-4"><Metric label="Agents" value={rows.length.toLocaleString()} /><Metric label="Network revenue" value={totals.revenue > 0 ? money.format(totals.revenue) : 'No earnings yet'} /><Metric label="20% pool" value={totals.pool > 0 ? money.format(totals.pool) : '—'} /><Metric label="Agent 5% cut" value={totals.agentCut > 0 ? money.format(totals.agentCut) : '—'} /></div><div className="hidden lg:block overflow-x-auto border border-slate-800 rounded-lg"><table className="w-full text-sm"><thead className="bg-slate-900 text-slate-400 text-xs"><tr><th className="p-3 text-left">Agent</th><th className="p-3 text-left">Code / link</th><th className="p-3 text-center">Sub-affiliates</th><th className="p-3 text-center">Subscribers</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">20% pool</th><th className="p-3 text-right">5% cut</th><th className="p-3 text-right">15% sub allocation</th><th className="p-3 text-right">Net</th><th className="p-3 text-left">Status</th><th className="p-3" /></tr></thead><tbody className="divide-y divide-slate-800">{rows.map((row) => <tr key={row.agentId}><td className="p-3"><b>{row.agentName}</b><span className="block text-xs text-slate-500">{row.phone || 'No phone'}</span><span className="block text-xs text-slate-500">{row.mobileMoneyProvider || 'No provider'} · {row.mobileMoneyNumber || '—'}</span></td><td className="p-3"><span className="font-mono text-xs text-emerald-300">{row.agentCode || 'Not assigned'}</span><span className="block text-[11px] text-slate-500">{row.agentLink || 'No link'}</span></td><td className="p-3 text-center">{row.subAffiliates}</td><td className="p-3 text-center">{row.subscribers}</td><td className="p-3 text-right">{row.revenue > 0 ? money.format(row.revenue) : '—'}</td><td className="p-3 text-right">{row.poolTotal > 0 ? money.format(row.poolTotal) : '—'}</td><td className="p-3 text-right">{row.agentCut > 0 ? money.format(row.agentCut) : '—'}</td><td className="p-3 text-right">{row.subAffiliatePool > 0 ? money.format(row.subAffiliatePool) : '—'}</td><td className="p-3 text-right text-emerald-300 font-bold">{row.netPayout > 0 ? money.format(row.netPayout) : '—'}</td><td className="p-3">{row.status}</td><td className="p-3 text-right"><button onClick={() => onDelete(row)} className="p-2 rounded hover:bg-rose-950 text-rose-500" title="Delete partner"><Trash2 className="w-4 h-4" /></button></td></tr>)}{!rows.length && <tr><td colSpan={11} className="p-8 text-center text-slate-500">No agent accounts found yet.</td></tr>}</tbody></table></div><div className="lg:hidden space-y-3">{rows.map((row) => (<article key={row.agentId} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3"><div className="flex items-start justify-between"><div><p className="font-black text-white">{row.agentName}</p><p className="text-xs text-slate-500 mt-0.5">{row.agentCode || 'No code'} · {row.status}</p></div><button onClick={() => onDelete(row)} className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button></div><div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-slate-500 text-xs">Sub-affiliates</span><p className="font-semibold">{row.subAffiliates}</p></div><div><span className="text-slate-500 text-xs">Subscribers</span><p className="font-semibold">{row.subscribers}</p></div><div><span className="text-slate-500 text-xs">Revenue</span><p className="font-semibold">{row.revenue > 0 ? money.format(row.revenue) : 'No earnings yet'}</p></div><div><span className="text-slate-500 text-xs">Agent cut</span><p className="font-semibold">{row.agentCut > 0 ? money.format(row.agentCut) : '—'}</p></div></div></article>))}{!rows.length && <EmptyCard text="No agent accounts found yet." />}</div></div>;
}

function SubAffiliateSection({ rows, totals, onExport, onEdit, onDelete }: { rows: SubAffiliateMonitoringRow[]; totals: { revenue: number; commission: number; tax: number; net: number }; onExport: () => void; onEdit: (row: SubAffiliateMonitoringRow) => void; onDelete: (row: SubAffiliateMonitoringRow) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onExport} className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold">
          <Download className="inline w-4 h-4 mr-2" />Download payout spreadsheet
        </button>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric label="Sub-affiliates" value={rows.length.toLocaleString()} />
        <Metric label="Revenue" value={money.format(totals.revenue)} />
        <Metric label="15% commission" value={money.format(totals.commission)} />
        <Metric label="5% WHT (future)" value={money.format(totals.tax)} />
      </div>
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs">
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
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-3"><b>{row.name}</b><span className="block text-xs text-slate-500">{row.phone || 'No phone'} · {row.status}</span></td>
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
                  <button onClick={() => window.dispatchEvent(new CustomEvent('saas_enter_mirror', { detail: { account: { id: row.userId, name: row.name, role: 'Affiliate', phone: row.phone }, isAffiliate: true } }))} className="p-2 rounded hover:bg-slate-800" title="Mirror"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => onEdit(row)} className="p-2 rounded hover:bg-slate-800" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => onDelete(row)} className="p-2 rounded hover:bg-rose-950 text-rose-500" title="Delete sub-affiliate"><Trash2 className="w-4 h-4" /></button>
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
          <article key={row.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-black text-white">{row.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{row.parentAgentName} · <span className="font-mono text-emerald-400">{row.promoCode}</span></p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => window.dispatchEvent(new CustomEvent('saas_enter_mirror', { detail: { account: { id: row.userId, name: row.name, role: 'Affiliate', phone: row.phone }, isAffiliate: true } }))} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400"><Eye className="w-3.5 h-3.5" /></button>
                <button onClick={() => onEdit(row)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDelete(row)} className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[9px] text-slate-500 uppercase font-bold">Revenue</p><p className="text-sm font-black text-white mt-0.5">{money.format(row.revenue)}</p></div>
              <div className="bg-emerald-500/10 rounded-xl p-3"><p className="text-[9px] text-emerald-400/70 uppercase font-bold">15% Gross</p><p className="text-sm font-black text-emerald-400 mt-0.5">{money.format(row.commission)}</p></div>
              <div className="bg-amber-500/10 rounded-xl p-3">
                <p className="text-[9px] text-amber-400/70 uppercase font-bold">5% WHT</p>
                <p className="text-sm font-black text-amber-400 mt-0.5">{money.format(row.withholdingTax)}</p>
                <p className="text-[8px] text-slate-600 italic mt-0.5">Not yet active</p>
              </div>
              <div className="bg-blue-500/10 rounded-xl p-3"><p className="text-[9px] text-blue-400/70 uppercase font-bold">Net Payout</p><p className="text-sm font-black text-blue-400 mt-0.5">{money.format(row.netPayout)}</p></div>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-2">{row.mobileMoneyProvider || 'No provider'} · {row.mobileMoneyNumber || '—'} · <span className={row.payoutStatus === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>{row.payoutStatus}</span></div>
          </article>
        ))}
        {!rows.length && <EmptyCard text="No sub-affiliates found yet." />}
      </div>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-lg text-sm font-bold border transition-colors whitespace-nowrap ${
        active
          ? 'bg-emerald-600 text-white border-emerald-500'
          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">{label}</span>
      <strong className="block mt-1.5 text-xl text-white">{value}</strong>
    </div>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm">{label}<input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2" /></label>; }
function EmptyCard({ text }: { text: string }) { return <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-sm text-slate-500">{text}</div>; }
function Card({ title, meta, stats }: { key?: string; title: string; meta: string; stats: Array<[string, string | number]> }) { return <article className="bg-slate-900 border border-slate-800 p-4 rounded-lg"><b>{title}</b><p className="text-xs text-slate-500 mt-1">{meta}</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{stats.map(([label, value]) => <p key={label} className="text-slate-400">{label}<strong className="block text-white text-sm">{value}</strong></p>)}</div></article>; }
