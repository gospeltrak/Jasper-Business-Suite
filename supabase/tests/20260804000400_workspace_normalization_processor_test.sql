begin;

select plan(14);

select has_function('private', 'safe_uuid', array['text']);
select has_function('private', 'safe_timestamptz', array['text']);
select has_function('private', 'safe_boolean', array['text']);
select has_function('private', 'safe_integer', array['text']);
select has_function('public', 'normalize_workspace_snapshot', array['uuid', 'timestamp with time zone']);
select has_column('public', 'products', 'source_record');
select has_column('public', 'sales', 'source_record');
select has_column('public', 'sale_items', 'source_record');
select has_column('public', 'expenses', 'source_record');
select has_column('public', 'deliveries', 'source_record');
select has_column('public', 'purchases', 'source_record');
select has_column('public', 'purchase_items', 'source_record');

select is(private.safe_uuid('not-a-uuid'), null::uuid, 'Invalid UUIDs are not coerced');
select is(private.safe_numeric('not-a-number'), 0::numeric, 'Invalid numeric values are retained in source_record and map to zero');

select * from finish();

rollback;
