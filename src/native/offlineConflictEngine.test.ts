import { describe, expect, it } from 'vitest';
import {
  evaluateServerResponse, retryDelayMs, simulateStockAdmission,
  mayRestoreDeletedRecord,
  type LocalStockBudget, type OfflineSaleIntent, type OperationIdentity, type StockGrant, type ServerReceipt,
} from './offlineConflictEngine';

const op: OperationIdentity = {
  tenantId: 'tenant-A', branchId: 'branch-A', actorId: 'cashier-A',
  deviceId: 'phone-A', operationId: 'sale-UUID', idempotencyKey: 'tenant-A:branch-A:phone-A:sale:sale-UUID',
  type: 'sale', baseSnapshotRevision: 'revision-12', createdAt: '2026-10-25T10:00:00.000Z',
};
const receipt: ServerReceipt = {
  tenantId: op.tenantId, branchId: op.branchId, operationId: op.operationId,
  idempotencyKey: op.idempotencyKey, type: op.type, status: 'committed',
  inventoryCommitted: true, treasuryCommitted: true,
  serverRevision: 'revision-13', serverCommittedAt: '2026-10-25T10:05:00.000Z',
};
const grant: StockGrant = {
  tenantId: op.tenantId, branchId: op.branchId, actorId: op.actorId, deviceId: op.deviceId,
  grantId: 'grant-A', productId: 'product-A', snapshotRevision: op.baseSnapshotRevision,
  allowedMicros: '8000000', remainingMicros: '8000000',
  expiresAtServer: '2026-10-26T10:00:00.000Z',
};
const sale: OfflineSaleIntent = { ...op, type: 'sale', lines: [{ grantId: grant.grantId, productId: grant.productId, quantityMicros: '2500000' }] };
function budget(overrides?: Partial<StockGrant>): LocalStockBudget {
  return { grants: [{ ...grant, ...overrides }], appliedOperationIds: [] };
}
function receiptOutcome(input: Partial<ServerReceipt> = {}, status = 200) {
  return evaluateServerResponse(op, { httpStatus: status, receipt: { ...receipt, ...input } });
}

describe('Sync receipts: never delete or overwrite an unacknowledged offline action', () => {
  it('commits only with the same operation identity and both financial/stock confirmations', () => {
    expect(receiptOutcome().outcome).toBe('complete');
    expect(receiptOutcome({ status: 'already_committed' }).outcome).toBe('complete');
  });
  it.each([
    ['tenantId', 'tenant-B'], ['branchId', 'branch-B'], ['operationId', 'different-id'],
    ['idempotencyKey', 'different-key'], ['type', 'purchase'],
  ] as const)('blocks a mismatched server receipt (%s)', (field, value) => {
    expect(receiptOutcome({ [field]: value }).outcome).toBe('blocked');
  });
  it('does not trust HTTP 200 without a durable receipt', () => {
    expect(evaluateServerResponse(op, {httpStatus:200}).outcome).toBe('retry_wait');
    expect(receiptOutcome({ serverRevision: '' }).outcome).toBe('retry_wait');
    expect(receiptOutcome({ serverCommittedAt: '' }).outcome).toBe('retry_wait');
    expect(receiptOutcome({ serverCommittedAt: 'invalid' }).outcome).toBe('retry_wait');
  });
  it('holds transactions when stock or treasury posting did not finish', () => {
    expect(receiptOutcome({ inventoryCommitted: false }).outcome).toBe('retry_wait');
    expect(receiptOutcome({ treasuryCommitted: false }).outcome).toBe('retry_wait');
    expect(evaluateServerResponse({ ...op, type: 'expense' }, { httpStatus: 200, receipt: {
      ...receipt, type: 'expense', inventoryCommitted: false, treasuryCommitted: true,
    }}).outcome).toBe('complete');
  });
  it('preserves blocked staff operations locally for authenticated recovery', () => {
    expect(evaluateServerResponse(op, {httpStatus:401}).outcome).toBe('blocked');
    expect(evaluateServerResponse(op, {httpStatus:403}).outcome).toBe('blocked');
  });
  it.each([409, 410, 412, 422])('sends status %d to review instead of replaying tombstones', status => {
    expect(evaluateServerResponse(op, {httpStatus:status}).outcome).toBe('needs_review');
  });
  it.each([408, 425, 429, 500, 502, 503, 504])('retries transient status %d without discarding data', status => {
    expect(evaluateServerResponse(op, {httpStatus:status}).outcome).toBe('retry_wait');
  });
  it('retries network loss and response-loss-after-commit', () => {
    expect(evaluateServerResponse(op, {networkFailed:true}).outcome).toBe('retry_wait');
    expect(evaluateServerResponse(op, {httpStatus:200}).outcome).toBe('retry_wait');
    expect(receiptOutcome({status:'already_committed'}).outcome).toBe('complete');
  });
  it('requires human review after explicit server rejection', () => {
    expect(receiptOutcome({status:'conflict', conflictCode:'PRODUCT_DELETED'})).toEqual({
      outcome:'needs_review', code:'PRODUCT_DELETED',
    });
    expect(receiptOutcome({status:'rejected'}).outcome).toBe('needs_review');
  });
  it('backoff is bounded and deterministic for different devices', () => {
    for (let attempt=0;attempt<100;attempt++) {
      expect(retryDelayMs(attempt,op.idempotencyKey)).toBeGreaterThanOrEqual(1000);
      expect(retryDelayMs(attempt,op.idempotencyKey)).toBeLessThanOrEqual(1800000);
    }
    expect(retryDelayMs(5,op.idempotencyKey)).toBe(retryDelayMs(5,op.idempotencyKey));
    expect(retryDelayMs(4,op.idempotencyKey)).not.toBe(retryDelayMs(4,'other-device'));
  });
});

