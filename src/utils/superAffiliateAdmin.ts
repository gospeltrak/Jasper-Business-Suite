import { getDynamicSupabaseClient } from '../supabaseClient';

export interface SuperAffiliateRow {
  id: string; display_name: string; referral_code: string; status: string;
  nida_number: string | null; tin_number: string | null; payout_method: string | null; payout_account: string | null;
  grossRevenue: number; grossCommission: number; withholdingTax: number; netPayout: number;
  referrals: number; payouts: number;
}

export async function loadSuperAffiliateRows(): Promise<SuperAffiliateRow[]> {
  const client: any = await getDynamicSupabaseClient();
  const { data: user } = await client.auth.getUser();
  if (!user?.user) throw new Error('A Supabase-authenticated Super Admin account is required for live affiliate data.');
  const [affiliates, commissions, referrals, payouts] = await Promise.all([
    client.from('affiliates').select('id, display_name, referral_code, status, nida_number, tin_number, payout_method, payout_account').order('created_at', { ascending: false }),
    client.from('affiliate_commissions').select('affiliate_id, gross_revenue, gross_commission, withholding_tax, net_payout'),
    client.from('affiliate_referrals').select('affiliate_id'),
    client.from('affiliate_payouts').select('affiliate_id, amount'),
  ]);
  const failed = [affiliates, commissions, referrals, payouts].find((result: any) => result.error);
  if (failed?.error) throw failed.error;
  const byAffiliate = new Map<string, Omit<SuperAffiliateRow, 'id' | 'display_name' | 'referral_code' | 'status' | 'nida_number' | 'tin_number' | 'payout_method' | 'payout_account'>>();
  for (const item of commissions.data || []) { const row = byAffiliate.get(item.affiliate_id) || { grossRevenue: 0, grossCommission: 0, withholdingTax: 0, netPayout: 0, referrals: 0, payouts: 0 }; row.grossRevenue += Number(item.gross_revenue); row.grossCommission += Number(item.gross_commission); row.withholdingTax += Number(item.withholding_tax); row.netPayout += Number(item.net_payout); byAffiliate.set(item.affiliate_id, row); }
  for (const item of referrals.data || []) { const row = byAffiliate.get(item.affiliate_id) || { grossRevenue: 0, grossCommission: 0, withholdingTax: 0, netPayout: 0, referrals: 0, payouts: 0 }; row.referrals += 1; byAffiliate.set(item.affiliate_id, row); }
  for (const item of payouts.data || []) { const row = byAffiliate.get(item.affiliate_id) || { grossRevenue: 0, grossCommission: 0, withholdingTax: 0, netPayout: 0, referrals: 0, payouts: 0 }; row.payouts += Number(item.amount); byAffiliate.set(item.affiliate_id, row); }
  return (affiliates.data || []).map((affiliate: any) => ({ ...affiliate, ...(byAffiliate.get(affiliate.id) || { grossRevenue: 0, grossCommission: 0, withholdingTax: 0, netPayout: 0, referrals: 0, payouts: 0 }) }));
}

export async function updateSuperAffiliate(id: string, updates: Record<string, unknown>) {
  const client: any = await getDynamicSupabaseClient();
  const { error } = await client.from('affiliates').update(updates).eq('id', id);
  if (error) throw error;
  const { error: auditError } = await client.rpc('record_partner_affiliate_action', { p_affiliate_id: id, p_action: 'profile_updated', p_metadata: updates });
  if (auditError) throw auditError;
}
