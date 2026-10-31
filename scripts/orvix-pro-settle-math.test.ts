import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProShiftCash,
  type ProPostedCashMovement,
  type ProShiftCashScope,
} from '../src/modules/sales/utils/orvixProSettleMath';

const scope: ProShiftCashScope = {
  tenantId: 'tenant-a',
  branchId: 'branch-1',
  cashierId: 'cashier-1',
  shiftId: 'shift-1',
  currency: 'TZS',
  openingFloat: 100,
};

const movement = (
  id: string,
  source: ProPostedCashMovement['source'],
  direction: 'in' | 'out',
  amount: number,
  overrides: Partial<ProPostedCashMovement> = {},
): ProPostedCashMovement => ({
  id,
  journalLineId: 'line-' + id,
  ...scope,
  source,
  direction,
  amount,
  status: 'posted',
  ...overrides,
});

test('opening float remains separate from revenue; counted cash is NEVER guessed', () => {
  const result = calculateProShiftCash(scope, [
    movement('sale', 'sale_cash_collection', 'in', 150),
    movement('debt', 'debt_cash_collection', 'in', 20),
    movement('expense', 'petty_cash_expense', 'out', 10),
    movement('transfer', 'drawer_cash_transfer_out', 'out', 50),
  ]);
  assert.equal(result.openingFloat, 100);
  assert.equal(result.postedCashIn, 170);
  assert.equal(result.postedCashOut, 60);
  assert.equal(result.expectedCash, 210);
  assert.equal(result.actualCounted, null);
  assert.equal(result.discrepancy, null);
});

test('cashier can count zero and the discrepancy is calculated correctly', () => {
  const empty = calculateProShiftCash(scope, [], 0);
  assert.equal(empty.actualCounted, 0);
  assert.equal(empty.discrepancy, -100);
  const shortage = calculateProShiftCash(scope, [movement('x', 'sale_cash_collection', 'in', 200)], 280);
  assert.equal(shortage.expectedCash, 300);
  assert.equal(shortage.discrepancy, -20);
  const overage = calculateProShiftCash(scope, [], 120);
  assert.equal(overage.discrepancy, 20);
});

test('pending and reversed events never inflate drawer totals', () => {
  const result = calculateProShiftCash(scope, [
    movement('pending', 'sale_cash_collection', 'in', 300, { status: 'pending' }),
    movement('reversed', 'sale_cash_collection', 'in', 400, { status: 'reversed' }),
    movement('ok', 'sale_cash_collection', 'in', 20),
  ]);
  assert.equal(result.expectedCash, 120);
  assert.equal(result.postedMovements, 1);
  assert.equal(result.ignoredPendingMovements, 2);
});

test('idempotently repeated journal events are counted once', () => {
  const posted = movement('sale', 'sale_cash_collection', 'in', 20);
  const result = calculateProShiftCash(scope, [posted, { ...posted }]);
  assert.equal(result.expectedCash, 120);
  assert.equal(result.postedMovements, 1);
  assert.throws(() => calculateProShiftCash(scope, [posted, { ...posted, amount: 25 }]), /Conflicting duplicated/);
});

test('same immutable treasury line cannot be double-counted under a different event ID', () => {
  const first = movement('sale1', 'sale_cash_collection', 'in', 20);
  const repeated = movement('sale2', 'sale_cash_collection', 'in', 20, { journalLineId: first.journalLineId });
  const result = calculateProShiftCash(scope, [first, repeated]);
  assert.equal(result.expectedCash, 120);
  assert.equal(result.postedMovements, 1);
  assert.throws(() => calculateProShiftCash(scope, [first, { ...repeated, amount: 25 }]), /Conflicting duplicated treasury journal line/);
});

test('mismatched tenant, branch, cashier, shift or currency fails closed', () => {
  for (const field of ['tenantId', 'branchId', 'cashierId', 'shiftId', 'currency'] as const) {
    const value = movement('sale', 'sale_cash_collection', 'in', 10, { [field]: 'wrong' });
    assert.throws(() => calculateProShiftCash(scope, [value]), /Mismatched/);
  }
});

test('reject forged or untraceable physical cash movements', () => {
  assert.throws(() => calculateProShiftCash(scope, [movement('card', 'card_payment' as any, 'in', 20)]), /Unknown/);
  assert.throws(() => calculateProShiftCash(scope, [movement('refund', 'cash_refund', 'in', 20)]), /direction conflicts/);
  assert.throws(() => calculateProShiftCash(scope, [movement('bad', 'sale_cash_collection', 'in', -1)]), /non-negative/);
  assert.throws(() => calculateProShiftCash(scope, [movement('bad', 'sale_cash_collection', 'in', 0.001)]), /decimal/);
  assert.throws(() => calculateProShiftCash(scope, [movement('missing', 'sale_cash_collection', 'in', 20, { journalLineId: '' })]), /traceable/);
});

test('fractional cash amounts reconcile without floating point errors', () => {
  const result = calculateProShiftCash({ ...scope, openingFloat: 0.1 }, [
    movement('one', 'debt_cash_collection', 'in', 0.2),
  ], 0.3);
  assert.equal(result.expectedCash, 0.3);
  assert.equal(result.discrepancy, 0);
});
