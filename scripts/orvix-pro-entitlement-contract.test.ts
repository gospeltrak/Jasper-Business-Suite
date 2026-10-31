import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('Tanzanite base subscription and billing remain unchanged', () => {
  const plans = read('src/shared/utils/subscription.ts');
  const server = read('server.ts');
  assert.match(plans, /tanzanite:\s*\{[\s\S]*?name: 'Tanzanite',[\s\S]*?price: 50000/);
  assert.match(server, /const SUBSCRIPTION_PACKAGE_IDS = new Set\(\['ruby', 'diamond', 'tanzanite'\]\)/);
  assert.doesNotMatch(server, /SUBSCRIPTION_PACKAGE_PRICES = new Map\(\[[\s\S]*?\['orvix_pro'/);
});

test('Settle is never inherited from Tanzanite, Diamond or the regular trial', () => {
  const sales = read('src/modules/sales/DashboardSalesList.tsx');
  assert.match(sales, /const canUseTillSettlement = proEntitlement\.tenantId === activeTenant\.id && proEntitlement\.features\.settle/);
  assert.doesNotMatch(sales, /const canUseTillSettlement = activePlanId !== 'ruby'/);
  assert.match(sales, /\.filter\(tab => tab\.id !== 'settlement' \|\| canUseTillSettlement\)/);
  assert.match(sales, /if \(!canUseTillSettlement && activeSubTab === 'settlement'\)/);
});

test('Pro feature flags are independently disabled until server-confirmed', () => {
  const pro = read('src/shared/utils/orvixProEntitlement.ts');
  for (const key of ['settle', 'shiftReports', 'cashierAccountability', 'parkSale']) {
    assert.match(pro, new RegExp(key + ': false'));
    assert.match(pro, new RegExp(key + ': payload\\.features\\?\\.' + key + ' === true'));
  }
  assert.match(pro, /cache: 'no-store'/);
  assert.match(pro, /if \(!response\.ok\) return/);
});

test('Pro entitlements are explicitly granted and tenant-scoped, never auto-assigned', () => {
  const migration = read('supabase/migrations/20261031090236_orvix_pro_opt_in_entitlements.sql');
  const server = read('server.ts');
  assert.match(migration, /tenant_id uuid primary key references public\.tenants\(id\)/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on public\.orvix_pro_entitlements from public, anon, authenticated/);
  assert.doesNotMatch(migration, /insert into public\.orvix_pro_entitlements/i);
  assert.match(server, /\.from\('users'\)[\s\S]*?\.eq\('id', identity\.user\.id\)/);
  assert.match(server, /\.from\('orvix_pro_entitlements'\)/);
  assert.match(server, /entitlement\?\.status === 'trial' \|\| entitlement\?\.status === 'active'/);
});

test('The one and only private Pro sign-in URL is /pro and it uses existing email and password', () => {
  const app = read('src/App.tsx');
  const login = read('src/modules/auth/LoginPage.tsx');
  const server = read('server.ts');
  const robots = read('public/robots.txt');
  assert.match(app, /currentPath === '\/pro'/);
  assert.match(app, /<LoginPage\s+proMode/);
  assert.match(app, /if \(sessionUser\.isProAccount\) return '\/pro'/);
  assert.match(login, /proMode\?: boolean/);
  assert.match(login, /const response = await fetch\('\/api\/orvix-pro\/entitlement'/);
  assert.match(login, /payload\?\.registered !== true/);
  assert.match(login, /if \(proMode\)/);
  assert.match(server, /'\/pro'/);
  assert.match(robots, /Disallow: \/pro/);
  assert.doesNotMatch(app, /currentPath === '\/orvix-pro'/);
});

test('Private Pro pricing is 120000 TZS, not part of public 3-package checkout', () => {
  const server = read('server.ts');
  const plans = read('src/shared/utils/subscription.ts');
  assert.match(server, /registered: Boolean\(entitlement\)/);
  assert.match(server, /price: entitlement \? \{ amount: 120000, currency: 'TZS' \} : null/);
  assert.doesNotMatch(plans, /id: 'orvix_pro'/);
  assert.match(server, /const SUBSCRIPTION_PACKAGE_IDS = new Set\(\['ruby', 'diamond', 'tanzanite'\]\)/);
});

test('Private Pro login requires membership and never exposes ordinary checkout to pending accounts', () => {
  const app = read('src/App.tsx');
  const login = read('src/modules/auth/LoginPage.tsx');
  assert.match(app, /if \(!proPortalAccess\.registered\)/);
  assert.match(app, /if \(!proPortalAccess\.enabled\)/);
  assert.match(app, /Account awaiting activation/);
  assert.match(app, /No automatic charge has been initiated/);
  assert.match(app, /proMode=\{currentPath === '\/pro'\}/);
  assert.match(login, /if \(proMode\) \{/);
  assert.match(login, /payload\?\.registered !== true/);
  assert.match(login, /onLogin\(\{ \.\.\.userPayload, isProAccount: true \}\)/);
  assert.match(login, /\!proMode && \!isSaasAdminPortal/);
});
