# STEP 1 — Inspection Report
## Document Engine, PDF Consistency, Purchase Persistence & Report Redesign

**No code has been modified.** This is a read-only architecture trace against a fresh clone of `main` (commit `978acdd`). Per `CLAUDE.md` / `docs/DEVELOPMENT_RULES.md`, this report is the "inspect first" deliverable — implementation waits for explicit approval, stage by stage.

---

## PART A — Purchases Disappearing After Refresh

### 1–2. Purchase save flow (actual architecture)

There is **no relational `purchases` table and no `/api/purchases` backend route.** Confirmed by grep across `server.ts` and `api/` — zero purchase-specific endpoints exist. Purchases live entirely inside a single JSON blob, the same way sales/expenses/deliveries do:

```
DashboardPurchases.tsx (form, cart, handleCommitPurchase)
  → onAddPurchase(purchase)                         [prop from Dashboard.tsx]
  → Dashboard.tsx: handleAddPurchase(purchase)
      → setPurchasesMap(prev => ...)                [React state, immediate UI update]
      → saveData(tenantId, 'purchases_map', ...)     [LEGACY path → tenant_data table — see finding A below]
  → Dashboard.tsx persistence useEffect (~line 760, dep: purchasesMap + 10 other state maps)
      → saveTenantWorkspace(tenantId, { ...purchases: purchasesMap[tenantId], ... })
          → src/utils/tenantWorkspace.ts: saveTenantWorkspaceNow()
              → upsert into tenant_workspaces.payload   [CANONICAL source of truth]
```

On reload: `loadTenantWorkspace()` reads `tenant_workspaces.payload.purchases` (canonical). It only falls back to the legacy `tenant_data` table if the canonical row is completely empty.

### 3. Root cause assessment

I traced `saveTenantWorkspaceNow()` and `reconcileProtectedWorkspace()` line by line for the purchases key specifically:

- `purchases` **is** in `protectedArrayKeys` (tenantWorkspace.ts) — an incoming empty array can never silently wipe existing purchases. This protection was added earlier when the same class of bug was fixed for sales/expenses/deliveries.
- `purchases` is **not** in `appendMergeWorkspaceKeys` — it is replace-on-save (correct; purchases must support deletion, so union-merge would be wrong here, same reasoning already applied to sales/expenses).
- `handleAddPurchase` / `handleUpdatePurchases` / `handleDeletePurchase` all correctly set `localWorkspaceChangedAtRef.current` and `cloudWorkspaceLoadedRef.current = true` before the state update — this is the same 30-second local-protection mechanism that guards sales/expenses from being clobbered by the 5-second live-poll or realtime subscription while a save is in flight.
- The write is serialized through the per-tenant `workspaceSaveQueue` (the same queue that fixed the earlier sales/expenses race), so two overlapping saves cannot complete out of order and overwrite each other.
- RLS on `tenant_workspaces` is `USING (true)` for select/insert/update (`supabase_migration.sql`) — not tenant-scoped, but also **not blocking** reads or writes. Ruled out as a read-back cause.

**Conclusion: the canonical save/load path for purchases is structurally sound and already benefits from the write-queue + protected-keys fix applied earlier to sales/expenses.** I cannot find a code path where a successfully-saved purchase would be dropped on reload. This means either (a) the bug is timing-dependent and I'm missing a specific trigger, or (b) it was already fixed as a side effect of the earlier sales/expenses work and needs to be re-confirmed live, or (c) it is caused by finding A below in combination with a specific sequence I can't fully verify without a live repro.

### Finding A — Redundant legacy dual-write (concrete, confirmed risk)

`handleAddPurchase`, `handleUpdatePurchases`, and `handleDeletePurchase` (Dashboard.tsx, ~lines 1976–2029) each still call:

```ts
saveData(activeTenant.id, 'purchases_map', updated);
```

This pushes to the **old** `tenant_data` table, in parallel with the canonical `saveTenantWorkspace()` write that the shared persistence effect performs a moment later. This is precisely the dual-pipeline pattern that caused the original sales/expenses/deliveries resurrection bug (commit `5067650`) — for those keys, the redundant call was **removed** entirely and the union-merge was stripped from `APPEND_MERGE_DATA_KEYS`. Purchases never received the same cleanup: the union-merge was correctly removed from `APPEND_MERGE_DATA_KEYS` (`recordSync.ts`), but **the redundant `saveData(...)` call itself was left in place** for purchases only.

