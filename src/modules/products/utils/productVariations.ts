import type { Product } from '../../../types';
import { generateUniqueEan13Barcode } from '../barcode';
import { findBatchBarcodeConflict } from './barcodeUniqueness';

/**
 * Variants are first-class product ledger rows, not a JSON array of stock
 * hidden inside a parent. Existing sales/purchase/branch-stock paths already
 * operate by productId; each variation gets its own immutable productId.
 * The zero-stock parent is a catalog grouping, never a sellable line.
 */
export interface VariationDraft {
  id?: string;
  label: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  shopStockQty: number;
  storeStockQty: number;
  wholesalePrice?: number;
}

export const isVariationChild = (product: Product) => Boolean(product.variationParentId);
export const isVariationParent = (product: Product) => product.isVariationParent === true;
export const getProductVariations = (products: readonly Product[], parentId: string): Product[] =>
  products.filter(product => product.variationParentId === parentId);

const money = (value: number): number => Number(Math.max(0, Number(value) || 0).toFixed(2));
const qty = (value: number): number => Number(Math.max(0, Number(value) || 0).toFixed(3));

export const validateVariations = (
  parent: Product,
  drafts: readonly VariationDraft[],
  catalogue: readonly Product[],
  previousVariants: readonly Product[] = [],
): string | null => {
  if (drafts.length < 2 && previousVariants.length === 0) return 'Enter at least two variations.';
  if (drafts.length === 0) return 'Enter at least one variation.';
  const names = new Set<string>();
  const draftProducts = drafts.map((row, index) => {
    const label = row.label.trim();
    if (!label) throw new Error(`Variation ${index + 1} requires a name.`);
    const key = label.toLocaleLowerCase();
    if (names.has(key)) throw new Error(`Duplicate variation name: ${label}`);
    names.add(key);
    if (parent.sellInRetail !== false && (!Number.isFinite(row.sellingPrice) || row.sellingPrice <= 0)) {
      throw new Error(`Set a valid retail price for ${label}.`);
    }
    if (!Number.isFinite(row.costPrice) || row.costPrice < 0
      || !Number.isFinite(row.shopStockQty) || row.shopStockQty < 0
      || !Number.isFinite(row.storeStockQty) || row.storeStockQty < 0) {
      throw new Error(`Stock and cost must be valid non-negative values for ${label}.`);
    }
    return { ...parent, id: row.id || `__draft-${index}`, barcode: row.barcode.trim(), sku: row.barcode.trim() };
  });
  const existingOutside = catalogue.filter(product =>
    product.id !== parent.id && !previousVariants.some(prev => prev.id === product.id));
  const occupied = [...existingOutside, ...draftProducts];
  const collision = findBatchBarcodeConflict([], occupied);
  if (collision) return `Barcode "${collision.barcode}" is already registered to "${collision.product.name}".`;
  return null;
};

export const buildVariationProducts = (
  parent: Product,
  drafts: readonly VariationDraft[],
  catalogue: readonly Product[],
  previousVariants: readonly Product[] = [],
): Product[] => {
  const error = validateVariations(parent, drafts, catalogue, previousVariants);
  if (error) throw new Error(error);
  const existingById = new Map(previousVariants.map(product => [product.id, product]));
  const used = [
    ...catalogue.flatMap(product => [product.barcode, product.sku]),
    parent.barcode, parent.sku,
    ...drafts.map(draft => draft.barcode),
  ];
  return drafts.map(draft => {
    const label = draft.label.trim();
    const existing = draft.id ? existingById.get(draft.id) : undefined;
    const code = draft.barcode.trim() || generateUniqueEan13Barcode(used);
    used.push(code);
    const shop = qty(draft.shopStockQty);
    const store = qty(draft.storeStockQty);
    const cost = money(draft.costPrice);
    const price = money(draft.sellingPrice);
    return {
      ...parent,
      ...(existing || {}),
      id: existing?.id || `pv-${crypto.randomUUID()}`,
      name: `${parent.name} — ${label}`,
      variationLabel: label,
      variationParentId: parent.id,
      isVariationParent: false,
      barcode: code,
      sku: code,
      image: existing?.image || parent.image,
      shopStockQty: shop,
      storeStockQty: store,
      stockQty: qty(shop + store),
      costPrice: cost,
      sellingPrice: price,
      wholesalePrice: parent.sellInWholesale ? money(draft.wholesalePrice ?? parent.wholesalePrice ?? 0) : undefined,
      // Existing batch history on an unchanged child is retained. A parent
      // with existing batches cannot safely be converted automatically.
      batches: existing?.batches,
      latestBuyingPrice: existing?.latestBuyingPrice ?? cost,
      averageBuyingCost: existing?.averageBuyingCost ?? cost,
      packageUnitPrice: price,
      sellUnitPrice: price,
      defaultPricePerBaseUnit: price,
      inventorySettings: {
        ...parent.inventorySettings,
        ...existing?.inventorySettings,
        packageUnitPrice: price,
        defaultPricePerBaseUnit: price,
      },
    };
  });
};

export const makeVariationParent = (parent: Product): Product => ({
  ...parent,
  isVariationParent: true,
  variationParentId: undefined,
  variationLabel: undefined,
  // These quantities belong solely to child product rows. Never count the
  // parent or expose it as a sellable stock line.
  stockQty: 0,
  shopStockQty: 0,
  storeStockQty: 0,
  costPrice: 0,
  sellingPrice: 0,
  wholesalePrice: undefined,
  batches: [],
});

export const buildVariationCard = (parent: Product, variants: readonly Product[]): Product => {
  const stock = variants.reduce((sum, product) => sum + qty(product.stockQty), 0);
  const shop = variants.reduce((sum, product) => sum + qty(product.shopStockQty), 0);
  const store = variants.reduce((sum, product) => sum + qty(product.storeStockQty), 0);
  return {
    ...parent,
    stockQty: qty(stock),
    shopStockQty: qty(shop),
    storeStockQty: qty(store),
    sellingPrice: Math.min(...variants.map(v => v.sellingPrice).filter(p => p > 0), 0) || variants.find(v => v.sellingPrice > 0)?.sellingPrice || 0,
  };
};

/** Keep one card for each parent. Children stay in the product ledger. */
export const getPosVariationCards = (products: readonly Product[]): Product[] =>
  products.filter(p => !isVariationChild(p))
    .map(parent => isVariationParent(parent)
      ? buildVariationCard(parent, getProductVariations(products, parent.id))
      : parent);
