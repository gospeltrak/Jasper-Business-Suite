import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const server = read('server.ts');
const migration = read('supabase/migrations/20261110100000_orvix_pro_private_entitlements.sql');
const admin = read('src/modules/platform-admin/components/SuperSaaSAdminView.tsx');
const dashboard = read('src/components/Dashboard.tsx');
const entitlements = read('src/shared/utils/orvixProEntitlement.ts');

test('Orvix Pro entitlements are private and opt-in only', () => {
  assert.match(migration, /create table if not exists public\.orvix_pro_entitlements/);
  assert.match(migration, /status text not null default 'inactive'/);
  for (const flag of ['settle_enabled','shift_reports_enabled','cashier_accountability_enabled','park_sale_enabled']) {
    assert.match(migration, new RegExp(flag + ' boolean not null default false'));
  }
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on public\.orvix_pro_entitlements from public, anon, authenticated/);
  assert.doesNotMatch(migration, /insert into public\.orvix_pro_entitlements/i);
});

test('Pro entitlement API derives tenant from verified auth and refuses unknown access', () => {
  const start = server.indexOf("app.get('/api/orvix-pro/entitlement'");
  const end = server.indexOf("app.get('/api/branches/bootstrap'", start);
  assert.ok(start > 0 && end > start);
  const route = server.slice(start, end);
  assert.match(route, /supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(route, /\.from\('users'\)/);
  assert.match(route, /\.eq\('id', identity\.user\.id\)/);
  assert.match(route, /\.eq\('tenant_id', appUser\.tenant_id\)/);
  assert.match(route, /validWindow && hasBoundedTrial/);
  assert.match(route, /enabled && entitlement\?\.settle_enabled === true/);
  assert.doesNotMatch(route, /req\.(query|body)\.tenantId|req\.(query|body)\.tenant_id/);
});

test('Pro clients admin API and UI are restricted and read only', () => {
  const adminRoute = server.slice(server.indexOf("app.get('/api/orvix-pro/admin/clients'"), server.indexOf("app.get('/api/orvix-pro/entitlement'"));
  assert.match(adminRoute, /await requirePlatformAdmin\(req\)/);
  assert.match(adminRoute, /\.from\('orvix_pro_entitlements'\)/);
  assert.doesNotMatch(adminRoute, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(admin, /activeTab === 'orvix-pro'/);
  assert.match(dashboard, /activeTab === 'admin-orvix-pro' \? 'orvix-pro'/);
  assert.match(dashboard, /subTab === 'orvix-pro' \? 'admin-orvix-pro'/);
  assert.match(read('src/modules/platform-admin/components/OrvixProClientList.tsx'), /\/api\/orvix-pro\/admin\/clients/);
  assert.match(entitlements, /ORVIX_PRO_DISABLED/);
});
