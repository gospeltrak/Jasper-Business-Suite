import { getSecureDataBridgeClient } from '../secureDataBridge';
import { isSettledPaymentStatus } from './financialStatus';

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

export async function loadAffiliateMonitoringData(): Promise<AffiliateMonitoringData> {
  const client: any = await getSecureDataBridgeClient();
  const { data: user } = await client.auth.getUser();
  if (!user?.user) throw new Error('A Supabase-authenticated Super Admin account is required for live affiliate data.');

  // Partners live in their own dedicated table (affiliate_partners).
  // Sub-affiliates live in 'affiliates', always tied to a partner via
  // parent_super_agent_id (enforced by a DB CHECK constraint).
  const [partnersRes, affiliatesRes, referredCustomersRes, commissionLedgerRes] = await Promise.all([
    client.from('affiliate_partners').select('id, user_id, display_name, promo_code, status, phone_whatsapp, nida_number, tin_number, tin_status, payout_method, payout_account, total_revenue, manager_commission, withholding_tax, net_payout, sub_affiliate_count, is_disabled, created_at').order('created_at', { ascending: false }),
    client.from('affiliates').select('id, user_id, display_name, referral_code, promo_code, status, parent_super_agent_id, phone_whatsapp, payout_method, payout_account, is_disabled, created_at').order('created_at', { ascending: false }),
    client.from('referred_customers').select('affiliate_id, sub_affiliate_id, parent_super_agent_id, amount_paid, commission_amount, payment_status, created_at'),
    client.from('commission_ledger').select('affiliate_id, sub_affiliate_id, parent_super_agent_id, revenue_amount, manager_commission_5, sub_affiliate_gross_commission_15, withholding_tax_amount, sub_affiliate_net_payout, status'),
  ]);

  const failed = [
    partnersRes,
    affiliatesRes,
    referredCustomersRes,
    commissionLedgerRes,
  ].find((result: any) => result.error);
  if (failed?.error) throw failed.error;

  const allPartners: any[] = partnersRes.data || [];
  const allAffiliates: any[] = affiliatesRes.data || [];
  const referredCustomers: any[] = referredCustomersRes.data || [];
  const commissionRows: any[] = commissionLedgerRes.data || [];

  // Partners indexed by id, for fast parent lookups when building sub-affiliate rows
  const partnerById = new Map(allPartners.map((p) => [String(p.id), p]));

  // Totals per affiliate / partner, derived from commission_ledger and paid referral rows.
  // Stored affiliate running totals are intentionally not used here because they can contain
  // historical/demo values or tenant workspace sales that are not platform subscription revenue.
  const totalsByEntity = new Map<string, { ledgerRevenue: number; referralRevenue: number; gross: number; wht: number; net: number; customers: number }>();
  const emptyTotals = () => ({ ledgerRevenue: 0, referralRevenue: 0, gross: 0, wht: 0, net: 0, customers: 0 });
  const settledRevenue = (totals: ReturnType<typeof emptyTotals>) => totals.ledgerRevenue || totals.referralRevenue;
  const gross15 = (totals: ReturnType<typeof emptyTotals>) => totals.gross || settledRevenue(totals) * 0.15;
  const manager5 = (totals: ReturnType<typeof emptyTotals>) => totals.gross || settledRevenue(totals) * 0.05;
  const taxOn = (amount: number) => amount * 0.05;

  for (const row of commissionRows) {
    if (!isSettledPaymentStatus(row.status)) continue;
    const key = String(row.sub_affiliate_id || row.affiliate_id);
    const t = totalsByEntity.get(key) || emptyTotals();
    t.ledgerRevenue += numberValue(row.revenue_amount);
    t.gross += numberValue(row.sub_affiliate_gross_commission_15);
    t.wht += numberValue(row.withholding_tax_amount);
    t.net += numberValue(row.sub_affiliate_net_payout);
    totalsByEntity.set(key, t);

    // Also credit the parent partner's manager commission
    if (row.parent_super_agent_id) {
      const pKey = String(row.parent_super_agent_id);
      const pt = totalsByEntity.get(pKey) || emptyTotals();
      pt.ledgerRevenue += numberValue(row.revenue_amount);
      pt.gross += numberValue(row.manager_commission_5); // partner earns the 5% cut
      totalsByEntity.set(pKey, pt);
    }
  }
  for (const row of referredCustomers) {
    const key = String(row.sub_affiliate_id || row.affiliate_id);
    const t = totalsByEntity.get(key) || emptyTotals();
    t.customers += 1;
    if (isSettledPaymentStatus(row.payment_status)) t.referralRevenue += numberValue(row.amount_paid);
    totalsByEntity.set(key, t);

    if (row.parent_super_agent_id) {
      const pKey = String(row.parent_super_agent_id);
      const pt = totalsByEntity.get(pKey) || emptyTotals();
      pt.customers += 1;
      if (isSettledPaymentStatus(row.payment_status)) pt.referralRevenue += numberValue(row.amount_paid);
      totalsByEntity.set(pKey, pt);
    }
  }

  // ── Sub-affiliates — full raw records (used by the edit modal) ────────
  // Every row in 'affiliates' is a sub-affiliate; there is no more
  // standalone/organic affiliate bucket.
  const affiliateRows: SuperAffiliateRow[] = allAffiliates.map((a) => {
    const totals = totalsByEntity.get(String(a.id)) || emptyTotals();
    const revenue = settledRevenue(totals);
    const commission = gross15(totals);
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
      grossRevenue: revenue,
      grossCommission: commission,
      withholdingTax: totals.wht || taxOn(commission),
      netPayout: totals.net || commission,
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
      const revenue = settledRevenue(totals);
      const commission = gross15(totals);
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
        revenue,
        commission,
        withholdingTax: totals.wht || taxOn(commission),
        netPayout: totals.net || commission,
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
    const revenue = settledRevenue(totals) || networkSubs.reduce((sum, s) => sum + s.revenue, 0);
    const agentCut = manager5(totals);
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
      subscribers: totals.customers || networkSubs.reduce((sum, s) => sum + s.subscribers, 0),
      revenue,
      poolTotal: revenue * 0.20,
      agentCut,
      subAffiliatePool: revenue * 0.15,
      withholdingTax: taxOn(agentCut),
      netPayout: agentCut,
    };
  });

  // ── Organic subscribers (tenants not tied to any affiliate) ────────────
  return { affiliates: affiliateRows, organicSubscribers: [], agents, subAffiliates };
}

