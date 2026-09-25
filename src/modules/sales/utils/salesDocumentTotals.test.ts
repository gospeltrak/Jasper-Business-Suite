import { describe, expect, it } from 'vitest';
import { calculateSalesDocumentTotals } from './salesDocumentTotals';

describe('calculateSalesDocumentTotals', () => {
  it('applies discount before VAT and adds delivery last', () => {
    expect(calculateSalesDocumentTotals({
      items: [{ qty: 2, price: 100 }],
      discountAmount: 20,
      hasVat: true,
      taxRate: 0.18,
      deliveryCost: 10,
    })).toMatchObject({
      subTotal: 200,
      discount: 20,
      taxableAmount: 180,
      tax: 32.4,
      total: 222.4,
    });
  });

  it('always returns zero tax when VAT is disabled', () => {
    expect(calculateSalesDocumentTotals({
      items: [{ qty: 1, price: 100 }],
      discountAmount: 10,
      hasVat: false,
      taxRate: 0.18,
    }).tax).toBe(0);
  });

  it('caps invalid discounts and paid amounts at the document total', () => {
    expect(calculateSalesDocumentTotals({
      items: [{ qty: 1, price: 50 }],
      discountAmount: 500,
      deliveryCost: 5,
      paidAmount: 100,
    })).toMatchObject({ discount: 50, total: 5, paid: 5, balance: 0 });
  });
});
