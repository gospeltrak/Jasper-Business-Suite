import type { Product } from '../../../types';

export type PharmacyHierarchySnapshot = Pick<Product,
  | 'productType'
  | 'pharmacyProductType'
  | 'pharmacyHierarchyStart'
  | 'pharmacyBaseUnit'
  | 'pharmacyUnitLevels'
  | 'dosesPerPacket'
  | 'tabsPerDose'
  | 'tabsPerPack'
  | 'packetPrice'
  | 'stripPrice'
  | 'fullDosePrice'
  | 'halfDosePrice'
  | 'tabPrice'
  | 'allowsDosageDividing'
  | 'pharmacyUnitBreakdown'
>;

const optionalFiniteNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export const getPharmacyHierarchySnapshot = (product: Partial<Product>): PharmacyHierarchySnapshot => ({
  productType: product.productType,
  pharmacyProductType: product.pharmacyProductType,
  pharmacyHierarchyStart: product.pharmacyHierarchyStart,
  pharmacyBaseUnit: product.pharmacyBaseUnit,
  pharmacyUnitLevels: (product.pharmacyUnitLevels || []).map(level => ({
    ...level,
    quantityToBaseUnit: Number(level.quantityToBaseUnit),
  })),
  dosesPerPacket: optionalFiniteNumber(product.dosesPerPacket),
  tabsPerDose: optionalFiniteNumber(product.tabsPerDose),
  tabsPerPack: optionalFiniteNumber(product.tabsPerPack),
  packetPrice: optionalFiniteNumber(product.packetPrice),
  stripPrice: optionalFiniteNumber(product.stripPrice),
  fullDosePrice: optionalFiniteNumber(product.fullDosePrice),
  halfDosePrice: optionalFiniteNumber(product.halfDosePrice),
  tabPrice: optionalFiniteNumber(product.tabPrice),
  allowsDosageDividing: product.allowsDosageDividing,
  pharmacyUnitBreakdown: product.pharmacyUnitBreakdown
    ? { ...product.pharmacyUnitBreakdown }
    : undefined,
});

// Database JSONB and client-side objects can have different property insertion orders.
// Compare canonical snapshots instead of raw JSON.stringify output. Preserve array
// order and actual values; only object key order is irrelevant.
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
};

export const pharmacyHierarchyMatches = (
  expected: Partial<Product>,
  persisted: Partial<Product> | null | undefined,
): boolean => !!persisted && JSON.stringify(canonicalize(getPharmacyHierarchySnapshot(expected)))
  === JSON.stringify(canonicalize(getPharmacyHierarchySnapshot(persisted)));
