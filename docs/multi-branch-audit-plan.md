# Jasper Business Suite — Multi-Branch Audit and Implementation Plan

Status: Phase 1, Phase 2, the complete Phase 3 additive dark-rollout schema, Phase 4A Primary compatibility/branch lifecycle RPCs, Phase 4B backward-compatible backend integration, Phase 5 desktop Branches Settings UI, and Phase 6 native mobile/tablet Branches Settings UI are implemented and validated locally. Nothing has been applied to production; branch-scoped business screens and transfer/posting phases remain pending.

## Implementation checkpoint — Phase 3A

- Added an additive core migration for branch metadata, tenant-specific capacity, a global kill switch, secure user branch preferences, strict Super Admin controls, and audit events.
- Default active Tanzanite capacity is 2 total branches: Primary Branch plus 1 additional branch.
- Super Admin may grant any non-negative whole number of extra slots; effective capacity is `2 + granted slots` with no product-level hard maximum.
- Global rollout and tenant rollout both default to disabled. No existing tenant receives an entitlement row or physical Primary Branch automatically.
- No tenant, workspace, product, stock, transaction, staff, balance, settings, or document data is backfilled or rewritten.
- PostgreSQL grammar parsing, a disposable shadow-database execution, structural RLS/privilege tests, entitlement behavior tests, unauthorized tenant-admin tests, unsafe capacity-reduction tests, and TypeScript lint all pass.
- Production database deployment remains intentionally blocked until the remaining Phase 3 migrations and rollout gates are complete.

## Implementation checkpoint — Phase 3B

- Added server-only relational control tables for branch settings, product catalogue links, branch pricing, warehouses, warehouse links and balances, suppliers, customer references, and payment-channel configuration.
- Confirmed through the live read-only schema that there was no existing relational warehouse table before adding `warehouses`; existing `registeredStores`, Store, Product Location, workspace inventory, and `branch_stock` remain unchanged.
- Preserved compatibility with workspace product IDs through text product references while allowing an optional tenant-safe UUID foreign key to relational products.
- Added composite tenant/entity foreign keys so a branch, product, supplier, or warehouse from another tenant cannot be linked.
- Added database guards that block sharing for Different Independent Business branches, locked/inactive branches, cross-tenant references, invalid shared-pricing modes, and reuse of a Separate Warehouse by multiple branches.
- New Phase 3B tables have forced RLS and no browser-role access until Phase 4 adds audited branch-aware RPCs and policies.
- PostgreSQL grammar parsing, ordered 3A→3B shadow migrations, structural tests, sharing-mode behavior tests, warehouse isolation tests, cross-tenant tests, and TypeScript lint all pass.
- No rows are seeded or backfilled, and production remains unchanged.

## Implementation checkpoint — Phase 3C

- Extended the existing `branch_staff_assignments` table additively and added normalized branch roles, all/assigned-branch access profiles, and explicit allow/deny permission grants.
- Added tenant-safe composite foreign keys for assignment-to-branch, assignment-to-user, branch-role, access-profile, and permission relationships without validating or rewriting historical rows.
- Added indexed security-definer helpers for active tenant membership, tenant administrators, branch assignment, permission resolution, branch reads, and branch writes.
- Preserved downgrade behavior: authorized users can still read historical additional-branch data, while writes require an active/unlocked branch and an active Tanzanite entitlement for non-primary branches.
- Preserved Primary Branch operation for lower packages; additional-branch write access remains behind both global and tenant rollout flags.
- Confirmed the current live authority model read-only (`business_user / Admin` for tenant administration and `business_staff / Seller` for ordinary staff) before implementing role checks. No names, IDs, email addresses, phone numbers, or business records were printed.
- Ordered 3A→3B→3C shadow migrations and tests confirm unassigned denial, assigned access, all-branches scope, explicit deny precedence, locked-branch read-only behavior, cross-tenant assignment blocking, and entitlement-gated additional-branch writes.
- New Phase 3C tables remain server/RPC-only; existing branch RLS policies are intentionally unchanged until the compatible Phase 4 service/RPC rollout is ready.
- No existing user, staff assignment, branch, tenant, or workspace row is inserted, updated, deleted, or backfilled, and production remains unchanged.

