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
