begin;

select plan(24);

select has_table('public', 'workspace_migration_batches');
select has_table('public', 'workspace_migration_state');
select has_table('public', 'workspace_reconciliation_runs');

select col_is_pk('public', 'workspace_migration_state', 'tenant_id');
select has_column('public', 'workspace_migration_state', 'read_mode');
select has_column('public', 'workspace_migration_state', 'dual_write_enabled');
select has_column('public', 'workspace_migration_state', 'backfill_cursor');
select has_column('public', 'workspace_migration_state', 'source_counts');
select has_column('public', 'workspace_migration_state', 'target_counts');

select has_column('public', 'products', 'legacy_id');
select has_column('public', 'sales', 'legacy_id');
select has_column('public', 'sale_items', 'tenant_id');
select has_column('public', 'expenses', 'legacy_id');
select has_column('public', 'deliveries', 'branch_id');
select has_column('public', 'deliveries', 'legacy_id');
select has_column('public', 'purchases', 'legacy_id');
select has_column('public', 'purchase_items', 'tenant_id');

select has_index('public', 'products', 'products_tenant_legacy_id_uidx');
select has_index('public', 'sales', 'sales_tenant_branch_time_idx');
select has_index('public', 'sale_items', 'sale_items_tenant_sale_idx');
select has_index('public', 'expenses', 'expenses_tenant_branch_time_idx');
select has_index('public', 'deliveries', 'deliveries_tenant_status_time_idx');
select has_index('public', 'purchases', 'purchases_tenant_branch_time_idx');
select has_index('public', 'purchase_items', 'purchase_items_tenant_purchase_idx');

select * from finish();

rollback;
