import { getDynamicSupabaseClient } from '../supabaseClient';

export type SourceType = 'organic' | 'organic_affiliate' | 'sub_affiliate' | 'unknown' | 'untracked';

export interface SuperAffiliateRow {
  id: string;
  display_name: string;
  referral_code: string;
  status: string;
  user_id: string;
  affiliate_type: 'organic' | 'sub_affiliate';
  parent_agent_id: string | null;
  phone_whatsapp: string | null;
  nida_number: string | null;
  tin_number: string | null;
  payout_method: string | null;
  payout_account: string | null;
  mobile_money_number: string | null;
  mobile_money_provider: string | null;
  promo_code: string | null;
  referral_link: string | null;
  grossRevenue: number;
  grossCommission: number;
  withholdingTax: number;
  netPayout: number;
  referrals: number;
  payouts: number;
  payoutStatus: string;
}

export interface OrganicSubscriberRow {
  id: string;
  subscriberUserId: string;
  subscriberName: string;
  phone: string;
  tenantName: string;
  subscriptionPackage: string;
  registrationDate: string;
  sourceType: SourceType;
  revenue: number;
  status: string;
}

export interface AgentMonitoringRow {
  agentId: string;
  agentName: string;
  phone: string;
  agentCode: string;
  agentLink: string;
  mobileMoneyNumber: string;
  mobileMoneyProvider: string;
  status: string;
  subAffiliates: number;
  subscribers: number;
  revenue: number;
  poolTotal: number;
  agentCut: number;
  subAffiliatePool: number;
  withholdingTax: number;
  netPayout: number;
}

export interface SubAffiliateMonitoringRow {
  id: string;
  userId: string;
  name: string;
  parentAgentId: string;
  parentAgentName: string;
  parentAgentCode: string;
  phone: string;
  promoCode: string;
  referralLink: string;
  subscribers: number;
  revenue: number;
  commission: number;
  withholdingTax: number;
  netPayout: number;
  mobileMoneyNumber: string;
  mobileMoneyProvider: string;
  payoutStatus: string;
  status: string;
}

export interface AffiliateMonitoringData {
  affiliates: SuperAffiliateRow[];
  organicSubscribers: OrganicSubscriberRow[];
  agents: AgentMonitoringRow[];
  subAffiliates: SubAffiliateMonitoringRow[];
}

const numberValue = (value: unknown) => Number(value || 0);
const dateValue = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : '';

const readSettings = (tenant: any) => {
  const settings = tenant?.business_settings || tenant?.company_settings || {};
  if (typeof settings === 'string') {
    try { return JSON.parse(settings); } catch { return {}; }
  }
  return settings || {};
};

const packageName = (tenant: any) => {
  const settings = readSettings(tenant);
  return settings.subscriptionPlan || settings.package || tenant?.subscription_plan || 'Not recorded';
};

