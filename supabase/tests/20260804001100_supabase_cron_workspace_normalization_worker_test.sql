begin;

select plan(15);

select has_extension('pg_cron', 'pg_cron is enabled');
select has_function('private', 'process_workspace_normalization_queue', array['integer'], 'private queue worker exists');
select function_returns('private', 'process_workspace_normalization_queue', array['integer'], 'jsonb', 'worker returns a safe summary');
select function_privs_are(
  'private', 'process_workspace_normalization_queue', array['integer'], 'anon', array[]::text[],
  'anon cannot execute the worker'
);
select function_privs_are(
  'private', 'process_workspace_normalization_queue', array['integer'], 'authenticated', array[]::text[],
  'authenticated users cannot execute the worker'
);
select function_privs_are(
  'private', 'process_workspace_normalization_queue', array['integer'], 'service_role', array[]::text[],
  'service role cannot bypass the internal scheduler boundary'
);
select ok(
  exists(select 1 from cron.job where jobname = 'workspace-normalization-worker-v1' and active),
  'normalization cron job is active'
);
select is(
  (select schedule from cron.job where jobname = 'workspace-normalization-worker-v1'),
  '*/5 * * * *',
  'normalization cron runs every five minutes'
);
select is(
  (private.process_workspace_normalization_queue(5) ->> 'processed')::integer,
  0,
  'worker is idle while no dual-write tenant has a ready job'
);
select throws_ok(
  $$select private.process_workspace_normalization_queue(0)$$,
  '22023',
  'Queue batch limit must be between 1 and 25.',
  'zero batch size is rejected'
);
select throws_ok(
  $$select private.process_workspace_normalization_queue(26)$$,
  '22023',
  'Queue batch limit must be between 1 and 25.',
  'oversized batch is rejected'
);
select ok(
  pg_get_functiondef('private.process_workspace_normalization_queue(integer)'::regprocedure) like '%for update of outbox skip locked%',
  'worker claims jobs with skip-locked concurrency control'
);
select ok(
  pg_get_functiondef('private.process_workspace_normalization_queue(integer)'::regprocedure) like '%state.dual_write_enabled%',
  'worker only processes explicitly enabled tenants'
);
select ok(
  pg_get_functiondef('private.process_workspace_normalization_queue(integer)'::regprocedure) like '%validate_workspace_shadow_content%',
  'worker performs exact workspace content validation'
);
select ok(
  pg_get_functiondef('private.process_workspace_normalization_queue(integer)'::regprocedure) like '%validate_branch_stock_shadow%',
  'worker validates branch stock before marking success'
);

select * from finish();
rollback;
