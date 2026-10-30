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
// Only files matching the *current production main* may change here.
// Newly approved barcode UI/product-save functionality is reused unchanged
// on Android; other screens remain frozen.
const APPROVED_PRODUCTION_PARITY_FILES = new Set([
  'src/modules/products/DashboardProducts.tsx',
  'src/modules/products/utils/manualStockAdjustment.ts',
  'src/modules/products/utils/barcodeUniqueness.ts',
  'src/modules/products/utils/barcodeUniqueness.test.ts',
  'src/shared/contexts/LanguageContext.tsx',
  'src/shared/utils/swahiliUiTranslations.ts',
  'src/shared/utils/tenantWorkspace.ts',
  'src/shared/utils/tenantWorkspace.productEdits.test.ts',
  'src/shared/utils/actionNoticePolicy.ts',
  'src/shared/utils/paymentAccounts.ts',
  'src/modules/cash-bank/utils/operationPayments.ts',
  'src/modules/cash-bank/DashboardFundsTransfer.tsx',
  'src/modules/cash-bank/utils/treasuryApi.ts',
  'src/shared/utils/barcodeScan.ts',
  'src/types.ts',
  'src/modules/sales/DashboardSalesList.tsx',
  'src/modules/expenses/DashboardExpenses.tsx',
  'src/modules/cash-bank/DashboardCashBank.tsx',
  'src/modules/cash-bank/utils/treasuryBranchAccounts.ts',
  'src/modules/sales/utils/salePaymentTotals.ts',
  'src/shared/utils/posReceiptI18n.ts',
]);

