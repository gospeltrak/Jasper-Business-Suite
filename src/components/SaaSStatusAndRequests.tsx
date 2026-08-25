import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, ShieldAlert, CheckCircle, XCircle, Gift, Search, RefreshCw, FileText, Clock, Package, User, AlertCircle, Bell, Check } from 'lucide-react';
import { getSecureDataBridgeClient } from '../secureDataBridge';
import { normalizeSubscriptionPlanId, SUBSCRIPTION_PLANS } from '../utils/subscription';
import {
  activateTenantPackage,
  configureMultiBranchRollout,
  configureTenantBranchCapacity,
  loadTenantBranchAccess,
  sendSuperAdminNotification,
  sendSuperAdminAffiliateNotification,
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

interface NamedRecipient {
  id: string;
  name: string;
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
  const emergencyActivationKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  // Shared tenant search + multi-select, used by the Grant Free Time and
  // Send Notification tools below -- independent from emergencyTenantId
  // (Emergency Override stays single-tenant, tied to its own branch-access
  // panel, which doesn't make sense for a bulk action).
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());

  const [grantDurationValue, setGrantDurationValue] = useState(30);
  const [grantDurationUnit, setGrantDurationUnit] = useState<'days' | 'months'>('days');
  const [grantPackage, setGrantPackage] = useState<'ruby' | 'diamond' | 'tanzanite'>('diamond');
  const [grantReason, setGrantReason] = useState('');
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  // Free/emergency grants bypass payment entirely, so a second explicit
  // confirmation step is required before they actually execute.
  const [grantConfirmOpen, setGrantConfirmOpen] = useState(false);

  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySubmitting, setNotifySubmitting] = useState(false);

  // Send Notification can also target affiliates or partners instead of
  // tenants -- these have their own recipient lists/search, independent of
  // the shared tenant picker above (Grant Free Time only ever applies to
  // tenants, so it stays wired to selectedTenantIds alone).
  const [affiliates, setAffiliates] = useState<NamedRecipient[]>([]);
  const [partners, setPartners] = useState<NamedRecipient[]>([]);
  const [notifyRecipientType, setNotifyRecipientType] = useState<'tenants' | 'affiliates' | 'partners'>('tenants');
  const [affiliateSearchQuery, setAffiliateSearchQuery] = useState('');
  const [selectedAffiliateIds, setSelectedAffiliateIds] = useState<Set<string>>(new Set());
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());

  const filteredTenantsForPicker = tenants.filter(t =>
    !tenantSearchQuery.trim() || t.name.toLowerCase().includes(tenantSearchQuery.trim().toLowerCase())
  );

  const toggleTenantSelection = (id: string) => {
    setSelectedTenantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFilteredTenants = () => {
    setSelectedTenantIds(new Set(filteredTenantsForPicker.map(t => t.id)));
  };

  const clearTenantSelection = () => setSelectedTenantIds(new Set());

  const filteredAffiliatesForPicker = affiliates.filter(a =>
    !affiliateSearchQuery.trim() || a.name.toLowerCase().includes(affiliateSearchQuery.trim().toLowerCase())
  );
  const toggleAffiliateSelection = (id: string) => {
    setSelectedAffiliateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllFilteredAffiliates = () => setSelectedAffiliateIds(new Set(filteredAffiliatesForPicker.map(a => a.id)));
  const clearAffiliateSelection = () => setSelectedAffiliateIds(new Set());

  const filteredPartnersForPicker = partners.filter(p =>
    !partnerSearchQuery.trim() || p.name.toLowerCase().includes(partnerSearchQuery.trim().toLowerCase())
  );
  const togglePartnerSelection = (id: string) => {
    setSelectedPartnerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllFilteredPartners = () => setSelectedPartnerIds(new Set(filteredPartnersForPicker.map(p => p.id)));
  const clearPartnerSelection = () => setSelectedPartnerIds(new Set());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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

      // Load affiliates and partners for the Send Notification recipient picker
      const { data: affiliatesData, error: affiliatesError } = await client
        .from('affiliates')
        .select('id, display_name')
        .order('display_name', { ascending: true })
        .limit(500);
      if (!affiliatesError && affiliatesData) {
        setAffiliates(affiliatesData.map((a: any) => ({ id: a.id, name: a.display_name || 'Unnamed affiliate' })));
      }

      const { data: partnersData, error: partnersError } = await client
        .from('affiliate_partners')
        .select('id, display_name')
        .order('display_name', { ascending: true })
        .limit(500);
      if (!partnersError && partnersData) {
        setPartners(partnersData.map((p: any) => ({ id: p.id, name: p.display_name || 'Unnamed partner' })));
      }
    } catch (e) {
      if (!silent) setMessage({ text: 'Failed to load data. Check Supabase connection.', type: 'error' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Poll in the background so newly-submitted tenant requests show up without
  // an admin needing to manually reload the tab.
  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 20000);
    return () => clearInterval(interval);
  }, [loadData]);

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
      const activation = await activateTenantPackage(proof.tenant_id, {
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
      const expiryLabel = activation?.endAt
        ? new Date(activation.endAt).toLocaleString()
        : 'the authoritative database expiry';
      setMessage({
        text: `✅ Approved! ${proof.tenant_name} is now on ${SUBSCRIPTION_PLANS[normalizedPlan]?.name || normalizedPlan} until ${expiryLabel}.`,
        type: 'success',
      });
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
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Your secure session has expired. Sign in again.');
      const response = await fetch(`/api/super-admin/payment-proofs/${encodeURIComponent(proof.id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.proof) throw new Error(payload?.error || 'Payment request could not be rejected.');
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
      const fingerprint = `${emergencyTenantId}:${normalizedPlan}:${adminReason.trim()}`;
      if (emergencyActivationKeyRef.current?.fingerprint !== fingerprint) {
        emergencyActivationKeyRef.current = {
          fingerprint,
          key: `admin-grant:${crypto.randomUUID()}`,
        };
      }
      const activation = await activateTenantPackage(emergencyTenantId, {
        packageId: normalizedPlan,
        durationDays: 30,
        reason: adminReason.trim(),
        enableBranches: normalizedPlan === 'tanzanite' && enableBranches,
        idempotencyKey: emergencyActivationKeyRef.current.key,
      });
      emergencyActivationKeyRef.current = null;
      setTenants(prev => prev.map(t => t.id === emergencyTenantId ? {
        ...t,
        subscription_plan: normalizedPlan,
        active_package_id: normalizedPlan,
        subscription_status: 'active',
      } : t));
      const expiryLabel = activation?.endAt
        ? new Date(activation.endAt).toLocaleString()
        : 'the authoritative database expiry';
      setMessage({
        text: `✅ Emergency override applied. Tenant is now on ${SUBSCRIPTION_PLANS[normalizedPlan]?.name} until ${expiryLabel}.`,
        type: 'success',
      });
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

  // ── GRANT FREE TIME (bulk) ───────────────────────────────────────────────
  // Free grants bypass payment, so requesting one only validates the form
  // and opens a confirmation step; executeGrantFreeTime (below) is the one
  // that actually calls the activation API, only reachable after confirming.
  const requestGrantFreeTime = () => {
    if (selectedTenantIds.size === 0) { setMessage({ text: 'Select at least one tenant first.', type: 'error' }); return; }
    if (!grantReason.trim()) { setMessage({ text: 'Enter an administrator reason first.', type: 'error' }); return; }
    const durationDays = grantDurationUnit === 'months' ? Math.round(grantDurationValue * 30) : Math.round(grantDurationValue);
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 366) {
      setMessage({ text: 'Duration must be between 1 day and 366 days.', type: 'error' });
      return;
    }
    setMessage(null);
    setGrantConfirmOpen(true);
  };

  const executeGrantFreeTime = async () => {
    const durationDays = grantDurationUnit === 'months' ? Math.round(grantDurationValue * 30) : Math.round(grantDurationValue);
    setGrantConfirmOpen(false);
    setGrantSubmitting(true);
    setMessage(null);
    const targetIds = Array.from(selectedTenantIds);
    let succeeded = 0;
    let failed = 0;
    for (const tenantId of targetIds) {
      try {
        await activateTenantPackage(tenantId, {
          packageId: grantPackage,
          durationDays,
          reason: grantReason.trim(),
          enableBranches: false,
          idempotencyKey: `admin-grant:${tenantId}:${crypto.randomUUID()}`,
        });
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    setTenants(prev => prev.map(t => selectedTenantIds.has(t.id) ? {
      ...t,
      subscription_plan: grantPackage,
      active_package_id: grantPackage,
      subscription_status: 'active',
    } : t));
    setMessage({
      text: `✅ Granted ${SUBSCRIPTION_PLANS[grantPackage]?.name} for ${durationDays} day${durationDays === 1 ? '' : 's'} to ${succeeded} tenant${succeeded === 1 ? '' : 's'}.${failed > 0 ? ` ${failed} failed.` : ''}`,
      type: failed > 0 && succeeded === 0 ? 'error' : 'success',
    });
    setGrantReason('');
    setGrantSubmitting(false);
  };

  // ── SEND NOTIFICATION (bulk) ─────────────────────────────────────────────
  const notifyRecipientCount = notifyRecipientType === 'tenants'
    ? selectedTenantIds.size
    : notifyRecipientType === 'affiliates'
      ? selectedAffiliateIds.size
      : selectedPartnerIds.size;

  const handleSendNotification = async () => {
    if (notifyRecipientCount === 0) { setMessage({ text: `Select at least one ${notifyRecipientType === 'tenants' ? 'tenant' : notifyRecipientType === 'affiliates' ? 'affiliate' : 'partner'} first.`, type: 'error' }); return; }
    if (!notifyTitle.trim() || !notifyMessage.trim()) { setMessage({ text: 'Enter a title and message first.', type: 'error' }); return; }
    setNotifySubmitting(true);
    setMessage(null);
    try {
      if (notifyRecipientType === 'tenants') {
        const result = await sendSuperAdminNotification({
          tenantIds: Array.from(selectedTenantIds),
          title: notifyTitle.trim(),
          message: notifyMessage.trim(),
        });
        setMessage({ text: `✅ Notification sent to ${result?.tenantsSent ?? selectedTenantIds.size} tenant(s). It will appear in their notification inbox.`, type: 'success' });
      } else {
        const result = await sendSuperAdminAffiliateNotification({
          affiliateIds: notifyRecipientType === 'affiliates' ? Array.from(selectedAffiliateIds) : [],
          partnerIds: notifyRecipientType === 'partners' ? Array.from(selectedPartnerIds) : [],
          title: notifyTitle.trim(),
          message: notifyMessage.trim(),
        });
        const sentCount = notifyRecipientType === 'affiliates' ? (result?.affiliatesSent ?? selectedAffiliateIds.size) : (result?.partnersSent ?? selectedPartnerIds.size);
        setMessage({ text: `✅ Notification sent to ${sentCount} ${notifyRecipientType === 'affiliates' ? 'affiliate' : 'partner'}(s). It will appear in their notification inbox.`, type: 'success' });
      }
      setNotifyTitle('');
      setNotifyMessage('');
    } catch (e: any) {
      setMessage({ text: `Notification failed: ${e.message}`, type: 'error' });
    } finally {
      setNotifySubmitting(false);
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
          <button onClick={() => loadData()} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer transition-colors">
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

      {/* Shared tenant picker — search + multi-select, used by Grant Free
          Time and Send Notification below */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-black text-white">Select Tenants</h3>
          <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 font-bold uppercase">
            {selectedTenantIds.size} selected
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={tenantSearchQuery}
            onChange={e => setTenantSearchQuery(e.target.value)}
            placeholder="Search tenants by name..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={selectAllFilteredTenants}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 cursor-pointer">
            Select all {tenantSearchQuery.trim() ? 'shown' : `(${filteredTenantsForPicker.length})`}
          </button>
          <button type="button" onClick={clearTenantSelection}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 cursor-pointer">
            Clear selection
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-slate-800 p-2">
          {filteredTenantsForPicker.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No tenants match your search.</p>
          ) : filteredTenantsForPicker.map(t => {
            const isChecked = selectedTenantIds.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTenantSelection(t.id)}
                aria-pressed={isChecked}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors ${isChecked ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-800/50 border border-transparent hover:bg-slate-800'}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${isChecked ? 'border-cyan-500 bg-cyan-500' : 'border-slate-600 bg-slate-900'}`}>
                  {isChecked && <Check className="h-2.5 w-2.5 text-slate-950" strokeWidth={4} />}
                </span>
                <span className="text-xs font-bold text-white truncate">{t.name}</span>
                <span className="text-[9px] text-slate-500 font-mono shrink-0">{t.active_package_id || t.subscription_plan || 'trial'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grant Free Time */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-black text-white">Grant Free Time</h3>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">Admin Only</span>
        </div>
        <p className="text-[10px] text-slate-400">Give the selected tenant(s) free access for a set number of days or months, no payment required. Applies to everyone selected above.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={grantPackage} onChange={e => setGrantPackage(e.target.value as 'ruby' | 'diamond' | 'tanzanite')}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer">
            <option value="ruby">Ruby</option>
            <option value="diamond">Diamond</option>
            <option value="tanzanite">Tanzanite</option>
          </select>
          <input
            type="number"
            min={1}
            max={366}
            value={grantDurationValue}
            onChange={e => setGrantDurationValue(Math.max(1, Number(e.target.value) || 1))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
          />
          <div className="grid grid-cols-2 rounded-xl bg-slate-800 p-1 border border-slate-700">
            <button type="button" onClick={() => setGrantDurationUnit('days')}
              className={`py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${grantDurationUnit === 'days' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>
              Days
            </button>
            <button type="button" onClick={() => setGrantDurationUnit('months')}
              className={`py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${grantDurationUnit === 'months' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>
              Months
            </button>
          </div>
        </div>
        <input
          type="text"
          value={grantReason}
          onChange={e => setGrantReason(e.target.value)}
          placeholder="Required administrator reason / ticket reference"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={requestGrantFreeTime}
          disabled={grantSubmitting || selectedTenantIds.size === 0}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-colors cursor-pointer border-none flex items-center justify-center gap-1.5"
        >
          <Gift className="w-3.5 h-3.5" />
          {grantSubmitting ? 'Granting…' : `Grant to ${selectedTenantIds.size} tenant${selectedTenantIds.size === 1 ? '' : 's'}`}
        </button>

        {grantConfirmOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-black text-white">Confirm free grant</h4>
              </div>
              <p className="text-xs text-slate-300 leading-5">
                You are about to grant <span className="font-black text-emerald-400">{SUBSCRIPTION_PLANS[grantPackage]?.name}</span> for{' '}
                <span className="font-black text-white">{grantDurationValue} {grantDurationUnit}</span> to{' '}
                <span className="font-black text-white">{selectedTenantIds.size} tenant{selectedTenantIds.size === 1 ? '' : 's'}</span>, free of charge.
                This will not be recorded as revenue.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setGrantConfirmOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer border-none">
                  Cancel
                </button>
                <button type="button" onClick={executeGrantFreeTime}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl cursor-pointer border-none">
                  Yes, grant it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send Notification */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-black text-white">Send Notification</h3>
        </div>
        <p className="text-[10px] text-slate-400">Sends a real in-app notification — it lands in the recipient's notification inbox.</p>

        <div className="grid grid-cols-3 rounded-xl bg-slate-800 p-1 border border-slate-700">
          {(['tenants', 'affiliates', 'partners'] as const).map(type => (
            <button key={type} type="button" onClick={() => setNotifyRecipientType(type)}
              className={`py-1.5 rounded-lg text-[10px] font-bold capitalize cursor-pointer transition-all ${notifyRecipientType === type ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>
              {type}
            </button>
          ))}
        </div>

        {notifyRecipientType === 'tenants' ? (
          <p className="text-[10px] text-slate-500">Uses the tenant selection above ({selectedTenantIds.size} selected).</p>
        ) : notifyRecipientType === 'affiliates' ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" value={affiliateSearchQuery} onChange={e => setAffiliateSearchQuery(e.target.value)}
                placeholder="Search affiliates by name..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-amber-500" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={selectAllFilteredAffiliates}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 cursor-pointer">
                Select all {affiliateSearchQuery.trim() ? 'shown' : `(${filteredAffiliatesForPicker.length})`}
              </button>
              <button type="button" onClick={clearAffiliateSelection}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 cursor-pointer">
                Clear selection
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-800 p-2">
              {filteredAffiliatesForPicker.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No affiliates match your search.</p>
              ) : filteredAffiliatesForPicker.map(a => {
                const isChecked = selectedAffiliateIds.has(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleAffiliateSelection(a.id)} aria-pressed={isChecked}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors ${isChecked ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50 border border-transparent hover:bg-slate-800'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${isChecked ? 'border-amber-500 bg-amber-500' : 'border-slate-600 bg-slate-900'}`}>
                      {isChecked && <Check className="h-2.5 w-2.5 text-slate-950" strokeWidth={4} />}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{a.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" value={partnerSearchQuery} onChange={e => setPartnerSearchQuery(e.target.value)}
                placeholder="Search partners by name..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-amber-500" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={selectAllFilteredPartners}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 cursor-pointer">
                Select all {partnerSearchQuery.trim() ? 'shown' : `(${filteredPartnersForPicker.length})`}
              </button>
              <button type="button" onClick={clearPartnerSelection}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 cursor-pointer">
                Clear selection
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-800 p-2">
              {filteredPartnersForPicker.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No partners match your search.</p>
              ) : filteredPartnersForPicker.map(p => {
                const isChecked = selectedPartnerIds.has(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => togglePartnerSelection(p.id)} aria-pressed={isChecked}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors ${isChecked ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50 border border-transparent hover:bg-slate-800'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${isChecked ? 'border-amber-500 bg-amber-500' : 'border-slate-600 bg-slate-900'}`}>
                      {isChecked && <Check className="h-2.5 w-2.5 text-slate-950" strokeWidth={4} />}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <input
          type="text"
          value={notifyTitle}
          onChange={e => setNotifyTitle(e.target.value)}
          placeholder="Notification title"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500"
        />
        <textarea
          value={notifyMessage}
          onChange={e => setNotifyMessage(e.target.value)}
          placeholder="Notification message"
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 resize-none"
        />
        <button
          type="button"
          onClick={handleSendNotification}
          disabled={notifySubmitting || notifyRecipientCount === 0}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-colors cursor-pointer border-none flex items-center justify-center gap-1.5"
        >
          <Bell className="w-3.5 h-3.5" />
          {notifySubmitting ? 'Sending…' : `Send to ${notifyRecipientCount} ${notifyRecipientType === 'tenants' ? 'tenant' : notifyRecipientType === 'affiliates' ? 'affiliate' : 'partner'}${notifyRecipientCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
