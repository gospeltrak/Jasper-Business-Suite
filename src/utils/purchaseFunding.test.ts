import { describe, expect, it } from 'vitest';
import { isPurchaseFundingBalanced, registeredPurchaseFunding, sumPurchaseFunding } from './purchaseFunding';
import type { PurchasePaymentAllocation } from '../types';

const allocation = (
  fundingType: PurchasePaymentAllocation['fundingType'],
  amount: number,
  accountId?: string,
): PurchasePaymentAllocation => ({
  fundingType,
  amount,
  accountName: fundingType === 'external' ? 'External Account' : accountId || 'Registered Account',
  accountId,
});

describe('purchase funding allocations', () => {
  it('handles a single registered account', () => {
    const rows = [allocation('registered', 500_000, 'mpesa')];
    expect(sumPurchaseFunding(rows)).toBe(500_000);
    expect(registeredPurchaseFunding(rows).map(row => row.amount)).toEqual([500_000]);
    expect(isPurchaseFundingBalanced(rows, 500_000)).toBe(true);
  });

  it('keeps external funding out of registered account deductions', () => {
    const rows = [allocation('external', 500_000)];
    expect(sumPurchaseFunding(rows)).toBe(500_000);
    expect(registeredPurchaseFunding(rows)).toEqual([]);
    expect(isPurchaseFundingBalanced(rows, 500_000)).toBe(true);
  });

  it('reconciles mixed registered and external funding', () => {
    const rows = [
      allocation('registered', 300_000, 'mpesa'),
      allocation('registered', 300_000, 'nmb'),
      allocation('external', 400_000),
    ];
    expect(sumPurchaseFunding(rows)).toBe(1_000_000);
    expect(registeredPurchaseFunding(rows).map(row => row.amount)).toEqual([300_000, 300_000]);
    expect(isPurchaseFundingBalanced(rows, 1_000_000)).toBe(true);
  });

  it('rejects under-allocation and over-allocation', () => {
    expect(isPurchaseFundingBalanced([allocation('registered', 900_000, 'mpesa')], 1_000_000)).toBe(false);
    expect(isPurchaseFundingBalanced([allocation('registered', 1_100_000, 'mpesa')], 1_000_000)).toBe(false);
  });

  it('does not allow negative allocation amounts to reduce the funded total', () => {
    const rows = [allocation('registered', 1_000_000, 'nmb'), allocation('external', -400_000)];
    expect(sumPurchaseFunding(rows)).toBe(1_000_000);
    expect(isPurchaseFundingBalanced(rows, 1_000_000)).toBe(true);
  });
});
