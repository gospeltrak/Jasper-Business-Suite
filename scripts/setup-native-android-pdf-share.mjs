// Android is generated in CI. Install this alongside camera/printer bridge.
// Never write generated Android files to GitHub or change tenant records.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

const appRoot = resolve('android/app/src/main');
const manifestPath = join(appRoot, 'AndroidManifest.xml');
const manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('.fileprovider') || !manifest.includes('androidx.core.content.FileProvider')) {
  throw new Error('No Capacitor FileProvider in Android manifest; refusing unsafe PDF share');
}
const pathsXml = await readFile(join(appRoot, 'res/xml/file_paths.xml'), 'utf8');
if (!/<cache-path\b/.test(pathsXml)) {
  throw new Error('No cache-path in Android FileProvider; PDFs cannot be shared safely');
}

async function locateActivity(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await locateActivity(full);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      const contents = await readFile(full, 'utf8');
      if (contents.includes('extends BridgeActivity')) return { path: full, contents };
    }
  }
  return null;
}

const main = await locateActivity(join(appRoot, 'java'));
if (!main) throw new Error('Capacitor MainActivity missing');
const packageMatch = main.contents.match(/^package\s+([\w.]+)\s*;/m);
if (!packageMatch || packageMatch[1] !== 'africa.orvix.app') {
  throw new Error('Refusing to install PDF share outside Orvix');
}
const template = await readFile(resolve('scripts/native-android-share/OrvixPdfAttachment.java'), 'utf8');
const dest = join(dirname(main.path), 'OrvixPdfAttachment.java');
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, template.replace('__ORVIX_PACKAGE__', packageMatch[1]));

const printer = 'registerPlugin(OrvixPrinter.class);';
const marker = 'registerPlugin(OrvixPdfAttachment.class);';
if (!main.contents.includes(printer)) throw new Error('Install camera and printer first');
let updated = main.contents;
if (!updated.includes(marker)) {
  updated = updated.replace(printer, printer + '\n    ' + marker);
  await writeFile(main.path, updated);
}
if (!updated.includes(marker)) throw new Error('Failed to register real-PDF Android sharing');
console.log('Orvix Android PDF content-URI sharing enabled (not an automatic WhatsApp sender).');
