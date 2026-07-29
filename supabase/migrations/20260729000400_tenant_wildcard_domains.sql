-- Additive tenant wildcard-domain support for *.ndiva.africa.
--
-- Safety:
--   * Adds nullable metadata columns and indexed lookups only.
--   * Does not update, delete, backfill, or replace any tenant row.
--   * Locks a domain only after its first successful save.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.tenants
  add column if not exists business_name text,
  add column if not exists business_name_slug text,
  add column if not exists subdomain_slug text,
  add column if not exists custom_domain text,
  add column if not exists primary_domain text,
  add column if not exists domain_status text not null default 'active',
  add column if not exists is_domain_active boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_subdomain_slug_format'
      and conrelid = 'public.tenants'::regclass
  ) then
    alter table public.tenants
      add constraint tenants_subdomain_slug_format
      check (
        subdomain_slug is null
        or (
          char_length(subdomain_slug) between 2 and 63
          and subdomain_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$'
          and subdomain_slug not in (
            'www', 'app', 'admin', 'superadmin', 'api', 'auth', 'login', 'signup',
            'dashboard', 'support', 'help', 'mail', 'static', 'assets', 'cdn', 'root'
          )
        )
      ) not valid;
  end if;
end;
$$;

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

create schema if not exists private;

create or replace function private.enforce_immutable_tenant_domain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.subdomain_slug is not null
     and new.subdomain_slug is distinct from old.subdomain_slug then
    raise exception 'Tenant domain cannot be changed after it has been saved.'
      using errcode = '23514';
  end if;

  if old.business_name_slug is not null
     and new.business_name_slug is distinct from old.business_name_slug then
    raise exception 'Tenant business slug cannot be changed after it has been saved.'
      using errcode = '23514';
  end if;

  if old.primary_domain is not null
     and new.primary_domain is distinct from old.primary_domain then
    raise exception 'Tenant primary domain cannot be changed after it has been saved.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_immutable_tenant_domain on public.tenants;
create trigger enforce_immutable_tenant_domain
before update of business_name_slug, subdomain_slug, primary_domain
on public.tenants
for each row
execute function private.enforce_immutable_tenant_domain();

comment on column public.tenants.business_name is
  'Registered business display name used by tenant-domain branding.';
comment on column public.tenants.business_name_slug is
  'Immutable UI slug generated from the business name.';
comment on column public.tenants.subdomain_slug is
  'Immutable wildcard subdomain slug, for example lim-cleaners.';
comment on column public.tenants.primary_domain is
  'Immutable primary tenant domain, for example lim-cleaners.ndiva.africa.';
comment on column public.tenants.is_domain_active is
  'When false, the tenant-domain resolver returns inactive status.';

commit;
