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

test('portal preserves the completed registration across Google redirect', () => {
  assert.match(portal, /orvix_google_portal_registration/);
  assert.match(portal, /googleRegistration: true/);
  assert.match(portal, /register=true/);
  assert.match(portal, /\/api\/auth\/google\/portal-resolve/);
});
