-- Sync the tenants.subdomain_slug reserved-word CHECK constraint with the
-- expanded application-level RESERVED_TENANT_SLUGS list (api/tenant/_domainUtils.ts,
-- server.ts) added for the Orvix custom-domain / role-portal routing rollout
-- (auth/admin/affiliate/partner subdomains and related reserved names).
--
-- Safety:
--   * Additive only — replaces one CHECK constraint definition, does not
--     touch, update, or backfill any tenant row.
--   * Uses `not valid` like the original constraint, so existing rows are
--     never scanned/validated; only future inserts/updates are checked.
--   * No columns, indexes, or data are added, removed, or renamed.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.tenants
  drop constraint if exists tenants_subdomain_slug_format;

alter table public.tenants
  add constraint tenants_subdomain_slug_format
  check (
    subdomain_slug is null
    or (
      char_length(subdomain_slug) between 2 and 63
      and subdomain_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$'
      and subdomain_slug not in (
        'www', 'app', 'admin', 'superadmin', 'super-admin', 'api', 'auth', 'login', 'signup', 'register',
        'dashboard', 'support', 'help', 'mail', 'smtp', 'static', 'assets', 'cdn', 'root',
        'affiliate', 'partner', 'partners', 'academy', 'developers', 'community', 'billing',
        'status', 'docs', 'blog', 'demo', 'files', 'storage', 'system'
      )
    )
  ) not valid;

commit;
