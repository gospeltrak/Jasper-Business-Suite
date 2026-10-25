# Orvix native-only offline integrity plan (Android / iOS)

**Status: design + pure conflict-policy tests, NOT enabled on customer devices.**
Browser/PWA stays online-only. Never deploy this feature on `main` until all
acceptance criteria below pass on an Android handset and an iOS simulator/device.

## Non-negotiable invariants

1. Every durable business command has immutable global operation UUID, idempotency
   key, tenant UUID, branch UUID, authenticated actor UUID, registered device UUID,
   type, client timestamp, device sequence, and **server snapshot revision**.
   The client timestamp is for audit/display, never the conflict ordering source.
2. Operations are append-only. A newer/older snapshot is NEVER authoritative to
   replace complete sales, purchases, expenses, payments, or inventory.
3. Every pending operation remains on the device until server verifies the same
   idempotency key **and** confirms inventory + accounting effects. Responses
   missing a matching receipt never clear the local journal.
4. A server receipt must prove matching operation identity, scope, immutable
   payload digest, server revision and transactional commit; an HTTP 200 alone
   is not proof of completion. A mismatched receipt blocks reconciliation.
5. Tombstone deletion intents have immutable IDs, server revisions, actor IDs,
   reason and target IDs; removed records are never resurrected by stale sync.
   Undo is a **new authorized restore operation**, not deletion of a tombstone.
6. The server must authenticate the bearer identity and query fresh role /
   tenant / branch permissions; **never trust actor, branch or tenant fields
   in an offline payload**. Revoked accounts must not upload writes.
7. Inventory cannot be globally reserved by a downloaded snapshot. Before
   offline, the server must atomically issue a *device-scoped stock grant*,
   deducting that grant from the amount available to online sellers and other
   devices. Client deducts against that grant in an ACID local transaction.
8. When no valid grant, unknown quantity, depleted grant, deleted product,
   stale authoritative stock revision or unknown clock, **do not guess**:
   show the issue and mark `Needs Review`; do not silently accept overselling.
9. Purchases should not inflate online stock until synced; expenses should
   not post Treasury until synced; avoid double posting by immutable source ID
   and a single atomic server-side acceptance with stock + ledger operations.
10. Never wipe/reinitialize the native store on logout, staff switch, branch
    switch, app update or login failure. Isolate data by tenant, branch, actor,
    device. Outstanding unsynced records remain encrypted, unreadable to other
    accounts. Uninstallation/deletion is irreversible: warn before sign-out and
    require backup/recovery policy for device destruction.
11. Server-side sync must serialize conflicting product movements, respect
    tombstones and reject divergent payloads using one idempotency key. A retry
    after lost HTTP response must return the **same** committed receipt.
12. Never auto-replay legacy PWA offline queues or write to the shared
    browser IndexedDB. Native app offline flows must be explicitly gated.

## Cases and intended outcome

