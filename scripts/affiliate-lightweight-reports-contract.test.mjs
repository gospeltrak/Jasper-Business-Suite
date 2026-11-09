import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const affiliate = readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx','utf8');
const agent = readFileSync('src/modules/affiliate/components/AffiliateAgentDesk.tsx','utf8');
const backend = readFileSync('server.ts','utf8');
const reports = affiliate.slice(affiliate.indexOf("{activeTab === 'reports' &&"), affiliate.indexOf("{activeTab === 'payouts' &&"));
const taskApi = backend.slice(backend.indexOf("app.get('/api/affiliate-operations/task-reviews'"),backend.indexOf("app.get('/api/notifications/inbox'"));

test('reports use three compact tabs and existing in-memory workspace data',()=>{
  for (const title of ["'subscribers','Subscribers'","'payments','Payments'","'tasks','Tasks'"]) assert.ok(reports.includes(title),title);
  assert.match(reports,/workspace\?\.rewards/);
  assert.match(reports,/workspace\?\.payouts/);
  assert.match(reports,/workspace\?\.tasks/);
  assert.match(reports,/monthlySubscribers/);
  assert.doesNotMatch(reports,/fetch\(|setInterval\(/);
  assert.match(reports,/grid grid-cols-2 gap-2\.5 lg:grid-cols-4/);
  assert.match(reports,/role="tablist"/);
});
test('reports reuse existing Excel exporter and keep subscriber commission, promo and payment method private',()=>{
  assert.match(affiliate,/import \{ downloadExcelFileFromRows \}/);
  assert.match(reports,/downloadExcelFileFromRows/);
  assert.match(reports,/aoa: exportRows/);
  assert.match(reports,/Print \/ PDF/);
  assert.match(reports,/\['Business','Location','Package','Status','Amount Paid','Last Activity'\]/);
  assert.doesNotMatch(reports,/promo_code_used|referral_code_used|commission_amount|payout_method|payment_method/);
});
test('task report only counts verified reviews as approved and uses same task statuses',()=>{
  assert.match(reports,/t\.status === 'reviewed'/);
  assert.match(reports,/t\.status === 'completed'/);
  assert.match(reports,/Awaiting Review/);
  assert.match(reports,/No background monitoring/);
  assert.match(reports,/const approved = tasks\.filter\(t => t\.status === 'reviewed'\)\.length/);
  assert.match(affiliate,/Mark as Done/);
});
test('task Agent review is manually triggered, server-authenticated and assignment scoped',()=>{
  assert.match(agent,/if\(activeTab==='tutorials'\) void refreshTaskReviews\(\)/);
  assert.match(agent,/<section className="rounded-xl[^>]+data-testid="agent-manual-task-review"/);
  assert.match(agent,/decideTaskReview\(task\.id,'approve'\)/);
  assert.match(agent,/decideTaskReview\(task\.id,'return'\)/);
  assert.match(taskApi,/resolveAffiliatePayoutAccess\(req\)/);
  assert.match(taskApi,/access\.role !== 'agent'/);
  assert.match(taskApi,/\.in\('affiliate_id',access\.affiliateIds\)/);
  assert.match(taskApi,/\.eq\('status','completed'\)/);
  assert.match(taskApi,/action === 'approve' \? 'reviewed' : 'pending'/);
  assert.match(taskApi,/\.limit\(50\)/);
  assert.doesNotMatch(taskApi,/setInterval|autoApprove|new_tracking|new_audit/);
});
