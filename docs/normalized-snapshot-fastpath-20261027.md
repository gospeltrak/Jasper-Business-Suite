# Normalized snapshot performance — guarded staging candidate (2026-10-27)

**Release status: unexecuted SQL candidate in draft PR #21; production database unchanged.**

## Verified cause and scope

Production `private.normalized_mutation_snapshot(uuid,text[])` calls
`private.normalized_business_snapshot(...)` and then
`public.get_current_branch_workspace()`, whose own first statement
calls `private.normalized_business_snapshot(...)` **again**. For each
business collection, that snapshot rebuilds an ordered `jsonb_agg(source_record
ORDER BY source_ordinal,id)`. The full `save_current_branch_workspace`
operation can do yet more snapshot work in `private.persist_normalized_business_snapshot`
and before returning the full updated workspace.

The current `public.get_current_branch_workspace()` function returns the
unmodified normalized snapshot when `activeScope = 'all_branches'` and
`canViewAllBranches = true`. Only under that *same authenticated tenant*
scope can the second aggregation be skipped without changing return payloads.
Do not shortcut branch, `compatibility_primary`, no-branch-access, staff, or
unsupported-key operations.

New candidate:
- `scripts/sql/candidate_avoid_duplicate_normalized_admin_snapshot.sql`
- `scripts/sql/rollback_duplicate_normalized_admin_snapshot.sql`
- `src/shared/utils/normalizedSnapshotFastPath.test.ts`

The candidate verifies the current production source-definition hash
`79fa2d46e0a22da25bdb99b8bfe89de1` prior to applying. Any unreviewed
SQL edits since the audit abort the deployment rather than overwriting them.
The existing SECURITY DEFINER/search_path, tenant/auth checks, supported-key
guard and original scoped-branch permission-checking path remain in place.
**These are operator SQL scripts, not migrations that can be auto-applied.**

## Staging validation gate (mandatory before live rollout)

1. Restore a representative encrypted production backup to isolated staging
   with tenant privileges, staff, branch selection and settings intact.
2. Record `md5(pg_get_functiondef('private.normalized_mutation_snapshot(uuid,text[])'::regprocedure))`
   and verify that it exactly matches the audited hash, then apply the
   candidate **to staging only** in a single guarded transaction.
3. With an authenticated tenant Admin on **All Branches**, capture full
   `normalized_mutation_snapshot` JSON hashes, key arrays, counts and
   financial/stock totals **before and after** under identical frozen tenant
   data. Compare exact JSONB equality rather than merely matching row counts.
4. Repeat with compatibility-primary and explicit branch selection, branch
   staff without all-branch privileges, unsupported keys, empty keys, expired
   subscriptions and no-access. Confirm the legacy access-denial behavior.
5. Exercise save and reload for products (fractional/pharmacy/batches),
   sale + partial payment, purchase installments, expenses with receipt images,
   inventory transfers, branch switching and setting saves. Check **no
   overwritten tenant, legacy, tombstone or backup records**.
6. Compare per-RPC p50/p95 and **delta** `pg_stat_statements.temp_blks_written`
   across comparable workloads before/after; cumulative counters are not
   a measure of today's usage. Reject the candidate if there is no material
   measured benefit or if any response/permission differs.
7. Prove the rollback script restores the old function. Require separate
   production backup/PITR restore verification and owner review before
   creating an additive deployment migration. Do **not** run the candidate
   directly in production from this draft PR.

## Additional large binary field discovered

Read-only inspection of the 103 normalized `expenses` rows found **two**
`source_record.receiptImage` values still embedded as `data:` images,
totaling approximately **3,365 kB** of out-of-line JSON field data (largest
single value approximately 1,759 kB). This may contribute to full-snapshot
serialization and temp spills. **These are payment evidence, not product
thumbnails**: never compress to 10 KB, redact, delete, or move them to
the public `tenant-logos` bucket.

A separate, additive privacy-safe migration is required:
- Private, tenant-isolated Storage bucket with authenticated read/insert,
  no public URLs and no cross-tenant access.
- Exact-original-byte upload, hash-after-download verification, and a
  temporary preservation of original `source_record` until fully restored.
- Narrow, race-safe compare-and-swap DB update after an independent backup;
  prove receipt visibility, downloads, reports, audit history and staff roles.
- Migrate only after stable new-upload flow and a tenant-by-tenant staging
  verification. No receipt migration has been executed.

## Existing disk reality

`tenant_data` uses ~751 MB physical relation storage, mostly TOAST,
including 6,937 protected historical `data_backup_%` and 33 historical
`workspace_backup_%` rows. They were neither archived nor deleted.
Current `work_mem` was 2,184 kB and cumulative temp I/O from
`pg_stat_database` was approximately 92 GB. These are diagnostics,
not proof that raising `work_mem` or deleting backups is safe.

Source: live read-only Supabase SQL audit, 2026-10-27.
