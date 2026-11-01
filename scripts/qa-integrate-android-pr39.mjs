import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// QA-only source adapter; not part of the production release or Pro.
function replaceExactlyOnce(value, before, after, label) {
  const chunks = value.split(before);
  assert.equal(chunks.length, 2, 'Expected one integration anchor for ' + label);
  return chunks.join(after);
}

const lazyPath = 'src/shared/components/LazyDashboardBarcodeScanner.tsx';
let lazy = readFileSync(lazyPath, 'utf8');
lazy = replaceExactlyOnce(
  lazy,
  '  inline?: boolean;\n}',
  "  inline?: boolean;\n  mode?: import('../utils/posDevices').ScannerMode;\n  scanFeedback?: boolean;\n}",
  'lazy scanner native device settings',
);
writeFileSync(lazyPath, lazy);

const dashPath = 'src/components/Dashboard.tsx';
let dashboard = readFileSync(dashPath, 'utf8');
const start = dashboard.indexOf('  const handleUpdateDeliveryStatus = async');
const end = dashboard.indexOf('  const handleUpdateDeliveryDetails = async', start);
assert(start >= 0 && end > start, 'Delivery status function anchors are required');
let block = dashboard.slice(start, end);
if (!block.includes("const markedDelivered = status === 'Delivered';")) {
  block = replaceExactlyOnce(
    block,
    '    let treasuryJournalId = currentDelivery.treasuryJournalId;',
    "    const markedDelivered = status === 'Delivered';\n    let treasuryJournalId = currentDelivery.treasuryJournalId;",
    'TypeScript-safe delivery flag',
  );
}
const anchor = '    setDeliveriesMap(prev => {';
const split = block.indexOf(anchor);
assert(split >= 0, 'Delivery mutation block is required');
const head = block.slice(0, split);
let tail = block.slice(split);
const uses = tail.match(/status === 'Delivered'/g) || [];
console.log('Remaining delivered-state comparisons in updater/log:', uses.length);
assert(uses.length <= 6, 'Unexpected number of delivered-state expressions in updater and log');
assert(uses.length > 0 || tail.includes('markedDelivered'), 'Missing delivery status checks');
tail = tail.replaceAll("status === 'Delivered'", 'markedDelivered');
dashboard = dashboard.slice(0, start) + head + tail + dashboard.slice(end);
writeFileSync(dashPath, dashboard);
console.log('PR39 Android integration: native scanner props and safe delivery type narrowing applied');

