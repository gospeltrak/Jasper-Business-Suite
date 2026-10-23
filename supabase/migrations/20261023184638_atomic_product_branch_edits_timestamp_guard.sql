-- Product edits must persist branch prices atomically and reject delayed snapshots.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private.product_snapshot_time(p_record jsonb)
returns timestamptz language plpgsql stable set search_path = ''
as $body$
declare v_key text; v_time timestamptz; v_latest timestamptz := '-infinity'::timestamptz;
begin
  foreach v_key in array array['syncUpdatedAt','updatedAt','updated_at','modifiedAt','lastModifiedAt']
  loop
    begin
      v_time := nullif(p_record ->> v_key, '')::timestamptz;
      if isfinite(v_time) and v_time > v_latest then v_latest := v_time; end if;
    exception when invalid_datetime_format or datetime_field_overflow then null;
    end;
  end loop;
  return v_latest;
end $body$;
revoke all on function private.product_snapshot_time(jsonb) from public, anon, authenticated;

create or replace function private.merge_workspace_products_by_id(p_existing jsonb, p_incoming jsonb)
returns jsonb language sql stable set search_path = ''
as $body$
  with candidates as (
    select item.value, item.ordinality as position, 0 as source,
      item.ordinality as display_position
    from jsonb_array_elements(case when jsonb_typeof(p_existing)='array' then p_existing else '[]'::jsonb end)
      with ordinality as item(value,ordinality)
    union all
    select item.value, item.ordinality, 1,
      item.ordinality + case when jsonb_typeof(p_existing)='array' then jsonb_array_length(p_existing) else 0 end
    from jsonb_array_elements(case when jsonb_typeof(p_incoming)='array' then p_incoming else '[]'::jsonb end)
      with ordinality as item(value,ordinality)
  ), keyed as (
    select *, case when nullif(value ->> 'id','') is not null
      then jsonb_build_array('id',value ->> 'id')
      else jsonb_build_array('legacy',source,position) end as record_key
    from candidates
  ), ranked as (
    select value,
      row_number() over(partition by record_key
        order by private.product_snapshot_time(value) desc, source desc, position desc) as choice,
      min(display_position) over(partition by record_key) as display_position
    from keyed
  )
  select coalesce(jsonb_agg(value order by display_position) filter(where choice=1),'[]'::jsonb)
  from ranked;
$body$;

