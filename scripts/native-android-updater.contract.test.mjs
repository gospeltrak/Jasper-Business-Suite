import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile('scripts/native-android-updates/OrvixBetaUpdater.java', 'utf8');
const installer = await readFile('scripts/setup-native-android-updates.mjs', 'utf8');
const signing = await readFile('scripts/setup-native-android-beta-signing.mjs', 'utf8');
const workflow = await readFile('.github/workflows/native-android-qa.yml', 'utf8');

test('Orvix beta updater requires explicit user approval and checksum verification', () => {
  assert.match(source, /setPositiveButton\("Download & Install"/);
  assert.match(source, /setNegativeButton\("Baadaye"/);
  assert.match(source, /matchesHash\(destination, expectedSha\)/);
  assert.match(source, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(source, /FileProvider\.getUriForFile/);
  assert.match(source, /FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(source, /canRequestPackageInstalls\(\)/);
  assert.doesNotMatch(source, /PackageInstaller\.Session|su\s+-c|Runtime\.getRuntime\(\)/);
});

test('Orvix beta manifest rejects unsafe hosts and wrong app identity', () => {
  assert.match(source, /https:\/\/orvix\.africa\/android-beta-release\.json/);
  assert.match(source, /"africa\.orvix\.app"\.equals/);
  assert.match(source, /"updates\.orvix\.africa"\.equals\(host\)/);
  assert.match(source, /"orvix\.africa"\.equals\(host\)/);
  assert.match(source, /nextVersion <= installedVersion\(activity\)/);
  assert.match(source, /"https"\.equals\(parsed\.getScheme\(\)\)/);
  assert.match(source, /sha\.matches\("\[a-f0-9\]\{64\}"\)/);
});

test('Orvix beta upgrades must have increasing versions and private signing key', () => {
  assert.match(installer, /ORVIX_BETA_VERSION_CODE/);
  assert.match(installer, /versionCode/);
  assert.match(installer, /REQUEST_INSTALL_PACKAGES/);
  assert.match(installer, /orvix_update_paths/);
  assert.match(signing, /ORVIX_BETA_KEYSTORE_PATH/);
  assert.match(signing, /ORVIX_BETA_STORE_PASSWORD/);
  assert.match(workflow, /ORVIX_BETA_KEYSTORE_B64: \$\{\{ secrets\.ORVIX_BETA_KEYSTORE_B64 \}\}/);
  assert.match(workflow, /orvix-android-beta-permanent-key-signed/);
  assert.match(workflow, /DO NOT distribute to tenants/);
});
