/**
 * Public presentation policy for Orvix Affiliate V2.
 * Authoritative money grants and payout eligibility live in PostgreSQL RPCs.
 */
export const AFFILIATE_REGISTRATION_BONUS_TZS = 2_000;
export const AFFILIATE_RECURRING_RATE = 0.10;
export const AFFILIATE_MIN_WITHDRAWAL_TZS = 10_000;
export const AFFILIATE_AZAMPAY_EXTERNAL_FEE_TZS = 200;

export type AffiliateRewardEntry = {
  id: string;
  reward_type: 'registration_bonus' | 'subscription_commission';
  source_revenue: number;
  gross_amount: number;
  withholding_tax: number;
  net_amount: number;
  status: 'available' | 'reserved' | 'paid' | 'void';
  created_at: string;
  paid_at: string | null;
};

export const isAzamPesaWallet = (provider: string | null | undefined) =>
  ['azampesa', 'azam pesa', 'azam-pesa'].includes(String(provider || '').trim().toLowerCase());

export const getAzamPayFee = (provider: string | null | undefined) =>
  isAzamPesaWallet(provider) ? 0 : AFFILIATE_AZAMPAY_EXTERNAL_FEE_TZS;

/** The last Friday in the Africa/Dar_es_Salaam calendar, independent of device timezone. */
export function getTanzaniaMonthEndWithdrawalDate(today = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(today);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const day = Number(parts.find(p => p.type === 'day')?.value);
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const daysSinceFriday = (monthEnd.getUTCDay() - 5 + 7) % 7;
  const lastFriday = monthEnd.getUTCDate() - daysSinceFriday;
  return {
    isLastFriday: day === lastFriday,
    dateISO: `${year}-${String(month).padStart(2, '0')}-${String(lastFriday).padStart(2, '0')}`,
    currentMonth: `${year}-${String(month).padStart(2, '0')}`,
  };
}

export function sumRewardBalance(rewards: AffiliateRewardEntry[]) {
  return rewards.filter(reward => reward.status === 'available').reduce(
    (balance, entry) => {
      if (entry.reward_type === 'registration_bonus') balance.bonus += Number(entry.net_amount || 0);
      if (entry.reward_type === 'subscription_commission') balance.commission += Number(entry.net_amount || 0);
      return balance;
    }, { bonus: 0, commission: 0 }
  );
}
