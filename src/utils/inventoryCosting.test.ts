import { describe, expect, it } from 'vitest';
import { Product, ProductBatch } from '../types';
import {
  createInventoryBatch,
  deductBatchesForSale,
  getActiveBatchesOldestFirst,
} from './inventoryCosting';

const baseProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Amoxicillin 500mg',
  sku: 'SKU-1',
  barcode: '000',
  category: 'Medicine',
  costPrice: 200,
  sellingPrice: 400,
  stockQty: 0,
  shopStockQty: 0,
  storeStockQty: 0,
  alertQty: 0,
  ...overrides,
});

const batch = (overrides: Partial<ProductBatch>): ProductBatch => ({
  id: 'b-1',
  productId: 'p-1',
  batchNumber: 'B-1',
  purchaseDate: '2026-01-01T00:00:00Z',
  quantityPurchased: 100,
  quantityRemaining: 100,
  buyingPrice: 200,
  status: 'active',
  createdBy: 'Admin',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('createInventoryBatch', () => {
  it('stores expiryDate/manufacturingDate when provided', () => {
    const product = baseProduct();
    const result = createInventoryBatch(product, 100, 200, {
      expiryDate: '2027-06-01',
      manufacturingDate: '2026-01-01',
    });
    expect(result.expiryDate).toBe('2027-06-01');
    expect(result.manufacturingDate).toBe('2026-01-01');
  });

  it('leaves expiryDate/manufacturingDate undefined when not provided (existing products unaffected)', () => {
    const product = baseProduct();
    const result = createInventoryBatch(product, 100, 200);
    expect(result.expiryDate).toBeUndefined();
    expect(result.manufacturingDate).toBeUndefined();
  });
});

describe('getActiveBatchesOldestFirst / FEFO ordering', () => {
  it('orders batches with an expiry date earliest-expiry-first', () => {
    const product = baseProduct({
      batches: [
        batch({ id: 'far', createdAt: '2026-01-01T00:00:00Z', expiryDate: '2027-12-01' }),
        batch({ id: 'near', createdAt: '2026-02-01T00:00:00Z', expiryDate: '2026-06-01' }),
      ],
    });
    const ordered = getActiveBatchesOldestFirst(product);
    expect(ordered.map(b => b.id)).toEqual(['near', 'far']);
  });

  it('falls back to oldest-createdAt-first when no batch has an expiry date (unchanged legacy behavior)', () => {
    const product = baseProduct({
      batches: [
        batch({ id: 'newer', createdAt: '2026-02-01T00:00:00Z' }),
        batch({ id: 'older', createdAt: '2026-01-01T00:00:00Z' }),
      ],
    });
    const ordered = getActiveBatchesOldestFirst(product);
    expect(ordered.map(b => b.id)).toEqual(['older', 'newer']);
  });

  it('consumes dated batches before undated ones, regardless of receipt date', () => {
    const product = baseProduct({
      batches: [
        batch({ id: 'undated-but-oldest', createdAt: '2020-01-01T00:00:00Z' }),
        batch({ id: 'dated', createdAt: '2026-01-01T00:00:00Z', expiryDate: '2026-12-01' }),
      ],
    });
    const ordered = getActiveBatchesOldestFirst(product);
    expect(ordered.map(b => b.id)).toEqual(['dated', 'undated-but-oldest']);
  });
});

describe('deductBatchesForSale (FEFO allocation)', () => {
  it('draws from the earliest-expiring batch first even when it was received later', () => {
    const product = baseProduct({
      batches: [
        batch({ id: 'received-first-expires-later', createdAt: '2026-01-01T00:00:00Z', expiryDate: '2027-01-01', buyingPrice: 200, quantityRemaining: 50 }),
        batch({ id: 'received-later-expires-soon', createdAt: '2026-02-01T00:00:00Z', expiryDate: '2026-05-01', buyingPrice: 220, quantityRemaining: 50 }),
      ],
    });
    const result = deductBatchesForSale(product, 20);
    expect(result.batchesUsed).toHaveLength(1);
    expect(result.batchesUsed[0].batchId).toBe('received-later-expires-soon');
    expect(result.unitCost).toBe(220);
  });

  it('spills over into the next-earliest-expiring batch once the first is exhausted', () => {
    const product = baseProduct({
      batches: [
        batch({ id: 'expires-later', createdAt: '2026-01-01T00:00:00Z', expiryDate: '2027-01-01', buyingPrice: 200, quantityRemaining: 100 }),
        batch({ id: 'expires-soon', createdAt: '2026-02-01T00:00:00Z', expiryDate: '2026-05-01', buyingPrice: 220, quantityRemaining: 10 }),
      ],
    });
    const result = deductBatchesForSale(product, 15);
    expect(result.batchesUsed.map(b => b.batchId)).toEqual(['expires-soon', 'expires-later']);
    expect(result.batchesUsed[0].qty).toBe(10);
    expect(result.batchesUsed[1].qty).toBe(5);
  });

  it('keeps existing FIFO-by-receipt behavior for a product with no expiry-tracked batches at all', () => {
    const product = baseProduct({
      name: 'Rice (Retail, no expiry tracking)',
      batches: [
        batch({ id: 'newer', createdAt: '2026-02-01T00:00:00Z', buyingPrice: 2200, quantityRemaining: 100 }),
        batch({ id: 'older', createdAt: '2026-01-01T00:00:00Z', buyingPrice: 2000, quantityRemaining: 100 }),
      ],
    });
    const result = deductBatchesForSale(product, 30);
    expect(result.batchesUsed[0].batchId).toBe('older');
    expect(result.unitCost).toBe(2000);
  });
});
