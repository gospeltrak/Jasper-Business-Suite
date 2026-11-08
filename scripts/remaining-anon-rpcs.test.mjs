import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261108130000_restrict_remaining_anonymous_definer_rpcs.sql', 'utf8');
test('remaining tenant and affiliate definer RPCs are not anonymously executable', () => {
  const names = [
    'activate_current_tenant_primary_branch', 'complete_affiliate_task',
    'convert_cross_branch_document_to_sales', 'create_cross_branch_commercial_document',
    'create_current_tenant_branch', 'end_user_session', 'get_current_branch_context',
    'get_current_branch_entitlement', 'list_cross_branch_document_sources',
    'list_current_user_branches', 'record_affiliate_activity',
    'record_partner_affiliate_action', 'select_current_branch',
    'touch_user_session', 'update_cross_branch_commercial_document',
    'update_current_sales_document'
  ];
  for (const name of names) assert.ok(sql.includes("'" + name + "'"), name);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon/);
  assert.match(sql, /n\.nspname = 'public'/);
  assert.match(sql, /p\.prosecdef/);
  assert.match(sql, /pg_get_function_identity_arguments\(p\.oid\)/);
  assert.doesNotMatch(sql, /\b(?:TRUNCATE|DROP|DELETE FROM|ALTER TABLE)\b/i);
});