## Implementation checkpoint — Phase 3D

- Evolved the existing `branch_inventory_transfers` table into a backward-compatible workflow header while retaining every legacy status and legacy product/quantity field.
- Confirmed the live transfer count was still zero using a count-only query before broadening the status constraint; no transfer content or tenant identity was read.
- Added normalized multi-product items, partial receipts, receipt lines, discrepancies, attachments, immutable status history, transfer/receipt numbers, warehouse routing, and idempotency keys.
- Added composite tenant/header/item/receipt foreign keys so receipt lines and discrepancies cannot reference another tenant or another transfer.
- Added database guards for Same Business routes, active/unlocked branches, correct source/destination warehouse links, distinct branches, legal quantity bounds, and legal workflow status transitions.
- Added database-generated status history and protected finalized receipt/history rows from browser updates. Child workflow tables have forced RLS and remain server/RPC-only.
- Ordered 3A→3D shadow migrations and tests confirm valid multi-step transitions, seven expected history events, invalid-transition rejection, duplicate-idempotency rejection, Independent Business blocking, wrong-warehouse blocking, cross-transfer receipt blocking, and immutable receipt/history behavior.
- Atomic stock reservation, dispatch deduction, destination receipt posting, concurrency locking, and reversal functions remain intentionally deferred to Phase 7 and are not exposed early.
- No existing transfer, stock, product, warehouse, branch, tenant, user, or workspace row is inserted, updated, deleted, or backfilled, and production remains unchanged.

## Implementation checkpoint — Phase 3E

- Added server-only branch payment accounts and currency-bound balance records without creating, copying, or posting any account balance.
- Evolved the existing `branch_money_transfers` table into a backward-compatible fund-transfer workflow instead of creating a duplicate transfer ledger.
- Added branch fund requests, approval amounts, request and transfer status history, attachments, idempotency keys, immutable posting journals, journal lines, and reversal links.
- Added composite tenant/branch/account/currency foreign keys and database guards for active unlocked branches, correct account routes, legal request and transfer transitions, approved request limits, journal direction, and matching reversal journals.
- Kept fund movements explicitly separate from sales, revenue, expenses, and purchases; this schema migration does not post accounting effects or alter current branch balances.
- Confirmed through a live count-only query that the existing money-transfer table contained zero rows before its status constraint was broadened. No transfer content or tenant identity was read.
- PostgreSQL grammar parsing, disposable shadow migration execution, structural RLS/privilege tests, request and transfer workflow tests, invalid route/currency/amount tests, idempotency tests, immutable journal tests, reversal tests, and unchanged-balance checks pass.
- Atomic row locking, balance debit/credit, insufficient-funds enforcement, notification emission, and audited send/receive RPCs remain intentionally deferred to the later posting phase and are not exposed early.
- No existing payment, money transfer, balance, sale, expense, purchase, branch, tenant, user, workspace, or business record is inserted, updated, deleted, or backfilled, and production remains unchanged.

## Implementation checkpoint — Phase 3F

- Added immutable tenant/branch-aware `branch_audit_logs` with actor, entity, before/after state, correlation, metadata, and idempotency support. Cross-tenant branch and actor references are rejected.
- Added a durable branch notification outbox and per-user delivery/read state designed as the server-side source for the existing Jasper notification centre, not as a disconnected user-facing notification system.
- Added private idempotent helpers for atomically appending audit records and enqueuing in-app notifications. Repeated notification requests return the original event without changing its original recipient set.
- Added tenant-safe recipient foreign keys, indexed unread and delivery queues, legal delivery-state transitions, immutable notification content, and prevention of read-state rollback.
- Added server-only, security-invoker reporting views for real branch account balances and a canonical internal stock/fund movement register.
- Every internal movement row is explicitly excluded from consolidated revenue, expenses, sales, purchases, and external cash flow. Fund transfers remain balance movements; stock transfers remain inventory relocations.
- No triggers were attached to existing tenant, branch, transfer, balance, sale, expense, product, workspace, or user tables, so deploying the additive schema alone would not introduce hidden runtime writes.
- PostgreSQL grammar parsing, structural RLS/privilege tests, disposable shadow execution, empty-migration checks, immutable-audit tests, cross-tenant rejection tests, retry/idempotency tests, recipient-state tests, reporting-exclusion tests, and real-balance reporting checks pass.
- The current browser notification context remains unchanged until Phase 4 supplies audited read/mark-read RPCs and its compatibility adapter.
- No existing audit, notification, report, tenant, branch, transfer, account, balance, sale, expense, stock, user, workspace, or business row is inserted, updated, deleted, backfilled, or recalculated, and production remains unchanged.

