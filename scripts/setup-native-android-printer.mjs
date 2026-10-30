// Capacitor generates android/ during CI. Install this native plugin AFTER
// setup-native-android-camera.mjs, without committing generated Android files.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';

const mainRoot = resolve('android/app/src/main');
const manifestPath = join(mainRoot, 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');

const declarations = [
  ['android.permission.BLUETOOTH"', '    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />'],
  ['android.permission.BLUETOOTH_ADMIN"', '    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />'],
  ['android.permission.BLUETOOTH_CONNECT"', '    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />'],
  ['android.hardware.bluetooth"', '    <uses-feature android:name="android.hardware.bluetooth" android:required="false" />'],
];
for (const [needle, declaration] of declarations) {
  if (!manifest.includes(needle)) {
    if (!manifest.includes('<application')) throw new Error('Unexpected Android manifest structure');
    manifest = manifest.replace('<application', declaration + '\n    <application');
  }
}
if (!manifest.includes('android.permission.BLUETOOTH_CONNECT')) {
  throw new Error('Bluetooth connect runtime permission was not declared');
}
await writeFile(manifestPath, manifest);

async function findMainActivity(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) {
      const found = await findMainActivity(next);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      const source = await readFile(next, 'utf8');
      if (source.includes('extends BridgeActivity')) return { path: next, source };
    }
  }
  return null;
}

const activity = await findMainActivity(join(mainRoot, 'java'));
if (!activity) throw new Error('Capacitor MainActivity not found');
const match = activity.source.match(/^package\s+([\w.]+)\s*;/m);
if (!match || match[1] !== 'africa.orvix.app') throw new Error('Unexpected Orvix Android package');

const output = join(dirname(activity.path), 'OrvixPrinter.java');
const template = await readFile(resolve('scripts/native-android-printer/OrvixPrinter.java'), 'utf8');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, template.replace('__ORVIX_PACKAGE__', match[1]));

const cameraMarker = 'registerPlugin(OrvixCameraPermissions.class);';
const printerMarker = 'registerPlugin(OrvixPrinter.class);';
if (!activity.source.includes(cameraMarker)) throw new Error('Camera recovery must be installed before printer');
let updated = activity.source;
if (!updated.includes(printerMarker)) {
  updated = updated.replace(cameraMarker, cameraMarker + '\n    ' + printerMarker);
  await writeFile(activity.path, updated);
}
if (!updated.includes(printerMarker)) throw new Error('Native printer registration failed');
console.log('Orvix Bluetooth printer installed in generated Android shell.');
