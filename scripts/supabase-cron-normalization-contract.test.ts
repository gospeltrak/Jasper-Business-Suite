import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260804001100_supabase_cron_workspace_normalization_worker.sql', import.meta.url);

test('Supabase Cron worker is private, tenant-gated, concurrent-safe and non-destructive', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create or replace function private\.process_workspace_normalization_queue/);
  assert.match(sql, /state\.dual_write_enabled/);
  assert.match(sql, /for update of outbox skip locked/);
  assert.match(sql, /validate_workspace_shadow_content/);
  assert.match(sql, /validate_branch_stock_shadow/);
  assert.match(sql, /revoke all on function private\.process_workspace_normalization_queue[\s\S]*service_role/);
  assert.match(sql, /'\*\/5 \* \* \* \*'/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(?:tenants|tenant_workspaces|products|sales|expenses|deliveries|purchases)/i);
  assert.doesNotMatch(sql, /truncate\s/i);
  assert.doesNotMatch(sql, /drop\s+table/i);
});
