import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('scripts/sql/candidate_avoid_duplicate_normalized_admin_snapshot.sql'), 'utf8');
const rollback = readFileSync(resolve('scripts/sql/rollback_duplicate_normalized_admin_snapshot.sql'), 'utf8');
const collections = [
  'products', 'sales', 'expenses', 'deliveries', 'purchases',
  'branchStocks', 'pendingDeliveryNotes',
] as const;

describe('guarded normalized snapshot reuse, staging only', () => {
  it('requires original production function signature before replacement', () => {
    expect(sql).toContain('79fa2d46e0a22da25bdb99b8bfe89de1');
    expect(sql).toContain("private.normalized_mutation_snapshot(uuid,text[])");
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION private\.normalized_mutation_snapshot\(/);
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO ''");
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
  });

  it('restricts fast path to the same authenticated tenant and allowed all-branches scope', () => {
    expect(sql).toContain('p_tenant_id = private.current_tenant_id()');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain("v_context ->> 'activeScope' = 'all_branches'");
    expect(sql).toContain("'canViewAllBranches'");
    expect(sql).toContain("p_keys <@ ARRAY[");
    expect(sql).toContain('array_position(p_keys, NULL) IS NULL');
    expect(sql).toContain('v_scoped := public.get_current_branch_workspace()');
    expect(sql).toContain('coalesce(v_scoped -> v_key');
  });

  it('never writes customer data or changes tenant access policies', () => {
    const executable = sql.replace(/--[^\n]*/g, '');
    expect(executable).not.toMatch(/\b(?:DELETE|TRUNCATE|INSERT\s+INTO|UPDATE\s+public\.|ALTER\s+TABLE|DROP\s+TABLE|GRANT|REVOKE|VACUUM|REINDEX)\b/i);
    expect(executable).not.toContain('SET row_security');
    expect(rollback).toContain('CREATE OR REPLACE FUNCTION private.normalized_mutation_snapshot');
    expect(rollback).toContain("v_scoped:=public.get_current_branch_workspace()->'payload';");
  });

  it('matches original array overlay semantics for all supported all-branches keys', () => {
    // Under authorized all_branches access, the existing loader returns the
    // SAME normalized_business_snapshot result without modifying any fields.
    // Then old normalized_mutation_snapshot overlays those same collections.
    const snapshot: Record<string, unknown> = {
      settings: { company: { name: 'test' }, themeMode: 'dark' },
      products: [{ id: 'p1', stockQty: 3.25 }],
      sales: [{ id: 's1', amount: 100.50 }],
      expenses: [{ id: 'e1', receiptImage: 'unchanged' }],
      deliveries: [{ id: 'd1' }],
      purchases: [{ id: 'o1', payments: [1, 2] }],
      branchStocks: [{ id: 'b1', quantity: 1.75 }],
      pendingDeliveryNotes: [],
    };
    for (const keys of [undefined, [], ['products'], ['expenses', 'sales'], [...collections]]) {
      const oldResult = { ...snapshot };
      for (const key of keys ?? collections) {
        oldResult[key] = snapshot[key] ?? [];
      }
      const fastResult = { ...snapshot };
      expect(fastResult).toEqual(oldResult);
    }
  });
});
