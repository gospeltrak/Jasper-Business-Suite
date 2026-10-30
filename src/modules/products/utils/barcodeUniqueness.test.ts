import { describe, expect, it } from 'vitest';
import type { Product } from '../../../types';
import { findBatchBarcodeConflict, findProductBarcodeConflict, normalizeProductBarcode } from './barcodeUniqueness';

const product = (id: string, name: string, barcode: string): Product =>
  ({ id, name, barcode, sku: barcode } as Product);

describe('tenant barcode uniqueness', () => {
  const existing = [product('a', 'Soap', '001234'), product('b', 'Rice', '49992')];

  it('preserves leading zeros and ignores surrounding whitespace', () => {
    expect(normalizeProductBarcode(' 001234 ')).toBe('001234');
    expect(findProductBarcodeConflict(existing, ' 001234 ')?.name).toBe('Soap');
  });

  it('prevents a different product using an existing barcode', () => {
    expect(findProductBarcodeConflict(existing, '001234')?.id).toBe('a');
  });

  it('allows the original product to keep its barcode when edited', () => {
    expect(findProductBarcodeConflict(existing, '001234', 'a')).toBeUndefined();
  });

  it('allows different businesses to use the same barcode when checked separately', () => {
    expect(findProductBarcodeConflict([product('z', 'Different tenant', '88')], '001234')).toBeUndefined();
  });

  it('detects repeated barcodes inside a bulk import', () => {
    const duplicate = findBatchBarcodeConflict(existing, [
      product('c', 'Beans', '871716'),
      product('d', 'Oil', '871716'),
    ]);
    expect(duplicate?.product.id).toBe('c');
  });

  it('checks imported records against existing records and tolerates blanks', () => {
    expect(findBatchBarcodeConflict(existing, [product('c', 'Milk', ' 49992 ')])?.product.name).toBe('Rice');
    expect(findBatchBarcodeConflict(existing, [product('d', 'Unnamed', '')])).toBeNull();
  });

  it('does not delete or change historical duplicates when reading', () => {
    const legacy = [product('a', 'Legacy A', '77'), product('b', 'Legacy B', '77')];
    expect(findProductBarcodeConflict(legacy, '77', 'a')?.id).toBe('b');
    expect(legacy).toHaveLength(2);
  });
});
