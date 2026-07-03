import React, { useState, useEffect, useCallback } from 'react';
import { Activity, ShieldAlert, CheckCircle, XCircle, Gift, Search, RefreshCw, FileText, Clock, Package, User, AlertCircle } from 'lucide-react';
import { getDynamicSupabaseClient } from '../supabaseClient';
import { normalizeSubscriptionPlanId, SUBSCRIPTION_PLANS } from '../utils/subscription';

interface PaymentProof {
  id: string;
  tenant_id: string;
  tenant_name: string;
  requested_package_id: string;
  requested_package_name: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt_file_name: string;
  receipt_file_type: string;
  note: string | null;
  submitted_by: string;
  submitted_at: string;
  approved_at?: string;
  approved_by?: string;
  rejected_reason?: string;
}

interface TenantRecord {
  id: string;
  name: string;
  subscription_plan: string;
  created_at: string;
}

export default function SaaSStatusAndRequests() {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [emergencyTenantId, setEmergencyTenantId] = useState('');
  const [emergencyPlan, setEmergencyPlan] = useState('diamond');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const client: any = await getDynamicSupabaseClient();

      // Load payment proofs
      const { data: proofsData, error: proofsError } = await client
        .from('tenant_payment_proofs')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (!proofsError && proofsData) setProofs(proofsData);

      // Load tenants for emergency override
      const { data: tenantsData, error: tenantsError } = await client
        .from('tenants')
        .select('id, name, subscription_plan, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!tenantsError && tenantsData) setTenants(tenantsData);
    } catch (e) {
      setMessage({ text: 'Failed to load data. Check Supabase connection.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── APPROVE ──────────────────────────────────────────────────────────────
  const handleApprove = async (proof: PaymentProof) => {
    setProcessingId(proof.id);
    setMessage(null);
    try {
      const client: any = await getDynamicSupabaseClient();
      const normalizedPlan = normalizeSubscriptionPlanId(proof.requested_package_id);
      const now = new Date().toISOString();

      // 1. Update tenants.subscription_plan in DB
      const { error: tenantError } = await client
        .from('tenants')
        .update({
          subscription_plan: normalizedPlan,
          subscription_activated_at: now,
          subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', proof.tenant_id);

      if (tenantError) throw tenantError;

      // 2. Mark proof as approved
      const { error: proofError } = await client
        .from('tenant_payment_proofs')
        .update({
          status: 'approved',
          approved_at: now,
          approved_by: 'super_admin',
          updated_at: now,
        })
        .eq('id', proof.id);

      if (proofError) throw proofError;

      // 3. Update local state
      setProofs(prev => prev.map(p => p.id === proof.id ? { ...p, status: 'approved', approved_at: now } : p));
      setTenants(prev => prev.map(t => t.id === proof.tenant_id ? { ...t, subscription_plan: normalizedPlan } : t));
      setMessage({ text: `✅ Approved! ${proof.tenant_name} is now on ${SUBSCRIPTION_PLANS[normalizedPlan]?.name || normalizedPlan} plan.`, type: 'success' });
    } catch (e: any) {
      setMessage({ text: `❌ Approve failed: ${e.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  // ── REJECT ───────────────────────────────────────────────────────────────
  const handleReject = async (proof: PaymentProof) => {
    if (!rejectReason.trim()) { setMessage({ text: 'Enter a rejection reason first.', type: 'error' }); return; }
    setProcessingId(proof.id);
    setMessage(null);
    try {
      const client: any = await getDynamicSupabaseClient();
      const now = new Date().toISOString();
      const { error } = await client
        .from('tenant_payment_proofs')
        .update({ status: 'rejected', rejected_reason: rejectReason.trim(), updated_at: now })
        .eq('id', proof.id);

      if (error) throw error;
      setProofs(prev => prev.map(p => p.id === proof.id ? { ...p, status: 'rejected', rejected_reason: rejectReason.trim() } : p));
      setMessage({ text: `Rejected. Reason sent to ${proof.tenant_name}.`, type: 'success' });
      setRejectingId(null);
      setRejectReason('');
    } catch (e: any) {
      setMessage({ text: `Reject failed: ${e.message}`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  // ── EMERGENCY OVERRIDE ───────────────────────────────────────────────────
  const handleEmergencyOverride = async () => {
    if (!emergencyTenantId) { setMessage({ text: 'Select a tenant first.', type: 'error' }); return; }
    try {
      const client: any = await getDynamicSupabaseClient();
      const normalizedPlan = normalizeSubscriptionPlanId(emergencyPlan);
      const now = new Date().toISOString();
      const { error } = await client
        .from('tenants')
        .update({
          subscription_plan: normalizedPlan,
          subscription_activated_at: now,
          subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', emergencyTenantId);

      if (error) throw error;
      setTenants(prev => prev.map(t => t.id === emergencyTenantId ? { ...t, subscription_plan: normalizedPlan } : t));
      setMessage({ text: `✅ Emergency override applied. Tenant is now on ${SUBSCRIPTION_PLANS[normalizedPlan]?.name}.`, type: 'success' });
      setEmergencyTenantId('');
    } catch (e: any) {
      setMessage({ text: `Emergency override failed: ${e.message}`, type: 'error' });
    }
  };

  const filtered = proofs.filter(p => filterStatus === 'all' ? true : p.status === filterStatus);
  const pendingCount = proofs.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Payment Approvals</h2>
          <p className="text-xs text-slate-400 mt-0.5">Approve payment receipts to activate tenant packages</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-black rounded-full border border-amber-500/30">
              {pendingCount} Pending
            </span>
          )}
          <button onClick={loadData} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          {message.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${filterStatus === s ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {s} {s !== 'all' && proofs.filter(p => p.status === s).length > 0 && `(${proofs.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Payment proof cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading requests...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No {filterStatus === 'all' ? '' : filterStatus} payment requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(proof => {
            const plan = SUBSCRIPTION_PLANS[normalizeSubscriptionPlanId(proof.requested_package_id)];
            const isPending = proof.status === 'pending';
            const isProcessing = processingId === proof.id;

            return (
              <div key={proof.id} className={`bg-slate-900 border rounded-2xl p-5 space-y-4 ${
                isPending ? 'border-amber-500/30' : proof.status === 'approved' ? 'border-emerald-500/20' : 'border-rose-500/20'
              }`}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{proof.tenant_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{proof.tenant_id.slice(0, 16)}...</p>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                    isPending ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    : proof.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                  }`}>
                    {proof.status}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">Package</p>
                    <p className="text-xs font-black text-white">{plan?.name || proof.requested_package_name}</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">Amount</p>
                    <p className="text-xs font-black text-emerald-400">{proof.currency} {proof.amount?.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">Receipt</p>
                    <p className="text-xs font-mono text-slate-300 truncate">{proof.receipt_file_name}</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">Submitted</p>
                    <p className="text-xs text-slate-300">{new Date(proof.submitted_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {proof.note && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2">
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Note from tenant</p>
                    <p className="text-xs text-slate-300">{proof.note}</p>
                  </div>
                )}

                {proof.status === 'approved' && proof.approved_at && (
                  <p className="text-[10px] text-emerald-600">✅ Approved on {new Date(proof.approved_at).toLocaleString()}</p>
                )}
                {proof.status === 'rejected' && proof.rejected_reason && (
                  <p className="text-[10px] text-rose-400">❌ Rejected: {proof.rejected_reason}</p>
                )}

                {/* Actions — only for pending */}
                {isPending && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(proof)}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-colors cursor-pointer border-none flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {isProcessing ? 'Activating...' : `Approve & Activate ${plan?.name}`}
                      </button>
                      <button
                        onClick={() => setRejectingId(rejectingId === proof.id ? null : proof.id)}
                        disabled={isProcessing}
                        className="px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-rose-500/20 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                    {rejectingId === proof.id && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Reason for rejection..."
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          className="flex-1 bg-slate-800 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                        />
                        <button onClick={() => handleReject(proof)}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer border-none">
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Emergency Override */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-black text-white">Emergency Plan Override</h3>
          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase">Admin Only</span>
        </div>
        <p className="text-[10px] text-slate-400">Directly activate a package for a tenant without a payment receipt. Use only for manual corrections or special cases.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={emergencyTenantId} onChange={e => setEmergencyTenantId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 cursor-pointer">
            <option value="">Select tenant...</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.subscription_plan || 'trial'})</option>
            ))}
          </select>
          <select value={emergencyPlan} onChange={e => setEmergencyPlan(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 cursor-pointer">
            <option value="trial">Trial (10 days / 20 with promo)</option>
            <option value="ruby">Ruby – TZS 20,000</option>
            <option value="diamond">Diamond – TZS 35,000</option>
            <option value="tanzanite">Tanzanite – TZS 50,000</option>
          </select>
          <button onClick={handleEmergencyOverride}
            className="py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl cursor-pointer border-none transition-colors flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Apply Override
          </button>
        </div>
      </div>
    </div>
  );
}
