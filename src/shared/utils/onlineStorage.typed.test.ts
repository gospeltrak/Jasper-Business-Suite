import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getBridge } = vi.hoisted(() => ({ getBridge: vi.fn() }));
vi.mock('../dataBridge/secureDataBridge', () => ({
  getSecureDataBridgeClient: getBridge,
}));

const setupClient = (status: 'active' | 'shadow', typedReadError = false) => {
  const stateRows = [
    { state_key: 'jasper_platform_banner', state_value: 'data:image/png;base64,AAEC', is_deleted: false },
    { state_key: 'theme', state_value: 'light', is_deleted: false },
  ];
  const typedUpsert = vi.fn().mockResolvedValue({ error: null });
  const legacyUpsert = vi.fn().mockResolvedValue({ error: null });
  const entries = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          range: vi.fn().mockResolvedValue(
            typedReadError ? { data: null, error: { message: 'Unavailable' } } :
              { data: stateRows, error: null },
          ),
        })),
      })),
    })),
    upsert: typedUpsert,
  };
  const statusTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: { state: status }, error: null }),
      })),
    })),
  };
  const tenantData = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { payload: { theme: 'old-theme', jasper_platform_banner: 'old-banner' } },
            error: null,
          }),
        })),
      })),
    })),
    upsert: legacyUpsert,
  };
  const from = vi.fn((table: string) => {
    if (table === 'orvix_tenant_application_state_status') return statusTable;
    if (table === 'orvix_tenant_application_state_entries') return entries;
    if (table === 'tenant_data') return tenantData;
    throw new Error('Unexpected table ' + table);
  });
  getBridge.mockResolvedValue({ from });
  return { from, typedUpsert, legacyUpsert };
};

describe('typed application-state runtime rollout gate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv('VITE_ORVIX_TYPED_APP_STATE', 'true');
    vi.stubGlobal('window', {
      setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('document', { addEventListener: vi.fn() });
    vi.stubGlobal('navigator', { onLine: true });
    getBridge.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('writes only the edited key when staging status has been explicitly activated', async () => {
    const { from, typedUpsert, legacyUpsert } = setupClient('active');
    const { onlineStorage } = await import('./onlineStorage');
    await (await import('./onlineStorage')).configureOnlineStorage('11111111-1111-1111-1111-111111111111');

    expect(onlineStorage.getItem('jasper_platform_banner')).toBe('data:image/png;base64,AAEC');
    onlineStorage.setItem('theme', 'emerald');
    await vi.runAllTimersAsync();

    expect(typedUpsert).toHaveBeenCalledTimes(1);
    const [rows] = typedUpsert.mock.calls[0];
    expect(rows).toEqual([{
      tenant_id: '11111111-1111-1111-1111-111111111111',
      state_key: 'theme', state_value: 'emerald', is_deleted: false,
    }]);
    expect(legacyUpsert).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith('tenant_data');
    onlineStorage.removeItem('theme');
    await vi.runAllTimersAsync();
    const [tombstone] = typedUpsert.mock.calls[1];
    expect(tombstone[0]).toMatchObject({
      state_key: 'theme', state_value: 'emerald', is_deleted: true,
    });
  });

  it('never enables typed storage merely from a feature flag while migration is still shadow', async () => {
    const { typedUpsert, legacyUpsert } = setupClient('shadow');
    const { onlineStorage, configureOnlineStorage } = await import('./onlineStorage');
    await configureOnlineStorage('11111111-1111-1111-1111-111111111111');
    expect(onlineStorage.getItem('theme')).toBe('old-theme');
    onlineStorage.setItem('theme', 'new-legacy-state');
    await vi.runAllTimersAsync();
    expect(typedUpsert).not.toHaveBeenCalled();
    expect(legacyUpsert).toHaveBeenCalledTimes(1);
  });

  it('fails closed rather than writing stale legacy data if an activated typed read fails', async () => {
    const { typedUpsert, legacyUpsert } = setupClient('active', true);
    const { onlineStorage, configureOnlineStorage } = await import('./onlineStorage');
    await configureOnlineStorage('11111111-1111-1111-1111-111111111111');
    onlineStorage.setItem('theme', 'should-not-persist');
    await vi.runAllTimersAsync();
    expect(typedUpsert).not.toHaveBeenCalled();
    expect(legacyUpsert).not.toHaveBeenCalled();
  });
});
