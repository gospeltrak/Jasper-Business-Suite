import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Purchase } from '../../types';

const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../dataBridge/secureDataBridge', () => ({
  getSecureDataBridgeClient: vi.fn(async () => ({ supabaseUrl: 'https://example.supabase.co', rpc: transport.rpc })),
}));
vi.mock('./onlineOnly', () => ({ canWriteBusinessDataOnline: () => true, warnOfflineWriteBlocked: vi.fn() }));

import { addTenantPurchasePayment, readCachedWorkspace, saveTenantPurchasesOnly } from './tenantWorkspace';

const original = { id: 'purchase-1', totalAmount: 100000, amountPaid: 0, amountDue: 100000 } as Purchase;
const paid = { ...original, amountPaid: 30000, amountDue: 70000, updatedAt: '2026-10-23T20:00:00Z' };
const paymentId = 'a878d16c-d9cc-434f-ac07-c386d4eaaab3';

describe('atomic purchase installment client', () => {
  beforeEach(() => transport.rpc.mockReset());

  it('uses one atomic RPC and retains unrelated purchases in the cache', async () => {
    const other = { ...original, id: 'other-purchase' };
    transport.rpc.mockResolvedValueOnce({ data: { purchases: [original, other] }, error: null });
    await saveTenantPurchasesOnly('installment-cache', [original, other]);
    transport.rpc.mockReset();
    transport.rpc.mockResolvedValue({ data: { purchase: paid, status: 'recorded' }, error: null });
    expect(await addTenantPurchasePayment('installment-cache', original.id, paymentId, 30000, 'registered', 'cash')).toEqual(paid);
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    expect(transport.rpc).toHaveBeenCalledWith('add_current_branch_purchase_payment', {
      p_purchase_id: original.id, p_payment_id: paymentId, p_amount: 30000, p_funding_type: 'registered', p_source_key: 'cash',
    });
    expect(readCachedWorkspace('installment-cache')?.purchases).toEqual(expect.arrayContaining([paid, other]));
  });

  it('sends external funding without a treasury account', async () => {
    transport.rpc.mockResolvedValue({ data: { purchase: paid }, error: null });
    await addTenantPurchasePayment('installment-external', original.id, paymentId, 30000, 'external');
    expect(transport.rpc.mock.calls[0][1].p_source_key).toBe(null);
  });

  it('keeps the previous durable purchase when posting fails', async () => {
    transport.rpc.mockResolvedValueOnce({ data: { purchases: [original] }, error: null });
    await saveTenantPurchasesOnly('installment-rejected', [original]);
    transport.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514' } });
    await expect(addTenantPurchasePayment('installment-rejected', original.id, paymentId, 30000, 'registered', 'cash')).rejects.toThrow('No payment was recorded');
    expect(readCachedWorkspace('installment-rejected')?.purchases).toEqual([original]);
  });

  it('never falls back to a workspace-only payment save when the RPC is missing', async () => {
    transport.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(addTenantPurchasePayment('installment-missing', original.id, paymentId, 30000, 'registered', 'cash')).rejects.toThrow('Payment was not confirmed');
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    expect(readCachedWorkspace('installment-missing')).toBe(null);
  });

  it('retries with the same payment ID and accepts the latest committed purchase', async () => {
    transport.rpc.mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' } });
    await expect(addTenantPurchasePayment('installment-retry', original.id, paymentId, 30000, 'registered', 'cash')).rejects.toThrow();
    transport.rpc.mockResolvedValueOnce({ data: { purchase: paid, status: 'already_recorded' }, error: null });
    expect(await addTenantPurchasePayment('installment-retry', original.id, paymentId, 30000, 'registered', 'cash')).toEqual(paid);
    expect(transport.rpc.mock.calls[0][1]).toEqual(transport.rpc.mock.calls[1][1]);
  });
});
