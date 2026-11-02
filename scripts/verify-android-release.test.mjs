import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRelease } from './verify-android-release.mjs';

const secure = () => ({
  manifest: { package: 'africa.orvix.app', versionCode: 2, versionName: '1.1' },
  application: { debuggable: false, allowBackup: false },
  permissions: ['android.permission.POST_NOTIFICATIONS'],
});

test('safe Android release manifest passes', () => {
  assert.deepEqual(checkRelease(secure()), []);
});

test('QA debug build is rejected for production distribution', () => {
  const build = secure();
  build.application.debuggable = true;
  assert.match(checkRelease(build).join(' '), /debuggable/);
});

test('Android release needs private data backup disabled', () => {
  const build = secure();
  build.application.allowBackup = true;
  assert.match(checkRelease(build).join(' '), /allowBackup/);
});

test('Android release needs notification permission and newer versionCode', () => {
  const build = secure();
  build.permissions = [];
  build.manifest.versionCode = 1;
  const warnings = checkRelease(build).join(' ');
  assert.match(warnings, /POST_NOTIFICATIONS/);
  assert.match(warnings, /versionCode/);
});
