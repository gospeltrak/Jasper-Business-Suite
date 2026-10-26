import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import { findBarcodeProduct, fitsPosShopStock, getBarcodeScanBox, getPosShopStock, posBarcodeMessage } from './barcodeScan';

const item = (overrides: Partial<Product> = {}): Product => ({ id: 'p1', name: 'Registered product', barcode: '0012345678905', sku: 'SKU-A', stockQty: 4, shopStockQty: 4, ...overrides } as Product);

describe('POS barcode recognition and stock', () => {
  it('recognizes a registered product with zero stock and preserves leading zeroes', () => {
    const product = item({ shopStockQty: 0 });
    expect(findBarcodeProduct([product], ' 0012345678905 ')).toBe(product);
    expect(findBarcodeProduct([product], '12345678905')).toBeNull();
    expect(findBarcodeProduct([product], 'missing')).toBeNull();
  });
  it('matches trimmed SKUs without case sensitivity and prioritizes an exact barcode', () => {
    const product = item({ sku: ' SKU-A ' });
    expect(findBarcodeProduct([product], 'sku-a')).toBe(product);
    const collision = item({ id: 'p2', barcode: 'other', sku: product.barcode });
    expect(findBarcodeProduct([collision, product], product.barcode!)).toBe(product);
  });
  it('uses explicit shop stock rather than warehouse stock, with a legacy total fallback', () => {
    expect(getPosShopStock(item({ shopStockQty: 0, stockQty: 20 }))).toBe(0);
    expect(getPosShopStock(item({ shopStockQty: undefined, stockQty: 4 }))).toBe(4);
    expect(getPosShopStock(item({ shopStockQty: NaN }))).toBe(0);
  });
  it('allows four pieces and refuses the fifth, sixth and seventh', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(qty => fitsPosShopStock(item(), qty))).toEqual([true, true, true, true, false, false, false]);
  });
  it('checks the selected stock-unit weight even for the first package', () => {
    expect(fitsPosShopStock(item({ shopStockQty: 3 }), 1, 12)).toBe(false);
    expect(fitsPosShopStock(item({ shopStockQty: 24 }), 2, 12)).toBe(true);
    expect(fitsPosShopStock(item({ shopStockQty: 24 }), 3, 12)).toBe(false);
    expect(fitsPosShopStock(item({ shopStockQty: 0.3 }), 0.1 + 0.2)).toBe(true);
    expect(fitsPosShopStock(item(), NaN)).toBe(false);
    expect(fitsPosShopStock(item(), 1, 0)).toBe(false);
  });
});

describe('scanner geometry and supported languages', () => {
  it.each([[320, 240], [375, 280], [768, 576], [1280, 720]])('enlarges the real scan guide within a %sx%s feed', (width, height) => {
    const box = getBarcodeScanBox(width, height, true);
    expect(box.width).toBeGreaterThan(230);
    expect(box.height).toBeGreaterThan(110);
    expect(box.width).toBeLessThan(width);
    expect(box.height).toBeLessThan(height);
  });
  it('retains the standard product-form guide size', () => {
    expect(getBarcodeScanBox(640, 480)).toEqual({ width: 230, height: 110 });
  });
  it.each(['en', 'sw'] as const)('distinguishes unknown from sold out in %s without changing entered names/codes', language => {
    const name = 'Lim Cleaner 001';
    const stock = posBarcodeMessage('out-of-stock', language, name);
    const missing = posBarcodeMessage('not-found', language, '0012345678905');
    expect(stock).toContain(name);
    expect(missing).toContain('0012345678905');
    expect(stock).not.toBe(missing);
    expect(posBarcodeMessage('added', language, name)).toContain(name);
    expect(stock).toContain(language === 'sw' ? 'Stoki imeisha' : 'Out of stock');
    expect(missing).toContain(language === 'sw' ? 'Bidhaa haipo' : 'Product not found');
  });
});
