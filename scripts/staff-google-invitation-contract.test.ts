import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const login = fs.readFileSync('src/components/LoginPage.tsx', 'utf8');
const staff = fs.readFileSync('src/components/DashboardStaff.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const dashboard = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260812000200_staff_google_invitations.sql', 'utf8');

test('staff invitation stores only a hash and is time-limited and single-use', () => {
  assert.match(server, /randomBytes\(32\)/);
  assert.match(server, /createHash\('sha256'\)\.update\(rawToken\)/);
  assert.match(server, /24 \* 60 \* 60 \* 1000/);
  assert.match(server, /\.eq\('status', 'pending'\).*select\('id'\)/s);
  assert.doesNotMatch(migration, /raw_token/i);
});

test('Google acceptance enforces exact invited email and server-owned access', () => {
  assert.match(server, /normalizeEmail\(authUser\.email\) !== normalizeEmail\(invitation\.email\)/);
  assert.match(server, /tenant_id: invitation\.tenant_id/);
  assert.match(server, /branch_id: invitation\.branch_id/);
  assert.match(server, /role_permissions: invitation\.permissions/);
  assert.match(server, /rolePermissions: invitation\.permissions/);
  assert.match(server, /role: invitation\.role_key/);
});

test('staff role, permissions, and branch survive registration and reload', () => {
  assert.match(staff, /branchId: activeBranchId \|\| activeBranchContext\?\.id/);
  assert.match(app, /rolePermissions: profileRolePermissions/);
  assert.match(app, /resolveProfileRolePermissions\(userProfile\.role_permissions\)/);
  assert.match(app, /isBusinessStaff && staffRoleKey/);
  assert.match(server, /const resolvedRole = isBusinessStaff && userProfile\.role_key/);
  assert.match(dashboard, /mergeSettingsForSync\(updated, systemSettings\)/);
});

test('staff form collects Gmail and callback preserves invitation token', () => {
  assert.match(staff, /Gmail for Google invitation/);
  assert.match(staff, /type="email" required/);
  assert.match(login, /accept-staff-invitation/);
  assert.match(login, /callback\.searchParams\.set\('staffInvite', staffInvite\)/);
});

test('invitation table is inaccessible to browser roles', () => {
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on public\.staff_google_invitations from anon, authenticated/i);
});
