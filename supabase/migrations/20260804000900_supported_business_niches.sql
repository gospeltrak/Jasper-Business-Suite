-- Keep the production offer limited to Retail/Wholesale and Pharmacy.
-- Existing protected tenant values are accepted without rewriting tenant data.
alter table public.tenants
  drop constraint if exists tenants_supported_business_type_check;

alter table public.tenants
  add constraint tenants_supported_business_type_check
  check (
    lower(trim(business_type)) in (
      'retail',
      'wholesale',
      'retail & wholesale',
      'retail and wholesale',
      'pharmacy'
    )
  ) not valid;

alter table public.tenants
  validate constraint tenants_supported_business_type_check;
