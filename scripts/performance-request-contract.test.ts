import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const platformRecords = fs.readFileSync('src/utils/superAdminPlatformRecords.ts', 'utf8');
const logoContext = fs.readFileSync('src/TenantLogoContext.tsx', 'utf8');
const affiliateAdmin = fs.readFileSync('src/utils/superAffiliateAdmin.ts', 'utf8');
const superAdminData = fs.readFileSync('src/utils/superAdminData.ts', 'utf8');

test('tenant resolution is deduplicated and cached per exact host request', () => {
  assert.match(app, /orvix_tenant_resolve:\$\{resolveUrl\}/);
  assert.doesNotMatch(app, /fetch\(resolveUrl, \{ cache: 'no-store' \}\)/);
  assert.match(server, /resolveTenantDomainCached/);
  assert.match(server, /private, max-age=60, stale-while-revalidate=300/);
});

test('tenant screens never fall back to privileged platform record APIs', () => {
  assert.match(platformRecords, /!window\.location\.pathname\.startsWith\('\/admin'\)/);
  assert.match(platformRecords, /publicRecord !== undefined/);
});

test('logo requests are tenant-keyed, deduplicated and never scan other tenants', () => {
  assert.match(logoContext, /logoRequests = new Map/);
  assert.match(logoContext, /logoCache = new Map/);
  const logoRoute = server.slice(server.indexOf("app.get('/api/tenant/logo-by-domain'"), server.indexOf("app.post('/api/tenant/logo'"));
  assert.doesNotMatch(logoRoute, /\.from\('tenants'/);
  assert.match(logoRoute, /resolveTenantDomainCached/);
});

test('login page is split out of the initial application bundle', () => {
  assert.doesNotMatch(app, /import LoginPage from/);
  assert.match(app, /lazyWithReload\('LoginPage'/);
});

test('super admin overview stays lightweight and tenant workspaces load on demand', () => {
  const overviewRoute = server.slice(
    server.indexOf("app.get('/api/super-admin/overview'"),
    server.indexOf("app.get('/api/super-admin/tenants/:tenantId/workspace'"),
  );
  assert.match(server, /SUPER_ADMIN_OVERVIEW_CACHE_TTL_MS = 5_000/);
  assert.match(server, /superAdminOverviewRequest/);
  assert.match(server, /invalidateSuperAdminOverviewCache/);
  assert.match(overviewRoute, /await requirePlatformAdmin\(req\)[\s\S]+superAdminOverviewCache/);
  assert.doesNotMatch(overviewRoute, /adminTable\('tenant_workspaces'\)/);
  assert.doesNotMatch(superAdminData, /from\('tenant_workspaces'\)\.select\('\*'\)/);
  assert.match(overviewRoute, /workspaces: \[\]/);
  assert.doesNotMatch(overviewRoute, /select\('\*'\)/);
  const workspaceRoute = server.slice(
    server.indexOf("app.get('/api/super-admin/tenants/:tenantId/workspace'"),
    server.indexOf("app.get('/api/super-admin/tenants/:tenantId/branch-access'"),
  );
  assert.match(workspaceRoute, /await requirePlatformAdmin\(req\)/);
  assert.match(workspaceRoute, /\.eq\('tenant_id', tenantId\)/);
  assert.match(workspaceRoute, /select\('tenant_id,payload,updated_at'\)/);
});

test('online operational metrics use recent device sessions without loading tenant workspaces', () => {
  const overviewRoute = server.slice(
    server.indexOf("app.get('/api/super-admin/overview'"),
    server.indexOf("app.get('/api/super-admin/tenants/:tenantId/workspace'"),
  );
  assert.match(overviewRoute, /online_user_sessions/);
  assert.match(overviewRoute, /device_id,device_label/);
  assert.match(overviewRoute, /\.gte\('last_activity_at'/);
  assert.match(overviewRoute, /onlineSessions/);
  assert.doesNotMatch(overviewRoute, /adminTable\('tenant_workspaces'\)/);
});

test('affiliate monitoring avoids tenant scans and loads sensitive affiliate details by id', () => {
  const monitoringLoader = affiliateAdmin.slice(affiliateAdmin.indexOf('export async function loadAffiliateMonitoringData'), affiliateAdmin.indexOf('export async function loadSuperAffiliateDetail'));
  const detailLoader = affiliateAdmin.slice(affiliateAdmin.indexOf('export async function loadSuperAffiliateDetail'), affiliateAdmin.indexOf('export async function loadSuperAffiliateRows'));
  assert.doesNotMatch(monitoringLoader, /from\('tenants'\)/);
  assert.doesNotMatch(monitoringLoader, /from\('affiliates'\)\.select\('[^']*nida_number/);
  assert.match(detailLoader, /\.eq\('id', id\)/);
  assert.match(detailLoader, /nida_number/);
});
