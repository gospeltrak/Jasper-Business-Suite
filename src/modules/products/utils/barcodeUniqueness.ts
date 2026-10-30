import type { Product } from '../../../types';

/** Compare barcode identifiers without changing the stored barcode or its leading zeroes. */
export const normalizeProductBarcode = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

/** A barcode identifies one product inside a tenant; a product may retain its own code when edited. */
export const findProductBarcodeConflict = (
  products: readonly Product[],
  barcode: unknown,
  exceptProductId?: string,
): Product | undefined => {
  const code = normalizeProductBarcode(barcode);
  if (!code) return undefined;
  return products.find(product =>
    product.id !== exceptProductId
    && normalizeProductBarcode(product.barcode || product.sku) === code,
  );
};

/**
 * Checks a new batch as well as the existing catalogue. Existing historical
 * duplicate records are not deleted or silently changed by this validator.
 */
export const findBatchBarcodeConflict = (
  existing: readonly Product[],
  incoming: readonly Product[],
): { barcode: string; product: Product } | null => {
  const seen = new Map<string, Product>();
  for (const product of existing) {
    const code = normalizeProductBarcode(product.barcode || product.sku);
    if (code && !seen.has(code)) seen.set(code, product);
  }
  for (const product of incoming) {
    const code = normalizeProductBarcode(product.barcode || product.sku);
    if (!code) continue;
    const previous = seen.get(code);
    if (previous && previous.id !== product.id) return { barcode: code, product: previous };
    seen.set(code, product);
  }
  return null;
};