export async function loadSuperAffiliateDetail(id: string): Promise<SuperAffiliateRow> {
  const client: any = await getSecureDataBridgeClient();
  const { data: user } = await client.auth.getUser();
  if (!user?.user) throw new Error('A Supabase-authenticated Super Admin account is required for affiliate details.');
  const { data, error } = await client
    .from('affiliates')
    .select('id,user_id,display_name,referral_code,promo_code,status,parent_super_agent_id,phone_whatsapp,nida_number,tin_number,payout_method,payout_account,total_revenue,gross_commission,withholding_tax,net_payout,customers_count,is_disabled')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Affiliate account was not found.');
  const grossRevenue = numberValue(data.total_revenue);
  const grossCommission = numberValue(data.gross_commission) || grossRevenue * 0.15;
  return {
    id: data.id, display_name: data.display_name,
    referral_code: data.referral_code || data.promo_code || '',
    status: data.is_disabled ? 'suspended' : (data.status || 'active'),
    user_id: data.user_id, affiliate_type: 'sub_affiliate',
    parent_agent_id: data.parent_super_agent_id || null,
    phone_whatsapp: data.phone_whatsapp || null,
    nida_number: data.nida_number || null, tin_number: data.tin_number || null,
    payout_method: data.payout_method || null, payout_account: data.payout_account || null,
    mobile_money_number: data.payout_account || null, mobile_money_provider: data.payout_method || null,
    promo_code: data.promo_code || data.referral_code || null, referral_link: null,
    grossRevenue, grossCommission, withholdingTax: numberValue(data.withholding_tax),
    netPayout: numberValue(data.net_payout), referrals: numberValue(data.customers_count),
    payouts: 0, payoutStatus: 'pending',
  };
}

export async function loadSuperAffiliateRows(): Promise<SuperAffiliateRow[]> {
  return (await loadAffiliateMonitoringData()).affiliates;
}

export async function updateSuperAffiliate(id: string, updates: Record<string, unknown>) {
  const client: any = await getSecureDataBridgeClient();
  const { error } = await client.from('affiliates').update(updates).eq('id', id);
  if (error) throw error;
}

async function logAccountDeletion(accountId: string, reason: string) {
  try {
    const client: any = await getSecureDataBridgeClient();
    await client.from('account_status_logs').insert({
      account_id: accountId,
      changed_by: 'super_admin',
      old_status: 'active',
      new_status: 'deleted',
      reason,
    });
  } catch {
    // Audit logging failure should never block the delete itself.
  }
}

/**
 * Permanently deletes a sub-affiliate from the 'affiliates' table.
 * Only the Super SaaS Admin can call this — gated by override password
 * verification in the UI before this function is ever invoked.
 */
export async function deleteSubAffiliate(id: string, name: string): Promise<void> {
  const client: any = await getSecureDataBridgeClient();
  const { error } = await client.from('affiliates').delete().eq('id', id);
  if (error) throw error;
  await logAccountDeletion(id, `Sub-affiliate "${name}" permanently deleted by Super Admin.`);
}

/**
 * Permanently deletes a Partner from the 'affiliate_partners' table.
 * Blocks the delete if the partner still has any sub-affiliates assigned
 * to them — those must be reassigned or deleted first, since
 * parent_super_agent_id is not a real foreign key with cascade behavior
 * and an orphaned reference would silently corrupt commission tracking.
 */
export async function deletePartner(id: string, name: string): Promise<void> {
  const client: any = await getSecureDataBridgeClient();

  const { data: dependents, error: checkError } = await client
    .from('affiliates')
    .select('id')
    .eq('parent_super_agent_id', id)
    .limit(1);
  if (checkError) throw checkError;
  if (dependents && dependents.length > 0) {
    throw new Error(`Cannot delete "${name}" — they still have sub-affiliates assigned to them. Reassign or delete those sub-affiliates first.`);
  }

  const { error } = await client.from('affiliate_partners').delete().eq('id', id);
  if (error) throw error;
  await logAccountDeletion(id, `Partner "${name}" permanently deleted by Super Admin.`);
}
