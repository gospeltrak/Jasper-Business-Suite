import type { Product } from '../../../types';

export const PRODUCT_CATALOGUE_BACKUP_VERSION = 1;

export interface ProductCatalogueBackup {
  format: 'orvix-product-catalogue';
  version: number;
  exportedAt: string;
  source: { tenantName: string; tenantId: string; businessType: string; currency: string };
  productCount: number;
  products: Product[];
}

const safeFilePart = (value: string) => value.trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tenant';

export const createProductCatalogueBackup = (
  products: Product[],
  tenant: { id: string; name: string; businessType: string; currency: string },
  exportedAt = new Date().toISOString(),
): ProductCatalogueBackup => ({
  format: 'orvix-product-catalogue', version: PRODUCT_CATALOGUE_BACKUP_VERSION, exportedAt,
  source: { tenantName: tenant.name, tenantId: tenant.id, businessType: tenant.businessType, currency: tenant.currency },
  productCount: products.length,
  products,
});

export const getProductCatalogueBackupFileName = (tenantName: string, exportedAt: string) =>
  `orvix-product-catalogue-${safeFilePart(tenantName)}-${exportedAt.slice(0, 10)}.json`;

export const parseProductCatalogueBackup = (text: string): ProductCatalogueBackup => {
  const parsed = JSON.parse(text) as Partial<ProductCatalogueBackup>;
  if (parsed?.format !== 'orvix-product-catalogue' || parsed.version !== PRODUCT_CATALOGUE_BACKUP_VERSION ||
      !Array.isArray(parsed.products) || parsed.products.some(product => !product || typeof product !== 'object' || !String(product.name || '').trim())) {
    throw new Error('This is not a supported Orvix product catalogue backup.');
  }
  return parsed as ProductCatalogueBackup;
};

export const prepareBackedUpProductsForImport = (backup: ProductCatalogueBackup, existingProducts: Product[]): Product[] => {
  const existingKeys = new Set(existingProducts.flatMap(product => [product.barcode, product.sku])
    .map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
  const timestamp = Date.now().toString(36);
  const selected = backup.products.filter(product => {
    const keys = [product.barcode, product.sku].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
    return keys.length === 0 || !keys.some(key => existingKeys.has(key));
  });
  // A restored variant must point to its newly imported parent, never the
  // old tenant's parent ID. If its parent collided/skipped, skip that child
  // rather than orphaning an invisible, unsellable stock record.
  const acceptedIds = new Set(selected.map(product => product.id));
  const safeProducts = selected.filter(product =>
    !product.variationParentId || acceptedIds.has(product.variationParentId));
  const idMap = new Map(safeProducts.map((product, index) => [
    product.id,
    `p-${timestamp}-${index.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  ]));
  return safeProducts.map((product, index) => {
    const newId = idMap.get(product.id)!;
    return {
      ...product, id: newId,
      variationParentId: product.variationParentId ? idMap.get(product.variationParentId) : undefined,
      branchId: undefined, syncUpdatedAt: undefined, updatedAt: undefined,
      batches: product.batches?.map((batch, batchIndex) => ({
        ...batch, id: `batch-${timestamp}-${index.toString(36)}-${batchIndex.toString(36)}`, productId: newId,
      })),
    };
  });
};
