import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const base = readFileSync('supabase/migrations/20261024051602_normalized_login_retains_nonbusiness_configuration.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20261026145000_legacy_all_single_json_merge.sql', 'utf8');
const marker = 'CREATE OR REPLACE FUNCTION public.route_current_branch_business_data(';
const getFunction = (s: string) => {
  const start = s.indexOf(marker);
  const end = s.indexOf('$function$', start + marker.length);
  if (start < 0 || end < 0) throw new Error('The secured legacy route definition must exist');
  return s.slice(start, end + '$function$'.length);
};
const oldBody = getFunction(base);
const newBody = getFunction(migration);

describe('Non-destructive normalized legacy __all__ JSON merge', () => {
  it('changes only the JSONB map-concatenation block, keeping every role/write guard identical', () => {
    const first = "   v_result:=v_result||v_payload;";
    const last = " else\n   v_result:=case when p_key like";
    const a = oldBody.indexOf(first), b = oldBody.indexOf(last,a);
    const c = newBody.indexOf("   -- Build legacy map aliases", a);
    const d = newBody.indexOf(last,c);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(0);
    expect(d).toBeGreaterThan(c);
    expect(newBody.slice(0,c)).toBe(oldBody.slice(0,a));
    expect(newBody.slice(d)).toBe(oldBody.slice(b));
  });

  it('preserves all historical aliases and their source collections', () => {
    const map: Record<string,string> = {
      products_map:'products', sales_map:'sales', expenses_map:'expenses',
      deliveries_map:'deliveries', purchases_map:'purchases',
      pendingDeliveryNotes_map:'pendingDeliveryNotes', branchStocks_map:'branchStocks',
      pending_delivery_notes_map:'pendingDeliveryNotes', branch_stocks_map:'branchStocks',
    };
    for (const [alias, key] of Object.entries(map)) {
      expect(newBody).toContain(`'${alias}', jsonb_build_object(v_tenant::text,coalesce(v_payload->'${key}','[]'::jsonb))`);
    }
  });

  it('retains all existing authentication, scope and data-protection clauses', () => {
    for (const clause of [
      "private.current_tenant_id()",
      "(select auth.uid()) is null",
      "private.normalized_writes_enabled(v_tenant)",
      "public.get_current_branch_workspace()->'payload'",
      "private.legacy_business_data_key(data_key) is null",
      "data_key not like 'workspace_backup_%'",
      "data_key not like 'data_backup_%'",
      "if p_write then",
      "when 'products' then",
      "when 'sales' then",
    ]) {
      expect(newBody).toContain(clause);
    }
  });

  it('makes no schema or data mutations during deployment outside replacing the function', () => {
    const prefix = migration.slice(0,migration.indexOf(marker));
    const suffix = migration.slice(migration.lastIndexOf('$function$')+'$function$'.length);
    expect(prefix).toMatch(/begin;/);
    expect(suffix).toMatch(/commit;/);
    for (const nonDestructiveSql of [prefix.replace(/^--.*$/gm,''), suffix.replace(/^--.*$/gm,'')]) {
      expect(nonDestructiveSql).not.toMatch(/\b(?:delete\s+from|truncate\s+table|drop\s+table|update\s+public|insert\s+into)\b/i);
    }
  });
});
