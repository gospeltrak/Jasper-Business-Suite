import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const login = fs.readFileSync('src/modules/auth/LoginPage.tsx', 'utf8');
const staff = fs.readFileSync('src/modules/staff/DashboardStaff.tsx', 'utf8');
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
  assert.match(server, /role_permissions: resolveRolePermissionsForResponse\(invitation\.permissions\)/);
  assert.match(server, /rolePermissions: resolveRolePermissionsForResponse\(invitation\.permissions\)/);
  assert.match(server, /role: invitation\.role_key/);
});

test('staff role, permissions, and branch survive registration and reload', () => {
  assert.match(staff, /branchId: regBranchId \|\| activeBranchId \|\| activeBranchContext\?\.id/);
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

test('a staff member can be granted All Branches access with matching write permissions everywhere', () => {
  const accessScopeMigration = fs.readFileSync(
    'supabase/migrations/20260926010000_staff_invitation_branch_access_scope.sql',
    'utf8',
  );
  assert.match(accessScopeMigration, /access_scope in \('assigned_branches', 'all_branches'\)/);

  // The invitation carries the chosen scope through to acceptance, where it
  // is applied to both the read-side profile and the tenant-wide write grants
  // -- read access alone would leave an "All Branches" staff unable to
  // actually record a sale/expense/etc on any branch but their original one.
  assert.match(server, /access_scope: accessScope, created_by: admin\.authUser\.id/);
  assert.match(server, /const syncStaffBranchAccessScope = async/);
  assert.match(server, /branch_staff_access_profiles/);
  assert.match(server, /branch_permission_grants/);
  assert.match(server, /await syncStaffBranchAccessScope\(\{/);
  assert.match(server, /app\.get\('\/api\/staff\/branch-access'/);
  assert.match(server, /app\.post\('\/api\/staff\/branch-access'/);

  // The Staff tab lets an admin pick which branch and All-Branches-vs-single
  // for both a brand-new hire (registration form) and an existing one
  // (profile), instead of silently defaulting to whichever branch the admin
  // happened to be viewing.
  assert.match(staff, /const \[availableBranches, setAvailableBranches\]/);
  assert.match(staff, /createGoogleInvitation\(newStaff, regAccessScope\)/);
  assert.match(staff, /createGoogleInvitation\(selectedStaff, profileAccessScope\)/);
  assert.match(staff, /const saveStaffBranchAccess = async/);
});
