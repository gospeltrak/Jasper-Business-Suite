import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const login = readFileSync(new URL('../src/components/LoginPage.tsx', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const affiliateWorkspace = readFileSync(new URL('../src/components/affiliate/AffiliateWorkspace.tsx', import.meta.url), 'utf8');
const affiliateData = readFileSync(new URL('../src/utils/affiliateWorkspace.ts', import.meta.url), 'utf8');

test('Google OAuth returns to the resolver and new users complete business onboarding', () => {
  assert.match(login, /\/login\?oauth=google/);
  assert.match(login, /\/api\/auth\/google\/resolve/);
  assert.match(login, /\/api\/auth\/google\/provision/);
  assert.match(login, /onboardingPhone/);
  assert.match(login, /onboardingBusinessType/);
  assert.doesNotMatch(login.slice(login.indexOf('handleOnboardingSubmit'), login.indexOf('triggerOnLoginWithSplash')), /Offline fallback mode|\.from\('tenants'\)\.insert/);
});

test('tenant domain login has no portal subtitle and tenant registration button remains stable', () => {
  assert.doesNotMatch(login, /secure business portal/i);
  assert.doesNotMatch(login, /Spinning Up Isolated Tenant|Allocating Cloud DB Cluster/);
  assert.match(login, /disabled=\{isLoading\}[\s\S]{0,350}<span>\{t\('registerTab'\)\}<\/span>/);
});

test('server trusts verified Google session but never OAuth role or tenant metadata', () => {
  assert.match(server, /supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(server, /app_metadata\?\.provider === 'google'/);
  assert.match(server, /\.from\('users'\)[\s\S]*\.or\(`id\.eq\.\$\{authUser\.id\},email\.eq\.\$\{authUser\.email\.toLowerCase\(\)\}`\)/);
  assert.match(server, /phoneIdentifiersMatch/);
  assert.match(server, /provision_primary_branch_for_new_tenant/);
  assert.doesNotMatch(server.slice(server.indexOf("app.get('/api/auth/google/resolve'"), server.indexOf("app.post('/api/auth/google/provision'")), /user_metadata\?\.(?:role|tenant)/);
});

test('Turnstile protects password and Google login across business and portal accounts', () => {
  const affiliate = readFileSync(new URL('../src/components/AffiliatePortal.tsx', import.meta.url), 'utf8');
  assert.match(login, /verifyLoginTurnstile/);
  assert.match(login, /\/api\/auth\/turnstile/);
  assert.match(affiliate, /\/api\/auth\/turnstile/);
  assert.match(affiliate, /handleGooglePortalLogin/);
  assert.match(affiliate, /resolved\.portalRole === 'partner' \? '\/partner' : '\/affiliate'/);
  assert.match(server, /app\.post\('\/api\/auth\/turnstile'/);
  assert.match(server, /app\.get\('\/api\/auth\/google\/portal-resolve'/);
  assert.match(server, /affiliate_partners'[\s\S]*\.eq\('user_id', authUser\.id\)/);
  assert.doesNotMatch(server.slice(server.indexOf("app.get('/api/auth/google/portal-resolve'"), server.indexOf("app.post('/api/auth/google/provision'")), /user_metadata\?\.(?:role|account_type)/);
});

test('existing Google affiliates open their own fully wired workspace', () => {
  assert.match(affiliateData, /profileQuery\.eq\('user_id', authData\.user\.id\)/);
  for (const tab of ['overview', 'tenants', 'code-link', 'tasks', 'ads', 'meetings', 'reports', 'payouts', 'settings']) {
    assert.match(affiliateWorkspace, new RegExp(`activeTab === '${tab}'`));
  }
  assert.match(affiliateData, /affiliate_tasks'[\s\S]*\.eq\('affiliate_id', profile\.id\)/);
  assert.match(affiliateData, /affiliate_commissions'[\s\S]*\.eq\('affiliate_id', profile\.id\)/);
  assert.match(affiliateData, /affiliate_payouts'[\s\S]*\.eq\('affiliate_id', profile\.id\)/);
});
