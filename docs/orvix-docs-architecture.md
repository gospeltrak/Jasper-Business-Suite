# Orvix Docs — Document Generation & Management Module

Status: **proposal / not yet implemented.** Nothing in this document has been
built. It exists so the module can be reviewed and approved in stages before
any code is written, per this repo's development rules.

Product surface: `docs.orvix.africa` and `{tenant}.docs.orvix.africa`, living
inside the same Vercel project and GitHub repo as the main Orvix POS/ERP, but
with its own isolated database.

---

## 0. Decisions this doc assumes (read this first)

The original spec has a few points that need a small correction against what
already exists in this codebase. These are the calls made below — flag if any
of them should go differently before implementation starts.

1. **"Completely separate database" = a second Supabase *project*, same
   Supabase organization/account.** Supabase does not offer multiple
   independent databases inside one project the way MySQL offers multiple
   schemas-as-databases; one project = one Postgres instance. A second
   project under the same account gives real isolation (own Postgres
   instance, own connection pooler, own service-role key, own quota/billing)
   while still showing up in the same Supabase login next to the existing
   `orvix-pos-erp` project — which is what "niweze kuona account zote"
   requires. (A lower-effort alternative — a second Postgres *schema* inside
   the existing project — is technically possible and this repo's Prisma
   setup already supports multiple schemas, see `prisma/schema.prisma`. It's
   noted below as Option B, but it shares the one Postgres instance/pooler
   with tenant business data, which is a weaker isolation guarantee than a
   second project.)

2. **No Nginx.** This app has no reverse proxy of its own — it's a single
   Vercel project with one serverless Express function
   (`api/router.ts`) and file-based routing. Wildcard subdomains are already
   solved once in this exact codebase for `*.orvix.africa`
   (`api/tenant/resolve.ts`, `api/tenant/_domainUtils.ts`,
   `docs/ndiva-wildcard-domains.md`). Orvix Docs reuses that same mechanism
   instead of introducing a second routing technology.

3. **All five document types already exist.** POS Receipt, Sales Invoice,
   Delivery Note, Quotation, and Proforma Invoice (the last two both live
   inside "Quotes & Invoices" in `DashboardSalesList.tsx`,
   `getDocumentLabel()` at line 330 distinguishing the two) are already live
   features inside the core ERP (`DashboardPOS.tsx`, `DashboardSalesList.tsx`,
   `DashboardDeliveries.tsx`), and already share one screenshot-based PDF
   engine (`src/utils/pdfShare.ts`) with logo injection. **There is no net-new
   document type here at all** — Orvix Docs would fully overlap the ERP's
   existing document generation feature-for-feature. Building it as a
   parallel generator that ignores this would mean two independent places
   that can render a "Sales Invoice" and drift apart. The recommendation
   below is to extract the existing render engine into a shared package both
   the ERP and Orvix Docs import, rather than write a second one from
   scratch. Given there's no new document type to justify a new module on
   its own, the only thing that actually makes Orvix Docs a distinct
   product is the **freemium/watermark + Premium invoice-tracking layer**,
   opened to **anyone who wants to self-register** — confirmed: Orvix Docs
   is a standalone, publicly self-serve product, not gated behind an
   existing Orvix POS/ERP account. That reframing — new monetization + a
   new, wider audience, on top of entirely existing document logic — is
   what this doc is architected around below. It also means Orvix Docs
   needs its **own account/identity system** (`DocsUser`, section 2), not
   just a `DocsTenant` created by the bridge from an existing ERP tenant —
   an existing ERP tenant linking their account is now the *optional* path,
   not the only path.

4. **Billing for the 5,000 TZS Premium unlock reuses the existing manual
   activation flow**, not a new payment gateway. The ERP already has one:
   `SubscriptionState` / `manualActivationReceipt` /
   `SaaSStatusAndRequests.tsx` — a user uploads WhatsApp/receipt proof of
   payment, an admin approves it, the account flips to Premium. There is no
   live mobile-money/card gateway wired into this codebase today (the
   `clickpesa`/`selcom`/`mpesa` strings that exist are just POS payment-method
   labels, not an integration). Reusing the manual-approval pattern for v1
   avoids adding a new payment integration before the module is even
   validated.

5. **Prisma-first is fine here**, unlike the rest of this codebase.
   `docs/prisma-supabase-adoption.md` deliberately keeps Prisma to a narrow
   control-plane slice of the *existing* tenant database and leans on
   Supabase RLS/RPC for everything else — because that database already has
   years of RLS policy investment and a large blast radius. Orvix Docs'
   database has neither: it's new, small, and single-purpose, so Prisma can
   be the primary and only ORM for it from day one. Row Level Security
   should still be enabled on its tables as defense in depth (Supabase
   convention), even though the app talks to it through Prisma with a
   service-role-equivalent connection, not through PostgREST.

