import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAffiliateDashboardSummary, getAffiliateCustomerState } from '../src/modules/affiliate/utils/affiliateDashboardSummary';

test('paid requires explicit settled payment and trial is not treated as paid', () => {
  assert.equal(getAffiliateCustomerState({ payment_status: 'unpaid', package_name: 'Ruby' }), 'unpaid');
  assert.equal(getAffiliateCustomerState({ payment_status: 'paid', package_name: 'Ruby' }), 'paid');
  assert.equal(getAffiliateCustomerState({ payment_status: 'trial', package_name: 'Diamond' }), 'trial');
  assert.equal(getAffiliateCustomerState({ payment_status: 'active', package_name: 'Ruby' }), 'unpaid');
});
test('subscription counts and trial categories never double count', () => {
  const result = getAffiliateDashboardSummary([
    {payment_status:'paid',package_name:'Ruby'},
    {payment_status:'completed',package_name:'Diamond'},
    {payment_status:'paid',package_name:'Tanzanite'},
    {payment_status:'trial',package_name:'Diamond'},
    {payment_status:'unpaid',package_name:'Ruby'},
  ]);
  assert.deepEqual(result,{total:5,paid:3,unpaid:1,trial:1,ruby:1,diamond:1,tanzanite:1});
});
test('expired trial is counted unpaid', () => {
  const summary = getAffiliateDashboardSummary([{payment_status:'trial',subscription_end_date:'2020-01-01'}],new Date('2026-11-08'));
  assert.equal(summary.unpaid,1);
  assert.equal(summary.trial,0);
});
