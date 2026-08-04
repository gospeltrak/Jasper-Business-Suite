begin;

select plan(6);

select has_table('public', 'tenant_data_archive_snapshots');
select has_index('public', 'tenant_data_archive_snapshots', 'tenant_data_archive_snapshots_tenant_time_idx');
select has_function('private', 'bound_tenant_data_backup_key', array[]::text[]);
select has_function('private', 'protect_legacy_tenant_data_backup', array[]::text[]);
select has_trigger('public', 'tenant_data', 'bound_tenant_data_backup_key_before_insert');
select has_trigger('public', 'tenant_data', 'protect_legacy_tenant_data_backup_before_change');

select * from finish();

rollback;
