import { describe, expect, it } from 'vitest';
import { checkSubscriptionStatus, type SubscriptionState } from './subscription';

const paidState = (serverNow: string, endAt: string): SubscriptionState => ({
  planId: 'tanzanite',
  trialStartedAt: serverNow,
  isSubscribedPaid: true,
  paidAt: serverNow,
  subscriptionStartAt: serverNow,
  subscriptionEndAt: endAt,
  serverNowAtLoad: serverNow,
  loadedAtClient: new Date().toISOString(),
  paymentStatus: 'active',
});

describe('authoritative subscription status', () => {
  it('reports a newly activated exact 30-day period as 30 days remaining', () => {
    const status = checkSubscriptionStatus(
      paidState('2026-01-31T12:00:00.000Z', '2026-03-02T12:00:00.000Z'),
      0,
      0,
      0,
    );
    expect(status.daysRemaining).toBe(30);
    expect(status.isExpired).toBe(false);
    expect(status.isNearingExpiry).toBe(false);
  });

  it('uses the authoritative end timestamp across month and timezone boundaries', () => {
    const status = checkSubscriptionStatus(
      paidState('2026-03-28T23:30:00.000Z', '2026-03-31T23:30:00.000Z'),
      0,
      0,
      0,
    );
    expect(status.daysRemaining).toBe(3);
    expect(status.isNearingExpiry).toBe(true);
  });

  it('expires at the exclusive end timestamp', () => {
    const state = paidState('2026-04-30T00:00:00.000Z', '2026-04-30T00:00:00.000Z');
    expect(checkSubscriptionStatus(state, 0, 0, 0).isExpired).toBe(true);
    expect(checkSubscriptionStatus(state, 0, 0, 0).daysRemaining).toBe(0);
  });
});
