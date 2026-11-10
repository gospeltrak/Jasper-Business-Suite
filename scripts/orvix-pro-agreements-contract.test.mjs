import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261110140000_orvix_pro_agreements.sql','utf8');
const api=fs.readFileSync('server.ts','utf8');
const editor=fs.readFileSync('src/modules/platform-admin/components/OrvixProAgreementsEditor.tsx','utf8');
const panel=fs.readFileSync('src/modules/platform-admin/components/OrvixProAdminPanel.tsx','utf8');
test('Per-client till fees remain private and do not automatically activate Pro',()=>{
  assert.match(migration,/create table if not exists public\.orvix_pro_agreements/);
  assert.match(migration,/monthly_amount numeric\(20,2\) generated always/);
  assert.match(migration,/revoke all on public\.orvix_pro_agreements from public,anon,authenticated/);
  assert.match(migration,/force row level security/);
  assert.doesNotMatch(migration,/insert into public\.orvix_pro_entitlements/);
});
test('Agreement editor APIs require strict Super Admin and never post payments',()=>{
  const a=api.indexOf("app.get('/api/orvix-pro/admin/agreements'");
  const b=api.indexOf('// Orvix Pro is a separately provisioned entitlement',a);
  assert.ok(a>0&&b>a);
  const route=api.slice(a,b);
  assert.match(route,/await requirePlatformAdmin\(req\)/);
  assert.match(route,/const admin=await requirePlatformAdmin\(req\)/);
  assert.match(route,/\.from\('orvix_pro_entitlements'\)/);
  assert.match(route,/\.from\('orvix_pro_agreements'\)/);
  assert.match(route,/previous\.status!=='draft'/);
  assert.doesNotMatch(route,/\.from\('treasury|\.from\('payments|\.from\('tenants'\)\.update/);
});
test('Responsive Pro admin editor displays independent fee and till count',()=>{
  assert.match(panel,/OrvixProAgreementsEditor/);
  assert.match(editor,/\/api\/orvix-pro\/admin\/agreements/);
  assert.match(editor,/\/api\/orvix-pro\/admin\/clients/);
  assert.match(editor,/lg:grid-cols-2/);
  assert.match(editor,/Save Draft Agreement/);
  assert.match(editor,/No payment was collected and no access was activated/);
});
