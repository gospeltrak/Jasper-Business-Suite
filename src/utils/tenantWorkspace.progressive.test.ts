import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression tests for the "dashboard stays on the loading splash until the
// entire sales/expenses/deliveries/purchases history has downloaded" bug.
//
// Root cause: loadTenantWorkspace() had no in-flight dedupe (App.tsx's
// cache-warming call and Dashboard.tsx's own initial-load call each issued a
// full, separate database round trip for the same tenant) and always waited
// for the complete paginated historical ledgers before resolving, so
// Dashboard.tsx's splash screen (gated on that single promise) stayed up
// until every page of every ledger had loaded.
//
// Fix: loadTenantWorkspaceCore() resolves with just the fast payload
// (settings/products/stock/branches) and shares one request per tenant via
// an in-flight promise map; historical ledgers complete in the background
// and land in the runtime cache once ready. Any write (saveTenantWorkspace)
// waits for that background completion first, so it can never fire against
// a workspace whose ledgers are still partially loaded.

let bootstrapCallCount = 0;
let releaseSalesPage: (() => void) | null = null;
const upsertCalls: any[] = [];

vi.mock('./onlineOnly', () => ({
  canWriteBusinessDataOnline: () => true,
  isBrowserOnline: () => true,
  warnOfflineWriteBlocked: () => {},
}));

const emptyLedgerPage = (collection: string) => ({
  data: { collection, records: [], hasMore: false, nextCursor: null, readSource: 'normalized', fallbackRequired: false },
  error: null,
});

vi.mock('../secureDataBridge', () => ({
  getSecureDataBridgeClient: vi.fn(async () => ({
    supabaseUrl: 'https://fake-project.supabase.co',
    rpc: async (fn: string, args?: any) => {
      if (fn === 'get_current_branch_workspace_bootstrap_v3') {
        bootstrapCallCount++;
        return {
          data: {
            payload: {
              branches: [], branchStocks: [], branchStaffAssignments: [],
              products: [{ id: 'p1', name: 'Product' }],
              sales: [], expenses: [], deliveries: [], purchases: [],
              settings: {},
              pendingDeliveryNotes: [],
              productTombstones: {}, saleTombstones: {},
            },
            readSource: 'normalized_paginated',
          },
          error: null,
        };
      }
      if (fn === 'get_current_branch_workspace_page') {
        const collection = args.p_collection;
        if (collection === 'sales') {
          return new Promise((resolve) => {
            releaseSalesPage = () => resolve({
              data: { collection, records: [{ id: 's1' }], hasMore: false, nextCursor: null, readSource: 'normalized', fallbackRequired: false },
              error: null,
            });
          });
        }
        return emptyLedgerPage(collection);
      }
      if (fn === 'get_current_branch_workspace') {
        // Save path's remote guard read -- no remote row yet for these fresh
        // test tenants, so saves proceed without merge/shrink-protection
        // noise (that's covered separately by tenantWorkspace.race.test.ts).
        return { data: { payload: null }, error: null };
      }
      if (fn === 'save_current_branch_workspace') {
        upsertCalls.push(args?.p_workspace);
        return { error: null };
      }
      return { data: null, error: { code: 'PGRST202' } };
    },
    from: () => ({
      upsert: async () => ({ error: null }),
    }),
  })),
  isPlaceholderSecureDataBridgeClient: () => false,
}));

import {
  loadTenantWorkspace,
  loadTenantWorkspaceCore,
  readCachedWorkspace,
  saveTenantWorkspace,
  waitForTenantWorkspaceLoad,
} from './tenantWorkspace';

describe('progressive tenant workspace loading', () => {
  beforeEach(() => {
    bootstrapCallCount = 0;
    releaseSalesPage = null;
    upsertCalls.length = 0;
  });

  it('shares one core request between concurrent callers instead of issuing a duplicate', async () => {
    const tenantId = 'progressive-dedupe-tenant';

    // Simulates App.tsx's cache-warming call and Dashboard.tsx's own initial
    // load firing at effectively the same time.
    const [a, b] = await Promise.all([
      loadTenantWorkspaceCore(tenantId),
      loadTenantWorkspaceCore(tenantId),
    ]);

    expect(bootstrapCallCount).toBe(1);
    expect(a?.products?.[0]?.id).toBe('p1');
    expect(b?.products?.[0]?.id).toBe('p1');

    // Release the background ledger load so it doesn't leak a pending
    // promise into later tests.
    await vi.waitFor(() => {
      if (!releaseSalesPage) throw new Error('sales page not requested yet');
    });
    releaseSalesPage!();
    await waitForTenantWorkspaceLoad(tenantId);
  });

  it('resolves the core payload before the paginated ledgers finish, then the cache picks up the full history', async () => {
    const tenantId = 'progressive-core-first-tenant';

    const core = await loadTenantWorkspaceCore(tenantId);
    // Core resolved without waiting for the paginated ledger fetch -- its
    // own ledger fields are empty placeholders at this point.
    expect(core?.sales).toEqual([]);

    await vi.waitFor(() => {
      if (!releaseSalesPage) throw new Error('sales page not requested yet');
    });
    releaseSalesPage!();
    await waitForTenantWorkspaceLoad(tenantId);

    const full = readCachedWorkspace(tenantId);
    expect(full?.sales.map(s => s.id)).toEqual(['s1']);
  });

  it('blocks a save from firing until the historical ledger load for that tenant completes', async () => {
    const tenantId = 'progressive-save-gate-tenant';

    // Kick off the core-first load; its ledger completion is gated on the
    // sales page, same as the previous test.
    void loadTenantWorkspaceCore(tenantId);
    await vi.waitFor(() => {
      if (!releaseSalesPage) throw new Error('sales page not requested yet');
    });

    const workspace: any = {
      branches: [], branchStocks: [], branchStaffAssignments: [],
      products: [{ id: 'p1', name: 'Product' }],
      sales: [{ id: 's1' }],
      expenses: [], deliveries: [], purchases: [],
      settings: {},
      pendingDeliveryNotes: [],
      productTombstones: {}, saleTombstones: {},
    };
    const save = saveTenantWorkspace(tenantId, workspace);

    // The save must not reach the network while ledgers are still loading --
    // give the microtask queue a few turns to prove it stays pending, not
    // just "hasn't gotten there yet".
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(upsertCalls).toHaveLength(0);

    releaseSalesPage!();
    await save;

    expect(upsertCalls).toHaveLength(1);
  });

  it('loadTenantWorkspace (full contract) still returns complete data including ledgers', async () => {
    const tenantId = 'progressive-full-load-tenant';
    const fullPromise = loadTenantWorkspace(tenantId);

    await vi.waitFor(() => {
      if (!releaseSalesPage) throw new Error('sales page not requested yet');
    });
    releaseSalesPage!();

    const full = await fullPromise;
    expect(full?.sales.map(s => s.id)).toEqual(['s1']);
    expect(full?.products?.[0]?.id).toBe('p1');
  });
});
