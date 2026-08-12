import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../supabase/migrations/20260812000100_verified_normalized_workspace_reads.sql', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/utils/tenantWorkspace.ts', import.meta.url), 'utf8');

test('normalized reads are verified, scoped, and reversible', () => {
  for (const contract of [
    /private\.current_tenant_id\(\)/, /read_mode <> 'normalized'/, /legacy_fallback/,
    /validate_workspace_shadow_content/, /validate_branch_stock_shadow/,
    /workspace_normalization_outbox/, /legacy_id is not null/,
    /rollback_workspace_normalized_read/, /read_mode\s*=\s*'legacy'/,
    /revoke all on function private\.rollback_workspace_normalized_read/,
  ]) assert.match(sql, contract);
});

test('client prefers v2 and retains the established fallback', () => {
  assert.match(client, /rpc\('get_current_branch_workspace_v2'\)/);
  assert.match(client, /rpc\('get_current_branch_workspace'\)/);
});
