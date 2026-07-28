import { describe, expect, it } from 'vitest';
import type { BranchStock, Expense, Product, Sale } from '../types';
import {
  mergeScopedProducts,
  recordBelongsToActiveBranch,
  replaceScopedBranchRecords,
  scopeBranchRecords,
  scopeProductsForBranch,
} from './branchScope';

const mainSelection = {
  activeBranchId: 'main',
  activeScope: 'branch' as const,
  selectedBranch: {
    id: 'main',
    includesUnassignedHistoricalRecords: true,
  } as any,
};

const branchBSelection = {
  activeBranchId: 'branch-b',
  activeScope: 'branch' as const,
  selectedBranch: {
    id: 'branch-b',
    includesUnassignedHistoricalRecords: false,
  } as any,
};

describe('branch scope isolation', () => {
  it('keeps legacy unassigned records in Main Branch only', () => {
    const legacy = { id: 'legacy' };
    expect(recordBelongsToActiveBranch(legacy, mainSelection)).toBe(true);
    expect(recordBelongsToActiveBranch(legacy, branchBSelection)).toBe(false);
  });

  it('does not leak Branch A records into Branch B', () => {
    const sales = [
      { id: 'a', branchId: 'branch-a' },
      { id: 'b', branchId: 'branch-b' },
    ] as Sale[];
    expect(scopeBranchRecords(sales, branchBSelection).map(item => item.id)).toEqual(['b']);
  });

  it('scopes expenses and purchases with the same centralized rule', () => {
    const expenses = [
      { id: 'main-expense' },
      { id: 'b-expense', branchId: 'branch-b' },
    ] as Expense[];
    expect(scopeBranchRecords(expenses, mainSelection).map(item => item.id)).toEqual(['main-expense']);
    expect(scopeBranchRecords(expenses, branchBSelection).map(item => item.id)).toEqual(['b-expense']);
  });

  it('uses branch stock values without mutating the shared catalogue', () => {
    const products = [{
      id: 'p1',
      stockQty: 99,
      shopStockQty: 99,
      storeStockQty: 0,
      costPrice: 10,
      sellingPrice: 20,
      alertQty: 2,
    }] as Product[];
    const stocks = [{
      id: 's1',
      tenantId: 'tenant',
      branchId: 'branch-b',
      productId: 'p1',
      quantity: 7,
      shopStockQty: 5,
      storeStockQty: 2,
      createdAt: '',
      updatedAt: '',
    }] as BranchStock[];
    const [scoped] = scopeProductsForBranch(products, stocks, branchBSelection);
    expect(scoped.stockQty).toBe(7);
    expect(scoped.shopStockQty).toBe(5);
    expect(products[0].stockQty).toBe(99);
  });

  it('replaces only the active branch records and preserves every other branch', () => {
    const existing = [
      { id: 'a', branchId: 'branch-a', total: 10 },
      { id: 'b', branchId: 'branch-b', total: 20 },
    ];
    const next = [{ id: 'b', branchId: 'branch-b', total: 25 }];
    expect(replaceScopedBranchRecords(existing, next, branchBSelection)).toEqual([
      existing[0],
      next[0],
    ]);
  });

  it('merges product edits without dropping hidden branch catalogue records', () => {
    const existing = [
      { id: 'a', name: 'A', stockQty: 10 },
      { id: 'b', name: 'B', branchId: 'branch-b', stockQty: 20 },
    ] as Product[];
    const merged = mergeScopedProducts(existing, [{ ...existing[1], stockQty: 25 }]);
    expect(merged.map(product => product.id)).toEqual(['a', 'b']);
    expect(merged[1].stockQty).toBe(25);
  });
});