6. **New Docs API routes are registered inside the existing Express app
   (`server.ts`), not shipped as new standalone Vercel functions**, except
   the one lightweight `resolve` endpoint (matching the existing
   `api/tenant/resolve.ts` pattern, kept standalone because it runs on
   every page load and shouldn't pay to import the whole app just to answer
   a host lookup). Every other Docs route — `generate`, `documents`,
   `settings`, `billing`, `auth/google/*` — is added as
   `app.get/post(...)` inside `server.ts` (organized into a separate
   `registerDocsRoutes(app)` module for readability, but still one Express
   app, one Vercel function). This is both a security and a cost decision:
   it inherits `blockIpMiddleware`, `securityHeaders`, `rateLimit`,
   `logSecurityThreatEvent`, and the safe-error helpers for free instead of
   re-implementing or forgetting them on a second function, and it avoids
   paying for a second serverless cold start on every request. See sections
   9–10.

---

## 1. System architecture

```
                         ┌─────────────────────────────┐
                         │        Vercel project        │
                         │      (one repo, one deploy)   │
                         └───────────────┬───────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
        orvix.africa /            docs.orvix.africa /      api/router.ts
     {tenant}.orvix.africa   {tenant}.docs.orvix.africa    (shared Express
        → existing App.tsx      → new docs-app entry         function, both
          + Dashboard              (own SPA shell)            surfaces' APIs
                                                               mount here)
                 │                       │
                 ▼                       ▼
     ┌─────────────────────┐   ┌──────────────────────────┐
     │  Supabase project:   │   │  Supabase project:        │
     │  orvix-pos-erp       │   │  orvix-docs                │
     │  (existing, RLS/RPC) │   │  (new, Prisma-first, RLS)  │
     └──────────┬────────────┘   └───────────┬────────────────┘
                │                             │
                │        server-to-server, authenticated       
                └──────────────►  api/docs-bridge/*  ◄──────────┘
                    (only for accounts that link an ERP tenant —
                     optional prefill, never a cross-project DB
                     query; a walk-in self-signup never calls this)
```

Both Supabase projects sit under the same Supabase account/organization, so
they're both visible from one login — but each has its own connection
string, its own service-role key, and its own migration history. Nothing is
shared at the database layer. The only integration point is HTTP, over a
new, narrow, authenticated bridge API added to the *existing* app
(`api/docs-bridge/customers`, `api/docs-bridge/items`,
`api/docs-bridge/tenants/:id`) that returns only what a document needs
(name, contact, price, tax) — never a full table dump.

### Folder structure (proposed)

```
Jasper-Business-Suite/
├── api/
│   ├── docs/                      # NEW — docs.orvix.africa API routes
│   │   ├── resolve.ts             # tenant/host resolution, mirrors api/tenant/resolve.ts
│   │   ├── generate.ts            # POST /api/docs/generate
│   │   ├── documents/
│   │   │   ├── [id].ts            # GET/PATCH one document (status updates)
│   │   │   └── index.ts           # GET list (Premium tracking dashboard)
│   │   ├── settings/
│   │   │   └── logo.ts            # POST /api/docs/settings/logo
│   │   └── billing/
│   │       └── activate.ts        # manual Premium activation (reuses SaaS pattern)
│   ├── docs-bridge/                # NEW — narrow read-only API the ERP exposes
│   │   ├── customers.ts            # called BY the docs backend, not the browser
│   │   ├── items.ts
│   │   └── tenants/[id].ts
│   └── tenant/                     # existing, untouched
│
├── docs-engine/                    # NEW — the shared rendering core
│   ├── prisma/
│   │   ├── schema.prisma           # own datasource, own generated client
│   │   └── migrations/
│   ├── src/
│   │   ├── db.ts                   # Prisma client for the orvix-docs project
│   │   ├── templates/
│   │   │   ├── DocumentShell.tsx   # shared header/footer/logo/watermark frame
│   │   │   ├── PriceQuotation.tsx
│   │   │   ├── ProformaInvoice.tsx
│   │   │   ├── SalesInvoice.tsx
│   │   │   ├── PosReceipt.tsx
│   │   │   └── DeliveryNote.tsx
│   │   ├── render.ts               # the one engine: data + type → PDF
│   │   └── tiers.ts                # free vs premium gating logic
│   └── package.json                # local package, imported by both api/docs/* and the docs SPA
│
├── src/
│   ├── docs-app/                   # NEW — the docs.orvix.africa React SPA
│   │   ├── DocsApp.tsx             # entry, mounted only on the docs subdomain
│   │   ├── pages/
│   │   │   ├── Generate.tsx
│   │   │   ├── InvoiceTracking.tsx # Premium-only dashboard
│   │   │   ├── Settings.tsx        # logo upload, branding
│   │   │   └── Billing.tsx
│   │   └── components/             # KPI cards / action menus copied in
│   │       └── ...                 #   style, not copy-pasted logic, from
│   │                               #   the existing Dashboard.tsx patterns
│   └── utils/
│       └── pdfShare.ts             # existing engine — docs-engine/render.ts
│                                    #   wraps the same screenshot-to-PDF
│                                    #   approach instead of reinventing one
│
└── docs/
    └── orvix-docs-architecture.md  # this file
```

`docs-engine` is deliberately a plain local package (own `package.json`,
imported via a workspace/relative path — no need for a monorepo tool like
Turborepo for something this size) so the render logic and the Prisma client
for the `orvix-docs` database are usable from both the API routes and,
later, a script/CLI if one is ever needed, without duplicating code.

---

## 2. Database schema — `orvix-docs` Supabase project

