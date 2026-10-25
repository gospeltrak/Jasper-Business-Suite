
export interface BranchTreasuryAccount {
  sourceKey: string;
  accountId: string;
  branchId: string;
  currency: string;
}

/**
 * A tenant can have Cash, M-Pesa, etc. with the SAME sourceKey in multiple
 * branches. Never map globally by sourceKey and take the last account:
 * that silently routes one payment into a different branch.
 *
 * Require a specific selected branch, or an unambiguous single branch if no
 * branch was supplied (legacy single-branch compatibility only).
 */
export function selectPaymentAccountsForBranch<T extends BranchTreasuryAccount>(
  available: T[],
  paymentSourceKeys: string[],
  expectedBranchId?: string | null,
): { branchId: string; accounts: Map<string, T> } {
  const keys = [...new Set(paymentSourceKeys.map(key => key.trim()).filter(Boolean))];
  if (keys.length === 0) throw new Error('Select at least one payment account.');
  const matching = available.filter(a => keys.includes(a.sourceKey) && Boolean(a.accountId && a.branchId));
  const branches = new Set(matching.map(a => a.branchId));
  const branchId = expectedBranchId?.trim() || (branches.size === 1 ? [...branches][0] : '');
  if (!branchId) {
    throw new Error('Select an active branch before checkout. Payment accounts exist in multiple branches.');
  }
  const scoped = matching.filter(a => a.branchId === branchId);
  const chosen = new Map<string, T>();
  for (const account of scoped) {
    if (chosen.has(account.sourceKey)) {
      throw new Error('Payment account mapping is ambiguous in this branch. Check Business Setup.');
    }
    chosen.set(account.sourceKey, account);
  }
  if (keys.some(key => !chosen.has(key))) {
    throw new Error('The selected payment account is not available in this branch. Re-select the branch or payment method.');
  }
  return { branchId, accounts: chosen };
}
