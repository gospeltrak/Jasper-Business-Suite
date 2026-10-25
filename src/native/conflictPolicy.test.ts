import { describe, expect, it } from 'vitest';
import {
  admitOfflineSale, filterTombstonedProducts,
  operationIdempotencyKey, resolveOfflineSync,
  type NativeOperation, type OfflineStockGrant, type ProductTombstone,
} from './conflictPolicy';

const identity = { tenantId: 'tenant-A', branchId: 'branch-1', actorId: 'cashier-1', deviceId: 'device-1' };
const timestamp = '2026-10-25T12:00:00.000Z';
const snapshot = { scope: identity, revision: 'server-rev-101', capturedAt: '2026-10-25T11:00:00Z' };
const grant: OfflineStockGrant = {
  ...identity, leaseId: 'lease-1', productId: 'rice', reservedQuantity: 4,
  sourceStockRevision: 'stock-rev-91',
  issuedAt: '2026-10-25T10:00:00Z', expiresAt: '2026-10-26T10:00:00Z',
};
const sale = (overrides: Partial<NativeOperation> = {}): NativeOperation => {
  const op: NativeOperation = {
    ...identity, operationId: 'op-001', kind: 'sale', idempotencyKey: '',
    clientCreatedAt: timestamp, clientSequence: 1, baseSnapshotRevision: snapshot.revision,
    productDeltas: [{ productId: 'rice', quantity: 2 }], ...overrides,
  };
  op.idempotencyKey = overrides.idempotencyKey || operationIdempotencyKey(op);
  return op;
};
const receipt = (op: NativeOperation) => ({
  tenantId: op.tenantId, branchId: op.branchId,
  actorId: op.actorId, deviceId: op.deviceId,
  operationId: op.operationId, idempotencyKey: op.idempotencyKey,
  committedAt: '2026-10-25T12:00:30Z', stockCommitted: true, treasuryCommitted: true,
});

describe('Offline admission — conservative device stock leasing', () => {
  it('fails closed without verified server snapshot', () => {
    expect(admitOfflineSale(sale(), null, [grant], [], [], timestamp).category).toBe('missing_snapshot');
  });
  it.each([
    ['tenant', { tenantId: 'tenant-B' }],
    ['branch', { branchId: 'branch-2' }],
    ['staff', { actorId: 'cashier-2' }],
    ['device', { deviceId: 'device-2' }],
  ])('rejects cross-%s snapshot reuse', (_, change) => {
    expect(admitOfflineSale(sale(change), snapshot, [grant], [], [], timestamp).category).toBe('wrong_identity');
  });
  it('rejects stale snapshot version rather than last-write-wins', () => {
    expect(admitOfflineSale(sale({baseSnapshotRevision:'rev-old'}), snapshot, [grant], [], [], timestamp).category).toBe('bad_operation');
  });
  it('rejects missing or expired lease rather than treating globally cached stock as sellable', () => {
    expect(admitOfflineSale(sale(), snapshot, [], [], [], timestamp).category).toBe('lease_expired');
    expect(admitOfflineSale(sale(), snapshot, [grant], [], [], '2026-10-27T10:00:00Z').category).toBe('lease_expired');
  });
  it('rejects a stock lease issued to another tenant, branch, actor or device', () => {
    for (const field of ['tenantId','branchId','actorId','deviceId'] as const) {
      const foreign = { ...grant, [field]: 'another' };
      expect(admitOfflineSale(sale(), snapshot, [foreign], [], [], timestamp).allowed).toBe(false);
    }
  });
  it('accepts a first locally staged sale that fits its own reserved allowance', () => {
    expect(admitOfflineSale(sale(), snapshot, [grant], [], [], timestamp).allowed).toBe(true);
  });
  it('subtracts prior pending transactions before next offline sale', () => {
    const before = sale({ operationId: 'op-000', productDeltas: [{ productId:'rice', quantity: 3 }] });
    expect(admitOfflineSale(sale(), snapshot, [grant], [before], [], timestamp).category).toBe('insufficient_allowance');
  });
  it('prevents the same operation ID from silently replacing an existing sale', () => {
    expect(admitOfflineSale(sale(), snapshot, [grant], [sale()], [], timestamp).category).toBe('bad_operation');
  });
  it('cannot inflate allowance by caching a duplicate stock grant', () => {
    expect(admitOfflineSale(sale({ productDeltas: [{ productId:'rice',quantity:5 }] }), snapshot, [grant,grant], [], [], timestamp).category).toBe('insufficient_allowance');
  });
  it('does not consume another device or cashier offline quota as if it were local', () => {
    const other = sale({ deviceId: 'device-2', operationId: 'op-foreign', productDeltas: [{productId:'rice',quantity:4}] });
    expect(admitOfflineSale(sale(), snapshot, [grant], [other], [], timestamp).allowed).toBe(true);
  });
  it('validates fractional and duplicate item sums to protect scale-weight stock', () => {
    const op=sale({productDeltas:[{productId:'rice',quantity:2.25},{productId:'rice',quantity:2.25}]});
    expect(admitOfflineSale(op,snapshot,[grant],[],[],timestamp).category).toBe('insufficient_allowance');
  });
  it('never accepts negative, NaN or Infinity quantities', () => {
    for(const quantity of [-1, 0, NaN, Infinity]){
      const op=sale({productDeltas:[{productId:'rice',quantity}]});
      expect(admitOfflineSale(op,snapshot,[grant],[],[],timestamp).category).toBe('bad_operation');
    }
  });
  it('blocks sales of tombstoned products even when the offline cache still has them', () => {
    const tombstones: ProductTombstone[] = [{productId:'rice',branchId:'branch-1',deletedAt:timestamp,revision:'rev-102'}];
    expect(admitOfflineSale(sale(),snapshot,[grant],[],tombstones,timestamp).category).toBe('removed_product');
    expect(filterTombstonedProducts([{id:'rice'},{id:'beans'}],tombstones,'branch-1')).toEqual([{id:'beans'}]);
    expect(filterTombstonedProducts([{id:'rice'}],tombstones,'branch-2')).toEqual([{id:'rice'}]);
  });
  it('rejects invalid idempotency tokens and sequence', () => {
    expect(admitOfflineSale(sale({idempotencyKey:'unknown-token'}),snapshot,[grant],[],[],timestamp).category).toBe('bad_operation');
    expect(admitOfflineSale(sale({clientSequence:0}),snapshot,[grant],[],[],timestamp).category).toBe('bad_operation');
  });
  it('will not admit purchase or expense through the sale-only allowance', () => {
    expect(admitOfflineSale(sale({kind:'purchase'}),snapshot,[grant],[],[],timestamp).allowed).toBe(false);
    expect(admitOfflineSale(sale({kind:'expense'}),snapshot,[grant],[],[],timestamp).allowed).toBe(false);
  });
});