On its own this legacy write is inert (nothing reads `tenant_data.purchases_map` back into the app unless the canonical row is entirely empty), but it is dead weight, it is the exact anti-pattern already proven dangerous once in this codebase, and it's the single clearest actionable lead. **Recommendation for Stage 1: remove the three `saveData(activeTenant.id, 'purchases_map', ...)` calls**, exactly mirroring what was already done for sales/expenses/deliveries, and add a regression test (same style as `tenantWorkspace.race.test.ts`) for purchases specifically.

### What Stage 1 must still do before I'm confident this is fully closed
- Add server/console instrumentation (or ask you to reproduce once with browser dev tools open) to confirm whether `saveTenantWorkspace` for purchases is actually reaching the network successfully in the failing case, or whether it's a refresh-before-save-completes timing issue (expected behavior for any such app, not a bug).
- Confirm Money & Bank ledger entries created from a paid purchase (`paidFromAccountId`) go through the same canonical save and aren't a fourth, separate write path — I did not find a distinct purchase→ledger write function; `DashboardCashBank.tsx` appears to read purchases directly for its ledger view rather than storing a duplicate transaction, but this needs a closer pass in Stage 1 before touching anything.

---

## PART B — Document Engine, PDF, Preview, Print, WhatsApp

### 4–7, 12, 14. Why Preview/Download/Print/WhatsApp all differ — root cause found

There are **three separate, independently-maintained rendering engines** in `src/utils/pdfShare.ts` (880 lines) and `src/utils/whatsapp.ts` (77 lines), no single source of truth:

**Engine 1 — Hand-coded vector jsPDF** (`createReceiptPdfFromData`, `createPosReceiptPdfFromData`, lines 125–389). Draws the receipt from scratch using jsPDF text/line/rect primitives, built from a `ReceiptData` struct — it never looks at the on-screen Preview DOM at all. Used for POS receipts. This is a **manually maintained duplicate** of whatever the Preview component renders; any visual change to the Preview component does not propagate here. This is the direct cause of Issue 9 ("Preview looks better than Download" for POS receipts).

**Engine 2 — Real screenshot** (`createVisualA4Pdf`, lines 664–730, used when `visual: true`). Clones the actual Preview DOM node, waits for fonts/images to load, renders it with `html2canvas` at 2x scale, slices into A4 pages, embeds as JPEG. This **is** faithful to Preview because it literally is Preview, pixel-for-pixel. Delivery Notes use this path (`elementId: 'delivery-note-print-area'`, confirmed to be the *same* DOM node the user sees in the on-screen Preview modal — not a separate hidden template).

**Engine 3 — DOM-to-text reconstruction** (inside `createPdfFromElement`, used when `visual: false`). Does **not** use html2canvas. It walks the DOM with `querySelectorAll('h1,h2,...,table,img')`, extracts raw text, and re-draws it into jsPDF using heuristics: font size chosen by HTML tag name, bold applied only if the text matches a hardcoded regex (`/total|balance|invoice|receipt|delivery note|quotation|proforma/i`), table layout rebuilt by a separate `drawTable` helper. **Reports use this engine** (`printActiveReportPdf` explicitly passes `visual: false`). This is a crude approximation of the real layout and is the direct, confirmed cause of Issue 8 ("Current report PDFs are poorly arranged") — it was never meant to be pixel-faithful, it's a fallback text extractor.

**This answers point 12 directly**: Preview and Download differ because, depending on which document type you're looking at, Download either (a) never looked at Preview's markup in the first place (Engine 1), or (b) is a lossy heuristic reconstruction of it (Engine 3). Only documents routed through Engine 2 are guaranteed to match Preview.

**Print** (`printPdfFromElement`) and **WhatsApp** (`shareElementPdfToWhatsApp`) both call the same `createPdfFromElement` used for Download, so whichever engine Download uses, Print and WhatsApp inherit — meaning Print/WhatsApp consistency with Download is already correct *within* a given document type; the inconsistency is Preview-vs-everything-else, and it varies by which engine that document type happens to be wired to.

### 8. WhatsApp sharing architecture — additional confirmed issue

`shareElementPdfToWhatsApp` / `createPdfFromElement` require the target element (e.g. `#delivery-note-print-area`) to already be mounted in the DOM (`document.getElementById`). If a user triggers "Share via WhatsApp" without first opening the Preview modal, `getElementById` returns `null` and the call throws — the code's own catch block surfaces this as *"Open the delivery note preview first so the PDF can be created."* (`DashboardDeliveries.tsx` line ~592). This is a real, reproducible failure mode for Issue 2 if WhatsApp share is reachable from anywhere the preview isn't already open (e.g. a list-row action menu). Needs confirmation of exactly which entry points can trigger this without the preview being mounted.

