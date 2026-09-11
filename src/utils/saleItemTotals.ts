import type { SaleItem } from '../types';

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Immutable selected-level gross value; safe for legacy records without snapshots. */
export const getSaleItemGrossTotal = (item: SaleItem): number => {
  const quantity = Math.max(0, safeNumber(item.selectedLevelQuantity ?? item.qty));
  const unitPrice = Math.max(0, safeNumber(item.selectedUnitPrice ?? item.price));
  return Number((quantity * unitPrice).toFixed(2));
};

/** Authoritative persisted line value, including the line discount when recorded. */
export const getSaleItemLineTotal = (item: SaleItem): number => {
  if (item.lineTotal !== undefined && Number.isFinite(Number(item.lineTotal))) {
    return Math.max(0, Number(item.lineTotal));
  }
  const gross = getSaleItemGrossTotal(item);
  const discount = Math.max(0, safeNumber(item.discount));
  return Number((item.discountType === 'cash'
    ? Math.max(0, gross - (discount * Math.max(0, safeNumber(item.qty))))
    : gross * (1 - Math.min(100, discount) / 100)).toFixed(2));
};
