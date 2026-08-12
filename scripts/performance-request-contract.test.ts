import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const platformRecords = fs.readFileSync('src/utils/superAdminPlatformRecords.ts', 'utf8');
const logoContext = fs.readFileSync('src/TenantLogoContext.tsx', 'utf8');

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