## Implementation checkpoint — Phase 4A

- Added a read-only compatibility Primary Branch context for tenants with no physical branch. It returns `branchId = null` and creates no row, preserving every existing record with a missing branch ID.
- Added explicit tenant-owner activation protected by global rollout, tenant rollout, active Tanzanite entitlement, tenant-level advisory locking, and idempotent audit/notification events.
- Physical Primary Branch responses are marked to include unassigned historical records, so later selectors use `branch_id is null OR branch_id = primary_id` instead of hiding legacy tenant data.
- Added a service-role-only new-tenant provisioning RPC. It is not callable by anonymous or authenticated browser users and refuses to guess when a tenant already has non-primary branches.
- Added scoped branch listing, current-context resolution, persisted selection, five-item recent-branch history, All Branches permission enforcement, and cross-tenant selection rejection.
- Added capacity-controlled additional-branch creation with tenant-administrator checks, active Tanzanite enforcement, branch-manager tenant validation, normalized/unique branch codes, relationship type validation, short tenant row locking, audit records, and in-app notification events.
- The default active Tanzanite limit is verified as two total branches. A third branch is rejected until Super Admin grants the exact additional slot; after a +1 grant, three total branches are permitted.
- Downgrade behavior is verified: Primary remains writable, additional branches remain visible but read-only, new branch creation is blocked, and All Branches consolidated scope is locked until entitlement is restored.
- Replaced the legacy tenant-wide branch write policy with scoped read access and audited RPC-only mutations. Direct browser writes to branches and branch preferences are revoked.
- Ordered shadow execution against the Phase 3 control/security/event helpers, structural privilege tests, compatibility no-write tests, activation gates, retry/idempotency tests, default/override capacity tests, staff access tests, downgrade tests, and cross-tenant tests pass.
- Registration integration was deliberately kept out of this database checkpoint and is now implemented separately in Phase 4B with a backward-compatible failure path.
- No existing tenant, branch, preference, assignment, transaction, product, stock, balance, workspace, or historical record is inserted, updated, deleted, or backfilled by the migration itself, and production remains unchanged.

## Implementation checkpoint — Phase 4B

- Wired successful new-tenant registration to the service-role-only Primary Branch provisioning RPC after the canonical user, tenant workspace, and compatibility tenant-data setup have completed.
- Primary provisioning is idempotent and non-fatal during the additive rollout. If the Phase 4A function is not deployed yet or provisioning returns an error, the new account still completes normally and the backend records a concise warning; the response contract is unchanged.
- Added authenticated backend endpoints for tenant branch entitlement/rollout state, compatibility/current branch context, scoped branch directory, secure branch selection, explicit Primary activation, and capacity-controlled additional-branch creation.
- Every branch RPC request is executed with the caller's bearer token. Tenant ownership is derived inside the database from `auth.uid()`; no branch endpoint accepts or trusts a browser-supplied tenant ID.
- Added server-side UUID, selection-scope, relationship-type, field-length, and calendar-date validation plus stable 400/403/404/409/503 error mapping, no-store responses, and a branch-specific rate limit.
- Existing-tenant Primary activation and additional-branch creation are disabled by default behind `MULTIBRANCH_FEATURE_ENABLED`. Read-only compatibility context remains available, while the later controlled rollout must explicitly enable mutations.
- Unauthenticated API smoke tests confirm all six branch read/mutation endpoints reject requests with HTTP 401. TypeScript lint and the production client/server build pass; only the pre-existing Vite chunk-size and mixed-import warnings remain.
- No production deployment, migration execution, tenant activation, Primary creation, workspace rewrite, or existing customer-data mutation was performed.

