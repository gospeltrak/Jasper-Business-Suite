// Generated Android shell: register OS-protected device credential check.
// Run after camera + printer + PDF share setup scripts.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';

async function findMainActivity(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const at = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = await findMainActivity(at);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      const source = await readFile(at, 'utf8');
      if (source.includes('extends BridgeActivity')) return { at, source };
    }
  }
  return null;
}
const main = await findMainActivity(resolve('android/app/src/main/java'));
if (!main) throw new Error('Capacitor MainActivity missing');
const match = main.source.match(/^package\s+([\w.]+)\s*;/m);
if (!match || match[1] !== 'africa.orvix.app') throw new Error('Invalid Android package for Orvix');
const prior = 'registerPlugin(OrvixPdfAttachment.class);';
const marker = 'registerPlugin(OrvixDeviceCredential.class);';
if (!main.source.includes(prior)) throw new Error('Install PDF plugin before device credential gate');
const template = await readFile(resolve('scripts/native-android-security/OrvixDeviceCredential.java'), 'utf8');
const target = join(dirname(main.at), 'OrvixDeviceCredential.java');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, template.replace('__ORVIX_PACKAGE__', match[1]));
if (!main.source.includes(marker)) {
  await writeFile(main.at, main.source.replace(prior, prior + '\n    ' + marker));
}
console.log('Android device PIN/pattern/password unlock registered.');
