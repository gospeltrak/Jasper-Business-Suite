import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const artifactMode = process.argv.includes('--artifacts');
const failures = [];

const fail = (message) => failures.push(message);

const assertFile = async (path, minimumBytes = 1) => {
  try {
    const info = await stat(join(projectRoot, path));
    if (!info.isFile() || info.size < minimumBytes) {
      fail(`${path} is missing or smaller than ${minimumBytes} bytes.`);
    }
  } catch {
    fail(`${path} is missing.`);
  }
};

const walk = async (directory) => {
  const absolute = join(projectRoot, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...await walk(relative(projectRoot, path)));
    else files.push(path);
  }
  return files;
};

if (artifactMode) {
  await assertFile('dist/index.html', 500);
  await assertFile('dist/server.cjs', 10_000);
  const assetFiles = await walk('dist/assets').catch(() => []);
  if (!assetFiles.some((file) => /\.(js|css)$/.test(file))) {
    fail('dist/assets does not contain compiled JavaScript or CSS.');
  }
} else {
  for (const required of [
    'src/main.tsx',
    'src/App.tsx',
    'src/components/Dashboard.tsx',
    'src/components/DashboardSalesList.tsx',
    'src/utils/pdfShare.ts',
    'server.ts',
    'vercel.json',
  ]) {
    await assertFile(required, 20);
  }

  const sourceFiles = (
    await Promise.all(['src', 'api', 'scripts'].map((directory) => walk(directory).catch(() => [])))
  ).flat().filter((file) => /\.(?:[cm]?[jt]sx?|json|css)$/.test(file));

  const conflictMarker = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;
  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    const label = relative(projectRoot, file);
    if (!source.trim()) fail(`${label} is empty.`);
    if (conflictMarker.test(source)) fail(`${label} contains an unresolved merge-conflict marker.`);
    const deploymentBlockerMarker = ['TODO', 'DEPLOY', 'BLOCKER'].join('_');
    if (source.includes(deploymentBlockerMarker)) fail(`${label} contains ${deploymentBlockerMarker}.`);
  }

  const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  if (!String(packageJson.scripts?.prebuild || '').includes('verify:deploy')) {
    fail('package.json prebuild must run verify:deploy.');
  }
  if (!String(packageJson.scripts?.build || '').includes('verify-deploy.mjs --artifacts')) {
    fail('package.json build must validate compiled artifacts.');
  }
}

if (failures.length) {
  console.error('\nDEPLOYMENT BLOCKED\n');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  console.error('\nFix every item above, then run npm run verify:deploy again.\n');
  process.exit(1);
}

console.log(artifactMode
  ? 'Deployment artifacts verified.'
  : `Deployment source gate passed.`);
