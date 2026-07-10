-- Ndiva Suite tenant wildcard domain support.
-- Run this in Supabase SQL editor before enabling *.ndiva.africa in production.

alter table public.tenants
  add column if not exists business_name text,
  add column if not exists business_name_slug text,
  add column if not exists subdomain_slug text,
  add column if not exists custom_domain text,
  add column if not exists primary_domain text,
  add column if not exists domain_status text not null default 'active',
  add column if not exists is_domain_active boolean not null default true;

update public.tenants
set business_name = coalesce(business_name, name)
where business_name is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_subdomain_slug_format'
  ) then
    alter table public.tenants
      add constraint tenants_subdomain_slug_format
      check (
        subdomain_slug is null
        or (
          subdomain_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
          and subdomain_slug not in (
            'www', 'app', 'admin', 'superadmin', 'api', 'auth', 'login', 'signup',
            'dashboard', 'support', 'help', 'mail', 'static', 'assets', 'cdn', 'root'
          )
        )
      ) not valid;
  end if;
end $$;

create unique index if not exists tenants_subdomain_slug_unique_idx
  on public.tenants (lower(subdomain_slug))
  where subdomain_slug is not null;

create unique index if not exists tenants_primary_domain_unique_idx
  on public.tenants (lower(primary_domain))
  where primary_domain is not null;

create unique index if not exists tenants_custom_domain_unique_idx
  on public.tenants (lower(custom_domain))
  where custom_domain is not null;

create index if not exists tenants_domain_active_idx
  on public.tenants (is_domain_active, domain_status);

comment on column public.tenants.business_name_slug is 'Immutable UI slug generated from business name.';
comment on column public.tenants.subdomain_slug is 'Immutable wildcard subdomain slug, e.g. lim for lim.ndiva.africa.';
comment on column public.tenants.primary_domain is 'Primary tenant domain, e.g. lim.ndiva.africa.';
comment on column public.tenants.is_domain_active is 'If false, tenant domain resolver returns inactive status.';

-- Optional policy reinforcement for projects with RLS already enabled on tenants.
-- Service role bypasses RLS; authenticated users can read only their tenant row.
-- This migration does not force-enable RLS to avoid changing existing runtime behavior unexpectedly.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'tenant users can read own tenant domain row'
  ) then
    create policy "tenant users can read own tenant domain row"
      on public.tenants
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and (u.tenant_id = tenants.id or u.active_tenant = tenants.id)
        )
      );
  end if;
end $$;
