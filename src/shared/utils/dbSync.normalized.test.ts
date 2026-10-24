import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../dataBridge/secureDataBridge', () => ({ getSecureDataBridgeClient: async () => client }));
vi.mock('./onlineOnly', () => ({ canWriteBusinessDataOnline: () => true, warnOfflineWriteBlocked: vi.fn(), ONLINE_ONLY_WRITE_MESSAGE: 'Connect to save' }));
import { pullAllFromCloud, pullFromCloud, pushToCloud } from './dbSync';

describe('normalized legacy-key routing', () => {
  beforeEach(() => { client.rpc.mockReset(); client.from.mockReset(); });

  it('saves a business map through the normalized RPC without persisting a JSON backup', async () => {
    const payload = { tenant: [{ id: 'product' }] };
    client.rpc.mockResolvedValue({ data: { handled: true, payload }, error: null });
    expect(await pushToCloud('tenant', 'products_map', payload)).toEqual(payload);
    expect(client.rpc).toHaveBeenCalledWith('route_current_branch_business_data', { p_key: 'products_map', p_payload: payload, p_write: true });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('reads normalized rows instead of stale legacy business data', async () => {
    const rows = [{ id: 'current-invoice', amountDue: 500 }];
    client.rpc.mockResolvedValue({ data: { handled: true, payload: rows }, error: null });
    expect(await pullFromCloud('tenant', 'purchases')).toEqual(rows);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('builds login business data from normalized rows', async () => {
    const payload = { products: [{ id: 'product' }], sales: [], settings: { business: {} } };
    client.rpc.mockResolvedValue({ data: { handled: true, payload }, error: null });
    expect(await pullAllFromCloud('tenant')).toEqual(payload);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('fails closed after an RPC error instead of writing an outdated JSON source', async () => {
    client.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(pushToCloud('tenant', 'sales', [{ id: 'sale' }])).rejects.toThrow();
    expect(client.from).not.toHaveBeenCalled();
  });
});
