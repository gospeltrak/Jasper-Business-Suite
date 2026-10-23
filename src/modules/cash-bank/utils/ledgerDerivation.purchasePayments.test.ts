import { describe, expect, it } from 'vitest';
import type { PaymentChannel, Purchase } from '../../../types';
import { buildAutoLedgerEntries } from './ledgerDerivation';

describe('purchase installment reports', () => {
  it('assigns each account debit to the installment date and excludes external funding', () => {
    const purchase: Purchase = {
      tenantId: 'tenant', supplierId: 'supplier', items: [], totalAmount: 100000, amountDue: 40000, destination: 'shop', deliveryStatus: 'Pending',
      id: 'credit-purchase', supplierName: 'Supplier', timestamp: '2026-09-01T10:00:00Z', amountPaid: 60000,
      paymentAllocations: [
        { id: 'cash-installment', fundingType: 'registered', accountId: 'cash', accountName: 'Cash', amount: 30000, paidAt: '2026-10-20T10:00:00Z' },
        { id: 'bank-installment', fundingType: 'registered', accountId: 'bank', accountName: 'Bank', amount: 20000, paidAt: '2026-10-23T10:00:00Z' },
        { id: 'external-installment', fundingType: 'external', accountName: 'External', amount: 10000, paidAt: '2026-10-23T10:00:00Z' },
      ],
    };
    const entries = buildAutoLedgerEntries({ tenantId: 'tenant', channels: [{ id: 'cash' }, { id: 'bank' }] as PaymentChannel[], sales: [], expenses: [], deliveries: [], purchases: [purchase], hasDemoSeedData: false });
    expect(entries).toHaveLength(2);
    expect(entries.map(entry => [entry.channelId, entry.amount, entry.timestamp])).toEqual([
      ['cash', -30000, '2026-10-20T10:00:00Z'], ['bank', -20000, '2026-10-23T10:00:00Z'],
    ]);
    expect(entries[0].id).toBe('PURCHASE-PAYMENT-credit-purchase-cash-installment');
    const externalOnly = { ...purchase, paidFromAccountId: 'cash', paymentAllocations: [purchase.paymentAllocations![2]] };
    expect(buildAutoLedgerEntries({ tenantId: 'tenant', channels: [{ id: 'cash' }] as PaymentChannel[], sales: [], expenses: [], deliveries: [], purchases: [externalOnly], hasDemoSeedData: false })).toHaveLength(0);
  });
});
