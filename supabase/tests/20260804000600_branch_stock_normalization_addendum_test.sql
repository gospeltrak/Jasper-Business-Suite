begin;

select plan(7);

select has_column('public', 'branch_stock', 'legacy_id');
select has_column('public', 'branch_stock', 'source_record');
select has_column('public', 'branch_stock', 'source_ordinal');
select has_column('public', 'branch_stock', 'migration_batch_id');
select has_index('public', 'branch_stock', 'branch_stock_tenant_legacy_id_uidx');
select has_function('public', 'normalize_branch_stock_snapshot', array['uuid', 'timestamp with time zone']);
select has_function('public', 'validate_branch_stock_shadow', array['uuid']);

select * from finish();

rollback;
