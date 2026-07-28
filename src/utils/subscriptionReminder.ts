export interface SubscriptionReminder {
  level: 'expiring' | 'expired';
  title: string;
  message: string;
  daysRemaining: number;
}

export const getSubscriptionReminder = (
  planId: string,
  daysRemaining: number,
  isExpired: boolean,
): SubscriptionReminder | null => {
  if (String(planId).toLowerCase() !== 'tanzanite') return null;
  if (isExpired || daysRemaining <= 0) {
    return {
      level: 'expired',
      title: 'Tanzanite package expired',
      message: 'Renew to restore Branch access. Your branch records and business data remain safely preserved.',
      daysRemaining: 0,
    };
  }
  if (daysRemaining > 3) return null;
  const message = daysRemaining === 1
    ? 'Your Tanzanite package expires tomorrow. Renew now to avoid interruption.'
    : daysRemaining === 2
      ? 'Your Tanzanite package expires in 2 days. Renew now to keep your Branch workspace active.'
      : 'Your Tanzanite package expires in 3 days. Renew now to continue using Branch features without interruption.';
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
