# Direct normalized writes: remaining source_record dependencies (read-only audit)

Date: 2026-10-26. Project: Jasper-Suite. This document records structural counts only. No customer records or image data are copied here.

## What is already normalized

All nine tenants are in normalized read mode with direct normalized writes enabled and legacy dual-write disabled. Business rows are persisted in their respective products, sales/items, expenses, purchases/items, stock and treasury tables.

Do **not** treat this as evidence that per-record JSON is disposable. Many extended fields still exist only in the `source_record` compatibility representation. Payload equality tests and feature-by-feature migration are required.

## Remaining non-column source properties (observed number of records)

| Table | Fields with potentially important unmapped properties |
|---|---|
| products | purchaseUnit: 304; conversionToBaseUnit: 304; costingMethod: 286; inventorySettings: 286; sellingMethod: 286; baseUnit: 284; allowScaleSelling: 284; packageLevels: 91; fractionSaleEnabled: 74; pharmacyUnitLevels: 71; trackExpiry: 71; batches: 30 |
| sales | gatewayProvider: 286; gatewayTransactionId: 286; items: 286; paymentBreakdown: 283; treasuryJournalId: 272 |
| expenses | paidFromAccountId: 103; paymentMethod: 103; treasuryJournalId: 103 |

These names do not match columns directly; some could be derived from existing relations or mapped under other names. Counts alone are not proof of business dependency. Validate before introducing redundant columns.

Related `jasper_product_inventory_settings`, `jasper_inventory_batches`, `jasper_pharmacy_unit_breakdowns`, `jasper_fraction_sale_options`, and `jasper_sale_batch_items` tables each currently contain **zero rows**, while sale_items contains 866 rows and treasury_journal_lines 529 rows at the time of this inspection.

## Safe remaining steps (separate PRs)

1. Inventory all `source_record` fields and trace every use in POS, Purchases, Pharmacy, Inventory, Reports and payments (including server functions).
2. Specify explicit normalized ownership for inventory units/conversions, batches, expiry, dosage, fraction prices and costing; likewise payment splits, journals and gateway identifiers.
3. Add typed columns and/or relation tables only where necessary (additive and tenant/branch scoped, with RLS, indexes and foreign keys).
4. Backfill **idempotently** in batches with before/after SHA-256 evidence, row counts, exact decimal amounts and stock quantities, orphan checks and historical branch records preserved.
5. Implement direct writes to those typed structures in the **same database transaction**, prove API response equivalence and staff/owner/tenant isolation, and switch read paths by verified tenant/feature gates.
6. Retire `source_record` dependencies only after tests pass. Do not drop `source_record` or delete historical backups as part of migration.

`tenant_workspaces.settings` is a separate concern. The first high-value shrink is to move embedded business/company logos to immutable Supabase Storage URLs using the separately reviewed one-tenant-at-a-time operator script. No production data mutation occurred during this audit.

## Follow-up: production storage checkpoint (2026-10-27, read-only)

All figures here are **aggregate** and from `SELECT` queries only. No payload contents, tenant identities, backup files or full data URLs were exported. No production table, row, index or Storage object was modified.

| `public.tenant_data` category | Rows | Sum of `pg_column_size(payload)` | Tenant IDs represented |
| --- | ---: | ---: | ---: |
| `data_backup_%` | 6,937 | ~571 MB | 2 |
| `workspace_backup_%` | 33 | ~17 MB | 1 |
| Other keys — **potentially live** | 113 | ~22 MB | 19 |

The 571 MB category is heavily concentrated in July 2026 (6,800 rows, ~570 MB). The last `data_backup_%` item observed was updated in August 2026. **Age and name alone are not proof of dispensability.** A bounded content-uniqueness check of the **first 200 historical backup rows** found 200 distinct `md5(payload::text)` hashes; this is only a sample and demonstrates why automatic deduplication/deletion would be unsafe. Hashes themselves were not exported.

`pg_total_relation_size('public.tenant_data')` is **~751 MB** versus ~3.4 MB main heap, ~1.7 MB ordinary indexes and **~746 MB TOAST heap + index** (the out-of-line storage for the large JSONB payloads). This is physical storage including overhead and possibly reusable space; it is not the exact amount safely reclaimable. `pg_stat_user_tables.n_live_tup` for `tenant_data` currently reports zero despite 7,083 confirmed rows, so **do not trust the stale row-count estimate**. Read-only exact counts are used in this report.

