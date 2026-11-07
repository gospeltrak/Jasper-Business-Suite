import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// This QA branch may change ONLY icon resources, the native branding builder,
// the Android workflow, and the exact native-only logoSrc of the splash.
// Fail closed on all other UI, POS, auth, reports and business logic changes.
const base = 'origin/feature/orvix-native-offline-v1';
const allowed = new Set([
  '.github/workflows/native-android-qa.yml',
  'scripts/setup-native-android-branding.py',
  'scripts/verify-native-contract.mjs',
  'scripts/verify-native-branding-qa.mjs',
  'src/App.tsx',
  'public/brand/orvix-qa-logo.png',
]);
const paths = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], {encoding:'utf8'})
  .trim().split(/\r?\n/).filter(Boolean);
for (const path of paths) assert.ok(allowed.has(path), 'Unexpected application change: ' + path);
const old = execFileSync('git', ['show', base + ':src/App.tsx'], {encoding:'utf8'});
const logoBefore = "splashRequest.mode === 'tenant' ? splashRequest.logoSrc : isOrvixNativeApp() ? '/icon-512.png' : undefined";
const logoAfter = "splashRequest.mode === 'tenant' ? splashRequest.logoSrc : isOrvixNativeApp() ? '/brand/orvix-qa-logo.png' : undefined";
assert.equal(old.split(logoBefore).length, 2, 'Native logo hook changed unexpectedly');
assert.equal(readFileSync('src/App.tsx', 'utf8'), old.replace(logoBefore, logoAfter),
  'App.tsx contains unauthorized changes beyond native intro logo');
const baselineContract = execFileSync('git', ['show', base + ':scripts/verify-native-contract.mjs'], {encoding:'utf8'});
const contractOld = "isOrvixNativeApp\\(\\) \\? '\\/icon-512\\.png' : undefined";
const contractNew = "isOrvixNativeApp\\(\\) \\? '\\/brand\\/orvix-qa-logo\\.png' : undefined";
assert.equal(baselineContract.split(contractOld).length, 2, 'Original native splash assertion changed');
assert.equal(readFileSync('scripts/verify-native-contract.mjs', 'utf8'),
  baselineContract.replace(contractOld, contractNew),
  'Native regression test contains unexpected changes besides splash path');

console.log('Branding QA isolation passed — no other native or business logic changed.');
