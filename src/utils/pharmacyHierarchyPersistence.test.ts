import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { getPharmacyHierarchySnapshot, pharmacyHierarchyMatches } from './pharmacyHierarchyPersistence';
import { mergeProductsForSync } from '../modules/products/utils/productSync';

const medicine = (overrides: Partial<Product> = {}): Product => ({
  id: 'medicine-1', name: 'Panadol', category: 'Medicine', unit: 'Tablet',
  barcode: '1001', sku: 'PAN-1', costPrice: 100, sellingPrice: 250,
  stockQty: 100, shopStockQty: 100, storeStockQty: 0, alertQty: 5,
  productType: 'medicine', pharmacyProductType: 'pharmaceutical',
  pharmacyHierarchyStart: 'packet', pharmacyBaseUnit: 'Tablet',
  pharmacyUnitLevels: [
    { id: 'packet', label: 'Packet / Strip', unit: 'Packet', quantityToBaseUnit: 20 },
    { id: 'dose', label: 'Dose', unit: 'Dose', quantityToBaseUnit: 10 },
    { id: 'tabs', label: 'Tablet', unit: 'Tablet', quantityToBaseUnit: 1 },
  ],
  dosesPerPacket: 2, tabsPerDose: 10, tabsPerPack: 20,
  packetPrice: 5000, fullDosePrice: 2500, halfDosePrice: 1250, tabPrice: 250,
  allowsDosageDividing: true,
  pharmacyUnitBreakdown: {
    purchaseUnit: 'Packet', stripUnit: 'Dose', baseUnit: 'Tablet',
    stripsPerBox: 2, tabletsPerStrip: 10,
  },
  ...overrides,
});

describe('pharmacy hierarchy persistence', () => {
  it('keeps exact hierarchy values through save, refetch and edit-form hydration', () => {
    const submitted = medicine();
    const refetched = JSON.parse(JSON.stringify(submitted)) as Product;
    const hydrated = { ...refetched };

    expect(getPharmacyHierarchySnapshot(refetched)).toEqual(getPharmacyHierarchySnapshot(submitted));
    expect(pharmacyHierarchyMatches(submitted, hydrated)).toBe(true);
  });

  it('does not let a delayed stale autosave overwrite a newer manual hierarchy save', () => {
    const stale = medicine({
      dosesPerPacket: 1,
      tabsPerDose: 1,
      tabsPerPack: 1,
      syncUpdatedAt: '2026-08-28T07:00:00.000Z',
      updatedAt: '2026-08-28T07:00:00.000Z',
    });
    const manual = medicine({
      syncUpdatedAt: '2026-08-28T07:01:00.000Z',
      updatedAt: '2026-08-28T07:01:00.000Z',
    });

    const merged = mergeProductsForSync([stale], [manual]);
    expect(pharmacyHierarchyMatches(manual, merged[0])).toBe(true);
    expect(merged[0].tabsPerDose).toBe(10);
  });
});
