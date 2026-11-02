import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  buildVariationProducts, getPosVariationCards, getProductVariations,
  makeVariationParent, validateVariations,
} from '../src/modules/products/utils/productVariations';
import {
  createProductCatalogueBackup, prepareBackedUpProductsForImport,
} from '../src/modules/products/utils/productCatalogueBackup';
import {
  exportProductsToUniversalRows, classifyUniversalImportRows,
} from '../src/modules/products/utils/bulkProductImport';
import type { Product } from '../src/types';
import { scopeProductsForBranch } from '../src/modules/branches/branchScope';

const base: Product = {
  id: 'domestic', name: 'Domestic', sku: '61500001', barcode: '61500001',
  category: 'Groceries', costPrice: 0, sellingPrice: 0,
  shopStockQty: 0, storeStockQty: 0, stockQty: 0, alertQty: 2,
  sellInRetail: true, sellInWholesale: false,
};
const drafts = [
  { label: 'Fresh Rolls', barcode: '61500002', costPrice: 6000, sellingPrice: 8500, shopStockQty: 30, storeStockQty: 8 },
  { label: 'Classic', barcode: '61500003', costPrice: 5000, sellingPrice: 7000, shopStockQty: 12, storeStockQty: 5 },
];

const make = () => {
  const parent = makeVariationParent(base);
  const variants = buildVariationProducts(parent, drafts, []);
  return { parent, variants };
};

test('variations keep two independent stock rows and a zero-stock grouping parent', () => {
  const { parent, variants } = make();
  assert.equal(parent.shopStockQty, 0);
  assert.equal(parent.isVariationParent, true);
  assert.equal(variants.length, 2);
  assert.notEqual(variants[0].id, variants[1].id);
  assert.equal(variants[0].variationParentId, parent.id);
  assert.equal(variants[0].name, 'Domestic — Fresh Rolls');
  assert.equal(variants[0].shopStockQty, 30);
  assert.equal(variants[1].shopStockQty, 12);
  assert.equal(variants[0].sellingPrice, 8500);
  assert.equal(variants[1].sellingPrice, 7000);
  assert.equal(getProductVariations([parent, ...variants], parent.id).length, 2);
  const cards = getPosVariationCards([parent, ...variants]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].shopStockQty, 42);
  assert.equal(cards[0].sellingPrice, 7000);
});

test('converting a legacy SKU keeps cost/price needed for historic sale profit fallback', () => {
  const old = { ...base, costPrice: 5400, sellingPrice: 8000, stockQty: 0 };
  const grouped = makeVariationParent(old);
  assert.equal(grouped.costPrice, 5400);
  assert.equal(grouped.sellingPrice, 8000);
  assert.equal(grouped.shopStockQty, 0);
});

test('legacy finished FIFO batches stay available for historical audit after conversion', () => {
  const finishedBatch = {
    id: 'old-batch', productId: base.id, batchNumber: 'B-2026',
    purchaseDate: '2026-01-02T00:00:00Z', quantityPurchased: 20,
    quantityRemaining: 0, buyingPrice: 5100, status: 'finished' as const,
    createdBy: 'tester', createdAt: '2026-01-02T00:00:00Z',
  };
  const group = makeVariationParent({
    ...base, shopStockQty: 0, storeStockQty: 0, stockQty: 0, batches: [finishedBatch],
  });
  assert.deepEqual(group.batches, [finishedBatch]);
  assert.equal(group.shopStockQty, 0);
});

test('legacy products without variations remain a normal sellable POS card', () => {
  const legacy = { ...base, id: 'old', stockQty: 7, shopStockQty: 7, sellingPrice: 1200, isVariationParent: undefined };
  assert.deepEqual(getPosVariationCards([legacy]), [legacy]);
});

test('duplicate variation name and barcode cannot enter the tenant catalogue', () => {
  const parent = makeVariationParent(base);
  assert.throws(() => buildVariationProducts(parent, [
    drafts[0], { ...drafts[1], label: ' fresh rolls ' },
  ], []), /Duplicate variation name/);
  assert.match(validateVariations(parent, [drafts[0], { ...drafts[1], barcode: drafts[0].barcode }], []), /already registered/);
  assert.match(validateVariations(parent, drafts, [{ ...base, id: 'other', barcode: drafts[0].barcode }]), /already registered/);
});

