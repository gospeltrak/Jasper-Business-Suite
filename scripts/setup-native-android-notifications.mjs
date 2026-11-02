// Native notification channels & permission only. Push delivery is separate.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

const mainRoot = resolve('android/app/src/main');
const manifestPath = join(mainRoot, 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('android.permission.POST_NOTIFICATIONS')) {
  manifest = manifest.replace('<application',
    '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <application');
  if (!manifest.includes('android.permission.POST_NOTIFICATIONS')) {
    throw new Error('Failed to declare Android notification permission');
  }
  await writeFile(manifestPath, manifest);
}

async function findMainActivity(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = await findMainActivity(path);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      const content = await readFile(path, 'utf8');
      if (content.includes('extends BridgeActivity')) return { path, content };
    }
  }
  return null;
}
const main = await findMainActivity(join(mainRoot, 'java'));
if (!main) throw new Error('Generated Orvix MainActivity not found');
const pkg = main.content.match(/^package\s+([\w.]+)\s*;/m);
if (!pkg || pkg[1] !== 'africa.orvix.app') throw new Error('Unexpected Android package');
const src = await readFile(resolve('scripts/native-android-notifications/OrvixNotificationChannels.java'), 'utf8');
const output = join(dirname(main.path), 'OrvixNotificationChannels.java');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, src.replace('__ORVIX_PACKAGE__', pkg[1]));

const prior = 'registerPlugin(OrvixDeviceCredential.class);';
const marker = 'registerPlugin(OrvixNotificationChannels.class);';
if (!main.content.includes(prior)) throw new Error('Install device credential before notifications');
if (!main.content.includes(marker)) {
  await writeFile(main.path, main.content.replace(prior, prior + '\n    ' + marker));
}
console.log('Orvix Android notification channels installed; remote push still requires FCM.');
