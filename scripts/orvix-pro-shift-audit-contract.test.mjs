import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const schema=read('supabase/migrations/20261110123000_orvix_pro_shift_audit.sql');
const server=read('server.ts');
const ui=read('src/modules/sales/OrvixProSettleWorkspace.tsx');
const dashboard=read('src/components/Dashboard.tsx');

test('Pro audit ledger is isolated with RLS and no treasury balance mutation',()=>{
  assert.match(schema,/create table if not exists public\.orvix_pro_shift_sessions/);
  assert.match(schema,/create table if not exists public\.orvix_pro_shift_audit/);
  assert.match(schema,/orvix_pro_one_open_shift_per_cashier/);
  assert.match(schema,/enable row level security/);
  assert.match(schema,/force row level security/);
  assert.match(schema,/revoke all on public\.orvix_pro_shift_sessions from public,anon,authenticated/);
  assert.match(schema,/revoke all on public\.orvix_pro_shift_audit from public,anon,authenticated/);
  assert.match(schema,/private\.capture_orvix_pro_shift_audit/);
  assert.match(schema,/after insert or update/);
  assert.doesNotMatch(schema,/insert into public\.(sales|treasury|tenant_workspaces)/);
});
test('Every Pro shift API derives tenant from verified session, validates branch and feature flags',()=>{
  const start=server.indexOf('const resolveProShiftActor = async');
  const end=server.indexOf("app.get('/api/branches/bootstrap'",start);
  const scope=server.slice(start,end);
  assert.ok(start>0 && end>start);
  assert.match(scope,/supabaseAdmin\.auth\.getUser\(token\)/);
  assert.match(scope,/\.from\('users'\)/);
  assert.match(scope,/\.from\('orvix_pro_entitlements'\)/);
  assert.match(scope,/grant\[requiredFlag\] === true/);
  assert.match(scope,/\.from\('branches'\)/);
  assert.match(scope,/\.eq\('tenant_id',account\.tenant_id\)/);
  assert.match(scope,/\.from\('branch_staff_assignments'\)/);
  assert.match(scope,/\.eq\('cashier_id',ctx\.account\.id\)/);
  assert.match(scope,/\.neq\('cashier_id',ctx\.account\.id\)/);
  assert.match(scope,/\.eq\('status','submitted'\)/);
  assert.doesNotMatch(scope,/\.from\('treasury|\.from\('sales'/);
});
test('Pro-only UI loads server entitlements and supports mobile shift, history and review',()=>{
  assert.match(dashboard,/loadOrvixProFeatures\(activeTenant\.id\)/);
  assert.match(dashboard,/tabId === 'pro-settle'/);
  assert.match(dashboard,/privateProPortal && proFeatures\.settle/);
  assert.match(dashboard,/OrvixProSettleWorkspace/);
  assert.match(ui,/getSecureDataBridgeClient/);
  assert.match(ui,/\/api\/orvix-pro\/shifts\/open/);
  assert.match(ui,/\/api\/orvix-pro\/shifts\/submit/);
  assert.match(ui,/\/api\/orvix-pro\/shifts\/review/);
  assert.match(ui,/branchId/);
  assert.match(ui,/sm:grid-cols-2/);
  assert.match(ui,/lg:grid-cols-2/);
});
