import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261105080000_affiliate_v2_rewards_payouts.sql','utf8');
const server=fs.readFileSync('server.ts','utf8');
const policy=fs.readFileSync('src/modules/affiliate/utils/affiliatePolicy.ts','utf8');
const workspace=fs.readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx','utf8');
const portal=fs.readFileSync('src/modules/affiliate/components/AffiliatePortal.tsx','utf8');
const login=fs.readFileSync('src/modules/auth/LoginPage.tsx','utf8');

test('signup uses authenticated server identity and awards one bonus of TZS 2,000',()=>{
 assert.match(login,/callback\.searchParams\.set\('ref', affiliateCode\.trim\(\)\)/);
 assert.match(server,/app\.post\('\/api\/auth\/google\/provision'/);
 assert.match(server,/credit_affiliate_signup_v2/g);
 assert.match(migration,/registration:'\|\|p_tenant_id::text/);
 assert.match(migration,/registration_bonus',2000,0,2000/);
 assert.match(migration,/on conflict\(source_key\) do nothing/);
 assert.match(migration,/v_aff\.user_id=p_user_id/);
 assert.doesNotMatch(server,/subAffiliateGross15 = paidAmount/);
});
test('commission is based on each paid proof and idempotent across retries',()=>{
 assert.match(migration,/credit_affiliate_subscription_v2/);
 assert.match(migration,/proof\.status='approved'/);
 assert.match(migration,/renewal_source='payment_approval'/);
 assert.match(migration,/v_gross:=round\(v_amount\*0\.10,2\)/);
 assert.match(migration,/payment:'\|\|p_payment_proof_id::text/);
 assert.match(server,/credit_affiliate_subscription_v2/);
});
test('one withdrawal request only on Tanzania last Friday via atomic server-side RPC',()=>{
 assert.match(migration,/Africa\/Dar_es_Salaam/);
 assert.match(migration,/v_today<>v_last_friday/);
 assert.match(migration,/v_gross<10000/);
 assert.match(migration,/affiliate_payouts_one_request_per_month_v2/);
 assert.match(migration,/provider does not match the saved affiliate account/);
 assert.match(migration,/status='reserved'/);
 assert.match(migration,/drop policy if exists affiliate_payouts_self_request/);
 assert.match(workspace,/request_affiliate_month_end_withdrawal_v2/);
 assert.doesNotMatch(workspace,/dbWrite\(\s*'affiliate_payouts',\s*'insert'/);
});
test('fees and withholding are not confused and automatic AzamPay disbursement is not fabricated',()=>{
 assert.match(policy,/AZAMPAY_EXTERNAL_FEE_TZS = 200/);
 assert.match(migration,/then 0 else 200 end/);
 assert.match(migration,/v_fee:=case/);
 assert.match(migration,/awaiting admin approval and verified AzamPay disbursement/);
 assert.match(migration,/withholding_tax numeric\(14,2\) not null default 0/);
});
test('Kiswahili landing states actual bonus 10% and withdrawal policy',()=>{
 assert.match(portal,/Leta Mteja, Pata Zawadi/);
 assert.match(portal,/TZS 2,000/);
 assert.match(portal,/kamisheni ya 10%/);
 assert.match(portal,/Ijumaa ya mwisho/);
 assert.match(portal,/Endelea kwa Google/);
});
