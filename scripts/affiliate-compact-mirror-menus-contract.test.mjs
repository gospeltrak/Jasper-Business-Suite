import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const agent=readFileSync('src/modules/affiliate/components/AffiliateAgentDesk.tsx','utf8');
const affiliate=readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx','utf8');
const loader=readFileSync('src/modules/affiliate/utils/affiliateWorkspace.ts','utf8');
const migration=readFileSync('supabase/migrations/20261109170000_affiliate_promo_change_once.sql','utf8');
const mirror=agent.slice(agent.indexOf('  if (mirrorTarget) {'),agent.indexOf('  // ── Loading / Error states'));
const code=affiliate.slice(affiliate.indexOf('const saveCode = async'),affiliate.indexOf('const refresh = useCallback'));
const tasks=affiliate.slice(affiliate.indexOf("{activeTab === 'tasks' &&"),affiliate.indexOf("{activeTab === 'reports' &&"));

test('mirror is compact, read only, tabbed, and never fetches data on navigation',()=>{
  for(const t of ["['overview','Overview']","['customers','Customers']","['payments','Payments']","['tasks','Tasks']","['reports','Reports']"])assert.ok(mirror.includes(t),t);
  assert.match(mirror,/role="tablist"/);
  assert.match(mirror,/customers\.filter\(row => row\.subAffiliateId === mirrorTarget\.id\)/);
  assert.match(mirror,/taskReviews\.filter\(task => task\.affiliate_id === mirrorTarget\.id\)/);
  assert.match(mirror,/data-testid="agent-compact-affiliate-mirror"/);
  assert.doesNotMatch(mirror,/fetch\(|loadAffiliateWorkspace|\.from\('|dbWrite|onClick=\{.*approve/);
});
test('no chat; lightweight ads tasks and meetings with no autoplay',()=>{
  assert.match(affiliate,/\['tasks', 'Tasks', ClipboardList\]/);
  assert.doesNotMatch(tasks,/Messages & Tasks|chat-message|two-way/);
  assert.match(tasks,/No tasks assigned/);
  assert.match(tasks,/No advertisements assigned/);
  assert.match(tasks,/No tutorials assigned/);
  assert.match(tasks,/No upcoming meetings/);
  assert.match(affiliate,/loading="lazy" decoding="async"/);
  assert.match(affiliate,/Link available near meeting time/);
  assert.doesNotMatch(affiliate,/autoPlay=|autoPlay\b/);
});
test('affiliate code change queries no other affiliate records and locks after one update',()=>{
  assert.doesNotMatch(code,/cloudAffiliateCodes|\.from\('affiliates'\)\.select/);
  assert.match(code,/workspace\.profile\.promo_code_changed_at/);
  assert.match(affiliate,/!profile\.promo_code_changed_at && <button/);
  assert.match(loader,/promo_code_changed_at/);
  assert.match(migration,/add column if not exists promo_code_changed_at/);
  assert.match(migration,/before update of promo_code, referral_code, referral_slug, promo_code_changed_at/);
  assert.match(migration,/auth\.uid\(\) = old\.user_id/);
  assert.match(migration,/old\.promo_code_changed_at is not null/);
  assert.doesNotMatch(migration,/drop table|truncate|delete from/);
});
test('queries task, meetings and media with explicit columns, and settings sign-out is separate',()=>{
  assert.doesNotMatch(loader,/affiliate_tasks'\)\.select\('\*'\)|affiliate_meetings'\)\.select\('\*'\)|affiliate_ad_campaigns\(\*\)/);
  const settings=affiliate.slice(affiliate.indexOf("{activeTab === 'settings' &&"));
  assert.doesNotMatch(settings, /<LogOut className="h-4 w-4" \/> Sign out/);
  assert.match(settings,/Save Settings/);
});
