import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptNativeOfflineCommand,
  OfflineLedgerConflict,
  type OfflineCommand, type OfflineSqlClient, type OfflineSqlPool,
  type OfflineServerCallbacks, type VerifiedOfflineCaller,
} from './nativeOfflineLedger';
import { offlinePayloadDigest } from '../native/offlinePayloadDigest';

const id = {
  tenant: '11111111-1111-4111-8111-111111111111',
  branch: '22222222-2222-4222-8222-222222222222',
  actor: '33333333-3333-4333-8333-333333333333',
  device: '44444444-4444-4444-8444-444444444444',
  operation: '55555555-5555-4555-8555-555555555555',
};

type LedgerRow = Record<string, any>;
type State = { ledger: Map<string, LedgerRow>; treasuryCount: number; stockCount: number };
const copyState = (src: State): State => ({
  ledger: new Map(Array.from(src.ledger, ([key, value]) => [key, structuredClone(value)])),
  treasuryCount: src.treasuryCount,
  stockCount: src.stockCount,
});

/**
 * In-memory *SQL boundary* fake: BEGIN/COMMIT/ROLLBACK changes only a private
 * working snapshot, which lets us verify fail-closed transaction behavior.
 * It is NOT a replacement for Postgres concurrent integration tests.
 */
class FakeSqlPool implements OfflineSqlPool {
  state: State = { ledger: new Map(), treasuryCount: 0, stockCount: 0 };
  commands: string[] = [];
  commits = 0;
  rollbacks = 0;
  connects = 0;
  releases = 0;
  async connect(): Promise<OfflineSqlClient> {
    this.connects++;
    let working: State | null = null;
    const query: OfflineSqlClient['query'] = async (sql, params=[]) => {
      this.commands.push(sql.trim().slice(0,88));
      if (sql === 'BEGIN') {
        working = copyState(this.state);
        return { rows: [] };
      }
      if (sql === 'ROLLBACK') {
        this.rollbacks++;
        working = null;
        return { rows: [] };
      }
      if (sql === 'COMMIT') {
        if (!working) throw new Error('No transaction');
        this.state = working;
        this.commits++;
        working = null;
        return { rows: [] };
      }
      if (!working) throw new Error('Query outside transaction');
      if (sql.includes('FROM public.tenant_workspaces')) {
        return { rows: [{tenant_id: id.tenant}] };
      }
      if (sql.includes('INSERT INTO private.native_offline_operation_ledger')) {
        const [tenant_id,branch_id,actor_id,device_id,operation_id,operation_type,
          idempotency_key,payload_digest,payload,base_snapshot_revision,client_sequence,client_created_at] = params;
        const rowKey = tenant_id + '|' + idempotency_key;
        const collision = Array.from(working.ledger.values()).some(
          row => row.tenant_id === tenant_id &&
            row.operation_type === operation_type &&
            row.operation_id === operation_id,
        );
        if (!working.ledger.has(rowKey) && !collision) {
          working.ledger.set(rowKey, {
            tenant_id,branch_id,actor_id,device_id,operation_id,operation_type,
            idempotency_key,payload_digest,payload:JSON.parse(payload),
            base_snapshot_revision,client_sequence,client_created_at,
            status:'claimed',receipt:null,
          });
        }
        return { rows: [] };
      }
      if (sql.includes('FROM private.native_offline_operation_ledger')) {
        const [tenant, key] = params;
        const row = working.ledger.get(tenant+'|'+key);
        return { rows: row ? [structuredClone(row)] : [] };
      }
      if (sql.startsWith('SELECT gen_random_uuid()')) {
        return { rows: [{
          server_revision:'66666666-6666-4666-8666-666666666666',
          server_committed_at: new Date('2026-10-25T16:00:00.000Z'),
        }] };
      }
      if (sql.includes('UPDATE private.native_offline_operation_ledger')) {
        const [tenant,key,committedAt,receipt] = params;
        const row = working.ledger.get(tenant+'|'+key);
        if (!row || row.status !== 'claimed') return { rows: [] };
        row.status = 'committed';
        row.committed_at = committedAt;
        row.receipt = JSON.parse(receipt);
        return { rows: [{idempotency_key:key}] };
      }
      if (sql === 'MOCK_ADD_TREASURY') { working.treasuryCount++; return {rows:[]}; }
      if (sql === 'MOCK_ADD_STOCK') { working.stockCount++; return {rows:[]}; }
      throw new Error('Unknown SQL operation in test: '+sql);
    };
    return { query, release: () => {this.releases++} };
  }
}
const caller: VerifiedOfflineCaller = {
  tenantId:id.tenant,branchId:id.branch,actorId:id.actor,
};
const makeCommand = async (override: Partial<OfflineCommand> = {}): Promise<OfflineCommand> => {
  const payload = override.payload ?? {id:id.operation, tenantId:id.tenant, branchId:id.branch, total:17000};
  return {
    ...caller,deviceId:id.device,operationId:id.operation,
    type:'sale',idempotencyKey:[id.tenant,id.branch,id.device,'sale',id.operation].join(':'),
    payloadDigest: await offlinePayloadDigest(payload),
    baseSnapshotRevision:'server-r17',clientSequence:1,createdAt:'2026-10-25T13:00:00Z',
    payload,...override,
  };
};
function callbacks(options: { authorized?: boolean; failAt?: 'stock' | 'treasury'; inventory?: boolean; treasury?: boolean }={}): OfflineServerCallbacks & {
  verifyFreshPermissions: ReturnType<typeof vi.fn>;
  applyAtomicEffects: ReturnType<typeof vi.fn>;
} {
  return {
    verifyFreshPermissions: vi.fn(async () => {
      if (options.authorized === false) throw new Error('User no longer has branch permission');
    }),
    applyAtomicEffects: vi.fn(async (tx: OfflineSqlClient, command: OfflineCommand) => {
      if (command.type !== 'expense') await tx.query('MOCK_ADD_STOCK');
      if (options.failAt === 'stock') throw new Error('Insufficient reserved stock');
      await tx.query('MOCK_ADD_TREASURY');
      if (options.failAt === 'treasury') throw new Error('Treasury temporarily unavailable');
      return { inventoryCommitted: options.inventory ?? true, treasuryCommitted: options.treasury ?? true };
    }),
  } as any;
}
describe('Server-side transactional offline idempotency ledger', () => {
  let db: FakeSqlPool;
  beforeEach(()=>{db=new FakeSqlPool()});

  it('accepts once and returns a durable receipt for the exact actor/device/payload', async () => {
    const cmd=await makeCommand();
    const result=await acceptNativeOfflineCommand(db,caller,cmd,callbacks());
    expect(result).toMatchObject({
      tenantId:id.tenant,branchId:id.branch,actorId:id.actor,deviceId:id.device,
      operationId:id.operation,payloadDigest:cmd.payloadDigest,
      inventoryCommitted:true,treasuryCommitted:true,status:'committed',
    });
    expect(db.state.treasuryCount).toBe(1);
    expect(db.state.stockCount).toBe(1);
    expect(db.state.ledger.size).toBe(1);
    expect(db.releases).toBe(1);
  });

  it('retries a lost HTTP acknowledgement without double inventory or payment posting', async () => {
    const cmd=await makeCommand();
    const first=await acceptNativeOfflineCommand(db,caller,cmd,callbacks());
    const secondHooks=callbacks();
    const second=await acceptNativeOfflineCommand(db,caller,cmd,secondHooks);
    expect(second).toEqual(first);
    expect(secondHooks.applyAtomicEffects).not.toHaveBeenCalled();
    expect(secondHooks.verifyFreshPermissions).toHaveBeenCalledTimes(1);
    expect(db.state.treasuryCount).toBe(1);
    expect(db.state.stockCount).toBe(1);
    expect(db.commits).toBe(2);
  });

  it('rejects a changed payment amount under the same idempotency key', async () => {
    const cmd=await makeCommand();
    await acceptNativeOfflineCommand(db,caller,cmd,callbacks());
    const changed=await makeCommand({payload:{...cmd.payload,total:17500}});
    await expect(acceptNativeOfflineCommand(db,caller,changed,callbacks())).rejects.toThrow(OfflineLedgerConflict);
    expect(db.state.treasuryCount).toBe(1);
    expect(db.rollbacks).toBe(1);
  });

  it('refuses the same sale ID under a fresh device/key rather than double-selling', async () => {
    const cmd=await makeCommand();
    await acceptNativeOfflineCommand(db,caller,cmd,callbacks());
    const anotherDevice='77777777-7777-4777-8777-777777777777';
    const changed=await makeCommand({
      deviceId:anotherDevice,
      idempotencyKey:[id.tenant,id.branch,anotherDevice,'sale',id.operation].join(':'),
    });
    await expect(acceptNativeOfflineCommand(db,caller,changed,callbacks())).rejects.toThrow(/already used/);
    expect(db.state.stockCount).toBe(1);
    expect(db.state.treasuryCount).toBe(1);
  });

  it('forbids a forged tenant or branch before opening a database transaction', async () => {
    const cmd=await makeCommand({tenantId:'88888888-8888-4888-8888-888888888888'});
    await expect(acceptNativeOfflineCommand(db,caller,cmd,callbacks())).rejects.toThrow(/scope/);
    expect(db.connects).toBe(0);
    expect(db.state.ledger.size).toBe(0);
  });

  it('refuses changed payload with an outdated digest before acquiring SQL lock', async () => {
    const cmd=await makeCommand();
    cmd.payload.total=99999999;
    await expect(acceptNativeOfflineCommand(db,caller,cmd,callbacks())).rejects.toThrow(/content changed/);
    expect(db.connects).toBe(0);
  });

  it('revoked staff cannot replay old committed receipt or submit new records', async () => {
    const cmd=await makeCommand();
    await acceptNativeOfflineCommand(db,caller,cmd,callbacks());
    const disabled=callbacks({authorized:false});
    await expect(acceptNativeOfflineCommand(db,caller,cmd,disabled)).rejects.toThrow(/permission/);
    expect(db.state.stockCount).toBe(1);
    expect(db.state.treasuryCount).toBe(1);
  });

  it('a Treasury error rolls back sale and reserved stock effects atomically', async () => {
    const cmd=await makeCommand();
    await expect(acceptNativeOfflineCommand(db,caller,cmd,callbacks({failAt:'treasury'})))
      .rejects.toThrow(/Treasury temporarily unavailable/);
    expect(db.state.stockCount).toBe(0);
    expect(db.state.treasuryCount).toBe(0);
    expect(db.state.ledger.size).toBe(0);
    expect(db.rollbacks).toBe(1);
    await acceptNativeOfflineCommand(db,caller,cmd,callbacks());
    expect(db.state.stockCount).toBe(1);
  });

  it('an inventory failure rolls back the ledger and does not post money', async () => {
    const cmd=await makeCommand();
    await expect(acceptNativeOfflineCommand(db,caller,cmd,callbacks({failAt:'stock'})))
      .rejects.toThrow(/Insufficient reserved stock/);
    expect(db.state.ledger.size).toBe(0);
    expect(db.state.treasuryCount).toBe(0);
  });

  it('an incomplete effects confirmation never produces a committed receipt', async () => {
    const cmd=await makeCommand();
    await expect(acceptNativeOfflineCommand(db,caller,cmd,callbacks({treasury:false})))
      .rejects.toThrow(/not completed/);
    expect(db.state.ledger.size).toBe(0);
  });

  it('an expense does not touch inventory and still posts money once', async () => {
    const expenseId='99999999-9999-4999-8999-999999999999';
    const payload={id:expenseId,tenantId:id.tenant,branchId:id.branch,amount:1000};
    const cmd=await makeCommand({
      operationId:expenseId,type:'expense',payload,
      payloadDigest:await offlinePayloadDigest(payload),
      idempotencyKey:[id.tenant,id.branch,id.device,'expense',expenseId].join(':'),
    });
    const result=await acceptNativeOfflineCommand(db,caller,cmd,callbacks());
    expect(result.inventoryCommitted).toBe(false);
    expect(result.treasuryCommitted).toBe(true);
    expect(db.state.stockCount).toBe(0);
    expect(db.state.treasuryCount).toBe(1);
  });

  it('uses tenant workspace row FOR UPDATE before claiming idempotency key', async () => {
    await acceptNativeOfflineCommand(db,caller,await makeCommand(),callbacks());
    const locks=db.commands.findIndex(s=>s.includes('FROM public.tenant_workspaces'));
    const claims=db.commands.findIndex(s=>s.includes('INSERT INTO private.native_offline_operation_ledger'));
    const exists=db.commands.findIndex(s=>s.includes('FROM private.native_offline_operation_ledger'));
    expect(locks).toBeGreaterThanOrEqual(0);
    expect(claims).toBeGreaterThan(locks);
    expect(exists).toBeGreaterThan(claims);
  });
});
