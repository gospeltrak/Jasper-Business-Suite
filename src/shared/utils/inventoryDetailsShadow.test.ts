import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('scripts/sql/staging_extend_and_backfill_inventory_details.sql'), 'utf8');

describe('extended inventory JSON typed-table staging migration safety', () => {
  it('requires a verified staging marker and completion of basic inventory shadow import', () => {
    expect(sql).toContain("current_setting('app.orvix_inventory_backfill_permission', true)");
    expect(sql).toContain("'STAGING_ONLY_RESTORE_TESTED'");
    expect(sql).toContain('Base settings shadow backfill must be reconciled first');
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql.trimEnd()).toMatch(/No live read cutover/);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it('normalizes actual extended optional scalar fields without preserving JSON blobs', () => {
    for (const field of [
      'package_unit_price', 'whole_package_price', 'half_package_price',
      'package_buying_cost', 'fraction_sale_enabled', 'packet_price_overridden',
    ]) expect(sql).toContain(field);
    expect(sql).toContain('ALTER TABLE public.jasper_product_inventory_settings');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS legacy_option_id text');
    expect(sql).toContain('jasper_fraction_sale_options_tenant_product_legacy_option_uidx');
    expect(sql).toContain('INSERT INTO public.jasper_fraction_sale_options');
    expect(sql).toContain('INSERT INTO public.jasper_pharmacy_unit_breakdowns');
  });

  it('does not overwrite source_record or remove historical product and tenant data', () => {
    const runnable = sql.replace(/--[^\n]*/g, '');
    expect(runnable).not.toMatch(/(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|REINDEX|VACUUM|DISABLE\s+TRIGGER)/i);
    expect(runnable).not.toMatch(/UPDATE\s+(?:public\.)?products\b/i);
    expect(runnable).not.toMatch(/UPDATE\s+(?:public\.)?tenant_workspaces\b/i);
    expect(runnable).not.toMatch(/INSERT\s+INTO\s+(?:public\.)?tenant_data\b/i);
    expect(runnable).not.toMatch(/GRANT\b|REVOKE\b|DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(sql).toContain('p.source_active');
    expect(sql).toContain('p.legacy_id IS NOT NULL');
  });

  it('retains fractional unit identity, order, precision, and pharmacy breakdown integrity', () => {
    expect(sql).toContain('WITH ORDINALITY AS opt(value,ord)');
    expect(sql).toContain("opt.value->>'id'");
    expect(sql).toContain('(opt.ord-1)::integer');
    expect(sql).toContain('ON CONFLICT (tenant_id,product_id,legacy_option_id)');
    expect(sql).toContain('IS DISTINCT FROM round(');
    expect(sql).toContain('IS DISTINCT FROM');
    expect(sql).toContain('t.package_unit_price IS NOT NULL');
    expect(sql).toContain('bad_scalars<>0 OR bad_options<>0 OR bad_pharmacy<>0');
    expect(sql).toContain('RAISE EXCEPTION');
  });

  it('rejects missing and malformed nested options without silently dropping them', () => {
    expect(sql).toContain('malformed_options');
    expect(sql).toContain("jsonb_typeof(r.settings->'fractionSaleOptions') IS DISTINCT FROM 'array'");
    expect(sql).toContain("jsonb_typeof(opt.value->'id') IS DISTINCT FROM 'string'");
    expect(sql).toContain("jsonb_typeof(r.settings#>'{pharmacyUnitBreakdown,purchaseUnit}') IS DISTINCT FROM 'string'");
  });
});
