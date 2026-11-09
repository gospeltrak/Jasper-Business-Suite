import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx','utf8');
const admin = readFileSync('src/modules/platform-admin/components/SuperAffiliatePayoutReview.tsx','utf8');
const adminCenter = readFileSync('src/modules/platform-admin/components/SuperAffiliateControlCenter.tsx','utf8');
const api = readFileSync('server.ts','utf8');
const payout = ui.slice(ui.indexOf("{activeTab === 'payouts' &&"),ui.indexOf("{activeTab === 'settings' &&"));
const endpoints = api.slice(api.indexOf("app.get('/api/platform/affiliate-payouts'"),api.indexOf("app.get('/api/notifications/inbox'"));

test('Payment Status has compact earnings, available balance, request CTA and status history', () => {
  for(const word of ['Referral Bonus','Commission (10%)','Available Balance','Request Funds','Withdrawal Summary','Withdrawal History']) assert.ok(payout.includes(word),word);
  assert.doesNotMatch(payout,/Referral bonus, commission na withdrawal requests/);
  assert.match(payout,/\['pending', 'Pending'\]/);
  assert.match(payout,/\['paid', 'Paid'\]/);
  assert.match(payout,/\['rejected', 'Rejected'\]/);
  assert.match(payout,/payout\.notes/);
  assert.match(payout,/\!canWithdraw/);
  assert.match(payout,/metrics\.available < AFFILIATE_MIN_WITHDRAWAL_TZS/);
  assert.match(payout,/Fee is deducted from your payout/i);
  assert.match(payout,/amount: String\(Math\.round\(metrics\.available\)\)/);
});
test('Manual payout RPC remains atomically validated by backend and no automatic transfer added', () => {
  assert.match(ui,/request_affiliate_month_end_withdrawal_v2/);
  assert.match(ui,/!payoutWindow\.isLastFriday/);
  assert.match(ui,/hasMonthWithdrawal/);
  assert.doesNotMatch(ui,/sendMoneyAutomatically|disbursePaymentAutomatically/);
});
test('Super Admin has scoped manual payout review requiring rejection reason or payment proof', () => {
  assert.match(adminCenter,/SuperAffiliatePayoutReview/);
  assert.match(adminCenter,/Payout Requests/);
  assert.match(admin,/Reason \(required, 10–500 characters\)/);
  assert.match(admin,/Verified transaction reference \(required\)/);
  assert.match(admin,/only after the money has been sent manually/);
  assert.match(endpoints,/await requirePlatformAdmin\(req\)/);
  assert.match(endpoints,/reason\.length < 10/);
  assert.match(endpoints,/reference\.length < 5/);
  assert.match(endpoints,/\.in\('status', \['requested', 'processing'\]\)/);
  assert.match(endpoints,/\.not\('payout_month', 'is', null\)/);
  assert.match(endpoints,/status: 'rejected'/);
  assert.match(endpoints,/status: 'paid'/);
  assert.match(endpoints,/payout_reference: reference/);
  assert.doesNotMatch(endpoints,/azamPay\.disburse|paymentGateway\.send/);
});