Source compatibility recheck: `products` contains 484 rows / 416 non-null `source_record`; `purchaseUnit` and `conversionToBaseUnit` each appear in 304, `costingMethod` and `inventorySettings` each in 286, `batches` in 30 and `pharmacyUnitLevels` in 71. `sales` has 286 rows, including 283 `paymentBreakdown` and 272 `treasuryJournalId` JSON properties. `expenses` has 103 rows, including 103 `paidFromAccountId`, 103 `paymentMethod` and 103 `treasuryJournalId`. The five specialist product/pharmacy/batch mapping tables remain **empty**. **Do not DROP `source_record` or `tenant_data`.**

### Safe follow-up gates — not yet performed

1. Check whether any runtime code, older tenants, staff apps, rollback jobs, or audit procedures still **read** `tenant_data` backup keys. Identify a retention owner and policy; the 113 non-backup records are off limits to backup cleanup.
2. Independently create and **restore-test** a complete encrypted database backup/PITR snapshot, and keep protected tenant history plus an auditable, tenant-scoped export of every proposed archive candidate.
3. Design a reversible batch archive (not immediate deletion), with manifest `tenant_id`, `data_key`, stored checksum, exact bytes, restore verification, and owner approval. No unreviewed account/record identifiers in human reports.
4. Only after restoration succeeds, use a separately reviewed, bounded and resumable purge process for approved rows; check query latency and WAL/replication/storage capacity. Ordinary `VACUUM` may allow space reuse but **does not necessarily shrink on-disk TOAST relation files**. Never run `VACUUM FULL`, `CLUSTER`, `REINDEX` or table-rewriting maintenance on live production without an explicit locking/downtime plan.
5. In separate additive migrations, map each extended `source_record` field to tested normalized columns or relations, backfill by tenant/branch and reconcile stock and payments. Only then consider retiring compatibility JSON fields.

**Status:** observation only; no physical deletion, Storage migration, production rewrite or production setting changes performed.

## Runtime I/O prioritization (2026-10-27)

The existing **non-backup partial index** `tenant_data_active_keys_io_idx` is present on production. Its prior one-shot measured lookup improvement was **778.195 ms → 88.325 ms** for one legacy nonbusiness-key aggregation; it does not prove all requests are fast.

New read-only `extensions.pg_stat_statements` inspection flags the remaining high-temp-I/O RPCs. These are **cumulative since server stats reset, not live per-second activity** and sample shapes may mix earlier code revisions:

| RPC | Calls | Average execution | Temp blocks written (cumulative) |
| --- | ---: | ---: | ---: |
| `route_current_branch_business_data` | 556 | ~2,766 ms | 5,941,998 |
| `save_current_branch_workspace` | 184 | ~3,530 ms | 2,387,770 |
| `save_current_branch_expense_payment` | 32 | ~2,199 ms | 436,812 |
| `save_current_branch_products` | 75 | ~2,531 ms | 434,410 |
| `get_current_branch_workspace_bootstrap_v3` | 323 | ~1,039 ms | 191,379 |
| `get_current_branch_workspace` | 198 | ~1,305 ms | 156,937 |
| `get_current_branch_workspace_page` | 1,174 | ~446 ms | 103,346 |

`pg_stat_database.temp_bytes` now reports **~92 GB cumulative**, an I/O counter — **NOT** a 92 GB disk file or current storage bill. Prior read-only checkpoint noted ~61 GB cumulative; it should not be interpreted as 31 GB produced today because the sampling windows/reset timing were not synchronized.

**Next performance PR:** prioritize exactly scoped `route_current_branch_business_data` and full `save_current_branch_workspace` paths, eliminating unnecessary full-workspace JSON composition and temp sorts in favor of narrow normalized reads/writes. Use a measured before/after on staging with representative tenant data, compare nested result hashes, ledger totals, stock, branch permissions and P95 request timing. Do not optimize by deleting rows, removing backup protections, or changing a business write to non-atomic.

## Typed product inventory settings staging backfill (2026-10-27)

**Actual repository change:** `src/shared/utils/inventoryCosting.ts` now recognizes `weighted_average` as the historical storage spelling of canonical `average_price`. It does this **only in memory** on business-logic reads, preserving the original customer `source_record` value. Regression coverage added to `src/shared/utils/inventoryCosting.test.ts`.

