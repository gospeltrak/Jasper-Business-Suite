const normalizeStatus = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, ' ');

const SETTLED_PAYMENT_STATUSES = new Set([
  'paid',
  'payment paid',
  'success',
  'successful',
  'completed',
  'payment completed',
  'approved',
  'verified',
  'settled',
]);

const EARNED_COMMISSION_STATUSES = new Set([
  ...SETTLED_PAYMENT_STATUSES,
  'available',
]);

const PAID_PAYOUT_STATUSES = new Set([
  ...SETTLED_PAYMENT_STATUSES,
  'processed',
]);

/**
 * Recognize money only after an explicit payment state. Account and
 * subscription states such as active, trial and registered are not payment
 * evidence. Exact matching also prevents "unpaid" from matching "paid".
 */
export const isSettledPaymentStatus = (value: unknown): boolean => (
  SETTLED_PAYMENT_STATUSES.has(normalizeStatus(value))
);

export const isEarnedCommissionStatus = (value: unknown): boolean => (
  EARNED_COMMISSION_STATUSES.has(normalizeStatus(value))
);

export const isPaidPayoutStatus = (value: unknown): boolean => (
  PAID_PAYOUT_STATUSES.has(normalizeStatus(value))
);
