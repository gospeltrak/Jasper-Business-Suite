import type { Sale } from '../../../types';

const finiteNonNegative = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

/** amountPaid is the cumulative server value, including installments. */
export const getSaleCollected = (sale: Sale): number => {
  const total = finiteNonNegative(sale.total);
  const recordedPaid = sale.amountPaid ?? (sale.paymentMethod === 'Credit' ? 0 : total);
  return Math.min(total, finiteNonNegative(recordedPaid));
};

export const getSaleCheckoutPaid = (sale: Sale, history: Array<{ amount: number }> = sale.payments || []): number =>
  Math.max(0, getSaleCollected(sale) -
    history.reduce((sum, payment) => sum + finiteNonNegative(payment?.amount), 0));

/**
 * Sales-module accounting is PRODUCT-ONLY. The original sale.total remains
 * the customer's combined POS checkout total for legacy receipts and audit.
 * Delivery charges belong exclusively to Deliveries, never to Sales KPIs,
 * customer product debts, or product payment-mode breakdowns.
 */
export const getProductSalesTotal = (sale: Sale): number => {
  const provided = Number(sale.productTotal);
  return Number.isFinite(provided) && sale.productTotal !== undefined && sale.productTotal !== null
    ? finiteNonNegative(provided)
    : Math.max(0, finiteNonNegative(sale.total) - finiteNonNegative(sale.deliveryCost));
};

export const getProductSalesCollected = (sale: Sale): number =>
  Math.min(getProductSalesTotal(sale), getSaleCollected(sale));

export const getProductSalesDue = (sale: Sale): number =>
  Math.max(0, getProductSalesTotal(sale) - getProductSalesCollected(sale));