**Read-only live audit:**
- 484 product rows total; 416 have original `source_record`.
- 286 product rows contain inventorySettings JSON; **279 active**, **7 inactive historical**.
- Among active candidates **120 use `weighted_average`** in both the top-level and nested settings. The existing typed `jasper_product_inventory_settings.costing_method` has a CHECK constraint accepting only `fifo`, `average_price`, `batch_price`. Therefore blind JSON-to-typed backfill would reject or mishandle those 120 rows.
- No active candidate lacked a legacy identifier; no observed costing-method or numeric precision incompatibility for typed pricing (2 decimals) and unit conversions (6 decimals).
- Existing typed settings target currently contains **zero rows**. RLS is enabled and forced, with tenant- and platform-admin-scoped policies.

**Prepared but intentionally NOT run on production:** `scripts/sql/staging_backfill_product_inventory_settings.sql` is a guarded, idempotent INSERT-only staging candidate. It maps the historical method spelling to the canonical typed value, skips inactive rows, never overwrites an existing typed row, refuses incompatible field types/precision and rolls back if any active-source field fails exact typed comparison. It leaves `products.source_record`, stock, sales, subscriptions, branches, backups and existing tables untouched. A staging session must explicitly set `app.orvix_inventory_backfill_permission=STAGING_ONLY_RESTORE_TESTED`. Companion: `scripts/sql/read_only_product_inventory_preflight.sql`, plus `src/shared/utils/inventorySettingsBackfill.test.ts`.

**Cutover not done:** The existing target does not yet capture extended JSON fields such as package-specific prices, embedded fraction sale settings, medicine unit levels, expiry and batch history. Both shadow backfill and transactionally consistent read/write cutover require restored staging, tenant parity checks, tests and explicit data-preservation approval. Do **not** drop source_record, change stock math, delete inactive histories or confuse preparing a backfill with completing a migration.

## Stage 2: typed package prices, fraction options, pharmacy units (2026-10-27)

New staging-only SQL: `scripts/sql/staging_extend_and_backfill_inventory_details.sql` and safety tests `src/shared/utils/inventoryDetailsShadow.test.ts`. This **has not been applied to production or a staging database**; GitHub CI tests prove source-level guardrails, not actual PostgreSQL execution. Complementary, production-safe SQL: `scripts/sql/read_only_inventory_normalization_coverage.sql`.

Fresh aggregate read-only evidence from the current 279 active `inventorySettings` JSON sources:

- `packageUnitPrice`, `halfPackagePrice`, `packageBuyingCost`: **166 products** each; `wholePackagePrice`: **119**.
- `fractionSaleEnabled`: **47**; 3 products contain **12** explicit fraction option entries (all have identity, quantity, label, price, order and acceptable precision).
- 4 pharmacy-product `pharmacyUnitBreakdown` structures, with typed string unit labels and positive quantities at acceptable numeric precision.
- 30 active products contain **33** batches. Their current JSON records include `destination`, `quantityPurchasedBase`, `quantityRemainingBase`, etc. The current `jasper_inventory_batches` schema does **not** capture all of these, so **batch source JSON must not be deleted yet**.
- Existing typed tables `jasper_product_inventory_settings`, `jasper_fraction_sale_options` and `jasper_pharmacy_unit_breakdowns` remained empty during this read-only audit.

The extension script keeps optional package prices and booleans in explicit columns (not JSONB), preserves original fraction-option IDs via a new `legacy_option_id` field, preserves order, and writes the four pharmacy breakdowns to the existing typed relation. It is guarded by an isolated-staging approval marker and validates source field types, exact numeric precision, existing shadow drift and transaction-end parity; failures roll back. Its array and pharmacy source checks reject missing/null/malformed values rather than silently dropping unsupported data. Backups, live product rows and `source_record` are deliberately unchanged.

**Remaining to finish JSON retirement:** run both scripts on a restore-tested staging clone; fix any SQL-runtime/schema differences; implement same-transaction typed writes, gated reads and per-tenant equality checks. Move all extended top-level product fields, inventory batches (including FEFO/expiry), sales payment detail and receipts before considering `source_record` removal. **Do not call this complete just because the staging scripts or CI pass.**
