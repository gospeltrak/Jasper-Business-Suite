import { useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';

interface ProClient {
  tenantId: string;
  businessName: string;
  status: 'inactive' | 'trial' | 'active' | 'suspended' | 'expired';
  startsAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  features: {
    settle: boolean;
    shiftReports: boolean;
    cashierAccountability: boolean;
    parkSale: boolean;
  };
}

/**
 * Read-only dashboard. Only the verified platform-admin endpoint can return
 * these records; no fake clients, localStorage, payments, or entitlement writes.
 */
export default function OrvixProClientList() {
  const [clients, setClients] = useState<ProClient[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const run = async () => {
      setBusy(true);
      setErrorMessage('');
      try {
        const client = await getSecureDataBridgeClient();
        const { data, error } = await client.auth.getSession();
        if (error || !data.session?.access_token) throw new Error('Please sign in again.');
        const response = await fetch('/api/orvix-pro/admin/clients', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Authorization: 'Bearer ' + data.session.access_token,
            Accept: 'application/json',
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(payload.error || 'Pro directory is unavailable.'));
        if (disposed) return;
        setClients(Array.isArray(payload.clients) ? payload.clients : []);
        setTotal(Number(payload.total) || 0);
      } catch (err) {
        if (disposed) return;
        setClients([]);
        setTotal(0);
        setErrorMessage(err instanceof Error ? err.message : 'Pro directory is unavailable.');
      } finally {
        if (!disposed) setBusy(false);
      }
    };
    void run();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [refresh]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Verified Pro memberships only. Ordinary tenants remain unchanged.</p>
        <button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />Refresh
        </button>
      </div>
      {busy && <p role="status" className="text-xs text-slate-400">Loading Pro clients...</p>}
      {errorMessage && <p role="alert" className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">{errorMessage}</p>}
      {!busy && !errorMessage && clients.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-center">
          <Users className="mx-auto mb-2 text-slate-500" size={22} />
          <p className="text-sm font-semibold text-slate-200">No provisioned Pro clients</p>
          <p className="mt-1 text-xs text-slate-500">No client records are simulated and no tenant is enrolled automatically.</p>
        </div>
      )}
      {!busy && !errorMessage && clients.map(client => (
        <div key={client.tenantId} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="min-w-0">
            <p className="break-words text-sm font-bold text-white">{client.businessName}</p>
            <p className="mt-1 text-xs text-slate-400">
              {client.expiresAt ? 'Expiry: ' + new Date(client.expiresAt).toLocaleDateString() : 'No expiry configured'}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Features: {Object.entries(client.features || {}).filter(([, enabled]) => enabled).map(([key]) => key).join(', ') || 'none enabled'}
            </p>
          </div>
          <span className={'rounded-lg border px-2 py-1 text-[10px] font-extrabold uppercase ' +
            (client.status === 'active' ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
              : client.status === 'trial' ? 'border-amber-700 bg-amber-950/40 text-amber-300'
                : 'border-slate-700 bg-slate-800 text-slate-300')}>
            {client.status}
          </span>
        </div>
      ))}
      {!busy && !errorMessage && total > 50 && (
        <p className="text-xs text-slate-400">Showing first 50 of {total}. Additional pagination is not enabled yet.</p>
      )}
    </div>
  );
}
