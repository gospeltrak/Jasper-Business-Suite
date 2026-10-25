# Orvix Android/iOS native experience specification

**Development branch:** `feature/orvix-native-offline-v1`  
**Not live.** Does not alter web/PWA's online-only business-write policy.

This document tracks requested native app features. A feature marked *planned*
must not be advertised as implemented or enabled for customers.

## App lock, identity & privacy

- On every cold launch, show an Orvix-branded app unlock view before revealing
  financial data. After a configured background timeout (initially 30 seconds),
  require unlock on resume. Closing the notification shade should not corrupt
  a receipt or pending queue.
- Preferred unlock: Android fingerprint/face or iOS Face ID/Touch ID using
  OS APIs. Permit **device PIN/passcode** fallback; an optional **Orvix six-digit
  PIN** can be added only after a native hardware-backed verifier exists.
- Store unlock material exclusively in Android Keystore / iOS Keychain. No
  plaintext PIN, unsalted browser hash, credential cache, or long-lived
  authentication token in JavaScript localStorage.
- App unlock is **not server login**. It only decrypts/open the existing scoped
  offline vault. A revoked staff account cannot regain server authorization
  by providing the PIN.
- Auto-lock on logout, user/branch/tenant switch, process relaunch, lockout or
  stolen-device policy. Native OS failure attempts have bounded lockout.
- The offline queue persists when app is locked; never clear finance data on
  PIN failure, staff switch, or expired session.
- Privacy screen in recent-apps switcher while locked. On iOS, test app snapshot
  obscuring; Android use FLAG_SECURE where owner enables it.

## Scanner and receipt workflow

**Camera (just-in-time permission)**
- Scan EAN-8/EAN-13/UPC/Code128/QR to find or select a product instantly in POS.
- Scan during Purchases and stock checks; warn on unknown/ambiguous barcodes
  rather than creating duplicate catalogue items.
- Optional invoice QR deep link; validate data before opening in tenant context.
- Attach a receipt photo to a new Expense; retain attachment locally until the
  related expense operation is confirmed in cloud. Compress in a separate
  worker, but never discard the original before durable save.

**Hardware**
- Support Bluetooth **BLE ESC/POS**, Bluetooth Classic SPP (Android-only where
  available), and Wi-Fi/LAN thermal printers as distinct transports. Do not
  assume all Bluetooth printers share the BLE protocol; iOS compatibility must
  be tested per hardware model.
- Pair printer only after user action. Save preferred printer per *device and
  business*; no business or customer data in discovery broadcasts.
- POS receipt width 58mm/80mm, QR, logo if supported, manual reprint by immutable
  sale ID. Sending a print job must NEVER create a duplicate sale.
- If printer is unavailable, the already-durable sale remains recorded; show
  `Print pending`, allow safe retry and share PDF.
- Optionally support hardware USB/Bluetooth barcode scanners that act as HID
  keyboard devices, without requiring the camera.

## Native dashboard enhancements

- Distinct Online / Offline / Syncing / Needs Review badges.
- Pending queue by sale, purchase, expense, with actor, branch, operation ID,
  timestamp, attempt count, error reason, and safe retry.
- While offline: product snapshot age, remaining device-reserved stock, last
  successful sync time, branch name and user name always visible.
- Quick staff switch via independent unlock, with hard tenant/actor isolation.
- Offline POS optimized for small screens, split payments, 1/4, 1/2, 3/4
  quantities where supported; all values stored as fixed-point base units.
- Purchase barcode scan and receipt print; expense photo and repeat expense
  shortcut. Expense categorization remains bound to existing tenant settings.
- Native notifications: sync failures, stock warnings, expired grant,
  subscription/session expiry when server confirms; opt-in for push alerts.
- Localized Kiswahili / English, dark/light modes, haptic scan confirmation,
  accessible touch targets and keyboard-aware forms.
- Safe offline backups/migration: encrypted native database and explicit
  restore workflow. **Uninstalling may destroy local pending data**; warn users
  and avoid promising recovery without a server copy.

## Implementation phases and non-negotiable release gates

1. **Lock policy and permissions (in progress):**
   `src/native/nativeAppLockPolicy.ts` models cold launch, inactivity, lockout,
   identity switching and native feature authorization. This is ONLY a state
   machine; it is not an OS-backed security boundary until native bridge added.
2. **Secure OS credentials:** Choose a maintained Capacitor-8-compatible
   biometric/secure-storage bridge; test Android Keystore and iOS Keychain on
   device. A six-digit app PIN must be rate-limited and bound to hardware-backed
   verification; no PIN retrieval API from JavaScript.
3. **Camera scanner:** integrate native barcode-scanner permission and plugin
   with POS and Purchases. Verify Android/iOS SDK minimum and platform camera
   permission strings. Existing browser scanning must remain unchanged.
4. **Printer integration:** independent drivers for BLE, Android Bluetooth
   Classic SPP, and LAN, with ESC/POS capability negotiation and user-initiated
   pairing. Start from known reference thermal printer hardware.
5. **Offline integrity:** encrypted SQLite/SQLCipher journal, server-issued
   stock grants, tombstones, idempotent atomic ledgers, and negative-case QA per
   `docs/native-offline-integrity.md` before accepting offline finance.
6. **QA:** Android hardware + iOS simulator/device, lock/background/restore,
   denied camera/Bluetooth permissions, scan failure, printer disconnect during
   receipt, duplicate print, multiple tenants/staff, offline restart, lost
   server response, RLS and storage exhaustion.

No live camera, Bluetooth, Wi-Fi, biometric or PIN permissions should be
requested until the corresponding user flow is implemented and tested.
