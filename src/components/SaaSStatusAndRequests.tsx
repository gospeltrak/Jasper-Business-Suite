import React, { useState, useEffect, useCallback } from 'react';
import { Activity, ShieldAlert, CheckCircle, XCircle, Gift, Search, RefreshCw, FileText, Clock, Package, User, AlertCircle } from 'lucide-react';
import { getSecureDataBridgeClient } from '../secureDataBridge';
import { normalizeSubscriptionPlanId, SUBSCRIPTION_PLANS } from '../utils/subscription';
import {
  activateTenantPackage,
  configureMultiBranchRollout,
  configureTenantBranchCapacity,
  loadTenantBranchAccess,
  type SuperAdminBranchAccess,
} from '../utils/superAdminData';

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
  receipt_file_url?: string | null;
  note: string | null;
  submitted_by: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejected_reason?: string;
}

interface TenantRecord {
  id: string;
  name: string;
  subscription_plan: string;
  active_package_id?: string | null;
  subscription_status?: string;
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
  const [adminReason, setAdminReason] = useState('');
  const [enableBranches, setEnableBranches] = useState(true);
  const [branchAccess, setBranchAccess] = useState<SuperAdminBranchAccess | null>(null);
  const [branchAccessLoading, setBranchAccessLoading] = useState(false);
  const [additionalBranchSlots, setAdditionalBranchSlots] = useState(0);
  const [rolloutReason, setRolloutReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const client: any = await getSecureDataBridgeClient();

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
        .select('id, name, subscription_plan, active_package_id, subscription_status, created_at')
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

  const loadSelectedTenantBranchAccess = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setBranchAccess(null);
      setAdditionalBranchSlots(0);
      return;
    }
    setBranchAccessLoading(true);
    try {
      const response = await loadTenantBranchAccess(tenantId);
      setBranchAccess(response.branchAccess);
      setAdditionalBranchSlots(response.branchAccess.additionalGrantedSlots);
    } catch (error: any) {
      setBranchAccess(null);
      setMessage({ text: `Branch access could not be loaded: ${error.message}`, type: 'error' });
    } finally {
      setBranchAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSelectedTenantBranchAccess(emergencyTenantId);
  }, [emergencyTenantId, loadSelectedTenantBranchAccess]);

  // ── APPROVE ──────────────────────────────────────────────────────────────
  const handleApprove = async (proof: PaymentProof) => {
    setProcessingId(proof.id);
    setMessage(null);
    try {
      const normalizedPlan = normalizeSubscriptionPlanId(proof.requested_package_id);
      const now = new Date().toISOString();
      if (normalizedPlan === 'trial' || normalizedPlan === 'essential' || normalizedPlan === 'business' || normalizedPlan === 'wholesale') {
        throw new Error('The requested package could not be normalized.');
      }
      await activateTenantPackage(proof.tenant_id, {
        packageId: normalizedPlan,
        durationDays: 30,
        reason: `Payment proof ${proof.id} approved by Super Admin.`,
        enableBranches: normalizedPlan === 'tanzanite',
        paymentProofId: proof.id,
      });
      setProofs(prev => prev.map(p => p.id === proof.id ? { ...p, status: 'approved', reviewed_at: now } : p));
      setTenants(prev => prev.map(t => t.id === proof.tenant_id ? {
        ...t,
        subscription_plan: normalizedPlan,
        active_package_id: normalizedPlan,
        subscription_status: 'active',
      } : t));
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
      const client: any = await getSecureDataBridgeClient();
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

  const handleViewReceipt = async (proof: PaymentProof) => {
    if (!proof.receipt_file_url) {
      setMessage({ text: 'This older request contains a receipt filename only. Ask the tenant to resubmit the actual file.', type: 'error' });
      return;
    }
    try {
      const client: any = await getSecureDataBridgeClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Your secure session has expired. Sign in again.');
      const response = await fetch(`/api/super-admin/payment-proofs/${encodeURIComponent(proof.id)}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.signedUrl) throw new Error(payload?.error || 'Signed receipt link was not created.');
      window.open(payload.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      setMessage({ text: `Receipt could not be opened: ${error?.message || 'Unknown error'}`, type: 'error' });
    }
  };

  // ── EMERGENCY OVERRIDE ───────────────────────────────────────────────────
  const handleEmergencyOverride = async () => {
    if (!emergencyTenantId) { setMessage({ text: 'Select a tenant first.', type: 'error' }); return; }
    if (!adminReason.trim()) { setMessage({ text: 'Enter an administrator reason first.', type: 'error' }); return; }
    try {
      const normalizedPlan = normalizeSubscriptionPlanId(emergencyPlan);
      if (normalizedPlan === 'trial' || normalizedPlan === 'essential' || normalizedPlan === 'business' || normalizedPlan === 'wholesale') {
        throw new Error('Select Ruby, Diamond, or Tanzanite.');
      }
      await activateTenantPackage(emergencyTenantId, {
        packageId: normalizedPlan,
        durationDays: 30,
        reason: adminReason.trim(),
        enableBranches: normalizedPlan === 'tanzanite' && enableBranches,
      });
      setTenants(prev => prev.map(t => t.id === emergencyTenantId ? {
        ...t,
        subscription_plan: normalizedPlan,
        active_package_id: normalizedPlan,
        subscription_status: 'active',
      } : t));
      setMessage({ text: `✅ Emergency override applied. Tenant is now on ${SUBSCRIPTION_PLANS[normalizedPlan]?.name}.`, type: 'success' });
      setAdminReason('');
      await loadSelectedTenantBranchAccess(emergencyTenantId);
    } catch (e: any) {
      setMessage({ text: `Emergency override failed: ${e.message}`, type: 'error' });
    }
  };

  const handleBranchCapacityUpdate = async () => {
    if (!emergencyTenantId) { setMessage({ text: 'Select a tenant first.', type: 'error' }); return; }
    if (!adminReason.trim()) { setMessage({ text: 'Enter an administrator reason first.', type: 'error' }); return; }
    try {
      await configureTenantBranchCapacity(emergencyTenantId, {
        additionalBranchSlots,
        featureEnabled: enableBranches,
        reason: adminReason.trim(),
      });
      setMessage({ text: `✅ Branch access updated. Tenant limit is ${2 + additionalBranchSlots} total branches.`, type: 'success' });
      setAdminReason('');
      await loadSelectedTenantBranchAccess(emergencyTenantId);
    } catch (e: any) {
      setMessage({ text: `Branch capacity update failed: ${e.message}`, type: 'error' });
    }
  };

  const handleDatabaseRolloutUpdate = async (enabled: boolean) => {
    if (!rolloutReason.trim()) { setMessage({ text: 'Enter a rollout reason first.', type: 'error' }); return; }
    try {
      const response = await configureMultiBranchRollout({ enabled, reason: rolloutReason.trim() });
      setMessage({
        text: response.serverRolloutEnabled
          ? `✅ Database multi-branch rollout ${enabled ? 'enabled' : 'disabled'}.`
          : `Database rollout updated, but MULTIBRANCH_FEATURE_ENABLED is still off on the server.`,
        type: response.serverRolloutEnabled ? 'success' : 'error',
      });
      setRolloutReason('');
      if (emergencyTenantId) await loadSelectedTenantBranchAccess(emergencyTenantId);
    } catch (e: any) {
      setMessage({ text: `Rollout update failed: ${e.message}`, type: 'error' });
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
                    <button
                      type="button"
                      onClick={() => handleViewReceipt(proof)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-[9px] font-bold text-emerald-300 transition-colors hover:border-emerald-500 hover:text-emerald-200"
                    >
                      <FileText className="h-3 w-3" />
                      Open receipt
                    </button>
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

                {proof.status === 'approved' && proof.reviewed_at && (
                  <p className="text-[10px] text-emerald-600">✅ Approved on {new Date(proof.reviewed_at).toLocaleString()}</p>
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
              <option key={t.id} value={t.id}>{t.name} ({t.active_package_id || t.subscription_plan || 'trial'})</option>
            ))}
          </select>
          <select value={emergencyPlan} onChange={e => setEmergencyPlan(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 cursor-pointer">
            <option value="trial">Trial (10 days / 20 with promo)</option>
            <option value="ruby">Ruby – TZS 15,000</option>
            <option value="diamond">Diamond – TZS 30,000</option>
            <option value="tanzanite">Tanzanite – TZS 50,000</option>
          </select>
          <button onClick={handleEmergencyOverride}
            className="py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl cursor-pointer border-none transition-colors flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Apply Override
          </button>
        </div>
        <input
          type="text"
          value={adminReason}
          onChange={event => setAdminReason(event.target.value)}
          placeholder="Required administrator reason / ticket reference"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500"
        />

        {emergencyPlan === 'tanzanite' ? (
          <label className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3 text-xs font-bold text-cyan-200">
            <input
              type="checkbox"
              checked={enableBranches}
              onChange={event => setEnableBranches(event.target.checked)}
              className="h-4 w-4"
            />
            Enable Tanzanite Branches for this tenant
          </label>
        ) : null}

        {emergencyTenantId ? (
          <div className="space-y-4 rounded-2xl border border-cyan-500/20 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Tenant Branch Access</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Tanzanite includes 2 total branches. Extra slots apply only to this tenant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadSelectedTenantBranchAccess(emergencyTenantId)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-black text-slate-200"
              >
                {branchAccessLoading ? 'Loading…' : 'Refresh access'}
              </button>
            </div>

            {branchAccess ? (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-[8px] font-bold uppercase text-slate-500">Current branches</p>
                    <p className="mt-1 text-lg font-black text-white">{branchAccess.currentPhysicalBranchCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-[8px] font-bold uppercase text-slate-500">Default total</p>
                    <p className="mt-1 text-lg font-black text-white">{branchAccess.defaultTotalBranches}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-[8px] font-bold uppercase text-slate-500">Extra granted</p>
                    <p className="mt-1 text-lg font-black text-cyan-300">+{branchAccess.additionalGrantedSlots}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-[8px] font-bold uppercase text-slate-500">Effective total</p>
                    <p className="mt-1 text-lg font-black text-emerald-400">{branchAccess.effectiveTotalBranches}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className="mb-1 block text-[9px] font-bold uppercase text-slate-500">Additional branch slots</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={additionalBranchSlots}
                      onChange={event => setAdditionalBranchSlots(Math.max(0, Number(event.target.value) || 0))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    {[1, 2, 3].map(increment => (
                      <button
                        key={increment}
                        type="button"
                        onClick={() => setAdditionalBranchSlots(current => current + increment)}
                        className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2.5 text-xs font-black text-cyan-300"
                      >
                        +{increment}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBranchCapacityUpdate}
                  className="w-full rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-500"
                >
                  Save Tenant Branch Access
                </button>

                <div className="grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-3">
                  <p className={branchAccess.serverRolloutEnabled ? 'text-emerald-400' : 'text-rose-400'}>
                    Server flag: {branchAccess.serverRolloutEnabled ? 'ON' : 'OFF'}
                  </p>
                  <p className={branchAccess.databaseRolloutEnabled ? 'text-emerald-400' : 'text-rose-400'}>
                    Database rollout: {branchAccess.databaseRolloutEnabled ? 'ON' : 'OFF'}
                  </p>
                  <p className={branchAccess.tenantFeatureEnabled ? 'text-emerald-400' : 'text-amber-400'}>
                    Tenant grant: {branchAccess.tenantFeatureEnabled ? 'ENABLED' : 'DISABLED'}
                  </p>
                </div>

                {!branchAccess.databaseRolloutEnabled ? (
                  <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="text-[10px] font-bold text-rose-300">
                      Database rollout is off. Enable it only for the controlled Tanzanite test.
                    </p>
                    <input
                      value={rolloutReason}
                      onChange={event => setRolloutReason(event.target.value)}
                      placeholder="Required rollout reason"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleDatabaseRolloutUpdate(true)}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-black text-white"
                    >
                      Enable Database Rollout
                    </button>
                  </div>
                ) : null}
              </>
            ) : branchAccessLoading ? (
              <p className="text-xs text-slate-400">Loading branch access…</p>
            ) : (
              <p className="text-xs text-rose-400">Branch access is unavailable for this tenant.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
