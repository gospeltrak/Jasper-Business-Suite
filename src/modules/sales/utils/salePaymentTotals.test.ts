import { describe, expect, it } from 'vitest';
import type { Sale } from '../../../types';
import { getSaleCollected, getSaleCheckoutPaid } from './salePaymentTotals';

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
  it('does not return a negative checkout amount or more than the invoice total', () => {
    expect(getSaleCheckoutPaid(sale({ amountPaid: 10 }), [{ amount: 20 }])).toBe(0);
    expect(getSaleCollected(sale({ amountPaid: 120 }))).toBe(100);
  });
});
