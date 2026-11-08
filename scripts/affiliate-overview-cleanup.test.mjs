import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const file = readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx', 'utf8');
const overview = file.slice(file.indexOf("{activeTab === 'overview' && <div"), file.indexOf("{activeTab === 'tenants' &&"));
const header = file.slice(file.indexOf("{activeTab === 'overview' && (\n            <header"), file.indexOf("{notice &&"));

test('welcome is scoped to overview and redundant header actions removed', () => {
  assert.match(header, /Welcome, \{profile\.display_name\}/);
  assert.doesNotMatch(header, /copyReferralLink|onClick=\{refresh\}|Share link|Refresh|Wateja, vifurushi|Connected affiliate account/);
});
test('compact overview English labels and full commission including referral rewards', () => {
  for (const term of ['My Customers','Paid Customers','Unpaid Customers','Commission & Referrals','Free Trial & Plans','Recent Customers','Ads & Tutorials']) {
    assert.ok(overview.includes(term), term);
  }
  assert.match(overview, /currency\.format\(metrics\.earned\)/);
  assert.doesNotMatch(overview, /My Commission|Wateja Hivi Karibuni|Matangazo & Tutorials|Wateja Wangu|Hawajalipa/);
});
test('recent customer row expands details without decorative arrow', () => {
  const recent = overview.slice(overview.indexOf('Recent Customers'), overview.indexOf('Ads & Tutorials'));
  assert.match(recent, /<details key=\{customer\.id\}/);
  assert.doesNotMatch(recent, /<ChevronRight/);
});
test('other functional tabs and full-balance withdrawal path remain', () => {
  assert.match(file, /\['code-link', 'Code & Link'/);
  assert.match(file, /\['payouts', 'Payment Status'/);
  assert.match(file, /request_affiliate_month_end_withdrawal_v2/);
  assert.match(file, /amount: String\(Math\.round\(metrics\.available\)\)/);
});