describe('Atomic stock grant model for simultaneous offline cashiers', () => {
  it('admits only from a scoped server-issued reservation and subtracts micro-units', () => {
    const initial = budget();
    const result = simulateStockAdmission(sale,initial);
    expect(result.outcome).toBe('accepted');
    expect(result.next?.grants[0].remainingMicros).toBe('5500000');
    expect(result.next?.appliedOperationIds).toEqual([sale.idempotencyKey]);
    expect(initial.grants[0].remainingMicros).toBe('8000000');
  });
  it('a retry with identical idempotency key consumes no stock twice', () => {
    const once = simulateStockAdmission(sale,budget());
    const twice = simulateStockAdmission(sale,once.next!);
    expect(twice.outcome).toBe('duplicate');
    expect(twice.next?.grants[0].remainingMicros).toBe('5500000');
  });
  it('two sequential operations on one reserved balance cannot oversell', () => {
    const first = simulateStockAdmission(sale,budget());
    const other: OfflineSaleIntent = { ...sale, operationId:'sale-UUID-2',idempotencyKey:'op-2',
      lines:[{...sale.lines[0],quantityMicros:'6000000'}] };
    const second = simulateStockAdmission(other,first.next!);
    expect(second.outcome).toBe('needs_review');
    expect(second.code).toBe('insufficient_reserved_stock');
    expect(first.next?.grants[0].remainingMicros).toBe('5500000');
  });
  it('two devices cannot spend another device allocation even on the same product', () => {
    const deviceB: OfflineSaleIntent = { ...sale, deviceId:'phone-B', idempotencyKey:'phone-B:sale-1' };
    expect(simulateStockAdmission(deviceB,budget()).code).toBe('no_scoped_server_stock_grant');
    const split = budget();
    split.grants.push({...grant, deviceId:'phone-B',grantId:'grant-B', allowedMicros:'4000000', remainingMicros:'4000000'});
    deviceB.lines[0] = {...deviceB.lines[0],grantId:'grant-B'};
    const result = simulateStockAdmission(deviceB,split);
    expect(result.outcome).toBe('accepted');
    expect(result.next?.grants[0].remainingMicros).toBe('8000000');
    expect(result.next?.grants[1].remainingMicros).toBe('1500000');
  });
  it.each([
    ['tenantId','tenant-B'],['branchId','branch-B'],['actorId','cashier-B'],['deviceId','phone-B'],
  ] as const)('blocks grants from another %s', (field,value) => {
    expect(simulateStockAdmission(sale,budget({[field]:value})).outcome).toBe('blocked');
  });
  it('uses server revision, not client wall-clock timestamps, for stock snapshots', () => {
    expect(simulateStockAdmission(sale,budget({snapshotRevision:'revision-99'})).code).toBe('stock_snapshot_changed');
    expect(simulateStockAdmission({...sale,createdAt:'1999-01-01'},budget()).outcome).toBe('accepted');
  });
  it('stops a revoked grant and missing grant rather than using global stock', () => {
    expect(simulateStockAdmission(sale,budget({revoked:true})).outcome).toBe('needs_review');
    expect(simulateStockAdmission(sale,{grants:[],appliedOperationIds:[]}).outcome).toBe('blocked');
  });
  it('never trusts invalid balances, missing expiry or a zero/negative/float quantity', () => {
    expect(simulateStockAdmission(sale,budget({remainingMicros:'999999999'})).outcome).toBe('blocked');
    expect(simulateStockAdmission(sale,budget({remainingMicros:'-1'})).outcome).toBe('blocked');
    expect(simulateStockAdmission(sale,budget({expiresAtServer:'wat'})).outcome).toBe('blocked');
    for (const quantityMicros of ['0','-2','2.5','1e9','', '10000000000000000000000000']) {
      expect(simulateStockAdmission({...sale,lines:[{...sale.lines[0],quantityMicros}]},budget()).outcome).toBe('blocked');
    }
  });
  it('prevents splitting quantity into two lines to exceed the same grant', () => {
    const combined = {...sale,lines:[
      {...sale.lines[0],quantityMicros:'5000000'},
      {...sale.lines[0],quantityMicros:'5000000'},
    ]};
    expect(simulateStockAdmission(combined,budget()).outcome).toBe('needs_review');
  });
  it('a failed multi-product sale never mutates any grant balance', () => {
    const initial=budget();
    const multi={...sale,lines:[
      sale.lines[0],
      { productId:'missing-product',grantId:'missing-grant',quantityMicros:'1' },
    ]};
    expect(simulateStockAdmission(multi,initial).outcome).toBe('blocked');
    expect(initial.grants[0].remainingMicros).toBe('8000000');
    expect(initial.appliedOperationIds).toEqual([]);
  });
  it('product tombstone is not undone by an older device snapshot', () => {
    expect(mayRestoreDeletedRecord(true,false)).toBe(false);
    expect(mayRestoreDeletedRecord(true,true)).toBe(true);
    expect(mayRestoreDeletedRecord(false,false)).toBe(true);
  });
});
