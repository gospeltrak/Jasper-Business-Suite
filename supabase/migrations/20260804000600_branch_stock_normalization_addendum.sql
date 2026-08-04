-- Corrective additive backfill for branchStocks. No existing stock row or
-- workspace record is deleted.

begin;

alter table public.branch_stock
  add column if not exists legacy_id text,
  add column if not exists source_record jsonb,
  add column if not exists source_ordinal bigint,
  add column if not exists source_updated_at timestamptz,
  add column if not exists migration_batch_id uuid
    references public.workspace_migration_batches(id) on delete restrict;

create unique index if not exists branch_stock_tenant_legacy_id_uidx
  on public.branch_stock (tenant_id, legacy_id)
  where legacy_id is not null;

create or replace function public.normalize_branch_stock_snapshot(
  p_tenant_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace public.tenant_workspaces%rowtype;
  v_batch_id uuid;
  v_item jsonb;
  v_ordinal bigint;
  v_legacy_id text;
  v_branch_id uuid;
  v_count bigint;
  v_quantity numeric;
  v_shop_quantity numeric;
  v_store_quantity numeric;
begin
  select * into v_workspace
  from public.tenant_workspaces
  where tenant_id = p_tenant_id
  for share;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;
  if v_workspace.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Workspace changed before branch stock normalization.';
  end if;

  select id into v_batch_id
  from public.workspace_migration_batches
  where tenant_id = p_tenant_id
    and source_updated_at = v_workspace.updated_at
  order by created_at desc
  limit 1;

  for v_item, v_ordinal in
    select item, ordinal::bigint
    from jsonb_array_elements(coalesce(v_workspace.payload -> 'branchStocks', '[]'::jsonb))
      with ordinality as source(item, ordinal)
  loop
    v_legacy_id := coalesce(nullif(btrim(v_item ->> 'id'), ''), 'hash:' || md5(v_item::text));
    v_branch_id := private.safe_uuid(v_item ->> 'branchId');
    if v_branch_id is null or not exists (
      select 1 from public.branches where id = v_branch_id and tenant_id = p_tenant_id
    ) then
      raise exception using errcode = '23503', message = 'Branch stock references an invalid tenant branch.';
    end if;
    if nullif(btrim(v_item ->> 'productId'), '') is null then
      raise exception using errcode = '23502', message = 'Branch stock is missing its product identifier.';
    end if;

    insert into public.branch_stock (
      tenant_id, branch_id, product_id, quantity, shop_stock_qty,
      store_stock_qty, buying_price, selling_price, low_stock_alert,
      legacy_id, source_record, source_ordinal, source_updated_at,
      migration_batch_id, updated_at
    )
    values (
      p_tenant_id, v_branch_id, btrim(v_item ->> 'productId'),
      private.safe_numeric(v_item ->> 'quantity'),
      private.safe_numeric(v_item ->> 'shopStockQty'),
      private.safe_numeric(v_item ->> 'storeStockQty'),
      private.safe_numeric(v_item ->> 'buyingPrice'),
      private.safe_numeric(v_item ->> 'sellingPrice'),
      private.safe_numeric(v_item ->> 'lowStockAlert'),
      v_legacy_id, v_item, v_ordinal,
      coalesce(private.safe_timestamptz(v_item ->> 'updatedAt'), v_workspace.updated_at),
      v_batch_id, statement_timestamp()
    )
    on conflict (tenant_id, branch_id, product_id) do update
    set quantity = excluded.quantity,
        shop_stock_qty = excluded.shop_stock_qty,
        store_stock_qty = excluded.store_stock_qty,
        buying_price = excluded.buying_price,
        selling_price = excluded.selling_price,
        low_stock_alert = excluded.low_stock_alert,
        legacy_id = excluded.legacy_id,
        source_record = excluded.source_record,
        source_ordinal = excluded.source_ordinal,
        source_updated_at = excluded.source_updated_at,
        migration_batch_id = excluded.migration_batch_id,
        updated_at = excluded.updated_at;
  end loop;

  if not exists (
    select 1 from public.tenant_workspaces
    where tenant_id = p_tenant_id and updated_at = v_workspace.updated_at
  ) then
    raise exception using errcode = '40001', message = 'Workspace changed during branch stock normalization.';
  end if;

  select count(*), coalesce(sum(quantity), 0), coalesce(sum(shop_stock_qty), 0),
         coalesce(sum(store_stock_qty), 0)
  into v_count, v_quantity, v_shop_quantity, v_store_quantity
  from public.branch_stock
  where tenant_id = p_tenant_id and legacy_id is not null;

  return jsonb_build_object(
    'count', v_count,
    'quantity', v_quantity,
    'shopStockQty', v_shop_quantity,
    'storeStockQty', v_store_quantity
  );
end;
$$;

create or replace function public.validate_branch_stock_shadow(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source jsonb;
  v_target jsonb;
  v_source_count bigint;
  v_target_count bigint;
  v_source_quantity numeric;
  v_target_quantity numeric;
begin
  select coalesce(payload -> 'branchStocks', '[]'::jsonb)
  into v_source from public.tenant_workspaces where tenant_id = p_tenant_id;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;
  select coalesce(jsonb_agg(source_record order by source_ordinal), '[]'::jsonb),
         count(*), coalesce(sum(quantity), 0)
  into v_target, v_target_count, v_target_quantity
  from public.branch_stock where tenant_id = p_tenant_id and legacy_id is not null;
  select jsonb_array_length(v_source),
         coalesce(sum(private.safe_numeric(item ->> 'quantity')), 0)
  into v_source_count, v_source_quantity
  from jsonb_array_elements(v_source) item;
  return jsonb_build_object(
    'allMatch', v_source = v_target
      and v_source_count = v_target_count
      and v_source_quantity = v_target_quantity,
    'contentMatch', v_source = v_target,
    'sourceCount', v_source_count,
    'targetCount', v_target_count,
    'sourceQuantity', v_source_quantity,
    'targetQuantity', v_target_quantity
  );
end;
$$;

revoke all on function public.normalize_branch_stock_snapshot(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.validate_branch_stock_shadow(uuid)
  from public, anon, authenticated;
grant execute on function public.normalize_branch_stock_snapshot(uuid, timestamptz)
  to service_role;
grant execute on function public.validate_branch_stock_shadow(uuid)
  to service_role;

commit;
