import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findPaymentChannel, getMaskedAccountReference, getTreasuryPaymentMethods, reconcilePaymentChannels } from '../src/utils/paymentAccounts';

test('payment methods create stable active accounts without duplicates', () => {
  const first = reconcilePaymentChannels(['Cash', 'M-Pesa'], [], { currency: 'TZS' });
  const second = reconcilePaymentChannels(['Cash', 'M-Pesa'], first, { currency: 'TZS' });
  assert.deepEqual(second, first);
  assert.equal(first.length, 2);
  assert.equal(findPaymentChannel(first, 'm-pesa')?.category, 'telco');
});

test('removing a payment method deactivates its account without deleting it', () => {
  const original = reconcilePaymentChannels(['Cash', 'NMB'], [], { currency: 'TZS' });
  const updated = reconcilePaymentChannels(['Cash'], original, { currency: 'TZS' });
  assert.equal(updated.length, original.length);
  assert.equal(updated.find(account => account.paymentMethod === 'NMB')?.status, 'inactive');
});

test('legacy matching account is linked and sensitive reference is masked', () => {
  const result = reconcilePaymentChannels(['NMB'], [{
    id: 'legacy-nmb',
    name: 'NMB',
    category: 'bank',
    provider: 'NMB',
    accountNumber: '0150294811000',
  }], { currency: 'TZS' });
  assert.equal(result.length, 1);
  assert.equal(result[0].paymentMethod, 'NMB');
  assert.equal(getMaskedAccountReference(result[0]), 'NMB •••• 1000');
  assert.equal(getMaskedAccountReference(result[0]).includes('0150294811000'), false);
});

test('delivery-only methods share the same treasury account registry', () => {
  const methods = getTreasuryPaymentMethods({
    paymentModes: ['Cash', 'M-Pesa'],
    deliveryPaymentModes: ['M-Pesa', 'NMB Delivery'],
  });
  assert.deepEqual(methods, ['Cash', 'M-Pesa', 'NMB Delivery']);
  const accounts = reconcilePaymentChannels(methods, [], { currency: 'TZS' });
  assert.equal(accounts.length, 3);
  assert.equal(findPaymentChannel(accounts, 'NMB Delivery')?.category, 'bank');
});

test('legacy malformed payment-account entries cannot crash reconciliation', () => {
  const malformed = [
    null,
    { name: 'Legacy NMB', provider: 'NMB', accountNumber: 12345678 },
    { id: 'cash-safe', name: 'Cash Account', paymentMethod: 'Cash', status: 'active' },
  ] as any;
  const channels = reconcilePaymentChannels(['Cash', 'NMB'], malformed, { currency: 'TZS' });

  assert.equal(channels.some(channel => channel.id === 'cash-safe'), true);
  assert.equal(channels.some(channel => channel.provider === 'NMB'), true);
  assert.equal(channels.every(channel => Boolean(channel?.id)), true);
});

test('atomic treasury migration is append-only, locked, idempotent, and RPC-only', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260727000100_atomic_treasury_ledger.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /create table if not exists public\.treasury_journals/i);
  assert.match(sql, /create table if not exists public\.treasury_journal_lines/i);
  assert.match(sql, /unique \(tenant_id, idempotency_key\)/i);
  assert.match(sql, /order by account_id\s+for update/gi);
  assert.match(sql, /balance_after >= 0/i);
  assert.match(sql, /before update or delete on public\.treasury_journals/i);
  assert.match(sql, /revoke all on table public\.treasury_journals from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.post_current_tenant_treasury_entry[\s\S]+to authenticated/i);
  assert.doesNotMatch(sql, /\b(delete from|truncate table|drop table)\b/i);
});

test('payment-account synchronization is non-destructive, masked, and opening-balance idempotent', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260727000200_treasury_account_sync.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /add column if not exists source_key text/i);
  assert.match(sql, /sync_current_tenant_treasury_accounts/i);
  assert.match(sql, /set status = 'inactive'/i);
  assert.match(sql, /v_masked_reference !~/i);
  assert.match(sql, /if v_is_new and v_opening_balance > 0/i);
  assert.match(sql, /'opening:' \|\| v_account_id::text/i);
  assert.match(sql, /post_current_tenant_treasury_split_entry/i);
  assert.match(sql, /order by value ->> 'accountId'/i);
  assert.match(sql, /private\.can_write_branch\(v_tenant_id, p_branch_id, 'money_bank\.post'\)/i);
  assert.doesNotMatch(sql, /\b(delete from|truncate table|drop table)\b/i);
});

test('sales, delivery, purchases, expenses, and payroll use canonical treasury posting', () => {
  const dashboard = readFileSync(new URL('../src/components/Dashboard.tsx', import.meta.url), 'utf8');
  const staff = readFileSync(new URL('../src/components/DashboardStaff.tsx', import.meta.url), 'utf8');
  const cashBank = readFileSync(new URL('../src/components/DashboardCashBank.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /postTreasurySplitIncome\(\{/);
  assert.match(dashboard, /sourceType:\s*'purchase'/);
  assert.match(dashboard, /expense\.payrollPaymentType \? 'payroll' : 'expense'/);
  assert.match(dashboard, /sourceType:\s*'delivery'/);
  assert.match(dashboard, /reverseTreasuryEntry\(/);
  assert.match(staff, /payrollPaymentType:\s*salaryPaymentType/);
  assert.match(staff, /payrollEnabled=\{subStatus\.plan\.id === 'tanzanite'\}|payrollEnabled/);
  assert.match(cashBank, /syncTreasuryPaymentAccounts\(channels, openingBalances\)/);
  assert.doesNotMatch(cashBank, /targetChannelId\s*=\s*'counter-01'/);
});

test('Money & Bank avoids duplicate account sync and excludes internal transfers from combined income', () => {
  const dashboard = readFileSync(new URL('../src/components/Dashboard.tsx', import.meta.url), 'utf8');
  const cashBank = readFileSync(new URL('../src/components/DashboardCashBank.tsx', import.meta.url), 'utf8');
  assert.match(cashBank, /lastAccountSyncSignatureRef/);
  assert.match(cashBank, /if \(lastAccountSyncSignatureRef\.current === syncSignature\) return/);
  assert.match(cashBank, /isInternalTransfer[\s\S]+if \(isInternalTransfer\) return/);
  assert.match(cashBank, /datePreset === '1week'\) relativeDays = 6/);
  assert.match(cashBank, /datePreset === '1month'\) relativeDays = 29/);
  assert.match(dashboard, /key=\{`\$\{activeTenant\.id\}:\$\{activeBranchSelection\.activeScope\}:/);
  assert.match(dashboard, /branchScopeKey=/);
});

test('two-device session migration serializes admissions without deleting sessions', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260714000100_strict_two_device_sessions.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /from public\.users[\s\S]+for update/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.start_user_session[\s\S]+from public, anon/i);
  assert.match(sql, /grant execute on function public\.start_user_session[\s\S]+to authenticated/i);
  assert.doesNotMatch(sql, /\b(delete from|truncate table|drop table|drop column)\b/i);
});
