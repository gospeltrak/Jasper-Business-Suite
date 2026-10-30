import { Capacitor, registerPlugin } from '@capacitor/core';

// Android system permission is independent from WebView's getUserMedia
// permission. Capacitor's built-in WebChromeClient handles the latter;
// this bridge lets the scanner re-request the former or open App Settings.
export type CameraPermissionState = 'granted' | 'prompt' | 'prompt-with-rationale' | 'denied';
interface OrvixCameraPermissions {
  checkCamera(): Promise<{ camera: CameraPermissionState }>;
  requestCamera(): Promise<{ camera: CameraPermissionState }>;
  openSettings(): Promise<void>;
}
const NativeCameraPermissions = registerPlugin<OrvixCameraPermissions>('OrvixCameraPermissions');

export function isNativeAndroidScanner(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function checkNativeCameraPermission(): Promise<CameraPermissionState | null> {
  if (!isNativeAndroidScanner()) return null;
  try {
    return (await NativeCameraPermissions.checkCamera()).camera;
  } catch (error) {
    // Older QA APKs predate the native bridge. Let the WebView handle them
    // as before, with a Retry action instead of a permanently stuck error.
    console.warn('Orvix camera permission bridge unavailable:', error);
    return null;
  }
}

export async function requestNativeCameraPermission(): Promise<CameraPermissionState | null> {
  if (!isNativeAndroidScanner()) return null;
  try {
    return (await NativeCameraPermissions.requestCamera()).camera;
  } catch (error) {
    console.warn('Orvix camera permission request unavailable:', error);
    return null;
  }
}

export async function openNativeCameraSettings(): Promise<boolean> {
  if (!isNativeAndroidScanner()) return false;
  try {
    await NativeCameraPermissions.openSettings();
    return true;
  } catch (error) {
    console.warn('Orvix app settings could not be opened:', error);
    return false;
  }
}
