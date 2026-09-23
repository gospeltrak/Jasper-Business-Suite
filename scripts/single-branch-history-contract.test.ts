import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationPath = new URL(
  '../supabase/migrations/20260915000100_single_branch_history_compatibility.sql',
  import.meta.url,
);

test('single physical branch includes legacy unassigned history', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(
    migration,
    /'includesUnassignedHistoricalRecords',\s*branch\.is_default or v_physical_count = 1/,
  );
  assert.match(migration, /branch\.tenant_id = v_tenant_id/);
  assert.match(migration, /private\.can_read_branch\(v_tenant_id, branch\.id\)/);
});
