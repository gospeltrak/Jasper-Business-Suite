import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const shell = read('src/components/Dashboard.tsx');
const admin = read('src/modules/platform-admin/components/SuperSaaSAdminView.tsx');
const metrics = read('src/modules/platform-admin/components/SaaSDashboardMetrics.tsx');
const ads = read('src/shared/utils/adPlacement.ts');
const affiliate = read('src/modules/platform-admin/components/SuperAffiliateNetworkOverview.tsx');
const payout = read('src/modules/platform-admin/components/SuperAffiliatePayoutReview.tsx');
const network = read('src/modules/platform-admin/components/SuperAffiliateNetworkOverview.tsx');
const server = read('server.ts');

test('Super Admin keeps a dark-only scaffold without disabling tenant theme controls', () => {
  assert.match(shell, /user\.role === 'SuperAdmin' \? 'dark'/);
  assert.match(shell, /user\.role !== 'SuperAdmin'/);
  assert.match(admin, /id="super-saas-admin-container" className="dark /);
});

test('Super Admin does not fetch marketing records on initial dashboard mount', () => {
  assert.doesNotMatch(admin, /useEffect\(\(\) => \{\s*initializeSaaSData\(\)/);
  assert.match(admin, /\['promotions', 'chats', 'tutorials'\]\.includes\(activeTab\)/);
  assert.match(admin, /void initializeSaaSData\(activeTab\)\.catch/);
  assert.match(admin, /section === 'chats'/);
  assert.match(admin, /section === 'tutorials'/);
  assert.match(admin, /saveMessages\(updated\)/);
  assert.match(admin, /saveCampaignData\(updatedPlacements, updatedBanners\)/);
});

test('Admin cards avoid seven columns, unreadably small KPI labels and redundant dark shadows', () => {
  assert.doesNotMatch(metrics, /xl:grid-cols-7/);
  assert.match(metrics, /lg:grid-cols-4/);
  assert.doesNotMatch(metrics, /shadow-sm shadow-black\/20/);
});

test('Ads are conditional, shared and disabled ads cannot render their creative', () => {
  assert.match(ads, /settings\.dashboardAdEnabled && settings\.dashboardAdCode\?\.trim\(\)/);
  assert.match(ads, /settings\.bottomAdEnabled/);
  assert.match(ads, /adSettingsSubscribers/);
});

test('Super Admin affiliate and payouts stay read-only', () => {
  assert.match(affiliate, /Read-only supervision/);
  assert.match(payout, /mode === 'agent' && \['requested','processing'\]/);
  assert.match(payout, /mode === 'agent' \? 'Approve, reject/);
});

test('Mobile MFA retains one working authenticator control and no unreachable branch', () => {
  assert.doesNotMatch(admin, /\{true \? \(/);
  assert.match(admin, /onClick=\{beginMfaVerification\}/);
});

test('Admin affiliate navigation uses scoped read-only views and bounded payout amounts', () => {
  assert.match(shell, /admin-affiliate-agents'/);
  assert.match(shell, /admin-sub-affiliates'/);
  assert.match(network, /activeSection === 'payouts'/);
  assert.match(network, /activeSection === 'subAffiliates'/);
  assert.match(network, /TZS \{\(p\.amount\|\|0\)\.toLocaleString\(\)\}/);
  assert.match(server, /affiliate_payouts'\)\.select\('id,affiliate_id,amount,net_payout,status/);
});
