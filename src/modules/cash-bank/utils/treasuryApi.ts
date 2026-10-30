import type { Delivery, PaymentChannel, Sale } from '../../../types';
import { requireOnlineBusinessWrite } from '../../../shared/utils/onlineOnly';
import { getSecureDataBridgeClient } from '../../../shared/dataBridge/secureDataBridge';
import { getMaskedAccountReference } from '../../../shared/utils/paymentAccounts';
import { selectPaymentAccountsForBranch } from './treasuryBranchAccounts';

type TreasuryDirection = 'in' | 'out';

export interface TreasuryPostInput {
  channels: PaymentChannel[];
  sourceAccountKey: string;
  amount: number;
  direction: TreasuryDirection;
  sourceType: 'sale' | 'delivery' | 'purchase' | 'expense' | 'payroll' | 'other';
  sourceId: string;
  description: string;
  openingBalances?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface TreasuryPostResult {
  journalId: string;
  accountId: string;
  branchId: string;
  balance: number;
}

export interface SyncedTreasuryAccount {
  sourceKey: string;
  accountId: string;
  branchId: string;
  currency: string;
}

export interface TreasuryTransferResult {
  journalId: string;
  sourceBalance: number;
  destinationBalance: number;
  status: 'posted' | 'already_posted';
}

/** The server derives fee, branch and tenant from the saved delivery. */
export async function collectDeliveryPayment(deliveryId: string, sourceAccountKey?: string): Promise<Delivery> {
  requireOnlineBusinessWrite('delivery payment');
  const client: any = await getSecureDataBridgeClient();
  const { data, error } = await client.rpc('collect_current_branch_delivery_payment', {
    p_delivery_id: deliveryId,
    p_source_account_key: sourceAccountKey || null,
  });
  if (error) {
    if (error.code === '42501') throw new Error('You do not have permission to collect delivery payments in this branch.');
    if (error.code === 'P0002') throw new Error('This delivery is not available in the selected branch. Refresh Deliveries and try again.');
    if (error.code === '23505') throw new Error('This delivery has a conflicting payment record. Check its payment history before retrying.');
    if (error.code === '23514') throw new Error('The delivery fee, account or existing collection could not be verified. Check the delivery and payment history.');
    throw new Error('Delivery payment could not be confirmed. Check Deliveries before retrying.');
  }
  const delivery = data?.delivery as Delivery | undefined;
  if (!delivery || delivery.id !== deliveryId || delivery.status !== 'Delivered'
    || delivery.deliveryPaymentStatus !== 'collected'
    || (Number(delivery.deliveryCost || 0) > 0 && !delivery.treasuryJournalId)) {
    throw new Error('Delivery payment was not confirmed. Refresh Deliveries before retrying.');
  }
  return delivery;
}

const toTreasuryType = (channel: PaymentChannel) => {
  const value = `${channel.category || ''} ${channel.paymentMethod || ''} ${channel.name || ''}`.toLowerCase();
  if (value.includes('cash') || channel.category === 'physical') return 'cash';
  if (value.includes('mobile') || value.includes('mpesa') || value.includes('airtel') || value.includes('yas')) return 'mobile_money';
  if (value.includes('card') || value.includes('pos')) return 'card';
  if (channel.category === 'bank' || value.includes('bank')) return 'bank';
  return 'other';
};

const toStoredMaskedReference = (channel: PaymentChannel) => {
  const displayReference = getMaskedAccountReference(channel);
  const visible = displayReference.replace(/[^A-Za-z0-9]/g, '').slice(-4);
  return visible ? `****${visible}` : null;
};

const safeTreasuryError = (error: any) => {
  const code = String(error?.code || '');
  if (code === '22023') {
    // Only server-authored, PII-free POS validation messages are safe to show.
    // Raw SQL errors can expose internal table/function details.
    const message = String(error?.message || '');
    const safePosErrors = [
      'POS sale payload is missing. Please reopen the cart.',
      'POS business context changed. Sign in to the correct business.',
      'POS branch is out of sync. Re-select your branch before checkout.',
      'POS cart must contain between 1 and 500 items.',
      'POS sale reference is invalid. Please reopen the cart.',
      'POS sale already carries a payment reference. Check Sales before retrying.',
      'At least one valid payment account is required.',
      'POS sale items must have a product, quantity and price.',
      'POS payment cannot exceed sale revenue.',
      'Every payment line must have a valid positive amount.',
      'POS split payment accounts must be unique.',
    ];
    return new Error(safePosErrors.includes(message)
      ? message
      : 'POS sale details could not be verified. Please check your branch and cart before retrying.');
  }
  if (code === '23514') {
    const message = String(error?.message || '');
    if (message === 'Collected payment must match POS sale amount paid.')
      return new Error('The POS amount collected does not match the sale payment. Check the amount before retrying.');
    if (message === 'POS payments require active accounts in one branch and currency.')
      return new Error('Selected payment account does not belong to the active branch or currency.');
    return new Error('The Money & Bank account or payment amount could not be verified.');
  }
  if (code === '42501') return new Error('You do not have permission to post this Money & Bank transaction.');
  if (code === 'P0002') return new Error('The selected Money & Bank account is not active.');
  if (code === '23505') return new Error('This sale or payment already exists. Check Sales before retrying.');
  return new Error('Money & Bank could not post this transaction safely. Check Sales before retrying.');
};

const TREASURY_ACCOUNT_CACHE_TTL_MS = 30_000;
const treasuryAccountSyncCache = new Map<string, {
  expiresAt: number;
  accounts: SyncedTreasuryAccount[];
}>();

export async function postTreasuryEntry(input: TreasuryPostInput): Promise<TreasuryPostResult> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('A positive Money & Bank amount is required.');
  }
  const activeChannels = input.channels.filter(channel =>
    channel.category !== 'person'
    && channel.status !== 'inactive'
    && channel.status !== 'archived'
  );
  if (!activeChannels.some(channel => channel.id === input.sourceAccountKey)) {
    throw new Error('Select an active Money & Bank account.');
  }

  const client: any = await getSecureDataBridgeClient();
  const syncedAccounts = await syncTreasuryAccounts(
    client,
    activeChannels,
    input.openingBalances,
  );
  const account = syncedAccounts.find(candidate => candidate.sourceKey === input.sourceAccountKey);
  if (!account?.accountId || !account?.branchId) {
    throw new Error('The selected Money & Bank account could not be synchronized.');
  }

  const { data, error } = await client.rpc('post_current_tenant_treasury_entry', {
    p_branch_id: account.branchId,
    p_account_id: account.accountId,
    p_amount: amount,
    p_direction: input.direction,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_idempotency_key: `${input.sourceType}:${input.sourceId}:v1`,
    p_description: input.description,
    p_metadata: {
      ...(input.metadata || {}),
      sourceAccountKey: input.sourceAccountKey,
    },
  });
  if (error) throw safeTreasuryError(error);

  return {
    journalId: String(data?.journalId || ''),
    accountId: String(account.accountId),
    branchId: String(account.branchId),
    balance: Number(data?.balance || 0),
  };
}

