# Workspace normalization migration contract

## Non-negotiable invariants

1. `tenant_workspaces` and `tenant_data` remain unchanged during schema setup.
2. A tenant stays on legacy reads until its own reconciliation is an exact match.
3. Dual-write and read cutover are controlled per tenant and default to off.
4. Every backfill is idempotent and resumable.
5. Legacy identifiers are stored in `legacy_id`; they are never coerced into UUIDs.
6. Existing tenant, branch, user, subscription, payment, affiliate and partner IDs
   are never regenerated.
7. Row counts and financial totals must match before a tenant can enter
   `shadow_read` or `normalized`.
8. Rollback changes only `read_mode` to `legacy` and disables dual-write. It does
   not delete normalized or legacy records.

## Protected production identities

The cleanup phase must use immutable IDs, not display names or phone matching.

| Type | ID | Display |
| --- | --- | --- |
| Tenant | `64ba3572-b61f-4142-826c-e6fa48eab169` | Lim cleaners |
| Tenant | `7395ceb5-6132-4a93-a01e-79c78bba7c13` | Tunde Inv |
| Affiliate user | `714347e0-2fa6-4f90-bd25-00d52fd1d171` | Evancia Mkunywa |
| Affiliate user | `7a729321-308d-4694-b9ec-2e1a065ded45` | Mark Dasa |
| Partner user | `89a92c31-fbd4-4bac-801f-f54a4fdda848` | Magreth Kenneth |
| Super admin user | `b5895ae1-e40b-49f8-9fbc-21de3421e710` | Jasper Super Admin / 0700000101 |

All users and staff attached to either protected tenant are protected
transitively.

## Source-to-target mapping

| Legacy workspace key | Normalized target | Reconciliation |
| --- | --- | --- |
| `products` | `products`, `branch_stock` | count, stock quantity, inventory value |
| `sales` | `sales`, `sale_items` | count, total, tax, discount, paid, due |
| `expenses` | `expenses` | count, amount |
| `deliveries` | `deliveries`, `delivery_riders` | count, total, delivery cost, status counts |
| `purchases` | `purchases`, `purchase_items` | count, total, paid, due |
| `branches` | `branches` | count and immutable IDs |
| `branchStocks` | `branch_stock` | count and quantity by branch/product |
| `branchStaffAssignments` | `branch_staff_assignments` | count and assignment identity |
| `settings` | authoritative tenant/branch settings | canonical JSON hash and selected fields |

## Backfill rules

- Read one tenant workspace at a time.
- Capture `tenant_workspaces.updated_at` and a canonical payload hash at batch
  start.
- Process bounded record batches and persist a cursor after each committed
  batch.
- Upsert by `(tenant_id, legacy_id)`.
- If the source workspace timestamp changes during a batch, stop and retry from
  the last durable cursor.
- Never use a whole-table delete followed by insert.
- Never backfill backup keys from `tenant_data`.
- Record conversion failures without dropping the source record.

## Cutover gates

A tenant can progress only when:

1. source and target record counts match;
2. financial totals match at exact database numeric precision;
3. stock totals match per branch and product;
4. every target row has the correct `tenant_id`;
5. every branch-scoped target belongs to the same tenant;
6. RLS tests pass for owner, staff, other tenant and anonymous sessions;
7. shadow reads produce the same application result;
8. the rollback flag has been exercised successfully.

## Capacity posture

- Runtime reads must use `(tenant_id, branch_id, time/id)` composite indexes.
- Large lists must use keyset pagination.
- Realtime must subscribe to narrow normalized tables and tenant/branch filters,
  not the full workspace JSON row.
- Receipts and product images stay in Storage; database rows store references.
- Long-running migration, reporting and export work belongs in background jobs.
- Connection pooling is mandatory in serverless production.

## Destructive cleanup gate

Demo deletion and legacy backup pruning are separate from normalization. They
require a fresh pre-delete backup or PITR and an owner-approved immutable-ID
manifest. A successful normalization is not authorization to delete anything.

## Phase 9 certification notes

- Tenant/branch relationship checks returned zero mismatches for branch stock,
  sale items, purchase items and delivery-to-sale ownership.
- All normalized business tables have forced RLS with active policies.
- The demo cleanup restore archive is private: `anon` and `authenticated`
  cannot read it; `service_role` can.
- Lim cleaners has 238 migration-managed products plus 68 older, legitimate
  normalized products created before this migration. The older rows have no
  name, SKU or barcode overlap with the migration batch and must not be deleted.
- Tunde Inv retains 20 migration-managed Pharmacy products.
- The primary sales query uses `sales_tenant_time_idx`, has no temporary disk
  I/O, and completed in approximately 8 ms against the current production data.
