import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const app=read('src/App.tsx');
const login=read('src/modules/auth/LoginPage.tsx');
const server=read('server.ts');
const types=read('src/types.ts');

test('Private /pro login uses email/password and has no public registration',()=>{
  assert.match(login,/proMode\?: boolean/);
  assert.match(login,/if \(proMode\) return 'signin'/);
  assert.match(login,/\{!proMode && !isSaasAdminPortal && !onboardingUser/);
  assert.match(login,/proMode \|\| authTab === 'signin'/);
  assert.match(login,/redirectTo: window\.location\.origin \+ \(proMode \? '\/pro' : '\/login'\)/);
  assert.match(login,/ref=\{loginEmailInputRef\}/);
  assert.match(login,/ref=\{loginPasswordInputRef\}/);
});

test('Private login and reload verify tenant membership against authenticated server',()=>{
  assert.match(login,/fetch\('\/api\/orvix-pro\/entitlement'/);
  assert.match(login,/payload\?\.registered !== true/);
  assert.match(login,/onLogin\(\{ \.\.\.userPayload, isProAccount: true \}\)/);
  assert.match(app,/currentPath !== '\/pro' \|\| !user\?\.id/);
  assert.match(app,/response\.ok && payload\?\.package === 'orvix_pro'/);
  assert.match(app,/if \(!proPortalAccess\.registered\)/);
  assert.match(app,/if \(!proPortalAccess\.enabled\)/);
  assert.match(app,/currentPath === '\/pro'/);
  assert.match(types,/isProAccount\?: boolean/);
  assert.match(server,/\['\/login', '\/pro', '\/tools'/);
});

test('Private Pro route has no self-serve billing or enrollment',()=>{
  assert.doesNotMatch(app,/\/api\/orvix-pro\/(?:register|checkout|activate)/);
  assert.doesNotMatch(login,/\/api\/orvix-pro\/(?:register|checkout|activate)/);
  assert.match(app,/No standard Pro price, automatic charge or self-service checkout/);
});
