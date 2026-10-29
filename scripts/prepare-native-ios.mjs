/**
 * Run only after `npx cap add ios --packagemanager SPM` on macOS.
 * Adds JUST-in-time permission purpose strings, but requests no permissions,
 * turns on no entitlements and does not touch Orvix's existing web/mobile UI.
 *
 * No PIN, scanner, Face ID or Bluetooth plugin is enabled by this script.
 * This prepares App Store review-ready descriptions for later native plugins.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plist = resolve(root, 'ios', 'App', 'App', 'Info.plist');
const plistBuddy = '/usr/libexec/PlistBuddy';

export const purposeStrings = Object.freeze({
  NSCameraUsageDescription:
    'Orvix uses the camera only when you scan a product barcode or attach a receipt to an expense.',
  NSFaceIDUsageDescription:
    'Orvix can use Face ID to unlock encrypted business records on this device when you choose to enable it.',
  NSBluetoothAlwaysUsageDescription:
    'Orvix uses Bluetooth only when you choose to pair and print to a compatible receipt printer.',
  NSLocalNetworkUsageDescription:
    'Orvix connects to a receipt printer on your local network only when you choose to print.',
});

function plistEntry(key) {
  try {
    return execFileSync(plistBuddy, ['-c', `Print :${key}`, plist], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
function setEntry(key, value) {
  const current = plistEntry(key);
  if (current === value) return;
  const command = current === null
    ? `Add :${key} string ${value}`
    : `Set :${key} ${value}`;
  execFileSync(plistBuddy, ['-c', command, plist], { stdio: 'pipe' });
}

const mode = process.argv[2];
if (!['--apply', '--verify'].includes(mode)) {
  console.error('Usage: node scripts/prepare-native-ios.mjs --apply|--verify');
  process.exitCode = 2;
} else if (process.platform !== 'darwin' || !existsSync(plistBuddy) || !existsSync(plist)) {
  console.error('iOS native configuration requires macOS, Xcode and generated ios/App/App/Info.plist');
  process.exitCode = 2;
} else {
  try {
    if (mode === '--apply') {
      for (const [key, value] of Object.entries(purposeStrings)) setEntry(key, value);
    }
    for (const [key, value] of Object.entries(purposeStrings)) {
      assert.equal(plistEntry(key), value, `Missing/modified iOS privacy description: ${key}`);
    }
    // This app must not replace packaged local HTML with a mandatory
    // remote server.url, nor disable TLS transport.
    const keys = Object.keys(purposeStrings);
    console.log(`iOS simulator native permissions metadata verified (${keys.length} just-in-time strings)`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
