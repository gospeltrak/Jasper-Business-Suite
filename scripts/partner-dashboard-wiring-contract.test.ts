import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const portal = fs.readFileSync('src/components/AffiliatePortal.tsx', 'utf8');
const desk = fs.readFileSync('src/components/affiliate/AffiliateAgentDesk.tsx', 'utf8');

test('partner dashboard renders outside the login shell to fit desktop viewport', () => {
  assert.match(portal, /if \(authMode === 'dashboard' && databaseAgentWorkspaceEnabled\)[\s\S]*return <AffiliateAgentDesk/);
  const authenticatedGate = portal.indexOf("if (authMode === 'dashboard' && databaseAgentWorkspaceEnabled)");
  const loginShell = portal.slice(authenticatedGate + 1);
  assert.doesNotMatch(loginShell, /databaseAgentWorkspaceEnabled \? \([\s\S]*AffiliateAgentDesk/);
});

test('sub-affiliates are loaded through authenticated partner ownership', () => {
  assert.match(server, /app\.get\('\/api\/partner\/sub-affiliates'/);
  assert.match(server, /\.eq\('user_id', authData\.user\.id\)/);
  assert.match(server, /\.eq\('parent_super_agent_id', String\(partner\.id\)\)/);
  assert.match(desk, /\/api\/partner\/sub-affiliates/);
  assert.match(desk, /Array\.isArray\(result\.affiliates\)/);
});
