import type { Product } from '../types';

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
  fullDosePrice: optionalFiniteNumber(product.fullDosePrice),
  halfDosePrice: optionalFiniteNumber(product.halfDosePrice),
  tabPrice: optionalFiniteNumber(product.tabPrice),
  allowsDosageDividing: product.allowsDosageDividing,
  pharmacyUnitBreakdown: product.pharmacyUnitBreakdown
    ? { ...product.pharmacyUnitBreakdown }
    : undefined,
});

export const pharmacyHierarchyMatches = (
  expected: Partial<Product>,
  persisted: Partial<Product> | null | undefined,
): boolean => !!persisted && JSON.stringify(getPharmacyHierarchySnapshot(expected)) === JSON.stringify(getPharmacyHierarchySnapshot(persisted));
