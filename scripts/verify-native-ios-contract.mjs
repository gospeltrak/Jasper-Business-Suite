import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const config = read('capacitor.config.ts');
const workflow = read('.github/workflows/native-ios-qa.yml');
const android = read('.github/workflows/native-android-qa.yml');
const script = read('scripts/prepare-native-ios.mjs');
const pkg = JSON.parse(read('package.json'));

assert.equal(pkg.dependencies['@capacitor/core'], pkg.dependencies['@capacitor/android'],
  'Android and iOS should use the same Capacitor major version');
assert.match(config, /appId:\s*['"]africa\.orvix\.app['"]/);
assert.match(config, /iosScheme:\s*['"]capacitor['"]/);
assert.match(config, /webDir:\s*['"]dist\/native-web['"]/);
assert.doesNotMatch(config, /server:\s*\{[^}]*\burl\s*:/s, 'Native iOS must cold-start from bundled code');

assert.match(workflow, /workflow_dispatch:/, 'iOS QA must be a deliberately run workflow');
assert.doesNotMatch(workflow, /\bpush:\s|\bpull_request:\s/, 'Do not incur automatic macOS runner charges');
assert.match(workflow, /runs-on:\s*macos-26/);
assert.match(workflow, /@capacitor\/ios@8\.5\.3/);
assert.match(workflow, /npx cap add ios --packagemanager SPM/);
assert.match(workflow, /xcodebuild/);
assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/);
assert.match(workflow, /-destination 'generic\/platform=iOS Simulator'/);
assert.doesNotMatch(workflow, /\b(?:app-store|fastlane|upload-to-app-store|publish-app|xcrun altool)\b/i);
assert.match(android, /assembleDebug/);
assert.match(android, /orvix-android-debug-qa-only/);

for (const key of [
  'NSCameraUsageDescription', 'NSFaceIDUsageDescription',
  'NSBluetoothAlwaysUsageDescription', 'NSLocalNetworkUsageDescription',
]) {
  assert.ok(script.includes(key), `iOS permission metadata missing: ${key}`);
}
assert.match(script, /ios.*App.*App.*Info\.plist/s);
assert.ok(!script.includes('NSAppTransportSecurity') &&
  !script.includes('NSAllowsArbitraryLoads'), 'Do not disable iOS HTTPS security');
console.log('Orvix native Android/iOS configuration contracts verified; no iOS signing or release enabled.');
