import { describe, expect, it } from 'vitest';
import type { PaymentChannel, Sale } from '../../../types';
import { buildAutoLedgerEntries } from './ledgerDerivation';
const channels = [{ id: 'cash', name: 'Cash', paymentMethod: 'Cash' }, { id: 'mpesa', name: 'M-Pesa', paymentMethod: 'M-Pesa' }] as PaymentChannel[];
const ledger = (sale: Partial<Sale>) => buildAutoLedgerEntries({ tenantId: 'tenant', channels,
  sales: [{ id: 'sale', total: 100, paymentMethod: 'Credit', timestamp: '2026-10-26T12:00:00Z', ...sale } as Sale],
  expenses: [], deliveries: [], purchases: [], hasDemoSeedData: false });
describe('sales installment treasury display', () => {
  it('keeps a credit invoice out of received money until an installment is collected', () => {
    expect(ledger({ amountPaid: 0 })).toEqual([]);
  });
  it('splits checkout and later installments between their actual accounts once', () => {
    const entries = ledger({ amountPaid: 60, paymentBreakdown: [{ method: 'Cash', amount: 20 }],
      payments: [{ id: 'payment', amount: 40, sourceKey: 'mpesa', method: 'M-Pesa', date: '2026-10-27T12:00:00Z' }] });
    expect(entries.map(entry => [entry.channelId, entry.amount])).toEqual([['cash', 20], ['mpesa', 40]]);
  });
  it('does not invent a second receipt when credit is fully settled by installments', () => {
    const entries = ledger({ amountPaid: 100, payments: [{ id: 'payment', amount: 100, sourceKey: 'mpesa', method: 'M-Pesa', date: '2026-10-27T12:00:00Z' }] });
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(100);
  });
});
