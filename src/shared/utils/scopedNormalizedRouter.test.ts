import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const migration=readFileSync(
  new URL('../../../supabase/migrations/20261026162000_scoped_single_collection_business_rpc.sql',import.meta.url),
  'utf8',
);

describe('Single-collection routing avoids full normalized workspace hydration', () => {
  it('keeps the old __all__ response path for compatibility', () => {
    expect(migration).toContain("if p_key='__all__' then");
    expect(migration).toMatch(/if p_key='__all__' then\s+v_payload:=public.get_current_branch_workspace\(\)->'payload'/);
    expect(migration).toContain("'products_map'");
    expect(migration).toContain("'sales_map'");
    expect(migration).toContain("'branch_stocks_map'");
  });
  it('reads each requested collection alone without materializing all ledgers', () => {
    expect(migration).toContain('private.scoped_normalized_business_collection(v_tenant,v_key)');
    expect(migration).toContain('private.normalized_business_snapshot(p_tenant,ARRAY[p_key])');
    expect(migration).toContain('private.get_current_branch_workspace_lightweight()');
    expect(migration).toContain('private.filter_branch_json_array(');
  });
  it('preserves every tenant, staff, branch and historical unassigned filter', () => {
    expect(migration).toContain('p_tenant is distinct from private.current_tenant_id()');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('private.normalized_writes_enabled(p_tenant)');
    expect(migration).toContain("v_scope='all_branches'");
    expect(migration).toContain("v_scope='compatibility_primary'");
    expect(migration).toContain("v_scope='branch'");
    expect(migration).toContain("'includesUnassignedHistoricalRecords'");
    expect(migration).toMatch(/else\s+return '\[\]'::jsonb/);
  });
  it('preserves all existing writes, merge semantics and tombstone logic', () => {
    const names=['save_current_branch_products','save_current_branch_sales',
      'save_current_branch_expenses','save_current_branch_deliveries',
      'save_current_branch_purchases','save_direct_pending_notes'];
    for(const n of names)expect(migration).toContain(n);
    expect(migration).toContain("if p_write then");
    expect(migration).toContain("v_key is null then raise exception");
  });
  it('contains no user-data mutations beyond the original existing RPC definitions', () => {
    const definition=migration.split("create or replace function private.scoped_normalized_business_collection")[0];
    expect(definition).not.toMatch(/\bdelete\s+from\b|\btruncate\s+table\b|\bdrop\s+table\b/i);
    expect(migration).not.toMatch(/^\s*(?:delete from|truncate|drop table|alter table|update public\.|insert into public\.)/mi);
    expect(migration).toContain('revoke all on function private.scoped_normalized_business_collection');
    expect(migration).toMatch(/set search_path = ''/);
  });
});
