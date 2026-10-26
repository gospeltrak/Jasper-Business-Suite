import { describe, expect, it } from 'vitest';
import { prepareManualStockAdjustment } from './manualStockAdjustment';
import type { Product } from '../../../types';

const product = (overrides: Partial<Product> = {}) => ({
  id: 'product-1', name: 'Example', stockQty: 15, shopStockQty: 10, storeStockQty: 5,
  ...overrides,
} as Product);

describe('manual stock adjustment calculation', () => {
  it('deducts exactly two pieces, not on the second try', () => {
    const result = prepareManualStockAdjustment(product(), 'deduct', 2);
    expect(result.previousShopStock).toBe(10);
    expect(result.nextShopStock).toBe(8);
    expect(result.product.stockQty).toBe(13);
    expect(result.product.storeStockQty).toBe(5);
  });
  it('adds two pieces without changing backroom quantity', () => {
    const result = prepareManualStockAdjustment(product(), 'add', 2);
    expect(result.product.shopStockQty).toBe(12);
    expect(result.product.stockQty).toBe(17);
    expect(result.product.storeStockQty).toBe(5);
  });
  it('allows all available stock to be deducted without going negative', () => {
    const result = prepareManualStockAdjustment(product(), 'deduct', 10);
    expect(result.product.shopStockQty).toBe(0);
    expect(result.product.stockQty).toBe(5);
  });
  it('refuses overdrafts instead of silently subtracting fewer pieces', () => {
    expect(() => prepareManualStockAdjustment(product(), 'deduct', 11)).toThrow(/Insufficient shop stock/);
  });
  it('uses stockQty minus storeStockQty if a legacy product has no shop field', () => {
    const result = prepareManualStockAdjustment(product({ shopStockQty: undefined }), 'deduct', 2);
    expect(result.product.shopStockQty).toBe(8);
    expect(result.product.storeStockQty).toBe(5);
    expect(result.product.stockQty).toBe(13);
  });
  it('preserves barcode, batch, branch and product identity metadata', () => {
    const current = product({barcode:'12345', branchId:'branch-1'} as Partial<Product>);
    const result = prepareManualStockAdjustment(current,'deduct',2);
    expect(result.product.id).toBe(current.id);
    expect(result.product.barcode).toBe('12345');
    expect(result.product.branchId).toBe('branch-1');
  });
  it('supports small fractional inventory quantities without drift', () => {
    const result = prepareManualStockAdjustment(product({shopStockQty: 0.75,stockQty: 5.75}), 'deduct', 0.25);
    expect(result.product.shopStockQty).toBe(0.5);
    expect(result.product.stockQty).toBe(5.5);
  });
  it('rejects negative, NaN, zero, infinite and insufficient quantities', () => {
    for (const n of [0,-2,NaN,Infinity]) {
      expect(()=>prepareManualStockAdjustment(product(),'deduct',n)).toThrow();
    }
  });
  it('does not mutate source products', () => {
    const original=product();
    prepareManualStockAdjustment(original,'deduct',2);
    expect(original.shopStockQty).toBe(10);
    expect(original.stockQty).toBe(15);
  });
});
