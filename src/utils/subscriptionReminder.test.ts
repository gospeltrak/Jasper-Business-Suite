import { describe, expect, it } from 'vitest';
import { getSubscriptionReminder, getSubscriptionReminderKey } from './subscriptionReminder';

describe('Tanzanite expiry reminders', () => {
  it('does not show an urgent reminder above three days', () => {
    expect(getSubscriptionReminder('tanzanite', 4, false)).toBeNull();
    expect(getSubscriptionReminder('diamond', 2, false)).toBeNull();
  });

  it.each([
    [3, 'expires in 3 days'],
    [2, 'expires in 2 days'],
    [1, 'expires tomorrow'],
  ])('shows the correct message at %i days', (days, phrase) => {
    expect(getSubscriptionReminder('tanzanite', days, false)?.message).toContain(phrase);
  });

  it('uses a stable daily/end-date key for deduplication', () => {
    const reminder = getSubscriptionReminder('tanzanite', 2, false)!;
    expect(getSubscriptionReminderKey('tenant-a', '2026-08-01T00:00:00Z', reminder))
      .toBe('jasper-subscription-reminder:tenant-a:2026-08-01T00:00:00Z:expiring:2');
  });

  it('states explicitly that data is preserved after expiry', () => {
    expect(getSubscriptionReminder('tanzanite', 0, true)?.message).toContain('remain safely preserved');
  });
});