## Implementation checkpoint — Phase 5

- Added a typed branch API client and active-branch context that obtain the current Supabase user access token and call only the authenticated Phase 4B endpoints. The browser never supplies a tenant ID and never receives a service-role credential.
- Added a lazy-loaded desktop-only Branches module to Settings. Mobile and tablet Settings navigation deliberately remain unchanged until the separate Phase 6 native-responsive implementation.
- Added real directory, entitlement, capacity, rollout, compatibility-Primary, package-lock, loading, error, empty-search, and read-only detail states. No placeholder balances, stock totals, staff counts, or warehouse modes are displayed.
- Added the desktop branch-creation wizard with Basic Information, Relationship, and Review steps. The final review explicitly states that products, stock, balances, staff, and historical transactions are not copied or changed.
- Lower packages retain their compatibility Primary view and show the exact Tanzanite upgrade state. Tanzanite defaults to two total branches; capacity-full and tenant-specific extra-capacity states come from the backend entitlement response.
- Additional-branch creation and compatibility-Primary activation respect the server rollout flag and remain disabled by default until `MULTIBRANCH_FEATURE_ENABLED` and the tenant rollout gate are explicitly enabled.
- Existing POS, sales, products, stock, reports, checkout, staff, stores, warehouses, settings data, and tenant workspace selectors were not made branch-scoped in this phase. This prevents a partially wired branch switcher from mixing or hiding production data.
- Visual QA used the real rendered Settings and Branches components with temporary injected fixtures that were deleted afterward. Active, details, wizard, lower-package, and dark states were inspected at 1280 and 1440 pixels; 1920 pixels was also checked. All tested widths had `scrollWidth === innerWidth`, and browser console/page errors were empty.
- TypeScript lint and the production client/server build pass. The pre-existing Vite mixed-import and main-bundle size warnings remain unchanged; the Branches module is emitted as its own lazy chunk.
- No production deployment, migration execution, feature activation, tenant row update, physical Primary creation, branch creation, workspace rewrite, historical backfill, or existing customer-data mutation was performed.

## Implementation checkpoint — Phase 6

- Replaced the previous compressed small-screen Settings navigation with a native mobile list: sticky safe-area app bar, full-width touch rows, icons, descriptions, chevrons, Tanzanite status, functional Settings search, back navigation, and bottom-navigation clearance.
- Added Branches to mobile and tablet Settings without changing the Phase 5 desktop presentation. Mobile opens a dedicated full-width Branches surface; tablet keeps the Settings category rail visible and uses an intentional Branches master-detail workspace.
- Mobile Branches includes a compact entitlement/capacity band, search, edge-to-edge branch rows, Primary/relationship/status/setup indicators, 44-pixel-or-larger actions, a reachable bottom capacity/create action, a native action sheet, and a mobile bottom-sheet detail view.
- Tablet Branches uses a touch-friendly branch master list and selected-branch details at landscape widths, while portrait widths stack the same master/detail information without squeezing a desktop table into the available space.
- The Add Branch wizard now becomes full-screen on mobile with one step visible at a time, a sticky progress rail, large single-column inputs, native date input, keyboard-safe scrolling, safe-area bottom actions, responsive one/two-column review, and session-only draft auto-save. Tablet retains a spacious responsive stepper and two-column fields where space allows.
- UI does not invent warehouse mode, staff count, balances, or unsupported operational actions. Activate/deactivate/edit/report/assign/archive controls remain withheld until their audited backend APIs exist; the action sheet explains this instead of presenting unsafe inert buttons.
- Browser interaction QA verified Settings search, mobile Branches navigation/back, search/list states, action sheet, detail sheet, tablet branch selection, wizard review, and draft restoration. Browser console/page errors were empty.
- Responsive checks passed with `scrollWidth === innerWidth` at 320, 360, 375, 390, 430, 768, 820, and 1024 pixels. Light and dark states were inspected; mobile 390, tablet 820, and tablet 1024 evidence was captured.
- Browser/IAB was used first for DOM, interaction, console, and mobile screenshot verification. Its 1024-pixel screenshot omitted the visible Settings master pane despite a correct DOM snapshot and zero overflow, so standalone Playwright was used only for reliable final screenshot evidence and repeated the checks with zero console errors.
- No production deployment, migration execution, feature activation, tenant update, Primary creation, branch creation, workspace rewrite, historical backfill, or existing customer-data mutation was performed.

