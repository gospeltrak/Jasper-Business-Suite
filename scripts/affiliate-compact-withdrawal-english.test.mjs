import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync('src/modules/affiliate/components/AffiliateWorkspace.tsx','utf8');
const loader = readFileSync('src/modules/affiliate/utils/affiliateWorkspace.ts','utf8');
const language = readFileSync('src/shared/contexts/LanguageContext.tsx','utf8');
const payout = workspace.slice(workspace.indexOf("{activeTab === 'payouts' &&"),workspace.indexOf("{activeTab === 'settings' &&"));
const modal = payout.slice(payout.indexOf('{/* Compact, full-balance withdrawal review'));

test('Affiliate Payment Status shows one clean available balance instead of stacked total earnings', () => {
  assert.match(payout,/Available Balance/);
  assert.match(payout,/data-testid="affiliate-available-balance"/);
  assert.doesNotMatch(payout,/Total Earnings|Available to Request/);
  assert.match(payout,/Request Funds/);
});

test('Withdrawal modal is concise and has registered phone only, without editable payout phone', () => {
  assert.match(modal,/Registered phone/);
  assert.match(modal,/phone_whatsapp/);
  assert.match(modal,/type="tel" readOnly aria-readonly="true"/);
  assert.doesNotMatch(modal,/onChange=\{e => setWithdrawForm\(f => \(\{ \.\.\.f, phone/);
  assert.match(modal,/Minimum balance: TZS 10,000/);
  assert.match(modal,/Transfer fee \(estimate\)/);
  assert.match(modal,/Fee is deducted from your payout/);
  assert.match(modal,/Submit Request/);
  assert.doesNotMatch(modal,/Ada ya AzamPay|Ombi linathibitishwa|Jina la mmiliki wa akaunti/);
});

test('Client RPC submits saved registered phone and profile load selects that field', () => {
  assert.match(workspace,/const phone = workspace\.profile\.phone_whatsapp \|\| '';/);
  assert.match(loader,/\.select\('id, user_id, display_name, referral_code, promo_code, referral_slug, status, payout_method, payout_account, phone_whatsapp, profile_image_url'\)/);
  assert.match(workspace,/request_affiliate_month_end_withdrawal_v2/);
  assert.match(workspace,/p_recipient_phone: phone\.trim\(\)/);
});

test('Affiliate route is English without overriding shared tenant language', () => {
  assert.ok(language.includes('affiliate(?:'));
  assert.match(language,/affiliateRouteLanguage\(\)/);
  assert.match(language,/effectiveLang/);
  assert.match(language,/value=\{\{ lang: effectiveLang, setLang, t \}\}/);
});
