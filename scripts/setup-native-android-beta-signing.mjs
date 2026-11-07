// QA beta release signing uses a PRIVATE, persistent keystore injected from
// GitHub Actions secrets. No key or password is committed or printed.
// Never silently fall back to the ephemeral debug signer for distribution.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const names = [
  'ORVIX_BETA_KEYSTORE_PATH',
  'ORVIX_BETA_STORE_PASSWORD',
  'ORVIX_BETA_KEY_ALIAS',
  'ORVIX_BETA_KEY_PASSWORD',
];
for (const name of names) {
  if (!process.env[name]) throw new Error(`Missing private Android beta signing input ${name}`);
}
const path = resolve('android/app/build.gradle');
let text = await readFile(path, 'utf8');
if (!text.includes('android {') || !/\brelease\s*\{/.test(text) ||
    text.includes('orvixBetaRelease')) {
  throw new Error('Unrecognized Android build.gradle signing section');
}
const signing = `
    signingConfigs {
        orvixBetaRelease {
            storeFile file(System.getenv('ORVIX_BETA_KEYSTORE_PATH'))
            storePassword System.getenv('ORVIX_BETA_STORE_PASSWORD')
            keyAlias System.getenv('ORVIX_BETA_KEY_ALIAS')
            keyPassword System.getenv('ORVIX_BETA_KEY_PASSWORD')
        }
    }
`;
text = text.replace('android {', 'android {' + signing);
text = text.replace(/(\brelease\s*\{)/, '$1\n            signingConfig signingConfigs.orvixBetaRelease');
await writeFile(path, text, 'utf8');
console.log('Persistent beta signing configured from Actions secrets (credentials withheld).');
