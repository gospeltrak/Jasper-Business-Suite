import type { PaymentChannel } from '../types';
import { getSecureDataBridgeClient } from '../secureDataBridge';
import { getMaskedAccountReference } from './paymentAccounts';

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
  if (code === '23514') return new Error('The selected account has insufficient available funds.');
  if (code === '42501') return new Error('You do not have permission to post this Money & Bank transaction.');
  if (code === 'P0002') return new Error('The selected Money & Bank account is not active.');
  if (code === '23505') return new Error('This Money & Bank transaction was already posted.');
  return new Error('Money & Bank could not post this transaction safely. Nothing was saved.');
};

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
  return (synced?.accounts || []) as SyncedTreasuryAccount[];
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
  const syncedAccounts = await syncTreasuryPaymentAccounts(input.channels, input.openingBalances);
  const source = syncedAccounts.find(account => account.sourceKey === input.sourceAccountKey);
  const destination = syncedAccounts.find(account => account.sourceKey === input.destinationAccountKey);
  if (!source?.accountId || !destination?.accountId) {
    throw new Error('Both Money & Bank accounts must be active and synchronized.');
  }
  const client: any = await getSecureDataBridgeClient();
  const { data, error } = await client.rpc('transfer_current_tenant_treasury_funds', {
    p_source_account_id: source.accountId,
    p_destination_account_id: destination.accountId,
    p_amount: amount,
    p_idempotency_key: input.idempotencyKey,
    p_description: input.description,
    p_metadata: input.metadata || {},
  });
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
  sourceId: string;
  description: string;
  openingBalances?: Record<string, number>;
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
  const syncedAccounts = await syncTreasuryAccounts(client, activeChannels, input.openingBalances);
  const mapping = new Map(syncedAccounts.map(account => [account.sourceKey, account]));
  const branchIds = new Set([...aggregated.keys()].map(key => mapping.get(key)?.branchId).filter(Boolean));
  if (branchIds.size !== 1) throw new Error('Split payments must belong to one active branch.');
  const branchId = String([...branchIds][0] || '');
  const lines = [...aggregated.entries()]
    .map(([sourceAccountKey, amount]) => ({
      accountId: mapping.get(sourceAccountKey)?.accountId,
      amount,
    }))
    .sort((a, b) => String(a.accountId).localeCompare(String(b.accountId)));
  if (lines.some(line => !line.accountId)) {
    throw new Error('A Money & Bank account could not be synchronized.');
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
