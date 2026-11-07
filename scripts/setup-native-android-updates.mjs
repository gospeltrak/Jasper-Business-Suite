// Installs the isolated QA-only Android updater AFTER Capacitor sync and
// existing camera patch. The normal offline native branch remains untouched.
// No silent install: Android's package installer always requests consent.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const gradlePath = resolve('android/app/build.gradle');
const versionCode = Number(process.env.ORVIX_BETA_VERSION_CODE);
if (!Number.isSafeInteger(versionCode) || versionCode <= 1 || versionCode > 1_000_000) {
  throw new Error('ORVIX_BETA_VERSION_CODE must be a positive monotonically increasing build number > 1');
}
let gradle = await readFile(gradlePath, 'utf8');
if (!/\bversionCode\s+1\b/.test(gradle)) {
  throw new Error('Unexpected Android Gradle versionCode; manual review required');
}
gradle = gradle.replace(/\bversionCode\s+1\b/, 'versionCode ' + versionCode);
await writeFile(gradlePath, gradle, 'utf8');

const root = resolve('android/app/src/main');
const manifestPath = join(root, 'AndroidManifest.xml');
const javaRoot = join(root, 'java');

async function locateMain(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      const found = await locateMain(full);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      const text = await readFile(full, 'utf8');
      if (text.includes('extends BridgeActivity')) return { path: full, text };
    }
  }
  return null;
}

const main = await locateMain(javaRoot);
if (!main) throw new Error('Generated Android MainActivity not found');
const pack = /^package\s+([\w.]+)\s*;/m.exec(main.text)?.[1];
if (pack !== 'africa.orvix.app') throw new Error('Unexpected package: ' + pack);
if (!main.text.includes('registerPlugin(OrvixCameraPermissions.class)')) {
  throw new Error('Camera recovery patch missing; install updater after camera patch');
}
if (/\bvoid\s+onResume\s*\(/.test(main.text)) {
  throw new Error('Existing MainActivity onResume; review before adding update checker');
}
const marker = 'public class MainActivity extends BridgeActivity {';
if (!main.text.includes(marker)) throw new Error('Unknown generated MainActivity class');
const patchedActivity = main.text.replace(marker, marker + `
  @Override
  protected void onResume() {
    super.onResume();
    // Never refresh checkout or interrupt forms; only check for a native beta.
    OrvixBetaUpdater.onResume(this);
  }
`);
await writeFile(main.path, patchedActivity, 'utf8');

const updaterSource = await readFile(resolve('scripts/native-android-updates/OrvixBetaUpdater.java'), 'utf8');
if (!updaterSource.includes('package africa.orvix.app;')) {
  throw new Error('Unexpected updater package');
}
await writeFile(join(dirname(main.path), 'OrvixBetaUpdater.java'), updaterSource, 'utf8');

let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('xmlns:android=')) throw new Error('Android manifest namespace missing');
if (!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
  manifest = manifest.replace('</manifest>',
    '  <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n</manifest>');
}
const provider = `        <provider
          android:name="androidx.core.content.FileProvider"
          android:authorities="\${applicationId}.updatefiles"
          android:exported="false"
          android:grantUriPermissions="true">
          <meta-data
            android:name="android.support.FILE_PROVIDER_PATHS"
            android:resource="@xml/orvix_update_paths" />
        </provider>
`;
if (!manifest.includes('android.support.FILE_PROVIDER_PATHS')) {
  if (!manifest.includes('</application>')) throw new Error('Android application element missing');
  manifest = manifest.replace('</application>', provider + '    </application>');
}
await writeFile(manifestPath, manifest, 'utf8');

const xmlDir = join(root, 'res/xml');
await mkdir(xmlDir, { recursive: true });
await writeFile(join(xmlDir, 'orvix_update_paths.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<paths xmlns:android="http://schemas.android.com/apk/res/android">\n' +
  '  <external-files-path name="beta_updates" path="Download/" />\n' +
  '</paths>\n', 'utf8');
if (!patchedActivity.includes('OrvixBetaUpdater.onResume(this);') ||
    !manifest.includes('REQUEST_INSTALL_PACKAGES') ||
    !manifest.includes('orvix_update_paths')) {
  throw new Error('Android update integration contract failed');
}
console.log('Orvix beta updater installed: explicit consent, SHA-256, package/signature checks delegated to Android.');
