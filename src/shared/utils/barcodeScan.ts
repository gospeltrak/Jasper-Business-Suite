import type { Product } from '../../types';
import type { LanguageType } from '../contexts/LanguageContext';

export type PosBarcodeOutcome = 'added' | 'out-of-stock' | 'not-found' | 'channel-blocked';

/** Recognize registered products even when their shop stock is zero. */
export function findBarcodeProduct(products: readonly Product[], raw: string): Product | null {
  const code = raw.trim();
  if (!code) return null;
  return products.find(product => String(product.barcode || '').trim() === code)
    || products.find(product => String(product.sku || '').trim().toUpperCase() === code.toUpperCase())
    || null;
}

/** Explicit zero shop stock must never fall through to warehouse/total stock. */
export function getPosShopStock(product: Pick<Product, 'shopStockQty' | 'stockQty'>): number {
  const stock = Number(product.shopStockQty ?? product.stockQty ?? 0);
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

export function fitsPosShopStock(product: Pick<Product, 'shopStockQty' | 'stockQty'>, quantity: number, unitsPerQuantity = 1): boolean {
  return Number.isFinite(quantity) && quantity > 0
    && Number.isFinite(unitsPerQuantity) && unitsPerQuantity > 0
    && quantity * unitsPerQuantity <= getPosShopStock(product) + 1e-8;
}

const MESSAGES: Record<LanguageType, Record<PosBarcodeOutcome, (value: string) => string>> = {
  en: {
    added: value => `${value} added`,
    'out-of-stock': value => `Out of stock — ${value}`,
    'not-found': value => `Product not found — ${value}`,
    'channel-blocked': value => `${value} cannot be sold in this sales channel.`,
  },
  sw: {
    added: value => `${value} imeongezwa`,
    'out-of-stock': value => `Stoki imeisha — ${value}`,
    'not-found': value => `Bidhaa haipo — ${value}`,
    'channel-blocked': value => `${value} haiwezi kuuzwa kwa aina hii ya mauzo.`,
  },
};

export const posBarcodeMessage = (outcome: PosBarcodeOutcome, language: LanguageType, value: string): string =>
  MESSAGES[language][outcome](value);

/** Expand the library's real decoding/shaded guide, bounded by the live feed. */
export function getBarcodeScanBox(width: number, height: number, expanded = false): { width: number; height: number } {
  return {
    width: Math.max(1, Math.min(expanded ? 420 : 230, Math.floor(width * (expanded ? 0.92 : 0.85)))),
    height: Math.max(1, Math.min(expanded ? 220 : 110, Math.floor(height * (expanded ? 0.74 : 0.7)))),
  };
}
