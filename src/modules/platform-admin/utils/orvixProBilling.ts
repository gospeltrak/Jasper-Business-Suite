/**
 * Orvix Pro individual monthly billing: pure, server-reusable bookkeeping.
 * NO charging, entitlement changes, automatic renewal, or client-side trust.
 * Contract/invoice/payment evidence must be validated by the future secure
 * backend against the tenant and admin before this calculation is used.
 */
export interface ProBillingContract {
  tenantId: string;
  invoiceId: string;
  currency: string;
  monthlyFee: number;
  startsAt: string;
  endsAt: string;
}

export interface ProPaymentEvidence {
  id: string;
  tenantId: string;
  invoiceId: string;
  currency: string;
  amount: number;
  status: 'pending' | 'verified' | 'failed' | 'reversed';
}

export interface ProBillingResult {
  agreedMonthlyFee: number;
  verifiedPaymentTotal: number;
  openingCreditApplied: number;
  amountCovered: number;
  amountRemaining: number;
  creditAvailable: number;
  paymentComplete: boolean;
  /** Calculation only — NEVER activates Pro without a server transaction. */
  eligibleForActivation: boolean;
  verifiedPaymentCount: number;
  ignoredUnverifiedCount: number;
}

const toMinor = (value: number, name: string, allowZero = true): number => {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(name + ' must be a positive finite amount.');
  }
  const scaled = value * 100;
  if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-7) {
    throw new Error(name + ' must have at most two decimals and be within the supported range.');
  }
  return Math.round(scaled);
};

export function calculateOrvixProBilling(
  contract: ProBillingContract,
  payments: readonly ProPaymentEvidence[],
  openingCredit = 0,
  asOf = new Date().toISOString(),
): ProBillingResult {
  if (!contract.tenantId.trim() || !contract.invoiceId.trim() || !contract.currency.trim()) {
    throw new Error('Verified contract identity and currency are required.');
  }
  const start = Date.parse(contract.startsAt);
  const end = Date.parse(contract.endsAt);
  const now = Date.parse(asOf);
  if (![start, end, now].every(Number.isFinite) || start >= end) {
    throw new Error('Valid contract dates are required.');
  }
  const feeMinor = toMinor(contract.monthlyFee, 'Monthly fee', false);
  const openingMinor = toMinor(openingCredit, 'Opening verified credit');
  let verifiedMinor = 0;
  let verifiedPaymentCount = 0;
  let ignoredUnverifiedCount = 0;
  const seen = new Map<string, string>();

  for (const payment of payments) {
    if (payment.tenantId !== contract.tenantId ||
        payment.invoiceId !== contract.invoiceId ||
        payment.currency !== contract.currency) {
      throw new Error('Payment evidence belongs to a different tenant, invoice or currency.');
    }
    if (!payment.id.trim()) throw new Error('Immutable payment ID is required.');
    if (!['pending', 'verified', 'failed', 'reversed'].includes(payment.status)) {
      throw new Error('Payment status cannot be validated.');
    }
    const minor = toMinor(payment.amount, 'Payment amount', false);
    const fingerprint = payment.status + ':' + minor;
    const previous = seen.get(payment.id);
    if (previous !== undefined) {
      if (previous !== fingerprint) throw new Error('Conflicting payment evidence with the same ID.');
      continue;
    }
    seen.set(payment.id, fingerprint);
    if (payment.status !== 'verified') {
      ignoredUnverifiedCount++;
      continue;
    }
    verifiedMinor += minor;
    if (!Number.isSafeInteger(verifiedMinor)) throw new Error('Verified total is too large.');
    verifiedPaymentCount++;
  }
  const totalAvailable = verifiedMinor + openingMinor;
  if (!Number.isSafeInteger(totalAvailable)) throw new Error('Combined credit exceeds safe monetary range.');
  const covered = Math.min(totalAvailable, feeMinor);
  const paymentComplete = totalAvailable >= feeMinor;
  return {
    agreedMonthlyFee: feeMinor / 100,
    verifiedPaymentTotal: verifiedMinor / 100,
    openingCreditApplied: Math.min(openingMinor, feeMinor) / 100,
    amountCovered: covered / 100,
    amountRemaining: (feeMinor - covered) / 100,
    creditAvailable: (totalAvailable - covered) / 100,
    paymentComplete,
    eligibleForActivation: paymentComplete && now >= start && now < end,
    verifiedPaymentCount,
    ignoredUnverifiedCount,
  };
}
