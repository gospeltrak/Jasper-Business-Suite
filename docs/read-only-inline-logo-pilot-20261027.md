# Orvix inline-logo pilot: read-only SQL verification

**Date:** 2026-10-27 (Africa/Dar_es_Salaam)  
**Environment:** Connected Supabase production database  
**Execution:** SELECT-only checks; no SQL UPDATE, INSERT, DELETE, Storage upload, trigger change, or external backup deletion.

## Single-tenant shadow conversion

An anonymized existing workspace with two inline business logo fields was selected by the **smallest payload containing an inline logo**, not by a business name or manual preference. The SQL built a hypothetical replacement payload using `jsonb_set` with placeholder HTTPS URLs and never stored it.

| Check | Result |
| --- | --- |
| Inline logo fields in chosen workspace | 2 |
| Current `pg_column_size(payload)` | 25,320 bytes |
| Shadow-projected payload | 5,396 bytes |
| `payload - 'settings'` exactly unchanged | PASS |
| Settings excluding `business` and `company` exactly unchanged | PASS |
| Business settings except logo fields exactly unchanged | PASS |
| Company settings except `logo` exactly unchanged | PASS |
| `workspace_normalization_outbox` pending or failed | 0 |

The observed size reduction for this **single sample workspace** is about 79%; it is not an overall database or total Storage reduction.

## All-workspace preflight

Across all 9 workspaces, the previous read-only check recorded 5 inline `businessLogo`, 5 inline `businessLogoLight`, 1 inline `businessLogoDark`, 1 inline `company.logo` and 0 inline `company.logoUrl`. Historical rows remain in `tenant_data`; neither they nor `source_record` are cleanup targets in this PR.

Supabase `tenant-logos` bucket: public, three matching policies; existing write permissions are **not** modified. All four protection and normalization triggers on `public.tenant_workspaces` remain enabled.

## What this pilot does not prove

- Uploaded images are not yet tested with authenticated owner/staff accounts in staging.
- A Storage byte-for-byte roundtrip and per-tenant `COMMIT` have **not** been run; the operator script is dry-run-first and the production apply is gated on external backup verification.
- Browser rendering of light/dark logo, PDF invoice/report, real branches, permission denials and concurrent settings saves remains a staging regression requirement.
- Some important product, pharmacy, payment and inventory properties remain in `source_record` even though primary business records are normalized.

## Release gate

Review PR #21, run owner/staff staging verification, verify a fresh restorable database backup, and independently review one-tenant operator arguments (including a matching project reference). **Do not automatically merge or execute production apply because automated tests passed.**
