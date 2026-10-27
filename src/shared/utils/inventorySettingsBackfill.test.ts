import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSql = (name: string) => readFileSync(resolve('scripts/sql', name), 'utf8');
const backfill = readSql('staging_backfill_product_inventory_settings.sql');
const preflight = readSql('read_only_product_inventory_preflight.sql');

describe('JSON-to-typed inventory settings backfill contract', () => {
  it('fails closed without explicit staging approval or on malformed data', () => {
    expect(backfill).toMatch(/current_setting\('app\.orvix_inventory_backfill_permission', true\)/);
    expect(backfill).toMatch(/IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED'/);
    expect(backfill).toContain('RAISE EXCEPTION');
    expect(backfill).toContain('v_invalid <> 0');
    expect(backfill).toContain('v_missing_or_mismatched <> 0');
    expect(backfill).toMatch(/COMMIT;/);
    expect(preflight).toContain('BEGIN TRANSACTION READ ONLY;');
  });

  it('copies only active product inventory settings into the existing normalized target', () => {
    expect(backfill).toContain('INSERT INTO public.jasper_product_inventory_settings');
    expect(backfill).toContain('FROM public.products AS p');
    expect(backfill).toContain('p.source_active');
    expect(backfill).toContain('p.legacy_id IS NOT NULL');
    expect(backfill).toContain("jsonb_typeof(p.source_record->'inventorySettings') = 'object'");
    expect(backfill).toContain('ON CONFLICT (tenant_id, product_id) DO NOTHING');
    expect(backfill).toContain('IS DISTINCT FROM');
    expect(backfill).toContain('LEFT JOIN public.jasper_product_inventory_settings');
  });

  it('never alters source JSON, deletes a customer row, or disables database protections', () => {
    const runnable = backfill.replace(/--[^\n]*/g, '');
    expect(runnable).not.toMatch(/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|ALTER\s+TABLE|UPDATE\s+public\.|REINDEX|VACUUM)\b/i);
    expect(runnable).not.toMatch(/DISABLE\s+(?:ROW\s+LEVEL\s+SECURITY|TRIGGER)/i);
    expect(runnable).not.toContain('UPDATE SET');
    expect(runnable).not.toContain('tenant_data');
    expect(preflight).not.toMatch(/\b(?:INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i);
  });

  it('keeps exact legacy method while normalizing only the typed shadow column', () => {
    expect(backfill).toContain("WHEN 'weighted_average' THEN 'average_price'");
    expect(preflight).toContain("WHEN 'weighted_average' THEN 'average_price'");
    expect(backfill).toContain("round((p.source_record#>>'{inventorySettings,conversionToBaseUnit}')::numeric, 6)");
    expect(backfill).toContain("round((p.source_record#>>'{inventorySettings,defaultPricePerBaseUnit}')::numeric, 2)");
    expect(backfill).toContain('tgt.default_price_per_base_unit IS DISTINCT FROM');
  });
});
