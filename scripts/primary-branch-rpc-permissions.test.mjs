import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20261108110000_lock_primary_branch_provisioning_rpc.sql',
  'utf8',
);
const server = readFileSync('server.ts', 'utf8');

test('provisioning endpoint is service-role only without modifying existing tenant data', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.provision_primary_branch_for_new_tenant\(uuid, uuid\)[\s\S]*FROM PUBLIC, anon, authenticated;/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.provision_primary_branch_for_new_tenant\(uuid, uuid\)[\s\S]*TO service_role;/i);
  assert.doesNotMatch(migration, /\b(?:DELETE|UPDATE|TRUNCATE|DROP)\b|GRANT\s+USAGE\s+ON\s+SCHEMA/i);
  assert.match(server, /supabaseAdmin(?:!)?\.rpc\(['"]provision_primary_branch_for_new_tenant['"]/);
});
