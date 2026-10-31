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

test('delivery accounting does not count pending dispatch fees as cash already collected', async () => {
  const deliveries = await readFile('src/modules/deliveries/DashboardDeliveries.tsx', 'utf8');
  assert.match(deliveries, /del\.deliveryPaymentStatus === 'collected' && !!del\.treasuryJournalId/);
  assert.match(deliveries, /const deliveryIncome = deliveryIncomeTotal/);
  assert.match(deliveries, /if \(!isDeliveryCollected\(d\)\) return acc/);
  const ownerNotice = await readFile('supabase/migrations/20261031150000_pos_sale_owner_summary_notification.sql', 'utf8');
  assert.match(ownerNotice, /Sales \(bidhaa\): TSh/);
  assert.match(ownerNotice, /Delivery \(ada\): TSh/);
});

test('sales cards render bounded pages, not unbounded historical arrays', async () => {
  const salesList = await readFile('src/modules/sales/DashboardSalesList.tsx', 'utf8');
  assert.match(salesList, /visibleSales = filteredSales\.slice\(0, visibleSalesCount\)/);
  assert.match(salesList, /visibleSales\.map\(/);
  assert.match(salesList, /filteredDebtSales\.slice\(0, visibleDebtCount\)\.map\(/);
});

test('owner sale notification persists one split summary in the existing server inbox', async () => {
  const migration = await readFile('supabase/migrations/20261031150000_pos_sale_owner_summary_notification.sql', 'utf8');
  const dashboard = await readFile('src/components/Dashboard.tsx', 'utf8');
  const inbox = await readFile('src/shared/contexts/JasperNotificationContext.tsx', 'utf8');
  assert.match(migration, /after insert on public\.sales/);
  assert.match(migration, /new\.actual_timestamp < transaction_timestamp\(\) - interval '15 minutes'/);
  assert.match(migration, /exception when others then/);
  assert.match(migration, /v_product_amount := greatest\(v_total-v_delivery_amount,0\)/);
  assert.match(migration, /Sales \(bidhaa\): TSh/);
  assert.match(migration, /Delivery \(ada\): TSh/);
  assert.match(migration, /Pending Dispatch/);
  assert.match(migration, /pos-sale-owner-summary:/);
  assert.match(migration, /on conflict \(tenant_id,idempotency_key\)/);
  assert.match(migration, /branch_notification_events/);
  assert.match(migration, /branch_notification_recipients/);
  assert.doesNotMatch(dashboard, /\baddSaleNotification\(/);
  assert.match(dashboard, /void refreshInbox\(\)/);
  assert.match(inbox, /document\.addEventListener\('visibilitychange', onVisible\)/);
});

test('Delivery Treasury uses existing payment journals and is independent from Sales revenue', async () => {
  const sql = await readFile('supabase/migrations/20261031162000_delivery_treasury_reporting.sql', 'utf8');
  const report = await readFile('src/modules/reports/DashboardReports.tsx', 'utf8');
  const hook = await readFile('src/modules/reports/utils/useDeliveryTreasuryReport.ts', 'utf8');
  const panel = await readFile('src/modules/reports/components/DeliveryTreasuryPanel.tsx', 'utf8');

  assert.match(sql, /get_current_tenant_delivery_treasury_report/);
  assert.match(sql, /j\.source_type='delivery'/);
  assert.match(sql, /j\.source_type='expense'/);
  assert.match(sql, /j\.external_cash_flow is true/);
  assert.match(sql, /l\.signed_amount/);
  assert.match(sql, /'uncollectedFees'/);
  assert.match(sql, /'refunds'/);
  assert.match(sql, /'netCashFlow'/);
  assert.match(sql, /private\.can_read_branch\(v_tenant,l\.branch_id\)/);
  assert.match(sql, /private\.has_branch_permission\(v_tenant,l\.branch_id,'cashandbank\.read'\)/);
  assert.match(sql, /limit v_limit\+1/i);
  assert.doesNotMatch(sql, /create\s+table/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.treasury_/i);
  assert.match(hook, /input\.tab !== 'deliveries'/);
  assert.match(hook, /get_current_tenant_delivery_treasury_report/);
  assert.match(hook, /p_limit: 50/);
  assert.match(panel, /Delivery Treasury/);
  assert.match(panel, /Delivery Expenses Paid/);
  assert.match(panel, /Delivery Payment Accounts/);
  assert.match(report, /<DeliveryTreasuryPanel/);
  assert.match(report, /Quoted Delivery Fees/);
  assert.doesNotMatch(report, /label: 'Logistics Revenue'/);
});

test('POS with a delivery mode assumes fee PAID at checkout in one atomic server call', async () => {
  const sql = await readFile('supabase/migrations/20261031181000_pos_delivery_assumed_paid_at_checkout.sql', 'utf8');
  const treasury = await readFile('src/modules/cash-bank/utils/treasuryApi.ts', 'utf8');
  const dashboard = await readFile('src/components/Dashboard.tsx', 'utf8');
  const notification = await readFile('supabase/migrations/20261031150000_pos_sale_owner_summary_notification.sql', 'utf8');

  assert.match(sql, /post_current_branch_pos_sale_with_delivery/);
  assert.match(sql, /public\.post_current_branch_pos_sale\(p_sale,p_lines\)/);
  assert.match(sql, /public\.save_current_branch_sales\(/);
  assert.match(sql, /'source_type'/i.test(sql) ? /source_type/ : /source_type/);
  assert.match(sql, /'money_in','delivery'/);
  assert.match(sql, /'delivery:'\|\|v_delivery_id\|\|':v1'/);
  assert.match(sql, /'deliveryPaymentStatus','collected'/);
  assert.match(sql, /'status','Pending Dispatch'/);
  assert.match(sql, /'assumedPaidAtCheckout',true/);
  assert.match(sql, /insert into public\.deliveries/);
  assert.match(sql, /private\.can_write_branch\(v_tenant,v_branch,'pos\.write'\)/);
  assert.match(sql, /p_delivery_account_id uuid/);
  assert.doesNotMatch(sql, /create\s+table/i);

  assert.match(treasury, /deliveryAccountSourceKey\?: string/);
  assert.match(treasury, /post_current_branch_pos_sale_with_delivery/);
  assert.match(dashboard, /deliveryAccountSourceKey: deliveryPaymentAccount\?\.id/);
  assert.match(dashboard, /deliverySavedAtCheckout \|\|/);
  assert.match(dashboard, /\(collectedAmount > 0 \|\| deliveryFee > 0\)/);
  assert.match(notification, /Paid \(automatic at checkout\)/);
});

test('Dispatch and Delivered status do not collect a second payment for POS-paid delivery', async () => {
  const dashboard = await readFile('src/components/Dashboard.tsx', 'utf8');
  assert.match(dashboard, /currentDelivery\.deliveryPaymentStatus === 'collected'/);
  assert.match(dashboard, /!!currentDelivery\.treasuryJournalId/);
  assert.match(dashboard, /const saved = await saveTenantDeliveriesOnly\(activeTenant\.id, updated\)/);
  assert.match(dashboard, /del\.deliveryPaymentStatus === 'collected'/);
  assert.match(dashboard, /customerData\.paymentMethod && !del\.treasuryJournalId/);
  assert.match(dashboard, /Delivery fee is already booked in Treasury/);
});
