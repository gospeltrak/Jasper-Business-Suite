-- Preserve source ordering and validate exact JSON record fidelity before any
-- tenant can move from legacy reads.

begin;

alter table public.products add column if not exists source_ordinal bigint;
alter table public.sales add column if not exists source_ordinal bigint;
alter table public.sale_items add column if not exists source_ordinal bigint;
alter table public.expenses add column if not exists source_ordinal bigint;
alter table public.deliveries add column if not exists source_ordinal bigint;
alter table public.purchases add column if not exists source_ordinal bigint;
alter table public.purchase_items add column if not exists source_ordinal bigint;

create or replace function public.refresh_workspace_source_ordinals(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with source_rows as (
    select coalesce(nullif(btrim(item ->> 'id'), ''), 'hash:' || md5(item::text)) legacy_id,
           ordinal::bigint source_ordinal
    from public.tenant_workspaces workspace
    cross join lateral jsonb_array_elements(coalesce(workspace.payload -> 'products', '[]'::jsonb))
      with ordinality as source(item, ordinal)
    where workspace.tenant_id = p_tenant_id
  )
  update public.products target
  set source_ordinal = source_rows.source_ordinal
  from source_rows
  where target.tenant_id = p_tenant_id and target.legacy_id = source_rows.legacy_id;

  with source_rows as (
    select coalesce(nullif(btrim(item ->> 'id'), ''), 'hash:' || md5(item::text)) legacy_id,
           ordinal::bigint source_ordinal
    from public.tenant_workspaces workspace
    cross join lateral jsonb_array_elements(coalesce(workspace.payload -> 'sales', '[]'::jsonb))
      with ordinality as source(item, ordinal)
    where workspace.tenant_id = p_tenant_id
  )
  update public.sales target
  set source_ordinal = source_rows.source_ordinal
  from source_rows
  where target.tenant_id = p_tenant_id and target.legacy_id = source_rows.legacy_id;

  with source_rows as (
    select coalesce(nullif(btrim(sale ->> 'id'), ''), 'hash:' || md5(sale::text))
             || ':item:' || item_ordinal::text legacy_id,
           item_ordinal::bigint source_ordinal
    from public.tenant_workspaces workspace
    cross join lateral jsonb_array_elements(coalesce(workspace.payload -> 'sales', '[]'::jsonb))
      with ordinality as sales(sale, sale_ordinal)
    cross join lateral jsonb_array_elements(coalesce(sale -> 'items', '[]'::jsonb))
      with ordinality as items(item, item_ordinal)
    where workspace.tenant_id = p_tenant_id
  )
  update public.sale_items target
  set source_ordinal = source_rows.source_ordinal
  from source_rows
  where target.tenant_id = p_tenant_id and target.legacy_id = source_rows.legacy_id;

  with source_rows as (
    select coalesce(nullif(btrim(item ->> 'id'), ''), 'hash:' || md5(item::text)) legacy_id,
           ordinal::bigint source_ordinal
    from public.tenant_workspaces workspace
    cross join lateral jsonb_array_elements(coalesce(workspace.payload -> 'expenses', '[]'::jsonb))
      with ordinality as source(item, ordinal)
    where workspace.tenant_id = p_tenant_id
  )
  update public.expenses target
  set source_ordinal = source_rows.source_ordinal
  from source_rows
  where target.tenant_id = p_tenant_id and target.legacy_id = source_rows.legacy_id;

  with source_rows as (
    select coalesce(nullif(btrim(item ->> 'id'), ''), 'hash:' || md5(item::text)) legacy_id,
           ordinal::bigint source_ordinal
    from public.tenant_workspaces workspace
    cross join lateral jsonb_array_elements(coalesce(workspace.payload -> 'deliveries', '[]'::jsonb))
      with ordinality as source(item, ordinal)
    where workspace.tenant_id = p_tenant_id
  )
  update public.deliveries target
  set source_ordinal = source_rows.source_ordinal
  from source_rows
  where target.tenant_id = p_tenant_id and target.legacy_id = source_rows.legacy_id;

  with source_rows as (
    select coalesce(nullif(btrim(item ->> 'id'), ''), 'hash:' || md5(item::text)) legacy_id,
           ordinal::bigint source_ordinal
    from public.tenant_workspaces workspace
    cross join lateral jsonb_array_elements(coalesce(workspace.payload -> 'purchases', '[]'::jsonb))
      with ordinality as source(item, ordinal)
    where workspace.tenant_id = p_tenant_id
  )
  update public.purchases target
  set source_ordinal = source_rows.source_ordinal
  from source_rows
  where target.tenant_id = p_tenant_id and target.legacy_id = source_rows.legacy_id;

  with source_rows as (
    select coalesce(nullif(btrim(purchase ->> 'id'), ''), 'hash:' || md5(purchase::text))
             || ':item:' || item_ordinal::text legacy_id,
           item_ordinal::bigint source_ordinal
    from public.tenant_workspaces workspace
    cross join lateral jsonb_array_elements(coalesce(workspace.payload -> 'purchases', '[]'::jsonb))
      with ordinality as purchases(purchase, purchase_ordinal)
    cross join lateral jsonb_array_elements(coalesce(purchase -> 'items', '[]'::jsonb))
      with ordinality as items(item, item_ordinal)
    where workspace.tenant_id = p_tenant_id
  )
  update public.purchase_items target
  set source_ordinal = source_rows.source_ordinal
  from source_rows
  where target.tenant_id = p_tenant_id and target.legacy_id = source_rows.legacy_id;
end;
$$;

create or replace function public.validate_workspace_shadow_content(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_products boolean;
  v_sales boolean;
  v_sale_items boolean;
  v_expenses boolean;
  v_deliveries boolean;
  v_purchases boolean;
  v_purchase_items boolean;
begin
  select payload into v_payload
  from public.tenant_workspaces where tenant_id = p_tenant_id;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;

  v_products := coalesce(v_payload -> 'products', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.products where tenant_id = p_tenant_id and legacy_id is not null
  ), '[]'::jsonb);
  v_sales := coalesce(v_payload -> 'sales', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.sales where tenant_id = p_tenant_id and legacy_id is not null
  ), '[]'::jsonb);
  v_sale_items := coalesce((
    select jsonb_agg(item order by sale_ordinal, item_ordinal)
    from jsonb_array_elements(coalesce(v_payload -> 'sales', '[]'::jsonb))
      with ordinality as sales(sale, sale_ordinal)
    cross join lateral jsonb_array_elements(coalesce(sale -> 'items', '[]'::jsonb))
      with ordinality as items(item, item_ordinal)
  ), '[]'::jsonb) = coalesce((
    select jsonb_agg(child.source_record order by parent.source_ordinal, child.source_ordinal)
    from public.sale_items child
    join public.sales parent on parent.id = child.sale_id and parent.tenant_id = child.tenant_id
    where child.tenant_id = p_tenant_id and child.legacy_id is not null
  ), '[]'::jsonb);
  v_expenses := coalesce(v_payload -> 'expenses', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.expenses where tenant_id = p_tenant_id and legacy_id is not null
  ), '[]'::jsonb);
  v_deliveries := coalesce(v_payload -> 'deliveries', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null
  ), '[]'::jsonb);
  v_purchases := coalesce(v_payload -> 'purchases', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.purchases where tenant_id = p_tenant_id and legacy_id is not null
  ), '[]'::jsonb);
  v_purchase_items := coalesce((
    select jsonb_agg(item order by purchase_ordinal, item_ordinal)
    from jsonb_array_elements(coalesce(v_payload -> 'purchases', '[]'::jsonb))
      with ordinality as purchases(purchase, purchase_ordinal)
    cross join lateral jsonb_array_elements(coalesce(purchase -> 'items', '[]'::jsonb))
      with ordinality as items(item, item_ordinal)
  ), '[]'::jsonb) = coalesce((
    select jsonb_agg(child.source_record order by parent.source_ordinal, child.source_ordinal)
    from public.purchase_items child
    join public.purchases parent on parent.id = child.purchase_id and parent.tenant_id = child.tenant_id
    where child.tenant_id = p_tenant_id and child.legacy_id is not null
  ), '[]'::jsonb);

  return jsonb_build_object(
    'allMatch', v_products and v_sales and v_sale_items and v_expenses
      and v_deliveries and v_purchases and v_purchase_items,
    'products', v_products,
    'sales', v_sales,
    'saleItems', v_sale_items,
    'expenses', v_expenses,
    'deliveries', v_deliveries,
    'purchases', v_purchases,
    'purchaseItems', v_purchase_items
  );
end;
$$;

revoke all on function public.refresh_workspace_source_ordinals(uuid)
  from public, anon, authenticated;
revoke all on function public.validate_workspace_shadow_content(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_workspace_source_ordinals(uuid)
  to service_role;
grant execute on function public.validate_workspace_shadow_content(uuid)
  to service_role;

commit;
