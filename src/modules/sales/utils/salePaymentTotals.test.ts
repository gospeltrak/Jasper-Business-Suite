import { describe, expect, it } from 'vitest';
import type { Sale } from '../../../types';
import { getSaleCollected, getSaleCheckoutPaid, getProductSalesCollected, getProductSalesDue, getProductSalesTotal } from './salePaymentTotals';

const sale = (values: Partial<Sale>) => ({ total: 100, paymentMethod: 'Credit', ...values } as Sale);
describe('customer payment totals', () => {
  it('does not add installment history to an already cumulative paid amount', () => {
    const record = sale({ amountPaid: 60, payments: [{ amount: 40 }] as Sale['payments'] });
    expect(getSaleCollected(record)).toBe(60);
    expect(getSaleCheckoutPaid(record)).toBe(20);
  });
  it('retains legacy cash and credit defaults', () => {
    expect(getSaleCollected(sale({}))).toBe(0);
    expect(getSaleCollected(sale({ paymentMethod: 'Cash' }))).toBe(100);
  });
  it('supports archived installment history without counting it twice', () => {
    const record = sale({ amountPaid: 50 });
    expect(getSaleCheckoutPaid(record, [{ amount: 30 }])).toBe(20);
    expect(getSaleCollected(record)).toBe(50);
  });
  it('does not double count installment payments on a credit receipt', () => {
    const record = sale({
      total: 110000,
      productTotal: 100000,
      deliveryCost: 10000,
      amountPaid: 65000,
      payments: [{ amount: 45000 }] as Sale['payments'],
    });
    expect(getProductSalesCollected(record)).toBe(65000);
    expect(getProductSalesDue(record)).toBe(35000);
    expect(getSaleCheckoutPaid(record)).toBe(20000);
  });
  it('shows the real unpaid balance even for a partially paid Cash transaction', () => {
    const record = sale({ paymentMethod: 'Cash', amountPaid: 25 });
    expect(getProductSalesCollected(record)).toBe(25000);
    expect(getProductSalesDue(record)).toBe(75);
  });
  it('fails safe for nonfinite, invalid and negative persisted amounts', () => {
    const invalid = sale({ amountPaid: Number.NaN });
    expect(getSaleCollected(invalid)).toBe(0);
    expect(getProductSalesDue(invalid)).toBe(100);
    expect(getSaleCollected(sale({ amountPaid: -400 }))).toBe(0);
    expect(getSaleCollected(sale({ amountPaid: Infinity }))).toBe(0);
    expect(getProductSalesTotal(sale({ total: 100, deliveryCost: Number.NaN }))).toBe(100);
    expect(getSaleCheckoutPaid(sale({ amountPaid: 80 }), [{amount: Number.NaN}])).toBe(80);
  });
  it('does not return a negative checkout amount or more than the invoice total', () => {
    expect(getSaleCheckoutPaid(sale({ amountPaid: 10 }), [{ amount: 20 }])).toBe(0);
    expect(getSaleCollected(sale({ amountPaid: 120 }))).toBe(100);
  });
});
