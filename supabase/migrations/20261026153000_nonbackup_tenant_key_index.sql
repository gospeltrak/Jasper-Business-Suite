-- ADDITIVE PERFORMANCE ONLY: no data changes, no deletion, no RLS changes.
-- The legacy business-data RPC reads nonbackup keys from tenant_data.
-- Without this index, each bootstrap for an old tenant scans >6,700 backup
-- index entries just to return ~16 active legacy/configuration records.
-- Predicate matches the existing route_current_branch_business_data filter.
--
-- All existing data_backup_%, workspace_backup_% (and every other row)
-- remain stored, accessible for recovery, and protected by existing triggers.
-- A lightweight index is created over ordinary keys, not their JSON payload.
create index if not exists tenant_data_active_keys_io_idx
  on public.tenant_data (tenant_id, data_key)
  where data_key not like 'data_backup_%'
    and data_key not like 'workspace_backup_%';