async function syncTreasuryAccounts(
  client: any,
  activeChannels: PaymentChannel[],
  openingBalances: Record<string, number> = {},
  cacheKey = '',
): Promise<SyncedTreasuryAccount[]> {
  const accountsPayload = activeChannels.map(channel => ({
    sourceKey: channel.id,
    name: channel.name,
    type: toTreasuryType(channel),
    currency: channel.currency || 'TZS',
    provider: channel.provider || null,
    maskedReference: toStoredMaskedReference(channel),
    isDefault: Boolean(channel.isDefault),
    openingBalance: Math.max(0, Number(openingBalances[channel.id] || 0)),
  }));
  const accountConfiguration = accountsPayload.map(({ openingBalance, ...account }) => account);
  const syncCacheKey = cacheKey
    ? `${cacheKey}:${JSON.stringify(accountConfiguration)}`
    : '';
  if (syncCacheKey) {
    const cached = treasuryAccountSyncCache.get(syncCacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.accounts;
    treasuryAccountSyncCache.delete(syncCacheKey);
  }

  let { data: synced, error: syncError } = await client.rpc(
    'sync_current_tenant_treasury_accounts',
    { p_accounts: accountsPayload },
  );
  if (syncError?.code === '42501') {
    const existing = await client.rpc('get_current_tenant_treasury_accounts');
    if (!existing.error) {
      synced = { accounts: existing.data || [] };
      syncError = null;
    }
  }
  if (syncError) throw safeTreasuryError(syncError);
  const accounts = (synced?.accounts || []) as SyncedTreasuryAccount[];
  if (syncCacheKey) {
    treasuryAccountSyncCache.set(syncCacheKey, {
      expiresAt: Date.now() + TREASURY_ACCOUNT_CACHE_TTL_MS,
      accounts,
    });
  }
  return accounts;
}

export async function syncTreasuryPaymentAccounts(
  channels: PaymentChannel[],
  openingBalances: Record<string, number> = {},
): Promise<SyncedTreasuryAccount[]> {
  const activeChannels = channels.filter(channel =>
    channel.category !== 'person'
    && channel.status !== 'inactive'
    && channel.status !== 'archived'
  );
  const client: any = await getSecureDataBridgeClient();
  return syncTreasuryAccounts(client, activeChannels, openingBalances);
}

export async function transferTreasuryFunds(input: {
  channels: PaymentChannel[];
  sourceAccountKey: string;
  destinationAccountKey: string;
  amount: number;
  idempotencyKey: string;
  description: string;
  openingBalances?: Record<string, number>;
  metadata?: Record<string, unknown>;
}): Promise<TreasuryTransferResult> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('A positive transfer amount is required.');
  }
  if (input.sourceAccountKey === input.destinationAccountKey) {
    throw new Error('Source and destination accounts must be different.');
  }
  const client: any = await getSecureDataBridgeClient();
  const [syncedAccounts, context] = await Promise.all([
    syncTreasuryPaymentAccounts(input.channels, input.openingBalances),
    client.rpc('get_current_branch_context'),
  ]);
  if (context.error || context.data?.activeScope !== 'branch' || !context.data?.activeBranchId) {
    throw new Error('Select a branch before transferring funds.');
  }
  const selection = selectPaymentAccountsForBranch(syncedAccounts,
    [input.sourceAccountKey, input.destinationAccountKey], context.data.activeBranchId);
  const source = selection.accounts.get(input.sourceAccountKey);
  const destination = selection.accounts.get(input.destinationAccountKey);
  if (!source?.accountId || !destination?.accountId) {
    throw new Error('Both Money & Bank accounts must be active and synchronized.');
  }
  const { data, error } = await client.rpc('transfer_current_tenant_treasury_funds', {
    p_source_account_id: source.accountId,
    p_destination_account_id: destination.accountId,
    p_amount: amount,
    p_idempotency_key: input.idempotencyKey,
    p_description: input.description,
    p_metadata: input.metadata || {},
  });
  if (error?.code === '42501') throw new Error('Your role does not allow transfers in this branch. Ask the owner to check Transfer Between Treasury Accounts.');
  if (error) throw safeTreasuryError(error);
  return {
    journalId: String(data?.journalId || ''),
    sourceBalance: Number(data?.sourceBalance || 0),
    destinationBalance: Number(data?.destinationBalance || 0),
    status: data?.status === 'already_posted' ? 'already_posted' : 'posted',
  };
}

