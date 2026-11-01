import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrvixProBilling,
  type ProBillingContract,
  type ProPaymentEvidence,
} from '../src/modules/platform-admin/utils/orvixProBilling';

const contract: ProBillingContract = {
  tenantId: 'pro-business-a',
  invoiceId: 'invoice-november',
  currency: 'TZS',
  monthlyFee: 200000,
  startsAt: '2026-11-01T00:00:00+03:00',
  endsAt: '2026-12-01T00:00:00+03:00',
};
const paid = (id: string, amount: number, status: ProPaymentEvidence['status'] = 'verified'): ProPaymentEvidence =>
  ({ id, tenantId: contract.tenantId, invoiceId: contract.invoiceId, currency: contract.currency, amount, status });

test('partial payments do not activate or renew the Pro contract', () => {
  const result = calculateOrvixProBilling(contract, [paid('one', 100000)], 0, '2026-11-10T10:00:00+03:00');
  assert.equal(result.amountRemaining, 100000);
  assert.equal(result.eligibleForActivation, false);
  assert.equal(result.paymentComplete, false);
});

test('verified installments together cover the negotiated monthly fee', () => {
  const r = calculateOrvixProBilling(contract, [paid('1', 50000), paid('2', 150000)], 0, '2026-11-10T10:00:00+03:00');
  assert.equal(r.amountRemaining, 0);
  assert.equal(r.eligibleForActivation, true);
  assert.equal(r.verifiedPaymentCount, 2);
});

test('overpayment is retained as credit and never silently charged again', () => {
  const r = calculateOrvixProBilling(contract, [paid('1', 250000)], 0, '2026-11-10T10:00:00+03:00');
  assert.equal(r.creditAvailable, 50000);
  assert.equal(r.amountCovered, 200000);
});

test('opening credit reduces amount owed without mutating old contract', () => {
  const r = calculateOrvixProBilling(contract, [paid('1', 150000)], 50000, '2026-11-10T10:00:00+03:00');
  assert.equal(r.eligibleForActivation, true);
  assert.equal(r.openingCreditApplied, 50000);
});

test('pending, failed and reversed payments are not considered received', () => {
  const r = calculateOrvixProBilling(contract, [
    paid('1', 200000, 'pending'), paid('2', 200000, 'failed'), paid('3', 200000, 'reversed'),
  ], 0, '2026-11-10T10:00:00+03:00');
  assert.equal(r.verifiedPaymentTotal, 0);
  assert.equal(r.amountRemaining, 200000);
  assert.equal(r.ignoredUnverifiedCount, 3);
});

test('repeat payment evidence is idempotent, conflicts fail closed', () => {
  const first = paid('a', 100000);
  assert.equal(calculateOrvixProBilling(contract, [first, { ...first }]).amountRemaining, 100000);
  assert.throws(() => calculateOrvixProBilling(contract, [first, { ...first, amount: 90000 }]), /Conflicting/);
});

test('cross-tenant, cross-invoice or cross-currency payments are forbidden', () => {
  for (const mismatch of [
    { tenantId: 'other-business' }, { invoiceId: 'different-month' }, { currency: 'USD' },
  ]) {
    assert.throws(() => calculateOrvixProBilling(contract, [paid('a', 200000, 'verified')].map(p => ({ ...p, ...mismatch }))), /different tenant/);
  }
});

test('expired or future periods never qualify, even if fully paid', () => {
  assert.equal(calculateOrvixProBilling(contract, [paid('a', 200000)], 0, '2026-12-01T00:00:00+03:00').eligibleForActivation, false);
  assert.equal(calculateOrvixProBilling(contract, [paid('a', 200000)], 0, '2026-10-20T00:00:00+03:00').eligibleForActivation, false);
});

test('reject invalid fee and non-finite payment amounts', () => {
  assert.throws(() => calculateOrvixProBilling({ ...contract, monthlyFee: 0 }, []), /positive/);
  assert.throws(() => calculateOrvixProBilling(contract, [paid('a', Infinity)]), /positive/);
  assert.throws(() => calculateOrvixProBilling(contract, [paid('a', 0.001)]), /two decimals/);
  assert.throws(() => calculateOrvixProBilling(contract, [], -1), /positive/);
});
