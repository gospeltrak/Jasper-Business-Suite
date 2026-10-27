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

## Stage 3b: same-transaction write mirroring proven on synthetic PostgreSQL

`scripts/sql/staging_mirror_sales_payment_breakdowns.sql` installs a
**staging-only** AFTER INSERT / UPDATE trigger on the normalized
`public.sales` relation. Within the sale transaction, the trigger uses
NEW's existing tenant ID and legacy sale ID (never a client-submitted
shadow tenant ID), validates the source payment lines, updates the typed
header/hash and upserts each current typed line. Superseded entries are
marked `is_current=false`, *not deleted*, and inactive/tombstoned sales
are marked in `source_active` while retaining source evidence. Public
authenticated roles cannot call the private SECURITY DEFINER function
or directly create/modify typed payment records.

`scripts/sql/ci_sales_payment_mirror_assertions.sql` tests real
PostgreSQL transactions for new sales, payment amount changes, shorter
arrays, absent vs empty arrays, tombstones, rejected invalid amounts,
original source integrity and unchanged protected backups. The PG17
synthetic integration job completed successfully on commit
`5f5c53cb48916aff8ea7cff52a27fd516d292659`.

**Important stage-only gates:** This does not imply that other legacy
writes bypassing public.sales are mirrored. All business write paths,
RPC and offline resync paths require proof of normalization and exact
side-by-side reads on a **restore-tested real-data staging clone**.
Never apply the trigger to production from this draft SQL; its
SECURITY DEFINER privileges, performance/lock overhead, transaction
rollback behavior and semantics of ALL legacy writers must first be
measured and reviewed. The existing customer JSON and ledgers remain
canonical until read cutover is proven safe.

## Stage 3c: lossless sale-payment audit and rollback (2026-10-27)

Earlier staging SQL allowed the same (tenant,sale,ordinal) typed line to be
updated, which would overwrite the only typed copy of its former amount.
This was corrected **before any production application**.

- `scripts/sql/staging_mirror_sales_payment_breakdowns.sql` now creates
  `orvix_sale_payment_line_history`, a tenant-RLS-protected, append-only
  relational audit of superseded line versions. The history INSERT happens
  in the same transaction (BEFORE UPDATE) as the typed payment edit.
- Existing ordinal and amount edits retain all prior values, including
  zero-amount entries, and shortening arrays marks removed ordinals
  `is_current=false` without a DELETE. Writes to unrelated customer/sale
  metadata no longer trigger financial mirror rewrites.
- `scripts/sql/ci_sales_payment_mirror_assertions.sql` now checks original
  values TSh 0, TSh 1,250.50 and TSh 540,000 remain in history after
  successive edits, with a separate row for each superseded version.
  Identical or non-payment edits must produce **zero** false audit changes.
  Tombstone history and strict cross-tenant SELECT isolation are tested.
- `scripts/sql/staging_disable_sales_payment_shadow_mirror.sql` provides
  guarded staging rollback, retaining all typed rows, audit records and
  protected backups; `ci_sales_payment_mirror_rollback_assertions.sql`
  verifies trigger removal and unchanged historical evidence.

**Real PostgreSQL 17 synthetic CI #765 passed both DB and frontend jobs.**
Staging operations only; there is no assurance of production transaction
compatibility until an isolated real-data restore verifies every writer.

## Stage 4: expense financial metadata in typed columns (2026-10-27)

Read-only live SQL found 92 active expenses, each with valid nonempty
`paidFromAccountId`, `paymentMethod`, and UUID `treasuryJournalId`
inside `source_record`. Existing normalized `expenses.amount`,
`expenses.receipt_ref` and `expenses.receipt_image` precisely match their
corresponding source fields in all active rows. Two expense receiptImage
values are still inline binary payment evidence.

- `scripts/sql/staging_normalize_expense_finance_fields.sql` adds three
  explicit fields to existing normalized `public.expenses`:
  `paid_from_account_id`, `payment_method_normalized`, and
  `treasury_journal_id`. It validates types, guards any pre-existing typed
  drift, fills active rows, and verifies exact parity.
- Staging trigger `private.orvix_sync_expense_typed_finance` runs as
  SECURITY INVOKER, derives only NEW's typed fields from previously
  authorized source fields in the same transaction, never modifies
  Money & Bank journals or customer receipt evidence. Inactive historical
  rows stay untouched.
- `ci_expense_finance_synthetic_fixture.sql` and
  `ci_expense_finance_synthetic_assertions.sql` prove actual PG17 handling
  of initial/imported expenses, new transaction, edited account,
  no-op metadata edit, invalid UUID rollback, receipt preservation,
  historical tombstones and unchanged protected backups.

**GitHub CI #769 passed** both synthetic database SQL execution and
frontend/build. No live Supabase schema changes were performed, so it is
still **not safe to drop source_record** or claim typed expenses are
authoritative. A verified private Storage receipt migration is required
before the two inline receipts can be removed without loss.

## Owner-approved final architecture: normalized tables as the ONLY live source of truth (2026-10-27)

