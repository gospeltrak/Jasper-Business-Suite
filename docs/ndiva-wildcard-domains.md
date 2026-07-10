# Ndiva Suite Wildcard Tenant Domains

This app supports one Vercel project with tenant URLs like:

- `ndiva.africa` and `www.ndiva.africa`: public landing page
- `app.ndiva.africa`: main SaaS app login
- `{tenant-slug}.ndiva.africa`: tenant-branded business login/dashboard

## Required Vercel Domains

Add these domains to the same Vercel project:

- `ndiva.africa`
- `www.ndiva.africa`
- `*.ndiva.africa`

Use Vercel nameservers at the registrar:

- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## Required Environment Variables

Set these in Vercel:

```bash
APP_BASE_DOMAIN=ndiva.africa
VITE_APP_BASE_DOMAIN=ndiva.africa
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Supabase Migration

Run:

```sql
-- supabase_tenant_domains_migration.sql
```

The migration adds immutable tenant slug/domain fields to `public.tenants` and unique indexes for subdomain/custom-domain isolation.

## Supabase Auth Redirect URLs

In Supabase Auth URL configuration, include the production app and wildcard tenant callback URLs:

```text
https://ndiva.africa/**
https://www.ndiva.africa/**
https://app.ndiva.africa/**
https://*.ndiva.africa/**
```

Keep local development URLs too if you use them:

```text
http://localhost:5173/**
http://localhost:3000/**
```

## Slug Behavior

New tenants get a slug from the business name:

1. First word, for example `Lim Cleaners Store` -> `lim`
2. If taken, first-second -> `lim-cleaners`
3. If taken, first-second-third -> `lim-cleaners-store`
4. If still taken, numeric suffix -> `lim-cleaners-store-2`

Settings -> Business Setup has a `Business Name Slug` field. Once saved, it is locked and should not be changed because it becomes the tenant domain.
