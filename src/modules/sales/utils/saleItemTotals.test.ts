import { describe, expect, it } from 'vitest';
import type { SaleItem } from '../../../types';
import { getSaleItemGrossTotal, getSaleItemLineTotal, getSaleItemUnitCost } from './saleItemTotals';

const item = (overrides: Partial<SaleItem> = {}): SaleItem => ({
  productId: 'p1', productName: 'Test', qty: 2, price: 250, discount: 0, ...overrides,
});

describe('sale item totals', () => {
  it('prefers the immutable selected-level snapshot', () => {
    const packet = item({ qty: 1, price: 250, selectedLevel: 'packet', selectedLevelQuantity: 1, selectedUnitPrice: 5000, lineTotal: 5000 });
    expect(getSaleItemGrossTotal(packet)).toBe(5000);
    expect(getSaleItemLineTotal(packet)).toBe(5000);
  });

  it('uses persisted discounted line total and supports legacy sales', () => {
    expect(getSaleItemLineTotal(item({ lineTotal: 450 }))).toBe(450);
    expect(getSaleItemLineTotal(item({ discount: 10, discountType: 'percent' }))).toBe(450);
  });
});

describe('getSaleItemUnitCost', () => {
  // Regression coverage for a real bug found live in Reports' Product Audit
  // and Home's profit figure: both applied a product's CURRENT cost price
  // to historical sales, so a cost-price increase since a sale retroactively
  // inflated that sale's cost -- one product showed a large loss instead of
  // a large profit. This must always prefer the sale's own cost snapshot.
  it('prefers costPriceAtSale even when the product current cost differs', () => {
    const sold = item({ costPriceAtSale: 100 });
    expect(getSaleItemUnitCost(sold, { costPrice: 999 })).toBe(100);
  });

  it('falls back to the product current cost for legacy items with no snapshot', () => {
    expect(getSaleItemUnitCost(item(), { costPrice: 150 })).toBe(150);
  });

  it('falls back to a 30%-of-price estimate when the product no longer exists', () => {
    expect(getSaleItemUnitCost(item({ price: 200 }), null)).toBe(140);
  });

  it('treats a zero costPriceAtSale as a real recorded value, not "missing"', () => {
    expect(getSaleItemUnitCost(item({ costPriceAtSale: 0 }), { costPrice: 999 })).toBe(0);
  });
});
