import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { isTenantPackageTabAllowed } from '../src/utils/subscription';
import {
  attachPayloadSaleTombstones,
  extractPayloadSaleTombstones,
  mergeSalesForSync,
  reverseSaleInventory,
} from '../src/utils/saleSync';
import { protectTenantPayload } from '../src/utils/dataSafety';
import type { Product, Sale } from '../src/types';

const projectRoot = resolve(import.meta.dirname, '..');
const read = (path: string) => readFile(join(projectRoot, path), 'utf8');

test('tenant package navigation contract remains centralized and correct', () => {
  assert.equal(isTenantPackageTabAllowed('ruby', 'deliveries'), false);
  assert.equal(isTenantPackageTabAllowed('ruby', 'forecasting'), false);
  assert.equal(isTenantPackageTabAllowed('diamond', 'deliveries'), true);
  assert.equal(isTenantPackageTabAllowed('diamond', 'forecasting'), false);
  assert.equal(isTenantPackageTabAllowed('tanzanite', 'forecasting'), true);
  assert.equal(isTenantPackageTabAllowed('tanzanite', 'whitelabel'), true);
});

test('login always returns to the canonical Jasper landing hub', async () => {
  const appSource = await read('src/App.tsx');
  const loginSource = await read('src/components/LoginPage.tsx');
  assert.match(appSource, /JASPER_PUBLIC_LANDING_URL\s*=\s*['"]https:\/\/jasper-business-suite\.vercel\.app\/['"]/);
  assert.match(appSource, /JASPER_PUBLIC_LANDING_HOST\s*=\s*new URL\(JASPER_PUBLIC_LANDING_URL\)\.hostname/);
  assert.match(appSource, /const publicLandingUrl = JASPER_PUBLIC_LANDING_URL/);
  assert.match(appSource, /window\.location\.hostname === JASPER_PUBLIC_LANDING_HOST/);
  assert.match(loginSource, /targetUrl\.origin !== window\.location\.origin/);
  assert.match(loginSource, /window\.location\.assign\(targetUrl\.toString\(\)\)/);
  assert.match(loginSource, /onNavigate\(targetUrl\.pathname \|\| '\/'\)/);
  assert.doesNotMatch(appSource, /publicLandingUrl\s*=\s*tenantDomainContext\.baseDomain/);
});

test('subscription checkout uses the native plan summary without inline mobile-money fields', async () => {
  const dashboardSource = await read('src/components/Dashboard.tsx');
  const serverSource = await read('server.ts');
  assert.match(dashboardSource, /Choose the plan that fits your business/);
  assert.match(dashboardSource, /Order summary/);
  assert.match(dashboardSource, /Secure payment\. Access activates after payment confirmation\./);
  assert.match(dashboardSource, /Need help\? Contact deployments/);
  assert.doesNotMatch(dashboardSource, /Secure mobile-money checkout/);
  assert.doesNotMatch(dashboardSource, /subscriptionPaymentProvider/);
  assert.doesNotMatch(dashboardSource, /subscriptionPaymentPhone/);
  assert.doesNotMatch(serverSource, /Choose a supported mobile-money provider/);
  assert.doesNotMatch(serverSource, /Enter a valid mobile-money phone number/);
});

test('critical sale actions remain wired to visible controls', async () => {
  const salesSource = await read('src/components/DashboardSalesList.tsx');
  const dashboardSource = await read('src/components/Dashboard.tsx');
  for (const action of [
    'Payment In',
    'Payments Log',
    'View Sale',
    'Edit Sale',
    'POS Receipt',
    'A4 Invoice',
    'Send via WhatsApp',
    'Delete Sale',
    'Record as Sale',
  ]) {
    assert.match(salesSource, new RegExp(action), `Missing sale action: ${action}`);
  }
  assert.match(salesSource, /setSaleToDelete\(sale\)/);
  assert.match(salesSource, /setEditingSale\(sale\)/);
  assert.match(salesSource, /setViewPaymentsOpen\(true\)/);
  assert.doesNotMatch(salesSource, />\s*Thermal Receipt\s*</);
  assert.match(dashboardSource, /saveData\(activeTenant\.id,\s*'sales_map'/);
});

test('header uses active business profile and has no decorative workspace search box', async () => {
  const dashboardSource = await read('src/components/Dashboard.tsx');
  const branchContextSource = await read('src/branches/BranchContext.tsx');
  assert.match(dashboardSource, /const businessDisplayName = activeBranchBusinessName \|\| activeProfileBusinessName \|\| 'My Business'/);
  assert.match(dashboardSource, /setDatabaseBusinessName\(String\(syncedSettings\.business\?\.businessName/);
  assert.match(dashboardSource, /loadBranchWorkspace\(\)/);
  assert.match(branchContextSource, /jasper_branch_context_changed/);
  assert.doesNotMatch(dashboardSource, /placeholder="Search workspace\.\.\."/);
  assert.doesNotMatch(dashboardSource, /const businessDisplayName[\s\S]{0,240}activeTenant\.name/);
});

test('sale tombstones prevent stale database records from reappearing', () => {
  const deletedAt = '2026-07-27T10:00:00.000Z';
  const staleSale = {
    id: 'sale-1',
    tenantId: 'tenant-a',
    timestamp: '2026-07-26T10:00:00.000Z',
    syncUpdatedAt: '2026-07-26T10:00:00.000Z',
    items: [],
    total: 100,
    tax: 0,
    paymentMethod: 'Cash',
    reference: 'A-1',
    syncStatus: 'synced',
    cashierName: 'Cashier',
  } as Sale;
  const payload = attachPayloadSaleTombstones(
    { 'tenant-a': [] as Sale[] },
    'tenant-a',
    { 'sale-1': deletedAt },
  );
  assert.deepEqual(extractPayloadSaleTombstones(payload, 'tenant-a'), { 'sale-1': deletedAt });
  assert.deepEqual(mergeSalesForSync([], [staleSale], { 'sale-1': deletedAt }), []);

  const protectedResult = protectTenantPayload(
    'tenant-a',
    'sales_map',
    payload,
    { 'tenant-a': [staleSale] },
  );
  assert.deepEqual((protectedResult.payload as any)['tenant-a'], []);
  assert.equal(protectedResult.blockedEmptyOverwrite, false);
});

test('sale deletion inventory reversal restores exact base and batch quantities', () => {
  const product = {
    id: 'product-1',
    name: 'Measured product',
    sku: 'SKU-1',
    barcode: '1001',
    category: 'General',
    costPrice: 10,
    sellingPrice: 20,
    stockQty: 8,
    shopStockQty: 5,
    storeStockQty: 3,
    alertQty: 1,
    batches: [{
      id: 'batch-1',
      productId: 'product-1',
      batchNumber: 'B-1',
      purchaseDate: '2026-07-01',
      quantityPurchased: 10,
      quantityRemaining: 1,
      quantityPurchasedBase: 10,
      quantityRemainingBase: 1,
      buyingPrice: 10,
      status: 'active',
      createdBy: 'user-1',
      createdAt: '2026-07-01T00:00:00.000Z',
    }],
  } as Product;
  const sale = {
    id: 'sale-1',
    tenantId: 'tenant-a',
    timestamp: '2026-07-27T09:00:00.000Z',
    items: [{
      productId: 'product-1',
      productName: 'Measured product',
      qty: 1,
      price: 20,
      discount: 0,
      baseQuantityDeducted: 2.5,
      batchesUsed: [{
        batchId: 'batch-1',
        batchNumber: 'B-1',
        qty: 2.5,
        baseQty: 2.5,
        buyingPrice: 10,
      }],
    }],
    total: 20,
    tax: 0,
    paymentMethod: 'Cash',
    reference: 'A-1',
    syncStatus: 'synced',
    cashierName: 'Cashier',
  } as Sale;

  const [restored] = reverseSaleInventory(sale, [product], '2026-07-27T10:00:00.000Z');
  assert.equal(restored.shopStockQty, 7.5);
  assert.equal(restored.stockQty, 10.5);
  assert.equal(restored.batches?.[0].quantityRemaining, 3.5);
  assert.equal(restored.batches?.[0].quantityRemainingBase, 3.5);
});

test('sale deletion remains tenant-scoped and updates canonical related data', async () => {
  const dashboardSource = await read('src/components/Dashboard.tsx');
  const salesSource = await read('src/components/DashboardSalesList.tsx');
  assert.match(dashboardSource, /sale\.tenantId !== activeTenant\.id/);
  assert.match(dashboardSource, /markLocalSaleTombstone\(tenantId,\s*sale\.id/);
  assert.match(dashboardSource, /reverseSaleInventory\(persistedSale,\s*currentProducts/);
  assert.match(dashboardSource, /filter\(delivery => delivery\.saleId !== sale\.id\)/);
  assert.match(dashboardSource, /saleTombstones:\s*nextSaleTombstones/);
  assert.match(salesSource, /await onDeleteSale\(saleToDelete\)/);
});

test('expense deletion requires an inspectable in-app confirmation', async () => {
  const expenseSource = await read('src/components/DashboardExpenses.tsx');
  assert.doesNotMatch(expenseSource, /window\.confirm\(['"]Delete this expense/);
  assert.match(expenseSource, /Delete expense record\?/);
  assert.match(expenseSource, /Keep Expense/);
  assert.match(expenseSource, /Confirm Delete Expense/);
});

test('product action menus cannot delete catalogue records in one click', async () => {
  const productSource = await read('src/components/DashboardProducts.tsx');
  assert.match(productSource, /setProductToDelete\(prod\)/);
  assert.match(productSource, /setProductToDelete\(mobileProductMenu\)/);
  assert.equal((productSource.match(/onDeleteProduct\(productToDelete\.id\)/g) || []).length, 1);
  assert.match(productSource, /Delete product from catalogue\?/);
  assert.match(productSource, /Keep Product/);
  assert.match(productSource, /Confirm Delete Product/);
  assert.match(productSource, /Transfer Stock/);
  assert.match(productSource, /aria-label="Transfer stock"/);
});

test('purchase edit and delete actions call tenant-scoped persistence callbacks', async () => {
  const purchaseSource = await read('src/components/DashboardPurchases.tsx');
  const dashboardSource = await read('src/components/Dashboard.tsx');
  assert.doesNotMatch(purchaseSource, /In a real app: call onDeletePurchase/);
  assert.match(purchaseSource, /onUpdatePurchases\(purchases\.map/);
  assert.match(purchaseSource, /onDeletePurchase\(id\)/);
  assert.match(dashboardSource, /const handleUpdatePurchases/);
  assert.match(dashboardSource, /const handleDeletePurchase/);
  assert.match(dashboardSource, /onUpdatePurchases=\{handleUpdatePurchases\}/);
  assert.match(dashboardSource, /onDeletePurchase=\{handleDeletePurchase\}/);
});

test('staff removal requires an inspectable in-app confirmation', async () => {
  const staffSource = await read('src/components/DashboardStaff.tsx');
  assert.doesNotMatch(staffSource, /\bconfirm\(['"]Are you sure you want to remove this staff member/);
  assert.match(staffSource, /Remove staff account\?/);
  assert.match(staffSource, /Keep Staff/);
  assert.match(staffSource, /Confirm Remove Staff/);
});

test('staff salary payments are wired into the shared expense and reporting ledger', async () => {
  const staffSource = await read('src/components/DashboardStaff.tsx');
  const dashboardSource = await read('src/components/Dashboard.tsx');
  assert.match(staffSource, /category:\s*'Wages & Salary'/);
  assert.match(staffSource, /recorded as <strong>Money Out/);
  assert.match(staffSource, /onPayStaff\(/);
  assert.match(dashboardSource, /onPayStaff=\{handleAddExpense\}/);
});

test('branch stock transfer is atomic and exposed through authenticated API wiring', async () => {
  const migrationSource = await read('supabase/migrations/20260724000200_atomic_branch_stock_transfer.sql');
  const apiSource = await read('src/branches/branchApi.ts');
  const serverSource = await read('server.ts');
  assert.match(migrationSource, /for update/);
  assert.match(migrationSource, /transfer_stock_between_current_tenant_branches/);
  assert.match(migrationSource, /private\.can_operate_additional_branches/);
  assert.doesNotMatch(migrationSource, /\bDELETE\s+FROM\b/i);
  assert.match(apiSource, /transferStockBetweenBranches/);
  assert.match(serverSource, /\/api\/branches\/stock-transfers/);
});

test('Tanzanite branch navigation uses the database entitlement workspace', async () => {
  const dashboardSource = await read('src/components/Dashboard.tsx');
  const branchSettingsSource = await read('src/components/DashboardBranchesSettings.tsx');
  const subscriptionSource = await read('src/utils/subscription.ts');
  assert.match(dashboardSource, /label:\s*'Branches'.*tabId:\s*'branches'.*plans:\s*\['tanzanite'\]/);
  assert.match(dashboardSource, /activeTab === 'branches'/);
  assert.match(subscriptionSource, /TANZANITE_ONLY_TABS[\s\S]*'branches'/);
  assert.match(branchSettingsSource, /<BranchProvider tenantKey=\{props\.activeTenant\.id\}>/);
  assert.doesNotMatch(branchSettingsSource, /const hasActiveTanzanite/);
});

test('affiliate workspace uses affiliate-scoped source tracking without querying tenant promo columns', async () => {
  const workspaceSource = await read('src/utils/affiliateWorkspace.ts');
  assert.match(workspaceSource, /subscriber_source_tracking/);
  assert.match(workspaceSource, /optionalQuery\('referred_customers'/);
  assert.doesNotMatch(workspaceSource, /client\.from\('tenants'\)\.select\('\*'\)\.or/);
});

test('Forecasting Lucy is routed through authenticated Express API wiring', async () => {
  const serverSource = await read('server.ts');
  const forecastingSource = await read('src/components/DashboardForecasting.tsx');
  const lucySource = await read('api/lucy.ts');
  assert.match(serverSource, /app\.post\('\/api\/lucy'/);
  assert.match(serverSource, /await requireTenantUser\(req,\s*tenantId\)/);
  assert.match(serverSource, /return await lucyHandler\(req,\s*res\)/);
  assert.match(forecastingSource, /Authorization:\s*`Bearer \$\{accessToken\}`/);
  assert.match(lucySource, /await requireLucyTenantUser\(req,\s*String\(businessData\?\.tenantId/);
  assert.match(lucySource, /supabaseAdmin\.auth\.getUser\(token\)/);
});

test('Lucy text generation uses current stable Gemini models', async () => {
  const serverSource = await read('server.ts');
  const lucySource = await read('api/lucy.ts');
  assert.match(serverSource, /diamond:\s*'gemini-3\.5-flash-lite'/);
  assert.match(serverSource, /tanzanite:\s*'gemini-3\.6-flash'/);
  assert.match(serverSource, /model:\s*'gemini-3\.5-flash-lite'/);
  assert.match(lucySource, /model:\s*'gemini-3\.6-flash'/);
  assert.doesNotMatch(serverSource, /diamond:\s*'gemini-2\.5-flash-lite'/);
  assert.doesNotMatch(serverSource, /tanzanite:\s*'gemini-2\.5-flash'/);
  assert.doesNotMatch(lucySource, /model:\s*'gemini-2\.5-flash'/);
});

test('reports use branded, searchable, multi-page PDF mode', async () => {
  const reportsSource = await read('src/components/DashboardReports.tsx');
  const pdfSource = await read('src/utils/pdfShare.ts');
  assert.match(reportsSource, /visual:\s*false/);
  assert.match(reportsSource, /branding:\s*\{/);
  assert.match(pdfSource, /Page \$\{pageNumber\} of \$\{pageCount\}/);
  assert.match(pdfSource, /pdf\.addPage\(\)/);
  assert.match(pdfSource, /orientation: format === 'a4'.*'landscape'/s);
});

test('branch migrations never contain destructive tenant-data DML', async () => {
  const migrationDir = join(projectRoot, 'supabase', 'migrations');
  const migrationFiles = (await readdir(migrationDir))
    .filter((name) => /multibranch|tanzanite_cross_branch|atomic_branch/.test(name) && name.endsWith('.sql'));
  assert.ok(migrationFiles.length > 0, 'No branch migrations found.');
  for (const name of migrationFiles) {
    const sql = await readFile(join(migrationDir, name), 'utf8');
    assert.doesNotMatch(sql, /\bTRUNCATE\b/i, `${name} contains TRUNCATE`);
    assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i, `${name} contains DELETE FROM`);
  }
});
