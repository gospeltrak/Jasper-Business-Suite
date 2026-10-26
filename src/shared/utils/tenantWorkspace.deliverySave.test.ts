import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../dataBridge/secureDataBridge', () => ({ getSecureDataBridgeClient: async () => ({ supabaseUrl: 'https://example.supabase.co', rpc: transport.rpc }) }));
vi.mock('./onlineOnly', () => ({ canWriteBusinessDataOnline: () => true, warnOfflineWriteBlocked: vi.fn() }));
import { readCachedWorkspace, saveTenantDeliveriesOnly } from './tenantWorkspace';

describe('unambiguous narrow delivery save', () => {
  beforeEach(() => transport.rpc.mockReset());

  it('uses the explicit tombstone overload and caches the authoritative response', async () => {
    const incoming = [{ id: 'delivery-a', status: 'Pending Dispatch' }] as any;
    const committed = [{ id: 'delivery-a', status: 'Dispatched' }];
    transport.rpc.mockResolvedValue({ data: { deliveries: committed }, error: null });
    expect(await saveTenantDeliveriesOnly('delivery-signature', incoming)).toBe(true);
    expect(transport.rpc).toHaveBeenCalledWith('save_current_branch_deliveries', { p_deliveries: incoming, p_delivery_tombstones: {} });
    expect(readCachedWorkspace('delivery-signature')?.deliveries).toEqual(committed);
  });

  it('retains explicit deletion intents and rejects a failed save', async () => {
    const tombstones = { 'delivery-b': '2026-10-26T01:00:00Z' };
    transport.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Denied' } });
    expect(await saveTenantDeliveriesOnly('delivery-rejected', [], tombstones)).toBe(false);
    expect(transport.rpc).toHaveBeenCalledWith('save_current_branch_deliveries', { p_deliveries: [], p_delivery_tombstones: tombstones });
    expect(readCachedWorkspace('delivery-rejected')).toBeNull();
  });
});
