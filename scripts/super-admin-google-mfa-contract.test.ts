import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const login = fs.readFileSync('src/components/LoginPage.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

test('dedicated admin route uses Google then Authenticator before dashboard', () => {
  assert.match(app, /case '\/admin'/);
  assert.match(login, /\/admin\?oauth=google/);
  assert.match(login, /prepareSuperAdminMfa/);
  assert.match(login, /verifySuperAdminMfa/);
  assert.match(login, /Verify & Open Admin/);
});

test('tenant login rejects platform administrator and APIs require aal2', () => {
  assert.match(app, /Super Admin must sign in through the dedicated \/admin portal/);
  assert.match(login, /Use the dedicated Super Admin login at \/admin/);
  assert.match(server, /readVerifiedTokenAal\(getBearerToken\(req\)\) !== 'aal2'/);
});
