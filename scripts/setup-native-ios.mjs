/**
 * Reproducible LOCAL setup for Android/iOS shared Capacitor 8 code.
 * Requirements: Mac + Xcode 26+, Node 22+, npm.
 *
 * No App Store signing or iOS release takes place here.
 * iOS is generated from the current package manifest and local native web
 * assets; no HTML, CSS, or existing mobile/tablet layouts are changed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const native = (executable, args) => execFileSync(executable, args, {
  cwd: root, stdio: 'inherit', env: process.env,
});
if (process.platform !== 'darwin') {
  console.error('Preparing native iOS requires macOS and Xcode 26 or newer.');
  process.exitCode = 2;
} else {
  try {
    native('xcodebuild', ['-version']);
    native('npm', ['install', '--no-save', '--package-lock=false', '--ignore-scripts', '@capacitor/ios@8.5.3']);
    native('npm', ['run', 'native:build:web']);
    if (!existsSync(resolve(root, 'ios/App/App.xcodeproj'))) {
      native('npx', ['cap', 'add', 'ios', '--packagemanager', 'SPM']);
    }
    native('npx', ['cap', 'sync', 'ios']);
    native('node', ['scripts/prepare-native-ios.mjs', '--apply']);
    native('node', ['scripts/prepare-native-ios.mjs', '--verify']);
    console.log('Orvix iOS simulator project prepared (unsigned, not released).');
  } catch (error) {
    console.error('Orvix iOS preparation failed. See the failing command above.');
    process.exitCode = 1;
  }
}