### 13. Existing PDF libraries
`jspdf@^4.2.1`, `html2canvas@^1.4.1`. No `pdf-lib`, no `@react-pdf/renderer`. These are sufficient for a single-engine redesign (Engine 2's approach — real screenshot of the actual Preview DOM — is the one to standardize on, since it's the only one that's structurally guaranteed to match Preview).

---

## PART C — Business Name, Logo, Footer, TRA/VFD/EFD

### 9–11. Business Name source — canonical utility exists but is barely used

`src/utils/businessBranding.ts` exports `getBusinessDisplayName(tenant, settings, userName)` — correctly prioritizes the registered business name and explicitly filters out `company.companyName` and user-derived names, falling back to a generic `'My Business'` string rather than ever substituting tenant name. Comment states: *"intentionally different from tenant.name, companyName and user.name."*

**This utility has exactly one caller in the entire codebase** (`DashboardOverview.tsx`). Everywhere else, each component reimplements its own ad-hoc fallback chain, and most of them **do fall back to `activeTenant.name` (tenant name)** — the exact thing the rules say must never happen. Confirmed at minimum in:

- `DashboardReports.tsx:119` — report PDF branding
- `DashboardPOS.tsx:309,361,2125` — receipt data, WhatsApp message, on-screen POS header
- `DashboardForecasting.tsx:411,652`
- `DashboardSalesList.tsx:337,345,855,884,949,3221,3416,3419,3446,3548,5216` — invoices, quotations, receipts, WhatsApp messages (11 separate occurrences in one file)
- `DashboardDeliveries.tsx` WhatsApp message uses `activeTenant.name` directly, no fallback chain at all

There is also a **second settings field** that adds confusion: `SystemSettings.company.companyName` (legacy `CompanySettings`) vs `SystemSettings.business.businessName` (current `BusinessSettings`) vs `Tenant.businessName` (a field on the tenant record itself, which `getBusinessDisplayName` actually treats as the *highest*-priority source). Three possible name sources exist; most call sites only check one or two of them, inconsistently.

### 9. Logo loading — also fragmented

At least five different field paths are referenced across the codebase for "the logo": `business.businessLogoLight`, `business.businessLogoDark`, `business.businessLogo`, `business.logo`, `company.logo`, and `activeTenant.company_settings?.logo_url` (confirmed together in `DashboardReports.tsx`'s report branding object alone). `TenantLogoContext.tsx` (the context used for app chrome/sidebar) resolves it more narrowly via `business.businessLogoLight || business.businessLogoDark || business.businessLogo` directly from the cloud workspace — this is the closest thing to a canonical resolver, but document/PDF code does not consistently use it.

### 10. Footer — six distinct variants found in production code

| Text | Location |
|---|---|
| `Thank you for your business!` | `pdfShare.ts:362` (POS receipt PDF) |
| `Powered by Ndiva Suite` | `pdfShare.ts:364` (same function — inconsistent brand name vs. "Jasper" used elsewhere) |
| `Thank you for shopping with us!` | `DashboardPOS.tsx:2250` (on-screen POS preview) |
| `Thank you for shopping with us! Powered by: jasper.africa` | `DashboardSalesList.tsx:3398` |
| `Thank you for doing business with us.` | `DashboardSalesList.tsx:338` (default fallback) |
| `Thank you.` | `DashboardSalesList.tsx:3719`, `whatsapp.ts:61` |

"Powered by" alone has 6 further independent occurrences (`DashboardReports.tsx`, `DashboardPOS.tsx` ×2, `DashboardSalesList.tsx` ×4, `pdfShare.ts` ×2), phrased as "Powered by Jasper", "Powered by: jasper.africa", and "Powered by Jasper Business Suite" — three different strings for the same concept. One report-context footer (`DashboardSalesList.tsx:5346`, comment: *"Footer — poweredBy only, no tagline/thank you message"*) already correctly follows the report-footer rule the request describes — this can be used as the reference pattern.

### 15–16. TRA / VFD / EFD — scope is larger than "remove some labels"

This is not a handful of labels; it is a full simulated "fiscal receipt" feature baked into checkout across **eight files**: `DashboardPOS.tsx`, `DashboardRestaurant.tsx`, `DashboardSandboxVerticals.tsx`, `DashboardReports.tsx`, `DashboardSalesList.tsx`, `DashboardWhiteLabel.tsx`, `SaaSHardwareSales.tsx`, `SaaSHardwarePOS.tsx`. Each independently generates a fake `vfdControlNo` / `vfdSignature` (e.g. `'TZ-VFD-TRA-' + random digits`) and renders a "TRA VFD FISCAL RECEIPT" block with a **hardcoded fake serial number that is identical in every file** — `TZ-VFD-REG-847294B` — plus copy like *"Registered with Tanzania Revenue Authority Gateway VFD Server."* None of this is a real TRA/EFD integration; it's decorative and fabricated. Removing it is safe (no real fiscal-device API call exists to break) but it's a **~8-file, ~40-occurrence removal**, not a quick find/replace, because the VAT rate/calculation logic (`activeTenant.taxRate`, VAT toggle) is interleaved with the fake-fiscal-badge JSX in the same blocks and must be preserved.

**Important scope boundary I want to flag before Stage 12**: `TRA` also appears legitimately in `AffiliatePortal.tsx`, `TermsTranslations.tsx`, `SaaSHRMView.tsx`, and `SaaSReportsView.tsx` in the context of real affiliate-commission withholding tax compliance — unrelated to fiscal receipts/EFD devices, and not part of "Invoices, Receipts, Delivery Notes, Reports, PDFs..." per the request's own scope list. **I will leave these untouched** unless you say otherwise; flagging so it isn't accidentally swept up in a broad find/replace.

---

## Affected files (by stage, for your approval)

- **Stage 1 (Purchases):** `src/components/Dashboard.tsx` (remove 3 redundant `saveData` calls). New test file alongside `src/utils/tenantWorkspace.race.test.ts`.
- **Stage 2 (Unify rendering engine):** `src/utils/pdfShare.ts` (consolidate Engines 1 & 3 into Engine 2's DOM-screenshot approach); call sites in `DashboardPOS.tsx`, `DashboardSalesList.tsx`, `DashboardReports.tsx`, `DashboardDeliveries.tsx`.
- **Stage 3 (Business Name):** `src/utils/businessBranding.ts` (already correct — reuse everywhere), plus every call site listed above in Part C.
- **Stage 4 (Logo):** `src/TenantLogoContext.tsx` resolver logic reused/exported for document code; same call sites as Stage 3.
- **Stage 5 (Delivery Note header):** `src/components/DashboardDeliveries.tsx` (`#delivery-note-print-area` markup).
- **Stage 6 (WhatsApp PDF):** `src/utils/pdfShare.ts`, `src/components/DashboardDeliveries.tsx`.
- **Stages 7–10 (POS Receipt, A4 Invoice, Quotations, Receipts):** `src/components/DashboardPOS.tsx`, `src/components/DashboardSalesList.tsx`.
- **Stage 11 (Report PDFs):** `src/components/DashboardReports.tsx`, `src/utils/pdfShare.ts` (switch reports from `visual:false` Engine 3 to the unified engine).
- **Stage 12 (TRA/VFD/EFD):** `DashboardPOS.tsx`, `DashboardRestaurant.tsx`, `DashboardSandboxVerticals.tsx`, `DashboardReports.tsx`, `DashboardSalesList.tsx`, `DashboardWhiteLabel.tsx`, `SaaSHardwareSales.tsx`, `SaaSHardwarePOS.tsx` — VAT logic preserved, fiscal-badge JSX removed.

## Risk assessment

- **Purchases fix (Stage 1):** low risk, small diff, directly mirrors an already-proven pattern (sales/expenses fix). Main risk is that it may not be the *complete* fix if there's a timing-based cause I haven't reproduced — recommend confirming live after Stage 1 before considering it closed.
- **Rendering engine unification (Stage 2):** highest risk/impact stage. Touches every document type. Needs to be done as its own isolated stage with wide before/after visual testing (desktop/tablet/mobile, all document types) before any of Stages 5–11 build on top of it.
- **Business Name / Logo (Stages 3–4):** medium risk purely due to the *number* of call sites (15+), not complexity — mechanical but must be done file-by-file with verification each time, not a blind find/replace, since some fallback chains differ slightly (e.g. delivery snapshot business names for branch-specific documents).
- **TRA/VFD/EFD removal (Stage 12):** medium risk because fake-fiscal JSX is interleaved with real VAT-calculation JSX in the same blocks in 8 files; must isolate and remove only the fiscal-badge presentation, not the tax math.
- **Multi-tenant/branch isolation:** nothing found in this inspection that crosses tenant boundaries; all data access is consistently scoped by `tenant_id`/`activeTenant.id` in the code paths reviewed.

## Implementation plan
Proceeding exactly per the 13-stage plan you specified, one stage at a time, localhost verification + your explicit approval before moving to the next stage, and no `git push`/merge/deploy until you approve each one.

**Waiting for your approval to begin Stage 1.**