| # | Scenario | Safest behaviour | Current proof |
|---|---|---|---|
| 01 | Cashier A sells offline, device B sells online | Online cannot consume A's server-reserved stock | Stock-grant pure test only; server reservation pending |
| 02 | Cashier A/B simultaneously offline | Disjoint scoped stock allowances and atomic local usage | Pure model test; server grant issuance pending |
| 03 | Two offline sales spend same last unit | Second sale blocked/review, no negative local stock | Pure model tests |
| 04 | Duplicate sync request | One server commit; same receipt returned | Receipt/client model; production RPC audit pending |
| 05 | Timeout after server commits | Retry same immutable operation; never double debit | Receipt test; integration pending |
| 06 | API 500/503 or 429 | Exponential bounded retry; retain pending | Pure tests |
| 07 | Device switches airplane/Wi-Fi repeatedly | One active sync lease, queue survives reconnect | Integration pending |
| 08 | App killed before local DB commit | Do NOT confirm receipt until durable transaction completed | Journal write commit guard; device QA pending |
| 09 | App killed after local commit | Journal still exists after cold restart | Device QA pending |
| 10 | App killed after cloud business write before Treasury | Stage remains pending; retry missing side-effect only | Receipt tests; server atomicity pending |
| 11 | Product deleted on server while offline | Respect tombstone, review unmatched transaction | Pure tests; integration pending |
| 12 | Sale deleted online while device is stale | Stale cached sale must not restore it | Tombstone policy test; API pending |
| 13 | Product moved across branches while offline | Preserve source branch identity; flag invalid grant | Scope tests; server validation pending |
| 14 | Staff removed or permission revoked | Block sync, keep encrypted audit, notify owner | Auth result tests; real auth QA pending |
| 15 | Staff logs out with pending queue | Do not clear; do not leak to next login | Journal scoped; local encryption pending |
| 16 | Tenant changes on same device | Strict tenant scope; no cross-tenant merge | Pure tests; full integration pending |
| 17 | Two staff use one device | Strict actor scope and distinct queue | Pure tests; actor-auth binding pending |
| 18 | Phone and tablet use same account | Different device-scoped grants and sequences | Pure tests; server allocation pending |
| 19 | Offline purchase of same product as online sale | Increment stock only after server commit | Existing RPC supports append; end-to-end pending |
| 20 | Offline expense while ledger changed | Append new ledger entry using source ID, never overwrite balance | Server expense RPC pending |
| 21 | Price changes online | Preserve invoiced price, audit divergence, do not rewrite receipt | Tests pending |
| 22 | Clock moved backward/forward | Order by server revision + device sequence, not timestamps | Pure tests; persistence pending |
| 23 | Stock unit fractions & pack conversions | Fixed-point base unit, reconcile canonical conversion | Micro-unit pure tests; packaging E2E pending |
| 24 | Duplicate operation ID with modified payload | Reject mismatched hash, review without overwrite | Server payload digest pending |
| 25 | Customer pays during network outage | Payment recorded pending, accounting posted once on reconnection | Server treasury integration pending |
| 26 | Server says success but no receipt | Retry safely; keep local record | Pure test |
| 27 | Receipt says stock done but money not | Retry without re-deducting stock | Pure test; server atomicity pending |
| 28 | Device storage nearly full / denied persist | Fail closed before telling cashier saved | Journal guard; device QA pending |
| 29 | iOS IndexedDB eviction risk | Disable iOS offline until encrypted native DB verified | Enforced in journal |
| 30 | A recovered old copy of a local database | Never reapply operation with an already committed ID | Receipt model; server ledger pending |
| 31 | Supabase row normalization/read cutover | Use transaction-safe normalized mutation RPC, not old JSON snapshot | Existing DB guards; integration pending |
| 32 | Different payment methods / multi-payment invoice | Source-level idempotent Treasury journals; no double debit | Treasury tests pending |
| 33 | Insufficient stock at sync because reservation invalid | Review, preserve sale and customer payment trail | Model test; server resolution pending |
| 34 | Repeated invalid operations block queue | Other independent operations may proceed; invalid item held | Queue orchestrator pending |
| 35 | Device stolen while offline | Lock/encrypt local DB; remote revocation at next online check | Native encryption and threat QA pending |
| 36 | Old app after schema migration | Versioned events + additive migration, never clear offline queues | IndexedDB upgrade present; migration QA pending |

## Sync state machine

`pending → syncing → complete` only with **verified server receipt**.

Transient errors: `syncing → retry_wait → syncing` (no deletion; bounded retry).
Authorization errors: `syncing → blocked`; require new auth.
Conflict/tombstone: `syncing → needs_review`; owner action and audit.
Partial server commit: queue stays; sync resolves missing side effects.
Never treat client clock, mere HTTP success or a stale snapshot as a valid commit.

## Production release gates (all must pass)

- [ ] Server-side reservation issuance with unique tenant/branch/device grants,
      atomically excluding granted stock from every online inventory write.
- [ ] Server-side immutable operation ledger + hashes + tombstones + idempotent
      acceptance for Sales, Purchases, Expenses and Treasury.
- [ ] Native encrypted durable local storage, migration, low-disk and app-kill QA.
- [ ] Pre-offline snapshot, branch stock, settings, conversion and lease expiry.
- [ ] All three user flows wired into local journal with safe receipt UI.
- [ ] Exhaustive unit / integration / fault injection: power off, 401, 409,
      5xx, HTTP response dropped after commit, concurrent devices, migrations.
- [ ] RLS tests with owner, staff, disabled staff, other tenant and anon.
- [ ] Actual Android APK + iOS simulator/device offline/online cycles.
- [ ] QA of refunds, returns, payroll, multiple accounts and timezones.
- [ ] Full green CI and explicit owner approval for merging/deploying.

**Explicitly no production SQL mutations in this branch.**
