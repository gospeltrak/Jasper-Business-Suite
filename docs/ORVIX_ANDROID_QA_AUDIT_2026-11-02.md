# Orvix Android QA audit — 2 November 2026

**Status: NOT RELEASE-READY.** Code review is complete for the changes described below. Native build and real device acceptance tests remain unverified. This document does not authorize a production rollout.

## Verified against existing QA APK (1 November 2026)

APK: Orvix-Checkout-Delivery-Split-Fix-Android-QA.apk; applicationId `africa.orvix.app`; version 1.0, versionCode 1. The compiled binary manifest was decoded and showed:
- `android:debuggable=true` and `android:allowBackup=true` — QA only, unsafe for customer release.
- CAMERA and BLUETOOTH_CONNECT present.
- POST_NOTIFICATIONS absent.
- The APK contains Capacitor's FileProvider declaration and a file_paths XML resource with a cache path, required for sharing cached PDF attachments.

## Source QA fixes on the Android feature branch

1. **Post-login splash:** tenant-scoped async logo retrieval, safe fallback to Orvix, response invalidation on logout and tenant switching. Never hold successful login for logo fetching.
2. **Device credential:** uses Android KeyguardManager and system PIN/pattern/password challenge; never reads or stores the phone PIN. Automatically prompts after splash and relocks after a 30-second background interval. The workspace is hidden and inert until a successful native result.
3. **Actual PDF WhatsApp attachment:** POS receipt, sales invoice, quotation, and delivery note share PDF FileProvider URIs with temporary read permissions, preserving the original PDF filename. The user must select WhatsApp and the recipient in Android's share sheet. Opening that chooser is **not** proof of message delivery.
4. **Fallback:** if attaching fails, never open a text-only WhatsApp link claiming the PDF was attached. Generate/download the PDF and instruct the user to attach it manually.
5. **Android notifications:** install native channels and Android 13+ notification permission. **This is only foundation**; FCM remote delivery, token storage/revocation, per-role and per-tenant routing, duplicates and opt-in UX are not implemented.
6. Existing native camera and Bluetooth printer bridges remain in the QA build sequence; their hardware compatibility is not proven by this code review.

## CI/release blockers

- The separate website-only fixes in PR #48 have a Vercel READY preview at commit `76a33a3`; that verifies a web preview build, not the native APK.
- Vercel previews of the **old/diverged native QA branch** report ERROR for reasons including old tests and missing `scripts/stamp-service-worker.mjs`. Its Android GitHub Actions workflow first merges latest `main` before native compilation, but no successful run/artifact for these new changes has been verified here.
- Android compilation (`npx cap add android`, native plugin injection, `gradlew assembleDebug`), install/upgrade signature validation, runtime tests, real WhatsApp document attachment, camera permission recovery, Bluetooth printer printing, PIN authentication, background resume, app lifecycle and on-device notifications **must all pass** before declaring QA complete.
- For a customer release, use a non-debug signed build with `allowBackup=false`, safe Android 12+ data extraction rules, a bumped versionCode, correct update-signing key continuity, permission prompt UX and FCM configured. Do not ship a debug key.
- The GitHub branch intentionally contains no database schema migration or tenant-data mutation, and has not been merged into production.

## Manual acceptance matrix

| Test | Acceptance criterion | Current result |
|---|---|---|
| Login -> logo -> phone PIN -> dashboard | Correct tenant logo, no other tenant branding, correct Android credential challenge | **Not device-tested** |
| Reopen after 30 sec background | Native PIN returns, cart stays intact | **Not device-tested** |
| POS receipt WhatsApp | PDF preview is real attachment; choose WhatsApp recipient | **Not device-tested** |
| Invoice & quotation WhatsApp | A4 PDF attached, not text-only | **Not device-tested** |
| Delivery note WhatsApp | Correct PDF attachment from selected delivery | **Not device-tested** |
| Camera permission denied / re-granted | Settings recovery, scanning works | **Not device-tested** |
| Printer 58mm and 80mm | Confirm hardware prints and status accurate | **Not device-tested** |
| Notification OS categories | Permission available; channel settings accessible | **Not device-tested** |
| FCM with app closed | Authorized tenant/user receives one push | **Not implemented** |
| Production signing/privacy | No debug, no sensitive backup, version increment | **Not implemented** |

**Rule:** Do not merge or deploy to production until release-blocking tests and dependencies above pass.
