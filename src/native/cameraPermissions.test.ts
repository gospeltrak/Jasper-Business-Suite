import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: vi.fn(() => 'android'),
  isNative: vi.fn(() => true),
  check: vi.fn(),
  request: vi.fn(),
  settings: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: native.isNative,
    getPlatform: native.platform,
  },
  registerPlugin: () => ({
    checkCamera: native.check,
    requestCamera: native.request,
    openSettings: native.settings,
  }),
}));

import {
  checkNativeCameraPermission,
  isNativeAndroidScanner,
  openNativeCameraSettings,
  requestNativeCameraPermission,
} from './cameraPermissions';

describe('Orvix Android camera recovery bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.isNative.mockReturnValue(true);
    native.platform.mockReturnValue('android');
  });

  it('distinguishes blocked vs granted Android camera permissions', async () => {
    native.check.mockResolvedValueOnce({ camera: 'denied' })
      .mockResolvedValueOnce({ camera: 'granted' });
    expect(await checkNativeCameraPermission()).toBe('denied');
    expect(await checkNativeCameraPermission()).toBe('granted');
    expect(native.check).toHaveBeenCalledTimes(2);
  });

  it('lets the user re-request a promptable camera permission', async () => {
    native.request.mockResolvedValue({ camera: 'granted' });
    expect(await requestNativeCameraPermission()).toBe('granted');
    expect(native.request).toHaveBeenCalledTimes(1);
  });

  it('opens this installed app settings when permission is blocked', async () => {
    native.settings.mockResolvedValue(undefined);
    expect(await openNativeCameraSettings()).toBe(true);
    expect(native.settings).toHaveBeenCalledTimes(1);
  });

  it('never invokes the Android plugin from a normal browser or iOS', async () => {
    native.isNative.mockReturnValue(false);
    expect(isNativeAndroidScanner()).toBe(false);
    expect(await checkNativeCameraPermission()).toBeNull();
    expect(await requestNativeCameraPermission()).toBeNull();
    expect(await openNativeCameraSettings()).toBe(false);
    expect(native.check).not.toHaveBeenCalled();
    native.isNative.mockReturnValue(true);
    native.platform.mockReturnValue('ios');
    expect(isNativeAndroidScanner()).toBe(false);
  });

  it('keeps a manual retry path when an older QA APK lacks the bridge', async () => {
    native.check.mockRejectedValue(new Error('plugin unavailable'));
    expect(await checkNativeCameraPermission()).toBeNull();
  });
});
