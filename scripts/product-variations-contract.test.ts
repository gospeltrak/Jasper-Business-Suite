import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  buildVariationProducts, getPosVariationCards, getProductVariations,
  makeVariationParent, validateVariations, getWholesaleQuantityViolation,
} from '../src/modules/products/utils/productVariations';
import {
  createProductCatalogueBackup, prepareBackedUpProductsForImport,
} from '../src/modules/products/utils/productCatalogueBackup';
import {
  exportProductsToUniversalRows, classifyUniversalImportRows,
} from '../src/modules/products/utils/bulkProductImport';
import type { Product, Sale } from '../src/types';
import { reverseSaleInventory } from '../src/modules/sales/utils/saleSync';
import { scopeProductsForBranch } from '../src/modules/branches/branchScope';
import { findBarcodeProduct, fitsPosShopStock, getPosShopStock } from '../src/shared/utils/barcodeScan';
import { getSaleItemLineTotal, getSaleItemUnitCost } from '../src/modules/sales/utils/saleItemTotals';

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


test('variation shop/store transfers wait for a durable scoped stock save', async () => {
  const source = await readFile(new URL('../src/modules/products/DashboardProducts.tsx', import.meta.url), 'utf8');
  const transferCode = source.slice(
    source.indexOf('const handleExecuteTransfer = async () =>'),
    source.indexOf('// 3. GOOGLE FORM TEMPLATE SHEET'),
  );
  assert.match(transferCode, /if \(!transferProduct \|\| transferSubmitting\) return/);
  assert.match(transferCode, /if \(isVariationParent\(transferProduct\)\)/);
  assert.match(transferCode, /const saved = await onUpdateProducts\(updatedProducts, \[transferProduct\.id\]\)/);
  assert.match(transferCode, /if \(!saved\) \{[\s\S]*?setTransferError/);
  assert.doesNotMatch(transferCode, /\bonUpdateProducts\(updatedProducts\);/);
  assert.match(transferCode, /finally \{\s*setTransferSubmitting\(false\)/);
});


test('returning a sale restores only that variation, never sibling or grouping stock', () => {
  const { parent, variants } = make();
  const sale: Sale = {
    id: 'sale-a', tenantId: 'tenant-1', timestamp: '2026-11-02T12:00:00Z',
    reference: 'SALE-001', syncStatus: 'synced', cashierName: 'QA',
    paymentMethod: 'Cash', tax: 0, total: 25500,
    items: [{
      productId: variants[0].id, productName: variants[0].name,
      variationParentId: parent.id, variationLabel: variants[0].variationLabel,
      qty: 3, baseQuantityDeducted: 3, discount: 0, price: 8500,
    }],
  };
  // Sale already deducted 3 fresh-roll items. Its reversal must not touch
  // Classic or the grouping parent, which has no sellable stock.
  const sold = [
    parent,
    { ...variants[0], shopStockQty: 27, stockQty: 35 },
    variants[1],
  ];
  const returned = reverseSaleInventory(sale, sold, '2026-11-02T12:05:00Z');
  assert.equal(returned.find(p => p.id === parent.id)?.stockQty, 0);
  assert.equal(returned.find(p => p.id === variants[0].id)?.shopStockQty, 30);
  assert.equal(returned.find(p => p.id === variants[0].id)?.stockQty, 38);
  assert.equal(returned.find(p => p.id === variants[1].id)?.shopStockQty, 12);
  assert.equal(returned.find(p => p.id === variants[1].id)?.stockQty, 17);
});


test('variation replenishment confirms the database save and never removes a child ledger', async () => {
  const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const productsSource = await read('src/modules/products/DashboardProducts.tsx');
  const dashboardSource = await read('src/components/Dashboard.tsx');
  const replenishCode = productsSource.slice(
    productsSource.indexOf('const handleReplenishSubmit = async'),
    productsSource.indexOf('const adjustSearchProducts ='),
  );
  assert.match(replenishCode, /if \(replenishInFlightRef\.current/);
  assert.match(replenishCode, /isVariationParent\(replenishProduct\)/);
  assert.match(replenishCode, /const saved = await onUpdateProducts\(/);
  assert.match(replenishCode, /\[replenishProduct\.id\]/);
  assert.match(replenishCode, /if \(!saved\) \{[\s\S]*?setReplenishSaveError/);
  assert.match(productsSource, /disabled=\{isSavingReplenish \|\| !replenishCost \|\| !replenishQty\}/);
  assert.match(dashboardSource, /if \(product\.variationParentId\) \{[\s\S]*?SKU must be preserved for audit/);
});

test('creating variation SKUs writes only newly-created rows to the normalized product RPC', async () => {
  const source = await readFile(new URL('../src/components/Dashboard.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const handleCreateProducts = (newProducts: Product[]) =>');
  const end = source.indexOf('const handleCreateProduct = (newProd: Product) =>', start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /persistTenantProductsNow\(\s*updatedProducts, undefined, branchScopedProducts\.map\(product => product\.id\)/);
  assert.doesNotMatch(handler, /persistTenantProductsNow\(updatedProducts\)/);
});

test('product registration blocks a second submit while the first SKU bundle is saving', async () => {
  const source = await readFile(new URL('../src/modules/products/DashboardProducts.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const handleCreateProduct = async (e: FormEvent) =>');
  const end = source.indexOf('// Stock Transfer Actions', start);
  assert.ok(start >= 0 && end > start);
  const create = source.slice(start, end);
  assert.match(create, /if \(productCreationInFlightRef\.current\) return/);
  assert.match(create, /productCreationInFlightRef\.current = true/);
  assert.match(create, /finally \{[\s\S]*?productCreationInFlightRef\.current = false/);
  assert.match(source, /disabled=\{formSuccess \|\| isProcessingImage \|\| isCreatingProduct\}/);
});

test('barcode scanning resolves the exact variation SKU and never substitutes warehouse stock', () => {
  const { parent, variants } = make();
  const catalogue = [parent, ...variants];
  assert.equal(findBarcodeProduct(catalogue, variants[1].barcode)?.id, variants[1].id);
  assert.equal(findBarcodeProduct(catalogue, variants[0].sku.toLowerCase())?.id, variants[0].id);
  assert.equal(findBarcodeProduct(catalogue, parent.barcode)?.isVariationParent, true);
  assert.equal(findBarcodeProduct(catalogue, 'unregistered'), null);

  // A child with zero shop stock cannot be scanned into a POS sale even if
  // the same SKU has units in the warehouse or another branch.
  const backroomOnly = { ...variants[1], shopStockQty: 0, storeStockQty: 25, stockQty: 25 };
  assert.equal(getPosShopStock(backroomOnly), 0);
  assert.equal(fitsPosShopStock(backroomOnly, 1), false);
  assert.equal(fitsPosShopStock(variants[0], 3), true);
  assert.equal(fitsPosShopStock({ ...variants[0], shopStockQty: 2 }, 3), false);
});

test('invoice and receipt totals use the selected variation price and immutable sale-time cost', () => {
  const { parent, variants } = make();
  const soldChild = variants[1];
  const snapshot = {
    productId: soldChild.id,
    productName: soldChild.name,
    variationParentId: parent.id,
    variationLabel: soldChild.variationLabel,
    qty: 2,
    price: soldChild.sellingPrice,
    costPriceAtSale: soldChild.costPrice,
    discount: 0,
    discountType: 'percent' as const,
  };
  assert.equal(getSaleItemLineTotal(snapshot), 14000);
  assert.equal(getSaleItemUnitCost(snapshot, { costPrice: 99999 }), 5000);
  // Editing the parent or the child later must not change a historical sale.
  assert.equal(getSaleItemLineTotal(snapshot), 14000);
  assert.equal(getSaleItemUnitCost(snapshot, { costPrice: 100 }), 5000);
});

test('each variation has independent Retail/Wholesale flags, buying/selling prices and min/max limits', () => {
  const parent = makeVariationParent({ ...base, variationOptionName: 'Size / Volume', sellInWholesale: true });
  const variants = buildVariationProducts(parent, [
    { ...drafts[0], label: '350ml', sellInRetail: true, sellInWholesale: true, wholesalePrice: 7500, minWholesaleQty: 6, maxWholesaleQty: 18 },
    { ...drafts[1], label: '1 Litre', sellInRetail: false, sellInWholesale: true, wholesalePrice: 6300, minWholesaleQty: 4 },
  ], []);
  assert.equal(variants[0].variationOptionName, 'Size / Volume');
  assert.equal(variants[0].costPrice, 6000);
  assert.equal(variants[0].sellingPrice, 8500);
  assert.equal(variants[0].wholesalePrice, 7500);
  assert.equal(variants[0].minWholesaleQty, 6);
  assert.equal(variants[0].maxWholesaleQty, 18);
  assert.equal(variants[1].sellInRetail, false);
  assert.equal(variants[1].sellInWholesale, true);
  assert.equal(variants[1].maxWholesaleQty, undefined);
  assert.match(getWholesaleQuantityViolation(variants[0], 5) || '', /minimum/);
  assert.equal(getWholesaleQuantityViolation(variants[0], 6), null);
  assert.equal(getWholesaleQuantityViolation(variants[0], 18), null);
  assert.match(getWholesaleQuantityViolation(variants[0], 19) || '', /maximum/);
  assert.equal(getWholesaleQuantityViolation(variants[1], 100), null);
  // Existing non-variation wholesale catalog remains backward-compatible.
  assert.equal(getWholesaleQuantityViolation({ ...base, sellInWholesale: true, minWholesaleQty: 10 }, 1), null);
});

test('invalid variation wholesale bounds and disabled channels fail before creating stock rows', () => {
  const parent = makeVariationParent(base);
  const onlyWholesale = { ...drafts[0], sellInRetail: false, sellInWholesale: true, wholesalePrice: 7000, minWholesaleQty: 6, maxWholesaleQty: 5 };
  assert.throws(() => buildVariationProducts(parent, [onlyWholesale, drafts[1]], []), /Maximum wholesale quantity/);
  assert.throws(() => buildVariationProducts(parent, [{ ...drafts[0], sellInRetail: false, sellInWholesale: false }, drafts[1]], []), /Enable Retail or Wholesale/);
  assert.throws(() => buildVariationProducts(parent, [{ ...onlyWholesale, maxWholesaleQty: 8, minWholesaleQty: 0 }, drafts[1]], []), /Minimum wholesale quantity/);
});

test('variation editor is inside the product descriptor flow and preserves native PWA tap controls', async () => {
  const source = await readFile(new URL('../src/modules/products/DashboardProducts.tsx', import.meta.url), 'utf8');
  const editor = await readFile(new URL('../src/modules/products/ProductVariationEditor.tsx', import.meta.url), 'utf8');
  const descriptorStart = source.indexOf('1. Descriptor & Visual Assets');
  const imageStart = source.indexOf('Product Image', descriptorStart);
  const variationStart = source.indexOf('<ProductVariationEditor', imageStart);
  const barcodeStart = source.indexOf('2. Barcode Controls & Stock', variationStart);
  assert.ok(descriptorStart >= 0 && imageStart > descriptorStart && variationStart > imageStart && barcodeStart > variationStart);
  assert.match(editor, /Size \/ Volume.*Flavor.*Color.*Material.*Formula.*Custom/);
  assert.match(editor, /min-h-10/);
  assert.match(editor, /sm:grid-cols-3 lg:grid-cols-6/);
});
