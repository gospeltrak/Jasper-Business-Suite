import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Prisma adoption preserves Supabase tenant and financial safety boundaries', () => {
  const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../prisma.config.ts', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const guide = readFileSync(new URL('../docs/prisma-supabase-adoption.md', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../src/server/prisma.ts', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../src/server/workspaceNormalizationWorker.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.match(pkg, /"prisma":\s*"7\.9\.1"/);
  assert.match(pkg, /"@prisma\/client":\s*"7\.9\.1"/);
  assert.match(pkg, /"@prisma\/adapter-pg":\s*"7\.9\.1"/);
  assert.match(config, /process\.env\.DIRECT_URL[\s\S]+process\.env\.DATABASE_URL/);
  assert.match(schema, /model WorkspaceMigrationState/);
  assert.match(schema, /provider\s*=\s*"prisma-client-js"/);
  assert.match(runtime, /from '@prisma\/client'/);
  assert.doesNotMatch(schema, /model (Sale|Expense|TreasuryJournal|User)\b/);
  assert.match(guide, /without `BYPASSRLS`/);
  assert.match(guide, /financial mutations in the existing atomic RPCs/);
  assert.match(runtime, /process\.env\.DATABASE_URL/);
  assert.match(runtime, /max:\s*2/);
  assert.match(runtime, /__orvixPrisma/);
  assert.doesNotMatch(runtime, /VITE_/);
  assert.doesNotMatch(pkg, /prisma (migrate reset|db push)/);
  assert.match(pkg, /"lint:prisma-server"/);
  assert.match(pkg, /"verify:deploy":\s*"[^"]*lint:prisma-server/);
  assert.match(worker, /for update of outbox skip locked/i);
  assert.match(worker, /normalize_workspace_snapshot/);
  assert.match(worker, /reconcile_workspace_normalization/);
  assert.match(worker, /validate_workspace_shadow_content/);
  assert.doesNotMatch(worker, /delete\s+from/i);
  assert.match(server, /process\.env\.CRON_SECRET/);
  assert.match(server, /safeSecretEquals\(authorization, `Bearer \$\{cronSecret\}`\)/);
});
