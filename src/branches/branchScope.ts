import type { BranchStock, Product } from '../types';
import type { BranchSelectionScope, BranchSummary } from './branchTypes';

export interface ActiveBranchSelection {
  activeBranchId: string | null;
  activeScope: BranchSelectionScope;
  selectedBranch: BranchSummary | null;
}

const recordBranchId = (record: unknown): string | null => {
  if (!record || typeof record !== 'object') return null;
  const value = (record as { branchId?: unknown; branch_id?: unknown }).branchId
    ?? (record as { branch_id?: unknown }).branch_id;
  return typeof value === 'string' && value.trim() ? value : null;
};

export const recordBelongsToActiveBranch = (
  record: unknown,
  selection: ActiveBranchSelection,
): boolean => {
  if (selection.activeScope === 'all_branches') return true;
  if (selection.activeScope === 'no_branch_access') return false;
  const branchId = recordBranchId(record);
  if (selection.activeScope === 'compatibility_primary') return branchId === null;
  if (!selection.activeBranchId) return false;
  if (branchId === selection.activeBranchId) return true;
  return branchId === null && selection.selectedBranch?.includesUnassignedHistoricalRecords === true;
};

export const scopeBranchRecords = <T>(
  records: readonly T[],
  selection: ActiveBranchSelection,
): T[] => records.filter(record => recordBelongsToActiveBranch(record, selection));

export const replaceScopedBranchRecords = <T>(
  existingRecords: readonly T[],
  nextScopedRecords: readonly T[],
  selection: ActiveBranchSelection,
): T[] => {
  if (selection.activeScope === 'all_branches') return [...nextScopedRecords];
  if (selection.activeScope === 'no_branch_access') return [...existingRecords];

  const recordsOutsideActiveBranch = existingRecords.filter(
    record => !recordBelongsToActiveBranch(record, selection),
  );
  return [...recordsOutsideActiveBranch, ...nextScopedRecords];
};

export const mergeScopedProducts = (
  existingProducts: readonly Product[],
  updatedProducts: readonly Product[],
): Product[] => {
  const updatesById = new Map(updatedProducts.map(product => [product.id, product]));
  const merged = existingProducts.map(existing => {
    const updated = updatesById.get(existing.id);
    if (!updated) return existing;
    updatesById.delete(existing.id);
    const existingBranchId = recordBranchId(existing);
    return {
      ...existing,
      ...updated,
      ...(existingBranchId ? { branchId: existingBranchId } : { branchId: undefined }),
    };
  });
  return [...merged, ...updatesById.values()];
};

export const scopeProductsForBranch = (
  products: readonly Product[],
  branchStocks: readonly BranchStock[],
  selection: ActiveBranchSelection,
): Product[] => {
  if (selection.activeScope === 'all_branches') return [...products];
  if (selection.activeScope === 'no_branch_access') return [];
  if (selection.activeScope === 'compatibility_primary') {
    return products.filter(product => recordBranchId(product) === null);
  }
  if (!selection.activeBranchId) return [];

  const selectedStocks = branchStocks.filter(stock => stock.branchId === selection.activeBranchId);
  const stockByProductId = new Map(selectedStocks.map(stock => [stock.productId, stock]));
  const selectedIsPrimary = selection.selectedBranch?.includesUnassignedHistoricalRecords === true;

  return products.flatMap(product => {
    const branchId = recordBranchId(product);
    const stock = stockByProductId.get(product.id);
    if (branchId !== selection.activeBranchId && !stock && !(selectedIsPrimary && branchId === null)) return [];
    if (!stock) return [product];
    return [{
      ...product,
      branchId: selection.activeBranchId,
      stockQty: Number(stock.quantity || 0),
      shopStockQty: Number(stock.shopStockQty || 0),
      storeStockQty: Number(stock.storeStockQty || 0),
      costPrice: stock.buyingPrice ?? product.costPrice,
      sellingPrice: stock.sellingPrice ?? product.sellingPrice,
      alertQty: stock.lowStockAlert ?? product.alertQty,
    }];
  });
};
