import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx', 'utf8');
const mapper = readFileSync('src/modules/affiliate/utils/affiliateWorkspace.ts', 'utf8');
const start = source.indexOf("{activeTab === 'tenants' &&");
const end = source.indexOf("{activeTab === 'code-link' &&", start);
assert.ok(start >= 0 && end > start, 'Customers section must exist');
const ui = source.slice(start,end);

test('four compact consistent KPI cards, no commission widgets', () => {
  for (const label of ['Total Customers','Paid','Free Trial','Unpaid / Expired']) assert.ok(ui.includes(label),label);
  assert.match(ui,/grid grid-cols-2 gap-2\.5 sm:gap-3 lg:grid-cols-4/);
  assert.match(ui,/shadow-\[0_5px_18px_-11px_rgba/);
  assert.doesNotMatch(ui, /Est\. Commission|Paid Out|Pending Commission|Commission Amount|promo_code_used|referral_code_used/);
});
test('one horizontal plan filter row and search/status combined filtering', () => {
  assert.match(ui,/flex flex-nowrap items-center/);
  assert.match(ui,/overflow-x-auto/);
  assert.match(ui,/setTenantPlanFilter\(value\)/);
  assert.match(ui,/tenantPlanFilter === 'all' \|\| plan\.toLowerCase\(\) === tenantPlanFilter/);
  assert.match(ui,/tenantStatusFilter === 'all' \|\| state === tenantStatusFilter/);
  assert.match(ui,/searchable\.includes\(q\)/);
  for(const plan of ['Free Trial','Ruby','Diamond','Tanzanite']) assert.ok(ui.includes("'"+plan+"'"),plan);
});
test('customer rows are accessible, concise and support arrow to detail panel', () => {
  assert.match(ui,/aria-label=\{`View details for/);
  assert.match(ui,/<ChevronRight aria-hidden="true"/);
  assert.match(ui,/aria-modal="true"/);
  assert.match(ui,/max-h-\[88dvh\]/);
  assert.match(ui,/md:grid-cols-\[minmax\(0,1fr\)_170px\]/);
});
test('detail shows amount paid and last system activity, but no payment method, commission or promo', () => {
  for (const label of ['Business','Owner','Location','Package','Subscription Status','Registration Date','Amount Paid','Subscription Expiry','Last Activity']) {
    assert.ok(ui.includes("['"+label+"',"),label);
  }
  assert.match(ui,/currency\.format\(Number\(selectedTenant\.amount_paid \|\| 0\)\)/);
  assert.match(ui,/formatActivity\(selectedTenant\.last_activity_at\)/);
  assert.doesNotMatch(ui,/\['Payment Method'|\['Commission'|\['Promo Code'|\['Comm\. Status'/);
});
test('never invent last activity using updated_at metadata', () => {
  assert.match(mapper,/last_activity_at: row\.last_activity_at \|\| row\.lastActivityAt \|\| null/);
  assert.doesNotMatch(mapper,/last_activity_at: row\.last_activity_at \|\| row\.lastActivityAt \|\| row\.updated_at/);
  assert.match(ui,/return 'Not recorded'/);
});
