# Workspace normalization migration contract

## Non-negotiable invariants

1. `tenant_workspaces` and `tenant_data` remain unchanged during schema setup.
2. A tenant stays on legacy reads until its own reconciliation is an exact match.
3. Dual-write and read cutover are controlled per tenant and default to off.
4. Every backfill is idempotent and resumable.
5. Legacy identifiers are stored in `legacy_id`; they are never coerced into UUIDs.
6. Existing tenant, branch, user, subscription, payment, affiliate and partner IDs
   are never regenerated.
7. Row counts and financial totals must match before a tenant can enter
   `shadow_read` or `normalized`.
8. Rollback changes only `read_mode` to `legacy` and disables dual-write. It does
   not delete normalized or legacy records.

## Protected production identities

The cleanup phase must use immutable IDs, not display names or phone matching.

| Type | ID | Display |
| --- | --- | --- |
| Tenant | `64ba3572-b61f-4142-826c-e6fa48eab169` | Lim cleaners |
| Tenant | `7395ceb5-6132-4a93-a01e-79c78bba7c13` | Tunde Inv |
| Affiliate user | `714347e0-2fa6-4f90-bd25-00d52fd1d171` | Evancia Mkunywa |
| Affiliate user | `7a729321-308d-4694-b9ec-2e1a065ded45` | Mark Dasa |
| Partner user | `89a92c31-fbd4-4bac-801f-f54a4fdda848` | Magreth Kenneth |
| Super admin user | `b5895ae1-e40b-49f8-9fbc-21de3421e710` | Jasper Super Admin / 0700000101 |

All users and staff attached to either protected tenant are protected
transitively.

## Source-to-target mapping

| Legacy workspace key | Normalized target | Reconciliation |
| --- | --- | --- |
| `products` | `products`, `branch_stock` | count, stock quantity, inventory value |
| `sales` | `sales`, `sale_items` | count, total, tax, discount, paid, due |
| `expenses` | `expenses` | count, amount |
| `deliveries` | `deliveries`, `delivery_riders` | count, total, delivery cost, status counts |
| `purchases` | `purchases`, `purchase_items` | count, total, paid, due |
| `branches` | `branches` | count and immutable IDs |
| `branchStocks` | `branch_stock` | count and quantity by branch/product |
| `branchStaffAssignments` | `branch_staff_assignments` | count and assignment identity |
| `settings` | authoritative tenant/branch settings | canonical JSON hash and selected fields |

## Backfill rules

- Read one tenant workspace at a time.
- Capture `tenant_workspaces.updated_at` and a canonical payload hash at batch
  start.
- Process bounded record batches and persist a cursor after each committed
  batch.
- Upsert by `(tenant_id, legacy_id)`.
- If the source workspace timestamp changes during a batch, stop and retry from
  the last durable cursor.
- Never use a whole-table delete followed by insert.
- Never backfill backup keys from `tenant_data`.
- Record conversion failures without dropping the source record.

## Cutover gates

A tenant can progress only when:

1. source and target record counts match;
2. financial totals match at exact database numeric precision;
3. stock totals match per branch and product;
4. every target row has the correct `tenant_id`;
5. every branch-scoped target belongs to the same tenant;
6. RLS tests pass for owner, staff, other tenant and anonymous sessions;
7. shadow reads produce the same application result;
8. the rollback flag has been exercised successfully.

## Capacity posture

- Runtime reads must use `(tenant_id, branch_id, time/id)` composite indexes.
- Large lists must use keyset pagination.
- Realtime must subscribe to narrow normalized tables and tenant/branch filters,
  not the full workspace JSON row.
- Receipts and product images stay in Storage; database rows store references.
- Long-running migration, reporting and export work belongs in background jobs.
- Connection pooling is mandatory in serverless production.

## Destructive cleanup gate

Demo deletion and legacy backup pruning are separate from normalization. They
require a fresh pre-delete backup or PITR and an owner-approved immutable-ID
manifest. A successful normalization is not authorization to delete anything.

## Phase 9 certification notes

- Tenant/branch relationship checks returned zero mismatches for branch stock,
  sale items, purchase items and delivery-to-sale ownership.
- All normalized business tables have forced RLS with active policies.
- The demo cleanup restore archive is private: `anon` and `authenticated`
  cannot read it; `service_role` can.
- Lim cleaners has 238 migration-managed products plus 68 older, legitimate
  normalized products created before this migration. The older rows have no
  name, SKU or barcode overlap with the migration batch and must not be deleted.
- Tunde Inv retains 20 migration-managed Pharmacy products.
- The primary sales query uses `sales_tenant_time_idx`, has no temporary disk
  I/O, and completed in approximately 8 ms against the current production data.
- Rendered Vite/Vitest QA could not start inside the Codex filesystem sandbox
  because esbuild was denied access while resolving pnpm-linked config paths.
  TypeScript and all non-Vite contract tests passed.
