import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));
import { Capacitor } from '@capacitor/core';
import {
  assertNativeJournalAccess,
  journalKey,
  stageNativeOperation,
} from './offlineJournal';

const scope = { tenantId: 'tenant-a', branchId: 'branch-a', actorId: 'staff-a', deviceId: 'device-a' };

beforeEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
});

describe('Native offline isolation', () => {
  it('blocks any web/PWA offline write', async () => {
    expect(() => assertNativeJournalAccess(scope)).toThrow(/installed Android\/iOS app/);
    await expect(stageNativeOperation(scope, 'sale', { id: 'sale-1' }, {baseSnapshotRevision:'rev-1',clientSequence:1})).rejects.toThrow(/installed Android\/iOS app/);
  });

  it('does not accept iOS IndexedDB as durable accounting storage', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    expect(() => assertNativeJournalAccess(scope)).toThrow(/SQLite/);
  });

  it('requires the actor, tenant and active branch on Android', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    expect(() => assertNativeJournalAccess({ ...scope, branchId: '' })).toThrow(/selected branch/);
    expect(() => assertNativeJournalAccess({ ...scope, actorId: '' })).toThrow(/verified user/);
    expect(() => assertNativeJournalAccess(scope)).not.toThrow();
    expect(() => assertNativeJournalAccess({...scope, deviceId:''})).toThrow(/verified user/);
  });

  it('never mixes actor, tenant, branch or transaction type into one queue entry', () => {
    const first = journalKey(scope, 'sale', 'tx-1');
    const keys = [
      journalKey({ ...scope, tenantId: 'tenant-b' }, 'sale', 'tx-1'),
      journalKey({ ...scope, branchId: 'branch-b' }, 'sale', 'tx-1'),
      journalKey({ ...scope, actorId: 'staff-b' }, 'sale', 'tx-1'),
      journalKey({ ...scope, deviceId: 'device-b' }, 'sale', 'tx-1'),
      journalKey(scope, 'purchase', 'tx-1'),
      journalKey(scope, 'expense', 'tx-1'),
      journalKey(scope, 'sale', 'tx-2'),
    ];
    for (const key of keys) expect(key).not.toBe(first);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('rejects transaction payloads from other tenants or branches before storage', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    await expect(stageNativeOperation(scope, 'sale', { id: 'sale-x', tenantId: 'tenant-b' }, {baseSnapshotRevision:'rev-1',clientSequence:1})).rejects.toThrow(/different tenant/);
    await expect(stageNativeOperation(scope, 'sale', { id: 'sale-x', branchId: 'branch-b' }, {baseSnapshotRevision:'rev-1',clientSequence:1})).rejects.toThrow(/different tenant/);
    await expect(stageNativeOperation(scope, 'sale', { id: '' }, {baseSnapshotRevision:'rev-1',clientSequence:1})).rejects.toThrow(/missing id/);
  });
});
