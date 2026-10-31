import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const native = read('scripts/native-android-printer/OrvixPrinter.java');
const setup = read('scripts/setup-native-android-printer.mjs');
const bridge = read('src/native/printerBridge.ts');
const shared = read('src/shared/utils/posDevices.ts');
const settings = read('src/modules/settings/DashboardScannerPrinterSettings.tsx');
const workflow = read('.github/workflows/native-android-qa.yml');

assert.match(native, /BluetoothSocket/);
assert.match(native, /createRfcommSocketToServiceRecord\(SPP_UUID\)/);
assert.match(native, /getBondedDevices\(\)/);
assert.match(native, /BLUETOOTH_CONNECT/);
assert.match(native, /Executors\.newSingleThreadExecutor\(\)/);
assert.match(native, /@PluginMethod[\s\S]*?void printText/);
assert.match(native, /acceptedJobs\.contains\(jobId\)/);
assert.match(native, /Math\.max\(1, Math\.min\(3/);
assert.match(native, /createInsecureRfcommSocketToServiceRecord\(SPP_UUID\)/);
assert.match(native, /out\.write\(bytes, offset, length\)/);
assert.match(native, /Math\.min\(128, bytes\.length - offset\)/);
assert.match(native, /result\.put\("printed", false\)/);
assert.match(native, /result\.put\("bytesWritten", written\)/);
const pos = read('src/modules/pos/DashboardPOS.tsx');
const sales = read('src/modules/sales/DashboardSalesList.tsx');
assert.doesNotMatch(pos, /Receipt sent to printer\./);
assert.doesNotMatch(sales, /Receipt sent to printer\./);
assert.match(pos, /check that paper was printed/);
assert.match(sales, /check printer paper/);

assert.match(setup, /android\.permission\.BLUETOOTH_CONNECT/);
assert.match(setup, /registerPlugin\(OrvixPrinter\.class\)/);
assert.match(workflow, /node scripts\/setup-native-android-camera\.mjs[\s\S]*node scripts\/setup-native-android-printer\.mjs/);
assert.match(bridge, /registerPlugin<NativePrinterPlugin>\('OrvixPrinter'\)/);
assert.match(shared, /automaticPrinting: false/);
assert.match(shared, /paperWidthMm: 58/);
assert.match(shared, /paperWidthMm: input\.paperWidthMm === 80 \? 80 : 58/);
assert.match(settings, /'58mm'/);
assert.match(settings, /'80mm'/);
assert.doesNotMatch(settings, /'50mm'/);
assert.match(settings, /const verified = await native\.getStatus\(\)/);
assert.match(settings, /await native\.connectPrinter\(prefs\.printer\.id\)/);
assert.match(settings, /disabled=\{busy \|\| !prefs\.printer\} onClick=\{testPrinter\}/);
assert.match(settings, /WebVFD protocol/);
assert.match(settings, /WebVFD printers may use a vendor-specific encrypted Bluetooth protocol/);
assert.match(shared, /prefs\.autoReconnect \|\| kind === 'manual'/);
assert.match(shared, /Bluetooth connection dropped immediately/);


console.log('Orvix Scanner & Printer static native contract passed; hardware QA is still required.');
