import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('scripts/sql/staging_backfill_historical_inventory_batches.sql'), 'utf8');

describe('historical batches: staged typed normalization without stock loss', () => {
  it('requires isolated staging approval, base settings and one transaction', () => {
    expect(sql).toContain("current_setting('app.orvix_inventory_backfill_permission',true)");
    expect(sql).toContain("'STAGING_ONLY_RESTORE_TESTED'");
    expect(sql).toContain('Product inventory settings staging prerequisite has not passed');
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it('retains exact 15-place historical price-change percentages', () => {
    expect(sql).toContain('ALTER COLUMN price_change_percentage TYPE numeric');
    expect(sql).not.toMatch(/round\([^)]*priceChangePercentage/);
    expect(sql).toContain("(j->>'priceChangePercentage')::numeric");
    expect(sql).toContain("(e.j->>'priceChangePercentage')::numeric");
  });

  it('preserves product/batch identity, ordinals and quantity units', () => {
    expect(sql).toContain('legacy_batch_id text');
    expect(sql).toContain('source_product_id text');
    expect(sql).toContain('source_ordinal bigint');
    expect(sql).toContain('base_unit_explicit boolean');
    expect(sql).toContain('quantity_purchased_base numeric');
    expect(sql).toContain('quantity_remaining_base numeric');
    expect(sql).toContain('destination text');
    expect(sql).toContain('expiry_date timestamptz');
    expect(sql).toContain('manufacturing_date timestamptz');
    expect(sql).toContain('WITH ORDINALITY');
    expect(sql).toContain('jasper_inventory_batches_tenant_product_legacy_batch_uidx');
    expect(sql).toContain('ON CONFLICT (tenant_id,product_id,legacy_batch_id)');
  });

  it('converts historical weighted_average while preserving the raw source fields', () => {
    expect(sql).toContain("WHEN 'weighted_average' THEN 'average_price'");
    expect(sql).toContain("b.j->>'productId' IS DISTINCT FROM b.product_id");
    expect(sql).toContain('b.status IS DISTINCT FROM');
    expect(sql).toContain('b.price_change_percentage IS DISTINCT FROM');
    expect(sql).toContain('b.base_unit_explicit IS DISTINCT FROM');
    expect(sql).toContain('b.quantity_remaining_base IS DISTINCT FROM');
    expect(sql).toContain('Historical batch parity failed');
  });

  it('is non-destructive and avoids modifying any live business source', () => {
    const executable = sql.replace(/--[^\n]*/g, '');
    expect(executable).not.toMatch(/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|UPDATE\s+(?:public\.)?products|UPDATE\s+(?:public\.)?tenant_workspaces|ALTER\s+TABLE\s+public\.products|REINDEX|VACUUM|GRANT|REVOKE)\b/i);
    expect(executable).not.toMatch(/\bDISABLE\s+(?:TRIGGER|ROW\s+LEVEL\s+SECURITY)/i);
    expect(executable).toContain('INSERT INTO public.jasper_inventory_batches');
    expect(executable).toContain('p.source_active');
    expect(executable).toContain('p.legacy_id IS NOT NULL');
    expect(executable).not.toContain('tenant_data');
  });
});