Prisma schema, `docs-engine/prisma/schema.prisma`. This is a **separate**
`schema.prisma` from the main app's — separate generated client, separate
`DATABASE_URL_DOCS`/`DIRECT_URL_DOCS` env vars, separate migration history.

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/docs-client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_DOCS")
  directUrl = env("DIRECT_URL_DOCS")
}

// One row per Orvix Docs account. Self-registration is the primary path —
// erpTenantId is nullable and only set if the person chooses to link an
// existing Orvix POS/ERP business. Deliberately no FK into the main app's
// tenants table — there is no DB link between the two projects, just a UUID
// copied at link time, resolved again via api/docs-bridge/tenants/:id.
model DocsTenant {
  id           String   @id @default(uuid())
  erpTenantId  String?  @unique @map("erp_tenant_id") // nullable: only set for linked ERP accounts
  slug         String   @unique // {slug}.docs.orvix.africa
  displayName  String   @map("display_name")
  createdAt    DateTime @default(now()) @map("created_at")

  users        DocsUser[]
  subscription Subscription?
  settings     DocsSettings?
  documents    Document[]

  @@map("docs_tenants")
}

// A person who signed in — via the same Google OAuth Orvix POS uses, or via
// email/password on this project's own Supabase Auth. This is DocsAuth's
// own identity, not a copy of an ERP user row (see section 9): a walk-in
// signup has no ERP account to copy from at all.
model DocsUser {
  id              String    @id // == auth.users.id in the orvix-docs Supabase project
  tenantId        String    @map("tenant_id")
  tenant          DocsTenant @relation(fields: [tenantId], references: [id])
  email           String    @unique
  name            String?
  authProvider    AuthProvider @map("auth_provider")
  role            DocsRole  @default(OWNER) // OWNER for now; STAFF reserved if team seats are added later
  createdAt       DateTime  @default(now()) @map("created_at")
  lastSignInAt    DateTime? @map("last_sign_in_at")

  @@index([tenantId])
  @@map("docs_users")
}

enum AuthProvider {
  GOOGLE
  PASSWORD
}

enum DocsRole {
  OWNER
  STAFF
}

model Subscription {
  id            String    @id @default(uuid())
  tenantId      String    @unique @map("tenant_id")
  tenant        DocsTenant @relation(fields: [tenantId], references: [id])
  tier          Tier      @default(FREE)
  activatedAt   DateTime? @map("activated_at")
  activatedBy   String?   @map("activated_by") // admin user id who approved it
  proofFileUrl  String?   @map("proof_file_url") // WhatsApp/receipt screenshot, manual approval flow
  amountPaidTzs Int?      @map("amount_paid_tzs")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@map("subscriptions")
}

enum Tier {
  FREE
  PREMIUM
}

model DocsSettings {
  id           String    @id @default(uuid())
  tenantId     String    @unique @map("tenant_id")
  tenant       DocsTenant @relation(fields: [tenantId], references: [id])
  logoUrl      String?   @map("logo_url")
  primaryColor String?   @map("primary_color")
  footerNote   String?   @map("footer_note")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@map("docs_settings")
}

// PREMIUM ONLY. This table is never written to for a FREE-tier generation —
// see section 10. There is deliberately no Product/Item catalog model
// anywhere in this schema: a user types their items into the document form
// fresh every time (name, qty, price — free text, not a saved, reusable
// catalog row). What persists, for Premium, is the resulting document with
// that item data snapshotted inside it — never a separate reusable product
// list. This keeps Orvix Docs from quietly growing into a second product
// catalog the ERP would need to stay in sync with.
model Document {
  id            String       @id @default(uuid())
  tenantId      String       @map("tenant_id")
  tenant        DocsTenant   @relation(fields: [tenantId], references: [id])
  type          DocumentType
  documentNo    String       @map("document_no") // e.g. QUO-0001, PI-0001, INV-0001
  status        DocumentStatus @default(DRAFT)
  paymentStatus PaymentStatus? @map("payment_status") // null for quotations/receipts

  // Snapshot of the customer/item data as typed into the form at generation
  // time. Not a foreign key to anything — there is nothing to reference.
  customerSnapshot Json  @map("customer_snapshot")
  itemsSnapshot    Json  @map("items_snapshot")
  totals           Json  // subtotal, tax, discount, grand total

  pdfUrl        String   @map("pdf_url") // Supabase Storage object, always set (row only exists for Premium)
  createdBy     String   @map("created_by") // DocsUser.id
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  payments      DocumentPayment[]

  @@index([tenantId, type])
  @@index([tenantId, status])
  @@map("documents")
}

enum DocumentType {
  QUOTATION
  PROFORMA_INVOICE
  SALES_INVOICE
  POS_RECEIPT
  DELIVERY_NOTE
}

enum DocumentStatus {
  DRAFT
  ISSUED
  VOID
}

enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  FULLY_PAID
}

// Premium-only: tracking partial payments against an invoice over time.
model DocumentPayment {
  id          String   @id @default(uuid())
  documentId  String   @map("document_id")
  document    Document @relation(fields: [documentId], references: [id])
  amountTzs   Int      @map("amount_tzs")
  paidAt      DateTime @map("paid_at")
  note        String?
  recordedBy  String   @map("recorded_by")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([documentId])
  @@map("document_payments")
}
```

Every table also gets a matching `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
migration with a `tenant_id`-scoped policy, even though the app path is
Prisma via a service connection — this is the same defense-in-depth
Supabase already assumes everywhere else in this project, and it means a
leaked anon key can never read across tenants even by accident.

