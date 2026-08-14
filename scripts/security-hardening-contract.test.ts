import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const server = fs.readFileSync('server.ts', 'utf8');
const vercel = fs.readFileSync('vercel.json', 'utf8');
const login = fs.readFileSync('src/components/LoginPage.tsx', 'utf8');
const admin = fs.readFileSync('src/components/SuperSaaSAdminView.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260812000300_close_legacy_public_rls.sql', 'utf8');

test('Super Admin is Google and fresh-MFA only with three attempts', () => {
  assert.match(login, /Super Admin password login is disabled/);
  assert.match(login, /Google \+ Authenticator required/);
  assert.doesNotMatch(server, /super-admin\/verify-password/);
  assert.match(admin, /nextAttempts >= 3/);
  assert.match(admin, /signOut\(\{ scope: 'global' \}\)/);
  assert.match(admin, /prepareSuperAdminMfa\(true\)/);
  assert.match(login, /adminMfaAttempts \+ 1/);
  assert.match(server, /super-admin-security-event/);
});

test('all Super Admin APIs enforce server profile authorization and writes require AAL2', () => {
  assert.match(server, /app\.use\('\/api\/super-admin'[\s\S]*await requirePlatformAdmin\(req\)/);
  assert.match(server, /!\['GET', 'HEAD'\]\.includes\(req\.method\)[\s\S]*!== 'aal2'/);
  assert.match(server, /super-admin-api'[\s\S]*max: 90/);
});

test('API mutations reject cross-site browser requests and costly tools require an active session', () => {
  assert.match(server, /app\.use\('\/api', protectBrowserApiMutations\)/);
  assert.match(server, /fetchSite === 'cross-site'/);
  assert.match(server, /app\.post\('\/api\/tools\/remove-bg'[\s\S]*await requireActiveUser\(req\)/);
  assert.match(server, /phone-lookup'[\s\S]*max: 10/);
});

test('public landing data is projected without exposing private Web Editor state', () => {
  const publicRecordTypes = server.slice(server.indexOf('const PUBLIC_PLATFORM_RECORD_TYPES'), server.indexOf('const PUBLIC_LANDING_TEXT_KEYS'));
  assert.doesNotMatch(publicRecordTypes, /'web_editor_settings'/);
  assert.match(publicRecordTypes, /'public_landing_settings'/);
  assert.match(server, /sanitizePublicLandingSettings/);
  assert.match(server, /if \(!PUBLIC_PLATFORM_RECORD_TYPES\.has\(recordType\)\)[\s\S]*if \(!supabaseAdmin\)/);
  assert.match(server, /recordType === 'web_editor_settings'[\s\S]*record_type: 'public_landing_settings'/);
  assert.doesNotMatch(server.slice(server.indexOf('const sanitizePublicLandingSettings'), server.indexOf('const isUuid')), /partnerWaitlist|partnerCapacity/);
});

test('production Turnstile is fail-closed and landing assets have a restrictive CSP', () => {
  assert.match(server, /const isProduction = process\.env\.NODE_ENV === 'production' \|\| Boolean\(process\.env\.VERCEL_ENV\)/);
  assert.match(server, /return !isProduction/);
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /object-src 'none'/);
  assert.match(server, /frame-ancestors 'self'/);
  assert.match(server, /sha256-\+4ZACLmWNrkCmdB9Fqi4malsKm2fp80y5Pri\+gSPmoU=/);
  assert.match(vercel, /Content-Security-Policy/);
  assert.match(vercel, /object-src 'none'/);
});

test('platform record writes require JSON and public landing responses are cache bounded', () => {
  assert.match(server, /app\.put\('\/api\/super-admin\/platform-records\/:type\/:scope'[\s\S]*req\.is\('application\/json'\)/);
  assert.match(server, /stale-while-revalidate=300/);
});

test('legacy public policies are replaced with tenant, affiliate, partner, or platform ownership', () => {
  for (const policy of ['tenant_data_select','workspace_select','proofs_select','ap_select','rc_select','cl_select','mr_select','asl_select','mal_select']) {
    assert.match(migration, new RegExp(`drop policy if exists ${policy}`));
  }
  assert.doesNotMatch(migration, /to public[\s\S]*(using|with check) \(?(true)\)?/i);
  assert.match(migration, /private\.current_tenant_id/);
  assert.match(migration, /private\.current_affiliate_id/);
  assert.match(migration, /private\.is_platform_admin/);
});