## 1. Source of truth and baseline

- The active production codebase is `Jasper-Business-Suite-updated`. The configured `Jasper-Business-Suite-main` workspace root is empty and is not a Git repository.
- Stack: React 19, TypeScript, Vite, Express, Supabase/Postgres, Tailwind CSS, Vercel.
- Baseline `npm run lint` and `npm run build` pass.
- There is no automated unit, integration, RLS, or browser test suite in the repository.
- The worktree already contains unrelated user changes. They must be preserved.

## 2. Existing architecture

### Tenant model

- `tenants` owns package and company identity fields.
- `users.tenant_id` and `users.active_tenant` associate users with tenants.
- `private.current_tenant_id()` and tenant RLS policies provide database-level tenant isolation.
- Business data is split between relational tables and two JSON stores:
  - `tenant_workspaces.payload`
  - `tenant_data.payload`, keyed by `data_key`
- The dashboard primarily reads and writes complete tenant workspace arrays. Relational tables are not yet the single source of truth for all business operations.

### Existing branch foundation

Migration `20260627183655_branch_management.sql` already created:

- `branches`
- `branch_stock`
- `branch_staff_assignments`
- `branch_inventory_transfers`
- `branch_money_transfers`

It also added nullable `branch_id` columns to some relational transaction tables where those tables existed.

The frontend defines `Branch`, `BranchStock`, and `BranchStaffAssignment`, and persists their arrays inside the tenant workspace. There is no production branch service, API, active-branch context, branch switcher, Branches settings module, or branch-specific dashboard.

### Existing branch-like concepts that must remain independent

- `BusinessSettings.registeredStores` represents storage bins/physical store locations such as Main Store, In-Shelf Store, and Backroom Storage.
- `branchBranding` is keyed by those registered store names.
- POS currently chooses the first registered store only for branding fallback.
- These existing Store/Warehouse/Product Location concepts will not be renamed or converted into Branches.

### Packages and entitlements

- Package identifiers already exist: Ruby, Diamond, Tanzanite, plus legacy aliases.
- Current package rules are inconsistent with the new requirement:
  - Trial and Diamond currently advertise branch management.
  - Diamond `maxStores` is effectively unlimited.
  - Tanzanite currently allows three registered stores, while UI copy elsewhere says five.
- Current restrictions are mainly frontend visibility/count checks.
- No branch entitlement is enforced by branch APIs, services, database functions, RLS policies, background jobs, or transaction posting functions.

### Settings and responsive UI

- Settings currently has Company, Business, Product & Store Units, Invoice & Logo, HRM, Roles, and Alerts.
- There is no independent Branches settings item.
- Mobile/tablet Settings already uses a native list/detail pattern below 1280px.
- Tablet-specific layout begins at 640px; desktop Settings begins at 1280px.
- The new Branches module can extend this existing responsive shell without redesigning unrelated settings.

### Notifications

- An in-app notification context exists, but it is browser-storage based.
- There is no durable tenant/branch notification event table or branch workflow integration.

## 3. Live database audit summary

The live schema was inspected read-only through the Supabase OpenAPI schema and count-only queries. No customer values or identifiers were printed or changed.

- Tenants: 3
- Users: 16
- Relational products: 197
- Tenant workspaces: 3
- Branch rows: 2, belonging to one tenant
- Default/primary branch rows: 1
- Branch stock rows: 12
- Branch staff assignments: 0
- Inventory transfers: 0
- Money transfers: 0
- All three tenants currently resolve as trial accounts with no active paid package.

Workspace data currently includes:

- 227 product objects
- 13 sales
- 1 expense
- 1 purchase
- 2 deliveries

None of those workspace records has `branchId`/`branch_id`. Product, workspace, and relational counts differ by tenant, so migration must reconcile both stores and must not assume the relational tables contain all production records.

Two tenants have no Primary Branch. One tenant has two branch records and a default branch. The existing demo-branch seed script must never be used as migration input.

