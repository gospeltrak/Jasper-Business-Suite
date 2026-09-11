import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../supabase/migrations/20260812000100_verified_normalized_workspace_reads.sql', import.meta.url), 'utf8');
const paginatedSql = readFileSync(new URL('../supabase/migrations/20260814000300_paginated_normalized_workspace_reads.sql', import.meta.url), 'utf8');
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
  assert.match(client, /rpc\('get_current_branch_workspace_bootstrap_v3'\)/);
  assert.match(client, /rpc\('get_current_branch_workspace_v2'\)/);
  assert.match(client, /rpc\('get_current_branch_workspace'\)/);
});

test('normalized ledger pages use bounded server-side cursor pagination', () => {
  for (const contract of [
    /get_current_branch_workspace_page/,
    /least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/,
    /row_data\."timestamp" < \$5/,
    /row_data\."timestamp" = \$5 and row_data\.id > \$6/,
    /limit \$7/,
    /v_page_size \+ 1/,
    /'hasMore'/,
    /'nextCursor'/,
  ]) assert.match(paginatedSql, contract);
});

test('paginated reads are tenant/branch scoped and normalized-only', () => {
  for (const contract of [
    /private\.current_tenant_id\(\)/,
    /public\.get_current_branch_context\(\)/,
    /row_data\.tenant_id = \$1/,
    /row_data\.branch_id = \$3/,
    /workspace_normalized_reads_ready/,
    /workspace_normalization_outbox/,
    /'legacy_fallback'/,
    /case p_collection[\s\S]*when 'sales'[\s\S]*when 'expenses'[\s\S]*when 'deliveries'[\s\S]*when 'purchases'/,
    /Unsupported workspace collection/,
    /revoke all on function public\.get_current_branch_workspace_page/,
  ]) assert.match(paginatedSql, contract);
});

test('normalized tables drive filtering and JSONB remains a compatibility representation', () => {
  assert.match(paginatedSql, /filtering, ordering and pagination use normalized columns/);
  assert.match(paginatedSql, /row_data\."timestamp" as sort_time, row_data\.source_record/);
  assert.match(paginatedSql, /expenses_tenant_time_idx/);
  assert.match(paginatedSql, /deliveries_tenant_time_idx/);
  assert.match(paginatedSql, /purchases_tenant_time_idx/);
});

test('v3 bootstrap omits paginated ledgers only after normalized verification', () => {
  assert.match(paginatedSql, /get_current_branch_workspace_bootstrap_v3/);
  assert.match(paginatedSql, /workspace_normalized_reads_ready\(v_tenant_id\)/);
  assert.match(paginatedSql, /return public\.get_current_branch_workspace_v2\(\)/);
  for (const collection of ['sales', 'expenses', 'deliveries', 'purchases']) {
    assert.match(paginatedSql, new RegExp(`'${collection}',\\s*'\\[\\]'::jsonb`));
  }
});

test('client batches normalized page reads and preserves the full ledger set', () => {
  assert.match(client, /PAGINATED_WORKSPACE_COLLECTIONS/);
  assert.match(client, /WORKSPACE_PAGE_SIZE = 1000/);
  assert.match(client, /Promise\.all\(pending\.map/);
  assert.match(client, /mergePageRecords/);
  assert.match(client, /page\.hasMore && page\.nextCursor/);
  assert.match(client, /fallbackRequired/);
  assert.match(client, /payload = \{ \.\.\.payload, \.\.\.ledgers \}/);
});
