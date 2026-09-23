export interface SalesDocumentTotalsInput {
  items?: Array<{ qty?: number; price?: number }>;
  discountAmount?: number;
  deliveryCost?: number;
  hasVat?: boolean;
  taxRate?: number;
  paidAmount?: number;
}

export interface SalesDocumentTotals {
  subTotal: number;
  discount: number;
  taxableAmount: number;
  tax: number;
  delivery: number;
  total: number;
  paid: number;
  balance: number;
}

const finiteNonNegative = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

/** The authoritative calculation contract shared by document UI and PDF output. */
export const calculateSalesDocumentTotals = (
  document: SalesDocumentTotalsInput,
): SalesDocumentTotals => {
  const subTotal = (document.items || []).reduce(
    (sum, item) => sum + finiteNonNegative(item.qty) * finiteNonNegative(item.price),
    0,
  );
  const discount = Math.min(subTotal, finiteNonNegative(document.discountAmount));
  const taxableAmount = Math.max(0, subTotal - discount);
  const taxRate = finiteNonNegative(document.taxRate);
  const tax = document.hasVat ? taxableAmount * taxRate : 0;
  const delivery = finiteNonNegative(document.deliveryCost);
  const total = taxableAmount + tax + delivery;
  const paid = Math.min(total, finiteNonNegative(document.paidAmount));

  return {
    subTotal,
    discount,
    taxableAmount,
    tax,
    delivery,
    total,
    paid,
    balance: Math.max(0, total - paid),
  };
};
