# Disk I/O optimization result — 2026-10-26

This is an **additive, non-destructive** production-index improvement.
No data archiving, deletion, restoration, data rewrite or tenant migration happened.

## Method
Measured exactly the **read-only nonbusiness key aggregation subquery** from
`public.route_current_branch_business_data` for the Lim Cleaners tenant using
`EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)`, first before and then after the index.

| Metric | Before | After |
|---|---:|---:|
| Execution time (one measured sample) | 778.195 ms | 88.325 ms |
| Index used | `tenant_data_tenant_idx` | `tenant_data_active_keys_io_idx` |
| Rows removed by index/filter | 6,741 | 10 |
| Rows returned by scan | 16 | 16 |
| Shared read buffers | 159 | 2 |
| Added index size | — | 32 kB |

One-shot benchmarks vary with disk/cache/load; the ~89% faster number is for this
**subquery only**, not an end-to-end app speed guarantee. Normalized workspace
RPCs and other sorts remain optimization targets.

## Business-data integrity verification
- Original and new read-result `md5(jsonb_object_agg(data_key,payload)::text)`
  are both `54f5dc8221925c1041f777fce28c0312`.
- Before/after backup counts: `data_backup_%` 6,698; `workspace_backup_%` 33.
- The new index is limited to non-backup tenant keys.
- No `DELETE`, `UPDATE`, `TRUNCATE`, `DROP`, `VACUUM FULL` or
  `ALTER TABLE` was executed; all user and backup payloads remain unchanged.
- RLS policies, staff roles, branch membership and accounting RPCs unchanged.

## Follow-up (separate review)
Investigate the remaining `get_current_branch_workspace`,
`save_current_branch_workspace`, normalized `jsonb_agg`, POS, Products and
Purchases operations using independent benchmark + staging tests. Do not change
the composition/ordering of financial arrays without proving equal results,
and do not delete historical backups without external archive/restore
verification and renewed user approval.
