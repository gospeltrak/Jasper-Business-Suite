import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProductCatalogueBackup,
  getProductCatalogueBackupFileName,
  parseProductCatalogueBackup,
  prepareBackedUpProductsForImport,
} from '../src/utils/productCatalogueBackup';
import type { Product } from '../src/types';

const product: Product = {
  id: 'old-product', name: 'Protected Pharmacy Item', sku: '620001', barcode: '620001',
  category: 'Medicine', costPrice: 100, sellingPrice: 150, stockQty: 12,
  shopStockQty: 5, storeStockQty: 7, alertQty: 2, pharmacyProductType: 'pharmaceutical',
  batches: [{ id: 'old-batch', productId: 'old-product', batchNumber: 'B1', purchaseDate: '2026-08-01', quantityPurchased: 12, quantityRemaining: 12, buyingPrice: 100, status: 'active', createdBy: 'contract-test', createdAt: '2026-08-01T00:00:00.000Z' }],
};

test('catalogue backup round-trips full product data and uses a safe filename', () => {
  const backup = createProductCatalogueBackup([product], { id: 'tenant-old', name: 'Tunde Inv.', businessType: 'pharmacy', currency: 'TZS' }, '2026-08-12T10:00:00.000Z');
  const restored = parseProductCatalogueBackup(JSON.stringify(backup));
  assert.equal(restored.products[0].pharmacyProductType, 'pharmaceutical');
  assert.equal(restored.products[0].batches?.[0].batchNumber, 'B1');
  assert.equal(getProductCatalogueBackupFileName('Tunde Inv.', backup.exportedAt), 'orvix-product-catalogue-tunde-inv-2026-08-12.json');
});

test('restore creates new account-safe ids and skips matching barcodes', () => {
  const backup = createProductCatalogueBackup([product], { id: 'tenant-old', name: 'Tunde Inv', businessType: 'pharmacy', currency: 'TZS' });
  const imported = prepareBackedUpProductsForImport(backup, []);
  assert.equal(imported.length, 1);
  assert.notEqual(imported[0].id, product.id);
  assert.equal(imported[0].batches?.[0].productId, imported[0].id);
  assert.equal(prepareBackedUpProductsForImport(backup, [{ ...product, id: 'existing' }]).length, 0);
});

test('invalid JSON is rejected instead of importing arbitrary data', () => {
  assert.throws(() => parseProductCatalogueBackup('{"products":[]}'));
});
