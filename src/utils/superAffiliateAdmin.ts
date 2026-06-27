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

  const [affiliates, commissions, referrals, payouts, sourceRows, users, tenants, agentProfiles] = await Promise.all([
    client.from('affiliates').select('id, user_id, display_name, referral_code, status, affiliate_type, parent_agent_id, phone_whatsapp, nida_number, tin_number, payout_method, payout_account, mobile_money_number, mobile_money_provider, promo_code, referral_link').order('created_at', { ascending: false }),
    client.from('affiliate_commissions').select('affiliate_id, account_type, gross_revenue, gross_commission, withholding_tax, net_payout, payout_status'),
    client.from('affiliate_referrals').select('affiliate_id, agent_id, sub_affiliate_id, revenue_generated'),
    client.from('affiliate_payouts').select('affiliate_id, amount, status'),
    client.from('subscriber_source_tracking').select('*').order('created_at', { ascending: false }).limit(2000),
    client.from('users').select('id, tenant_id, name, email, phone, username_phone, is_active'),
    client.from('tenants').select('id, name, business_settings, company_settings, subscription_plan, created_at'),
    client.from('affiliate_agents').select('*'),
  ]);

  const failed = [affiliates, commissions, referrals, payouts, sourceRows, users, tenants, agentProfiles].find((result: any) => result.error);
  if (failed?.error) throw failed.error;

  const userById = new Map((users.data || []).map((row: any) => [String(row.id), row]));
  const tenantById = new Map((tenants.data || []).map((row: any) => [String(row.id), row]));
  const agentProfileByUser = new Map((agentProfiles.data || []).map((row: any) => [String(row.user_id), row]));

  const emptyAffiliateTotals = () => ({ grossRevenue: 0, grossCommission: 0, withholdingTax: 0, netPayout: 0, referrals: 0, payouts: 0, payoutStatus: 'pending' });
  const byAffiliate = new Map<string, ReturnType<typeof emptyAffiliateTotals>>();
  for (const item of commissions.data || []) {
    const row = byAffiliate.get(item.affiliate_id) || emptyAffiliateTotals();
    row.grossRevenue += numberValue(item.gross_revenue);
    row.grossCommission += numberValue(item.gross_commission);
    row.withholdingTax += numberValue(item.withholding_tax);
    row.netPayout += numberValue(item.net_payout);
    row.payoutStatus = item.payout_status || row.payoutStatus;
    byAffiliate.set(item.affiliate_id, row);
  }
  for (const item of referrals.data || []) {
    const row = byAffiliate.get(item.affiliate_id) || emptyAffiliateTotals();
    row.referrals += 1;
    if (!row.grossRevenue && numberValue(item.revenue_generated) > 0) {
      row.grossRevenue += numberValue(item.revenue_generated);
      row.grossCommission = row.grossRevenue * 0.15;
      row.withholdingTax = row.grossCommission * 0.05;
      row.netPayout = row.grossCommission - row.withholdingTax;
    }
    byAffiliate.set(item.affiliate_id, row);
  }
  for (const item of payouts.data || []) {
    const row = byAffiliate.get(item.affiliate_id) || emptyAffiliateTotals();
    row.payouts += numberValue(item.amount);
    row.payoutStatus = item.status || row.payoutStatus;
    byAffiliate.set(item.affiliate_id, row);
  }

  const affiliateRows: SuperAffiliateRow[] = (affiliates.data || []).map((affiliate: any) => ({
    ...affiliate,
    affiliate_type: affiliate.affiliate_type || 'organic',
    promo_code: affiliate.promo_code || affiliate.referral_code,
    referral_link: affiliate.referral_link || `/signup?ref=${String(affiliate.referral_code || '').toLowerCase()}`,
    ...(byAffiliate.get(affiliate.id) || emptyAffiliateTotals())
  }));

  const sourceData = sourceRows.data || [];
  const organicSubscribers = sourceData
    .filter((row: any) => row.source_type === 'organic')
    .map((row: any) => {
      const subscriber = userById.get(String(row.subscriber_user_id)) as any;
      const tenant = tenantById.get(String(row.tenant_id)) as any;
      return {
        id: String(row.id),
        subscriberUserId: String(row.subscriber_user_id || ''),
        subscriberName: subscriber?.name || subscriber?.email || 'Subscriber',
        phone: subscriber?.phone || subscriber?.username_phone || '',
        tenantName: tenant?.name || 'No tenant',
        subscriptionPackage: packageName(tenant),
        registrationDate: dateValue(row.created_at),
        sourceType: row.source_type,
        revenue: numberValue(row.revenue_generated),
        status: subscriber?.is_active === false ? 'inactive' : 'active',
      };
    });

  const sourceBySubAffiliate = new Map<string, any[]>();
  const sourceByAgent = new Map<string, any[]>();
  for (const row of sourceData) {
    if (row.sub_affiliate_id) sourceBySubAffiliate.set(String(row.sub_affiliate_id), [...(sourceBySubAffiliate.get(String(row.sub_affiliate_id)) || []), row]);
    if (row.agent_id) sourceByAgent.set(String(row.agent_id), [...(sourceByAgent.get(String(row.agent_id)) || []), row]);
  }

  const subAffiliates = affiliateRows
    .filter((affiliate) => affiliate.affiliate_type === 'sub_affiliate' && affiliate.parent_agent_id)
    .map((affiliate) => {
      const parentAgent = affiliate.parent_agent_id ? userById.get(affiliate.parent_agent_id) as any : null;
      const parentProfile = affiliate.parent_agent_id ? agentProfileByUser.get(affiliate.parent_agent_id) as any : null;
      const sources = sourceBySubAffiliate.get(affiliate.id) || [];
      const revenue = sources.reduce((sum, row) => sum + numberValue(row.revenue_generated), affiliate.grossRevenue || 0);
      const commission = revenue * 0.15;
      const withholdingTax = commission * 0.05;
      return {
        id: affiliate.id,
        userId: affiliate.user_id,
        name: affiliate.display_name,
        parentAgentId: affiliate.parent_agent_id || '',
        parentAgentName: parentProfile?.display_name || parentAgent?.name || parentAgent?.email || 'Agent',
        parentAgentCode: parentProfile?.agent_code || '',
        phone: affiliate.phone_whatsapp || affiliate.payout_account || '',
        promoCode: affiliate.promo_code || affiliate.referral_code,
        referralLink: affiliate.referral_link || '',
        subscribers: sources.length || affiliate.referrals,
        revenue,
        commission,
        withholdingTax,
        netPayout: commission - withholdingTax,
        mobileMoneyNumber: affiliate.mobile_money_number || affiliate.payout_account || '',
        mobileMoneyProvider: affiliate.mobile_money_provider || affiliate.payout_method || '',
        payoutStatus: affiliate.payoutStatus,
        status: affiliate.status,
      };
    });

  const agentIds = new Set<string>();
  subAffiliates.forEach((row) => row.parentAgentId && agentIds.add(row.parentAgentId));
  (agentProfiles.data || []).forEach((row: any) => agentIds.add(String(row.user_id)));

  const agents = Array.from(agentIds).map((agentId) => {
    const agentUser = userById.get(agentId) as any;
    const profile = agentProfileByUser.get(agentId) as any;
    const networkSources = sourceByAgent.get(agentId) || [];
    const networkSubs = subAffiliates.filter((row) => row.parentAgentId === agentId);
    const revenue = networkSources.reduce((sum, row) => sum + numberValue(row.revenue_generated), networkSubs.reduce((sum, row) => sum + row.revenue, 0));
    const agentCut = revenue * 0.05;
    const withholdingTax = agentCut * 0.05;
    return {
      agentId,
      agentName: profile?.display_name || agentUser?.name || agentUser?.email || 'Agent',
      phone: profile?.phone_whatsapp || agentUser?.phone || agentUser?.username_phone || '',
      agentCode: profile?.agent_code || '',
      agentLink: profile?.agent_link || '',
      mobileMoneyNumber: profile?.mobile_money_number || agentUser?.phone || '',
      mobileMoneyProvider: profile?.mobile_money_provider || '',
      status: profile?.status || (agentUser?.is_active === false ? 'suspended' : 'active'),
      subAffiliates: networkSubs.length,
      subscribers: networkSources.length,
      revenue,
      poolTotal: revenue * 0.20,
      agentCut,
      subAffiliatePool: revenue * 0.15,
      withholdingTax,
      netPayout: agentCut - withholdingTax,
    };
  });

  return { affiliates: affiliateRows, organicSubscribers, agents, subAffiliates };
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