test('cross-branch variation stock stays on the selected child and displays its parent', () => {
  const { parent, variants } = make();
  const stock = {
    id: 'branch-stock-fresh', tenantId: 'tenant-1', branchId: 'branch-b',
    productId: variants[0].id, quantity: 6, shopStockQty: 6, storeStockQty: 0,
    createdAt: '2026-11-02T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z',
  };
  const scoped = scopeProductsForBranch(
    [parent, ...variants], [stock],
    { activeScope: 'branch', activeBranchId: 'branch-b', selectedBranch: null },
  );
  assert.equal(scoped.some(p => p.id === parent.id), true);
  assert.equal(scoped.some(p => p.id === variants[0].id && p.shopStockQty === 6), true);
  assert.equal(scoped.some(p => p.id === variants[1].id), false);
  const cards = getPosVariationCards(scoped);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].shopStockQty, 6);
});

test('product catalogue restore remaps child to imported parent, never the source tenant ID', () => {
  const { parent, variants } = make();
  const backup = createProductCatalogueBackup([parent, ...variants], {
    id: 'source', name: 'Source', businessType: 'retail', currency: 'TZS',
  });
  const restored = prepareBackedUpProductsForImport(backup, []);
  assert.equal(restored.length, 3);
  const newParent = restored.find(p => p.isVariationParent)!;
  assert.notEqual(newParent.id, parent.id);
  assert.equal(restored.filter(p => p.variationParentId === newParent.id).length, 2);
  const withoutParent = prepareBackedUpProductsForImport(backup, [{ ...parent, id: 'existing-parent' }]);
  assert.equal(withoutParent.length, 0);
});

test('spreadsheet export and import retain parent and both variation identities', () => {
  const { parent, variants } = make();
  const rows = exportProductsToUniversalRows([parent, ...variants]);
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const restored = classifyUniversalImportRows(csv);
  assert.equal(restored.error, 0, JSON.stringify(restored.results.filter(r => r.status === 'error')));
  assert.equal(restored.readyProducts.filter(p => p.isVariationParent).length, 1);
  const parentImported = restored.readyProducts.find(p => p.isVariationParent)!;
  assert.equal(restored.readyProducts.filter(p => p.variationParentId === parentImported.id).length, 2);
});

test('POS card requires explicit variation and both purchase/report ledgers use child product ID', async () => {
  const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  const purchase = await read('src/modules/purchases/DashboardPurchases.tsx');
  const report = await read('src/modules/reports/DashboardReports.tsx');
  assert.match(pos, /aria-label=\{\`Choose \$\{prod\.name\} variation\`\}/);
  assert.match(pos, /disabled=\{!selectedVariation/);
  assert.match(pos, /addToCart\(selectedVariation\)/);
  assert.match(pos, /if \(prod\.isVariationParent === true\)/);
  assert.match(pos, /variationParentId: i\.product\.variationParentId/);
  assert.match(purchase, /!p\.isVariationParent/);
  assert.match(report, /includedProductIds/);
  assert.match(report, /!p\.isVariationParent/);
});

test('quotation and invoice item picker excludes non-sellable variation parents', async () => {
  const source = await readFile(new URL('../src/modules/sales/DashboardSalesList.tsx', import.meta.url), 'utf8');
  assert.match(source, /const sellableProducts = products\.filter\(product => !product\.isVariationParent\)/);
  assert.match(source, /if \(!canUseCrossBranchDocuments \|\| !crossBranchSources\) return sellableProducts/);
  assert.match(source, /if \(docWizardSourceBranchId === activeBranchId\) return sellableProducts/);
  assert.match(source, /if \(!found \|\| found\.isVariationParent\) return/);
});

test('overview stock warnings only inspect sellable variation stock lines', async () => {
  const source = await readFile(new URL('../src/modules/overview/DashboardOverview.tsx', import.meta.url), 'utf8');
  assert.match(source, /products\.filter\(p => !p\.isVariationParent && \(p\.shopStockQty/);
  assert.match(source, /products\.filter\(p => !p\.isVariationParent && p\.stockQty <= \(p\.alertQty/);
  assert.match(source, /products\.filter\(p => !p\.isVariationParent && p\.stockQty <= 45/);
});

test('editing a parent group cannot change historical legacy sale cost fallback', async () => {
  const source = await readFile(new URL('../src/modules/products/DashboardProducts.tsx', import.meta.url), 'utf8');
  assert.match(source, /const parent = makeVariationParent\(\{[\s\S]*?costPrice: editingProduct\.costPrice,[\s\S]*?sellingPrice: editingProduct\.sellingPrice/);
});