export function isPermittedNativeDiffPath(path) {
  if (APPROVED_PRODUCTION_PARITY_FILES.has(path)) return true;
  // New native services/tests are allowed; new JSX/styles are NOT implicit UI approvals.
  if (path.startsWith('src/native/')) return path.endsWith('.ts');
  if (/^src\/server\/nativeOfflineLedger(?:\.test)?\.ts$/.test(path)) return true;
  if (path === 'src/shared/utils/nativeApiTransport.ts') return true;
  if (path === 'src/shared/components/TurnstileWidget.tsx') return true;
  if (path === 'src/shared/components/DashboardBarcodeScanner.tsx') return true;
  if (path === 'src/main.tsx' || path === 'src/App.tsx' || path === 'src/components/Dashboard.tsx' || path === 'src/index.css' || path === 'src/shared/utils/imageCompression.ts' || path === 'src/modules/platform-admin/components/SaaSStatusAndRequests.tsx') return true;
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


function literalReplacementOnce(source, oldText, newText, label) {
  if (source.split(oldText).length !== 2) {
    throw new Error('Native-only UI freeze anchor changed: ' + label);
  }
  return source.replace(oldText, newText);
}

export function expectedAppAfterNativeOnlyAdapters(baseline) {
  const changes = [
    [
      "import SystemErrorPage, { type SystemErrorStatus } from './shared/components/SystemErrorPage';",
      "import SystemErrorPage, { type SystemErrorStatus } from './shared/components/SystemErrorPage';\nimport { nativeEntryPath, isOrvixNativeApp } from './native/nativeAppExperience';",
    ],
    [
      "    window.history.pushState({}, '', path);\n    setCurrentPath(normalizePath(path));",
      "    const targetPath = nativeEntryPath(path);\n    window.history.pushState({}, '', targetPath);\n    setCurrentPath(normalizePath(targetPath));",
    ],
    [
      "    const nextPath = normalizePath(path);\n    const isPublicLanding = currentPath === '/' || currentPath === '/home';",
      "    const nextPath = normalizePath(nativeEntryPath(path));\n    const isPublicLanding = currentPath === '/' || currentPath === '/home';",
    ],
    [
      "    if (!user && isPublicLanding && isAuthDestination) {",
      "    if (!isOrvixNativeApp() && !user && isPublicLanding && isAuthDestination) {",
    ],
    [
      "          logoSrc={splashRequest.mode === 'tenant' ? splashRequest.logoSrc : undefined}",
      "          logoSrc={splashRequest.mode === 'tenant' ? splashRequest.logoSrc : isOrvixNativeApp() ? '/icon-512.png' : undefined}",
    ],
  ];
  return changes.reduce((source, [oldText, newText], i) =>
    literalReplacementOnce(source, oldText, newText, 'App.tsx #' + i), baseline);
}

export function expectedDashboardAfterNonvisualTypeFix(source) {
  // Only the pre-existing TypeScript delivery-status narrowing correction
  // that was already present in PR #7; never permit another visual change.
  const changes = [
    [
      '    let treasuryJournalId = currentDelivery.treasuryJournalId;',
      "    // Stable boolean prevents TypeScript's async control-flow narrowing from\n    // excluding a reachable Delivered result without changing dispatch UI.\n    const markedDelivered = status === 'Delivered';\n    let treasuryJournalId = currentDelivery.treasuryJournalId;",
    ],
    [
      "const collectedAt = status === 'Delivered' ? new Date().toISOString() : undefined;",
      "const collectedAt = markedDelivered ? new Date().toISOString() : undefined;",
    ],
    [
      "deliveryPaymentStatus: status === 'Delivered'",
      "deliveryPaymentStatus: markedDelivered",
    ],
    [
      "deliveryPaymentAccountId: status === 'Delivered'",
      "deliveryPaymentAccountId: markedDelivered",
    ],
    [
      "status: status === 'Delivered' ? 'success' : 'failed',",
      "status: markedDelivered ? 'success' : 'failed',",
    ],
  ];
  return changes.reduce((current, [oldText, newText], i) =>
    literalReplacementOnce(current, oldText, newText, 'Dashboard.tsx #' + i), source);
}

export function expectedNativeTurnstileIntegration(baseline) {
  let current = literalReplacementOnce(
    baseline,
    "import { useEffect, useRef, useId } from 'react';",
    "import { useEffect, useRef, useId } from 'react';\nimport { Capacitor } from '@capacitor/core';",
    'Turnstile native-only import',
  );
  current = literalReplacementOnce(
    current,
    "const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';",
    "// Packaged native apps use explicit rendering to avoid racing Cloudflare's\n// automatic DOM scan; the website keeps its original script and UI behavior.\nconst TURNSTILE_SCRIPT_SRC = Capacitor.isNativePlatform()\n  ? 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'\n  : 'https://challenges.cloudflare.com/turnstile/v0/api.js';",
    'Turnstile native-only explicit mode',
  );
  return current;
}

export function stripPermittedNativeShellAdapters(path, current, baseline) {
  if (APPROVED_PRODUCTION_PARITY_FILES.has(path)) {
    assert.equal(current, baseline,
      'Authorized Android source changes must exactly match production main: ' + path);
    return baseline;
  }
  if (path === 'src/shared/components/DashboardBarcodeScanner.tsx') {
    // Explicitly authorized scanner recovery UI only; POS layout, cart and
    // every other screen stay frozen.
    assert.match(current, /checkNativeCameraPermission/);
    assert.match(current, /requestNativeCameraPermission/);
    assert.match(current, /openNativeCameraSettings/);
    assert.match(current, /Jaribu tena/);
    assert.match(current, /Try again/);
    assert.match(current, /settingsOpenedRef/);
    assert.match(current, /onScanSuccess\(trimmed, foundProduct\)/);
    return baseline;
  }
  if (path === 'src/shared/components/TurnstileWidget.tsx') {
    if (typeof baseline !== 'string') throw new Error('Turnstile UI baseline required.');
    assert.equal(current, expectedNativeTurnstileIntegration(baseline),
      'TurnstileWidget.tsx changed beyond native-only explicit rendering');
    return baseline;
  }
  if (path === 'src/shared/utils/imageCompression.ts' || path === 'src/modules/platform-admin/components/SaaSStatusAndRequests.tsx' || path === 'src/index.css') {
    assert.equal(current, baseline, 'Approved UI/utilities must be identical to production main.');
    return baseline;
  }
  if (path === 'src/components/Dashboard.tsx') {
    if (typeof baseline !== 'string') throw new Error('Dashboard UI baseline required.');
    assert.equal(current, expectedDashboardAfterNonvisualTypeFix(expectedDashboardAfterAuthorizedPwaRemoval(baseline)),
      'Dashboard.tsx contains unapproved changes beyond removing Install PWA');
    return baseline;
  }
  if (path === 'src/App.tsx') {
    assert.equal(current, expectedAppAfterNativeOnlyAdapters(baseline),
      'App.tsx changed beyond the native-only entry, splash and navigation adapters');
    return baseline;
  }
  if (path === 'src/main.tsx') {
    const bootstrap =
      "import { installNativeApiTransport } from './shared/utils/nativeApiTransport';\n" +
      "import { installNativeAppExperience } from './native/nativeAppExperience';\n" +
      "installNativeAppExperience();\n" +
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
    if (!APPROVED_PRODUCTION_PARITY_FILES.has(path) && path !== 'src/main.tsx' && path !== 'src/App.tsx' && path !== 'src/components/Dashboard.tsx' && path !== 'src/index.css' && path !== 'src/shared/utils/imageCompression.ts' && path !== 'src/modules/platform-admin/components/SaaSStatusAndRequests.tsx' && path !== 'src/shared/components/TurnstileWidget.tsx' && path !== 'src/shared/components/DashboardBarcodeScanner.tsx') continue;
    try {
      // Subscription checkout UI was explicitly approved on web and native.
      // Instead of comparing the native Dashboard/CSS to this branch's OLD
      // fork point, require exact current production main UI (plus the one
      // existing native-only TypeScript narrowing fix).
      const baselineRef = (APPROVED_PRODUCTION_PARITY_FILES.has(path) || ['src/components/Dashboard.tsx', 'src/index.css', 'src/shared/utils/imageCompression.ts', 'src/modules/platform-admin/components/SaaSStatusAndRequests.tsx'].includes(path)) ? base : baseline;
      const oldSource = git('show', `${baselineRef}:${path}`);
      const current = readFileSync(path, 'utf8');
      assert.equal(stripPermittedNativeShellAdapters(path, current, oldSource), oldSource,
        `Native UI diverged unexpectedly from approved ${baselineRef}: ${path}`);
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
    'src/modules/pos/DashboardPOS.tsx',
    'src/modules/purchases/DashboardPurchases.tsx',
    'src/components/GlobalBranchSwitcher.tsx',
    'src/shared/contexts/ThemeContext.tsx',
    'index.html', 'public/logo.svg',
    'src/native/NativePinScreen.tsx', 'src/native/native.css',
  ];
  for (const path of blocked) assert.equal(isPermittedNativeDiffPath(path), false, path);
  const permitted = [
    'src/native/offlineConflictEngine.ts', 'src/server/nativeOfflineLedger.ts',
    'src/server/nativeOfflineLedger.test.ts',
    'src/shared/utils/nativeApiTransport.ts',
    'src/main.tsx', 'src/App.tsx', 'src/components/Dashboard.tsx', 'src/index.css', 'src/shared/utils/imageCompression.ts', 'src/modules/platform-admin/components/SaaSStatusAndRequests.tsx', 'src/shared/components/TurnstileWidget.tsx', 'src/shared/components/DashboardBarcodeScanner.tsx',
    'docs/native-device-experience.md', 'capacitor.config.ts',
    ...APPROVED_PRODUCTION_PARITY_FILES,
  ];
  for (const path of permitted) assert.equal(isPermittedNativeDiffPath(path), true, path);
  assert.throws(() => stripPermittedNativeShellAdapters('src/main.tsx', 'redesigned UI'),
    /adapter changed/);
  assert.throws(() => stripPermittedNativeShellAdapters('src/components/Dashboard.tsx', 'redesigned UI'),
    /baseline required/);
  assert.throws(() => stripPermittedNativeShellAdapters('src/shared/components/TurnstileWidget.tsx', 'redesigned UI'),
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
