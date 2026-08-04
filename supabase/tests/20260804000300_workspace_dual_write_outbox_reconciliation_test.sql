begin;

select plan(9);

select has_table('public', 'workspace_normalization_outbox');
select col_is_pk('public', 'workspace_normalization_outbox', 'tenant_id');
select has_index('public', 'workspace_normalization_outbox', 'workspace_normalization_outbox_ready_idx');
select has_function('private', 'safe_numeric', array['text']);
select has_function('private', 'queue_workspace_normalization', array[]::text[]);
select has_function('public', 'reconcile_workspace_normalization', array['uuid', 'uuid']);
select has_trigger('public', 'tenant_workspaces', 'queue_workspace_normalization_after_write');

select is(
  (select count(*)::bigint from public.workspace_normalization_outbox),
  0::bigint,
  'No tenant is enrolled by schema setup'
);

select is(
  (select count(*)::bigint from public.workspace_migration_state where dual_write_enabled),
  0::bigint,
  'Dual-write remains disabled for every tenant'
);

select * from finish();

rollback;
