import { Product, UniversalPackageLevel } from '../types';
import { formatQuantity } from './unitFormatter';

// ─── Universal Inventory Unit & Packaging Engine — Stage 2 ─────────────────
// Package/Selling Unit <-> Base Unit conversion. A quantityInBaseUnit always
// belongs to one product's own packageLevels entry, never to a unit-name
// lookup shared across products (Wheat's "Sack" and Rice's "Sack" can and do
// carry different ratios).
//
// Every function here also transparently understands the two legacy shapes
// that existed before Stage 1 (pharmacy's pharmacyUnitLevels/
// pharmacyUnitBreakdown, and retail's flat purchaseUnit/conversionToBaseUnit)
// so every existing product keeps working without being touched, per the
// backward-compatibility rule: new structure present -> new engine, else ->
// legacy adapter.

/**
 * Resolves a product's package hierarchy, adapting legacy shapes into the
 * new UniversalPackageLevel[] form when packageLevels itself isn't set yet.
 */
export const resolvePackageLevels = (product: Product): UniversalPackageLevel[] => {
  if (product.packageLevels && product.packageLevels.length > 0) {
    return product.packageLevels;
  }

  // Legacy pharmacy multi-level hierarchy (Box -> Blister -> Tablet, etc.)
  if (product.pharmacyUnitLevels && product.pharmacyUnitLevels.length > 0) {
    return product.pharmacyUnitLevels
      .filter(level => level.quantityToBaseUnit > 0)
      .map(level => ({
        id: level.id,
        label: level.label || level.unit,
        quantityInBaseUnit: level.quantityToBaseUnit,
      }));
  }

  // Legacy pharmacy fixed breakdown (Box -> Strip -> Tablet only)
  const breakdown = product.inventorySettings?.pharmacyUnitBreakdown || product.pharmacyUnitBreakdown;
  if (breakdown && breakdown.stripsPerBox > 0 && breakdown.tabletsPerStrip > 0) {
    return [
      {
        id: 'legacy-purchase',
        label: breakdown.purchaseUnit,
        quantityInBaseUnit: breakdown.stripsPerBox * breakdown.tabletsPerStrip,
      },
      {
        id: 'legacy-strip',
        label: breakdown.stripUnit,
        quantityInBaseUnit: breakdown.tabletsPerStrip,
      },
    ];
  }

  // Legacy retail bulk-selling / single-level purchaseUnit -> baseUnit
  const purchaseUnit = product.inventorySettings?.purchaseUnit || product.purchaseUnit || product.bulkUnit;
  const conversion = product.inventorySettings?.conversionToBaseUnit || product.conversionToBaseUnit || product.bulkPurchaseQty;
  if (purchaseUnit && conversion && conversion > 1) {
    return [{ id: 'legacy-purchase', label: purchaseUnit, quantityInBaseUnit: conversion }];
  }

  return [];
};

/** The smallest tracked unit for this product -- what its stock quantity is counted in. */
export const getBaseUnitLabel = (product: Product): string => (
  product.inventorySettings?.baseUnit || product.baseUnit || product.pharmacyBaseUnit ||
  product.sellUnit || product.unit || 'Unit'
);

const orderedLevelsDescending = (levels: UniversalPackageLevel[]) => (
  [...levels]
    .filter(level => level.quantityInBaseUnit > 0)
    .sort((a, b) => b.quantityInBaseUnit - a.quantityInBaseUnit)
);

/** How many base units does `quantity` of the given package level represent. */
export const convertToBaseQuantity = (
  quantity: number,
  levelId: string | 'base',
  product: Product,
): number => {
  if (!levelId || levelId === 'base') return Number(quantity.toFixed(3));
  const level = resolvePackageLevels(product).find(candidate => candidate.id === levelId);
  if (!level) return Number(quantity.toFixed(3));
  return Number((quantity * level.quantityInBaseUnit).toFixed(3));
};

/** How many of the given package level does `baseQuantity` base units represent. */
export const convertFromBaseQuantity = (
  baseQuantity: number,
  levelId: string | 'base',
  product: Product,
): number => {
  if (!levelId || levelId === 'base') return Number(baseQuantity.toFixed(3));
  const level = resolvePackageLevels(product).find(candidate => candidate.id === levelId);
  if (!level || level.quantityInBaseUnit <= 0) return Number(baseQuantity.toFixed(3));
  return Number((baseQuantity / level.quantityInBaseUnit).toFixed(3));
};

export interface PackageEquivalentPart {
  levelId: string;
  label: string;
  qty: number;
}

/**
 * Breaks a base quantity down into the largest package levels first, e.g.
 * 237 base units of Amoxicillin (Box=100, Blister=10) -> 2 Box + 3 Blister +
 * 7 Capsule. Falls back to a single base-unit part for a plain single-unit
 * product (Nivea Lotion: just "N Bottle").
 */
export const getPackageEquivalent = (baseQuantity: number, product: Product): PackageEquivalentPart[] => {
  const levels = orderedLevelsDescending(resolvePackageLevels(product));
  let remaining = Number(Math.max(0, baseQuantity).toFixed(3));
  const parts: PackageEquivalentPart[] = [];

  for (const level of levels) {
    const qty = Math.floor(remaining / level.quantityInBaseUnit);
    if (qty > 0) {
      parts.push({ levelId: level.id, label: level.label, qty });
      remaining = Number((remaining - qty * level.quantityInBaseUnit).toFixed(3));
    }
  }

  if (remaining > 0.0001 || parts.length === 0) {
    parts.push({ levelId: 'base', label: getBaseUnitLabel(product), qty: remaining });
  }

  return parts;
};

/**
 * Human-readable stock breakdown for reports/inventory screens, e.g.
 * "2 Box + 3 Blister + 7 Capsule". Users never see the raw base-unit count.
 */
export const getDisplayStockBreakdown = (baseQuantity: number, product: Product): string => {
  const parts = getPackageEquivalent(baseQuantity, product);
  return parts
    .map(part => formatQuantity(part.qty, part.label))
    .join(' + ');
};

/** Validates a proposed package-level chain before it's saved on a product. */
export const validateUnitHierarchy = (levels: UniversalPackageLevel[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  levels.forEach((level, index) => {
    const name = level.label?.trim() || `Package level ${index + 1}`;
    if (!level.label || !level.label.trim()) {
      errors.push(`Package level ${index + 1} is missing a name.`);
    }
    if (!(level.quantityInBaseUnit > 0)) {
      errors.push(`"${name}" must contain more than 0 base units.`);
    }
  });

  const ids = levels.map(level => level.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('Package levels must have unique identifiers.');
  }

  return { valid: errors.length === 0, errors };
};

/** The cost of one base unit, derived from what a package of it cost to buy. */
export const calculateBaseCost = (packageCost: number, levelId: string | 'base', product: Product): number => {
  if (!levelId || levelId === 'base') return Number(packageCost.toFixed(4));
  const level = resolvePackageLevels(product).find(candidate => candidate.id === levelId);
  if (!level || level.quantityInBaseUnit <= 0) return Number(packageCost.toFixed(4));
  return Number((packageCost / level.quantityInBaseUnit).toFixed(4));
};
