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
 * The user explicitly authorized ONE global UI removal: all Install PWA
 * banners and install-menu entries, on web, tablet, phone and native.
 * Everything else stays byte-for-byte identical to main's UI.
 * The only permitted main.tsx difference initializes native API transport.
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

function replaceExactOnce(input, expression, replacement, description) {
  const matches = input.match(expression);
  if (!matches || matches.length !== 1) {
    throw new Error(`Authorized Install PWA removal anchor changed: ${description}`);
  }
  return input.replace(expression, replacement);
}

export function expectedDashboardAfterAuthorizedPwaRemoval(baseline) {
  // PR #8 has already removed all PWA install prompts from production.
  // Once main contains that hotfix, native UI must match it byte-for-byte.
  if (!baseline.includes("import PWAInstallBanner from '../shared/components/PWAInstallBanner';")) {
    assert.doesNotMatch(baseline, /<PWAInstallBanner|requestManualInstallPrompt|install-orvix-app/);
    return baseline;
  }
  let result = baseline;
  const once = (pattern, replacement, name) => {
    result = replaceExactOnce(result, pattern, replacement, name);
  };
  once(/^import PWAInstallBanner from '\.\.\/shared\/components\/PWAInstallBanner';\n/m, '', 'banner import');
  once(/^import \{ requestManualInstallPrompt \} from '\.\.\/shared\/utils\/pwaInstallPrompt';\n/m, '', 'manual install import');
  once(/      \{\/\* PWA install banner —[\s\S]*?\n      \{\/\* Branch-switch data reload indicator\./,
    '      {/* Branch-switch data reload indicator.', 'install banner only');
  once(/\n[ \t]*\{user\.role !== 'SuperAdmin' && \(\n[\s\S]*?requestManualInstallPrompt\(\); setShowUserMenu\(false\);[\s\S]*?\n[ \t]*\)\}/,
    '', 'profile install option');
  once(/^.*\{ id: 'install-orvix-app', label: 'Install Admin App'.*\n/m, '', 'admin More install');
  once(/^.*\{ id: 'install-orvix-app', label: 'Install Orvix App'.*\n/m, '', 'tenant More install');
  once(/\} else if \(item\.id === 'install-orvix-app'\) \{\n\s*requestManualInstallPrompt\(\);\n\s*/,
    '', 'More menu install handler');
  once(/Handshake, Download, LoaderCircle \} from "lucide-react";/,
    'Handshake, LoaderCircle } from "lucide-react";', 'unused PWA Download icon');
  return result;
}

export function stripPermittedNativeShellAdapters(path, current, baseline) {
  if (path === 'src/components/Dashboard.tsx') {
    if (typeof baseline !== 'string') throw new Error('Dashboard UI baseline required.');
    assert.equal(current, expectedDashboardAfterAuthorizedPwaRemoval(baseline),
      'Dashboard.tsx contains unapproved changes beyond removing Install PWA');
    return baseline;
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
      assert.equal(stripPermittedNativeShellAdapters(path, current, oldSource), oldSource);
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
    /baseline required/);
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