- Rendered Vite/Vitest QA could not start inside the Codex filesystem sandbox
  because esbuild was denied access while resolving pnpm-linked config paths.
  TypeScript and all non-Vite contract tests passed.

## 2026-10-24 normalized read cutover

All nine existing tenant workspaces passed per-tenant reconciliation and were
activated for normalized reads: Lim cleaners, Tunde Inv, Orvix Pharmacy,
Loyal phamacy, J.m phamacy, Jasper Company Ltd, D.s phamacy, Fg phamacy and Orvix Shop.

The normalization processor now tracks `source_active` on migration-managed
products, sales/items, expenses, deliveries, purchases/items and branch stock.
Rows absent from the current workspace become inactive; their internal IDs,
legacy IDs and historical source records remain intact. Restoring the source
reactivates the same rows. Native rows with a null legacy ID are preserved.
Normalized runtime reads and reconciliation totals include active source rows.

Reconciliation now records the exact source payload hash, which is required by
the normalized-read readiness gate. Both normalization workers handle normalized
tenants, synchronize branch stock and retain normalized mode after validation.

Verification performed:

- All nine tenants: counts, exact numeric financial totals, full source content
  and branch stock matched; readiness was true and all queue entries completed.
- Twelve active owner/staff identities: normalized branch payloads matched legacy
  branch payloads; 48 ledger pagination checks passed with seven-row pages.
- Owner/staff cross-tenant RLS checks passed for all eight normalized tables.
- Removal/restoration retained record IDs; repeated normalization was idempotent.
- Rollback and reactivation were exercised for every tenant inside a rolled-back
  transaction; future writes correctly gated reads until the queue reconciled.
- Purchase installment/treasury regression checks passed after cutover.
- Source workspace hashes/timestamps, treasury balances/journals and all 68 native
  Lim cleaners products were unchanged by the cutover.

This is a normalized **read** cutover. Existing atomic business RPCs continue to
write the authoritative workspace and queue normalized synchronization. JSON
remains available for dual-write compatibility and safe rollback; this rollout
does not remove it or authorize legacy cleanup. Newly registered tenants still
require their own verified migration.


## Direct normalized business writes

The direct-write rollout supersedes the read-only transition above. Per-tenant
`normalized_writes_enabled` gates the source of truth. It defaults to false;
operators enable it only after normalized-read reconciliation and deployment QA.

For enabled tenants, existing product, sales, expense, delivery, purchase,
offline-sync and installment RPCs load normalized rows and write their typed
columns and item relations directly in the same database transaction. Individual
`source_record` values retain extended fields for the existing API representation;
there is no persisted tenant-wide business array. Pending delivery notes have
their own tenant/branch-scoped table. Existing supplier, rider, branch, staff and
treasury tables retain their established write paths.

`tenant_workspaces` retains configuration and a revision timestamp for Realtime.
Products, invoices, purchases, expenses, deliveries, stock and pending-note arrays
are removed from its live payload. Realtime clients treat changes as invalidation
events and reload the authorized branch. Legacy business-key helpers route through
the same normalized RPCs; a failed RPC does not fall back to an old JSON write.

Direct-write tenants do not enqueue normalization work, and both workers exclude
them. Legacy backfill functions reject attempts to overwrite their newer records.
Business saves therefore become readable immediately without waiting for Cron.

Deletion requires an explicit tombstone. Archived rows retain their IDs and audit
data; a missing record in a background snapshot does not delete it. New deletion
intents are branch-scoped, and associated treasury reversals commit with deletion.
Installment-bearing purchases remain protected. Sale deletion also closes linked
dispatch records; product deltas in offline sync update the active branch stock.

The privileged cutover function stores the original snapshot and hash in
`private.normalized_write_cutover_archives`. This archive is unavailable to app
users. Rollback rebuilds the **latest** workspace from normalized rows before
returning to legacy writes, including transactions created after cutover.
Configuration JSON and per-row extensible metadata are not business workspace
blobs and remain supported.

New empty tenants start with direct writes after the global rollout gate is
enabled. Non-empty imports require the same verified migration gates.

Validation includes real SQL roundtrips (rolled back), multi-account/external
installments, retries, treasury reversal, stock and item foreign keys, offline
idempotency, stale snapshot protection, authorized branch reloads and all-tenant
pagination. The SQL checks live in `supabase/tests/normalized_business_write_*.sql`.

Operator status query:

```sql
select tenant_id, read_mode, normalized_writes_enabled,
       normalized_writes_activated_at
from public.workspace_migration_state;
```

No legacy backups or historical normalized rows are deleted by this rollout.

