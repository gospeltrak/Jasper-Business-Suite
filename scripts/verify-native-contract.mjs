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
const androidWorkflow = read('.github/workflows/native-android-qa.yml');
const iosWorkflow = read('.github/workflows/native-ios-qa.yml');
const dashboard = read('src/components/Dashboard.tsx');

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
  assert.match(config, /server:\s*\{[\s\S]*hostname:\s*['"]localhost['"]/);
});

test('native-only status bar protects controls and Cloudflare key is required for both QA builds', () => {
  assert.match(config, /SystemBars:\s*\{\s*insetsHandling:\s*['"]css['"]/);
  assert.match(experience, /SystemBars\.setStyle/);
  assert.match(experience, /--orvix-native-safe-top/);
  assert.match(experience, /#login-container[\s\S]*justify-content: safe center/);
  assert.match(experience, /#dashboard-scaffold[\s\S]*padding-top:/);
  for (const workflow of [androidWorkflow, iosWorkflow]) {
    assert.match(workflow, /VITE_TURNSTILE_SITE_KEY:\s*\$\{\{ vars\.VITE_TURNSTILE_SITE_KEY \}\}/);
    assert.match(workflow, /test -n "\$VITE_TURNSTILE_SITE_KEY"/);
  }
});
