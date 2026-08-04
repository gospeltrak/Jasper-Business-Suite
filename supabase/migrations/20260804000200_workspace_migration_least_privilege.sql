-- Supabase project default privileges grant service_role full access to newly
-- created public tables. Narrow the migration control plane to its contract.

begin;

revoke all on table public.workspace_migration_batches from service_role;
revoke all on table public.workspace_migration_state from service_role;
revoke all on table public.workspace_reconciliation_runs from service_role;

grant select, insert, update
  on table public.workspace_migration_batches
  to service_role;
grant select, insert, update
  on table public.workspace_migration_state
  to service_role;
grant select, insert
  on table public.workspace_reconciliation_runs
  to service_role;

commit;