export async function postTreasurySplitIncome(input: {
  channels: PaymentChannel[];
  lines: Array<{ sourceAccountKey: string; amount: number }>;
  sourceType: 'sale' | 'delivery' | 'other';
  // Only a real POS sale can use the narrowly authorized, atomic checkout RPC.
  sale?: Sale;
  sourceId: string;
  description: string;
  openingBalances?: Record<string, number>;
  cacheKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ journalId: string; branchId: string }> {
  const activeChannels = input.channels.filter(channel =>
    channel.category !== 'person'
    && channel.status !== 'inactive'
    && channel.status !== 'archived'
  );
  const aggregated = new Map<string, number>();
  input.lines.forEach(line => {
    const amount = Math.max(0, Number(line.amount || 0));
    if (amount > 0) {
      aggregated.set(line.sourceAccountKey, (aggregated.get(line.sourceAccountKey) || 0) + amount);
    }
  });
  if (aggregated.size < 1) throw new Error('At least one collected payment is required.');
  if ([...aggregated.keys()].some(key => !activeChannels.some(channel => channel.id === key))) {
    throw new Error('Every collected payment must use an active Money & Bank account.');
  }

  const client: any = await getSecureDataBridgeClient();
  const syncedAccounts = await syncTreasuryAccounts(
    client,
    activeChannels,
    input.openingBalances,
    input.cacheKey,
  );
  // Cash and M-Pesa may reuse the same sourceKey in every tenant branch.
  // Restrict Sale payment routing to the branch selected on the POS sale,
  // instead of overwriting one branch's sourceKey with another branch's.
  const saleSelection = input.sourceType === 'sale'
    ? selectPaymentAccountsForBranch(syncedAccounts, [...aggregated.keys()], input.sale?.branchId)
    : null;
  const mapping = saleSelection?.accounts || new Map(syncedAccounts.map(account => [account.sourceKey, account]));
  const branchIds = new Set([...aggregated.keys()].map(key => mapping.get(key)?.branchId).filter(Boolean));
  if (branchIds.size !== 1) throw new Error('Split payments must belong to one active branch.');
  const branchId = saleSelection?.branchId || String([...branchIds][0] || '');
  const lines = [...aggregated.entries()]
    .map(([sourceAccountKey, amount]) => ({
      accountId: mapping.get(sourceAccountKey)?.accountId,
      amount,
    }))
    .sort((a, b) => String(a.accountId).localeCompare(String(b.accountId)));
  if (lines.some(line => !line.accountId)) {
    throw new Error('A Money & Bank account could not be synchronized.');
  }

  // POS payments must create the sale record and the money journal in one
  // database transaction. Sellers never receive generic money_bank.post.
  if (input.sourceType === 'sale') {
    if (!input.sale || input.sale.id !== input.sourceId) {
      throw new Error('A matching POS sale is required before recording its payment.');
    }
    const { data, error } = await client.rpc('post_current_branch_pos_sale', {
      p_sale: { ...input.sale, branchId },
      p_lines: lines,
    });
    if (error) throw safeTreasuryError(error);
    if (!data?.journalId) throw new Error('POS sale payment was not confirmed. Check Sales before retrying.');
    return { journalId: String(data.journalId), branchId };
  }

  const { data, error } = await client.rpc('post_current_tenant_treasury_split_entry', {
    p_branch_id: branchId,
    p_lines: lines,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_idempotency_key: `${input.sourceType}:${input.sourceId}:v1`,
    p_description: input.description,
    p_metadata: input.metadata || {},
  });
  if (error) throw safeTreasuryError(error);
  return { journalId: String(data?.journalId || ''), branchId };
}

export async function postTreasurySplitOutgoing(input: {
  channels: PaymentChannel[];
  lines: Array<{ sourceAccountKey: string; amount: number }>;
  sourceType: 'purchase' | 'expense' | 'other';
  sourceId: string;
  description: string;
  openingBalances?: Record<string, number>;
  cacheKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ journalId: string; branchId: string }> {
  const activeChannels = input.channels.filter(channel =>
    channel.category !== 'person'
    && channel.status !== 'inactive'
    && channel.status !== 'archived'
  );
  const aggregated = new Map<string, number>();
  input.lines.forEach(line => {
    const amount = Math.max(0, Number(line.amount || 0));
    if (amount > 0) {
      aggregated.set(line.sourceAccountKey, (aggregated.get(line.sourceAccountKey) || 0) + amount);
    }
  });
  if (aggregated.size < 1) throw new Error('At least one registered payment account is required.');
  if ([...aggregated.keys()].some(key => !activeChannels.some(channel => channel.id === key))) {
    throw new Error('Every purchase payment must use an active Money & Bank account.');
  }

  const client: any = await getSecureDataBridgeClient();
  const syncedAccounts = await syncTreasuryAccounts(
    client,
    activeChannels,
    input.openingBalances,
    input.cacheKey,
  );
  const mapping = new Map(syncedAccounts.map(account => [account.sourceKey, account]));
  const branchIds = new Set([...aggregated.keys()].map(key => mapping.get(key)?.branchId).filter(Boolean));
  if (branchIds.size !== 1) throw new Error('Purchase payment accounts must belong to one active branch.');
  const branchId = String([...branchIds][0] || '');
  const lines = [...aggregated.entries()]
    .map(([sourceAccountKey, amount]) => ({
      accountId: mapping.get(sourceAccountKey)?.accountId,
      amount,
    }))
    .sort((a, b) => String(a.accountId).localeCompare(String(b.accountId)));
  if (lines.some(line => !line.accountId)) {
    throw new Error('A purchase payment account could not be synchronized.');
  }

  const { data, error } = await client.rpc('post_current_tenant_treasury_split_outgoing_entry', {
    p_branch_id: branchId,
    p_lines: lines,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_idempotency_key: `${input.sourceType}:${input.sourceId}:v1`,
    p_description: input.description,
    p_metadata: input.metadata || {},
  });
  if (error) throw safeTreasuryError(error);
  return { journalId: String(data?.journalId || ''), branchId };
}

export async function reverseTreasuryEntry(journalId: string, sourceId: string, reason: string): Promise<void> {
  if (!journalId) return;
  const client: any = await getSecureDataBridgeClient();
  const { error } = await client.rpc('reverse_current_tenant_treasury_journal', {
    p_journal_id: journalId,
    p_idempotency_key: `reversal:${sourceId}:v1`,
    p_reason: reason,
  });
  if (error) throw safeTreasuryError(error);
}


