import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getProductSalesCollected, getProductSalesDue } from '../src/modules/sales/utils/salePaymentTotals';

const read = (path: string) => readFileSync(path, 'utf8');
const sales = read('src/modules/sales/DashboardSalesList.tsx');
const forecast = read('src/modules/forecasting/DashboardForecasting.tsx');
const suppliers = read('src/modules/suppliers/DashboardSuppliers.tsx');
const reports = read('src/modules/reports/DashboardReports.tsx');
const pos = read('src/modules/pos/DashboardPOS.tsx');

test('receipt, sales history, debt list and ledger all use the same cumulative payment totals', () => {
  const credit = { total: 110000, productTotal: 100000, deliveryCost: 10000, amountPaid: 65000, paymentMethod: 'Credit',
    payments: [{ amount: 45000 }] };
  assert.equal(getProductSalesCollected(credit as any), 65000);
  assert.equal(getProductSalesDue(credit as any), 35000);
  assert.match(sales, /const debtSales = sales\.filter\(s => getProductSalesDue\(s\) > 0\)/);
  assert.match(sales, /const totalDebtPaidIn = debtSales\.reduce\(\(sum, s\) => sum \+ getProductSalesCollected\(s\), 0\)/);
  assert.match(sales, /const calculatedPaid = getProductSalesCollected\(sale\)/);
  assert.doesNotMatch(sales, /const extraPaid =/);
  assert.doesNotMatch(sales, /const installmentsVal =/);
});

test('document Send button asks for a WhatsApp number if customer phone is absent', () => {
  assert.match(sales, /\{documentSendOpen && \(/);
  assert.match(sales, /id="commercial-document-send-phone"/);
  assert.match(sales, /value=\{documentSendPhone\}/);
  assert.match(sales, /sharePdfDocument\(viewingDocument, phone\)/);
  assert.match(sales, /setDocumentSendOpen\(prev => !prev\)/);
});

test('forecast category and risk filters can actually be changed in UI', () => {
  assert.match(forecast, /aria-label="Forecast category"/);
  assert.match(forecast, /aria-label="Forecast risk"/);
  assert.match(forecast, /onChange=\{e => setSelectedCategory\(e\.target\.value\)\}/);
  assert.match(forecast, /onChange=\{e => setRiskFilter\(e\.target\.value\)\}/);
  assert.match(forecast, /const matchesCategory = selectedCategory === 'All'/);
  assert.match(forecast, /const matchesRisk = riskFilter === 'All'/);
});

test('supplier save failures show an alert and duplicate submissions are blocked', () => {
  assert.match(suppliers, /const handleSubmit = async \(e: FormEvent\)/);
  assert.match(suppliers, /if \(!name\.trim\(\) \|\| supplierSaving\) return/);
  assert.match(suppliers, /await onAddSupplier\(newSup\)/);
  assert.match(suppliers, /catch \(error\)/);
  assert.match(suppliers, /\{formError && <p role="alert"/);
  assert.match(suppliers, /disabled=\{supplierSaving\}/);
  assert.match(suppliers, /replace\(\/\\s\+\/g, ''\)/);
});

test('product report keeps the existing searchable dropdown, without an unused search state', () => {
  assert.match(reports, /searchPlaceholder="Search by name, SKU or barcode"/);
  assert.match(reports, /\.\.\.products\.map\(p =>/);
  assert.doesNotMatch(reports, /setProductSearchQuery/);
});

test('POS no longer subscribes to an unused breakpoint resize listener', () => {
  assert.doesNotMatch(pos, /isDesktopCheckoutLayout/);
  assert.doesNotMatch(pos, /setIsDesktopCheckoutLayout/);
});
