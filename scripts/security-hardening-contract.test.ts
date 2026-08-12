import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const server = fs.readFileSync('server.ts', 'utf8');
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

test('legacy public policies are replaced with tenant, affiliate, partner, or platform ownership', () => {
  for (const policy of ['tenant_data_select','workspace_select','proofs_select','ap_select','rc_select','cl_select','mr_select','asl_select','mal_select']) {
    assert.match(migration, new RegExp(`drop policy if exists ${policy}`));
  }
  assert.doesNotMatch(migration, /to public[\s\S]*(using|with check) \(?(true)\)?/i);
  assert.match(migration, /private\.current_tenant_id/);
  assert.match(migration, /private\.current_affiliate_id/);
  assert.match(migration, /private\.is_platform_admin/);
});