---

## 3. Wildcard routing — resolving `{tenant}.docs.orvix.africa`

Same shape as the existing `api/tenant/resolve.ts`, new file so the two
surfaces stay independently deployable/testable:

`api/docs/resolve.ts`

```ts
import {
  cleanTenantSlug, getBaseDomain, isSafeHostFormat, isTenantSlugValid, normalizeHost
} from '../tenant/_domainUtils.js';
import { getDocsPrisma } from '../../docs-engine/src/db.js';

const DOCS_SUBDOMAIN = 'docs';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const host = normalizeHost(req.query?.host || req.headers['x-forwarded-host'] || req.headers.host);
  const baseDomain = getBaseDomain(); // orvix.africa
  const docsRoot = `${DOCS_SUBDOMAIN}.${baseDomain}`; // docs.orvix.africa

  if (host === docsRoot) {
    // bare docs.orvix.africa — marketing/login landing for the Docs product
    return res.status(200).json({ kind: 'docs-landing', host, baseDomain });
  }

  if (!host.endsWith(`.${docsRoot}`)) {
    return res.status(200).json({ kind: 'not-docs', host, baseDomain });
  }

  // {slug}.docs.orvix.africa
  const slug = host.slice(0, -(docsRoot.length + 1));
  if (!isTenantSlugValid(slug) || !isSafeHostFormat(host)) {
    return res.status(200).json({ kind: 'docs-tenant-not-found', host, message: 'Tenant not found.' });
  }

  const prisma = getDocsPrisma();
  const tenant = await prisma.docsTenant.findUnique({
    where: { slug: cleanTenantSlug(slug) },
    include: { subscription: true, settings: true },
  });

  if (!tenant) {
    return res.status(200).json({ kind: 'docs-tenant-not-found', host, slug, message: 'Tenant not found.' });
  }

  return res.status(200).json({
    kind: 'docs-tenant',
    host,
    slug,
    tenant: {
      id: tenant.id,
      displayName: tenant.displayName,
      tier: tenant.subscription?.tier || 'FREE',
      logoUrl: tenant.settings?.logoUrl || null,
    },
  });
}
```

The frontend side is the same pattern already in `App.tsx`
(`resolveCurrentHost`) — a small `DocsApp.tsx` entry does the equivalent
fetch to `/api/docs/resolve?host=...` on mount and switches between the
docs-landing / docs-tenant-not-found / docs-tenant states.

### DNS / Vercel domains needed (same project, additive)

Following the exact pattern already documented in
`docs/ndiva-wildcard-domains.md`, add to the *same* Vercel project:

```
docs.orvix.africa
*.docs.orvix.africa
```

Both point at the existing nameservers/DNS already in place for
`*.orvix.africa` — no new infrastructure, one extra wildcard record.

### Env vars needed (additive)

```bash
# existing, untouched
APP_BASE_DOMAIN=orvix.africa
SUPABASE_URL=...            # orvix-pos-erp project
SUPABASE_SERVICE_ROLE_KEY=...

# new
DATABASE_URL_DOCS=postgresql://...:6543/postgres?pgbouncer=true   # orvix-docs pooled
DIRECT_URL_DOCS=postgresql://...:5432/postgres                    # orvix-docs direct, migrations only
DOCS_SUPABASE_URL=...        # orvix-docs project, for Storage (uploaded logos, generated PDFs)
DOCS_SUPABASE_SERVICE_ROLE_KEY=...
DOCS_BRIDGE_SHARED_SECRET=... # server-to-server auth between the two API surfaces
```

---

## 4. The document engine

**Status: this section's rendering approach was corrected and Stage 1/2 of
the build order have been implemented** — `docs-engine/prisma/schema.prisma`
(section 2), `docs-engine/src/types.ts`, `docs-engine/src/templates/DocumentShell.tsx`,
`docs-engine/src/templates/A4DocumentBody.tsx`, and `docs-engine/src/render.tsx`
exist in the repo now. The original draft below assumed a server-side
`renderToStaticPdf(element)` — that was wrong: `src/utils/pdfShare.ts`'s
screenshot capture (`createVisualA4Pdf`/`createVisualReceiptPdf`, via
`html-to-image`) runs against a **real mounted DOM element in the browser**
— it needs `document`, `Image.decode()`, Canvas, `document.fonts.ready`,
none of which exist in a Node serverless function without a full
headless-Chromium stack this app doesn't use anywhere else. Generation is
client-side, exactly like the ERP's own receipts/invoices/quotations
already are.

One shared shell + one shared A4 body, covering Quotation, Proforma
Invoice, Sales Invoice, and Delivery Note (POS Receipt is the one type that
needs the separate narrow 57–58mm `createVisualReceiptPdf` capture path
instead of the A4 one — not yet built, deferred to when that type is
reached in the build order) — this is the "single core template system"
the module's original brief asked for.

