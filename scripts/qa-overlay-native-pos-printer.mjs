// Android QA: start with the EXACT production POS UI/checkout implementation,
// then overlay only the Android printer/scanner integration.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'src/modules/pos/DashboardPOS.tsx';
const originalNative = execFileSync('git', ['show', 'HEAD:' + path], { encoding: 'utf8' });
let pos = readFileSync(path, 'utf8');
assert(pos.includes('const productCards = useMemo'), 'Expected deployed fast-cart production POS');
assert(pos.includes('paymentSubmitInFlightRef'), 'Expected latest safe payment submission');
assert(pos.includes('className="pos-checkout-confirm"'), 'Expected latest checkout confirmation UI');
assert(originalNative.includes('sendNativeReceipt'), 'Expected original Android printer integrations');
assert(pos.includes("import DashboardBarcodeScanner from '../../shared/components/LazyDashboardBarcodeScanner'"), 'Keep camera scanner lazy loaded');

function replaceOne(from, to, label) {
  const hits = pos.split(from).length - 1;
  assert.equal(hits, 1, 'Exactly one anchor required for '+label+'; found '+hits);
  pos = pos.replace(from, to);
}
function block(src, from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + from.length);
  assert(a !== -1 && b !== -1 && b > a, 'Cannot find source block: '+from);
  return src.slice(a, b);
}

replaceOne(
  "import { localDateToIso, timestampToLocalDate } from '../../shared/utils/localDate';",
  "import { localDateToIso, timestampToLocalDate } from '../../shared/utils/localDate';\n"+
  "import { getOrvixNativePrinterBridge, readPosDevicePreferences, sendNativeReceipt, subscribePosDevicePreferences, type PrinterResult } from '../../shared/utils/posDevices';",
  'native printer imports',
);

const devicePrefs=block(originalNative,
  '  const [posDevicePreferences, setPosDevicePreferences] = useState(() => readPosDevicePreferences(activeTenant.id));',
  "  const [searchTerm, setSearchTerm] = useState('');");
replaceOne("  const [searchTerm, setSearchTerm] = useState('');",
  devicePrefs+"  const [searchTerm, setSearchTerm] = useState('');",
  'device preferences live settings');

const printerNotice=block(originalNative,
  '  const [printNotice, setPrintNotice] = useState<string | null>(null);',
  '  // Checkout modal mobile/tablet-only layout gate');
replaceOne("  // Checkout modal mobile/tablet-only layout gate",
  printerNotice+"  // Checkout modal mobile/tablet-only layout gate",
  'printer result messages');

const nativePrint=block(originalNative,
  "  const printPosReceiptPdfHandler = async () => {",
  "  // Dual-channel context (Retail vs. Wholesale)");
const webPrint=block(pos,
  "  const printPosReceiptPdfHandler = () => {",
  "  // Dual-channel context (Retail vs. Wholesale)");
replaceOne(webPrint, nativePrint, 'manual print with 58/80mm and Bluetooth');

replaceOne(
  '              onScanSuccess={handleScanSuccess}\n            />',
  '              onScanSuccess={handleScanSuccess}\n              mode={posDevicePreferences.scannerMode}\n              scanFeedback={posDevicePreferences.scannerFeedback}\n            />',
  'scanner mode and feedback settings',
);

const savedBlock=block(originalNative,
  '    onUpdateStocks(updatedProducts);',
  '    setReceiptResult(newSale);');
assert(savedBlock.includes('automaticPrinting'), 'Native auto-print behavior missing');
replaceOne(
  '    onUpdateStocks(updatedProducts);\n    setReceiptResult(newSale);',
  savedBlock+'    setReceiptResult(newSale);',
  'automatic print after successful sale',
);

const finishMarker='                      Finish Sale\n                    </button>\n                  </div>';
replaceOne(finishMarker,finishMarker+
  '\n                  {printNotice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{printNotice}</p>}',
  'print feedback after receipt actions');

assert(pos.includes('key="pos-processing"') && pos.includes('translate="no"'),
  'Keep production React-controlled confirmation UI');
assert(pos.includes('getOrvixNativePrinterBridge') && pos.includes('sendNativeReceipt') &&
       pos.includes('automaticPrinting') && pos.includes('posDevicePreferences.scannerMode'),
  'Keep all Android hardware integrations');
writeFileSync(path, pos);
console.log('Android QA uses deployed fast POS + 58/80mm Bluetooth printing + camera scanner preferences');
