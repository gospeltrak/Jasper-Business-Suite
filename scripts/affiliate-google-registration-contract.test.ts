import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const portal = fs.readFileSync('src/components/AffiliatePortal.tsx', 'utf8');

test('affiliate and partner Google registration uses the verified Google identity', () => {
  assert.match(server, /googleRegistration \? await getGoogleRequestUser\(req\)/);
  assert.match(server, /googleUser\?\.email \? normalizeEmail\(googleUser\.email\)/);
  assert.match(server, /account_type: isPartner \? 'partner' : 'affiliate'/);
  assert.match(server, /parentPartner\.id/);
  assert.doesNotMatch(server.slice(server.indexOf("app.post('/api/affiliate/register'"), server.indexOf('const getGoogleRequestUser')), /user_metadata\?\.(?:role|account_type)/);
});

test('portal verifies Google before showing and submitting registration details', () => {
  assert.match(portal, /orvix_google_portal_registration_intent/);
  assert.match(portal, /googleRegistrationVerified/);
  assert.match(portal, /googleRegistration: true/);
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
