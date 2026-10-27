# Orvix application_state: move away from one giant JSON snapshot

**Checkpoint 2026-10-27 · draft PR #21 · NOT deployed.**

## Read-only live findings

- `public.tenant_data` has **four** historical rows under
  `data_key='application_state'`, about **7,720 kB** of JSONB,
  with **45** key/value entries; every entry is a JSON string.
- One promotional-banner entry occupies ~5,567 kB; one historical
  settings entry ~2,241 kB. These are real archived application
  state, not necessarily safe duplicate bytes.
- Separate `tenant_data.promotional_banners__global` currently stores
  ~5,436 kB and `tenant_data.settings` collectively ~2,375 kB.
  Some settings rows contain embedded image data. Do NOT remove these
  without proving whether the current app/administrator still reads them.
- The application_state rows were last updated **2026-08-12**,
  so historical footprint != proof of current write hot spot.
  Disk savings after any migration are not assumed until validated.

## New implementation

`scripts/sql/staging_normalize_application_state_kv.sql` creates
`orvix_tenant_application_state_entries`: one tenant-scoped TEXT row
per Storage API key/value (not one giant JSONB document). The companion
`orvix_tenant_application_state_status` starts in `shadow` status, not
`active`. SQL validates original source types and performs exact JSONB
round-trip parity before COMMIT. No legacy row is modified. RLS uses
`private.current_tenant_id()` and all writes are scoped to the
authenticated tenant; DELETE is not granted.

`src/shared/utils/onlineStorage.ts` now has an **off-by-default**
feature-gated path. It requires **both**
`VITE_ORVIX_TYPED_APP_STATE=true` **and** the current tenant's status
`active` before reading typed entries. A tenant with `shadow` status
continues to read/write the original legacy snapshot. A tenant with
`active` status and a failed typed read **cannot** write stale legacy
data. Typed writes send **only changed keys** with logical tombstones
preserving deleted values; they do not rewrite a 7.7 MB JSON blob for
a small preference change. Keys load in deterministic, paginated order,
and stale loads cannot overwrite a different tenant's runtime state.
No environment flag has been enabled in production.

`normalizedOnlineState.ts` provides a pure serializer/parser with
type/duplicate/empty-key validation. Unit tests and frontend integration
tests exercise the switch, shadow fallback, fail-closed behavior and
per-key changes. PostgreSQL 17 CI runs a synthetic multi-tenant SQL
fixture, tests byte-preserving JSON string conversion, image-like data,
tenant RLS, no anonymous read and no client DELETE.

## No production cutover yet

The backfill **must first** run on a restored staging project with a
separate verified backup of PostgreSQL and Storage. The status activation
is deliberately a manual, separately reviewed step not included in the
SQL file. Do not enable the feature flag from Vercel until:

1. All old application_state keys/values and usage paths are reconciled
   on the real staging restore; only valid active tenant IDs should be
   activated (legacy non-UUID identifiers may have incompatible tenancy).
2. Confirm key-value equality, tenant ID access checks, out-of-order
   offline replay, tombstone preservation, browser reload and network
   error handling under current staff permissions.
3. Prove a **rollback that replays typed changes back to the legacy
   source** or retains typed reads; blindly switching to the frozen old
   JSON snapshot would overwrite newer settings. Merely flipping the
   environment variable OFF is **not** a safe rollback after writes.
4. Migrate oversized inline images separately to **private,
   tenant-isolated Storage** with exact byte/hash and access checks,
   where needed. Splitting JSON into TEXT rows by itself does not
   shrink existing binary payload bytes.
5. Leave `data_backup_%`, `workspace_backup_%`, source_record,
   original app_state and financial/receipt evidence untouched until
   an explicitly approved retirement cutover.

**Status:** staged SQL + gated client path and synthetic tests only.
The main normalized business API, product/source_record retirement,
settings legacy data and client-state read activation remain uncompleted
production release gates. The objective is less rewrite I/O and simpler
tenant-specific records *without data loss*, not claiming zero JSON
everywhere.
