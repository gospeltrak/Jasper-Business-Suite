begin;

select plan(4);

select has_table('private', 'demo_cleanup_batches');
select has_table('private', 'demo_cleanup_archive');
select has_index('private', 'demo_cleanup_archive', 'demo_cleanup_archive_batch_table_idx');
select col_is_pk('private', 'demo_cleanup_batches', 'id');

select * from finish();

rollback;
