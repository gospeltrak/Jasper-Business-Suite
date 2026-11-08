import { isSettledPaymentStatus } from '../../../shared/utils/financialStatus';

export type AffiliateCustomerSummaryInput = {
  id?: string;
  payment_status?: string | null;
  package_name?: string | null;
  package_id?: string | null;
  subscription_end_date?: string | null;
};

export type AffiliateCustomerState = 'paid' | 'trial' | 'unpaid';

/** Paid means an explicitly settled payment. An active account is not proof of payment. */
export function getAffiliateCustomerState(customer: AffiliateCustomerSummaryInput, now = new Date()): AffiliateCustomerState {
  if (isSettledPaymentStatus(customer.payment_status)) return 'paid';
  const status = String(customer.payment_status || '').trim().toLowerCase();
  const plan = String(customer.package_name || customer.package_id || '').trim().toLowerCase();
  const trial = ['trial', 'free trial', 'free_trial'].includes(status) ||
    ['trial', 'free trial', 'free_trial'].includes(plan);
  const expires = customer.subscription_end_date ? new Date(customer.subscription_end_date).getTime() : NaN;
  return trial && (!Number.isFinite(expires) || expires >= now.getTime()) ? 'trial' : 'unpaid';
}

export function getAffiliateDashboardSummary(customers: AffiliateCustomerSummaryInput[], now = new Date()) {
  const counts = { total: customers.length, paid: 0, unpaid: 0, trial: 0, ruby: 0, diamond: 0, tanzanite: 0 };
  for (const customer of customers) {
    const state = getAffiliateCustomerState(customer, now);
    counts[state] += 1;
    if (state !== 'paid') continue;
    const packageName = String(customer.package_name || customer.package_id || '').trim().toLowerCase();
    if (packageName.includes('ruby')) counts.ruby++;
    else if (packageName.includes('diamond')) counts.diamond++;
    else if (packageName.includes('tanzanite')) counts.tanzanite++;
  }
  return counts;
}
