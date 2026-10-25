/**
 * Native app lock UX policy. The actual credential gate MUST be implemented in
 * Android Keystore / iOS Keychain through a native biometric/device-PIN bridge.
 * This state machine is not a security boundary and MUST NOT enable access to
 * encrypted offline financial records on its own.
 *
 * PWA/Web: this app-lock feature is never shown, preserving online-only UX.
 */
export type LockReason = 'startup' | 'background' | 'identity_changed' | 'failed_attempts' | 'signout';
export type NativeLockEvent =
  | { type: 'launch'; identity: string; nowMonotonicMs: number }
  | { type: 'background'; nowMonotonicMs: number }
  | { type: 'resume'; nowMonotonicMs: number }
  | { type: 'switch_identity'; identity: string }
  | { type: 'native_verified'; identity: string; verified: boolean; nativeMethod: 'biometric' | 'device_credential' | 'secure_app_pin'; nowMonotonicMs: number }
  | { type: 'signout' };

export interface NativeLockState {
  identity: string;
  locked: boolean;
  reason: LockReason | null;
  backgroundSinceMonotonicMs: number | null;
  attempts: number;
  lockoutUntilMonotonicMs: number | null;
  lastClockReadingMs: number;
}
export const AUTO_LOCK_BACKGROUND_MS = 30_000;
export const MAX_UNLOCK_FAILURES = 5;
export const LOCKOUT_MS = 60_000;

export function newNativeLockState(): NativeLockState {
  return {
    identity: '', locked: true, reason: 'startup',
    backgroundSinceMonotonicMs: null, attempts: 0,
    lockoutUntilMonotonicMs: null, lastClockReadingMs: 0,
  };
}

const validClock = (clock: number, prev: number): boolean =>
  Number.isSafeInteger(clock) && clock >= 0 && clock >= prev;

/** A native secure-unlock result is only trustworthy when bound to the same identity. */
export function transitionNativeLock(
  old: NativeLockState,
  event: NativeLockEvent,
): NativeLockState {
  if (event.type === 'signout') return newNativeLockState();
  if (event.type === 'switch_identity') {
    if (!event.identity || event.identity === old.identity) return old;
    return { ...newNativeLockState(), identity: event.identity, reason: 'identity_changed' };
  }
  const clock = event.nowMonotonicMs;
  if (!validClock(clock, old.lastClockReadingMs)) {
    return {
      ...old, locked: true, reason: 'startup',
      backgroundSinceMonotonicMs: null,
      lockoutUntilMonotonicMs: null,
    };
  }
  const next = { ...old, lastClockReadingMs: clock };
  if (event.type === 'launch') {
    // Never automatically unlock after process restart, regardless of saved JS state.
    return {
      ...newNativeLockState(), identity: event.identity,
      lastClockReadingMs: clock,
    };
  }
  if (event.type === 'background') {
    return { ...next, backgroundSinceMonotonicMs: clock };
  }
  if (event.type === 'resume') {
    const since = next.backgroundSinceMonotonicMs;
    const expired = since !== null && clock - since >= AUTO_LOCK_BACKGROUND_MS;
    return {
      ...next,
      locked: expired ? true : next.locked,
      reason: expired ? 'background' : next.reason,
      backgroundSinceMonotonicMs: null,
    };
  }
  if (event.type === 'native_verified') {
    if (!next.identity || next.identity !== event.identity) return { ...next, locked: true, reason: 'identity_changed' };
    if (next.lockoutUntilMonotonicMs !== null && clock < next.lockoutUntilMonotonicMs) return next;
    if (event.verified) return {
      ...next, locked: false, reason: null, attempts: 0, lockoutUntilMonotonicMs: null,
      backgroundSinceMonotonicMs: null,
    };
    const attempts = next.attempts + 1;
    const lockedOut = attempts >= MAX_UNLOCK_FAILURES;
    return {
      ...next, locked: true,
      reason: lockedOut ? 'failed_attempts' : (next.reason || 'startup'),
      attempts,
      lockoutUntilMonotonicMs: lockedOut ? clock + LOCKOUT_MS : null,
    };
  }
  return next;
}

export type NativeDeviceFeature = 'camera_barcode' | 'bluetooth_printer' | 'wifi_printer' | 'biometric_lock' | 'offline_financial_journal';
export interface FeatureAccess {
  nativePlatform: 'android' | 'ios' | 'web';
  authenticated: boolean;
  appUnlocked: boolean;
  hasStaffPermission: boolean;
  devicePermissionGranted: boolean;
  offline: boolean;
}
/** Only a verified, unlocked staff member may open native device capabilities.
 * Device permissions are requested just-in-time and never silently granted.
 */
export function mayStartNativeFeature(feature: NativeDeviceFeature, access: FeatureAccess): boolean {
  if (access.nativePlatform === 'web' || !access.authenticated || !access.appUnlocked || !access.hasStaffPermission) return false;
  if (!access.devicePermissionGranted) return false;
  if (feature === 'offline_financial_journal') return !access.offline || access.nativePlatform === 'android';
  // Native barcode scanning and paired printer operations need no internet.
  // iOS offline journal requires its own secure native SQLite adapter first.
  return true;
}
