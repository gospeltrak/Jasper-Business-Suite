import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';

type PayoutRow = {
  id: string;
  affiliate_id: string;
  affiliate_name: string;
  payout_month: string | null;
  amount: number;
  net_payout: number | null;
  payout_method: string | null;
  payout_phone: string | null;
  status: string;
  requested_at: string;
  processed_at: string | null;
  payout_reference: string | null;
  notes: string | null;
  provider_fee_tzs: number | null;
};
type Decision = 'approve' | 'reject' | 'mark_paid';
const formatTZS = (n: number | null | undefined) => 'TZS ' + Number(n || 0).toLocaleString('en-TZ');

async function sharedPayoutRequest(path: string, init?: RequestInit) {
  const client = await getSecureDataBridgeClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sign in to review payout requests.');
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
      ...init?.headers,
    },
    credentials: 'same-origin',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Payout request failed.');
  return result;
}

export default function SuperAffiliatePayoutReview({ mode = 'audit' }: { mode?: 'agent' | 'audit' }) {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [needsAssignment, setNeedsAssignment] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'paid' | 'rejected' | 'all'>('pending');
  const [selected, setSelected] = useState<{row: PayoutRow; action: Decision} | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sharedPayoutRequest('/api/affiliate-operations/payouts?page=0');
      setRows(Array.isArray(data.payouts) ? data.payouts : []);
      setPage(0);
      setHasMore(Boolean(data.has_more));
      setNeedsAssignment(Boolean(data.needs_assignment));
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Unable to load payout requests.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const data = await sharedPayoutRequest(`/api/affiliate-operations/payouts?page=${page + 1}`);
      setRows(previous => {
        const byId = new Map([...previous, ...(Array.isArray(data.payouts) ? data.payouts : [])].map(row => [row.id, row]));
        return [...byId.values()];
      });
      setPage(previous => previous + 1);
      setHasMore(Boolean(data.has_more));
    } catch (e: any) {
      setError(e?.message || 'Unable to load more payouts.');
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => rows.filter(row => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['requested', 'processing'].includes(row.status);
    if (filter === 'rejected') return ['rejected', 'cancelled'].includes(row.status);
    return row.status === 'paid';
  }), [rows, filter]);

  const submit = async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await sharedPayoutRequest(`/api/affiliate-operations/payouts/${encodeURIComponent(selected.row.id)}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          action: selected.action,
          ...(selected.action === 'reject' ? { reason: reason.trim() } : selected.action === 'mark_paid' ? { reference: reference.trim() } : {}),
        }),
      });
      setNotice(selected.action === 'reject' ? 'Request rejected with a reason.' : selected.action === 'approve' ? 'Request approved for processing.' : 'External payment recorded as paid.');
      setSelected(null); setReason(''); setReference('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Unable to update the payout.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-white">{mode === 'agent' ? 'Affiliate Payout Requests' : 'Payout Audit'}</h2>
          <p className="mt-1 text-xs text-slate-400">{mode === 'agent' ? 'Approve, reject or confirm manually sent payments for your affiliates.' : 'Read-only overview of payment decisions and references.'}</p></div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-emerald-800 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-900/30">Refresh</button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">{error}</p>}
      {mode === 'agent' && needsAssignment && <p role="status" className="rounded-lg border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">No affiliates are assigned to this agent yet. An authorized administrator must link affiliates before payouts can be processed.</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-200">{notice}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter payout requests">
        {(['pending','paid','rejected','all'] as const).map(value => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
            className={`rounded-lg border px-3 py-2 text-xs capitalize ${filter === value ? 'border-emerald-600 bg-emerald-700 text-white' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>{value}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {loading ? <p className="p-5 text-sm text-slate-400">Loading requests...</p>
          : !filtered.length ? <p className="p-5 text-sm text-slate-400">No requests in this category.</p>
            : <div className="divide-y divide-slate-800">{filtered.map(row => (
              <article key={row.id} className="flex flex-wrap items-center gap-3 p-3.5 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{row.affiliate_name}</p>
                  <p className="mt-1 text-xs tabular-nums text-emerald-300">{formatTZS(row.amount)} <span className="text-slate-500">· Net {formatTZS(row.net_payout)}</span></p>
                  <p className="mt-1 text-[11px] text-slate-400">{row.payout_method || 'Mobile Money'} · {row.payout_phone || 'No number'} · {new Date(row.requested_at).toLocaleDateString('en-TZ')}</p>
                  {(row.status === 'rejected' || row.status === 'cancelled') && <p className="mt-2 text-xs text-rose-300">Reason: {row.notes || 'Not specified'}</p>}
                  {row.status === 'paid' && <p className="mt-2 text-xs text-emerald-300">Reference: {row.payout_reference || '—'}</p>}
                </div>
                <span className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] capitalize text-slate-300">{row.status}</span>
                {!row.payout_month && ['requested','processing'].includes(row.status) && <span className="text-[10px] text-amber-400">Legacy payout · review separately</span>}
                {mode === 'agent' && ['requested','processing'].includes(row.status) && row.payout_month && <div className="flex flex-wrap gap-2">
                  {row.status === 'requested' && <button type="button" onClick={() => { setSelected({row,action:'approve'}); setReason(''); setReference(''); }} className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-xs text-emerald-100">Approve</button>}
                  <button type="button" onClick={() => { setSelected({ row, action: 'reject' }); setReason(''); setReference(''); }} className="rounded-lg border border-rose-800 px-3 py-2 text-xs text-rose-300">Reject</button>
                  {row.status === 'processing' && <button type="button" onClick={() => { setSelected({ row, action: 'mark_paid' }); setReason(''); setReference(''); }} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white">Mark Paid</button>}
                </div>}
              </article>
            ))}</div>}
      </div>
      {hasMore && <button type="button" disabled={loadingMore || loading} onClick={() => void loadMore()}
        className="w-full rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-2.5 text-xs text-emerald-200 disabled:opacity-50">
        {loadingMore ? 'Loading...' : 'Load more payout records'}
      </button>}

      {selected && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-3" onClick={e => { if (e.target === e.currentTarget && !busy) setSelected(null); }}>
        <form onSubmit={e => { e.preventDefault(); void submit(); }} className="w-full max-w-md space-y-4 rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
          <h3 className="text-base font-semibold text-white">{selected.action === 'reject' ? 'Reject Withdrawal' : selected.action === 'approve' ? 'Approve for Processing' : 'Confirm External Payment'}</h3>
          <p className="text-xs text-slate-400">{selected.row.affiliate_name} · {formatTZS(selected.row.amount)}</p>
          {selected.action === 'approve' ? <p className="text-xs text-emerald-200">Move this request to Processing. No money is sent automatically.</p> : selected.action === 'reject' ? <label className="block text-xs text-slate-300">Reason (required, 10–500 characters)
            <textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Explain why this withdrawal was rejected" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-emerald-600" />
          </label> : <label className="block text-xs text-slate-300">Verified transaction reference (required)
            <input required minLength={5} maxLength={120} value={reference} onChange={e => setReference(e.target.value)}
              placeholder="External transfer reference" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-600" />
            <span className="mt-2 block text-[11px] text-amber-300">Mark Paid only after the money has been sent manually and confirmed.</span>
          </label>}
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => setSelected(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-200">Cancel</button>
            <button type="submit" disabled={busy || (selected.action === 'reject' ? reason.trim().length < 10 : selected.action === 'mark_paid' ? reference.trim().length < 5 : false)}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Confirm'}</button>
          </div>
        </form>
      </div>}
    </section>
  );
}
