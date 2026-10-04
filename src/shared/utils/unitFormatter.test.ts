import { describe, expect, it } from 'vitest';
import type { SaleItem } from '../../types';
import { formatSaleItemQuantity, getSaleItemUnitName } from './unitFormatter';

describe('getSaleItemUnitName', () => {
  it('prefers sellUnit (what was actually sold) over the product base unit', () => {
    // A packet/dosage sale: unit/baseUnit are the pharmacy base unit
    // (Tablet), but sellUnit carries the real selected-level label.
    const packetSale = { unit: 'Tablet', baseUnit: 'Tablet', sellUnit: 'Packet' } as SaleItem;
    expect(getSaleItemUnitName(packetSale)).toBe('Packet');
  });

  it('falls back to unit/baseUnit for legacy sale records with no sellUnit', () => {
    const legacySale = { unit: 'Tablet', baseUnit: 'Tablet' } as SaleItem;
    expect(getSaleItemUnitName(legacySale)).toBe('Tablet');
  });

  it('falls back to the product unit name when the sale item has none of its own', () => {
    expect(getSaleItemUnitName({} as SaleItem, { unit: 'Kg' } as any)).toBe('Kg');
  });
});

describe('formatSaleItemQuantity', () => {
  it('labels a 2-packet pharmacy sale as "2 Packet", not "2 Tablet"', () => {
    const packetSale = { qty: 2, unit: 'Tablet', baseUnit: 'Tablet', sellUnit: 'Packet' } as SaleItem;
    expect(formatSaleItemQuantity(packetSale)).toBe('2 Packet');
  });

  it('labels a half-dose sale with its own sellUnit instead of the base unit', () => {
    const halfDoseSale = { qty: 1, unit: 'Tablet', baseUnit: 'Tablet', sellUnit: 'Half Dose' } as SaleItem;
    expect(formatSaleItemQuantity(halfDoseSale)).toBe('1 Half Dose');
  });
});
