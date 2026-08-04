begin;

select plan(9);

select has_column('public', 'products', 'source_ordinal');
select has_column('public', 'sales', 'source_ordinal');
select has_column('public', 'sale_items', 'source_ordinal');
select has_column('public', 'expenses', 'source_ordinal');
select has_column('public', 'deliveries', 'source_ordinal');
select has_column('public', 'purchases', 'source_ordinal');
select has_column('public', 'purchase_items', 'source_ordinal');
select has_function('public', 'refresh_workspace_source_ordinals', array['uuid']);
select has_function('public', 'validate_workspace_shadow_content', array['uuid']);

select * from finish();

rollback;
