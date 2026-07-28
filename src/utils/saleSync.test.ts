import { describe, expect, it } from 'vitest';
import { saleHasTenantConflict } from './saleSync';

describe('sale tenant ownership compatibility', () => {
  it('allows a legacy sale without tenant metadata when it exists in the active tenant workspace', () => {
    const legacySale = { id: 'legacy-sale-1' } as any;
    expect(saleHasTenantConflict(legacySale, legacySale, 'tenant-a')).toBe(false);
  });

  it('accepts legacy snake-case tenant metadata for the active tenant', () => {
    const legacySale = { id: 'legacy-sale-2', tenant_id: 'tenant-a' } as any;
    expect(saleHasTenantConflict(legacySale, legacySale, 'tenant-a')).toBe(false);
  });

  it('blocks an explicitly conflicting tenant ID', () => {
    const foreignSale = { id: 'foreign-sale', tenantId: 'tenant-b' } as any;
    expect(saleHasTenantConflict(foreignSale, foreignSale, 'tenant-a')).toBe(true);
  });
});
