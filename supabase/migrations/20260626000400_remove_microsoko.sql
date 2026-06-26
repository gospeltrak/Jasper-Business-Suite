-- MicroSoko was removed from the product. Keep migration history intact and
-- remove only the schema introduced by the earlier MicroSoko migration.
drop table if exists public.container_calibrations cascade;
drop table if exists public.microsoko_batches cascade;
drop table if exists public.microsoko_subscriptions cascade;

drop index if exists public.idx_products_module_type;
alter table public.products
  drop column if exists module_owner,
  drop column if exists microsoko_type,
  drop column if exists tracking_mode,
  drop column if exists standard_metric_unit;

alter table public.tenants
  drop column if exists primary_niche;

drop type if exists public.microsoko_billing_tier;
drop type if exists public.microsoko_item_type;
drop type if exists public.tracking_measurement_mode;
drop type if exists public.jasper_module_category;
