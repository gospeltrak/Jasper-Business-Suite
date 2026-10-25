import { describe, expect, it, vi } from 'vitest';
import { syncNativeOperations, type NativeSyncStore, type NativeSyncTransport } from './offlineSyncCoordinator';
import type { NativeJournalEntry, NativeJournalScope, NativeJournalStatus } from './offlineJournal';
import type { ServerReceipt, SyncResponse } from './offlineConflictEngine';

const scope: NativeJournalScope = {
  tenantId: 'tenant-lim', branchId: 'lim-primary',
  actorId: 'staff-fraidha', deviceId: 'android-001',
};
const otherScope: NativeJournalScope = { ...scope, actorId: 'different-staff' };

function entry(
  id: string, type: NativeJournalEntry['type'] = 'sale',
  options: Partial<NativeJournalEntry> = {},
): NativeJournalEntry {
  return {
    ...scope,
    key: `${scope.tenantId}::${scope.branchId}::${scope.actorId}::${scope.deviceId}::${id}`,
    idempotencyKey: `${scope.tenantId}:${scope.branchId}:${scope.deviceId}:${type}:${id}`,
    operationId: id, type, baseSnapshotRevision: 'server-r11',
    clientSequence: 1, createdAt: '2026-10-25T12:00:00Z',
    status: 'pending', payload: { id }, attempts: 0, ...options,
  };
}
function receipt(item: NativeJournalEntry): ServerReceipt {
  return {
    tenantId: item.tenantId, branchId: item.branchId,
    operationId: item.operationId, idempotencyKey: item.idempotencyKey,
    type: item.type, status: 'committed',
    inventoryCommitted: true, treasuryCommitted: true,
    serverRevision: 'server-r12', serverCommittedAt: '2026-10-25T12:01:00Z',
  };
}
function success(item: NativeJournalEntry): SyncResponse {
  return { httpStatus: 200, receipt: receipt(item) };
}
function factory(
  initial: NativeJournalEntry[],
  options: { online?: boolean; authorized?: boolean; responder?: (x: NativeJournalEntry) => Promise<SyncResponse> } = {},
) {
  const records = initial.map(e => ({ ...e }));
  const actions: string[] = [];
  let online = options.online ?? true;
  let authorized = options.authorized ?? true;
  const store: NativeSyncStore = {
    list: vi.fn(async () => records.map(e => ({ ...e }))),
    transition: vi.fn(async (e: NativeJournalEntry, status: Exclude<NativeJournalStatus, 'complete'>, reason?: string) => {
      actions.push(`transition:${e.operationId}:${status}:${reason || ''}`);
      const existing = records.find(r => r.key === e.key);
      if (!existing) throw new Error('durable write unavailable');
      existing.status = status;
      existing.attempts++;
    }),
    commitReceipt: vi.fn(async (e: NativeJournalEntry, r: ServerReceipt) => {
      actions.push(`commit:${e.operationId}`);
      const existing = records.find(row => row.key === e.key);
      if (!existing || r.idempotencyKey !== existing.idempotencyKey) throw new Error('receipt mismatch');
      existing.status = 'complete';
    }),
  };
  const transport: NativeSyncTransport = {
    submit: vi.fn(async (e: NativeJournalEntry) => options.responder ? options.responder(e) : success(e)),
  };
  const checks = {
    online: vi.fn(() => online),
    verifyOnlineSession: vi.fn(async () => authorized),
  };
  return {
    store, transport, checks, records, actions,
    setOnline(value: boolean) { online = value; },
    setAuthorized(value: boolean) { authorized = value; },
  };
}