`docs-engine/src/templates/DocumentShell.tsx` — the 794×1123px A4 white
card (same page geometry `DashboardSalesList.tsx`'s own
`sales-document-a4-pdf-template` already uses), header with logo/business
identity, and the free-tier watermark footer — the one place
ad/watermark logic lives:

```tsx
export function DocumentShell({ elementId, branding, showWatermark, children }: DocumentShellProps) {
  return (
    <div id={elementId} style={{ width: '794px', minHeight: '1123px' }} className="bg-white shadow-2xl font-sans relative">
      {/* logo/business header — see the real file for the full JSX */}
      <div className="flex-1">{children}</div>
      {showWatermark && <p>Made with Orvix Docs — orvix.africa/docs</p>}
    </div>
  );
}
```

`docs-engine/src/templates/A4DocumentBody.tsx` — Bill-To box, items table,
totals, payment details — mirrors the exact Tailwind structure of the
ERP's own quotation/invoice markup (`DashboardSalesList.tsx:5257` onward)
so the two products read as the same design system, parameterized by
`data.type` for the doc-type pill label.

`docs-engine/src/render.tsx` — the glue: mounts `DocumentShell` +
`A4DocumentBody`, then calls `src/utils/pdfShare.ts`'s **existing, unmodified**
`downloadPdfFromElement` / `printPdfFromElement` / `shareElementPdfToWhatsApp`
functions against that mounted element — the exact same functions the ERP
already uses, imported directly, not reimplemented:

```tsx
export const DOCS_DOCUMENT_ELEMENT_ID = 'docs-document-pdf-template';

export function DocsDocument({ data, branding, showWatermark }: DocsDocumentProps) {
  return (
    <DocumentShell elementId={DOCS_DOCUMENT_ELEMENT_ID} branding={branding} showWatermark={showWatermark}>
      <A4DocumentBody data={data} brandColor={branding.brandColor || '#4f46e5'} />
    </DocumentShell>
  );
}

// FREE: render → download. No network call carries the document content
// anywhere — see section 10, "why FREE writes nothing to the database".
export async function downloadDocsDocument(data: DocsDocumentData) {
  return downloadPdfFromElement({ elementId: DOCS_DOCUMENT_ELEMENT_ID, fileName: fileNameFor(data), format: 'a4' });
}

// PREMIUM only: same download, PLUS upload the resulting File to
// POST /api/docs/documents so it lands in the Invoice Tracking dashboard.
// Kept as a separate function so the FREE path can never accidentally grow
// a persistence side effect later.
export async function downloadAndPersistDocsDocument(data: DocsDocumentData) {
  const pdfFile = await downloadDocsDocument(data);
  const body = new FormData();
  body.append('pdf', pdfFile);
  body.append('document', JSON.stringify(data));
  const response = await fetch('/api/docs/documents', { method: 'POST', body });
  if (!response.ok) throw new Error('Could not save this document to your Invoice Tracking dashboard.');
  return response.json();
}
```

`showWatermark` is resolved by the page that mounts `<DocsDocument>` from
the signed-in user's `Subscription.tier` (fetched once at page load, not
re-checked per click) — a Free-tier user can inspect the client bundle, but
there is no server request to replay with a forged tier, because FREE never
calls a server endpoint for the PDF at all; only the optional
persist-to-tracking step is server-verified (section 9/10 — `tier` is
re-read from the database inside that route, never trusted from the
request body).

Whether a generation gets persisted is a separate decision the *page*
makes (call `downloadDocsDocument` vs. `downloadAndPersistDocsDocument`
based on the signed-in tier) — not something the render layer decides.

Reusing `src/utils/pdfShare.ts`'s existing screenshot-to-PDF approach (an
on-screen React element captured to PDF, rather than a second jsPDF
text-redraw pipeline) means Orvix Docs' preview and its downloaded PDF are
guaranteed to match by construction — the same guarantee
`scripts/deployment-contract.test.ts` already locks in for the ERP's own
receipts.

---

## 5. API endpoints

**Docs product surface** (`api/docs/*`, called by the `docs.orvix.africa`
frontend):

| Method | Path | Purpose | Tier gate |
|---|---|---|---|
| GET | `/api/docs/resolve` | tenant-from-host resolution | — |
| POST | `/api/docs/auth/google/resolve` \| `/register` | sign in / register via Google | — |
| POST | `/api/docs/auth/register` \| `/api/docs/auth/login` | email/password sign up + sign in | — |
| POST | `/api/docs/generate` | render a document, stream it back | FREE: watermarked, nothing saved. PREMIUM: no watermark, one `Document` row + Storage upload |
| GET | `/api/docs/documents` | list documents (Invoice Tracking dashboard) | **Premium only** (no rows exist for FREE) |
| GET | `/api/docs/documents/:id` | one document + its payments | Premium for payment history |
| PATCH | `/api/docs/documents/:id/status` | mark paid/partially paid/void | **Premium only** |
| POST | `/api/docs/documents/:id/payments` | record a partial payment | **Premium only** |
| POST | `/api/docs/settings/logo` | upload/replace branding logo | — (both tiers can brand) |
| GET | `/api/docs/settings` | fetch current branding | — |
| POST | `/api/docs/billing/activate` | submit manual payment proof for Premium | — |
| POST | `/api/docs/billing/approve` | admin approves a pending Premium request | admin-only |

