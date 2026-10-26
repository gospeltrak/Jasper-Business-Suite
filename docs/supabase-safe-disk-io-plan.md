# Supabase Disk I/O: zero-deletion remediation plan

**Status:** Read-only audit completed 2026-10-26. No user data has been deleted, overwritten, moved, or archived.

## What was measured
- Project was `ACTIVE_HEALTHY` when checked. Disk I/O Budget was reported as depleting by Supabase.
- Database approximately 816 MB, with `public.tenant_data` approximately 751 MB, mostly TOAST payloads.
- One tenant had 6,698 historical `data_backup_%` rows (~570.5 MB of JSON payload) and 33 `workspace_backup_%` rows (~16.9 MB). Most were created July–August 2026.
- `pg_stat_database.temp_bytes` was approximately 61 GB **cumulative**, not current permanent disk consumption.
- Query statistics implicated `route_current_branch_business_data` (~2.9 seconds average for 300+ samples), workspace hydration, and normalized writes. These statistics are cumulative and workload dependent.
- There is an existing `private.protect_legacy_tenant_data_backup` trigger to protect legacy backups. Its protection MUST remain in place.
- `src/shared/utils/dbSync.ts` now writes rolling `data_backup_latest_*` keys, and no burst of new historical backups was seen in the past week.

## Absolute safety boundaries
1. **Never DELETE, TRUNCATE, DROP, REWRITE, VACUUM FULL, purge, restore, or overwrite user or backup data as part of this audit.**
2. Do not touch `auth.users`, `public.users`, tenant memberships, staff roles, current `public.tenant_workspaces`, `sales`, `sale_items`, `products`, `branch_stock`, `purchases`, `expenses`, treasury, invoices or tombstones.
3. Keep tenant data strictly isolated; never mix keys, exports or restores across tenants.
4. Record live row counts, hashes and newest timestamps of **current** data separately from archived snapshots before any future archival proposal.
5. Ensure there is a tested, independently retrievable database recovery point and verified encrypted off-database archive before even proposing a backup retention policy.
6. Deleting even old `data_backup_%` rows requires **new explicit owner approval**, after an externally stored per-tenant archive with hashes, restore drill and a documented retention policy. This project does not contain or authorize any such deletion.
7. Archive manifests must avoid private account details and must contain tenant, key, stored bytes, checksum, archive object ID, verification time and restoration procedure.
8. Do not weaken RLS, tenant guards, branch access or staff permissions for faster reads.

## Performance work (non-destructive)
1. Capture one baseline using `scripts/sql/supabase_io_audit_readonly.sql` and Supabase Observability's Disk IO balance (check daily graph and hourly peaks).
2. Profile read-only explain plans and `pg_stat_statements` for the dominant RPCs; identify where `get_current_branch_workspace` hydrates entire normalized collections and spills sorts to temp disk.
3. Change **read-only query paths** in a separate reviewed, regression-tested branch to request only necessary collections. Preserve legacy `__all__` semantics and cross-tenant isolation.
4. Benchmark staging or rollback-only queries with representative historical data. Use compare-before/after temp blocks, p95 latency, correctness checks and resource usage.
5. Keep memory and compute sizing in view: optimizations may still require more RAM or I/O baseline as user volume increases; do not purchase/upgrade without owner agreement.

Useful reference: https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io
