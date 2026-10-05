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

test('portal resolves a verified Google identity after a Google registration', () => {
  assert.match(portal, /orvix_google_portal_registration_intent/);
  assert.match(portal, /googleRegistrationVerified/);
  assert.match(portal, /googleRegistration: usingGoogle/);
  assert.match(portal, /register=true/);
  assert.match(portal, /\/api\/auth\/google\/portal-resolve/);
  assert.doesNotMatch(portal, /Complete the registration form,[^\n]+before continuing with Google/);
});

test('registration copy does not instruct Google users to use phone passwords', () => {
  assert.doesNotMatch(portal, /Sign in with your phone number and password/);
  assert.match(portal, /<span>\s*Verified Affiliate Records\s*<\/span>/);
  assert.doesNotMatch(portal, /Verified Affiliate Shared Growth Ledger/);
  assert.doesNotMatch(portal, /[â←].*Already have an account\? Sign In/);
});

test('affiliate and partner login offers email/password alongside Google', () => {
  const loginUi = portal.slice(portal.indexOf("{authMode === 'login' ? ("), portal.indexOf(") : portalRole === 'partner'"));
  assert.match(loginUi, /Continue with Google/);
  assert.match(loginUi, /handleLoginAffiliate/);
  assert.match(loginUi, /type="email"/);
  assert.match(loginUi, /type=\{showLoginPassword \? 'text' : 'password'\}/);
  assert.match(loginUi, /type="submit"/);
});

test('registration offers both an email/password path and a Google path, each gated by its own identity check', () => {
  const registerUi = portal.slice(portal.indexOf('/* EMAIL-OR-GOOGLE REGISTER ENTRY */'), portal.indexOf(') : activeAffiliate?.isSuper ? ('));
  assert.match(registerUi, /Continue with Email/);
  assert.match(registerUi, /Continue with Google/);
  assert.match(registerUi, /useEmailRegistration/);
  // The hidden, impossible-to-fill WhatsApp phone field that previously
  // blocked every registration submission must not come back.
  assert.doesNotMatch(portal, /className="hidden"[^>]*aria-hidden="true">\s*<label[^>]*>\s*WhatsApp Number/);
  // Email + password only need to be collected (and are only required)
  // when the account isn't already Google-verified.
  assert.match(portal, /if \(!usingGoogle\) \{\s*if \(!email\.trim\(\)/s);
});
