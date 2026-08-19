import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression test for the "delete a sale, it comes back a while later" bug.
// Root cause (see commit history): saveTenantWorkspace fired a fresh,
// unqueued network write on every state change. Two overlapping calls for
// the same tenant (e.g. deleting a sale also adjusts stock, firing two
// saves a few ms apart) could have their network requests LAND on the
// actual database out of order — if the older call (still holding the
// deleted sale) is the one whose request the server finishes processing
// LAST, the database ends up holding the stale, pre-deletion data even
// though the newer, correct call was issued (and even resolved) first.
//
// A guard that only checks "am I still the latest?" right before issuing
// the write is NOT enough: it can't stop the older request from having
// already been sent, and once both requests are in flight, the actual
// database's final state is decided by whichever one the SERVER finishes
// last — not by anything the client can inspect after the fact. The queue
// fix (workspaceSaveQueue) prevents this at the root: a tenant's next
// write is never even issued until the previous one has fully completed,
// so two writes for the same tenant can never be in flight together.
//
// This mock models "the database" explicitly: whichever upsert call
// RESOLVES last is what the mock DB ends up holding — that's what actually
// determines the real Postgres row's final content, regardless of which
// request was sent first.
//
// Note: sales go from TWO records down to ONE (not down to zero) so this
// test isolates the race-condition fix from the separate "blank-save
// guard" (which intentionally keeps cached data if an incoming save is
// completely empty — a different protection, for a different scenario).

let mockDbState: any = null;
const upsertCalls: any[] = [];
let releaseFirstUpsert: (() => void) | null = null;

vi.mock('./onlineOnly', () => ({
  canWriteBusinessDataOnline: () => true,
  isBrowserOnline: () => true,
  warnOfflineWriteBlocked: () => {},
}));

vi.mock('../secureDataBridge', () => {
  return {
    getSecureDataBridgeClient: vi.fn(async () => ({
      supabaseUrl: 'https://fake-project.supabase.co',
      from: (table: string) => ({
        upsert: (payload: any) => {
          upsertCalls.push({ table, payload });
          const isFirstCall = upsertCalls.length === 1;
          return new Promise((resolve) => {
            const finish = () => {
              // Whichever upsert call RESOLVES (i.e. whichever request the
              // server finishes processing) LAST is what the database ends
              // up holding — this is the ground truth a client-side cache
              // check can never fully undo once both requests are in flight.
              mockDbState = payload.payload;
              resolve({ error: null });
            };
            if (isFirstCall) {
              // Simulate the OLDER call's network round trip being slow —
              // its response (and therefore the server's commit of it)
              // arrives after the newer call's, if the newer call is even
              // allowed to fire before this one finishes.
              releaseFirstUpsert = finish;
            } else {
              finish();
            }
          });
        },
      }),
    })),
    isPlaceholderSecureDataBridgeClient: () => false,
  };
});

import {
  flushPendingTenantWorkspace,
  hasPendingTenantWorkspaceSave,
  readCachedWorkspace,
  saveTenantWorkspace,
  scheduleTenantWorkspaceSave,
} from './tenantWorkspace';

const baseWorkspace = (sales: any[]): any => ({
  branches: [], branchStocks: [], branchStaffAssignments: [],
  products: [{ id: 'p1', name: 'Product' }],
  sales,
  expenses: [],
  settings: {} as any,
  deliveries: [],
  pendingDeliveryNotes: [],
  purchases: [],
  productTombstones: {},
  saleTombstones: {},
});

