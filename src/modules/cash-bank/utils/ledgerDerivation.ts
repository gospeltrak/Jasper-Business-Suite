import { Sale, Expense, Purchase, PaymentChannel, LedgerEntry } from '../../../types';
import { findPaymentChannel } from '../../../shared/utils/paymentAccounts';

export interface LedgerDerivationInput {
  tenantId: string;
  channels: PaymentChannel[];
  sales: Sale[];
  expenses: Expense[];
  // Loosely typed to match how this data already flows into the Cash &
  // Bank and Reports screens -- not every delivery-fee field this reads
  // (fee, deliveryCost, deliveryPaymentAccountId, ...) is on the strict
  // Delivery type yet.
  deliveries: any[];
  purchases: Purchase[];
  hasDemoSeedData: boolean;
}

const DEMO_SEED_BALANCES = [
  { id: 'initial-mpesa', channelId: 'mpesa-till', amount: 1500000, desc: 'Starting balance in wallet' },
  { id: 'initial-crdb', channelId: 'crdb-corporate', amount: 8000000, desc: 'Starting balance in main bank account' },
  { id: 'initial-nmb', channelId: 'nmb-checking', amount: 4500000, desc: 'Starting balance in secondary checking account' },
  { id: 'initial-drawer1', channelId: 'counter-01', amount: 350000, desc: 'Starting cash float for till 01' },
  { id: 'initial-safe', channelId: 'office-safe', amount: 2500000, desc: 'Starting reserve cash inside lock safe' },
];

/**
 * Regenerates every ledger entry that is derived straight from business
 * records (sales, expenses, deliveries, purchases), the same way on every
 * call. Excludes manual account-to-account transfers (SETTLE_TILL_DEPOSIT),
 * which only ever exist as the cached snapshot read by
 * readCachedManualSettleEntries below -- there is no source record to
 * regenerate them from.
 */
export function buildAutoLedgerEntries({
  tenantId,
  channels,
  sales,
  expenses,
  deliveries,
  purchases,
  hasDemoSeedData,
}: LedgerDerivationInput): LedgerEntry[] {
  const generated: LedgerEntry[] = [];

  (hasDemoSeedData ? DEMO_SEED_BALANCES : []).forEach(seed => {
    generated.push({
      id: seed.id,
      tenantId,
      channelId: seed.channelId,
      amount: seed.amount,
      entryType: 'credit',
      sourceType: 'INITIAL_BALANCE',
      description: seed.desc,
      timestamp: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    });
  });

  const getPaymentChannel = (methodName: string) => {
    const linkedChannel = findPaymentChannel(channels, methodName);
    if (linkedChannel) {
      return {
        targetChannelId: linkedChannel.id,
        desc: `${methodName} payment`,
      };
    }
    return null;
  };

  sales.forEach(sale => {
    const saleAmount = Math.max(0, sale.total - (sale.deliveryCost || 0));
    const breakdown = Array.isArray(sale.paymentBreakdown) && sale.paymentBreakdown.length > 0
      ? sale.paymentBreakdown
      : [{ method: sale.paymentMethod || 'Cash', amount: saleAmount }];

    breakdown.forEach((part, index) => {
      const amount = Math.max(0, Number(part.amount || 0));
      if (amount <= 0) return;
      const linkedPayment = getPaymentChannel(part.method || sale.paymentMethod || 'Cash');
      if (!linkedPayment) return;
      const { targetChannelId, desc } = linkedPayment;

      generated.push({
        id: `POS-RECON-${sale.id}-${index}`,
        tenantId,
        channelId: targetChannelId,
        amount,
        entryType: 'credit',
        sourceType: 'POS_CHECKOUT',
        description: desc,
        timestamp: sale.timestamp,
        referenceId: sale.reference,
      });
    });
  });

  expenses.forEach(exp => {
    const accountId = exp.paidFromAccountId && channels.some(channel => channel.id === exp.paidFromAccountId)
      ? exp.paidFromAccountId
      : null;
    if (!accountId) return;
    generated.push({
      id: `EXP-WITHDR-${exp.id}`,
      tenantId,
      channelId: accountId,
      amount: -exp.amount,
      entryType: 'debit',
      sourceType: 'EXPENSE_WITHDRAWAL',
      description: `Expense payment: ${exp.description} (${exp.category})`,
      timestamp: exp.timestamp || new Date().toISOString(),
    });
  });

  deliveries.forEach(del => {
    const isCollected = del.deliveryPaymentStatus === 'collected'
      || (!del.deliveryPaymentStatus && del.status === 'Delivered');
    if (!isCollected || del.status === 'Cancelled') return;
    if (!del.fee && !del.deliveryCost) return;
    const amt = (del.fee || del.deliveryCost || 0);
    if (amt <= 0) return;

    const linkedChannel = channels.find(channel => channel.id === del.deliveryPaymentAccountId)
      || findPaymentChannel(channels, del.deliveryPaymentMethod || 'Cash');
    if (!linkedChannel) return;
    const targetChannelId = linkedChannel.id;
    const desc = `${del.deliveryPaymentMethod || linkedChannel.name} delivery payment collected: Ref ${del.id}`;

    generated.push({
      id: `DELIVERY-INC-${del.id}`,
      tenantId,
      channelId: targetChannelId,
      amount: amt,
      entryType: 'credit',
      sourceType: 'DELIVERY_COLLECTION',
      description: desc,
      timestamp: del.paymentCollectedAt || del.deliveredAt || del.timestamp || new Date().toISOString(),
      referenceId: del.id,
    });
  });

  purchases.forEach(purchase => {
    const allocations = Array.isArray(purchase.paymentAllocations)
      ? purchase.paymentAllocations.filter(allocation => allocation?.fundingType === 'registered')
      : [];
    const paymentLines = allocations.length > 0
      ? allocations.map((allocation: any) => ({
          accountId: allocation.accountId || allocation.sourceKey,
          amount: Math.max(0, Number(allocation.amount || 0)),
        }))
      : [{
          accountId: purchase.paidFromAccountId,
          amount: Math.max(0, Number(purchase.amountPaid || 0)),
        }];
    paymentLines.forEach(({ accountId, amount }: { accountId?: string; amount: number }, index: number) => {
      if (amount <= 0 || !accountId || !channels.some(channel => channel.id === accountId)) return;
      generated.push({
        id: `PURCHASE-PAYMENT-${purchase.id}-${index}`,
        tenantId,
        channelId: accountId,
        amount: -amount,
        entryType: 'debit',
        sourceType: 'PURCHASE_PAYMENT',
        description: `Purchase payment to ${purchase.supplierName}: ${purchase.id}`,
        timestamp: purchase.timestamp,
        referenceId: purchase.id,
      });
    });
  });

  return generated;
}

