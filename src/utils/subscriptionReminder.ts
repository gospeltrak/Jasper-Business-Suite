export interface SubscriptionReminder {
  level: 'trial' | 'expiring' | 'expired';
  title: string;
  message: string;
  daysRemaining: number;
}

export const getSubscriptionReminder = (
  planId: string,
  planName: string,
  daysRemaining: number,
  isExpired: boolean,
  isTrial: boolean,
): SubscriptionReminder | null => {
  // Free trial: show a running countdown for the whole trial (not just the
  // last 3 days) -- unlike a paid plan, a trial is short and time-limited by
  // design, so the tenant should always know how much of it is left.
  if (isTrial) {
    if (isExpired || daysRemaining <= 0) {
      return {
        level: 'expired',
        title: 'Free trial expired',
        message: 'Your free trial has ended. Upgrade to keep using Orvix -- your account and business data remain safely preserved.',
        daysRemaining: 0,
      };
    }
    return {
      level: 'trial',
      title: `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left in trial`,
      message: daysRemaining === 1
        ? 'Your free trial ends tomorrow. Upgrade now to keep your business running without interruption.'
        : `Your free trial ends in ${daysRemaining} days. Upgrade any time to keep full access.`,
      daysRemaining,
    };
  }

  // Paid plan (Ruby, Diamond, or Tanzanite): only an urgency warning in the
  // final 3 days, same as before -- generalized to every plan instead of
  // Tanzanite only, using the plan's own name in the message.
  if (isExpired || daysRemaining <= 0) {
    return {
      level: 'expired',
      title: `${planName} package expired`,
      message: 'Renew to restore full access. Your account and business data remain safely preserved.',
      daysRemaining: 0,
    };
  }
  if (daysRemaining > 3) return null;
  const message = daysRemaining === 1
    ? `Your ${planName} package expires tomorrow. Renew now to avoid interruption.`
    : daysRemaining === 2
      ? `Your ${planName} package expires in 2 days. Renew now to keep your workspace active.`
      : `Your ${planName} package expires in 3 days. Renew now to continue without interruption.`;
  return {
    level: 'expiring',
    title: `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`,
    message,
    daysRemaining,
  };
};

export const getSubscriptionReminderKey = (
  tenantId: string,
  endAt: string | undefined,
  reminder: SubscriptionReminder,
): string => [
  'jasper-subscription-reminder',
  tenantId,
  endAt || 'no-end',
  reminder.level,
  reminder.daysRemaining,
].join(':');
