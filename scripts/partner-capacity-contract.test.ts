import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const portal = fs.readFileSync('src/components/AffiliatePortal.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260812000301_limit_affiliate_partners_to_ten.sql', 'utf8');

test('partner registration allows capacity up to ten and rejects the eleventh', () => {
  assert.match(server, /MAX_AFFILIATE_PARTNERS = 10/);
  assert.match(server, /count \|\| 0\) >= MAX_AFFILIATE_PARTNERS/);
  assert.match(portal, /count \?\? 0\) >= 10/);
  assert.match(portal, /Maximum 10/);
});

test('database serializes concurrent partner inserts before enforcing capacity', () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /count\(\*\).*affiliate_partners[\s\S]*>= 10/);
  assert.match(migration, /before insert on public\.affiliate_partners/);
  assert.match(migration, /revoke all on function.*from public, anon, authenticated/i);
});