-- All three arguments are required: legacy two-argument calls stay unambiguous.
create or replace function public.save_current_branch_products(
  p_products jsonb, p_product_tombstones jsonb, p_branch_stocks jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare
  v_tenant uuid := private.current_tenant_id();
  v_branch uuid;
  v_context jsonb;
  v_result jsonb;
  v_existing jsonb;
  v_updates jsonb;
  v_merged jsonb;
begin
  if (select auth.uid()) is null or v_tenant is null then
    raise exception using errcode='42501', message='An active tenant account is required.';
  end if;
  if p_branch_stocks is null then
    return public.save_current_branch_products(p_products,p_product_tombstones);
  end if;
  if jsonb_typeof(p_branch_stocks) <> 'array' then
    raise exception using errcode='22023',message='A branch stocks array is required.';
  end if;
  v_context := public.get_current_branch_context();
  v_branch := nullif(v_context ->> 'activeBranchId','')::uuid;
  if v_context ->> 'activeScope' <> 'branch' or v_branch is null
    or not private.can_write_branch(v_tenant,v_branch,'products.write') then
    raise exception using errcode='42501',message='Product write permission in the selected branch is required.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_branch_stocks) supplied(item)
    where jsonb_typeof(item)<>'object'
      or coalesce(item->>'branchId',item->>'branch_id','') <> v_branch::text
      or nullif(item->>'productId','') is null
      or (item ? 'tenantId' and item->>'tenantId' <> v_tenant::text)) then
    raise exception using errcode='42501',message='Stock updates must belong to the selected tenant and branch.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_branch_stocks) supplied(item)
    group by item->>'productId' having count(*)>1) then
    raise exception using errcode='22023',message='Each branch product must have one stock update.';
  end if;

  -- This existing function checks catalogue authorization and locks the workspace.
  -- Any subsequent stock failure rolls its catalogue write back in the same transaction.
  v_result := public.save_current_branch_products(p_products,p_product_tombstones);
  select payload into v_existing from public.tenant_workspaces where tenant_id=v_tenant for update;
  if exists(select 1 from jsonb_array_elements(p_branch_stocks) supplied(item)
    where not exists(select 1 from jsonb_array_elements(coalesce(v_existing->'products','[]'::jsonb)) product(item)
      where product.item->>'id'=supplied.item->>'productId')) then
    raise exception using errcode='22023',message='A stock update references an unknown product.';
  end if;

  -- Retain the durable stock ID for each (branch, product), even for legacy IDs.
  select coalesce(jsonb_agg(supplied.item || jsonb_build_object('id',
    coalesce(existing.item->>'id',nullif(supplied.item->>'id',''),
      'branch-stock-'||v_branch::text||'-'||(supplied.item->>'productId')))),'[]'::jsonb)
  into v_updates
  from jsonb_array_elements(p_branch_stocks) supplied(item)
  left join lateral (
    select item from jsonb_array_elements(coalesce(v_existing->'branchStocks','[]'::jsonb)) existing(item)
    where coalesce(item->>'branchId',item->>'branch_id')=v_branch::text
      and item->>'productId'=supplied.item->>'productId' limit 1
  ) existing on true;

  if exists(select 1 from jsonb_array_elements(v_updates) supplied(item)
    join jsonb_array_elements(coalesce(v_existing->'branchStocks','[]'::jsonb)) existing(item)
      on supplied.item->>'id'=existing.item->>'id'
    where coalesce(existing.item->>'branchId',existing.item->>'branch_id','')<>v_branch::text
      or existing.item->>'productId'<>supplied.item->>'productId') then
    raise exception using errcode='42501',message='An existing stock ID belongs to another branch or product.';
  end if;
  v_merged := private.merge_workspace_products_by_id(v_existing->'branchStocks',v_updates);
  update public.tenant_workspaces
  set payload=jsonb_set(payload,'{branchStocks}',v_merged,true),
      updated_at=statement_timestamp(),updated_by=(select auth.uid())
  where tenant_id=v_tenant;
  return v_result || jsonb_build_object('branchStocks',
    private.filter_branch_json_array(v_merged,v_branch,false));
