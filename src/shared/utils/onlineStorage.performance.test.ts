import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({ upsert: vi.fn(), payload: {} as Record<string, string> }));
vi.mock('../dataBridge/secureDataBridge', () => ({ getSecureDataBridgeClient: async () => ({
  from: () => ({ upsert: bridge.upsert, select: () => {
    const query = { eq: () => query, maybeSingle: async () => ({ data: { payload: bridge.payload }, error: null }) };
    return query;
  } }),
}) }));

describe('online cache avoids redundant persistence work', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    bridge.payload = { existing: 'same' };
    bridge.upsert.mockReset().mockResolvedValue({ error: null });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('document', { addEventListener: vi.fn() });
    vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn() });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('does not schedule a write for unchanged values or absent keys', async () => {
    const { configureOnlineStorage, onlineStorage, resetOnlineStorage } = await import('./onlineStorage');
    await configureOnlineStorage('tenant-a');
    const timers = vi.getTimerCount();
    onlineStorage.setItem('existing', 'same');
    onlineStorage.removeItem('absent');
    expect(vi.getTimerCount()).toBe(timers);
    await vi.advanceTimersByTimeAsync(1000);
    expect(bridge.upsert).not.toHaveBeenCalled();
    resetOnlineStorage();
  });

  it('does not postpone a real save when the same cached value is written again', async () => {
    const { configureOnlineStorage, onlineStorage, resetOnlineStorage } = await import('./onlineStorage');
    await configureOnlineStorage('tenant-a');
    onlineStorage.setItem('existing', 'changed');
    await vi.advanceTimersByTimeAsync(800);
    onlineStorage.setItem('existing', 'changed');
    await vi.advanceTimersByTimeAsync(201);
    expect(bridge.upsert).toHaveBeenCalledTimes(1);
    expect(bridge.upsert.mock.calls[0][0]).toMatchObject({ tenant_id: 'tenant-a', data_key: 'application_state', payload: { existing: 'changed' } });
    resetOnlineStorage();
  });

  it('saves a real removal, and does not schedule another write for an empty clear', async () => {
    const { configureOnlineStorage, onlineStorage, resetOnlineStorage } = await import('./onlineStorage');
    await configureOnlineStorage('tenant-a');
    onlineStorage.clear();
    await vi.advanceTimersByTimeAsync(1001);
    expect(bridge.upsert).toHaveBeenCalledTimes(1);
    expect(bridge.upsert.mock.calls[0][0].payload).toEqual({});
    const timers = vi.getTimerCount();
    onlineStorage.clear();
    expect(vi.getTimerCount()).toBe(timers);
    resetOnlineStorage();
  });

  it('automatically saves pending state on reconnect without another user edit', async () => {
    const { configureOnlineStorage, onlineStorage, resetOnlineStorage } = await import('./onlineStorage');
    await configureOnlineStorage('tenant-a');
    (navigator as { onLine: boolean }).onLine = false;
    onlineStorage.setItem('existing', 'offline edit');
    await vi.advanceTimersByTimeAsync(1001);
    expect(bridge.upsert).not.toHaveBeenCalled();
    (navigator as { onLine: boolean }).onLine = true;
    const listeners = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    const onlineListener = listeners.find(([type]) => type === 'online')?.[1] as (() => void) | undefined;
    expect(onlineListener).toBeDefined();
    onlineListener?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(bridge.upsert).toHaveBeenCalledTimes(1);
    expect(bridge.upsert.mock.calls[0][0].payload).toEqual({ existing: 'offline edit' });
    resetOnlineStorage();
  });

  it('allows the same value to retry after a database save failed', async () => {
    const { configureOnlineStorage, onlineStorage, resetOnlineStorage } = await import('./onlineStorage');
    await configureOnlineStorage('tenant-a');
    bridge.upsert.mockResolvedValueOnce({ error: new Error('Temporary network failure') });
    onlineStorage.setItem('existing', 'changed');
    await vi.advanceTimersByTimeAsync(1001);
    expect(bridge.upsert).toHaveBeenCalledTimes(1);
    onlineStorage.setItem('existing', 'changed');
    await vi.advanceTimersByTimeAsync(1001);
    expect(bridge.upsert).toHaveBeenCalledTimes(2);
    expect(bridge.upsert.mock.calls[1][0].payload).toEqual({ existing: 'changed' });
    resetOnlineStorage();
  });
});
