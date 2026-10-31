# Orvix Pro — separately provisioned enterprise cashier package

## Approved product boundaries (2026-10-31)

- **Package name: Orvix Pro.** Do not use Ovics/Ovix; Tanzanite remains Tanzanite.
- Ruby, Diamond and Tanzanite retain their existing prices, product limits, branch rights, payroll, reports, subscriptions and other standard capabilities. The legacy **Sales > Settle** must no longer appear on any of these base plans or the default free trial.
- Orvix Pro is distinct. **There is no public or fixed price.** The Orvix team negotiates a monthly contract individually using till count, transaction volume and resources, then records the agreed fee in an authorized admin-controlled agreement. For example, two tills may cost TZS 200,000/month, but never assume a general per-till rate. A verified payment reaching the contracted amount is required to activate a new paid term; confirmed excess is accounted for and partial payment alone never activates. No live checkout/billing exists yet. Never activate from a client-side callback without independently verified provider settlement.
- Orvix Pro features: Settle with Count & Reconcile, cash transfers, verified handovers; branch-local Settle Reports and PDF exports; Employee Performance & Accountability; POS Park / Resume Pending Order.
- No cross-branch aggregation: only the currently selected branch. Seller events keep their historical seller/shift identity after handover.
- Mobile/tablet/desktop preserve the existing Orvix design system. Only additive Pro UI changes are allowed, including compact Settle. Original layouts, emerald styling, menus, flows, branch behavior and all standard packages remain intact.
- **Cloud-first release:** Orvix Pro uses the existing online backend. On-premises **Orvix Pro Edge is explicitly deferred** until later, with no Edge device/server prerequisite for the first Pro release.
- New test tenant will be created separately by the owner, then an authorized platform admin may explicitly enable **one** bounded Pro trial after verification.
- No auto-grant for existing Tanzanite or any other tenant. No existing data deletion or backfill.

## Private portal

- Official sign-in URL: **https://orvix.africa/pro** (route `/pro`, not `/orvix-pro`).
- Reuse Orvix identity provider with **email + password**. No separate public Pro registration, no Pro option on the three ordinary public packages.
- A verified existing Pro member may sign in; non-members are rejected and directed to Orvix setup staff. The server revalidates membership when visiting `/pro`, including after page refresh.
- Standard plans and payment checkout remain unchanged. Pro pricing is available only via authenticated, tenant-scoped membership lookup; no collection or automatic activation has been connected yet.

## Delivery state in this PR

1. Isolated opt-in Pro entitlement table in an additive **unapplied** migration, RLS-protected from normal tenants. A tenant with no row has Pro disabled.
2. Authenticated server read endpoint derives tenant identity from Supabase auth and users table, not user-supplied tenant ID.
3. Sales > Settle is gated on active server-verified Pro entitlement, not Ruby/Diamond/Tanzanite.
4. Independent feature flags for Shift Report, Cashier Accountability and Park Sale intentionally remain **disabled** until each full feature is implemented and tested.
5. New private `/pro` route using existing password login and server-verified Pro membership; fixed TZS 120,000 pricing was removed after the owner approved individualized monthly agreements. No billing charge is initiated.
6. New additive Super Admin → Orvix Pro UI with Clients, Agreements, Billing, Pro Demo and future Edge sections. Client-facing actions are intentionally withheld until protected server endpoints exist. Demo shows an explicit unprovisioned status, not a fake account.
7. No production database migration, no deployment, no test tenant activation in this PR.

## Pro demo account and trial activation once the owner registers the test tenant

An authorized administrator verifies the new tenant ID and applies the schema migration through the normal migration review/deployment flow. The administrator then explicitly grants a bounded trial entitlement, with a time interval chosen by the owner:

```sql
-- Admin-only example; never execute without verifying target tenant_id.
insert into public.orvix_pro_entitlements
(tenant_id, tier, status, settle_enabled, shift_reports_enabled,
 cashier_accountability_enabled, park_sale_enabled, starts_at, expires_at, notes)
values
('<verified-new-tenant-uuid>'::uuid, 'pro', 'trial', true, false,
 false, false, now(), now() + interval '10 days', 'Authorized isolated test tenant')
on conflict (tenant_id) do nothing;
```

**Do not copy into production without selecting the exact authorized test tenant.** Do not set the other three feature flags true until backend, permissions, UI and end-to-end tests are complete.

## Release sequence (PR #39 first, then Pro)

1. Verify the independent [prior-fixes PR #39](https://github.com/gospeltrak/Jasper-Business-Suite/pull/39) CI and visual/mobile testing of POS button overlap, product saving, Delivery payment accounting, notifications and treasury reports; secure approval before its own merge/deploy. The Pro draft is based on main and **must not release ahead of PR #39**.
2. Complete secured, branch-specific server-side shifts, counted cash, actual Treasury accounts, transfers and two-party handover, with authoritative reports; never reintroduce local browser financial ledgers.
3. Integrate HR accountability and pending orders after shift/settlement tests pass.
4. Provision one separate owner-approved Pro demo tenant with a verified email/password and bounded trial; never reuse an existing business or generate an unverified login. Full cross-device E2E and regression tests.
5. Vercel deployment only when the user explicitly approves release and quota/capacity permits; no automatic deployment.

## Acceptance criteria before production

- All base plans including Tanzanite and standard trials show Receipts, Debts and Quotes but **not Settle**.
- Only an active, unexpired, explicitly provisioned Orvix Pro tenant sees Settle.
- Revoked, suspended or expired Pro entitlement immediately blocks all Pro server operations, not merely hides tabs.
- Server-side financial mutations must have their own authorization checks, atomic double-entry, idempotency, branch-scoping and audit events before the Pro Settle operation is exposed live.
- Settle, Manager Review and staff records cannot be edited/deleted to erase discrepancies.
- PDF exports and receipts do not lose branch, seller, shift or timestamp attribution.
- New test tenant is isolated; no existing tenant data changes.
- Branch switch changes data scope; never combine branches.
- Regression test the legacy subscriptions, POS, invoices, payments and existing PR #39 release before launch.

## Important current limitation

The original Settle form was retired from the Pro view because it auto-filled Actual Cash Counted to Expected Cash and generated fake 'double-entry' bank movements in browser storage using hardcoded account references. The replacement compact Pro Settle view has manual cash counting and branch-scoped configured-account selection, but its actions are explicitly **preview-only**. No settlement, transfer or shift handover is reported saved until the server's normalized, authorization-checked transactional ledger is implemented and tested. Historical browser-only records are neither deleted nor imported as verified financial history.

## Pro Edge (future scope; do not build in initial cloud-only release)

- Future design: customer LAN switch connects to Pro Edge, POS tills and manager PCs; all application data available from Pro Edge using an authorized local address. Pro Edge syncs with Orvix Cloud whenever available. Security stays within the server through encrypted storage, access controls, HTTPS and a host firewall, without a dedicated security appliance being mandatory.
- Do **not** buy hardware, implement local cloud replication, require local servers, or change the main platform topology in the first Pro UI/UX iteration.
