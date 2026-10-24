import { afterEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ rpc: vi.fn(), callback: undefined as undefined | ((event: unknown) => void), removeChannel: vi.fn() }));
vi.mock('../dataBridge/secureDataBridge', () => ({
  getSecureDataBridgeClient: async () => ({ supabaseUrl: 'https://example.supabase.co', rpc: transport.rpc, removeChannel: transport.removeChannel,
    channel: () => {
      const channel = { on: (_type: unknown, _filter: unknown, callback: (event: unknown) => void) => { transport.callback = callback; return channel; }, subscribe: () => channel };
      return channel;
    },
  }),
}));
vi.mock('./onlineOnly', () => ({ canWriteBusinessDataOnline: () => true, warnOfflineWriteBlocked: vi.fn() }));
import { subscribeToTenantWorkspace } from './tenantWorkspace';

describe('normalized workspace revision events', () => {
  afterEach(() => { vi.useRealTimers(); transport.rpc.mockReset(); transport.removeChannel.mockReset(); });

  it('coalesces events and reloads the authorized branch instead of trusting event business data', async () => {
    vi.useFakeTimers();
    transport.rpc.mockResolvedValue({ data: { payload: { products: [{ id: 'authorized-product' }], businessStorage: 'normalized' }, readSource: 'normalized' }, error: null });
    const onWorkspace = vi.fn();
    const stop = await subscribeToTenantWorkspace('normalized-events', onWorkspace);
    transport.callback?.({ new: { payload: { products: [{ id: 'another-branch-product' }] } } });
    transport.callback?.({ new: { payload: { businessStorage: 'normalized' } } });
    await vi.advanceTimersByTimeAsync(151);
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    expect(onWorkspace.mock.calls[0][0].products).toEqual([{ id: 'authorized-product' }]);
    stop();
    expect(transport.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending refresh when the subscription is removed', async () => {
    vi.useFakeTimers();
    const stop = await subscribeToTenantWorkspace('normalized-stop', vi.fn());
    transport.callback?.({ new: {} });
    stop();
    await vi.advanceTimersByTimeAsync(200);
    expect(transport.rpc).not.toHaveBeenCalled();
  });
});