**Bridge surface** (`api/docs-bridge/*`, on the *main* app, called
server-to-server by the Docs backend, authenticated with
`DOCS_BRIDGE_SHARED_SECRET` — never exposed to the Docs frontend directly).
Only reachable for accounts that chose to *link* an existing Orvix POS/ERP
business — the default, walk-in self-registration path never calls this at
all, since there's no ERP account to read from:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/docs-bridge/tenants/:erpTenantId` | tenant display name, currency, active status |
| GET | `/api/docs-bridge/customers?tenantId=` | optional prefill: customer list, so a linked account doesn't have to retype a customer they already have in the ERP |
| GET | `/api/docs-bridge/items?tenantId=` | optional prefill: product/service list, same reasoning — still just fills the form, the typed line items are what get snapshotted, not a live catalog reference |

Free-tier vs. Premium gating happens once, in a small `requireTier()` guard
used by the routes marked above — not duplicated per-route.

---

## 6. UI/UX

The Docs SPA (`src/docs-app/`) is a second Vite entry (or a second route
tree loaded only when the resolved host is a `docs.orvix.africa` host —
simplest is `main.tsx` branching on `window.location.hostname` before
deciding whether to mount `<App />` or `<DocsApp />`, so it's still one
build, one deploy).

Component style is copied from the *existing* Dashboard patterns for visual
consistency — same KPI card shape, same action-menu/bottom-sheet pattern on
mobile that was just built for Staff & HR, same settings-page layout
conventions — but as new components under `src/docs-app/components/`, not by
importing `Dashboard.tsx`'s components directly (that file is POS/ERP
business logic, not a design system; importing from it would couple two
products that are supposed to stay independently deployable).

Branding/logo upload (`Settings.tsx` → `POST /api/docs/settings/logo`)
follows the same upload-to-Storage-then-store-URL pattern already used for
branch logos (`src/utils/imageStorage.ts`, `uploadBranchLogo`) — reused as a
pattern, pointed at the `orvix-docs` project's own Storage bucket instead of
the ERP's.

---

## 7. Running this locally, before any DNS/production cutover

Since this is meant to stay local until it's ready:

1. Create the second Supabase project (`orvix-docs`, or a free-tier project
   for local dev only) from the same Supabase account.
2. Add the `DATABASE_URL_DOCS` / `DIRECT_URL_DOCS` / `DOCS_SUPABASE_*` env
   vars to `.env` locally (not Vercel yet).
3. `npx prisma migrate dev --schema docs-engine/prisma/schema.prisma` to
   create the schema in that project.
4. Simulate the subdomain locally the same way the existing tenant system
   already does — `api/docs/resolve.ts` supports the same
   `?portal=docs-tenant&slug=demo`-style override used by
   `api/tenant/resolve.ts` on `localhost`/Vercel-preview hosts, so real
   wildcard DNS isn't needed to develop against it.
5. `npm run dev` serves both surfaces from the one Express dev server, same
   as today.
6. Nothing is exposed publicly until `docs.orvix.africa` / `*.docs.orvix.africa`
   are deliberately added to the Vercel project's Domains settings — that
   single step is the entire "go live" cutover.

No Docker/K8s is needed at any point — the existing app already deploys as
plain Vercel serverless functions + a static SPA build, and Orvix Docs rides
the same deploy.

---

## 8. Suggested build order

Small, reviewable stages, each shippable and testable on its own before the
next starts:

1. **Schema written** (`docs-engine/prisma/schema.prisma`). **Not yet run** —
   the actual `orvix-docs` Supabase project hasn't been created yet
   (deferred by choice); migrations run once it exists and
   `DATABASE_URL_DOCS`/`DIRECT_URL_DOCS` are set.
