import { describe, expect, it } from 'vitest';
import { getSubscriptionReminder, getSubscriptionReminderKey } from './subscriptionReminder';

describe('Paid plan expiry reminders', () => {
  it('does not show an urgent reminder above three days, on any plan', () => {
    expect(getSubscriptionReminder('tanzanite', 'Tanzanite', 4, false, false)).toBeNull();
    expect(getSubscriptionReminder('diamond', 'Diamond', 4, false, false)).toBeNull();
    expect(getSubscriptionReminder('ruby', 'Ruby', 4, false, false)).toBeNull();
  });

  it.each([
    [3, 'expires in 3 days'],
    [2, 'expires in 2 days'],
    [1, 'expires tomorrow'],
  ])('shows the correct message at %i days for Tanzanite', (days, phrase) => {
    expect(getSubscriptionReminder('tanzanite', 'Tanzanite', days, false, false)?.message).toContain(phrase);
  });

  it('applies the same 3-day warning to non-Tanzanite plans too', () => {
    const reminder = getSubscriptionReminder('diamond', 'Diamond', 2, false, false);
    expect(reminder).not.toBeNull();
    expect(reminder?.message).toContain('Diamond');
    expect(reminder?.message).toContain('expires in 2 days');
  });

  it('uses a stable daily/end-date key for deduplication', () => {
    const reminder = getSubscriptionReminder('tanzanite', 'Tanzanite', 2, false, false)!;
    expect(getSubscriptionReminderKey('tenant-a', '2026-08-01T00:00:00Z', reminder))
      .toBe('jasper-subscription-reminder:tenant-a:2026-08-01T00:00:00Z:expiring:2');
  });

  it('states explicitly that data is preserved after expiry', () => {
    expect(getSubscriptionReminder('tanzanite', 'Tanzanite', 0, true, false)?.message).toContain('remain safely preserved');
  });
});

describe('Free trial countdown', () => {
  it('shows a countdown from day one, unlike a paid plan', () => {
    const reminder = getSubscriptionReminder('trial', 'Diamond Free Trial', 20, false, true);
    expect(reminder).not.toBeNull();
    expect(reminder?.level).toBe('trial');
    expect(reminder?.daysRemaining).toBe(20);
    expect(reminder?.title).toContain('20');
  });

  it('reflects the promo-code-driven 10 vs 20 day duration as passed in', () => {
    expect(getSubscriptionReminder('trial', 'Diamond Free Trial', 10, false, true)?.daysRemaining).toBe(10);
    expect(getSubscriptionReminder('trial', 'Diamond Free Trial', 1, false, true)?.message).toContain('tomorrow');
  });

  it('reports expiry distinctly from a paid plan running out', () => {
    const reminder = getSubscriptionReminder('trial', 'Diamond Free Trial', 0, true, true);
    expect(reminder?.level).toBe('expired');
    expect(reminder?.title).toContain('trial');
    expect(reminder?.message).toContain('remain safely preserved');
  });
});
