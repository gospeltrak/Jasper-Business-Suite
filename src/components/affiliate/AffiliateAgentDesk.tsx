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
  CalendarPlus, CheckCircle, ClipboardPlus,
  Coins, Copy, Edit2, ExternalLink, Eye, FileText,
  HardDrive, Info, LoaderCircle, Lock, Menu, MessageSquare, Monitor,
  RefreshCw, Send, Settings, ShieldAlert, ShieldCheck, TrendingUp,
  Users, Video, Wallet, XCircle, Zap, AlertCircle,
  Download, LogOut, PhoneCall,
} from 'lucide-react';
import {
  AffiliateAgentWorkspace,
  createAffiliateMeeting,
  createAffiliateTask,
  loadAffiliateAgentWorkspace,
} from '../../utils/affiliateWorkspace';
import {
  isOnline,
  initOfflineSync,
  dbWrite,
  clearAffiliateSession,
  flushSyncQueue,
  enqueueSyncItem,
} from '../../utils/offlineSync';
import { useGlobalAdSettings } from '../../utils/adPlacement';
import { sanitizeTrustedHtml } from '../../utils/safeHtml';
import GlobalStickyAd from '../GlobalStickyAd';
import SaaSHardwarePOS from '../SaaSHardwarePOS';
import SaaSHardwareInventory from '../SaaSHardwareInventory';
import {
  SubAffiliateProfile,
  MonthlyReconciliationRow,
  calculateCommissionBreakdown,
  calculateSuperAgentNetworkTotals,
  buildReconciliationRow,
  formatTZS,
  maskTIN,
  WITHHOLDING_TAX_ACTIVE,
  TinStatus,
} from '../../utils/commissionEngine';

function numberValue(value: unknown): number {
  return Number(value || 0);
}

type DashTab = 'overview' | 'reconciliation' | 'affiliates' | 'customers' | 'code-link' | 'tutorials' | 'conferencing' | 'hw-pos' | 'hw-inventory' | 'settings';
type StatusAction = 'deactivate' | 'suspend' | 'review' | 'activate';
type ReferredTenantRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  phoneNumber: string;
  packageName: string;
  paymentStatus: string;
  amountPaid: number;
  promoCodeUsed: string;
  subscriptionEndDate: string;
  daysRemaining: number;
  registeredAt: string;
  subAffiliateId: string;
};

