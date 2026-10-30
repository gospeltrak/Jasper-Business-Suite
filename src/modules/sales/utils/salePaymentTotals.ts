import type { Sale } from '../../../types';

/** amountPaid is the cumulative server value, including installments. */
export const getSaleCollected = (sale: Sale): number => Math.max(0, Math.min(Number(sale.total || 0),
  Number(sale.amountPaid ?? (sale.paymentMethod === 'Credit' ? 0 : sale.total))));

export const getSaleCheckoutPaid = (sale: Sale, history: Array<{ amount: number }> = sale.payments || []): number =>
  Math.max(0, getSaleCollected(sale) - history.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
