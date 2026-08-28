import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import {
  calculateFractionSaleLine,
  calculateFractionPurchaseLine,
  calculateFractionSalePacketPrice,
  isFractionSaleEnabled,
  isFractionSaleEligible,
  resolveFractionSaleConfig,
} from './fractionSale';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Test product', sku: '1', barcode: '1', category: 'General',
  costPrice: 100, sellingPrice: 250, stockQty: 100, shopStockQty: 100,
  storeStockQty: 0, alertQty: 5, unit: 'Piece', ...overrides,
});

describe('fraction sale product settings', () => {
  it('automatically enables Retail Packaging outside pharmacy', () => {
    const retailPackage = product({ isBulkProduct: true });
    expect(isFractionSaleEligible(retailPackage, 'retail')).toBe(true);
    expect(isFractionSaleEnabled(retailPackage, 'retail')).toBe(true);
  });

  it('requires the toggle for a non-medicine pharmacy product', () => {
    const supply = product({ productType: 'medical_supply', fractionSaleEnabled: true });
    expect(isFractionSaleEligible(supply, 'pharmacy')).toBe(true);
    expect(isFractionSaleEnabled(supply, 'pharmacy')).toBe(true);
  });

  it('never enables Fraction Sale for medicine', () => {
    const medicine = product({ productType: 'medicine', isBulkProduct: true, fractionSaleEnabled: true });
    expect(isFractionSaleEligible(medicine, 'pharmacy')).toBe(false);
    expect(isFractionSaleEnabled(medicine, 'pharmacy')).toBe(false);
  });

  it('calculates packet price and preserves a manual override', () => {
    expect(calculateFractionSalePacketPrice(250, 20)).toEqual({ packetPrice: 5000, packetPriceOverridden: false });
    expect(calculateFractionSalePacketPrice(250, 20, 4800)).toEqual({ packetPrice: 4800, packetPriceOverridden: true });
  });

  it('resolves persisted override and normalizes piece/packet lines', () => {
    const configured = product({
      isBulkProduct: true,
      conversionToBaseUnit: 20,
      defaultPricePerBaseUnit: 250,
      wholePackagePrice: 4800,
      packetPriceOverridden: true,
    });
    const config = resolveFractionSaleConfig(configured, 'retail');
    expect(config.packetPrice).toBe(4800);
    expect(calculateFractionSaleLine('piece', 2, config)).toMatchObject({ lineTotal: 500, baseQuantityDeducted: 2 });
    expect(calculateFractionSaleLine('packet', 2, config)).toMatchObject({ lineTotal: 9600, baseQuantityDeducted: 40 });
  });

  it('keeps POS piece and packet totals independent for the same configured product', () => {
    const configured = product({
      isBulkProduct: true,
      conversionToBaseUnit: 20,
      defaultPricePerBaseUnit: 250,
      packetPriceOverridden: false,
    });
    const config = resolveFractionSaleConfig(configured, 'retail');
    const twoPieces = calculateFractionSaleLine('piece', 2, config);
    const onePacket = calculateFractionSaleLine('packet', 1, config);

    expect(twoPieces).toMatchObject({ selectedUnitPrice: 250, lineTotal: 500, baseQuantityDeducted: 2 });
    expect(onePacket).toMatchObject({ selectedUnitPrice: 5000, lineTotal: 5000, baseQuantityDeducted: 20 });
    expect(twoPieces.lineTotal + onePacket.lineTotal).toBe(5500);
  });

  it('normalizes purchase quantity and cost without losing the selected level snapshot', () => {
    const config = resolveFractionSaleConfig(product({ isBulkProduct: true, conversionToBaseUnit: 20 }), 'retail');
    expect(calculateFractionPurchaseLine('piece', 3, 100, config)).toMatchObject({
      selectedLevel: 'piece', baseQty: 3, baseUnitCost: 100, lineTotal: 300,
    });
    expect(calculateFractionPurchaseLine('packet', 2, 1800, config)).toMatchObject({
      selectedLevel: 'packet', unitsPerSelectedLevel: 20, baseQty: 40, baseUnitCost: 90, lineTotal: 3600,
    });
  });
});
