import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql=readFileSync('supabase/migrations/20261026153000_nonbackup_tenant_key_index.sql','utf8');
test('Disk IO mitigation indexes only currently read non-backup keys',()=>{
  assert.match(sql,/create index if not exists tenant_data_active_keys_io_idx/i);
  assert.match(sql,/on public\.tenant_data \(tenant_id, data_key\)/i);
  assert.match(sql,/where data_key not like 'data_backup_%'/i);
  assert.match(sql,/and data_key not like 'workspace_backup_%'/i);
  assert.doesNotMatch(sql,/^\s*(?:delete|update|truncate|drop|alter|insert|vacuum|reindex)\s/mi);
  assert.doesNotMatch(sql,/grant\s|revoke\s|disable row level security/i);
});
