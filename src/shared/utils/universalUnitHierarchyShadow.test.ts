import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('scripts/sql/staging_backfill_universal_product_units.sql'), 'utf8');

describe('universal product unit hierarchy: guarded typed staging backfill', () => {
  it('creates three real relational tables, not another JSONB blob', () => {
    for (const table of [
      'orvix_product_package_levels',
      'orvix_product_selling_units',
      'orvix_product_pharmacy_levels',
    ]) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.' + table);
      expect(sql).toContain('INSERT INTO public.' + table);
      expect(sql).toContain('ALTER TABLE public.' + table + ' ENABLE ROW LEVEL SECURITY');
      expect(sql).toContain('ALTER TABLE public.' + table + ' FORCE ROW LEVEL SECURITY');
      expect(sql).toContain('REVOKE ALL ON public.' + table + ' FROM PUBLIC,anon,authenticated');
      expect(sql).toContain('GRANT SELECT ON public.' + table + ' TO authenticated');
    }
    expect(sql).not.toMatch(/(?:\bsource_record jsonb\b|\bpayload jsonb\b)/);
    expect(sql).toMatch(/current_setting\('app\.orvix_inventory_backfill_permission',true\)/);
    expect(sql).toContain('STAGING_ONLY_RESTORE_TESTED');
  });

  it('preserves unique legacy IDs, level order and per-tenant partitioning', () => {
    expect(sql).toContain('legacy_level_id text NOT NULL');
    expect(sql).toContain('legacy_unit_id text NOT NULL');
    expect(sql).toContain('tenant_id text NOT NULL');
    expect(sql).toContain('sort_order integer NOT NULL');
    expect(sql.match(/WITH ORDINALITY/g)?.length).toBeGreaterThanOrEqual(6);
    expect(sql.match(/ON CONFLICT \(tenant_id,product_id,/g)?.length).toBe(3);
    expect(sql).toContain("unit_item.value->>'packageLevelId'");
    expect(sql).toContain('Selling units reference % missing package levels.');
    expect(sql).toContain('duplicate_keys');
  });

  it('rejects malformed arrays, invalid unit quantities and unsafe shadow mismatches', () => {
    expect(sql).toContain('Malformed unit-level source arrays');
    expect(sql).toContain("jsonb_typeof(x.item->'id') IS DISTINCT FROM 'string'");
    expect(sql).toContain("jsonb_typeof(x.item->'quantityInBaseUnit') IS DISTINCT FROM 'number'");
    expect(sql).toContain("jsonb_typeof(x.item->'quantityToBaseUnit') IS DISTINCT FROM 'number'");
    expect(sql).toContain('Unit level validation failed');
    expect(sql).toContain('Unit hierarchy packageLevels shadow mismatch');
    expect(sql).toContain('Unit hierarchy sellingUnits shadow mismatch');
    expect(sql).toContain('Unit hierarchy pharmacyUnitLevels shadow mismatch');
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it('uses explicit tenant RLS instead of granting anonymous or public access', () => {
    expect(sql.match(/FOR SELECT TO authenticated USING \(tenant_id=private\.current_tenant_id\(\)::text\)/g)?.length).toBe(3);
    expect(sql).not.toMatch(/GRANT\s+ALL\s+ON|GRANT\s+SELECT\s+ON[^;]+TO\s+anon/i);
    const sourceEdits = sql.replace(/--[^\n]*/g, '');
    expect(sourceEdits).not.toMatch(/\b(?:UPDATE|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|ALTER\s+TABLE\s+public\.products|DISABLE\s+ROW\s+LEVEL\s+SECURITY)\b/i);
  });
});