## 4. Confirmed gaps and risks

### Critical

1. Branch RLS currently checks tenant membership only. Any authenticated tenant user can read/write every branch row in that tenant.
2. RLS does not verify that `branch_id`, source branch, destination branch, user assignment, and tenant all match.
3. Database policies do not enforce Tanzanite entitlements or downgrade read-only behavior.
4. No atomic posting functions exist for stock dispatch/receipt or fund send/receipt.
5. Current sales, expenses, purchases, products, deliveries, settings, suppliers, and payment channels are loaded tenant-wide; there is no active-branch filter.
6. Existing tenants are not consistently mapped to a Primary Branch.
7. Workspace JSON is a second mutable source of truth and contains records not present in relational tables.

### High

1. `branch_inventory_transfers` and `branch_money_transfers` are single-row/simple-status models and cannot represent multi-item, partial, damaged, missing, rejected, or reversal workflows.
2. Transfer foreign keys and workflow query columns are missing several composite indexes.
3. Products, suppliers, payment channels, delivery riders, and settings lack branch link/config tables.
4. There is no customer table; customer identity is embedded in sales.
5. Transaction TypeScript interfaces do not consistently include `branchId`, `createdBy`, and `updatedAt`.
6. Registration creates no Primary Branch.
7. Current branch/logo UI is inside Business Setup and is tied to Store locations.

### Medium

1. RLS helper calls are not wrapped/cached in policies and may become expensive at scale.
2. Notification records are not durable or auditable.
3. Registration and workspace provisioning use compensating deletes instead of one database transaction.
4. The production JavaScript bundle is over 4 MB; branch modules should be lazy-loaded.
5. No automated tests exist, so a test harness is required before complete regression validation.

## 5. Target architecture decisions

1. **Branches remain independent.** Stores, warehouses, and product locations are not renamed or converted.
2. **Reuse and evolve existing equivalent tables.** Extend `branches`, `branch_inventory_transfers`, and `branch_money_transfers`; do not create duplicate transfer ledgers.
3. **Relational branch control plane.** Branch metadata, staff assignments, permissions, stock, prices, warehouses, transfers, status history, audit events, and entitlements live in relational tables.
4. **No-touch compatibility transition.** Existing tenant rows, workspace payloads, balances, products, stock, sales, expenses, staff, documents, and settings are not rewritten by the initial rollout. `tenant_workspaces` remains readable, and missing branch IDs resolve to a virtual/compatibility Primary Branch at query time. A physical Primary Branch row is created only for new tenants or when an existing tenant explicitly starts using Branches.
5. **Shared catalogue is not shared stock.** Tenant-level product identity is separated from branch product configuration, branch price, and branch inventory/warehouse balance.
6. **All sensitive posting is server/database authoritative.** The client never directly posts final stock or cash effects.
7. **Entitlement is centralized.** One database-backed entitlement function is called by RLS-aware RPCs, backend services, APIs, and UI selectors. Tanzanite allows two total branches by default: one Primary Branch plus one additional branch.
8. **Per-tenant capacity override.** Super Admin may grant a specific Tanzanite tenant any requested positive whole number of additional branch slots without changing the default or package definition for other tenants. There is no product-level hard maximum; each override is tenant-specific and audited.
9. **Downgrade is non-destructive.** Additional branches are locked/read-only; the Primary Branch remains active; re-upgrade restores access.
10. **Consolidation excludes internal movements.** Inter-branch funds are balance transfers, and stock transfers are inventory movements—not revenue, expense, sale, or purchase.

## 6. Migration plan

All migrations must be additive, idempotent where practical, wrapped in short transactions, and validated before constraints are tightened.

### Migration A — Core branch metadata and entitlement state

- Extend `branches` with business identity, relationship type, status/lock/archive fields, opening date, manager, branding, setup state, package lock reason, and audit timestamps.
- Add immutable tenant/branch consistency constraints and the one-primary-branch-per-tenant invariant.
- Add a separate `tenant_branch_entitlements` table keyed by `tenant_id`. It stores an optional branch-limit override, extra slots, reason, granting administrator, and timestamps. Creating this table does not update existing `tenants` rows.
- Effective branch capacity is calculated as:
  - non-Tanzanite: Primary Branch only; no additional branches
  - Tanzanite without override: 2 total branches (Primary Branch plus 1 additional branch)
  - Tanzanite with override: 2 plus the exact additional slots granted by Super Admin; the custom value may be any validated positive whole number
