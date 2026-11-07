// Stamp the deployed service worker with this release's Git SHA.
// sw.js intentionally does NOT cache responses. Changing its bytes once per
// deploy lets existing browser tabs discover a new release via registration.update()
// and index.html's controllerchange handler, without touching tenant data.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const workerPath = resolve('dist/sw.js');
const template = await readFile(workerPath, 'utf8');
const marker = '__ORVIX_BUILD_VERSION__';
if (!template.includes(marker)) {
  throw new Error('Missing service-worker build marker: refusing an unverifiable release');
}

const fromEnvironment = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
let fromRepository = '';
if (!/^[a-f0-9]{7,64}$/i.test(fromEnvironment)) {
  try {
    fromRepository = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Some production builders do not include Git metadata.
  }
}
const sha = /^[a-f0-9]{7,64}$/i.test(fromEnvironment)
  ? fromEnvironment
  : /^[a-f0-9]{7,64}$/i.test(fromRepository)
    ? fromRepository
    : '';
// A non-Git build should still force SW revalidation (never reuse 'placeholder').
const version = sha || `build-${Date.now().toString(36)}`;
const htmlPath = resolve('dist/index.html');
const html = await readFile(htmlPath, 'utf8');
if (!html.includes(marker)) {
  throw new Error('Missing Orvix app-shell release marker: refusing an unversioned deployment');
}

await writeFile(workerPath, template.replaceAll(marker, version), 'utf8');
await writeFile(htmlPath, html.replaceAll(marker, version), 'utf8');
// The tiny public marker works in browsers and remote-URL Android WebViews
// (even if the native WebView does not support service workers).
// It contains no tenant data or download link, and is never executable code.
await writeFile(resolve('dist/orvix-release.json'), JSON.stringify({
  schemaVersion: 1,
  webVersion: version,
  updateStrategy: 'next-launch',
}) + '\n', 'utf8');
console.log(`Orvix web release stamped: ${version.slice(0, 12)}`);
