import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const config = read('capacitor.config.ts');
const transport = read('src/shared/utils/nativeApiTransport.ts');
const main = read('src/main.tsx');
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
