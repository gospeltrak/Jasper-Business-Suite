# Orvix Scanner & Printer — Android QA specification

Status: **feature branch only**. Not deployed or merged into production/main.

## Final approved defaults

- Settings menu: **Scanner & Printer**.
- Default printing: **Manual**. A tenant can switch Automatic Printing on/off in Settings.
- Paper widths: **58mm** and **80mm only**. 50mm is removed.
- Copies: 1–3 (default 1).
- Scanner: Auto (camera + paired keyboard-style USB/Bluetooth HID), Camera, or USB/Bluetooth HID.
- Feedback sound switch for POS scanning. Camera permission recovery remains available.
- Printer and scanner preferences save **per tenant and per physical device/browser** in localStorage. They are not written to tenant workspace JSON, normalized tables or shared account settings.

## Android connection flow

1. Switch Bluetooth on and pair a compatible ESC/POS Bluetooth Classic SPP printer in **Android Bluetooth Settings**.
2. Open Orvix → Settings → Scanner & Printer.
3. Choose **Find Paired Printers** and grant the Android **Nearby Devices** permission if asked.
4. Select the paired printer and tap **Test Print**. Choose 58mm or 80mm depending on the physical roll.
5. Choose Manual or Automatic; settings save without tenant workspace writes.

A previously denied Nearby Devices permission must be granted from Android App Settings. The native plugin does not discover unpaired devices, support BLE-only printers, or guarantee compatibility with all brands. Wired USB printing is outside this native printer driver.

## Saving sales and printing

- Sale persistence (onAddSale) must succeed before optional auto printing.
- **Automatic**: after a confirmed saved sale, a best-effort ESC/POS text job goes to the selected printer. The browser does not open a print dialog automatically.
- **Manual**: Print Receipt sends a native job if the Android bridge is available; on web it opens the regular browser print dialog.
- Sales List reprint uses the chosen paper width and native printer when available.
- Printer failure must **never roll back a sale, deduct inventory again, or save a duplicate sale**.
- Sale job IDs guard automatic resends in the JS session; the native plugin guards repeated job IDs in the same process. User-initiated reprints get new IDs. Neither confirms physical paper output.
- Printer text uses 32-column (58mm) or 48-column (80mm) layout. This initial version is text-only ESC/POS. Graphic logos, cutting, drawers and BLE need printer-specific tests before adding controls.

## Native QA build integration (not a release)

The Android workflow already generates a Capacitor shell and installs camera recovery. The new build step runs **after** camera installation:

    node scripts/setup-native-android-printer.mjs

It installs OrvixPrinter.java, declares Bluetooth permissions in the generated manifest, and registers the plugin in MainActivity. It preserves existing camera recovery and does not commit generated Android files.

Run npm run native:verify, npm run lint and npm test on this feature branch, followed by hardware QA on real Android and compatible 58mm/80mm printers. Include denied/granted permissions, disconnections, reprints, rapid checkout, failed saves and paper alignment.

**Do not merge or deploy until CI and physical printer QA pass.**
