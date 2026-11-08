import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('src/modules/affiliate/components/AffiliateAgentDesk.tsx','utf8');
const overview = source.slice(source.indexOf('{/* Compact overview:'),source.indexOf('{/* ══ RECONCILIATION ══ */}'));
test('Agent navigation separates overview, payment status, affiliates and messages', () => {
  assert.match(source, /id: 'reconciliation', label: 'Payment Status'/);
  assert.match(source, /id: 'tutorials',\s+label: 'Messages & Targets'/);
  assert.match(source, /const MOBILE_PRIMARY_TAB_IDS: DashTab\[\] = \['overview', 'reconciliation', 'affiliates', 'customers'\]/);
});
test('Compact overview uses derived real totals and no payout status card', () => {
  assert.match(overview, /My Affiliates/);
  assert.match(overview, /Joined Customers/);
  assert.match(overview, /Affiliate Commission \(10%\)/);
  assert.match(overview, /My Commission \(5%\)/);
  assert.match(overview, /totals\.subAffiliateShare15/);
  assert.match(overview, /totals\.managerCommission5/);
  assert.match(overview, /sort\(\(left, right\) => right\.customersGenerated - left\.customersGenerated\)/);
  assert.match(overview, /setActiveTab\('tutorials'\)/);
  assert.match(overview, /setActiveTab\('conferencing'\)/);
  assert.doesNotMatch(overview, /Pending Payouts|Payment Status|⚠️|👋|💸/);
});
test('Emerald mobile navigation uses compact text instead of decorative emoji', () => {
  assert.match(source, /bg-emerald-700\/35/);
  assert.match(source, /text-\[9px\] font-medium leading-tight/);
  assert.match(source, /bg-\[#061b16\]/);
});
