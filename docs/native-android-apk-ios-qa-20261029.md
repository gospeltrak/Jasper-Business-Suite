# Orvix Android APK and iOS QA environment (2026-10-29)

**Development PR #7 only. NOT a customer-ready release, not merged into main.**

## Recovered exact starting point

- One React/Vite + Supabase backend codebase for Android, iOS, web.
- Capacitor 8.5.3 native app shell uses ID `africa.orvix.app`, bundles
  `dist/native-web` locally and forwards only HTTPS `/api/*` requests.
  Never introduce a mandatory `server.url`, break offline cold start, or
  modify the mobile/tablet/PC layouts, fonts, emerald branding or navigation.
- Android Debug QA APK has **already passed** GitHub Actions run
  `40212531824` on 2026-10-25. The `orvix-android-debug-qa-only`
  artifact is retained for 7 days, may expire after 2026-11-01 and is not
  a signed Play Store release APK.
- Browser/PWA remains **online-only**. Native offline is strictly
  **Sales, Purchases, Expenses**; not Warehouse, HR, Reports, or other screens.
- PIN/biometric, camera barcode, Bluetooth/Wi-Fi printing, encrypted
  SQLite vault and production offline sync are **not done** merely because
  Android APK compiles. Never enable offline financial writes until server
  grant, atomic Money & Bank and normalized PostgreSQL transaction gates pass.

## Android: get a new internal APK

GitHub: Actions > **Native Android QA (no production release)** >
Run workflow on branch `feature/orvix-native-offline-v1` (or open the
PR and let the existing pull_request-triggered workflow build it).
Only download `orvix-android-debug-qa-only` from the successful run.
Extract the ZIP and install `app-debug.apk` on an Android **test device**.
Do not use a device with unprotected, unsynced business data for testing;
uninstalling an app can erase its local data.

The workflow verifies frozen UI, native isolation, TypeScript, local web
build, `cap add android`, `cap sync android` and
`./gradlew :app:assembleDebug`. It deliberately does not upload a
Play Store AAB, store signing keys or enable live offline accounting.

## iOS: repeatable preparation, without a paid release

Requirements: Apple Silicon/Intel **Mac**, Node 22+, Xcode 26+,
Xcode Command Line Tools. Capacitor 8 supports iOS 15+.
The project uses Swift Package Manager instead of requiring CocoaPods.

On the branch:

```bash
npm ci
npm run native:ios:prepare
```

This calls `scripts/setup-native-ios.mjs` on macOS to install the exact
matching `@capacitor/ios@8.5.3` in the **local development environment
without changing package-lock.json**, build bundled assets, generate a
Capacitor iOS SPM project only if absent, sync and verify iOS
`Info.plist` purpose descriptions. Local iOS files are generated, not
an App Store-signed IPA.

Then open:

```bash
npx cap open ios
```

Select an iPhone or iPad simulator and click Run. For simulator-only
builds, no Apple Developer signing certificate is required. Test
offline cold launch, orientation, keyboard-safe scrolling, Sales,
Purchases and Expenses **online** flows, HTTPS login, staff roles,
receipt PDFs and blocked native offline writes.

`scripts/prepare-native-ios.mjs` declares only honest, just-in-time
permission descriptions for camera, Face ID, Bluetooth printers and
local-network printers. It **does not enable these features or request
permissions** before the actual plugin implementation. No ATS
exceptions or insecure HTTP allowances are added.

## Optional CI iOS simulator build

GitHub Actions > **Native iOS Simulator QA (manual, no signing or release)**
> Run workflow (branch `feature/orvix-native-offline-v1`).

**Runs manually only** on a macOS runner. GitHub macOS runner minutes
may carry charges, so do not trigger without checking billing.
The workflow verifies the unchanged UI and native contracts, builds
the Xcode iOS Simulator target with `CODE_SIGNING_ALLOWED=NO` and
uploads `orvix-ios-simulator-qa-only` for 7 days. This is a simulator
`.app`, **not an installable iPhone IPA or TestFlight build**.
No Apple credentials or distribution secrets are requested.

## Release gates

1. Verify encrypted native SQLite/SQLCipher vault using real devices;
   plaintext IndexedDB is not an acceptable offline financial DB.
2. Complete immutable operation IDs, device stock grants, trust clock,
   stock/FEFO/expiry/reservation accounting and same-transaction
   server idempotency/finance writes on the future normalized tables.
3. Test 2 simultaneous offline users, concurrent online sales,
   sale returns, deleted products/tombstones, payments and staff
   permission revocations. No double posting or silent stock loss.
4. Implement OS PIN/biometric unlock backed by Keystore/Keychain,
   camera barcode, Bluetooth/Wi-Fi printing, real push notifications.
5. Build/verify an Android **release** with approved package signing
   and iOS TestFlight/archive with Apple Developer credentials, only
   after owner approval and complete end-to-end QA. Keep original UI.

No Supabase schema mutation, production data deletion, plan upgrade or
paid Apple Developer signup happens as part of these preparation changes.