const NAV_TABS: { id: DashTab; label: string; icon: any; desc: string }[] = [
  { id: 'overview',       label: 'Network Overview',       icon: BarChart3,     desc: 'Team performance & earnings' },
  { id: 'reconciliation', label: 'Monthly Reconciliation', icon: Coins,         desc: '20% split & withholding' },
  { id: 'affiliates',     label: 'Manage Sub-Affiliates',  icon: Users,         desc: 'Recruit, suspend, mirror' },
  { id: 'customers',      label: 'Network Customers',      icon: ShieldCheck,   desc: 'Customers from your team' },
  { id: 'code-link',      label: 'Code & Link',            icon: Copy,          desc: 'Your partner code & referral link' },
  { id: 'tutorials',      label: 'Tutorials & Tasks',      icon: FileText,      desc: 'Training for your team' },
  { id: 'conferencing',   label: 'Video Conferencing',     icon: Video,         desc: 'Schedule team calls' },
  { id: 'hw-pos',         label: 'Hardware POS',           icon: Monitor,       desc: 'POS orders in network' },
  { id: 'hw-inventory',   label: 'Hardware Inventory',     icon: HardDrive,     desc: 'Devices in network' },
  { id: 'settings',       label: 'Settings',               icon: Settings,      desc: 'Profile & preferences' },
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

function normalizeTinStatus(tinNumber?: string | null, status?: string | null): TinStatus {
  const cleanTin = String(tinNumber || '').trim();
  if (!cleanTin || cleanTin.toUpperCase() === 'N/A') return 'not_submitted';
  return (status || 'submitted') as TinStatus;
}

function readablePlan(value?: string | null): string {
  const plan = String(value || 'free').toLowerCase();
  if (plan === 'trial' || plan === 'free') return 'Free';
  if (plan === 'ruby') return 'Ruby';
  if (plan === 'diamond') return 'Diamond';
  if (plan === 'tanzanite') return 'Tanzanite';
  return value || 'Free';
}

function daysUntil(dateValue?: string | null): number {
  if (!dateValue) return 0;
  const end = new Date(dateValue).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AffiliateAgentDesk({ onLogout }: { onLogout: () => void }) {
  const [workspace, setWorkspace] = useState<AffiliateAgentWorkspace | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState(isOnline());
  const adSettings = useGlobalAdSettings();

  useEffect(() => {
    initOfflineSync((result) => {
      setNotice(`✅ ${result.synced} changes synced to database.`);
    });
    const up   = () => { setIsNetworkOnline(true);  flushSyncQueue(); };
    const down = () => setIsNetworkOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online',  up);
      window.removeEventListener('offline', down);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuggestions, setCodeSuggestions] = useState<string[]>([]);

  const savePartnerCode = async () => {
    if (partnerInfo?.promoCodeLocked) {
      setCodeError('Your promo code has already been changed once and is now permanently locked.');
      return;
    }
    const cleaned = newCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleaned) { setCodeError('Code must contain letters or numbers only.'); return; }
    const all: any[] = JSON.parse(localStorage.getItem('saas_immersive_affiliates') || '[]');
    const taken = all.some((a: any) => a.promoCode?.toUpperCase() === cleaned && a.id !== partnerId);
    if (taken) {
      const sugg: string[] = [];
      for (const sfx of ['1','2','3','_PRO','_TZ','_EA']) {
        const s = `${cleaned}${sfx}`;
        if (!all.some((a: any) => a.promoCode?.toUpperCase() === s)) { sugg.push(s); if (sugg.length >= 3) break; }
      }
      setCodeError(`"${cleaned}" is already taken.`);
      setCodeSuggestions(sugg);
      return;
    }
    // Save to Supabase — update by user_id (auth) or id (row) in affiliate_partners
    const supabaseUserId = partnerInfo?.supabaseUserId;
    const supabaseRowId  = partnerInfo?.id;
    let dbConfirmedLock = false;

    if (supabaseUserId || supabaseRowId) {
      try {
        const { getSecureDataBridgeClient } = await import('../../secureDataBridge');
        const client: any = await getSecureDataBridgeClient();
        const filter = supabaseUserId
          ? { column: 'user_id', value: supabaseUserId }
          : { column: 'id',      value: supabaseRowId };
        // Server-side guard: only updates if not already locked — prevents
        // a second edit slipping through even if stale UI state allowed the click.
        const { data: updatedRows } = await client.from('affiliate_partners')
          .update({ promo_code: cleaned, referral_slug: cleaned.toLowerCase(), promo_code_locked: true })
          .eq(filter.column, filter.value)
          .eq('promo_code_locked', false)
          .select('id');
        if (updatedRows && updatedRows.length > 0) {
          dbConfirmedLock = true;
        } else {
          // No row matched the "not locked" condition — someone already used the edit
          setCodeError('Your promo code has already been changed once and is now permanently locked.');
          return;
        }
      } catch {
        // Queue for later sync — still locks locally so the UI reflects it immediately
        enqueueSyncItem({
          table: 'affiliate_partners',
          operation: 'update',
          data: { promo_code: cleaned, referral_slug: cleaned.toLowerCase(), promo_code_locked: true },
          filter: supabaseUserId
            ? { column: 'user_id', value: supabaseUserId }
            : { column: 'id',      value: supabaseRowId },
          accountId: partnerId,
        });
        dbConfirmedLock = true;
      }
    }
    // Update localStorage — both stores
    const updated = all.map((a: any) => a.id === partnerId ? { ...a, promoCode: cleaned, promoCodeLocked: true } : a);
    localStorage.setItem('saas_immersive_affiliates', JSON.stringify(updated));
    const savedAff = JSON.parse(localStorage.getItem('jasper_logged_affiliate') || '{}');
    savedAff.promoCode = cleaned;
    savedAff.promoCodeLocked = true;
    localStorage.setItem('jasper_logged_affiliate', JSON.stringify(savedAff));
    // Update React state immediately — no refresh needed
    setPartnerInfo({ ...savedAff });
    setNotice(`✅ Partner code updated to ${cleaned}. This was your one-time edit — it is now locked.`);
    setEditingCode(false);
    setCodeError('');
    setCodeSuggestions([]);
  };

  // Sub-affiliates from localStorage (real data)
  const [subAffiliates, setSubAffiliates] = useState<SubAffiliateProfile[]>([]);
  const [customers, setCustomers] = useState<ReferredTenantRow[]>([]);
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

  // Partner identity — useState so it updates immediately after code change
  const [partnerInfo, setPartnerInfo] = useState<any>(() => {
    try {
      const s = localStorage.getItem('jasper_logged_affiliate');
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });
  const [partnerProfileDraft, setPartnerProfileDraft] = useState({ name: '', phone: '', payoutMethod: '', payoutPhone: '' });
  const [partnerPrefs, setPartnerPrefs] = useState({ emailUpdates: true, compactView: false });

  useEffect(() => {
    const prefsKey = `jasper_partner_preferences_${partnerInfo?.id || 'local'}`;
    let savedPrefs = partnerPrefs;
    try {
      savedPrefs = { ...partnerPrefs, ...JSON.parse(localStorage.getItem(prefsKey) || '{}') };
    } catch {}
    setPartnerProfileDraft({
      name: partnerInfo?.name || '',
      phone: partnerInfo?.phone || '',
      payoutMethod: partnerInfo?.paymentMethod || '',
      payoutPhone: partnerInfo?.payoutPhone || '',
    });
    setPartnerPrefs(savedPrefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerInfo?.id]);

  // Load latest profile from Supabase on mount to get fresh promo code
  useEffect(() => {
    const loadFreshProfile = async () => {
      try {
        const { getSecureDataBridgeClient } = await import('../../secureDataBridge');
        const client: any = await getSecureDataBridgeClient();

        let profile: any = null;
        const cols = 'id, user_id, display_name, promo_code, promo_code_locked, phone_whatsapp, payout_account, payout_method, tin_number, tin_status';

        // Try 1: Supabase auth session (reliable after Supabase login)
        const { data: authUser } = await client.auth.getUser();
        if (authUser?.user) {
          const { data } = await client.from('affiliate_partners')
            .select(cols)
            .eq('user_id', authUser.user.id)
            .maybeSingle();
          profile = data;
        }

        // Try 2: Match by promo_code saved in localStorage (after localStorage login)
        if (!profile && partnerInfo?.promoCode) {
          const { data } = await client.from('affiliate_partners')
            .select(cols)
            .eq('promo_code', partnerInfo.promoCode)
            .maybeSingle();
          profile = data;
        }

        // Try 3: Match by phone_whatsapp
        if (!profile && partnerInfo?.phone) {
          const phone = partnerInfo.phone.replace(/\D/g, '');
          const { data } = await client.from('affiliate_partners')
            .select(cols)
            .ilike('phone_whatsapp', `%${phone.slice(-9)}`)
            .maybeSingle();
          profile = data;
        }

        if (profile) {
          const code = profile.promo_code || partnerInfo?.promoCode || '';
          const updated = {
            ...partnerInfo,
            id: profile.id,
            supabaseUserId: profile.user_id,
            name: profile.display_name || partnerInfo?.name,
            promoCode: code,
            promo_code: code,
            promoCodeLocked: !!profile.promo_code_locked,
            payoutPhone: profile.payout_account,
            paymentMethod: profile.payout_method,
          };
          setPartnerInfo(updated);
          localStorage.setItem('jasper_logged_affiliate', JSON.stringify(updated));
        }
      } catch { /* offline — use localStorage */ }
    };
    loadFreshProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const partnerName = partnerInfo?.name || workspace?.agentName || 'Partner';
  const partnerId   = partnerInfo?.id || 'partner-local';

  // partnerCode: reads from session — NEVER generates random (that caused disappearing)
  const partnerCode = useMemo(() => {
    return partnerInfo?.promoCode || partnerInfo?.promo_code || '';
  }, [partnerInfo]);

  // Live referral link — updates as user types in the edit field
  const liveCode = editingCode && newCode ? newCode : partnerCode;

  const savePartnerSettings = async () => {
    const updated = {
      ...partnerInfo,
      name: partnerProfileDraft.name.trim() || partnerName,
      phone: partnerProfileDraft.phone.trim(),
      paymentMethod: partnerProfileDraft.payoutMethod.trim(),
      payoutPhone: partnerProfileDraft.payoutPhone.trim(),
    };
    setPartnerInfo(updated);
    localStorage.setItem('jasper_logged_affiliate', JSON.stringify(updated));
    localStorage.setItem(`jasper_partner_preferences_${partnerId}`, JSON.stringify(partnerPrefs));
    if (partnerId && partnerId !== 'partner-local') {
      const result = await dbWrite(
        'affiliate_partners',
        'update',
        {
          display_name: updated.name,
          phone_whatsapp: updated.phone || null,
          payout_method: updated.paymentMethod || null,
          payout_account: updated.payoutPhone || null,
        },
        { column: 'id', value: partnerId },
        partnerId,
      );
      setNotice(result.queued ? 'Profile saved locally and will sync when online.' : 'Profile settings saved.');
      return;
    }
    setNotice('Profile settings saved on this device.');
  };

  // ── Load data ───────────────────────────────────────────────

  const loadSubAffiliates = useCallback(async () => {
    let mapped: SubAffiliateProfile[] = [];

    // ── Try Supabase first — query affiliates WHERE parent_super_agent_id = partnerId ──
    if (partnerId && partnerId !== 'partner-local') {
      try {
        const { getSecureDataBridgeClient } = await import('../../secureDataBridge');
        const client: any = await getSecureDataBridgeClient();
        const { data } = await client.from('affiliates')
          .select('id, user_id, display_name, promo_code, referral_code, phone_whatsapp, payout_account, payout_method, tin_number, tin_status, total_revenue, gross_commission, withholding_tax, net_payout, customers_count, is_disabled, status, created_at')
          .eq('parent_super_agent_id', partnerId)
          .order('created_at', { ascending: false });

        if (data?.length) {
          mapped = data.map((a: any) => {
            const revenue = numberValue(a.total_revenue);
            const gross = a.gross_commission ? numberValue(a.gross_commission) : revenue * 0.15;
            const tinNumber = a.tin_number || '';
            return {
              id: a.id,
              userId: a.user_id,
              parentSuperAgentId: partnerId,
              name: a.display_name || 'Unnamed',
              phone: a.phone_whatsapp || '',
              email: '',
              promoCode: a.promo_code || a.referral_code || '',
              status: a.is_disabled ? 'suspended' : 'active',
              customersGenerated: a.customers_count || 0,
              revenueGenerated: revenue,
              grossCommission15: gross,
              withholdingTax5: gross * 0.05,
              netPayout: a.net_payout ? numberValue(a.net_payout) : gross,
              tinNumber,
              tinStatus: normalizeTinStatus(tinNumber, a.tin_status),
              pendingCommission: gross,
              paidCommission: 0,
              payoutMethod: a.payout_method || 'M-Pesa',
              payoutAccount: a.payout_account || '',
              isDisabled: !!a.is_disabled,
              createdAt: a.created_at || new Date().toISOString(),
            };
          });
        }
      } catch { /* offline — fall through to localStorage */ }
    }

    // ── Fallback / supplement: localStorage (offline-safe) ──────────────
    if (!mapped.length) {
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

        mapped = mine.map((a: any) => {
          const revenue = a.revenueDate || a.totalEarnings || 0;
          const gross = revenue * 0.15;
          const tinNumber = a.tinNumber && a.tinNumber !== 'N/A' ? a.tinNumber : '';
          return {
            id: a.id,
            userId: a.id,
            parentSuperAgentId: partnerId,
            name: a.name || a.display_name || 'Unnamed',
            phone: a.phone || '',
            email: a.email || '',
            promoCode: a.promoCode || a.referral_code || '',
            status: a.isDisabled ? 'suspended' : 'active',
            customersGenerated: a.conversionsPromo || a.conversionsLink || 0,
            revenueGenerated: revenue,
            grossCommission15: gross,
            withholdingTax5: gross * 0.05,
            netPayout: gross,
            tinNumber,
            tinStatus: normalizeTinStatus(tinNumber, a.tinStatus),
            pendingCommission: gross,
            paidCommission: a.paidAmount || 0,
            payoutMethod: a.paymentMethod || 'M-Pesa',
            payoutAccount: a.payoutPhone || a.phone || '',
            isDisabled: !!a.isDisabled,
            createdAt: a.joinedDate || new Date().toISOString(),
          };
        });
      } catch (e) {
        console.warn('Error loading sub-affiliates from localStorage:', e);
      }
    }

    setSubAffiliates(mapped);

    if (!mapped.length) {
      setCustomers([]);
    } else {
      try {
        const { getSecureDataBridgeClient } = await import('../../secureDataBridge');
        const client: any = await getSecureDataBridgeClient();
        const subIds = mapped.map((aff) => aff.id).filter(Boolean);
        const { data: referredRows } = await client.from('referred_customers')
          .select('id, tenant_id, customer_id, customer_name, phone_number, package_id, package_name, amount_paid, payment_status, subscription_start_date, subscription_end_date, promo_code_used, referral_code_used, sub_affiliate_id, created_at')
          .in('sub_affiliate_id', subIds)
          .order('created_at', { ascending: false });

        const tenantIds = Array.from(new Set((referredRows || []).map((row: any) => row.tenant_id || row.customer_id).filter(Boolean)));
        let tenantById = new Map<string, any>();
        if (tenantIds.length) {
          const { data: tenants } = await client.from('tenants')
            .select('id, name, subscription_plan, selected_package_id, active_package_id, subscription_status, subscription_start_date, subscription_end_date, created_at')
            .in('id', tenantIds);
          tenantById = new Map((tenants || []).map((tenant: any) => [String(tenant.id), tenant]));
        }

        setCustomers((referredRows || []).map((row: any) => {
          const tenantId = String(row.tenant_id || row.customer_id || '');
          const tenant = tenantById.get(tenantId);
          const packageName = readablePlan(tenant?.active_package_id || tenant?.selected_package_id || tenant?.subscription_plan || row.package_id || row.package_name);
          const subscriptionEndDate = tenant?.subscription_end_date || row.subscription_end_date || '';
          return {
            id: row.id,
            tenantId,
            tenantName: tenant?.name || row.customer_name || 'Unnamed tenant',
            phoneNumber: row.phone_number || '',
            packageName,
            paymentStatus: tenant?.subscription_status || row.payment_status || 'pending',
            amountPaid: numberValue(row.amount_paid),
            promoCodeUsed: row.promo_code_used || row.referral_code_used || '',
            subscriptionEndDate,
            daysRemaining: daysUntil(subscriptionEndDate),
            registeredAt: row.created_at || tenant?.created_at || '',
            subAffiliateId: row.sub_affiliate_id,
          };
        }));
      } catch {
        setCustomers([]);
      }
    }

    // Build reconciliation rows
    const rows = mapped.map(aff =>
      buildReconciliationRow(reconMonth, { id: partnerId, name: partnerName }, aff, [])
    );
    setRecon(rows);
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
    await loadSubAffiliates();
  }, [partnerName, loadSubAffiliates]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { loadSubAffiliates(); }, [reconMonth, loadSubAffiliates]);

  // ── Network totals ──────────────────────────────────────────

  const totals = useMemo(() => calculateSuperAgentNetworkTotals(subAffiliates), [subAffiliates]);

  // ── Status change (Suspend / Deactivate / Activate) ─────────
  // NOTE: DELETE is removed — only Super SaaS Admin can delete

  const handleStatusChange = async () => {
    if (!statusModal) return;
    const { aff, action } = statusModal;

    const newStatus = action === 'activate' ? 'active' : action === 'deactivate' ? 'inactive' : 'suspended';
    const newIsDisabled = action !== 'activate';

    // Update Supabase affiliates table
    try {
      const { getSecureDataBridgeClient } = await import('../../secureDataBridge');
      const client: any = await getSecureDataBridgeClient();
      await client.from('affiliates')
        .update({ is_disabled: newIsDisabled, status: newStatus })
        .eq('id', aff.id);
      await client.from('account_status_logs').insert({
        id: `asl-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        account_id: aff.id,
        changed_by: partnerId,
        old_status: aff.status,
        new_status: newStatus,
        reason: statusReason || action,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Offline — queue both writes for later sync
      enqueueSyncItem({
        table: 'affiliates', operation: 'update',
        data: { is_disabled: newIsDisabled, status: newStatus },
        filter: { column: 'id', value: aff.id },
        accountId: partnerId,
      });
    }

    // Update localStorage (offline cache / instant UI)
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

  const saveEdit = async () => {
    if (!editModal) return;

    // Update Supabase
    await dbWrite('affiliates', 'update',
      { display_name: editName, phone_whatsapp: editPhone, payout_account: editPayoutPhone, payout_method: editPayoutMethod },
      { column: 'id', value: editModal.id },
      partnerId
    );

    // Update localStorage
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
    const logEntry = {
      id: `mal-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      viewer_user_id: partnerId,
      viewer_role: 'super_agent',
      target_user_id: aff.id,
      target_account_type: 'sub_affiliate',
      action: 'mirror_view',
      fields_changed: null,
      created_at: new Date().toISOString(),
    };
    // Audit log — DB write (queues if offline)
    dbWrite('mirror_access_logs', 'insert', logEntry, undefined, partnerId).catch(() => {});
    // Also keep a local copy for quick reference
    try {
      const logs: any[] = JSON.parse(localStorage.getItem('mirror_access_logs') || '[]');
      logs.unshift(logEntry);
      localStorage.setItem('mirror_access_logs', JSON.stringify(logs.slice(0, 500)));
    } catch {}
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
    const mirrorTenants = customers.filter((customer) => customer.subAffiliateId === mirrorTarget.id);
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

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">Registered Tenants</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Tenants registered with {mirrorTarget.name}'s promo code
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black">
                {mirrorTenants.length} tenants
              </span>
            </div>
            {mirrorTenants.length === 0 ? (
              <div className="py-10 text-center">
                <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-sm text-slate-500 mt-2">No tenants registered with this promo code yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[9px]">
                    <tr>
                      <th className="py-3 px-4 text-left">Tenant</th>
                      <th className="py-3 px-4 text-left">Package</th>
                      <th className="py-3 px-4 text-left">Status</th>
                      <th className="py-3 px-4 text-left">Days Left</th>
                      <th className="py-3 px-4 text-left">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mirrorTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-800/25">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white">{tenant.tenantName}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{tenant.promoCodeUsed || mirrorTarget.promoCode}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-semibold">{tenant.packageName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[9px] font-bold text-slate-300">
                            {tenant.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-black text-amber-400">{tenant.daysRemaining} days</td>
                        <td className="py-3 px-4 text-slate-400">{tenant.registeredAt ? tenant.registeredAt.split('T')[0] : 'Not recorded'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Profile details */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3">Profile Details</h3>
            {[
              { label: 'Phone / WhatsApp', value: mirrorTarget.phone },
              { label: 'Payout Account',  value: mirrorTarget.payoutAccount },
              { label: 'Payout Method',   value: mirrorTarget.payoutMethod },
              { label: 'TIN Number',      value: mirrorTarget.tinNumber ? maskTIN(mirrorTarget.tinNumber) : 'Not submitted' },
              { label: 'Tenants registered', value: String(mirrorTenants.length) },
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
    <div className="flex flex-col bg-slate-950 text-white" style={{ height: '100dvh', overflow: 'hidden' }}>

      {/* Offline banner */}
      {!isNetworkOnline && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-amber-500 text-slate-950 text-xs font-bold py-1.5 px-4">
          ⚠️ Offline — changes queued and will sync when connected
        </div>
      )}

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg,#0a0f1e,#0d1b2e)' }}
        className="border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
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

      <div className="flex flex-1 min-h-0">

        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex md:flex-col w-60 border-r border-slate-800 bg-slate-900/50 flex-shrink-0 overflow-y-auto">
          <nav className="p-3 space-y-0.5">
            {NAV_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
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

        {/* Main — add bottom padding on mobile for the nav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-6">
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

              {/* ── DASHBOARD AD PLACEMENT ── same slot as tenant dashboard ── */}
              {(() => {
                const adCode = adSettings.dashboardAdCode;
                const adEnabled = adSettings.dashboardAdEnabled;
                if (!adCode || !adEnabled) return null;
                return (
                  <div className="w-full overflow-hidden rounded-2xl"
                    dangerouslySetInnerHTML={{ __html: sanitizeTrustedHtml(adCode) }} />
                );
              })()}

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
            </div>
          )}

          {/* ══ RECONCILIATION ══ */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-white">Monthly Reconciliation</h2>
                  <p className="text-xs text-slate-400 mt-0.5">20% split: 5% manager + 15% sub-affiliate gross · WHT shown for all affiliates</p>
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
                          {[
                            'Sub-Affiliate',
                            'TIN',
                            'Payout Number',
                            'Network',
                            'Revenue',
                            '20% Pool',
                            'Your 5%',
                            '15% Gross',
                            'WHT 5%',
                            'Net Payout',
                            'Status',
                          ].map(h => (
                            <th key={h} className="py-3 px-4 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recon.map(row => {
                          const aff = subAffiliates.find(a => a.id === row.subAffiliateId);
                          const payoutPhone = aff?.payoutAccount || aff?.phone || '—';
                          const payoutMethod = aff?.payoutMethod || '—';
                          // Always show actual WHT amount — flag only controls if it's deducted
                          const grossComm = row.subAffiliateGrossCommission15;
                          const whtAmount = grossComm * 0.05;
                          const noTin = !aff?.tinStatus || aff.tinStatus === 'not_submitted';

                          return (
                            <tr key={row.subAffiliateId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                              <td className="py-3 px-4 whitespace-nowrap">
                                <p className="font-bold text-white text-xs">{row.subAffiliateName}</p>
                                {aff?.promoCode && (
                                  <p className="text-[9px] font-mono text-amber-400 mt-0.5">{aff.promoCode}</p>
                                )}
                              </td>
                              <td className="py-3 px-4"><TinBadge status={row.tinStatus} /></td>
                              <td className="py-3 px-4">
                                <p className="font-mono text-white text-[11px]">{payoutPhone}</p>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-bold text-slate-300 whitespace-nowrap">
                                  {payoutMethod}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-300">{formatTZS(row.networkRevenue)}</td>
                              <td className="py-3 px-4 font-mono text-purple-400">{formatTZS(row.networkPool20)}</td>
                              <td className="py-3 px-4 font-mono text-amber-400 font-black">{formatTZS(row.managerCommission5)}</td>
                              <td className="py-3 px-4 font-mono text-emerald-400">{formatTZS(row.subAffiliateGrossCommission15)}</td>
                              <td className="py-3 px-4">
                                <div>
                                  <p className={`font-mono text-xs font-black text-amber-400`}>
                                    {formatTZS(grossComm * 0.05)}
                                  </p>
                                  <p className="text-[8px] mt-0.5">
                                    {WITHHOLDING_TAX_ACTIVE
                                      ? noTin ? <span className="text-rose-400">No TIN — blocked</span> : <span className="text-rose-300">Active</span>
                                      : <span className="text-slate-600 italic">Prepared, not yet deducted</span>
                                    }
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-blue-400 font-black">{formatTZS(row.subAffiliateNetPayout)}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${row.payoutStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                  {row.payoutStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        <tr className="border-t border-amber-500/20 bg-amber-500/5">
                          <td className="py-3 px-4 font-black text-amber-400 text-[10px] uppercase tracking-wider" colSpan={4}>TOTALS</td>
                          <td className="py-3 px-4 font-black text-white font-mono">{formatTZS(recon.reduce((s,r) => s + r.networkRevenue, 0))}</td>
                          <td className="py-3 px-4 font-black text-purple-400 font-mono">{formatTZS(recon.reduce((s,r) => s + r.networkPool20, 0))}</td>
                          <td className="py-3 px-4 font-black text-amber-400 font-mono">{formatTZS(recon.reduce((s,r) => s + r.managerCommission5, 0))}</td>
                          <td className="py-3 px-4 font-black text-emerald-400 font-mono">{formatTZS(recon.reduce((s,r) => s + r.subAffiliateGrossCommission15, 0))}</td>
                          <td className="py-3 px-4 font-mono text-rose-400">{formatTZS(recon.reduce((s,r) => s + r.withholdingTax5, 0))}</td>
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {customers.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto" />
                    <p className="text-white font-black">No referred tenants yet</p>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                      Tenants registered through sub-affiliate promo codes will appear here with package and subscription remaining days.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[9px]">
                        <tr>
                          <th className="py-3 px-4 text-left">Tenant</th>
                          <th className="py-3 px-4 text-left">Sub-Affiliate</th>
                          <th className="py-3 px-4 text-left">Package</th>
                          <th className="py-3 px-4 text-left">Status</th>
                          <th className="py-3 px-4 text-left">Days Left</th>
                          <th className="py-3 px-4 text-left">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {customers.map((tenant) => {
                          const owner = subAffiliates.find((aff) => aff.id === tenant.subAffiliateId);
                          return (
                            <tr key={tenant.id} className="hover:bg-slate-800/25">
                              <td className="py-3 px-4">
                                <p className="font-bold text-white">{tenant.tenantName}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{tenant.promoCodeUsed || owner?.promoCode || 'No promo code'}</p>
                              </td>
                              <td className="py-3 px-4 text-slate-300">{owner?.name || 'Unknown'}</td>
                              <td className="py-3 px-4 text-slate-200 font-semibold">{tenant.packageName}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[9px] font-bold text-slate-300">
                                  {tenant.paymentStatus}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-black text-amber-400">{tenant.daysRemaining} days</td>
                              <td className="py-3 px-4 text-slate-400">{tenant.registeredAt ? tenant.registeredAt.split('T')[0] : 'Not recorded'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ TUTORIALS ══ */}
          {/* ══ CODE & LINK TAB ══ */}
          {activeTab === 'code-link' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-lg font-black text-white">Code & Link</h2>
                <p className="text-xs text-slate-400 mt-0.5">Your partner promo code and referral link — share to recruit affiliates</p>
              </div>

              {/* Partner code card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Partner Code</p>
                    <p className="text-xs text-slate-400">Share this code with affiliates you recruit</p>
                  </div>
                </div>

                {editingCode ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <span className="text-amber-400 shrink-0 mt-0.5">⚠️</span>
                      <p className="text-[10px] text-amber-300 leading-relaxed">Una nafasi MOJA TU ya kubadilisha code hii. Baada ya kuihifadhi, haitabadilika tena. Hakikisha umechagua code sahihi kabla ya kuhifadhi.</p>
                    </div>
                    <div className="flex gap-2">
                      <input autoFocus type="text" value={newCode}
                        onChange={e => { setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'')); setCodeError(''); setCodeSuggestions([]); }}
                        placeholder="ENTER NEW CODE" maxLength={20}
                        className={`flex-1 bg-slate-800 border rounded-xl px-4 py-3 text-lg font-mono font-black text-amber-400 uppercase tracking-widest outline-none ${codeError ? 'border-rose-500' : 'border-teal-500'}`} />
                    </div>
                    {codeError && (
                      <div className="space-y-2">
                        <p className="text-sm text-rose-400 font-bold">⚠️ {codeError}</p>
                        {codeSuggestions.length > 0 && (
                          <div className="flex gap-2 flex-wrap items-center">
                            <span className="text-xs text-slate-500">Available codes:</span>
                            {codeSuggestions.map(s => (
                              <button key={s} onClick={() => { setNewCode(s); setCodeError(''); setCodeSuggestions([]); }}
                                className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-lg font-black cursor-pointer hover:bg-teal-500/20">{s}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={savePartnerCode}
                        className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl cursor-pointer border-none transition-colors">
                        Save (Final — One Time Only)
                      </button>
                      <button onClick={() => { setEditingCode(false); setCodeError(''); setCodeSuggestions([]); }}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer border-none">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-slate-800 border border-amber-500/20 rounded-2xl px-5 py-4">
                      <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                      <span className="flex-1 font-black text-amber-400 font-mono tracking-[0.2em] text-2xl">{liveCode || '—'}</span>
                      {partnerInfo?.promoCodeLocked && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-full uppercase tracking-wider">🔒 Locked</span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { navigator.clipboard.writeText(liveCode || partnerCode); setNotice('✅ Partner code copied!'); }}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 text-sm">
                        <Copy className="w-4 h-4" /> Copy Code
                      </button>
                      {partnerInfo?.promoCodeLocked ? (
                        <div className="flex-1 py-3 bg-slate-900 border border-slate-800 text-slate-500 font-bold rounded-xl flex items-center justify-center gap-2 text-sm cursor-not-allowed" title="You already used your one-time edit">
                          <Lock className="w-4 h-4" /> Code Locked
                        </div>
                      ) : (
                        <button onClick={() => { setEditingCode(true); setNewCode(partnerCode); }}
                          className="flex-1 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 text-sm">
                          <Edit2 className="w-4 h-4" /> Edit Code (1 time only)
                        </button>
                      )}
                    </div>
                    {!partnerInfo?.promoCodeLocked && (
                      <p className="text-[10px] text-slate-500 text-center">You can edit this code only once. Choose carefully — system tracking depends on it.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Referral link card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Referral Link</p>
                    <p className="text-xs text-slate-400">Share this link — new signups will be tracked to your account</p>
                  </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                  <code className="text-sm text-slate-300 font-mono break-all">
                    {window.location.origin}/?ref={liveCode || 'YOUR_CODE'}
                  </code>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${liveCode || partnerCode}`); setNotice('✅ Referral link copied!'); }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer border-none flex items-center justify-center gap-2">
                  <Copy className="w-4 h-4" /> Copy Referral Link
                </button>
              </div>

              {/* Info notice */}
              <div className="flex items-start gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Affiliates who register using your partner code or referral link will be added to your network.
                  You earn <strong className="text-amber-400">5% override commission</strong> on all their referrals, on top of your own <strong className="text-amber-400">15% direct commission</strong>.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-lg font-black text-white">Profile Settings</h2>
                <p className="mt-0.5 text-xs text-slate-400">Manage your partner profile, payout details, and dashboard preferences.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Display name
                    <input value={partnerProfileDraft.name} onChange={event => setPartnerProfileDraft({ ...partnerProfileDraft, name: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-amber-500" />
                  </label>
                  <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Phone
                    <input value={partnerProfileDraft.phone} onChange={event => setPartnerProfileDraft({ ...partnerProfileDraft, phone: event.target.value })} placeholder="+255..." className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-amber-500" />
                  </label>
                  <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Payout provider
                    <input value={partnerProfileDraft.payoutMethod} onChange={event => setPartnerProfileDraft({ ...partnerProfileDraft, payoutMethod: event.target.value })} placeholder="M-Pesa, Airtel Money..." className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-amber-500" />
                  </label>
                  <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Payout phone
                    <input value={partnerProfileDraft.payoutPhone} onChange={event => setPartnerProfileDraft({ ...partnerProfileDraft, payoutPhone: event.target.value })} placeholder="+255..." className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-amber-500" />
                  </label>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm font-bold text-slate-300">
                    Email updates
                    <input type="checkbox" checked={partnerPrefs.emailUpdates} onChange={event => setPartnerPrefs({ ...partnerPrefs, emailUpdates: event.target.checked })} className="h-4 w-4 accent-amber-500" />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm font-bold text-slate-300">
                    Compact dashboard
                    <input type="checkbox" checked={partnerPrefs.compactView} onChange={event => setPartnerPrefs({ ...partnerPrefs, compactView: event.target.checked })} className="h-4 w-4 accent-amber-500" />
                  </label>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={savePartnerSettings} className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-400">Save Settings</button>
                  <button type="button" onClick={onLogout} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-400 hover:bg-rose-500/20"><LogOut className="h-4 w-4" /> Sign out</button>
                </div>
              </div>
            </div>
          )}

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
            <SaaSHardwarePOS affiliateId={partnerId} />
          )}

          {/* ══ HW INVENTORY ══ */}
          {activeTab === 'hw-inventory' && (
            <SaaSHardwareInventory affiliateId={partnerId} />
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

      {/* ── MOBILE BOTTOM NAV (Partner Dashboard — md:hidden) ── */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-[60px]">
          {NAV_TABS.slice(0, 3).map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer border-none bg-transparent transition-all active:scale-90 ${active ? 'text-amber-400' : 'text-slate-500'}`}>
                <div className={`flex items-center justify-center w-7 h-6 rounded-lg transition-all ${active ? 'bg-amber-500/15' : ''}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-amber-400' : 'text-slate-500'}`} strokeWidth={active ? 2.5 : 1.8} />
                </div>
                <span className={`text-[8px] font-bold leading-none truncate max-w-[52px] ${active ? 'text-amber-400' : 'text-slate-500'}`}>
                  {tab.label.split(' ')[0]}
                </span>
                {active && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400" />}
              </button>
            );
          })}
          {/* More button for the remaining partner tools */}
          <button onClick={() => setMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer border-none bg-transparent transition-all ${NAV_TABS.slice(3).some(tab => tab.id === activeTab) || moreOpen ? 'text-amber-400' : 'text-slate-500'}`}>
            <div className={`flex items-center justify-center w-7 h-6 rounded-lg ${NAV_TABS.slice(3).some(tab => tab.id === activeTab) || moreOpen ? 'bg-amber-500/15' : ''}`}>
              <Menu className="w-5 h-5" strokeWidth={1.8} />
            </div>
            <span className="text-[8px] font-bold leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* ── PARTNER MORE BOTTOM SHEET ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">More Options</p>
            <div className="grid grid-cols-3 gap-4">
              {NAV_TABS.slice(3).map((item, index) => {
                const Icon = item.icon;
                const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-cyan-600', 'bg-violet-600', 'bg-orange-500', 'bg-slate-700'];
                return (
                  <button key={item.id} onClick={() => { setActiveTab(item.id as DashTab); setMoreOpen(false); }}
                    className="flex flex-col items-center gap-2 cursor-pointer bg-transparent border-none">
                    <div className={`w-14 h-14 rounded-2xl ${colors[index] || 'bg-slate-700'} flex items-center justify-center shadow`}>
                      <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 text-center">{item.label.split(' ')[0]}</span>
                  </button>
                );
              })}
              <button onClick={() => { setMoreOpen(false); onLogout(); }}
                className="flex flex-col items-center gap-2 cursor-pointer bg-transparent border-none">
                <div className="w-14 h-14 rounded-2xl bg-rose-600 flex items-center justify-center shadow">
                  <LogOut className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold text-rose-400 text-center">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <GlobalStickyAd
        bottomOffsetClass="bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-4"
        leftOffsetClass="left-3 lg:left-1/2 lg:-translate-x-1/2"
        maxWidthClass="max-w-[640px]"
      />

    </div>
  );
}
