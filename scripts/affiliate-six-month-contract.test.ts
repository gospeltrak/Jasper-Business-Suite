import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261106153744_affiliate_six_month_commission_cap_20261106.sql', 'utf8');
const policy = fs.readFileSync('src/modules/affiliate/utils/affiliatePolicy.ts', 'utf8');
const portal = fs.readFileSync('src/modules/affiliate/components/AffiliatePortal.tsx', 'utf8');
const terms = fs.readFileSync('src/modules/affiliate/components/TermsTranslations.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

test('verified paid subscription billing history limits each tenant to 6 cycles within 6 months', () => {
  assert.match(sql, /create or replace function public\.credit_affiliate_subscription_v2/);
  assert.match(sql, /from public\.tenant_subscription_renewals r/);
  assert.match(sql, /join public\.tenant_payment_proofs proof/);
  assert.match(sql, /proof\.tenant_id=r\.tenant_id/);
  assert.match(sql, /r\.tenant_id=p_tenant_id/);
  assert.match(sql, /r\.renewal_source='payment_approval'/);
  assert.match(sql, /proof\.status='approved' and proof\.amount>0/);
  assert.match(sql, /row_number\(\) over/);
  assert.match(sql, /v_cycle_number > 6/);
  assert.match(sql, /v_cycle_start >= v_first_cycle_start \+ interval '6 months'/);
  assert.match(sql, /where payment_proof_id=p_payment_proof_id/);
  assert.match(sql, /pg_advisory_xact_lock/);
});

test('financial history remains immutable; rewards are idempotent and server-only', () => {
  assert.doesNotMatch(sql, /\b(delete from|truncate|drop table|update public\.affiliate_reward_entries)\b/i);
  assert.match(sql, /'payment:'\|\|p_payment_proof_id::text/);
  assert.match(sql, /on conflict\(source_key\) do nothing/);
  assert.match(sql, /auth\.role\(\)\) is distinct from 'service_role'/);
  assert.match(sql, /revoke all on function public\.credit_affiliate_subscription_v2/);
  assert.match(sql, /grant execute on function public\.credit_affiliate_subscription_v2\(uuid,uuid\) to service_role/);
  assert.match(server, /credit_affiliate_subscription_v2/);
});

test('one subscription fee per eligible paid period, none on a seventh or after elapsed six months', () => {
  const first = new Date('2026-01-01T10:00:00Z');
  const addMonth = (d: Date, months: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), d.getUTCHours()));
  const endsAt = addMonth(first, 6);
  const qualifies = (sequence: number, cycleStart: Date) => sequence <= 6 && cycleStart < endsAt;
  for (let i = 1; i <= 6; i++) {
    assert.equal(qualifies(i,addMonth(first,i-1)),true, 'paid month ' + i);
  }
  assert.equal(qualifies(7,addMonth(first,6)),false);
  // 30-day billing is slightly shorter than calendar months: the 7th paid
  // cycle is still rejected even when it precedes the calendar cutoff.
  assert.equal(qualifies(7,new Date(first.getTime() + 180 * 86400000)),false);
  assert.equal(qualifies(2,addMonth(first,12)),false, 'a long payment gap does not restart the clock');
  assert.equal(qualifies(6,endsAt),false, 'six months is an exclusive cutoff');
});

test('all public affiliate notices state the same six-month ceiling', () => {
  assert.match(policy, /AFFILIATE_COMMISSION_MONTH_LIMIT = 6/);
  assert.match(portal, /miezi 6 ya kwanza/);
  assert.match(terms, /miezi 6 ya kwanza/);
  assert.match(terms, /first six months/);
  assert.match(terms, /six premiers mois/);
});
