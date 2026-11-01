import type { Sale } from '../../../types';

/** amountPaid is the cumulative server value, including installments. */
export const getSaleCollected = (sale: Sale): number => Math.max(0, Math.min(Number(sale.total || 0),
  Number(sale.amountPaid ?? (sale.paymentMethod === 'Credit' ? 0 : sale.total))));

export const getSaleCheckoutPaid = (sale: Sale, history: Array<{ amount: number }> = sale.payments || []): number =>
  Math.max(0, getSaleCollected(sale) - history.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));

/**
 * Sales-module accounting is PRODUCT-ONLY. The original sale.total remains
 * the customer's combined POS checkout total for legacy receipts and audit.
 * Delivery charges belong exclusively to Deliveries, never to Sales KPIs,
 * customer product debts, or product payment-mode breakdowns.
 */
export const getProductSalesTotal = (sale: Sale): number =>
  Math.max(0, Number.isFinite(Number(sale.productTotal))
    && sale.productTotal !== undefined && sale.productTotal !== null
      ? Number(sale.productTotal)
      : Number(sale.total || 0) - Number(sale.deliveryCost || 0));

export const getProductSalesCollected = (sale: Sale): number =>
  Math.max(0, Math.min(getProductSalesTotal(sale), getSaleCollected(sale)));

export const getProductSalesDue = (sale: Sale): number =>
  Math.max(0, getProductSalesTotal(sale) - getProductSalesCollected(sale));
