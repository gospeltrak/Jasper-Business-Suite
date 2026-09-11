import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { resolvePharmacyPosLine } from './pharmacyPosPricing';

const panadol: Product = {
  id: 'panadol',
  name: 'Panadol',
  sku: 'PAN-1',
  barcode: '001',
  category: 'Medicine',
  costPrice: 100,
  sellingPrice: 250,
  stockQty: 200,
  shopStockQty: 200,
  storeStockQty: 0,
  alertQty: 10,
  pharmacyBaseUnit: 'Tablet',
  pharmacyUnitLevels: [
    { id: 'packet', label: 'Packet / Strip', unit: 'Strip', quantityToBaseUnit: 20 },
    { id: 'dose', label: 'Dose', unit: 'Dose', quantityToBaseUnit: 4 },
    { id: 'tabs', label: 'Tablet', unit: 'Tablet', quantityToBaseUnit: 1 },
  ],
  tabsPerPack: 20,
  tabsPerDose: 4,
  packetPrice: 5000,
  fullDosePrice: 1000,
  tabPrice: 250,
  batches: [{
    id: 'batch-1', productId: 'panadol', batchNumber: 'P-1', purchaseDate: '2026-01-01',
    quantityPurchased: 200, quantityRemaining: 200, buyingPrice: 100,
    finalSellingPrice: 5000, status: 'active', createdBy: 'Admin', createdAt: '2026-01-01',
  }],
};

describe('pharmacy POS selected-level pricing', () => {
  it('prices two selected tablets at TSh500 and deducts two base units', () => {
    const line = resolvePharmacyPosLine({ product: panadol, selectedLevel: 'tabs', tabsSelected: 2 });
    expect(line.selectedUnitPrice).toBe(500);
    expect(line.lineTotal).toBe(500);
    expect(line.baseQuantityDeducted).toBe(2);
  });

  it('uses the explicit dose price and dose base-unit conversion', () => {
    const line = resolvePharmacyPosLine({ product: panadol, selectedLevel: 'dose', quantity: 2 });
    expect(line.selectedUnitPrice).toBe(1000);
    expect(line.lineTotal).toBe(2000);
    expect(line.baseQuantityDeducted).toBe(8);
  });

  it('uses strip price without leaking it into tablet sales', () => {
    const strip = resolvePharmacyPosLine({ product: panadol, selectedLevel: 'packet' });
    const tablets = resolvePharmacyPosLine({ product: panadol, selectedLevel: 'tabs', tabsSelected: 2 });
    expect(strip.selectedUnitPrice).toBe(5000);
    expect(strip.baseQuantityDeducted).toBe(20);
    expect(tablets.selectedUnitPrice).toBe(500);
  });

  it('keeps batch selling price out of selected-level pricing', () => {
    const line = resolvePharmacyPosLine({ product: panadol, selectedLevel: 'tabs', tabsSelected: 2 });
    expect(panadol.batches?.[0].finalSellingPrice).toBe(5000);
    expect(line.selectedUnitPrice).toBe(500);
  });
});