export async function loadAffiliateMonitoringData(): Promise<AffiliateMonitoringData> {
  const client: any = await getDynamicSupabaseClient();
  const { data: user } = await client.auth.getUser();
  if (!user?.user) throw new Error('A Supabase-authenticated Super Admin account is required for live affiliate data.');

  // Partners live in their own dedicated table (affiliate_partners).
  // Sub-affiliates live in 'affiliates', always tied to a partner via
  // parent_super_agent_id (enforced by a DB CHECK constraint).
  const [partnersRes, affiliatesRes, tenantsRes, referredCustomersRes, commissionLedgerRes] = await Promise.all([
    client.from('affiliate_partners').select('id, user_id, display_name, promo_code, status, phone_whatsapp, nida_number, tin_number, tin_status, payout_method, payout_account, total_revenue, manager_commission, withholding_tax, net_payout, sub_affiliate_count, is_disabled, created_at').order('created_at', { ascending: false }),
    client.from('affiliates').select('id, user_id, display_name, referral_code, promo_code, status, parent_super_agent_id, phone_whatsapp, nida_number, tin_number, tin_status, payout_method, payout_account, total_revenue, gross_commission, withholding_tax, net_payout, customers_count, is_disabled, created_at').order('created_at', { ascending: false }),
    client.from('tenants').select('id, name, business_settings, company_settings, subscription_plan, created_at'),
    client.from('referred_customers').select('affiliate_id, sub_affiliate_id, parent_super_agent_id, amount_paid, commission_amount, payment_status, created_at'),
    client.from('commission_ledger').select('affiliate_id, sub_affiliate_id, parent_super_agent_id, revenue_amount, manager_commission_5, sub_affiliate_gross_commission_15, withholding_tax_amount, sub_affiliate_net_payout, status'),
  ]);

  const failed = [partnersRes, affiliatesRes, tenantsRes].find((result: any) => result.error);
  if (failed?.error) throw failed.error;

  const allPartners: any[] = partnersRes.data || [];
  const allAffiliates: any[] = affiliatesRes.data || [];
  const tenantById = new Map((tenantsRes.data || []).map((row: any) => [String(row.id), row]));
  const referredCustomers: any[] = referredCustomersRes.data || [];
  const commissionRows: any[] = commissionLedgerRes.data || [];

  // Partners indexed by id, for fast parent lookups when building sub-affiliate rows
  const partnerById = new Map(allPartners.map((p) => [String(p.id), p]));

  // Totals per affiliate / partner, derived from commission_ledger (the real ledger we write to)
  const totalsByEntity = new Map<string, { revenue: number; gross: number; wht: number; net: number; customers: number }>();
  const emptyTotals = () => ({ revenue: 0, gross: 0, wht: 0, net: 0, customers: 0 });

  for (const row of commissionRows) {
    const key = String(row.sub_affiliate_id || row.affiliate_id);
    const t = totalsByEntity.get(key) || emptyTotals();
    t.revenue += numberValue(row.revenue_amount);
    t.gross += numberValue(row.sub_affiliate_gross_commission_15);
    t.wht += numberValue(row.withholding_tax_amount);
    t.net += numberValue(row.sub_affiliate_net_payout);
    totalsByEntity.set(key, t);

    // Also credit the parent partner's manager commission
    if (row.parent_super_agent_id) {
      const pKey = String(row.parent_super_agent_id);
      const pt = totalsByEntity.get(pKey) || emptyTotals();
      pt.revenue += numberValue(row.revenue_amount);
      pt.gross += numberValue(row.manager_commission_5); // partner earns the 5% cut
      totalsByEntity.set(pKey, pt);
    }
  }
  for (const row of referredCustomers) {
    const key = String(row.sub_affiliate_id || row.affiliate_id);
    const t = totalsByEntity.get(key) || emptyTotals();
    t.customers += 1;
    totalsByEntity.set(key, t);
  }

  // ── Sub-affiliates — full raw records (used by the edit modal) ────────
  // Every row in 'affiliates' is a sub-affiliate; there is no more
  // standalone/organic affiliate bucket.
  const affiliateRows: SuperAffiliateRow[] = allAffiliates.map((a) => {
    const totals = totalsByEntity.get(String(a.id)) || emptyTotals();
    return {
      id: a.id,
      display_name: a.display_name,
      referral_code: a.referral_code || a.promo_code || '',
      status: a.is_disabled ? 'suspended' : (a.status || 'active'),
      user_id: a.user_id,
      affiliate_type: 'sub_affiliate' as const,
      parent_agent_id: a.parent_super_agent_id || null,
      phone_whatsapp: a.phone_whatsapp || null,
      nida_number: a.nida_number || null,
      tin_number: a.tin_number || null,
      payout_method: a.payout_method || null,
      payout_account: a.payout_account || null,
      mobile_money_number: a.payout_account || null,
      mobile_money_provider: a.payout_method || null,
      promo_code: a.promo_code || a.referral_code || null,
      referral_link: null,
      grossRevenue: totals.revenue || numberValue(a.total_revenue),
      grossCommission: totals.gross || numberValue(a.gross_commission),
      withholdingTax: totals.wht || numberValue(a.withholding_tax),
      netPayout: totals.net || numberValue(a.net_payout),
      referrals: totals.customers,
      payouts: 0,
      payoutStatus: 'pending',
    };
  });

  // ── Sub-affiliates — display-formatted rows, parent resolved from affiliate_partners ──
  const subAffiliates = allAffiliates
    .filter((a) => a.parent_super_agent_id)
    .map((a) => {
      const totals = totalsByEntity.get(String(a.id)) || emptyTotals();
      const parent = partnerById.get(String(a.parent_super_agent_id));
      return {
        id: a.id,
        userId: a.user_id,
        name: a.display_name,
        parentAgentId: a.parent_super_agent_id,
        parentAgentName: parent?.display_name || 'Partner',
        parentAgentCode: parent?.promo_code || '',
        phone: a.phone_whatsapp || '',
        promoCode: a.promo_code || a.referral_code,
        referralLink: '',
        subscribers: totals.customers,
        revenue: totals.revenue || numberValue(a.total_revenue),
        commission: totals.gross || numberValue(a.gross_commission),
        withholdingTax: totals.wht || numberValue(a.withholding_tax),
        netPayout: totals.net || numberValue(a.net_payout),
        mobileMoneyNumber: a.payout_account || '',
        mobileMoneyProvider: a.payout_method || '',
        payoutStatus: 'pending',
        status: a.is_disabled ? 'suspended' : (a.status || 'active'),
        tinStatus: a.tin_status || 'not_submitted',
      };
    });

  // ── Partners — derived from affiliate_partners table directly ─────────
  const agents = allPartners.map((p) => {
    const totals = totalsByEntity.get(String(p.id)) || emptyTotals();
    const networkSubs = subAffiliates.filter((s) => s.parentAgentId === p.id);
    const revenue = totals.revenue || networkSubs.reduce((sum, s) => sum + s.revenue, 0);
    const agentCut = totals.gross || revenue * 0.05;
    return {
      agentId: p.id,
      agentName: p.display_name,
      phone: p.phone_whatsapp || '',
      agentCode: p.promo_code || '',
      agentLink: '',
      mobileMoneyNumber: p.payout_account || '',
      mobileMoneyProvider: p.payout_method || '',
      status: p.is_disabled ? 'suspended' : (p.status || 'active'),
      subAffiliates: networkSubs.length,
      subscribers: totals.customers,
      revenue,
      poolTotal: revenue * 0.20,
      agentCut,
      subAffiliatePool: revenue * 0.15,
      withholdingTax: agentCut * 0.05,
      netPayout: agentCut,
    };
  });

  // ── Organic subscribers (tenants not tied to any affiliate) ────────────
  const referredTenantIds = new Set(referredCustomers.map((r: any) => r.customer_id).filter(Boolean));
  const organicSubscribers = (tenantsRes.data || [])
    .filter((t: any) => !referredTenantIds.has(t.id))
    .map((t: any) => ({
      id: t.id,
      name: t.name,
      plan: t.subscription_plan || 'trial',
      createdAt: t.created_at,
    }));

  return mergeLocalStorageAffiliates({ affiliates: affiliateRows, organicSubscribers, agents, subAffiliates });
}
/** Merge localStorage immersive affiliates into monitoring data when DB is empty */
function mergeLocalStorageAffiliates(data: AffiliateMonitoringData): AffiliateMonitoringData {
  try {
    const raw = localStorage.getItem('saas_immersive_affiliates');
    if (!raw) return data;
    const local: any[] = JSON.parse(raw);
    if (!local.length) return data;

    // Build sub-affiliates from localStorage (isSuper=false)
    const localSubAffs = local
      .filter(a => !a.isSuper)
      .map(a => {
        const revenue = a.revenueDate || a.totalEarnings || 0;
        const commission = revenue * 0.15;
        const withholdingTax = commission * 0.05;
        return {
          id: a.id,
          userId: a.id,
          name: a.name || a.display_name || 'Unknown',
          parentAgentId: a.parentSuperId || '',
          parentAgentName: a.parentSuperName || 'Partner',
          parentAgentCode: a.parentSuperCode || '',
          phone: a.phone || '',
          promoCode: a.promoCode || a.referral_code || '',
          referralLink: a.affiliateLink || '',
          subscribers: a.conversionsPromo || a.conversionsLink || 0,
          revenue,
          commission,
          withholdingTax,
          netPayout: commission,
          mobileMoneyNumber: a.payoutPhone || a.phone || '',
          mobileMoneyProvider: a.paymentMethod || 'M-Pesa',
          payoutStatus: 'pending' as const,
          status: a.isDisabled ? 'suspended' : 'active',
        };
      });

    // Build agents/partners from localStorage (isSuper=true)
    const localAgents = local
      .filter(a => a.isSuper)
      .map(a => {
        const networkSubs = localSubAffs.filter(s => s.parentAgentId === a.id || s.parentAgentCode === a.promoCode);
        const revenue = networkSubs.reduce((s, sub) => s + sub.revenue, a.revenueDate || a.totalEarnings || 0);
        const agentCut = revenue * 0.05;
        return {
          agentId: a.id,
          agentName: a.name || a.display_name || 'Partner',
          phone: a.phone || '',
          agentCode: a.promoCode || '',
          agentLink: a.affiliateLink || '',
          mobileMoneyNumber: a.payoutPhone || a.phone || '',
          mobileMoneyProvider: a.paymentMethod || 'M-Pesa',
          status: a.isDisabled ? 'suspended' : 'active',
          subAffiliates: networkSubs.length,
          subscribers: a.conversionsPromo || 0,
          revenue,
          poolTotal: revenue * 0.20,
          agentCut,
          subAffiliatePool: revenue * 0.15,
          withholdingTax: agentCut * 0.05,
          netPayout: agentCut,
        };
      });

    // Merge — avoid duplicates by id
    const existingSubIds = new Set(data.subAffiliates.map(s => s.id));
    const existingAgentIds = new Set(data.agents.map(a => a.agentId));

    return {
      ...data,
      subAffiliates: [
        ...data.subAffiliates,
        ...localSubAffs.filter(s => !existingSubIds.has(s.id)),
      ],
      agents: [
        ...data.agents,
        ...localAgents.filter(a => !existingAgentIds.has(a.agentId)),
      ],
    };
  } catch {
    return data;
  }
}

export async function loadSuperAffiliateRows(): Promise<SuperAffiliateRow[]> {
  return (await loadAffiliateMonitoringData()).affiliates;
}

export async function updateSuperAffiliate(id: string, updates: Record<string, unknown>) {
  const client: any = await getDynamicSupabaseClient();
  const { error } = await client.from('affiliates').update(updates).eq('id', id);
  if (error) throw error;
  const { error: auditError } = await client.rpc('record_partner_affiliate_action', { p_affiliate_id: id, p_action: 'profile_updated', p_metadata: updates });
  if (auditError) throw auditError;
}