const DEMO_SETTLE_DROPS = (tenantId: string): LedgerEntry[] => [
  {
    id: 'SETTLE-INIT-01',
    tenantId,
    channelId: 'counter-01',
    amount: -300000,
    entryType: 'debit',
    sourceType: 'SETTLE_TILL_DEPOSIT',
    description: 'Deposited drawer cash to CRDB Bank account',
    timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    counterPartyChannelId: 'crdb-corporate',
  },
  {
    id: 'SETTLE-INIT-02',
    tenantId,
    channelId: 'crdb-corporate',
    amount: 300000,
    entryType: 'credit',
    sourceType: 'SETTLE_TILL_DEPOSIT',
    description: 'Received drawer cash deposit from Counter Drawer 01',
    timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    counterPartyChannelId: 'counter-01',
  },
];

/**
 * Reads the manual account-to-account transfers (SETTLE_TILL_DEPOSIT) a
 * tenant has made via the Transfer screen. These live only in the cached
 * ledger snapshot DashboardCashBank.tsx persists to onlineStorage -- there
 * is no other record of them -- so any read-only consumer (like a report)
 * must read the same cache to see them. Read-only: never writes anything.
 */
export function readCachedManualSettleEntries(tenantId: string, hasDemoSeedData: boolean): LedgerEntry[] {
  const storageKey = `jasper_cash_bank_matrix_${tenantId}`;
  const cached = typeof onlineStorage !== 'undefined' ? onlineStorage.getItem(storageKey) : null;
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry: LedgerEntry) => entry.sourceType === 'SETTLE_TILL_DEPOSIT');
      }
    } catch {
      return [];
    }
  }
  return hasDemoSeedData ? DEMO_SETTLE_DROPS(tenantId) : [];
}

/** Convenience helper for read-only consumers that just want the full ledger. */
export function deriveLedgerEntries(input: LedgerDerivationInput): LedgerEntry[] {
  return [
    ...buildAutoLedgerEntries(input),
    ...readCachedManualSettleEntries(input.tenantId, input.hasDemoSeedData),
  ];
}
