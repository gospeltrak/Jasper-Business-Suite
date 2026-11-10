import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync('server.ts','utf8');
const ui=fs.readFileSync('src/modules/sales/OrvixProAccountabilityWorkspace.tsx','utf8');
const dashboard=fs.readFileSync('src/components/Dashboard.tsx','utf8');
test('Pro reports require verified tenant branch and independent manager role',()=>{
  const a=server.indexOf("app.get('/api/orvix-pro/accountability'");
  const b=server.indexOf("app.get('/api/branches/bootstrap'",a);
  assert.ok(a>0&&b>a);
  const route=server.slice(a,b);
  assert.match(route,/resolveProShiftActor\(req, res, 'cashier_accountability_enabled'\)/);
  assert.match(route,/if \(!ctx\.manager\) return res\.status\(403\)/);
  assert.match(route,/\.eq\('tenant_id', account\.tenant_id\)\.eq\('branch_id', branch\.id\)/);
  assert.match(route,/\.from\('users'\)/);
  assert.match(route,/\.eq\('tenant_id', account\.tenant_id\)\.eq\('is_active', true\)/);
  assert.match(route,/\.limit\(125\)/);
  assert.doesNotMatch(route,/\.insert\(|\.update\(|\.delete\(/);
});
test('Private Pro manager UI is responsive and does not expose other branches',()=>{
  assert.match(dashboard,/activeTab === 'pro-accountability'/);
  assert.match(dashboard,/privateProPortal && proFeatures\.cashierAccountability/);
  assert.match(dashboard,/OrvixProAccountabilityWorkspace/);
  assert.match(ui,/getSecureDataBridgeClient/);
  assert.match(ui,/\/api\/orvix-pro\/accountability\?branchId=/);
  assert.match(ui,/lg:grid-cols-2/);
  assert.match(ui,/sm:grid-cols-2/);
  assert.match(ui,/setSelected\(x\.id\)/);
});
