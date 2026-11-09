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

test('Free Trial & Plans is a compact emerald highlight with readable stats in light and dark modes', () => {
  const cardStart = overview.indexOf('data-testid="affiliate-plan-summary"');
  const cardEnd = overview.indexOf('Recent Customers', cardStart);
  assert.ok(cardStart >= 0 && cardEnd > cardStart);
  const card = overview.slice(cardStart, cardEnd);
  assert.match(card, /bg-\[linear-gradient\(112deg,#075c45/);
  assert.match(card, /dark:bg-\[linear-gradient\(112deg,#064c3a/);
  assert.match(card, /shadow-\[0_9px_24px/);
  assert.match(card, /text-white/);
  assert.match(card, /pointer-events-none/);
  assert.match(card, /aria-hidden="true"/);
  assert.match(card, /BarChart3 aria-hidden="true"/);
  assert.match(card, /text-white\/\[0\.06\]/);
  assert.match(card, /customerSummary\.trial/);
  assert.match(card, /customerSummary\.ruby/);
  assert.match(card, /customerSummary\.diamond/);
  assert.match(card, /customerSummary\.tanzanite/);
  assert.match(card, /setActiveTab\('tenants'\)/);
  assert.doesNotMatch(card, /Paid subscriptions by plan/);
});
