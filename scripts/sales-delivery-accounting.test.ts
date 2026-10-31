import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Sale } from '../src/types';
import {
  getProductSalesTotal, getProductSalesCollected, getProductSalesDue,
} from '../src/modules/sales/utils/salePaymentTotals';

const sale = (overrides: Partial<Sale>): Sale => ({
  id: 'sale-example', items: [], total: 26000, productTotal: 20000,
  deliveryCost: 6000, paymentMethod: 'Cash', amountPaid: 26000,
  tax: 0, reference: 'REF1', tenantId: 'tenant-example',
  timestamp: '2026-10-31T10:00:00.000Z', cashierName: 'Cashier',
  syncStatus: 'synced',
  ...overrides,
});

test('sales show only product TSh 20,000 when POS checkout combines product 20,000 and delivery 6,000', () => {
  const recorded = sale({});
  assert.equal(getProductSalesTotal(recorded), 20000);
  assert.equal(getProductSalesCollected(recorded), 20000);
  assert.equal(getProductSalesDue(recorded), 0);
  assert.equal(recorded.total, 26000); // preserve the customer's original receipt
  assert.equal(recorded.deliveryCost, 6000);
});

test('legacy sales without productTotal derive product-only amounts without modifying historical data', () => {
  const historical = sale({ productTotal: undefined });
  assert.equal(getProductSalesTotal(historical), 20000);
  assert.equal(getProductSalesCollected(historical), 20000);
});

test('a product on credit owes only its product value, never the delivery charge', () => {
  const outstanding = sale({ paymentMethod: 'Credit', amountPaid: 0, paymentStatus: 'unpaid' });
  assert.equal(getProductSalesTotal(outstanding), 20000);
  assert.equal(getProductSalesDue(outstanding), 20000);
  const partlyPaid = sale({ paymentMethod: 'Credit', amountPaid: 5000, paymentStatus: 'partial' });
  assert.equal(getProductSalesCollected(partlyPaid), 5000);
  assert.equal(getProductSalesDue(partlyPaid), 15000);
});

test('sales list and money bank receivables use product-only accounting source', async () => {
  const salesList = await readFile('src/modules/sales/DashboardSalesList.tsx', 'utf8');
  const reports = await readFile('src/modules/reports/DashboardReports.tsx', 'utf8');
  assert.match(salesList, /const totalVolume = filteredSales.reduce\(\(acc, s\) => acc \+ getProductSalesTotal\(s\)/);
  assert.match(salesList, /const totalVal = getProductSalesTotal\(sale\)/);
  assert.match(salesList, /const totalDebtIssued = debtSales.reduce\(\(sum, s\) => sum \+ getProductSalesTotal\(s\)/);
  assert.match(reports, /const due = getProductSalesDue\(sale\)/);
});

test('Money & Bank report is limited to pages with totals computed on server', async () => {
  const query = await readFile('supabase/migrations/20261031133000_treasury_reporting_page.sql', 'utf8');
  const source = await readFile('src/modules/reports/utils/useAuthoritativeReportData.ts', 'utf8');
  assert.match(query, /limit v_limit\+1/);
  assert.match(query, /j.external_cash_flow is true/);
  assert.match(query, /'summary',v_summary/);
  assert.match(source, /get_current_tenant_treasury_report_page/);
  assert.match(source, /REPORT_PAGE_SIZE = 50/);
});
