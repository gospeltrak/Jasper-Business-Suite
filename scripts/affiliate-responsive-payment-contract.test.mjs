import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const ui = fs.readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx','utf8');
const summary = fs.readFileSync('src/modules/affiliate/utils/affiliateDashboardSummary.ts','utf8');
const overview = ui.slice(ui.indexOf("{activeTab === 'overview' &&"),ui.indexOf("{activeTab === 'tenants' &&"));
const payout = ui.slice(ui.indexOf("{activeTab === 'payouts' &&"),ui.indexOf("{activeTab === 'settings' &&"));

test('Affiliate menu keeps payment status, customer records, reports, messages and real campaigns', () => {
  for(const t of ["['overview', 'Overview'","['payouts', 'Payment Status'","['tenants', 'Customers'","['reports', 'Reports'","['tasks', 'Messages & Tasks'","['ads', 'Ads & Tutorials'","['settings', 'Settings'"]) assert.ok(ui.includes(t),t);
  assert.match(ui,/handleTrackedLink\('ad_download'/);
  assert.match(ui,/completeAffiliateTask/);
});
test('Overview is small, paid vs trial counts are server sourced and commission not duplicated', () => {
  for(const name of ['My Customers','Paid Customers','Unpaid Customers','Commission & Referrals','Free Trial & Plans','Recent Customers','Ads & Tutorials']) assert.ok(overview.includes(name),name);
  assert.match(overview,/getAffiliateCustomerState\(customer\)/);
  assert.match(summary,/isSettledPaymentStatus\(customer.payment_status\)/);
  assert.doesNotMatch(overview,/Tuma Ombi la Withdraw|Pending Requests/);
});
test('Payout requests are manual full-balance RPC and read-only mirrors cannot withdraw', () => {
  assert.match(ui,/request_affiliate_month_end_withdrawal_v2/);
  assert.match(ui,/p_recipient_name/);
  assert.match(ui,/AFFILIATE_MIN_WITHDRAWAL_TZS/);
  assert.match(ui,/amount: String\(Math.round\(metrics.available\)\)/);
  assert.match(payout,/Referral Bonus/);
  assert.match(payout,/Commission \(10%\)/);
  assert.match(payout,/Salio la kuomba/);
  assert.match(payout,/Historia ya Maombi ya Malipo/);
  assert.match(payout,/mirrorMode/);
});
