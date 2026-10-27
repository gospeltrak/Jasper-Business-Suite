# Legacy inline logo cleanup — operator runbook

This task removes the **runtime settings payload dependency on embedded logo base64**, not JSON as a network format. Existing normalized products, sales, payments, purchases, stock and `source_record` are **out of scope**. Backups are never deleted.

## Verified production baseline (2026-10-26)

- Nine workspaces are on normalized reads/writes; this does not authorize backup deletion.
- Tenant workspace JSON is approximately 2.3 MB in total, predominantly repeated business/company logos.
- Five workspaces contain inline `businessLogo` data URLs (four WebP, one PNG), commonly duplicated as `businessLogoLight`; one contains an inline `businessLogoDark` and one an inline `company.logo` (PNG).
- The real multi-branch logo editor already calls an authenticated server upload endpoint and stores returned URLs. Do not replace its authorization flow with the legacy hidden store-location handler.
- Settings uploads previously saved transient base64 immediately and used a shared object key. The separate PR fix saves immutable Storage URLs only on upload success. No original branding data is deleted by that fix.
- Current Supabase `tenant-logos` Storage policies have INSERT/UPDATE/DELETE for the authenticated uploader's UID folder but no SELECT policy; new client uploads use unique keys and `upsert:false`.

## Phased migration

1. Merge the reviewed app fix after CI and staging owner/staff checks, including white-background/light logo, dark logo, invoices, reports, and permission denial.
2. Before any production apply, export a fresh Supabase backup or verify PITR restore, and check subscription/tenant context.
3. Run the **read-only preview** per tenant; inspect the number of inline fields and distinct images. No logo contents are printed.
4. Apply to **one tenant only** from a trusted server/operator machine. An independent full workspace backup is written first to a private directory outside the repository, as JSON mode 0600.
5. The script writes immutable content-addressed objects to Storage (`tenant-logos/migrated/{tenantId}/{sha256}.{ext}`), downloads them to verify exact bytes, and updates only specific JSONB logo paths inside a single PostgreSQL transaction. It uses the existing explicit-settings-tenant transaction flag required by the protective trigger, checks the original payload and `updated_at` under a row lock, and rolls back if anything differs. It does **not** disable triggers.
6. Verify the live business app for that tenant: light/dark UI, brand name, branches, invoice/PDF, staff permissions, payments, sales, products and stock. Validate that non-logo JSON hash/content and financial totals are unchanged.
7. Repeat separately for other tenants only after the pilot passes. Retain rollback snapshots and historical `tenant_data` backups under the existing retention policy.

## Operator commands

Never put the service key in frontend code, a ticket, CI logs, screenshots or Git history. It must be a server-only environment variable, provided through an approved secret manager.

```sh
# Set DATABASE_URL for the production Postgres connection.
# For --apply only, also set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
# All credentials must stay on a trusted server/operator terminal.
node scripts/migrate-workspace-inline-logos.mjs --tenant-id=<TENANT_UUID>

# Explicit opt-in write, for one tenant only:
mkdir -p "$HOME/orvix-private-logo-backups"
chmod 700 "$HOME/orvix-private-logo-backups"
node scripts/migrate-workspace-inline-logos.mjs \
  --tenant-id=<TENANT_UUID> \
  --apply \
  --confirm-tenant=<SAME_TENANT_UUID> \
  --backup-dir="$HOME/orvix-private-logo-backups" \
  --expected-project-ref=<YOUR_SUPABASE_PROJECT_REF>
```

The CLI defaults to dry-run (requiring only DATABASE_URL) and refuses apply in CI, without a one-tenant confirmation, without a private backup destination, or if the provided Supabase Storage URL and Postgres connection do not match the explicitly confirmed project reference. For apply, use the standard Supabase URL and either the direct db.<project>.supabase.co host or pooler credentials with username postgres.<project>; custom routes fail closed. Supported inline MIME: PNG, JPEG, WebP, GIF; unsupported formats fail closed without changing the database. A failed migration can leave unused, immutable Storage objects; the SQL transaction rolls back the settings update. It does **not** remove original logo values or any business tables.

## Rollback principle

Keep the full original workspace backup. If a tenant fails to render after applying, stop rollout. Restore only in a reviewed operation with current workspace revision checks: **never overwrite new sales, stock, financial, staff or settings changes made since the migration**. The script has no automatic destructive rollback and does not delete Storage objects.

## Not included

- Removing `source_record` fields that still contain pricing, inventory, pharmacy, payment or other extended properties.
- Deleting 2026 historical `data_backup_*`, `workspace_backup_*`, or `tenant_workspaces`.
- Modifying RLS or adding anonymous Storage write permissions.
- Replacing the existing normalized SQL transaction and pagination features.

All follow-up normalized column work requires an explicit field mapping, reconciliation, staging tests and a new, reviewed PR.