- Add database functions to calculate effective branch capacity and enforce it atomically during branch creation.
- Reject any override reduction below the tenant's current non-archived branch count. Quota changes never delete, archive, rename, deactivate, or rewrite existing branches.
- Add `branch_user_preferences` for secure selected/recent branch persistence.
- Add required composite indexes.

### Migration B — No-touch Primary Branch compatibility

- Do not bulk-update existing tenants, transactions, workspace JSON, products, stock, balances, staff, settings, or documents.
- Preserve any existing default branch and branch rows exactly as they are.
- For existing tenants without a branch row, expose a compatibility Primary Branch in the service/query layer without writing data.
- Create the physical Primary Branch row only when that tenant's owner explicitly opens/activates the Branches feature, and do so through an idempotent server/database function.
- Existing records with null/missing branch IDs continue to resolve to the Primary Branch through compatibility views/selectors; no historical row is rewritten.
- New tenants receive a Primary Branch during registration after the new schema is live.
- Any future optional historical backfill requires a separate explicit approval, count snapshot, backup, and dry run; it is not part of the initial rollout.

### Migration C — Branch catalogue, pricing, warehouse, and settings

- Add `branch_product_links` with empty/copy/share modes.
- Add branch-specific price records and shared-price group configuration.
- Add `warehouses` only if no production-equivalent warehouse table exists at migration time.
- Add `branch_warehouse_links` and shared-pool membership.
- Add normalized `branch_settings` and branch document sequence tables.
- Add branch supplier/customer/payment-account link/config tables without deleting current tenant-level data.

### Migration D — Staff access and permissions

- Extend branch assignments for one/many/all branch access.
- Add normalized branch permission grants using current custom roles as defaults.
- Add indexed security-definer helpers for tenant membership, branch assignment, owner/company manager access, branch write access, and Tanzanite entitlement.
- Replace tenant-only branch policies with branch-aware policies.

### Migration E — Stock transfer workflow

- Extend `branch_inventory_transfers` as the transfer header.
- Add transfer items, receipts, discrepancies, attachments, signatures, and immutable status history.
- Add atomic RPCs for request, approve, dispatch, partial receipt, complete receipt, reject, and cancel.
- Lock source inventory rows in deterministic order and prevent negative/duplicate posting.

### Migration F — Fund requests and transfers

- Extend `branch_money_transfers` as the transfer header.
- Add `branch_fund_requests`, status history, posting journal links, attachments, and reversals.
- Add branch payment accounts/balances and atomic send/receive RPCs.
- Enforce currency/account/tenant/branch consistency and idempotency keys.

### Migration G — Audit, notifications, and reporting support

- Add immutable branch audit events and durable notification events using the existing notification UI as the consumer.
- Add indexed reporting views/RPCs for branch and consolidated metrics.
- Mark internal stock/fund transfers explicitly so consolidation excludes them.

## 7. Backend and API plan

- Add a branch service boundary that validates authenticated user, tenant, branch ownership, entitlement, assignment, permission, and branch lock status.
- Add REST endpoints for branch CRUD/archive, wizard drafts, assignments, product/warehouse setup, switcher metadata, reports, stock transfers, fund requests, and fund transfers.
- Never accept tenant ownership from request data; derive it from the authenticated profile.
- Validate every incoming branch ID against the authenticated tenant.
- Use RPC/database transactions for final financial and inventory posting.
- Keep service-role usage server-only.
- Add structured audit events and stable idempotency keys.
- Add Super Admin endpoints to read and update a tenant's branch capacity override. Only platform administrators may call them, and every change creates an immutable audit entry.

## 8. Frontend plan

