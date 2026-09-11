import { describe, expect, it } from 'vitest';
import type { SaleItem } from '../types';
import { getSaleItemGrossTotal, getSaleItemLineTotal } from './saleItemTotals';

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