describe('saveTenantWorkspace write queue (out-of-order network completion)', () => {
  beforeEach(() => {
    upsertCalls.length = 0;
    releaseFirstUpsert = null;
    mockDbState = null;
  });

  it('never lets an older, slower write land on the database after a newer, faster one for the same tenant', async () => {
    const tenantId = 'race-test-tenant';

    // Call A: still has sale s1 (about to be deleted) alongside s2.
    const callA = saveTenantWorkspace(
      tenantId,
      baseWorkspace([{ id: 's1', amount: 100 }, { id: 's2', amount: 200 }]),
    );

    // Call B: fired shortly after, s1 already deleted (correct, newer
    // data). If writes for this tenant are properly queued, B's own
    // network write cannot even be issued until A's has fully completed.
    const callB = saveTenantWorkspace(tenantId, {
      ...baseWorkspace([{ id: 's2', amount: 200 }]),
      saleTombstones: { s1: new Date().toISOString() },
    });

    // Let A's (deliberately slow) network write resolve now. There are a
    // few real awaits (getConfiguredClient, the per-tenant queue chain)
    // between calling saveTenantWorkspace and it issuing its upsert, so
    // wait for it to actually reach the mocked network layer first.
    await vi.waitFor(() => {
      if (!releaseFirstUpsert) throw new Error('first upsert not issued yet');
    });
    releaseFirstUpsert!();

    await Promise.all([callA, callB]);

    // The ground truth: what does the (mock) database actually end up
    // holding after both writes have landed? It must be B's correction
    // (s1 deleted), never A's stale pre-deletion snapshot — regardless of
    // which request's response the network delivered last.
    expect(mockDbState?.sales.map((s: any) => s.id)).toEqual(['s2']);

    // The local cache must also agree with the database.
    const finalWorkspace = readCachedWorkspace(tenantId);
    expect(finalWorkspace?.sales.map((s: any) => s.id)).toEqual(['s2']);
  });

  // Stage 1 fix (Dashboard.tsx handleAddPurchase/handleUpdatePurchases/
  // handleDeletePurchase): these previously also called the legacy
  // saveData(tenantId, 'purchases_map', ...) path in parallel with this
  // canonical saveTenantWorkspace save — the exact redundant dual-write
  // pattern already proven to risk the same class of out-of-order bug for
  // sales/expenses. This test proves the canonical write-queue path alone
  // (now the only path purchases go through) correctly resists the same
  // out-of-order-completion race for the 'purchases' key.
  it('applies the same out-of-order write protection to purchases', async () => {
    const tenantId = 'race-test-tenant-purchases';

    const withPurchases = (purchases: any[]): any => ({
      ...baseWorkspace([]),
      purchases,
    });

    // Call A: still has purchase pc1 (about to be deleted) alongside pc2.
    const callA = saveTenantWorkspace(
      tenantId,
      withPurchases([{ id: 'pc1', totalAmount: 500 }, { id: 'pc2', totalAmount: 800 }]),
    );

    // Call B: fired shortly after, pc1 already deleted (correct, newer data).
    const callB = saveTenantWorkspace(tenantId, withPurchases([{ id: 'pc2', totalAmount: 800 }]));

    await vi.waitFor(() => {
      if (!releaseFirstUpsert) throw new Error('first upsert not issued yet');
    });
    releaseFirstUpsert!();

    await Promise.all([callA, callB]);

    expect(mockDbState?.purchases.map((p: any) => p.id)).toEqual(['pc2']);

    const finalWorkspace = readCachedWorkspace(tenantId);
    expect(finalWorkspace?.purchases.map((p: any) => p.id)).toEqual(['pc2']);
  });

  it('coalesces render-driven autosaves and flushes only the latest snapshot', async () => {
    const tenantId = 'autosave-coalesce-tenant';
    const first = scheduleTenantWorkspaceSave(
      tenantId,
      baseWorkspace([{ id: 's1', amount: 100 }]),
    );
    const latest = scheduleTenantWorkspaceSave(
      tenantId,
      baseWorkspace([{ id: 's2', amount: 200 }]),
    );

    const flush = flushPendingTenantWorkspace(tenantId);
    await vi.waitFor(() => {
      if (!releaseFirstUpsert) throw new Error('coalesced upsert not issued yet');
    });
    releaseFirstUpsert!();

    await Promise.all([first, latest, flush]);
    expect(upsertCalls).toHaveLength(1);
    expect(mockDbState?.sales.map((sale: any) => sale.id)).toEqual(['s2']);
  });

  // A caller that applies incoming remote data (e.g. a realtime payload)
  // needs a reliable signal that a local edit is still being written, so it
  // doesn't overwrite that edit with a remote snapshot taken before the
  // write landed. hasPendingTenantWorkspaceSave is that signal.
  it('hasPendingTenantWorkspaceSave reflects an in-flight direct save', async () => {
    const tenantId = 'race-test-tenant-pending-flag-direct';
    expect(hasPendingTenantWorkspaceSave(tenantId)).toBe(false);

    const call = saveTenantWorkspace(tenantId, baseWorkspace([{ id: 's1', amount: 100 }]));

    await vi.waitFor(() => {
      if (!releaseFirstUpsert) throw new Error('upsert not issued yet');
    });
    expect(hasPendingTenantWorkspaceSave(tenantId)).toBe(true);

    releaseFirstUpsert!();
    await call;

    expect(hasPendingTenantWorkspaceSave(tenantId)).toBe(false);
  });

  it('hasPendingTenantWorkspaceSave is true as soon as an autosave is scheduled, before its debounce timer fires', async () => {
    const tenantId = 'race-test-tenant-pending-flag-schedule';
    expect(hasPendingTenantWorkspaceSave(tenantId)).toBe(false);

    const scheduled = scheduleTenantWorkspaceSave(tenantId, baseWorkspace([{ id: 's1', amount: 100 }]));
    expect(hasPendingTenantWorkspaceSave(tenantId)).toBe(true);

    const flush = flushPendingTenantWorkspace(tenantId);
    await vi.waitFor(() => {
      if (!releaseFirstUpsert) throw new Error('upsert not issued yet');
    });
    releaseFirstUpsert!();
    await Promise.all([scheduled, flush]);

    expect(hasPendingTenantWorkspaceSave(tenantId)).toBe(false);
  });
});
