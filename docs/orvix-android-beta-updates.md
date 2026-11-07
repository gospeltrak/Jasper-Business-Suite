# Orvix Android beta updates — owner release gate

This branch implements the **beta-only native update UI**. Nothing silently
installs. Web features continue loading from the Production website as before.

## Mandatory before distribution to tenants

1. Create a separate **Orvix Android beta release keystore**, store an
   encrypted offline backup and retain its alias/password securely. Never
   commit the .jks, key, or password to GitHub, logs, APK or documentation.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add
   these private secrets:
   - `ORVIX_BETA_KEYSTORE_B64`: Base64 of the complete **binary keystore**
   - `ORVIX_BETA_STORE_PASSWORD`
   - `ORVIX_BETA_KEY_ALIAS`
   - `ORVIX_BETA_KEY_PASSWORD`
3. Build this QA branch. The workflow creates an
   `orvix-android-beta-permanent-key-signed` APK **only when all four
   private secrets exist**. Without them, its debug APK is **not suitable for
   distribution** because cache eviction can replace the signing key.
4. Verify SHA-256, package `africa.orvix.app`, expected signing certificate
   and a higher `versionCode` on the resulting APK. Test upgrade on a real
   Android device with an installed earlier signed beta, confirm local
   preferences/session retained, checkout/invoice state safely preserved,
   camera and PDF and Bluetooth printing behavior, and rollback plan.
5. Publish the signed APK to a trusted **HTTPS** location ending in `.apk`
   at `orvix.africa` or `updates.orvix.africa`. The updater intentionally
   rejects unknown hosts, non-HTTPS and missing SHA-256.
6. Only after testing, promote
   `public/android-beta-release.json` on the *production website*:
   ```json
   {
     "schemaVersion": 1,
     "packageName": "africa.orvix.app",
     "versionCode": 200,
     "versionName": "Beta 2",
     "apkUrl": "https://updates.orvix.africa/Orvix-beta-2.apk",
     "sha256": "<64-character sha256 of exact signed APK>"
   }
   ```
   Replace the illustrative values with the actual release. The website
   currently serves a **disabled** manifest (`versionCode: 0`) so nobody
   receives an unverified update.

## User experience

At a fresh app launch the beta checker fetches this manifest with a short
timeout; if the new versionCode is higher, it offers **Update Available**.
The user can select **Baadaye** or **Download & Install**. DownloadManager
stores an APK in app-owned external files, checks its SHA-256 and opens the
Android package installer through a restricted FileProvider. Android handles
user consent and verifies APK signing and application package identity.
Android 8+ may require enabling `Install unknown apps` for Orvix first.
It is not a silent/background APK installer.

Browser/PWA release detection remains separate from Android APK updates.
A website deployment never replaces a bundled Android binary.

## Existing APKs and migration

Previous QA APKs were signed using various debug or local test keys.
**They cannot be updated over-the-top by a differently signed APK.** Users
must export/sync all necessary data and perform a carefully managed *one-time*
migration to the new beta signed with the permanent key. After that, keep
the exact same key + package ID for every beta and increment versionCode.

Never instruct a tenant to uninstall an app containing un-synced transactions.
A reinstall deletes app-private data and usually the stored login state.
Never claim a release is production ready solely because Gradle succeeded.

## Scope and constraints

- QA-only, live-web shell requires internet.
- Not a Play Store in-app update mechanism; later Play builds will use Play
  App Signing / Google Play In-App Updates rather than REQUEST_INSTALL_PACKAGES.
- No database/schema changes, no automated deployment of new APK files, and no
  automatic manifest activation in this branch.
