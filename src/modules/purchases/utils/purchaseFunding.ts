import type { PurchasePaymentAllocation } from '../../../types';

export const sumPurchaseFunding = (
  allocations: readonly Pick<PurchasePaymentAllocation, 'amount'>[] = [],
): number => allocations.reduce((sum, allocation) => sum + Math.max(0, Number(allocation.amount || 0)), 0);

export const registeredPurchaseFunding = (
  allocations: readonly PurchasePaymentAllocation[] = [],
): PurchasePaymentAllocation[] => allocations.filter(allocation => allocation.fundingType === 'registered');

export const isPurchaseFundingBalanced = (
  allocations: readonly Pick<PurchasePaymentAllocation, 'amount'>[],
  expectedAmount: number,
): boolean => Math.abs(sumPurchaseFunding(allocations) - Math.max(0, Number(expectedAmount || 0))) <= 0.01;
