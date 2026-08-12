import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const login = readFileSync(new URL('../src/components/LoginPage.tsx', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('Google OAuth returns to the resolver and new users complete business onboarding', () => {
  assert.match(login, /\/login\?oauth=google/);
  assert.match(login, /\/api\/auth\/google\/resolve/);
  assert.match(login, /\/api\/auth\/google\/provision/);
  assert.match(login, /onboardingPhone/);
  assert.match(login, /onboardingBusinessType/);
  assert.doesNotMatch(login.slice(login.indexOf('handleOnboardingSubmit'), login.indexOf('triggerOnLoginWithSplash')), /Offline fallback mode|\.from\('tenants'\)\.insert/);
});

test('server trusts verified Google session but never OAuth role or tenant metadata', () => {
  assert.match(server, /supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(server, /app_metadata\?\.provider === 'google'/);
  assert.match(server, /\.from\('users'\)[\s\S]*\.or\(`id\.eq\.\$\{authUser\.id\},email\.eq\.\$\{authUser\.email\.toLowerCase\(\)\}`\)/);
  assert.match(server, /phoneIdentifiersMatch/);
  assert.match(server, /provision_primary_branch_for_new_tenant/);
  assert.doesNotMatch(server.slice(server.indexOf("app.get('/api/auth/google/resolve'"), server.indexOf("app.post('/api/auth/google/provision'")), /user_metadata\?\.(?:role|tenant)/);
});
