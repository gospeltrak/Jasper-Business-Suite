import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

/**
 * Orvix UI freeze for the native-app PR.
 *
 * UI components, mobile/tablet layouts, styling, navigation, and existing POS/
 * Purchasing/Expenses screens are frozen. App functionality is added through
 * native services, secure storage, transport and backend logic, NOT redesigns.
 *
 * The sole permitted Dashboard difference suppresses the redundant web-PWA
 * install prompt inside a native shell. The sole permitted main.tsx difference
 * initializes the native API transport without changing viewport/UI logic.
 */
export function isPermittedNativeDiffPath(path) {
  // New native services/tests are allowed; new JSX/styles are NOT implicit UI approvals.
  if (path.startsWith('src/native/')) return path.endsWith('.ts');
  if (/^src\/server\/nativeOfflineLedger(?:\.test)?\.ts$/.test(path)) return true;
  if (path === 'src/shared/utils/nativeApiTransport.ts') return true;
  if (path === 'src/main.tsx' || path === 'src/components/Dashboard.tsx') return true;
  if (path.startsWith('src/') || path.startsWith('public/') ||
      path === 'index.html' || /\.(?:css|scss|sass|less|svg|png|jpe?g|webp)$/i.test(path)) {
    return false;
  }
  return true;
}

export function stripPermittedNativeShellAdapters(path, current) {
  if (path === 'src/components/Dashboard.tsx') {
    // Exactly the native PWA banner check. No JSX classes/layout may differ.
    const addedImport = "import { Capacitor } from '@capacitor/core';\n";
    const allowedExpression = "{(mirrorMode || Capacitor.isNativePlatform()) ? null : user.role === 'SuperAdmin' ? (";
    const originalExpression = "{mirrorMode ? null : user.role === 'SuperAdmin' ? (";
    if (!current.includes(addedImport) || !current.includes(allowedExpression)) {
      throw new Error('Dashboard.tsx native shell adapter changed unexpectedly.');
    }
    return current.replace(addedImport, '').replace(allowedExpression, originalExpression);
  }
  if (path === 'src/main.tsx') {
    const bootstrap =
      "import { installNativeApiTransport } from './shared/utils/nativeApiTransport';\n" +
      "installNativeApiTransport();\n";
    if (!current.includes(bootstrap)) {
      throw new Error('main.tsx native shell adapter changed unexpectedly.');
    }
    return current.replace(bootstrap, '');
  }
  return current;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}
function verifyAgainstBase(base) {
  const baseline = git('merge-base', base, 'HEAD').trim();
  const diff = git('diff', '--name-only', '--no-renames', baseline, 'HEAD')
    .split(/\r?\n/).filter(Boolean);
  const failures = [];
  for (const path of diff) {
    if (!isPermittedNativeDiffPath(path)) {
      failures.push(`UI or visual asset modification forbidden: ${path}`);
      continue;
    }
    if (path !== 'src/main.tsx' && path !== 'src/components/Dashboard.tsx') continue;
    try {
      const oldSource = git('show', `${baseline}:${path}`);
      const current = readFileSync(path, 'utf8');
      assert.equal(stripPermittedNativeShellAdapters(path, current), oldSource);
    } catch (error) {
      failures.push(`Unexpected changes to protected entrypoint ${path}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (failures.length > 0) {
    console.error('ORVIX NATIVE UI FREEZE FAILED\n' + failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`Orvix native UI freeze passed: ${diff.length} changed files checked, existing UI visually unchanged.`);
}
function selfTest() {
  const blocked = [
    'src/index.css', 'src/modules/pos/DashboardPOS.tsx',
    'src/modules/purchases/DashboardPurchases.tsx',
    'src/modules/expenses/DashboardExpenses.tsx',
    'src/components/GlobalBranchSwitcher.tsx',
    'src/shared/contexts/ThemeContext.tsx',
    'index.html', 'public/logo.svg', 'src/App.tsx',
    'src/native/NativePinScreen.tsx', 'src/native/native.css',
  ];
  for (const path of blocked) assert.equal(isPermittedNativeDiffPath(path), false, path);
  const permitted = [
    'src/native/offlineConflictEngine.ts', 'src/server/nativeOfflineLedger.ts',
    'src/server/nativeOfflineLedger.test.ts',
    'src/shared/utils/nativeApiTransport.ts',
    'src/main.tsx', 'src/components/Dashboard.tsx',
    'docs/native-device-experience.md', 'capacitor.config.ts',
  ];
  for (const path of permitted) assert.equal(isPermittedNativeDiffPath(path), true, path);
  assert.throws(() => stripPermittedNativeShellAdapters('src/main.tsx', 'redesigned UI'),
    /adapter changed/);
  assert.throws(() => stripPermittedNativeShellAdapters('src/components/Dashboard.tsx', 'redesigned UI'),
    /adapter changed/);
  console.log('Orvix UI freeze policy self-tests passed.');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const baseIndex = process.argv.indexOf('--base');
  if (baseIndex === -1 || !process.argv[baseIndex + 1]) {
    console.error('Usage: node scripts/verify-native-ui-freeze.mjs --base origin/main');
    process.exitCode = 2;
  } else {
    verifyAgainstBase(process.argv[baseIndex + 1]);
  }
}
