import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const portal = fs.readFileSync('src/modules/affiliate/components/AffiliatePortal.tsx', 'utf8');

test('affiliate and partner Google registration uses the verified Google identity', () => {
  assert.match(server, /googleRegistration \? await getGoogleRequestUser\(req\)/);
  assert.match(server, /googleUser\?\.email \? normalizeEmail\(googleUser\.email\)/);
  assert.match(server, /account_type: isPartner \? 'partner' : 'affiliate'/);
  assert.match(server, /parentPartner\.id/);
  assert.doesNotMatch(server.slice(server.indexOf("app.post('/api/affiliate/register'"), server.indexOf('const getGoogleRequestUser')), /user_metadata\?\.(?:role|account_type)/);
});

test('Affiliate and Agent portal cannot initiate Google OAuth sign-in', () => {
  assert.doesNotMatch(portal,/signInWithOAuth\(/);
  assert.doesNotMatch(portal,/handleGooglePortalLogin/);
  assert.doesNotMatch(portal,/orvix_google_portal_registration_intent/);
});

test('registration copy does not instruct Google users to use phone passwords', () => {
  assert.doesNotMatch(portal, /Sign in with your phone number and password/);
  assert.match(portal, /<span>\s*Verified Affiliate Records\s*<\/span>/);
  assert.doesNotMatch(portal, /Verified Affiliate Shared Growth Ledger/);
  assert.doesNotMatch(portal, /[â←].*Already have an account\? Sign In/);
});

test('Affiliate and Agent portal uses email/password without Google login buttons', () => {
  const loginUi = portal.slice(portal.indexOf('{/* Login form */}'), portal.indexOf('/* PARTNER CAPACITY REACHED */'));
  assert.match(loginUi,/handleLoginAffiliate/);
  assert.match(loginUi,/type="email"/);
  assert.match(loginUi,/type=\{showLoginPassword \? 'text' : 'password'\}/);
  assert.match(loginUi,/Forgot Password\?/);
  assert.doesNotMatch(loginUi,/Endelea kwa Google|Continue with Google|onClick=\{handleGooglePortalLogin\}/);
});

test('Affiliate and Agent registration offers email only (legacy Google server checks remain safe)', () => {
  const registerUi = portal.slice(portal.indexOf('/* EMAIL-OR-GOOGLE REGISTER ENTRY */'), portal.indexOf(') : activeAffiliate?.isSuper ? ('));
  assert.match(registerUi,/Endelea kwa Barua Pepe/);
  assert.doesNotMatch(registerUi,/Endelea kwa Google|Continue with Google|onClick=\{handleGooglePortalLogin\}/);
  assert.match(registerUi,/useEmailRegistration/);
  assert.match(portal,/if \(!usingGoogle\) \{\s*if \(!email\.trim\(\)/s);
});

test('Forgot Password and reset use the same Supabase auth flow as tenants', () => {
  const tenant = fs.readFileSync('src/modules/auth/LoginPage.tsx','utf8');
  assert.match(portal,/resetPasswordForEmail\(target/);
  assert.match(portal,/updateUser\(\{password:recoveryPassword\}\)/);
  assert.match(portal,/isPasswordRecoverySessionActive/);
  assert.match(portal,/subscribeToPasswordRecoverySession/);
  assert.match(portal,/setRecoveryView\('set'\)/);
  assert.match(portal,/client\.auth\.signOut\(\)/);
  assert.match(tenant,/prepareSuperAdminMfa/);
  assert.match(tenant,/verifySuperAdminMfa/);
  assert.match(tenant,/Continue with Google/);
});
