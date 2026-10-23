-- Same lost-update fix as 20261023100000 (sales), now for Purchases.
-- Purchases had no tombstone mechanism at all before this migration --
-- deletion relied purely on "the incoming array omits this id", which a
-- naive merge-by-id would have broken (a deleted purchase could resurrect
-- forever). This migration:
--   1. Generalizes private.merge_branch_sales_json_array into
--      private.merge_branch_json_array_by_id (identical logic, not sales-
--      specific -- only the name changed) so sales and purchases share one
--      implementation instead of two copies.
--   2. Adds a purchaseTombstones column to the workspace payload, a
--      p_purchase_tombstones parameter to save_current_branch_purchases
--      (default '{}'::jsonb, so existing callers are unaffected until the
--      client starts sending real tombstones -- see purchaseSync.ts and
--      Dashboard.tsx's handleDeletePurchase), and swaps the purchases
--      replace for a merge-by-id using it.
--
-- save_current_branch_purchases keeps its name; only one new optional
-- parameter was added, so any caller not yet passing it still works
-- exactly as before (purchases simply can't be deleted-and-not-resurrect
-- yet until the client change ships, which lands in the same release).

begin;

-- Superseded by the generic name directly below -- drop it so the old
-- sales-specific function doesn't linger as dead, unreachable code.
drop function if exists private.merge_branch_sales_json_array(jsonb, jsonb, uuid, boolean, jsonb);

create or replace function private.merge_branch_json_array_by_id(
  p_existing jsonb,
  p_incoming jsonb,
  p_branch_id uuid,
  p_include_unassigned boolean,
  p_tombstones jsonb
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with other_branch_items as (
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_existing) = 'array' then p_existing else '[]'::jsonb end
    ) as item(value)
    where not (
      coalesce(item.value ->> 'branchId', item.value ->> 'branch_id') = p_branch_id::text
      or (
        p_include_unassigned
        and nullif(coalesce(item.value ->> 'branchId', item.value ->> 'branch_id'), '') is null
      )
    )
  ),
  branch_candidates as (
    select item.value, 0 as src_rank
    from jsonb_array_elements(
      private.filter_branch_json_array(p_existing, p_branch_id, p_include_unassigned)
    ) as item(value)
    union all
    select item.value, 1 as src_rank
    from jsonb_array_elements(
      private.filter_branch_json_array(p_incoming, p_branch_id, p_include_unassigned)
    ) as item(value)
  ),
  dated as (
    select
      value,
      value ->> 'id' as id,
      src_rank,
      greatest(
        coalesce(nullif(value ->> 'syncUpdatedAt', '')::timestamptz, '-infinity'::timestamptz),
        coalesce(nullif(value ->> 'updatedAt', '')::timestamptz, '-infinity'::timestamptz),
        coalesce(nullif(value ->> 'actualTimestamp', '')::timestamptz, '-infinity'::timestamptz),
        coalesce(nullif(value ->> 'timestamp', '')::timestamptz, '-infinity'::timestamptz)
      ) as rec_time
    from branch_candidates
    where nullif(value ->> 'id', '') is not null
  ),
  picked as (
    select distinct on (id) value, id
    from dated
    order by id, rec_time desc, src_rank desc
  ),
  not_tombstoned as (
    select value
    from picked
    where not (
      p_tombstones is not null
      and jsonb_typeof(p_tombstones) = 'object'
      and nullif(p_tombstones ->> id, '') is not null
    )
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  from (
    select value from other_branch_items
    union all
    select value from not_tombstoned
  ) as combined;
$$;

-- save_current_branch_sales now points at the generic name; behavior is
-- byte-for-byte identical to before (the body was simply renamed/copied).
create or replace function public.save_current_branch_sales(
  p_sales jsonb,
  p_sale_tombstones jsonb default '{}'::jsonb,
  p_products jsonb default null,
  p_deliveries jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_sales jsonb;
  v_existing_deliveries jsonb;
  v_existing_products jsonb;
  v_existing_sale_tombstones jsonb;
  v_next_sales jsonb;
  v_next_deliveries jsonb;
  v_next_products jsonb;
  v_next_sale_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_sales is null or jsonb_typeof(p_sales) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid sales array is required.';
  end if;
  if p_sale_tombstones is null or jsonb_typeof(p_sale_tombstones) <> 'object' then
    p_sale_tombstones := '{}'::jsonb;
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_deliveries is not null and jsonb_typeof(p_deliveries) <> 'array' then
    raise exception using errcode = '22023', message = 'deliveries, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_sales := coalesce(v_existing -> 'sales', '[]'::jsonb);
  v_existing_deliveries := coalesce(v_existing -> 'deliveries', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_sale_tombstones := coalesce(v_existing -> 'saleTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_sales);
    v_incoming_count := jsonb_array_length(p_sales);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_sales := v_existing_sales;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=sales existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_sales := p_sales;
    end if;

    if p_deliveries is not null then
      v_existing_count := jsonb_array_length(v_existing_deliveries);
      v_incoming_count := jsonb_array_length(p_deliveries);
      if v_existing_count > 0 and v_incoming_count = 0 then
        v_next_deliveries := v_existing_deliveries;
      else
        if v_existing_count > 0 and v_incoming_count > 0
          and v_incoming_count < (v_existing_count * 0.5)
        then
          raise warning using message = format(
            'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=deliveries existing=%s incoming=%s',
            v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
          );
        end if;
        v_next_deliveries := p_deliveries;
      end if;
    end if;

    v_next_sale_tombstones := coalesce(p_sale_tombstones, v_existing_sale_tombstones);
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
      if not private.is_tenant_branch_administrator(v_tenant_id) then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
      if not private.is_tenant_branch_administrator(v_tenant_id)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'pos.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for sales.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_sales, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_sales, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=sales existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_sale_tombstones := v_existing_sale_tombstones || p_sale_tombstones;

    v_next_sales := private.merge_branch_json_array_by_id(
      v_existing_sales, p_sales, v_branch_id, v_include_unassigned, v_next_sale_tombstones
    );

    if p_deliveries is not null then
      v_next_deliveries := private.replace_branch_json_array(
        v_existing_deliveries, p_deliveries, v_branch_id, v_include_unassigned
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  v_next_payload := jsonb_set(v_existing, '{sales}', v_next_sales, true);
  v_next_payload := jsonb_set(v_next_payload, '{saleTombstones}', v_next_sale_tombstones, true);
  if v_next_deliveries is not null then
    v_next_payload := jsonb_set(v_next_payload, '{deliveries}', v_next_deliveries, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object(
    'sales', v_next_sales,
    'saleTombstones', v_next_sale_tombstones,
    'deliveries', v_next_deliveries,
    'products', v_next_products
  );
end;
$$;

revoke all on function public.save_current_branch_sales(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_current_branch_sales(jsonb, jsonb, jsonb, jsonb) to authenticated;

-- p_purchase_tombstones is a brand-new parameter inserted before the
-- existing ones, which changes the function's argument signature -- Postgres
-- would otherwise keep the old 3-arg overload alongside this one as dead,
-- unreachable code, since "create or replace" only replaces a function with
-- the exact same argument list.
drop function if exists public.save_current_branch_purchases(jsonb, jsonb, jsonb);

create or replace function public.save_current_branch_purchases(
  p_purchases jsonb,
  p_purchase_tombstones jsonb default '{}'::jsonb,
  p_products jsonb default null,
  p_branch_stocks jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_purchases jsonb;
  v_existing_products jsonb;
  v_existing_branch_stocks jsonb;
  v_existing_purchase_tombstones jsonb;
  v_next_purchases jsonb;
  v_next_products jsonb;
  v_next_branch_stocks jsonb;
  v_next_purchase_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_purchases is null or jsonb_typeof(p_purchases) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid purchases array is required.';
  end if;
  if p_purchase_tombstones is null or jsonb_typeof(p_purchase_tombstones) <> 'object' then
    p_purchase_tombstones := '{}'::jsonb;
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_branch_stocks is not null and jsonb_typeof(p_branch_stocks) <> 'array' then
    raise exception using errcode = '22023', message = 'branchStocks, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_purchases := coalesce(v_existing -> 'purchases', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_branch_stocks := coalesce(v_existing -> 'branchStocks', '[]'::jsonb);
  v_existing_purchase_tombstones := coalesce(v_existing -> 'purchaseTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_purchases);
    v_incoming_count := jsonb_array_length(p_purchases);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_purchases := v_existing_purchases;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=purchases existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_purchases := p_purchases;
    end if;

    if p_branch_stocks is not null then
      v_next_branch_stocks := p_branch_stocks;
    end if;

    v_next_purchase_tombstones := coalesce(p_purchase_tombstones, v_existing_purchase_tombstones);
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
      if not private.is_tenant_branch_administrator(v_tenant_id) then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
      if not private.is_tenant_branch_administrator(v_tenant_id)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'products.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for purchases.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_purchases, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_purchases, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=purchases existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    v_next_purchase_tombstones := v_existing_purchase_tombstones || p_purchase_tombstones;

    v_next_purchases := private.merge_branch_json_array_by_id(
      v_existing_purchases, p_purchases, v_branch_id, v_include_unassigned, v_next_purchase_tombstones
    );

    if p_branch_stocks is not null then
      v_next_branch_stocks := private.replace_branch_json_array(
        v_existing_branch_stocks, p_branch_stocks, v_branch_id, false
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  v_next_payload := jsonb_set(v_next_payload, '{purchaseTombstones}', v_next_purchase_tombstones, true);
  if v_next_branch_stocks is not null then
    v_next_payload := jsonb_set(v_next_payload, '{branchStocks}', v_next_branch_stocks, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object(
    'purchases', v_next_purchases,
    'purchaseTombstones', v_next_purchase_tombstones,
    'branchStocks', v_next_branch_stocks,
    'products', v_next_products
  );
end;
$$;

revoke all on function public.save_current_branch_purchases(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_current_branch_purchases(jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
