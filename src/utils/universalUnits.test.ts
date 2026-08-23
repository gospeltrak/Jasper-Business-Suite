import { describe, expect, it } from 'vitest';
import { Product } from '../types';
import {
  calculateBaseCost,
  convertFromBaseQuantity,
  convertToBaseQuantity,
  getDisplayStockBreakdown,
  getPackageEquivalent,
  resolvePackageLevels,
  validateUnitHierarchy,
} from './universalUnits';

const baseProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Test Product',
  sku: 'SKU-1',
  barcode: '000',
  category: 'General',
  costPrice: 0,
  sellingPrice: 0,
  stockQty: 0,
  shopStockQty: 0,
  storeStockQty: 0,
  alertQty: 0,
  ...overrides,
});

describe('resolvePackageLevels', () => {
  it('prefers the new packageLevels structure when present', () => {
    const product = baseProduct({
      packageLevels: [{ id: 'box', label: 'Box', quantityInBaseUnit: 100 }],
    });
    expect(resolvePackageLevels(product)).toEqual([{ id: 'box', label: 'Box', quantityInBaseUnit: 100 }]);
  });

  it('adapts the legacy pharmacyUnitLevels hierarchy', () => {
    const product = baseProduct({
      pharmacyUnitLevels: [
        { id: 'box', label: 'Box', unit: 'box', quantityToBaseUnit: 100 },
        { id: 'blister', label: 'Blister', unit: 'blister', quantityToBaseUnit: 10 },
      ],
    });
    expect(resolvePackageLevels(product)).toEqual([
      { id: 'box', label: 'Box', quantityInBaseUnit: 100 },
      { id: 'blister', label: 'Blister', quantityInBaseUnit: 10 },
    ]);
  });

  it('adapts the legacy pharmacyUnitBreakdown (Box -> Strip -> Tablet)', () => {
    const product = baseProduct({
      pharmacyUnitBreakdown: { purchaseUnit: 'Box', stripUnit: 'Strip', baseUnit: 'Tablet', stripsPerBox: 10, tabletsPerStrip: 10 },
    });
    const levels = resolvePackageLevels(product);
    expect(levels).toEqual([
      { id: 'legacy-purchase', label: 'Box', quantityInBaseUnit: 100 },
      { id: 'legacy-strip', label: 'Strip', quantityInBaseUnit: 10 },
    ]);
  });

  it('adapts the legacy retail single-level purchaseUnit/conversionToBaseUnit', () => {
    const wheat = baseProduct({ purchaseUnit: 'Sack', conversionToBaseUnit: 25, baseUnit: 'Kg' });
    const rice = baseProduct({ purchaseUnit: 'Sack', conversionToBaseUnit: 100, baseUnit: 'Kg' });
    expect(resolvePackageLevels(wheat)).toEqual([{ id: 'legacy-purchase', label: 'Sack', quantityInBaseUnit: 25 }]);
    expect(resolvePackageLevels(rice)).toEqual([{ id: 'legacy-purchase', label: 'Sack', quantityInBaseUnit: 100 }]);
  });

  it('returns an empty chain for a plain single-unit product with no packaging configured', () => {
    const nivea = baseProduct({ unit: 'Bottle' });
    expect(resolvePackageLevels(nivea)).toEqual([]);
  });
});

describe('convertToBaseQuantity / convertFromBaseQuantity', () => {
  const amoxicillin = baseProduct({
    baseUnit: 'Capsule',
    packageLevels: [
      { id: 'box', label: 'Box', quantityInBaseUnit: 100 },
      { id: 'blister', label: 'Blister', quantityInBaseUnit: 10 },
    ],
  });

  it('converts a package quantity up to base units', () => {
    expect(convertToBaseQuantity(2, 'box', amoxicillin)).toBe(200);
    expect(convertToBaseQuantity(3, 'blister', amoxicillin)).toBe(30);
    expect(convertToBaseQuantity(7, 'base', amoxicillin)).toBe(7);
  });

  it('converts base units back down to a package quantity', () => {
    expect(convertFromBaseQuantity(200, 'box', amoxicillin)).toBe(2);
    expect(convertFromBaseQuantity(30, 'blister', amoxicillin)).toBe(3);
  });

  it('round-trips fractional retail quantities safely (Wheat: Sack = 25 Kg)', () => {
    const wheat = baseProduct({ baseUnit: 'Kg', packageLevels: [{ id: 'sack', label: 'Sack', quantityInBaseUnit: 25 }] });
    expect(convertToBaseQuantity(0.5, 'base', wheat)).toBe(0.5);
    expect(convertToBaseQuantity(1, 'sack', wheat)).toBe(25);
    expect(convertFromBaseQuantity(12.5, 'sack', wheat)).toBe(0.5);
  });
});

