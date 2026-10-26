import type { Product } from '../../../types';

export type ManualAdjustmentDirection = 'add' | 'deduct';

/**
 * A manual stock adjustment targets the SHOP bucket shown in Adjust Stock.
 * Warehouse stock stays untouched. Total stock must always equal the two
 * buckets. Never silently clamp a deduction: a requested -2 must be exactly
 * -2 or the save must be rejected.
 *
 * The caller must persist the result and confirm server success before
 * writing an audit log or closing the form.
 */
export function prepareManualStockAdjustment(
  product: Product,
  direction: ManualAdjustmentDirection,
  quantity: number,
): { product: Product; previousShopStock: number; nextShopStock: number } {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(Number(product.stockQty ?? 0))) {
    throw new Error('Enter a valid quantity greater than zero.');
  }
  const storeStock = Number(product.storeStockQty ?? 0);
  const originalShopStock = Number(product.shopStockQty ?? Number(product.stockQty ?? 0) - storeStock);
  if (!Number.isFinite(storeStock) || storeStock < 0 || !Number.isFinite(originalShopStock) || originalShopStock < 0) {
    throw new Error('Existing stock is invalid. Refresh the product before adjusting.');
  }
  if (direction === 'deduct' && quantity > originalShopStock) {
    throw new Error('Insufficient shop stock for this deduction.');
  }
  const nextShopStock = Number((originalShopStock + (direction === 'add' ? quantity : -quantity)).toFixed(3));
  const totalStock = Number((nextShopStock + storeStock).toFixed(3));
  if (!Number.isFinite(totalStock) || nextShopStock < 0) {
    throw new Error('Stock adjustment quantity is invalid.');
  }
  return {
    product: {
      ...product,
      shopStockQty: nextShopStock,
      storeStockQty: storeStock,
      stockQty: totalStock,
    },
    previousShopStock: originalShopStock,
    nextShopStock,
  };
}