end $body$;
revoke all on function public.save_current_branch_products(jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_current_branch_products(jsonb,jsonb,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.save_current_branch_workspace(p_workspace jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean := false;
  v_existing jsonb;
  v_existing_scoped jsonb;
  v_next jsonb;
  v_existing_settings jsonb;
  v_incoming_settings jsonb;
  v_next_settings jsonb;
  v_key text;
  v_permission_key text;
  v_next_sale_tombstones jsonb;
  v_next_purchase_tombstones jsonb;
  v_next_delivery_tombstones jsonb;
  v_next_expense_tombstones jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_workspace is null or jsonb_typeof(p_workspace) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid workspace object is required.';
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

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
    and private.is_tenant_branch_administrator(v_tenant_id)
  then
    v_next := p_workspace;
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
    end if;

    v_existing_scoped := coalesce(
      public.get_current_branch_workspace() -> 'payload',
      '{}'::jsonb
    );
    if not private.is_tenant_branch_administrator(v_tenant_id) then
      if v_scope = 'compatibility_primary' then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;

      foreach v_key in array array[
        'products', 'sales', 'expenses', 'deliveries',
        'pendingDeliveryNotes', 'purchases', 'branchStocks',
        'branchStaffAssignments'
      ]
      loop
        v_permission_key := case v_key
          when 'products' then 'products.write'
          when 'sales' then 'pos.write'
          when 'expenses' then 'expenses.write'
          when 'deliveries' then 'deliveries.write'
          when 'pendingDeliveryNotes' then 'deliveries.write'
          when 'purchases' then 'products.write'
          when 'branchStocks' then 'products.write'
          when 'branchStaffAssignments' then 'branches.manage'
        end;
        if coalesce(p_workspace -> v_key, '[]'::jsonb)
          is distinct from coalesce(v_existing_scoped -> v_key, '[]'::jsonb)
          and not private.can_write_branch(v_tenant_id, v_branch_id, v_permission_key)
        then
          raise exception using
            errcode = '42501',
            message = format('Write permission is required for %s.', v_key);
        end if;
      end loop;

      if coalesce(p_workspace -> 'settings', '{}'::jsonb)
        is distinct from coalesce(v_existing_scoped -> 'settings', '{}'::jsonb)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'settings.write')
      then
        raise exception using
          errcode = '42501',
          message = 'Settings write permission is required.';
      end if;
    end if;

    v_next := v_existing;
    foreach v_key in array array[
      'pendingDeliveryNotes', 'branchStocks', 'branchStaffAssignments'
    ]
    loop
      v_next := jsonb_set(
        v_next,
        array[v_key],
        private.replace_branch_json_array(
          v_existing -> v_key,
          p_workspace -> v_key,
          v_branch_id,
          case when v_key in ('branchStocks', 'branchStaffAssignments') then false else v_include_unassigned end
        ),
        true
      );
    end loop;

    v_next_sale_tombstones := coalesce(v_existing -> 'saleTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'saleTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{sales}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'sales', p_workspace -> 'sales', v_branch_id, v_include_unassigned, v_next_sale_tombstones
      ),
      true
    );

    v_next_purchase_tombstones := coalesce(v_existing -> 'purchaseTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'purchaseTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{purchases}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'purchases', p_workspace -> 'purchases', v_branch_id, v_include_unassigned, v_next_purchase_tombstones
      ),
      true
    );

    v_next_delivery_tombstones := coalesce(v_existing -> 'deliveryTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'deliveryTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{deliveries}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'deliveries', p_workspace -> 'deliveries', v_branch_id, v_include_unassigned, v_next_delivery_tombstones
      ),
      true
    );

    v_next_expense_tombstones := coalesce(v_existing -> 'expenseTombstones', '{}'::jsonb)
      || coalesce(p_workspace -> 'expenseTombstones', '{}'::jsonb);
    v_next := jsonb_set(
      v_next, '{expenses}',
      private.merge_branch_json_array_by_id(
        v_existing -> 'expenses', p_workspace -> 'expenses', v_branch_id, v_include_unassigned, v_next_expense_tombstones
      ),
      true
    );

    v_next := jsonb_set(
      v_next,
      '{products}',
      private.merge_workspace_products_by_id(
        v_existing -> 'products',
        p_workspace -> 'products'
      ),
      true
    );

    v_existing_settings := coalesce(v_existing -> 'settings', '{}'::jsonb);
    v_incoming_settings := coalesce(p_workspace -> 'settings', '{}'::jsonb);
    if private.is_tenant_branch_administrator(v_tenant_id) then
      v_next_settings := v_incoming_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_incoming_settings -> 'staffs',
          v_branch_id,
          v_include_unassigned
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_incoming_settings -> 'paymentChannels',
          v_branch_id,
          v_include_unassigned
        )
      );
    else
      v_next_settings := v_existing_settings || jsonb_build_object(
        'staffs', private.replace_branch_json_array(
          v_existing_settings -> 'staffs',
          v_incoming_settings -> 'staffs',
          v_branch_id,
          false
        ),
        'paymentChannels', private.replace_branch_json_array(
          v_existing_settings -> 'paymentChannels',
          v_incoming_settings -> 'paymentChannels',
          v_branch_id,
          false
        )
      );
    end if;
    v_next := jsonb_set(v_next, '{settings}', v_next_settings, true);

    v_next := v_next || jsonb_build_object(
      'productTombstones',
      coalesce(v_existing -> 'productTombstones', '{}'::jsonb)
        || coalesce(p_workspace -> 'productTombstones', '{}'::jsonb),
      'saleTombstones', v_next_sale_tombstones,
      'purchaseTombstones', v_next_purchase_tombstones,
      'deliveryTombstones', v_next_delivery_tombstones,
      'expenseTombstones', v_next_expense_tombstones
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  -- A delayed full autosave must not undo a newer product/branch-stock edit.
  v_next := jsonb_set(v_next, '{products}',
    private.merge_workspace_products_by_id(v_existing -> 'products', v_next -> 'products'), true);
  v_next := jsonb_set(v_next, '{branchStocks}',
    private.merge_workspace_products_by_id(v_existing -> 'branchStocks', v_next -> 'branchStocks'), true);

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return public.get_current_branch_workspace();
end;
$function$;
notify pgrst, 'reload schema';

