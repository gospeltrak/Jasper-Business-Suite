import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { isStrictPlatformAdminProfile } from '../shared/platformAdminAuth';

const root = path.resolve(import.meta.dirname, '..');

test('accepts only an active tenantless super admin', () => {
  assert.equal(isStrictPlatformAdminProfile({
    is_active: true,
    account_type: 'super_admin',
    tenant_id: null,
    active_tenant: null,
  }), true);
});

test('rejects ordinary tenant Admin roles', () => {
  assert.equal(isStrictPlatformAdminProfile({
    is_active: true,
    account_type: 'business_user',
    role: 'Admin',
    role_key: 'admin',
    tenant_id: '64ba3572-b61f-4142-826c-e6fa48eab169',
    active_tenant: null,
  }), false);
});

test('rejects inactive or tenant-bound super-admin profiles', () => {
  assert.equal(isStrictPlatformAdminProfile({
    is_active: false,
    account_type: 'super_admin',
    tenant_id: null,
    active_tenant: null,
  }), false);
  assert.equal(isStrictPlatformAdminProfile({
    is_active: true,
    account_type: 'super_admin',
    tenant_id: '7395ceb5-6132-4a93-a01e-79c78bba7c13',
    active_tenant: null,
  }), false);
  assert.equal(isStrictPlatformAdminProfile({
    is_active: true,
    account_type: 'super_admin',
    tenant_id: null,
    active_tenant: '7395ceb5-6132-4a93-a01e-79c78bba7c13',
  }), false);
});

test('admin write-mode uses fresh MFA and ships no password override or shared secret', () => {
  const files = [
    'server.ts',
    'src/utils/superAdminData.ts',
    'src/utils/superAffiliateAdmin.ts',
    'src/components/SuperSaaSAdminView.tsx',
    'src/components/SuperAffiliateControlCenter.tsx',
    'src/components/SaaSUserDesk.tsx',
    'src/utils/superAdminMfa.ts',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

  assert.doesNotMatch(files, /saas-secure-2026|saas_encrypted_master_key|['"]3698['"]/);
  assert.doesNotMatch(files, /\/api\/super-admin\/verify-password/);
  assert.match(files, /prepareSuperAdminMfa\(true\)/);
  assert.match(files, /signOut\(\{ scope: 'global' \}\)/);
  assert.match(files, /getAuthenticatorAssuranceLevel/);
  assert.match(files, /factorType:\s*['"]totp['"]/);
  assert.match(files, /MFA_REQUIRED/);
  assert.match(files, /['"]aal2['"]/);
});
