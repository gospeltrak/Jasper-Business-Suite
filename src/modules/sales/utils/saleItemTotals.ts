import type { SaleItem } from '../../../types';

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

/**
 * Cost of one unit of this item at the time it was actually sold. Always
 * prefers the item's own costPriceAtSale snapshot, recorded at checkout --
 * NEVER a product's current cost price, since a cost-price change since
 * that sale would retroactively misstate that historical sale's margin
 * (found live in two places this way: Reports' Product Audit table showed
 * a strongly profitable product as a large loss, and Home's profit figure
 * was understated tenant-wide, both traced to using product.costPrice
 * directly instead of this field). Falls back to the product's current
 * cost only for legacy records saved before costPriceAtSale existed, and
 * to a flat 30%-of-price estimate when the product can no longer be found
 * (e.g. deleted since the sale).
 */
export const getSaleItemUnitCost = (item: SaleItem, product?: { costPrice: number } | null): number => {
  if (item.costPriceAtSale !== undefined && Number.isFinite(Number(item.costPriceAtSale))) {
    return Number(item.costPriceAtSale);
  }
  if (product) return safeNumber(product.costPrice);
  return safeNumber(item.price) * 0.70;
};
