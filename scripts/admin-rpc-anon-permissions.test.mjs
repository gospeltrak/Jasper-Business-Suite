import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261108120000_lock_admin_rpc_anon_and_timestamp_search_path.sql','utf8');
test('timestamp trigger cannot inherit mutable search path', () => {
  assert.match(sql, /ALTER FUNCTION public\.set_updated_at\(\) SET search_path = '';/i);
});
test('anonymous callers lose EXECUTE for admin-only functions', () => {
  const funcs = [
    'configure_multibranch_rollout\\(boolean, text\\)',
    'configure_tenant_branch_capacity\\(uuid, integer, boolean, text\\)',
    'create_affiliate_commission_from_revenue\\(uuid, numeric, uuid, date, date\\)',
  ];
  for (const func of funcs) {
    assert.match(sql, new RegExp('REVOKE EXECUTE ON FUNCTION public\\.' + func + '\\s+FROM PUBLIC, anon;', 'i'));
  }
  assert.doesNotMatch(sql, /\\b(?:TRUNCATE|DROP|DELETE FROM|UPDATE public\\.)\\b|GRANT\\s+USAGE\\s+ON\\s+SCHEMA/i);
});
