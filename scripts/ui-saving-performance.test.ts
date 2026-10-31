import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(path, 'utf8');

test('POS confirmation is React-controlled and safe from DOM translation mutation', async () => {
  const pos = await read('src/modules/pos/DashboardPOS.tsx');
  assert.match(pos, /className="pos-checkout-confirm"\s+translate="no"/);
  assert.match(pos, /aria-busy=\{isProcessingPayment\}/);
  assert.match(pos, /key="pos-processing"/);
  assert.match(pos, /key="pos-confirm"/);
  assert.match(pos, /t\('Processing\.\.\.'\)/);
  assert.match(pos, /t\('Confirm Payment'\)/);
  assert.match(pos, /paymentSubmitInFlightRef\.current = true/);
  assert.match(pos, /if \(paymentSubmitInFlightRef\.current\) return/);
  assert.match(pos, /window\.requestAnimationFrame/);
  assert.match(pos, /window\.clearTimeout\(slowNotice\)/);
  assert.match(pos, /Still confirming this sale/);
});

test('product editing footer has two safe action slots on mobile and tablet', async () => {
  const products = await read('src/modules/products/DashboardProducts.tsx');
  const css = await read('src/index.css');
  assert.match(products, /tenant-form-footer orvix-product-edit-footer/);
  assert.doesNotMatch(products, /tenant-form-footer sticky bottom-0 z-10/);
  assert.match(products, /translate="no"\\s+className="orvix-product-edit-action/);
  assert.match(products, /key="product-edit-saving"/);
  assert.match(products, /key="product-edit-save"/);
  assert.match(products, /t\('Saving…'\)/);
  assert.match(products, /t\('Save Changes'\)/);
  assert.match(products, /productEditInFlightRef\.current = true/);
  assert.match(products, /window\.clearTimeout\(slowNotice\)/);
  assert.match(css, /#dashboard-scaffold \.tenant-form-footer\.orvix-product-edit-footer \{/);
  assert.match(css, /position: relative !important/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(css, /min-height: 46px/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test('workspace history merge maintains a single Map per collection regardless of page count', async () => {
  const workspace = await read('src/shared/utils/tenantWorkspace.ts');
  assert.match(workspace, /recordMaps: Record<PaginatedWorkspaceCollection, Map<string, any>>/);
  assert.match(workspace, /mergePageRecords\(recordMaps\[collection\], page\.records\)/);
  assert.match(workspace, /sales: Array\.from\(recordMaps\.sales\.values\(\)\)/);
  assert.doesNotMatch(workspace, /records\[collection\] = mergePageRecords\(records\[collection\]/);
});
