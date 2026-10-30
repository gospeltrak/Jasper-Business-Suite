import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchStock, Product } from '../../types';

const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../dataBridge/secureDataBridge', () => ({
  getSecureDataBridgeClient: vi.fn(async () => ({
    supabaseUrl: 'https://example.supabase.co', rpc: transport.rpc,
  })),
}));
vi.mock('./onlineOnly', () => ({
  canWriteBusinessDataOnline: () => true,
  warnOfflineWriteBlocked: vi.fn(),
}));

import { readCachedWorkspace, saveTenantProductsOnly } from './tenantWorkspace';

const product = (id: string, price = 100, updatedAt = '2026-10-23T10:00:00Z') => ({
  id, name: id, sellingPrice: price, updatedAt, syncUpdatedAt: updatedAt,
}) as Product;
const stock = (id: string, branchId: string, price = 100) => ({
  id, tenantId: 'example', branchId, productId: 'p1', quantity: 5,
  shopStockQty: 5, storeStockQty: 0, sellingPrice: price, updatedAt: '2026-10-23T10:05:00Z',
}) as BranchStock;

describe('durable product edits', () => {
  beforeEach(() => transport.rpc.mockReset());

  it('sends product and branch price in one RPC and caches the committed result', async () => {
    const edited = product('p1', 150, '2026-10-23T10:05:00Z');
    const branchStock = stock('s1', 'b1', 150);
    transport.rpc.mockResolvedValue({ data: { products: [edited], branchStocks: [branchStock] }, error: null });
    expect(await saveTenantProductsOnly('atomic-edit', [edited], {}, [branchStock])).toBe(true);
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    expect(transport.rpc).toHaveBeenCalledWith('save_current_branch_products', {
      p_products: [edited], p_product_tombstones: {}, p_branch_stocks: [branchStock],
    });
    expect(readCachedWorkspace('atomic-edit')?.branchStocks).toEqual([branchStock]);
    expect(readCachedWorkspace('atomic-edit')?.products[0].sellingPrice).toBe(150);
  });

  it('uses authoritative newer prices when the database rejects an older snapshot', async () => {
    const newest = product('p1', 150, '2026-10-23T10:05:00Z');
    transport.rpc.mockResolvedValue({ data: { products: [newest], branchStocks: [stock('s1', 'b1', 150)] }, error: null });
    await saveTenantProductsOnly('stale-edit', [product('p1')], {}, [stock('s1', 'b1')]);
    expect(readCachedWorkspace('stale-edit')?.products[0].sellingPrice).toBe(150);
    expect(readCachedWorkspace('stale-edit')?.branchStocks?.[0].sellingPrice).toBe(150);
  });

  it('keeps other branch stock when an RPC returns only the selected branch', async () => {
    const other = stock('s-other', 'b2');
    transport.rpc.mockResolvedValueOnce({ data: { products: [product('p1')], branchStocks: [other] }, error: null });
    await saveTenantProductsOnly('branch-retention', [product('p1')], {}, [other]);
    const edited = stock('s1', 'b1', 150);
    transport.rpc.mockResolvedValueOnce({ data: { products: [product('p1', 150)], branchStocks: [edited] }, error: null });
    await saveTenantProductsOnly('branch-retention', [product('p1', 150)], {}, [edited]);
    expect(readCachedWorkspace('branch-retention')?.branchStocks).toEqual(expect.arrayContaining([other, edited]));
  });

  it('does not report a rejected atomic write as saved or change the cached stock', async () => {
    const before = stock('s1', 'b1');
    transport.rpc.mockResolvedValueOnce({ data: { products: [product('p1')], branchStocks: [before] }, error: null });
    await saveTenantProductsOnly('rejected-edit', [product('p1')], {}, [before]);
    transport.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Write rejected' } });
    expect(await saveTenantProductsOnly('rejected-edit', [product('p1', 150)], {}, [stock('s1', 'b1', 150)])).toBe(false);
    expect(readCachedWorkspace('rejected-edit')?.branchStocks).toEqual([before]);
  });

  it('does not mistake an empty RPC response for a completed save', async () => {
    transport.rpc.mockResolvedValueOnce({ data: null, error: null });
    const edited = product('p-no-ack', 150);
    expect(await saveTenantProductsOnly('missing-ack', [edited])).toBe(false);
    expect(readCachedWorkspace('missing-ack')?.products.find(p => p.id === edited.id)).toBeUndefined();
  });

  it('keeps the existing two-argument RPC for catalogue-only callers', async () => {
    transport.rpc.mockResolvedValue({ data: { products: [product('p1')] }, error: null });
    await saveTenantProductsOnly('legacy-edit', [product('p1')]);
    expect(transport.rpc.mock.calls[0][1]).not.toHaveProperty('p_branch_stocks');
  });
});