describe('Offline synchronization — immutable events and idempotent acknowledgements', () => {
  const op=sale();
  it.each(['network_failure','timeout','rate_limited','server_error'] as const)(
    'retains payload for retry on %s', state => {
      expect(resolveOfflineSync(op,{state}).resolution).toBe('retry');
    }
  );
  it('revalidates revoked staff without dropping pending events', () => {
    expect(resolveOfflineSync(op,{state:'unauthorized'}).resolution).toBe('blocked');
  });
  it.each(['stock','tombstone','price','credit','branch','duplicate_payload','lease_expired'] as const)(
    'routes %s conflicts for supervisor review',type=>{
      expect(resolveOfflineSync(op,{state:'conflict',reason:type,type}).resolution).toBe('needs_review');
    }
  );
  it('does not trust a cloud receipt belonging to a different tenant',()=>{
    expect(resolveOfflineSync(op,{state:'confirmed',receipt:{...receipt(op),tenantId:'tenant-B'}}).resolution).toBe('needs_review');
  });
  it('does not trust mismatched operation IDs or idempotency keys',()=>{
    expect(resolveOfflineSync(op,{state:'duplicate',receipt:{...receipt(op),operationId:'other'}}).resolution).toBe('needs_review');
    expect(resolveOfflineSync(op,{state:'confirmed',receipt:{...receipt(op),idempotencyKey:'other'}}).resolution).toBe('needs_review');
  });
  it('keeps the event until both stock and Money & Bank are committed',()=>{
    expect(resolveOfflineSync(op,{state:'confirmed',receipt:{...receipt(op),stockCommitted:false}}).resolution).toBe('retry');
    expect(resolveOfflineSync(op,{state:'confirmed',receipt:{...receipt(op),treasuryCommitted:false}}).resolution).toBe('retry');
  });
  it('accepts idempotent duplicate acknowledgement only with matching complete server receipt',()=>{
    expect(resolveOfflineSync(op,{state:'duplicate',receipt:receipt(op)}).resolution).toBe('complete');
  });
  it('uses committed-at from server rather than local clock for accounting confirmation',()=>{
    expect(resolveOfflineSync(op,{state:'confirmed',receipt:receipt(op)}).serverCommittedAt).toBe('2026-10-25T12:00:30Z');
  });
});