describe('getPackageEquivalent / getDisplayStockBreakdown', () => {
  const amoxicillin = baseProduct({
    baseUnit: 'Capsule',
    packageLevels: [
      { id: 'box', label: 'Box', quantityInBaseUnit: 100 },
      { id: 'blister', label: 'Blister', quantityInBaseUnit: 10 },
    ],
  });

  it('breaks 237 base units into 2 Box + 3 Blister + 7 Capsule', () => {
    expect(getPackageEquivalent(237, amoxicillin)).toEqual([
      { levelId: 'box', label: 'Box', qty: 2 },
      { levelId: 'blister', label: 'Blister', qty: 3 },
      { levelId: 'base', label: 'Capsule', qty: 7 },
    ]);
    expect(getDisplayStockBreakdown(237, amoxicillin)).toBe('2 Box + 3 Blister + 7 Capsule');
  });

  it('never confuses two products that both use the label "Sack"', () => {
    const wheat = baseProduct({ baseUnit: 'Kg', packageLevels: [{ id: 'sack', label: 'Sack', quantityInBaseUnit: 25 }] });
    const rice = baseProduct({ baseUnit: 'Kg', packageLevels: [{ id: 'sack', label: 'Sack', quantityInBaseUnit: 100 }] });
    expect(getDisplayStockBreakdown(30, wheat)).toBe('1 Sack + 5 Kg');
    expect(getDisplayStockBreakdown(30, rice)).toBe('30 Kg');
    expect(getDisplayStockBreakdown(250, rice)).toBe('2 Sack + 50 Kg');
  });

  it('shows a plain single-unit product as just its base unit, no packaging noise', () => {
    const nivea = baseProduct({ unit: 'Bottle' });
    expect(getDisplayStockBreakdown(14, nivea)).toBe('14 Bottle');
  });
});

describe('validateUnitHierarchy', () => {
  it('accepts a well-formed chain', () => {
    const result = validateUnitHierarchy([
      { id: 'box', label: 'Box', quantityInBaseUnit: 100 },
      { id: 'blister', label: 'Blister', quantityInBaseUnit: 10 },
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a package level with zero or negative base quantity', () => {
    const result = validateUnitHierarchy([{ id: 'box', label: 'Box', quantityInBaseUnit: 0 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must contain more than 0 base units');
  });

  it('rejects a package level missing a name', () => {
    const result = validateUnitHierarchy([{ id: 'box', label: '', quantityInBaseUnit: 100 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('missing a name');
  });

  it('rejects duplicate package level identifiers', () => {
    const result = validateUnitHierarchy([
      { id: 'box', label: 'Box', quantityInBaseUnit: 100 },
      { id: 'box', label: 'Carton', quantityInBaseUnit: 500 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('unique identifiers'))).toBe(true);
  });
});

describe('calculateBaseCost', () => {
  it('derives per-capsule cost from a box purchase (Box=100 capsules, cost 20,000)', () => {
    const amoxicillin = baseProduct({
      packageLevels: [{ id: 'box', label: 'Box', quantityInBaseUnit: 100 }],
    });
    expect(calculateBaseCost(20000, 'box', amoxicillin)).toBe(200);
  });

  it('derives per-kg cost from a sack purchase, correctly different for Wheat vs Rice', () => {
    const wheat = baseProduct({ packageLevels: [{ id: 'sack', label: 'Sack', quantityInBaseUnit: 25 }] });
    const rice = baseProduct({ packageLevels: [{ id: 'sack', label: 'Sack', quantityInBaseUnit: 100 }] });
    expect(calculateBaseCost(50000, 'sack', wheat)).toBe(2000);
    expect(calculateBaseCost(200000, 'sack', rice)).toBe(2000);
  });

  it('returns the cost unchanged when already expressed per base unit', () => {
    const product = baseProduct();
    expect(calculateBaseCost(400, 'base', product)).toBe(400);
  });
});
