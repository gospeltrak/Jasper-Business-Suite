-- DESIGN / STAGING ONLY. NOT A PRODUCTION MIGRATION.
-- Proposed private ledger schema. Apply only in an isolated database, using a
-- migration generated with Supabase CLI, after a full RLS/permission review.
-- There are deliberately NO triggers changing Sales, Purchases, Expenses,
-- Treasury or Stock; those mutations must join this ledger's SAME SQL tx.
create table if not exists private.native_offline_operation_ledger (
  tenant_id uuid not null references public.tenants(id),
  idempotency_key text not null check (length(idempotency_key) between 10 and 512),
  operation_id text not null check (length(operation_id) between 16 and 128),
  operation_type text not null check (operation_type in ('sale','purchase','expense')),
  branch_id uuid not null references public.branches(id),
  actor_id uuid not null,
  device_id text not null check (length(device_id) between 10 and 128),
  payload_digest text not null check (payload_digest ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  base_snapshot_revision text not null,
  client_sequence bigint not null check (client_sequence > 0),
  client_created_at timestamptz not null,
  claimed_at timestamptz not null default clock_timestamp(),
  committed_at timestamptz,
  status text not null default 'claimed' check (status in ('claimed','committed')),
  receipt jsonb,
  primary key (tenant_id,idempotency_key),
  unique (tenant_id,operation_type,operation_id),
  check (
    (status = 'claimed' and receipt is null and committed_at is null) or
    (status = 'committed' and receipt is not null and committed_at is not null)
  )
);
create index if not exists native_offline_operation_ledger_actor_idx
  on private.native_offline_operation_ledger(tenant_id,branch_id,actor_id,claimed_at desc);

-- Public Data API clients must not access this table directly. Only the
-- trusted server transaction (after fresh session/permission validation) may.
revoke all on private.native_offline_operation_ledger from public, anon, authenticated;
-- Keep direct access limited to a trusted database backend role (owner/controlled
-- service role). Exact grants require review of deployment's database role.
--
-- Business-logic contract for BOTH online and offline writes:
-- 1. BEGIN transaction.
-- 2. Check current tenant/branch/account permissions and device identity.
-- 3. SELECT tenant workspace FOR UPDATE (same lock order as normal sales RPC).
-- 4. INSERT claim ON CONFLICT DO NOTHING; SELECT claimed ledger row FOR UPDATE.
-- 5. Immutable identity, digest and payload must match; if committed return
--    original durable receipt without updating stock or Treasury.
-- 6. Within THIS SAME transaction: reserve/consume stock grant, append sale/
--    purchase/expense and Treasury entries with immutable source IDs.
-- 7. Store proof of ALL effects in ledger receipt. COMMIT once.
-- 8. On ANY failure ROLLBACK. Never respond "complete" on partial effects.
-- 9. All normal online inventory mutations must be reservation-aware too.
