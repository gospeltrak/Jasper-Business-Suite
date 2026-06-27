import { getDynamicSupabaseClient } from '../supabaseClient';

export interface SuperAffiliateRow {
  id: string; display_name: string; referral_code: string; status: string;
  user_id: string; affiliate_type: 'organic' | 'sub_affiliate'; parent_agent_id: string | null;
  phone_whatsapp: string | null; nida_number: string | null; tin_number: string | null;
  payout_method: string | null; payout_account: string | null; mobile_money_number: string | null; mobile_money_provider: string | null;
  promo_code: string | null; referral_link: string | null;
  grossRevenue: number; grossCommission: number; withholdingTax: number; netPayout: number;
  referrals: number; payouts: number; payoutStatus: string;
}

export async function loadSuperAffiliateRows(): Promise<SuperAffiliateRow[]> {
  const client: any = await getDynamicSupabaseClient();
  const { data: user } = await client.auth.getUser();
  if (!user?.user) throw new Error('A Supabase-authenticated Super Admin account is required for live affiliate data.');
  const [affiliates, commissions, referrals, payouts] = await Promise.all([
    client.from('affiliates').select('id, user_id, display_name, referral_code, status, affiliate_type, parent_agent_id, phone_whatsapp, nida_number, tin_number, payout_method, payout_account, mobile_money_number, mobile_money_provider, promo_code, referral_link').order('created_at', { ascending: false }),
    client.from('affiliate_commissions').select('affiliate_id, account_type, gross_revenue, gross_commission, withholding_tax, net_payout, payout_status'),
    client.from('affiliate_referrals').select('affiliate_id, revenue_generated'),
    client.from('affiliate_payouts').select('affiliate_id, amount, status'),
  ]);
  const failed = [affiliates, commissions, referrals, payouts].find((result: any) => result.error);
  if (failed?.error) throw failed.error;
  const empty = () => ({ grossRevenue: 0, grossCommission: 0, withholdingTax: 0, netPayout: 0, referrals: 0, payouts: 0, payoutStatus: 'pending' });
  const byAffiliate = new Map<string, ReturnType<typeof empty>>();
  for (const item of commissions.data || []) {
    const row = byAffiliate.get(item.affiliate_id) || empty();
    row.grossRevenue += Number(item.gross_revenue || 0);
    row.grossCommission += Number(item.gross_commission || 0);
    row.withholdingTax += Number(item.withholding_tax || 0);
    row.netPayout += Number(item.net_payout || 0);
    row.payoutStatus = item.payout_status || row.payoutStatus;
    byAffiliate.set(item.affiliate_id, row);
  }
  for (const item of referrals.data || []) {
    const row = byAffiliate.get(item.affiliate_id) || empty();
    row.referrals += 1;
    if (!row.grossRevenue && Number(item.revenue_generated || 0) > 0) {
      row.grossRevenue += Number(item.revenue_generated || 0);
      row.grossCommission = row.grossRevenue * 0.15;
      row.withholdingTax = row.grossCommission * 0.05;
      row.netPayout = row.grossCommission - row.withholdingTax;
    }
    byAffiliate.set(item.affiliate_id, row);
  }
  for (const item of payouts.data || []) {
    const row = byAffiliate.get(item.affiliate_id) || empty();
    row.payouts += Number(item.amount || 0);
    row.payoutStatus = item.status || row.payoutStatus;
    byAffiliate.set(item.affiliate_id, row);
  }
  return (affiliates.data || []).map((affiliate: any) => ({
    ...affiliate,
    affiliate_type: affiliate.affiliate_type || 'organic',
    promo_code: affiliate.promo_code || affiliate.referral_code,
    referral_link: affiliate.referral_link || `/signup?ref=${String(affiliate.referral_code || '').toLowerCase()}`,
    ...(byAffiliate.get(affiliate.id) || empty())
  }));
}

export async function updateSuperAffiliate(id: string, updates: Record<string, unknown>) {
  const client: any = await getDynamicSupabaseClient();
  const { error } = await client.from('affiliates').update(updates).eq('id', id);
  if (error) throw error;
  const { error: auditError } = await client.rpc('record_partner_affiliate_action', { p_affiliate_id: id, p_action: 'profile_updated', p_metadata: updates });
  if (auditError) throw auditError;
}
