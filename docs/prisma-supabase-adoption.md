# Prisma + Supabase adoption contract

## Connections

- `DATABASE_URL`: Supavisor transaction pooler (`:6543`) for Vercel runtime.
- `DIRECT_URL`: direct/session connection (`:5432`) for introspection and
  future reviewed migrations.
- Both values are server-only and must never use the `VITE_` prefix.

## Safety boundary

Prisma starts with the workspace migration control plane only. Existing tenant
business reads/writes, financial posting, transfers, Auth, Storage, Realtime,
and branch authorization remain on the existing Supabase RLS/RPC architecture.

Never run `prisma migrate reset` or `prisma db push` against production.

Before moving a tenant query to Prisma:

1. Create a dedicated least-privilege login role without `BYPASSRLS`.
2. Apply tenant and branch context inside one transaction.
3. Prove cross-tenant and cross-branch denial with tests.
4. Keep financial mutations in the existing atomic RPCs.
5. Run `npm run prisma:pull`, review the diff, then generate the client.

## Rollout

1. Foundation and generated client.
2. Read-only control-plane query.
3. Least-privilege tenant role and isolation tests.
4. One low-risk server-side read path behind a flag.
5. Gradual migration; no big-bang cutover.