The owner requires **complete retirement of operational JSON storage**, not
merely copying some business tables while retaining a second JSON-based
workspace state. This section is a **hard acceptance contract**, not a claim
that the migration is complete.

### Required live persistence architecture

- **Sales, sale items, debts, installments, tender splits, refunds, credit
  notes, purchase orders, purchases, procurement payments, stock movements,
  transfers, expenses, payments and money/bank journals:** typed relational
  PostgreSQL tables; foreign keys, numeric precision, tenant and branch keys,
  idempotency keys, indexes and restrictive RLS; all reads and writes use these
  authoritative rows.
- **Products and variations:** typed product catalog, costing methods, price
  lists, fractional selling, package hierarchies, inventory batches,
  pharmacy FEFO, expiry, units and conversions; stock and costing mutations
  must be atomic, replay-safe, branch-scoped, and never derived from a stale
  JSON snapshot.
- **Settings and roles:** explicit typed/domain tables for business settings,
  role/permission matrices, branches, subscription configuration, notification
  preferences, staff assignments and financial accounts. A key/value
  container holding JSON strings is an **interim compatibility bridge**, not
  the finished normalized design.
- **Documents and evidence:** typed documents, line items, payments,
  relationships, and audit trail; large signed receipts, scanned proofs,
  logos and images go to appropriately private, tenant-scoped Supabase Storage
  with **relational** attachment metadata (storage path, SHA-256/hash,
  media type, byte length, owner, tenant/branch, lifecycle). Original bytes
  are verified; no unsafe public bucket for customer financial evidence.
- **Offline/mobile:** SQLite/native local transactional tables and ordered
  idempotent operation queues on device; reconcile with versioned,
  normalized server tables without resurrecting tombstones or overwriting
  newer work. No opaque shared JSON workspace snapshot as a write source.
- **All pages and APIs:** after cutover must use normalized PostgreSQL
  rows for CREATE, READ, UPDATE and DELETE; no runtime reads/writes that
  source operational truth from `tenant_workspaces.payload`,
  `tenant_data.application_state`, `source_record`, giant
  `tenant_data` blobs, or reconstructed all-tenant JSON snapshots.
  JSON over the **network** is allowed as an API serialization format, but
  cannot be the authoritative database record. PostgreSQL JSON columns may
  remain only for demonstrably non-operational opaque metadata, and even
  those must be justified and audited if the owner's zero-JSON goal applies.

### Staged migration / release conditions

1. After a plan upgrade, create a **charged staging branch only with cost
   approval**, record its exact project reference and a deletion/stop-billing
   step. Restore **both Postgres and Storage**, verify the backup can be read,
   compare signed receipt bytes, validate all tenant and legacy/global scopes.
2. Maintain a **field-by-field matrix** of every production JSON key, its
   destination typed table/column, active writers/readers, type precision,
   branch and tenant permissions, and whether it contains data no longer
   used. Unknown keys block deletion.
3. Backfill tables incrementally with exact checksums, per-record parity,
   ledger amount and stock invariants, consistent snapshots, RLS checks,
   offline conflict/replay simulations and tested rollback for each module.
   History, documents, signatures and backup evidence remain immutable.
4. Introduce transactional compatibility synchronization only while
   migrating. At each tenant's safe cutover, switch all reads and writes
   **together** to normalized storage, with new writes never flowing back
   into an opaque JSON blob. Monitor errors and detect drift.
5. Prove all active application modules, staff roles, branches, web/PWA
   behavior and future native offline workflows execute on typed tables.
   Test real user scenarios (sale, partial debt payment, supplier invoice,
   expense, refund, stock adjustment, transfer, expiry and fractional unit
   sale) and verify equal balances and tenant isolation.
6. Disable legacy code paths and remove JSON dependencies before declaring
   success. Mark no stale snapshot as authoritative; do **not** merely hide
   the giant blob or rename `source_record`.
7. **Only after** verified final export/restore and explicit owner approval,
   archive then retire obsolete JSON *operational* blobs and compatibility
   columns without deleting protected backups, customer evidence or audit
   history. Archived old-format backups can exist as immutable recovery
   artifacts but must never participate in everyday business processing.
8. Verify fresh production transactions by code search, database
   monitoring/pg_stat_statements, tests and zero unexpected writes to
   historical JSON stores. Require an operator-signed go/no-go report
   (including backup restoration and rollback drill).
9. **Immediately delete the temporary staging branch after verification**;
   independently check `list_branches` to ensure no additional billable
   branch is running. If deletion fails, report the blocker and keep trying
   safely; do not claim billing stopped without confirmation.

### Explicit release blockers TODAY

- No restored real-data staging exists. Supabase refused creating a
  staging branch on the current plan. No charged branch was created.
- The current PR #21 is still a draft with preparatory SQL, synthetic
  tests and off-by-default feature gates. It is **not** the completed
  typed-only cutover or production deployment.
- Several active paths still depend on `source_record`,
  `tenant_workspaces.payload`, global legacy `tenant_data` records and
  receipt/base64 evidence; a zero-JSON operational state is **not yet met**.
