import { describe, expect, it } from 'vitest';
import {
  AUTO_LOCK_BACKGROUND_MS, LOCKOUT_MS, MAX_UNLOCK_FAILURES,
  mayStartNativeFeature, newNativeLockState, transitionNativeLock,
} from './nativeAppLockPolicy';

const start = () => transitionNativeLock(newNativeLockState(), {
  type: 'launch', identity: 'tenant-a:staff-a', nowMonotonicMs: 1000,
});
const unlock = (state: ReturnType<typeof start>, t = 2000, identity = 'tenant-a:staff-a') =>
  transitionNativeLock(state, {
    type: 'native_verified', identity, verified: true, nativeMethod: 'biometric', nowMonotonicMs: t,
  });

describe('Native app-lock lifecycle - secure UX guard', () => {
  it('locks on every cold launch even when previous JS screen was unlocked', () => {
    expect(start().locked).toBe(true);
    const open = unlock(start());
    expect(open.locked).toBe(false);
    expect(transitionNativeLock(open, { type: 'launch', identity: open.identity, nowMonotonicMs: 5000 }).locked).toBe(true);
  });
  it('unlocks only for the matching signed-in identity', () => {
    const mismatch = unlock(start(), 2000, 'tenant-b:staff-b');
    expect(mismatch.locked).toBe(true);
    expect(unlock(start()).locked).toBe(false);
  });
  it('retains unlocked state for a brief permitted background interval', () => {
    const first = transitionNativeLock(unlock(start()), { type: 'background', nowMonotonicMs: 3000 });
    const resumed = transitionNativeLock(first, { type: 'resume', nowMonotonicMs: 3000 + AUTO_LOCK_BACKGROUND_MS - 1 });
    expect(resumed.locked).toBe(false);
    expect(resumed.backgroundSinceMonotonicMs).toBe(null);
  });
  it('locks when returning after the configured background interval', () => {
    const first = transitionNativeLock(unlock(start()), { type: 'background', nowMonotonicMs: 3000 });
    const resumed = transitionNativeLock(first, { type: 'resume', nowMonotonicMs: 3000 + AUTO_LOCK_BACKGROUND_MS });
    expect(resumed.locked).toBe(true);
    expect(resumed.reason).toBe('background');
  });
  it('locks immediately when tenant or employee identity changes', () => {
    const moved = transitionNativeLock(unlock(start()), { type: 'switch_identity', identity: 'tenant-b:staff-b' });
    expect(moved.locked).toBe(true);
    expect(moved.reason).toBe('identity_changed');
    expect(moved.identity).toBe('tenant-b:staff-b');
  });
  it('never unlocks after signout', () => {
    const closed = transitionNativeLock(unlock(start()), { type: 'signout' });
    expect(closed.locked).toBe(true);
    expect(closed.identity).toBe('');
  });
  it('a reversed/invalid monotonic clock causes immediate lock', () => {
    expect(transitionNativeLock(unlock(start()), { type: 'resume', nowMonotonicMs: 3 }).locked).toBe(true);
    expect(transitionNativeLock(unlock(start()), { type: 'resume', nowMonotonicMs: Number.NaN }).locked).toBe(true);
  });
  it('five failures cause a bounded lockout even if a valid credential arrives', () => {
    let state = start();
    for (let i = 0; i < MAX_UNLOCK_FAILURES; i++) {
      state = transitionNativeLock(state, {
        type: 'native_verified', identity: state.identity, verified: false,
        nativeMethod: 'device_credential', nowMonotonicMs: 2000 + i,
      });
    }
    expect(state.reason).toBe('failed_attempts');
    expect(state.lockoutUntilMonotonicMs).toBe(2000 + MAX_UNLOCK_FAILURES - 1 + LOCKOUT_MS);
    expect(unlock(state, 3000).locked).toBe(true);
    expect(unlock(state, state.lockoutUntilMonotonicMs!).locked).toBe(false);
  });
  it('back/forward clock manipulation cannot be used as unlock bypass', () => {
    const state = transitionNativeLock(start(), { type: 'resume', nowMonotonicMs: 990 });
    expect(state.locked).toBe(true);
    expect(unlock(state, 980).locked).toBe(true);
  });
});

describe('Native device hardware authorization', () => {
  const granted = {
    nativePlatform: 'android' as const, authenticated: true,
    appUnlocked: true, hasStaffPermission: true,
    devicePermissionGranted: true, offline: true, secureLocalVaultVerified: false,
  };
  it('never unlocks camera/printer features in web/PWA', () => {
    for (const feature of ['camera_barcode', 'bluetooth_printer', 'wifi_printer'] as const) {
      expect(mayStartNativeFeature(feature, { ...granted, nativePlatform: 'web' })).toBe(false);
    }
  });
  it('requires authenticated staff, unlocked app and explicit OS permission', () => {
    expect(mayStartNativeFeature('camera_barcode', { ...granted, authenticated: false })).toBe(false);
    expect(mayStartNativeFeature('camera_barcode', { ...granted, appUnlocked: false })).toBe(false);
    expect(mayStartNativeFeature('bluetooth_printer', { ...granted, hasStaffPermission: false })).toBe(false);
    expect(mayStartNativeFeature('camera_barcode', { ...granted, devicePermissionGranted: false })).toBe(false);
  });
  it('native scanner and supported printers can operate without internet', () => {
    expect(mayStartNativeFeature('camera_barcode', granted)).toBe(true);
    expect(mayStartNativeFeature('bluetooth_printer', granted)).toBe(true);
    expect(mayStartNativeFeature('wifi_printer', granted)).toBe(true);
  });
  it('iOS offline accounting remains blocked until encrypted native journal is ready', () => {
    expect(mayStartNativeFeature('offline_financial_journal', { ...granted, nativePlatform: 'ios' })).toBe(false);
    expect(mayStartNativeFeature('offline_financial_journal', granted)).toBe(false);
    expect(mayStartNativeFeature('offline_financial_journal', { ...granted, secureLocalVaultVerified: true })).toBe(true);
  });
});