describe('Offline sync coordinator: no data loss on worst-case failures', () => {
  it('never uploads when offline, preserves all entries', async () => {
    const x = factory([entry('s1'), entry('e1','expense')], { online: false });
    const result = await syncNativeOperations(scope, x);
    expect(result.reason).toBe('offline');
    expect(x.transport.submit).not.toHaveBeenCalled();
    expect(x.records.map(r=>r.status)).toEqual(['pending','pending']);
  });
  it('never uploads when staff session is not reverified', async () => {
    const x = factory([entry('s1')], { authorized: false });
    const result = await syncNativeOperations(scope, x);
    expect(result.reason).toBe('session_not_verified');
    expect(x.transport.submit).not.toHaveBeenCalled();
    expect(x.actions).toEqual([]);
  });
  it('does not upload or cross tenant/branch when journal returns a foreign operation', async () => {
    const forged = entry('s1','sale',{ ...otherScope });
    const x = factory([forged]);
    const result = await syncNativeOperations(scope,x);
    expect(result.reason).toBe('journal_scope_mismatch');
    expect(x.transport.submit).not.toHaveBeenCalled();
    expect(x.records[0].status).toBe('pending');
  });
  it('sorts by device sequence, not potentially manipulated client timestamps', async () => {
    const x = factory([
      entry('late', 'sale', {clientSequence: 2, createdAt:'1995-01-01'}),
      entry('early','purchase',{clientSequence: 1, createdAt:'2099-01-01'}),
    ]);
    const result = await syncNativeOperations(scope,x);
    expect(result.completed).toBe(2);
    expect(vi.mocked(x.transport.submit).mock.calls.map(([e])=>e.operationId)).toEqual(['early','late']);
  });
  it('a server timeout AFTER successful commit keeps operation, next pass uses same key', async () => {
    let attempt = 0;
    const x = factory([entry('s1')], { responder: async e => {
      attempt++;
      if (attempt === 1) throw new Error('response lost after commit');
      return {...success(e),receipt:{...receipt(e),status:'already_committed'}};
    }});
    const first = await syncNativeOperations(scope,x);
    expect(first.retrying).toBe(1);
    expect(x.records[0].status).toBe('retry_wait');
    expect(x.records[0].operationId).toBe('s1');
    const second = await syncNativeOperations(scope,x);
    expect(second.completed).toBe(1);
    expect(x.records[0].status).toBe('complete');
    expect(vi.mocked(x.transport.submit).mock.calls.map(([e])=>e.idempotencyKey))
      .toEqual([entry('s1').idempotencyKey,entry('s1').idempotencyKey]);
  });
  it('HTTP 200 with no receipt does not mark a sale complete', async () => {
    const x = factory([entry('s1')], { responder: async () => ({httpStatus: 200}) });
    const r = await syncNativeOperations(scope,x);
    expect(r.retrying).toBe(1);
    expect(x.records[0].status).toBe('retry_wait');
    expect(x.store.commitReceipt).not.toHaveBeenCalled();
  });
  it('half-committed Treasury/stock stays pending to retry rather than double deduct stock', async () => {
    const x = factory([entry('s1')], { responder: async e => ({
      httpStatus:200,receipt:{...receipt(e),treasuryCommitted:false},
    })});
    expect((await syncNativeOperations(scope,x)).retrying).toBe(1);
    expect(x.records[0].status).toBe('retry_wait');
  });
  it('server tombstone/conflict puts operation in Needs Review without deleting it', async () => {
    const x = factory([entry('s1')], { responder: async () => ({httpStatus:409}) });
    expect((await syncNativeOperations(scope,x)).needsReview).toBe(1);
    expect(x.records.map(e=>e.status)).toEqual(['needs_review']);
    expect((await syncNativeOperations(scope,x)).completed).toBe(0);
    expect(x.transport.submit).toHaveBeenCalledTimes(1);
  });
  it('401 from revoked staff blocks the rest of the queue', async () => {
    const x = factory([entry('s1'),entry('s2','purchase',{clientSequence:2})],{
      responder:async () => ({httpStatus: 401}),
    });
    const result = await syncNativeOperations(scope,x);
    expect(result.reason).toBe('access_revoked_or_session_expired');
    expect(result.blocked).toBe(1);
    expect(x.records.map(e=>e.status)).toEqual(['blocked','pending']);
    expect(x.transport.submit).toHaveBeenCalledTimes(1);
  });
  it('mismatched server receipt halts sync and requires review', async () => {
    const x = factory([entry('s1'),entry('s2','sale',{clientSequence:2})],{
      responder:async e => ({httpStatus:200,receipt:{...receipt(e),tenantId:'other-tenant'}}),
    });
    expect((await syncNativeOperations(scope,x)).reason).toBe('receipt_identity_mismatch');
    expect(x.records.map(e=>e.status)).toEqual(['blocked','pending']);
  });
  it('failure to persist syncing status MUST abort before submitting', async () => {
    const x = factory([entry('s1')]);
    vi.mocked(x.store.transition).mockRejectedValueOnce(new Error('disk full'));
    await expect(syncNativeOperations(scope,x)).rejects.toThrow('disk full');
    expect(x.transport.submit).not.toHaveBeenCalled();
    expect(x.records[0].status).toBe('pending');
  });
  it('failure to acknowledge a committed receipt never deletes the operation', async () => {
    const x = factory([entry('s1')]);
    vi.mocked(x.store.commitReceipt).mockRejectedValueOnce(new Error('disk unexpectedly full'));
    await expect(syncNativeOperations(scope,x)).rejects.toThrow('disk unexpectedly full');
    expect(x.records[0].status).toBe('syncing');
    expect((await syncNativeOperations(scope,x)).completed).toBe(1);
    expect(x.records[0].status).toBe('complete');
    expect(x.transport.submit).toHaveBeenCalledTimes(2);
  });
  it('independent expense can continue after a sale hits a recoverable server error', async () => {
    const x=factory([entry('s1'),entry('e2','expense',{clientSequence:2})],{
      responder: async e => e.type==='sale'?{httpStatus:503}:success(e),
    });
    const r=await syncNativeOperations(scope,x);
    expect([r.retrying,r.completed]).toEqual([1,1]);
    expect(x.records.map(e=>e.status)).toEqual(['retry_wait','complete']);
  });
  it('never resends complete, blocked or manually disputed transactions', async () => {
    const x = factory([
      entry('old','sale',{status:'complete'}),
      entry('blocked','expense',{status:'blocked'}),
      entry('review','purchase',{status:'needs_review'}),
      entry('retry','expense',{status:'retry_wait'}),
    ]);
    expect((await syncNativeOperations(scope,x)).completed).toBe(1);
    expect(vi.mocked(x.transport.submit).mock.calls.map(([e])=>e.operationId)).toEqual(['retry']);
  });
  it('crash-recovered syncing item replays same immutable id, never generates another', async () => {
    const x=factory([entry('crash','purchase',{status:'syncing', attempts:2})]);
    const result=await syncNativeOperations(scope,x);
    expect(result.completed).toBe(1);
    expect(vi.mocked(x.transport.submit).mock.calls[0][0].operationId).toBe('crash');
  });
  it('rechecks network and authorization before EVERY operation', async () => {
    const x=factory([entry('first'),entry('second','purchase',{clientSequence:2})],{
      responder:async e => {
        x.setOnline(false);
        return success(e);
      },
    });
    const result=await syncNativeOperations(scope,x);
    expect(result.completed).toBe(1);
    expect(result.reason).toBe('offline_during_sync');
    expect(x.records[1].status).toBe('pending');
  });
  it('rejects missing tenant/branch/staff/device scope without touching storage', async () => {
    const x=factory([entry('s1')]);
    const result=await syncNativeOperations({...scope,actorId:''},x);
    expect(result.reason).toBe('missing_scope');
    expect(x.store.list).not.toHaveBeenCalled();
  });
  it('only one pass per scope may upload concurrently', async () => {
    let release!: (response: SyncResponse)=>void;
    const wait=new Promise<SyncResponse>(resolve => {release=resolve});
    const x=factory([entry('s1')], {responder: async () => wait});
    const first=syncNativeOperations(scope,x);
    await vi.waitFor(()=>expect(x.transport.submit).toHaveBeenCalledTimes(1));
    const racing=await syncNativeOperations(scope,x);
    expect(racing.reason).toBe('sync_already_running');
    release(success(entry('s1')));
    expect((await first).completed).toBe(1);
    expect(x.transport.submit).toHaveBeenCalledTimes(1);
  });
});
