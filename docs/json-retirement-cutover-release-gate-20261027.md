# Orvix — JSON retirement cutover and release gate (2026-10-27)

**Status: Implementation preparation / no live database migration.** 
The staged SQL files are candidates, not an executed or tested database release.
All 9 workspaces, 6,937 `data_backup_%` rows and 33
`workspace_backup_%` rows are protected. Do not remove their source or
drop `products.source_record`.

## Confirmed baseline (read-only production, 2026-10-27)

| Area | Active legacy source records | Typed target at checkpoint |
|---|---:|---:|
| Inventory settings | 279 | 0 |
| Inventory batches | 33 | 0 |
| Retail package levels | 142 | target table not created in production |
| Retail selling units | 233 | target table not created in production |
| Pharmacy unit levels | 127 | target table not created in production |
| Explicit fraction options | 12 | 0 |
| Pharmacy unit breakdowns | 4 | 0 |
| Inline expense receipt evidence | 2 | preserved inside expense source_record |
| Sale paymentBreakdown fields | 281 | parity to normalized payment entries not verified |
| Historical data backups | 6,937 | protected |
| Historical workspace backups | 33 | protected |

The source product inventory settings use historical `weighted_average` for
**120 active products**. Normalize to typed `average_price` only in the typed
representation and runtime costing calculation. Preserve source text.
A batch stores a **15-decimal precision** price-change percentage; typed
migration widens `price_change_percentage` to unrestricted NUMERIC.
Do not silently round finance, FIFO, weighted average, stock, quantity
conversions or batch histories.

## Scripts (operator execution on isolated, restored staging only)

1. `scripts/sql/read_only_json_retirement_release_gate.sql` (read-only
   aggregate production/staging baseline; expect `safe_to_drop_source_record_now=false`).
2. `scripts/sql/read_only_product_inventory_preflight.sql` and
   `scripts/sql/read_only_inventory_normalization_coverage.sql` (read-only).
3. Independent off-project, encrypted database + Storage backup.
   Verify a **restore** to an isolated staging database, not just a backup
   file's existence, before testing changes.
4. On **staging only**, open one verified SQL session and set:
   `SET app.orvix_inventory_backfill_permission = 'STAGING_ONLY_RESTORE_TESTED';`
5. `scripts/sql/staging_backfill_product_inventory_settings.sql` — INSERT-only,
   idempotent typed settings shadow, exact field parity.
6. `scripts/sql/staging_extend_and_backfill_inventory_details.sql` —
   nullable typed package prices, fraction options and pharmacy breakdowns.
7. `scripts/sql/staging_backfill_historical_inventory_batches.sql` —
   batch identity, quantity base units, destination, FEFO date slots, exact
   costing history; original product batches never edited.
8. `scripts/sql/staging_backfill_universal_product_units.sql` —
   tenant-RLS-protected package levels, selling units and medicine levels.
9. Rerun read-only checks; verify tenant-by-tenant **JSONB field equality and
   numeric sums**, original ID/order, product stock, branch stocks,
   sale/purchase payment allocations and historical receipts.
10. Run authenticated tests for tenant admin, restricted staff and
    cross-tenant denial; test sale/return/restock/transfer, fractional
    purchases, pharmacy lot/FEFO, cross-branch scenarios and two concurrent
    offline edit recoveries. Reject any difference.
11. Implement and verify **same-transaction writes** to typed tables for
    every product save and offline reconciliation. Existing
    `private.persist_normalized_business_snapshot` must remain the trusted
    entrypoint until that transition is complete.
12. Implement **feature-flagged typed reads** with an exact-result comparison
    and rollback switch. Do not switch a tenant who has any unmapped
    fields or unreconciled async writes.
13. Move private expense receipt binaries to strict per-tenant private
    Supabase Storage without lossy resizing, verify original bytes after
    download. Do not put payment evidence in a public image/logo bucket.
14. Normalize remaining product top-level properties, sale paymentBreakdown,
    purchases, settings and any branch/tenant legacy settings. Verify each
    typed business API against the current legacy response shape.
15. Only once all steps pass and an offsite **restore** works, seek explicit
    owner approval for retiring obsolete data. No automatic SQL deletion,
    pruning of protected backups, DROP of business tables or force rewrite
    of live source JSON.

## Security boundaries

Existing `jasper_*` tables enforce/force tenant RLS.
The proposed three new `orvix_product_*` tables start with RLS enabled
and forced, revoke all public/anon permissions and grant authenticated
SELECT restricted to `tenant_id=private.current_tenant_id()`. No
open write grants. Stop on pre-existing policies instead of overriding.

Staging approval marker is only a *human release gate*, not a cryptographic
proof of environment identity. Operators must confirm the actual project
reference and verified staging restore before **every** manual SQL run.
The marker should never be set in live production.

## Why release is still blocked

There is no Supabase staging branch at the verified checkpoint.
Creating a branch may create additional billed compute; do not spend without
explicit approval. Code contracts and GitHub CI cannot replace an authenticated
PostgreSQL execution against restored staging. No production SQL schema
migration or cutover has occurred. All new scripts remain in a **draft PR**.

The repository currently has no implemented transactional typed read/write
cutover for all these new child tables and still needs mapping of 281
legacy sale-payment breakdowns and two payment receipt binaries. Therefore
the system is **not** yet completely free of business JSON blobs. The
next *execution* action is restore-tested staging, **not** deleting data.

## Stage 3: credit-sale paymentBreakdown (2026-10-27)

**Production read-only audit (verified):** 284 active sales, 281 active
`paymentBreakdown` arrays, **291 typed-eligible entries**. Exactly 4 active
sales contain an explicit empty array and 3 have no field at all. One
historical entry is a valid zero-amount payment and 2 entries explicitly
include a `reference` property. These are *not* equivalent states and
must not be normalized by blindly replacing missing fields with `[]` or
filtering out zero amounts.

Added:
- `scripts/sql/staging_backfill_sales_payment_breakdowns.sql`:
  two new parent/child typed tables, authenticated tenant-isolated RLS,
  stage-only permission marker, exact JSON round-trip, original-reference
  presence, line ordinal preservation and idempotent no-overwrite INSERT.
  It **never posts a treasury journal or changes the amount of a sale**.
- `scripts/sql/ci_sales_payment_synthetic_fixture.sql` and
  `scripts/sql/ci_sales_payment_synthetic_assertions.sql`: actual
  PostgreSQL 17 SQL execution, cross-tenant read isolation, zero amount,
  missing/empty field, explicit null reference and original source hashes.
- `scripts/sql/read_only_sales_payment_breakdown_coverage.sql`: repeatable
  read-only production baseline. Returns no tenant, sale or payment reference
  details. Live audit confirmed neither typed table exists in production.

**CI #752: success** (frontend tests/build and synthetic PostgreSQL 17
execution). That is not a restore-tested copy of real tenant data.

**Before a production cutover:** validate this SQL on independently restored
staging; integrate transactional writes for each saved normalized sale and
payment replay; prove exact typed-vs-legacy parity on real tenants; verify
cashier/branch permissions, payment audit evidence and cross-branch isolation.
The staging shadow tables remain disconnected from the live payment flow.
**No live sales, treasury journals, payments or backup rows changed.**