- Add a typed active-branch context separate from active tenant.
- Add an independent Branches row to Settings with a premium lock state for non-Tanzanite tenants.
- Add desktop Branches management, wizard, branch switcher, and branch dashboards.
- Add mobile full-screen Branches navigation, native action sheets, one-step-per-screen wizard, safe-area controls, and reachable primary actions.
- Add tablet master-detail Branches UI and a spacious wizard stepper.
- Lazy-load branch management, transfer, and consolidated-report modules.
- Scope all data selectors by active branch; use All Branches only when authorized.
- In the existing Super Admin package-activation screen, add a Branch Capacity control beside the selected tenant/package. Show current usage, the Tanzanite default of 2 total branches (Primary plus 1 additional), granted extra slots, and the effective limit. Provide quick additions of +1, +2, and +3 plus a custom positive whole-number field so Super Admin can grant the exact number requested, with an administrator reason and audit trail. This control must not appear as a global package change and must not impose a permanent product-level maximum.

## 9. Testing and rollout plan

1. Add unit/integration test tooling and database/RLS test scripts.
2. Snapshot live counts before every rollout phase and validate them afterward. The initial rollout performs no historical data backfill.
3. Test Tanzanite, lower-plan, trial, downgrade, and re-upgrade paths.
4. Test the default two-branch capacity (Primary plus 1 additional), per-tenant extra slots, custom limits, limit reduction behavior, and unauthorized override attempts.
5. Test cross-tenant and cross-branch direct API/RPC attempts.
6. Test concurrent stock/fund posting, partial receipts, insufficient balances, and duplicate idempotency keys.
7. Test existing POS, sales, products, expenses, purchases, reports, staff, settings, branding, documents, and login flows.
8. Browser-test all required mobile/tablet/desktop widths in light and dark mode.
9. Roll out behind a server-backed feature flag, first with no-touch Primary Branch compatibility, then enable additional branch creation for Tanzanite tenants.
10. Do not remove legacy compatibility until relational/workspace parity is confirmed and a separately approved backfill has completed.

### Zero-disruption phased rollout

1. **Phase R0 — Read-only safety baseline.** Capture count-only database snapshots, current error rates, and existing POS/sales/settings smoke-test results. Do not write or transform tenant data.
2. **Phase R1 — Additive schema only.** Add new nullable columns, tables, indexes, and idempotent functions in short transactions. Do not rename or drop existing tables/columns, rewrite workspace JSON, or create branches for existing tenants. The currently deployed application must continue working unchanged against this schema.
3. **Phase R2 — Backward-compatible backend.** Deploy branch-aware services that continue accepting existing requests and treating missing branch IDs as the compatibility Primary Branch. Keep branch creation and all new Branches UI disabled by a server-backed feature flag.
4. **Phase R3 — Dark UI release.** Deploy lazy-loaded Branches screens and the Super Admin capacity control without automatically exposing or activating them for tenants. Existing POS, sales, stock, reports, staff, and Settings routes remain unchanged.
5. **Phase R4 — Controlled pilot.** Enable the feature first for an internal/test tenant, then for a small explicitly selected Tanzanite tenant cohort after database, API, browser, and accounting checks pass.
6. **Phase R5 — Tenant opt-in.** An existing tenant gets a physical Primary Branch only when its owner explicitly opens/activates Branches. That operation is idempotent and does not modify historical products, stock, sales, expenses, staff, balances, documents, settings, Store/Warehouse data, or workspace payloads.
7. **Phase R6 — Gradual availability.** Expand access in small cohorts while monitoring errors, query latency, counts, posting consistency, and support signals. Stop expansion immediately if any existing workflow regresses.
8. **Rollback path.** Disable the server feature flag and hide the new routes/controls. Existing requests continue through the compatibility path. Rollback never deletes branch rows or rewrites tenant business data.

Schema, backend compatibility, UI delivery, and tenant activation must never be released as one irreversible step. No maintenance window or interruption to an in-progress sale is required for the additive phases. Destructive cleanup or removal of compatibility behavior is outside this rollout and requires separate approval, backup, dry run, and verified relational/workspace parity.

## 10. Phase gates

- Phase 3 may start only after this plan is accepted by the implementation flow.
- Each later phase must pass lint/typecheck, applicable tests, database validation, and existing-feature smoke tests before the next phase starts.
- Production deployment occurs only after security, accounting, responsive, and regression tests pass.
