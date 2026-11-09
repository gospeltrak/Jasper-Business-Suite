import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const server = readFileSync('server.ts','utf8');
const agent = readFileSync('src/modules/affiliate/components/AffiliateAgentDesk.tsx','utf8');
const review = readFileSync('src/modules/platform-admin/components/SuperAffiliatePayoutReview.tsx','utf8');
const admin = readFileSync('src/modules/platform-admin/components/SuperAffiliateControlCenter.tsx','utf8');
const scopeStart = server.indexOf("app.get('/api/affiliate/subscriber-last-activity'");
const payoutStart = server.indexOf('const resolveAffiliatePayoutAccess');
const payoutEnd = server.indexOf("app.get('/api/notifications/inbox'",payoutStart);
assert.ok(scopeStart > 0 && payoutEnd > payoutStart);
const scope = server.slice(scopeStart,payoutStart);
const payout = server.slice(payoutStart,payoutEnd);

test('two authorized scope reads replace code-by-code repeated lookups', () => {
  assert.match(scope,/\.auth\.getUser\(token\)/);
  assert.match(scope,/\.eq\('user_id', auth\.user\.id\)/);
  assert.match(scope,/codeValues\.flatMap/);
  assert.match(scope,/\.filter\(code => \/\^\[A-Za-z0-9_-\]/);
  assert.match(scope,/adminTable\('subscriber_source_tracking'\)\.select\('tenant_id'\)\.or\(conditions\)/);
  assert.match(scope,/adminTable\('referred_customers'\)\.select\('tenant_id'\)\.or\(conditions\)/);
  assert.doesNotMatch(scope,/for \(const code of codeValues\) \{[\s\S]*sources\.push/);
});

test('one payout API is shared by agent and admin and uses a single FK join', () => {
  assert.match(payout,/app\.get\('\/api\/affiliate-operations\/payouts', readAffiliatePayouts\)/);
  assert.match(payout,/app\.post\('\/api\/affiliate-operations\/payouts\/:payoutId\/decision', decideAffiliatePayout\)/);
  assert.match(payout,/affiliates!affiliate_payouts_affiliate_id_fkey\(display_name\)/);
  assert.doesNotMatch(payout,/adminTable\('affiliates'\)\.select\('id,display_name'\)/);
  assert.match(review,/sharedPayoutRequest\('\/api\/affiliate-operations\/payouts\?page=0'\)/);
  assert.match(review,/payouts\?page=\$\{page \+ 1\}/);
  assert.match(payout,/const pageSize = 50/);
  assert.match(payout,/has_more/);
});

test('agent manages only verified assigned affiliate payouts; admin audits without payout actions', () => {
  assert.match(payout,/supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(payout,/isStrictPlatformAdminProfile\(profile\)/);
  assert.match(payout,/partner\.status !== 'active'/);
  assert.match(payout,/\.eq\('agent_user_id', user\.id\)/);
  assert.match(payout,/\.is\('ended_at', null\)/);
  assert.match(payout,/access\.role !== 'agent'/);
  assert.match(payout,/\.in\('affiliate_id', access\.affiliateIds\)/);
  assert.match(payout,/\.in\('status', expectedStatus\)/);
  assert.match(payout,/\.not\('payout_month', 'is', null\)/);
  assert.match(payout,/action === 'approve'/);
  assert.match(payout,/action === 'reject'/);
  assert.match(payout,/action === 'mark_paid'/);
  assert.match(payout,/reason\.length < 10/);
  assert.match(payout,/reference\.length < 5/);
  assert.match(review,/mode === 'agent' && \['requested','processing'\]/);
  assert.match(review,/role="status"/);
  assert.match(admin,/SuperAffiliatePayoutReview/);
  assert.match(agent,/<SuperAffiliatePayoutReview mode="agent" \/>/);
});

test('agent bootstrap does not duplicate network fetches on mount or month change', () => {
  assert.match(agent,/useEffect\(\(\) => \{ void refresh\(\); \}, \[refresh\]\)/);
  assert.doesNotMatch(agent,/useEffect\(\(\) => \{ loadSubAffiliates\(\); \}, \[reconMonth/);
  assert.match(agent,/\}, \[partnerCode, partnerId, partnerInfo\?\.id, partnerInfo\?\.supabaseUserId, partnerInfo\?\.user_id, partnerName, reconMonth\]\)/);
});

test('manual payout only, with no automatic external disbursement', () => {
  assert.doesNotMatch(payout,/azamPay\.send|azamPay\.disburse|autoDisburse|transferToMobileMoney/);
  assert.match(review,/only after the money has been sent manually/);
  assert.match(payout,/status: 'processing'/);
  assert.match(payout,/status: 'paid'/);
  assert.match(payout,/status: 'rejected'/);
});

test('super admin renders a narrow read-only overview without loading full affiliate ledgers',()=>{
  const view=readFileSync('src/modules/platform-admin/components/SuperSaaSAdminView.tsx','utf8');
  const overview=readFileSync('src/modules/platform-admin/components/SuperAffiliateNetworkOverview.tsx','utf8');
  const begin=server.indexOf("app.get('/api/platform/affiliate-network-overview'");
  const end=server.indexOf('const resolveAffiliatePayoutAccess',begin);
  assert.ok(begin>0&&end>begin);
  const api=server.slice(begin,end);
  assert.match(view,/import SuperAffiliateControlCenter from '\.\/SuperAffiliateNetworkOverview'/);
  assert.match(overview,/affiliate-network-overview/);
  assert.match(overview,/Read-only supervision/);
  assert.doesNotMatch(overview,/approve|mark_paid|Reject Withdrawal|Payout Requests|loadAffiliateMonitoringData/);
  assert.match(api,/await requirePlatformAdmin\(req\)/);
  assert.match(api,/\.limit\(limit\)/);
  assert.match(api,/const partial/);
  assert.match(api,/customer_sources:customers\.slice\(0,50\)/);
  assert.match(api,/payout_audit:latestPayouts/);
  assert.doesNotMatch(api,/adminTable\('tenant_workspaces'\)|adminTable\('tenant_data'\)/);
});