2. **Done.** `docs-engine` render core: `DocumentShell` + one shared A4 body
   covering Quotation/Proforma/Sales Invoice/Delivery Note, wrapping the
   existing `pdfShare.ts` pipeline unmodified (section 4). Matches the ERP's
   existing PDF output style structurally (same Tailwind classes as
   `DashboardSalesList.tsx`'s own template). Not yet visually confirmed in a
   browser — nothing mounts it on a real page yet, that's stage 6.
3. `api/docs-bridge/*` on the main app — read-only, least-privilege, tested
   for cross-tenant denial (same discipline as
   `docs/prisma-supabase-adoption.md` already requires for the main DB).
4. Self-registration + auth (section 9): Google OAuth reuse, Turnstile reuse,
   `registerDocsRoutes(app)` mounted into `server.ts` inheriting the shared
   security middleware stack. No document generation yet — just prove signup,
   sign-in, and rate limiting work end to end.
5. `api/docs/generate` + the other four templates, Free tier only (always
   watermarked, never persisted to Storage per section 10) — no billing yet.
6. `api/docs/resolve.ts` + `DocsApp.tsx` shell + wildcard routing, tested on
   `localhost`/preview via the `?portal=` override, no real DNS yet.
7. Subscription/Premium: manual activation flow, Invoice Tracking dashboard,
   payment-status endpoints, persisted PDFs for Premium only.
8. Settings/branding (logo upload).
9. DNS + Vercel domains + Google/Turnstile hostname allow-lists (section 9)
   added → first real production cutover.

---

## 9. Self-registration, Google Auth reuse, Turnstile reuse

### Google — same OAuth client, separate identity per project

The ERP's Google sign-in is real Supabase Auth, not custom OAuth code:
`client.auth.signInWithOAuth({ provider: 'google', ... })`
(`src/components/LoginPage.tsx:1357`), then a server route
(`/api/auth/google/provision` or `/resolve`, `server.ts:3766`) reads the
verified identity off the Supabase session and creates/links a profile row.

Because Orvix Docs has its **own** Supabase project (section 0, point 1),
its Google sign-in must go through its **own** Supabase Auth instance — one
Postgres project can't share `auth.users` or sessions with another. "Reuse
the same Google Authentication as POS" concretely means:

- **Reuse the same Google Cloud OAuth Client ID/Secret** — configure that
  identical client in the `orvix-docs` Supabase project's Auth → Providers →
  Google settings too. The user sees the same "Sign in with Google" consent
  screen/app identity on both products; nothing about the login *button*
  changes between them.
- **Add the new redirect URLs** to that Google Cloud OAuth client's
  Authorized redirect URIs, and to the `orvix-docs` project's Supabase Auth
  redirect allow-list (mirroring the existing pattern in
  `docs/ndiva-wildcard-domains.md`):
  ```text
  https://docs.orvix.africa/**
  https://*.docs.orvix.africa/**
  http://localhost:5173/**   (local dev, same as today)
  ```
- **Sessions are independent.** Signing into the ERP does not sign a person
  into Docs and vice versa — each is its own Supabase Auth session/JWT, each
  validated only against its own project. A person with both an ERP account
  and a Docs account authenticates twice (once per product), same as they
  would with any two separate Google-login SaaS products from the same
  company. This is *not* the same as literal single sign-on — flag if true
  SSO (one login, both products) is actually wanted, since that needs a
  different design (Docs trusting an ERP-issued JWT via the bridge, instead
  of having its own `auth.users`).
- New server route, same shape as the existing one:
  `POST /api/docs/auth/google/resolve` — verifies the Supabase session
  (`getGoogleRequestUser`-equivalent, scoped to the `orvix-docs` project),
  creates a `DocsTenant` + `DocsUser` row on first sign-in (no ERP
  tenant/workspace/products/sales rows to seed — Orvix Docs' own signup is
  far lighter than `google/provision`'s current ~50 lines, since there's no
  business catalog to bootstrap).
- Email/password is still offered as a second option (matches the ERP,
  which also has manual/staff sign-in flows) via the same Supabase Auth
  instance's built-in email/password provider — no extra code, just enabled
  in the `orvix-docs` project's Auth settings.

### Turnstile — literally the same site key

Cloudflare Turnstile is a widget/verification pair
(`VITE_TURNSTILE_SITE_KEY` client-side, `TURNSTILE_SECRET_KEY` server-side,
`server.ts:199` `verifyTurnstileToken()`, `server.ts:3590`
`POST /api/auth/turnstile`) — it is **not** tied to one hostname in the
code, only in Cloudflare's dashboard configuration for that site key.

- In the Cloudflare Turnstile dashboard, add `docs.orvix.africa` and
  `*.docs.orvix.africa` as additional allowed hostnames on the **existing**
  site key — no new key, no new secret, no new env var. One widget already
  serves the ERP on several hostnames (`orvix.africa`, `*.orvix.africa`
  etc.) the same way.
- Frontend: reuse `TurnstileWidget` (`src/components/TurnstileWidget.tsx`)
  as-is inside `src/docs-app/` — same component, same
  `VITE_TURNSTILE_SITE_KEY`.
- Backend: since Docs routes are mounted inside the same `server.ts`
  (section 0, point 6), `verifyTurnstileToken()` is called directly — no
  copy, no reimplementation. Gate it on **registration** and **sign-in**
  exactly like the ERP does, plus (new, because Docs allows anonymous-style
  self-registration at volume) on the **generate** endpoint for accounts
  younger than some threshold, as an abuse control — see section 10.

---

## 10. Security parity and API cost/abuse controls

### Security parity checklist

Every new route (Docs surface and bridge surface) must sit behind the same
stack the ERP's routes already get, not a reimplementation of it. Because
Docs routes are registered inside the existing `server.ts` app (section 0,
point 6), most of this is inherited automatically rather than something to
rebuild:

| Control | Existing mechanism | Applies to Docs how |
|---|---|---|
| IP blocklist + threat logging | `blockIpMiddleware`, `logSecurityThreatEvent` (`server.ts:441`) | Automatic — same `app.use()`, same app |
| Per-route rate limiting | `rateLimit({ prefix, windowMs, max })` (`server.ts:458`) | New `app.use('/api/docs/...', rateLimit({...}))` lines, same helper, see table below |
| Response security headers (CSP, X-Frame-Options, etc.) | `securityHeaders` middleware (`server.ts:475`) + `vercel.json` headers block | Automatic — same middleware; add `docs.orvix.africa` wherever a header value is domain-specific |
| Turnstile bot check | `verifyTurnstileToken()` (`server.ts:199`) | Called directly on register/login/generate, no copy |
| Sanitized error responses (never leak DB/internal detail) | `sendExpectedSafeApiError` / `sendUnexpectedSafeApiError` / `toUserFacingError` (`src/utils/safeError.ts`) | Every Docs route uses the same helpers — this is the exact discipline that keeps raw Postgres/Prisma errors off the screen, which matters even more here since this product is open to the public internet, not just logged-in tenants |
| Host/query injection guards | `isSafeHostFormat`, `cleanTenantSlug` (`api/tenant/_domainUtils.ts`) | Reused directly in `api/docs/resolve.ts` (section 3) |
| Row Level Security | Enabled on every Supabase table, tenant-scoped policies | Enabled on every `orvix-docs` table too (section 2), even though Prisma is the primary access path — defense in depth if a key ever leaks |
| Secret rotation discipline | `docs/security-operations-runbook.md` | `DATABASE_URL_DOCS`, `DIRECT_URL_DOCS`, `DOCS_SUPABASE_SERVICE_ROLE_KEY`, `DOCS_BRIDGE_SHARED_SECRET` added to the existing rotation schedule — one more row in an existing process, not a new one |
| CORS | Same-origin only, one Vercel project | No change needed — `docs.orvix.africa` is still first-party to this deployment, same as `{tenant}.orvix.africa` is today |

### Rate limits (new routes, same convention as `server.ts:1174-1193`)

```ts
app.use('/api/docs/auth/register', rateLimit({ prefix: 'docs-register', windowMs: 15 * 60 * 1000, max: 12 }));
app.use('/api/docs/auth/login',    rateLimit({ prefix: 'docs-login',    windowMs: 15 * 60 * 1000, max: 20 }));
app.use('/api/docs/generate',      rateLimit({ prefix: 'docs-generate', windowMs: 60 * 1000,       max: 6  }));
app.use('/api/docs/settings/logo', rateLimit({ prefix: 'docs-logo',     windowMs: 60 * 1000,       max: 10 }));
app.use('/api/docs',               rateLimit({ prefix: 'docs-api',      windowMs: 60 * 1000,       max: 120 }));
app.use('/api/docs-bridge',        rateLimit({ prefix: 'docs-bridge',   windowMs: 60 * 1000,       max: 60  }));
```

`generate` gets the tightest per-IP limit of the group deliberately — it's
the one route that spends real compute (PDF rendering) and, for FREE, has
no account history to fall back on for abuse detection since nothing is
persisted (section 2/4). A second, per-account daily cap (e.g. 20
generations/day on FREE, tracked with a cheap counter — a small Redis-less
in-memory or Postgres counter table, reset daily; Premium is uncapped since
they're a paying, identity-verified account) belongs alongside the IP limit
so one IP behind carrier-grade NAT (common on Tanzanian mobile networks)
doesn't get a shared building rate-limited out.

### Why FREE writes nothing to the database (cost, not just privacy)

This was tightened further after review: for FREE-tier generations, **no
`Document` row, no Storage upload, no snapshot of the customer/item content
the user typed in — none of that is written anywhere.** The PDF is rendered
and streamed straight back in the HTTP response. The one exception is the
daily-cap counter mentioned above, and it stores only a number (account id
+ today's count), never the document content itself — it exists purely to
stop abuse, not as a record of what was generated. This is the main cost
lever for a product that lets anyone self-register and generate for free:

- Zero Postgres writes on the highest-volume, non-paying path — the
  `orvix-docs` database only grows with Premium usage, which is the only
  usage that's actually paying for storage.
  - What can't be avoided: Supabase Auth still records the user account on
    registration (that's identity, not documents) — but not a row per
    generation.
- Zero Storage cost from FREE-tier PDFs — nothing to lifecycle-expire, no
  orphaned files to clean up, because none are ever written.
- The rendering step itself (the actual CPU/memory cost — screenshot-based
  PDF capture is the more expensive part) is still real for FREE users, so
  it's the one covered by the tighter `docs-generate` rate limit and the
  per-account daily cap above, not by database growth.
- Premium's persisted `Document` rows are the deliberate exception, because
  the Invoice Tracking dashboard *is* the paid feature — the cost of
  storing those is already priced into the 5,000 TZS unlock.

### Additional abuse controls worth building in from the start

- Turnstile on `generate`, not just register/login, for accounts less than
  ~7 days old — a scripted signup loop that solves Turnstile once at
  registration shouldn't get an unlimited, un-gated generate endpoint after
  that.
- Disposable-email domain rejection at registration (a short static
  blocklist is enough at this stage — no need for a third-party API).
- Cap request body size on `generate` (item count, string lengths) so a
  crafted payload can't force an oversized render.

---

## Open questions before implementation starts

- Is the 5,000 TZS Premium unlock a one-time purchase (matches the schema
  above — `Subscription` with no expiry) or recurring? The spec says "Cost:
  5,000 TZS" without a period, so this doc assumes one-time; recurring would
  need an `expiresAt` and a renewal reminder job similar to the existing
  `subscriptionReminder`/`subscriptionRenewal` utilities in the main app.
- Confirm the second Supabase project can be created under the existing
  account before Stage 1 starts (org-level seat/plan limits, if any).
