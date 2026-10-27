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
