begin;

select plan(14);

select has_index('public', 'user_sessions', 'user_sessions_activity_idx');
select has_index('public', 'user_sessions', 'user_sessions_online_activity_idx');
select has_index('public', 'affiliates', 'affiliates_created_at_idx');
select has_index('public', 'affiliate_partners', 'affiliate_partners_created_at_idx');
select has_index('public', 'affiliate_referrals', 'affiliate_referrals_created_at_idx');
select has_index('public', 'subscriber_source_tracking', 'subscriber_source_created_at_idx');
select has_index('public', 'referred_customers', 'referred_customers_created_at_idx');
select has_index('public', 'referred_customers', 'referred_customers_affiliate_created_idx');
select has_index('public', 'referred_customers', 'referred_customers_sub_affiliate_created_idx');
select has_index('public', 'referred_customers', 'referred_customers_partner_created_idx');
select has_index('public', 'referred_customers', 'referred_customers_promo_created_idx');
select has_index('public', 'commission_ledger', 'commission_ledger_affiliate_idx');
select has_index('public', 'commission_ledger', 'commission_ledger_sub_affiliate_idx');
select has_index('public', 'commission_ledger', 'commission_ledger_partner_idx');

select * from finish();
rollback;
