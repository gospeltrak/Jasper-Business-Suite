import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  'supabase/migrations/20261107123941_fix_tenant_registration_private_guard_invocation.sql',
  'utf8',
);

test('registration guard runs with protected privileges, not public private-schema access', () => {
  assert.match(sql, /ALTER FUNCTION private\.guard_normalized_workspace_storage\(\) SECURITY DEFINER;/);
  assert.match(sql, /ALTER FUNCTION private\.guard_normalized_workspace_storage\(\) SET search_path = '';/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.guard_normalized_workspace_storage\(\)/);
  assert.doesNotMatch(sql, /GRANT\s+USAGE\s+ON\s+SCHEMA\s+private/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE|DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i);
});
