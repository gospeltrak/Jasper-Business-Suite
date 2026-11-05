import { describe, expect, it } from 'vitest';
import {
  AFFILIATE_REGISTRATION_BONUS_TZS,
  AFFILIATE_RECURRING_RATE,
  AFFILIATE_MIN_WITHDRAWAL_TZS,
  getAzamPayFee,
  getTanzaniaMonthEndWithdrawalDate,
  sumRewardBalance,
  type AffiliateRewardEntry,
} from './affiliatePolicy';

describe('Orvix Affiliate V2: financial policy', () => {
  it('pays TZS 2,000 once at signup, 10% for verified recurring revenue, and starts withdrawal at TZS 10,000', () => {
    expect(AFFILIATE_REGISTRATION_BONUS_TZS).toBe(2000);
    expect(AFFILIATE_RECURRING_RATE).toBe(0.10);
    expect(50_000 * AFFILIATE_RECURRING_RATE).toBe(5_000);
    expect(AFFILIATE_MIN_WITHDRAWAL_TZS).toBe(10_000);
    expect(AFFILIATE_REGISTRATION_BONUS_TZS * 5).toBe(AFFILIATE_MIN_WITHDRAWAL_TZS);
  });

  it('applies AzamPay TZS 200 for external wallets but no AzamPesa internal charge', () => {
    expect(getAzamPayFee('m-pesa')).toBe(200);
    expect(getAzamPayFee('airtel_money')).toBe(200);
    expect(getAzamPayFee('azampesa')).toBe(0);
    expect(getAzamPayFee('Azam Pesa')).toBe(0);
  });

  it('uses Tanzania local calendar for the last Friday', () => {
    expect(getTanzaniaMonthEndWithdrawalDate(new Date('2026-11-27T12:00:00Z'))).toEqual({
      dateISO: '2026-11-27', currentMonth: '2026-11', isLastFriday: true,
    });
    expect(getTanzaniaMonthEndWithdrawalDate(new Date('2026-11-28T12:00:00Z')).isLastFriday).toBe(false);
    expect(getTanzaniaMonthEndWithdrawalDate(new Date('2026-11-26T21:30:00Z')).isLastFriday).toBe(true);
  });

  it('keeps bonus and subscription balances separate; pending/paid rewards cannot be withdrawn again', () => {
    const reward = (type: AffiliateRewardEntry['reward_type'], status: AffiliateRewardEntry['status'], net: number): AffiliateRewardEntry => ({
      id: String(net), tenant_id: 'tenant', reward_type: type, source_revenue: 0,
      gross_amount: net, withholding_tax: 0, net_amount: net, status,
      created_at: '2026-11-05T00:00:00Z', paid_at: null,
    });
    expect(sumRewardBalance([
      reward('registration_bonus','available',2000),
      reward('subscription_commission','available',5000),
      reward('registration_bonus','reserved',2000),
      reward('subscription_commission','paid',3000),
    ])).toEqual({ bonus: 2000, commission: 5000 });
  });
});
