export interface SubscriptionReminder {
  level: 'trial' | 'expiring' | 'expired';
  title: string;
  message: string;
  daysRemaining: number;
}

// Written out in full for both languages instead of relying on the app's
// automatic word-by-word DOM translator: that translator can swap a common
// short word (e.g. "to" -> "Hadi") inside an otherwise-English sentence,
// producing mixed-language nonsense like "Pay any time Hadi keep full
// access." These notification strings are shown as-is, so they must already
// be correct in whichever language is active.
export const getSubscriptionReminder = (
  planId: string,
  planName: string,
  daysRemaining: number,
  isExpired: boolean,
  isTrial: boolean,
  language: string = 'en',
): SubscriptionReminder | null => {
  const isSw = language === 'sw';

  // Free trial: show a running countdown for the whole trial (not just the
  // last 3 days) -- unlike a paid plan, a trial is short and time-limited by
  // design, so the tenant should always know how much of it is left.
  if (isTrial) {
    if (isExpired || daysRemaining <= 0) {
      return {
        level: 'expired',
        title: isSw ? 'Jaribio la bure limeisha' : 'Free trial expired',
        message: isSw
          ? 'Muda wako wa jaribio la bure umeisha. Lipia ili uendelee kutumia Orvix -- akaunti yako na taarifa za biashara zimehifadhiwa salama.'
          : 'Your free trial has ended. Pay to keep using Orvix -- your account and business data remain safely preserved.',
        daysRemaining: 0,
      };
    }
    return {
      level: 'trial',
      title: isSw
        ? `Siku ${daysRemaining} ${daysRemaining === 1 ? 'imebaki' : 'zimebaki'} kwenye jaribio`
        : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left in trial`,
      message: isSw
        ? (daysRemaining === 1
          ? 'Jaribio lako la bure linaisha kesho. Lipia sasa ili biashara yako iendelee bila kukatizwa.'
          : `Jaribio lako la bure linaisha baada ya siku ${daysRemaining}. Unaweza kulipia wakati wowote ili kuendelea na huduma kamili.`)
        : (daysRemaining === 1
          ? 'Your free trial ends tomorrow. Pay now to keep your business running without interruption.'
          : `Your free trial ends in ${daysRemaining} days. Pay any time to keep full access.`),
      daysRemaining,
    };
  }

  // Paid plan (Ruby, Diamond, or Tanzanite): only an urgency warning in the
  // final 3 days, same as before -- generalized to every plan instead of
  // Tanzanite only, using the plan's own name in the message.
  if (isExpired || daysRemaining <= 0) {
    return {
      level: 'expired',
      title: isSw ? `Kifurushi cha ${planName} kimeisha muda` : `${planName} package expired`,
      message: isSw
        ? 'Lipia ili urejeshe huduma kamili. Akaunti yako na taarifa za biashara zimehifadhiwa salama.'
        : 'Pay to restore full access. Your account and business data remain safely preserved.',
      daysRemaining: 0,
    };
  }
  if (daysRemaining > 3) return null;
  const message = isSw
    ? (daysRemaining === 1
      ? `Kifurushi chako cha ${planName} kinaisha kesho. Lipia sasa ili usikatizwe.`
      : `Kifurushi chako cha ${planName} kinaisha baada ya siku ${daysRemaining}. Lipia sasa ili kiendelee kufanya kazi.`)
    : (daysRemaining === 1
      ? `Your ${planName} package expires tomorrow. Pay now to avoid interruption.`
      : daysRemaining === 2
        ? `Your ${planName} package expires in 2 days. Pay now to keep your workspace active.`
        : `Your ${planName} package expires in 3 days. Pay now to continue without interruption.`);
  return {
    level: 'expiring',
    title: isSw
      ? `Siku ${daysRemaining} ${daysRemaining === 1 ? 'imebaki' : 'zimebaki'}`
      : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`,
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
