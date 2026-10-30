import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const config = read('capacitor.config.ts');
const transport = read('src/shared/utils/nativeApiTransport.ts');
const main = read('src/main.tsx');
const app = read('src/App.tsx');
const experience = read('src/native/nativeAppExperience.ts');
const turnstileWidget = read('src/shared/components/TurnstileWidget.tsx');
const androidWorkflow = read('.github/workflows/native-android-qa.yml');
const iosWorkflow = read('.github/workflows/native-ios-qa.yml');
const dashboard = read('src/components/Dashboard.tsx');
const scanner = read('src/shared/components/DashboardBarcodeScanner.tsx');
const cameraBridge = read('src/native/cameraPermissions.ts');
const cameraJava = read('scripts/native-android-camera/OrvixCameraPermissions.java');
const cameraSetup = read('scripts/setup-native-android-camera.mjs');


test('native dependencies are locked and match the root manifest', () => {
  for (const name of ['@capacitor/core', '@capacitor/android', '@capacitor/cli']) {
    const declaration = pkg.dependencies?.[name] || pkg.devDependencies?.[name];
    assert.ok(declaration, `${name} dependency is missing`);
    assert.equal(
      lock.packages[''].dependencies?.[name] || lock.packages[''].devDependencies?.[name],
      declaration,
      `${name} must be reflected in package-lock root`,
    );
    assert.ok(lock.packages[`node_modules/${name}`], `${name} must be resolvable with npm ci`);
  }
});

test('native shell has bundled content and no mandatory internet origin', () => {
  assert.match(config, /webDir:\s*['"]dist\/native-web['"]/);
  assert.doesNotMatch(config, /server:\s*\{[^}]*\burl\s*:/s);
  assert.match(config, /androidScheme:\s*['"]https['"]/);
  assert.match(config, /iosScheme:\s*['"]capacitor['"]/);
  assert.match(config, /cleartext:\s*false/);
  assert.match(config, /CapacitorHttp:\s*\{\s*enabled:\s*true/);
  assert.ok(pkg.scripts['native:build:web']?.includes('vite build --outDir dist/native-web'));
  assert.ok(!pkg.scripts['native:build:web'].includes('esbuild server.ts'));
});

test('only local native API paths are rewritten to the trusted HTTPS backend', () => {
  assert.match(transport, /Capacitor\.isNativePlatform\(\)/);
  assert.match(transport, /const API_ORIGIN = 'https:\/\/orvix\.africa'/);
  assert.match(transport, /candidate\.origin !== window\.location\.origin/);
  assert.match(transport, /candidate\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(transport, /new Request\(upstream\.href, input\)/);
  assert.match(main, /installNativeApiTransport\(\)/);
});

test('Orvix never renders app-controlled Install PWA messages on any platform', () => {
  assert.doesNotMatch(dashboard, /PWAInstallBanner|requestManualInstallPrompt|install-orvix-app/);
  assert.doesNotMatch(dashboard, /Install (?:Orvix|Admin) App/);
  assert.match(dashboard, /setActiveTab\(item\.id as any\)/);
});

test('native app opens animated logo/login instead of public landing, preserving website behavior', () => {
  assert.match(main, /installNativeAppExperience\(\)/);
  assert.match(experience, /Capacitor\.isNativePlatform\(\)/);
  assert.match(experience, /window\.history\.replaceState\(window\.history\.state, '', entry\)/);
  assert.match(experience, /orvix-native-app/);
  assert.match(app, /nativeEntryPath\(path\)/);
  assert.match(app, /isOrvixNativeApp\(\) \? '\/icon-512\.png' : undefined/);
  assert.match(config, /server:\s*\{[\s\S]*hostname:\s*['"]app\.orvix\.africa['"]/);
  // Android must remain HTTPS so the local asset origin is an authorized
  // orvix.africa subdomain and cross-site protections can stay enabled.
  assert.match(config, /androidScheme:\s*['"]https['"]/);
});

test('native-only status bar protects controls and Cloudflare key is required for both QA builds', () => {
  assert.match(config, /SystemBars:\s*\{\s*insetsHandling:\s*['"]css['"]/);
  assert.match(experience, /SystemBars\.setStyle/);
  assert.match(experience, /--orvix-native-safe-top/);
  assert.match(experience, /#login-container[\s\S]*justify-content: safe center/);
  assert.match(experience, /#dashboard-scaffold[\s\S]*padding-top:/);
  // Dashboard shell owns the Android status-bar clearance. The website's
  // header also adds env(safe-area-inset-top), so the native-only override must
  // remove that duplicated gap without moving icons under the system bar.
  assert.match(experience, /header\[class\*="h-\[calc\(60px\+env\(safe-area-inset-top\)\)\]"\]/);
  assert.match(experience, /height: 60px !important;\s*padding-top: 0 !important;/);
  assert.match(experience, /padding-top: var\(--orvix-native-safe-top\)/);
  assert.match(dashboard, /h-\[calc\(60px\+env\(safe-area-inset-top\)\)\]/);
  // Native Turnstile explicitly renders; the ordinary browser script is unchanged.
  assert.match(turnstileWidget, /Capacitor\.isNativePlatform\(\)/);
  assert.match(turnstileWidget, /api\.js\?render=explicit/);
  assert.match(turnstileWidget, /:\s*'https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js'/);
  // A fresh GitHub runner generates a new debug signer unless this
  // keystore is restored. Keep QA upgrades possible without release keys.
  assert.match(androidWorkflow, /uses: actions\/cache@v4/);
  assert.match(androidWorkflow, /path:\s*~\/\.android\/debug\.keystore/);
  assert.match(androidWorkflow, /orvix-android-qa-debug-signing/);
  for (const workflow of [androidWorkflow, iosWorkflow]) {
    assert.match(workflow, /VITE_TURNSTILE_SITE_KEY:\s*\$\{\{ vars\.VITE_TURNSTILE_SITE_KEY \}\}/);
    assert.match(workflow, /test -n "\$VITE_TURNSTILE_SITE_KEY"/);
  }
});


test('Android barcode scanner requests camera permission on use and recovers after denial', () => {
  assert.match(cameraBridge, /registerPlugin.*OrvixCameraPermissions/);
  assert.match(cameraBridge, /checkCamera/);
  assert.match(cameraBridge, /requestCamera/);
  assert.match(cameraBridge, /openSettings/);
  assert.match(cameraJava, /Manifest\.permission\.CAMERA/);
  assert.match(cameraJava, /Settings\.ACTION_APPLICATION_DETAILS_SETTINGS/);
  assert.match(cameraJava, /requestPermissionForAlias\("camera"/);
  assert.match(cameraSetup, /android\.permission\.CAMERA/);
  assert.match(cameraSetup, /registerPlugin\(OrvixCameraPermissions\.class\)/);
  assert.match(androidWorkflow, /node scripts\/setup-native-android-camera\.mjs/);
  assert.match(scanner, /requestNativeCameraPermission/);
  assert.match(scanner, /checkNativeCameraPermission/);
  assert.match(scanner, /openNativeCameraSettings/);
  assert.match(scanner, /visibilitychange/);
  assert.match(scanner, /cameraOpQueue/);
  assert.match(scanner, /Try again/);
  assert.match(scanner, /Fungua mipangilio ya kamera/);
  assert.match(scanner, /USB or Bluetooth scanner/);
});
