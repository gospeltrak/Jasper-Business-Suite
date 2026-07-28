begin;

create or replace function private.filter_branch_json_array(
  p_items jsonb,
  p_branch_id uuid,
  p_include_unassigned boolean
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(item.value), '[]'::jsonb)
  from jsonb_array_elements(
    case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end
  ) as item(value)
  where coalesce(item.value ->> 'branchId', item.value ->> 'branch_id') = p_branch_id::text
    or (
      p_include_unassigned
      and nullif(coalesce(item.value ->> 'branchId', item.value ->> 'branch_id'), '') is null
    );
$$;

create or replace function private.replace_branch_json_array(
  p_existing jsonb,
  p_incoming jsonb,
  p_branch_id uuid,
  p_include_unassigned boolean
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with existing_items as (
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
  incoming_items as (
    select item.value
    from jsonb_array_elements(
      private.filter_branch_json_array(
        p_incoming,
        p_branch_id,
        p_include_unassigned
      )
    ) as item(value)
  )
  select coalesce(jsonb_agg(combined.value), '[]'::jsonb)
  from (
    select value from existing_items
    union all
    select value from incoming_items
  ) as combined;
$$;

create or replace function private.merge_workspace_products_by_id(
  p_existing jsonb,
  p_incoming jsonb
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with existing_items as (
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_existing) = 'array' then p_existing else '[]'::jsonb end
    ) as item(value)
  ),
  incoming_items as (
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_incoming) = 'array' then p_incoming else '[]'::jsonb end
    ) as item(value)
  ),
  merged as (
    select coalesce(incoming.value, existing.value) as value
    from existing_items as existing
    left join incoming_items as incoming
      on nullif(incoming.value ->> 'id', '') = nullif(existing.value ->> 'id', '')
    union all
    select incoming.value
    from incoming_items as incoming
    where not exists (
      select 1
      from existing_items as existing
      where nullif(existing.value ->> 'id', '') = nullif(incoming.value ->> 'id', '')
    )
  )
  select coalesce(jsonb_agg(merged.value), '[]'::jsonb)
  from merged;
$$;

create or replace function public.get_current_branch_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean := false;
  v_payload jsonb;
  v_settings jsonb;
  v_branch_stocks jsonb;
  v_product_ids text[];
  v_products jsonb;
  v_updated_at timestamptz;
begin
  if v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  select workspace.payload, workspace.updated_at
  into v_payload, v_updated_at
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id;
  if not found then
    return jsonb_build_object(
      'payload', null,
      'updatedAt', null,
      'accessMode', 'empty'
    );
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
  then
    return jsonb_build_object(
      'payload', v_payload,
      'updatedAt', v_updated_at,
      'accessMode', 'all_branches'
    );
  end if;

  if v_scope = 'compatibility_primary' then
    v_include_unassigned := true;
  elsif v_scope = 'branch' and v_branch_id is not null then
    v_include_unassigned := coalesce(
      (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
      false
    );
  else
    v_payload := v_payload
      || jsonb_build_object(
        'products', '[]'::jsonb,
        'sales', '[]'::jsonb,
        'expenses', '[]'::jsonb,
        'deliveries', '[]'::jsonb,
        'pendingDeliveryNotes', '[]'::jsonb,
        'purchases', '[]'::jsonb,
        'branches', '[]'::jsonb,
        'branchStocks', '[]'::jsonb,
        'branchStaffAssignments', '[]'::jsonb
      );
    v_settings := coalesce(v_payload -> 'settings', '{}'::jsonb)
      || jsonb_build_object(
        'staffs', '[]'::jsonb,
        'paymentChannels', '[]'::jsonb
      );
    return jsonb_build_object(
      'payload', v_payload || jsonb_build_object('settings', v_settings),
      'updatedAt', v_updated_at,
      'accessMode', 'no_branch_access'
    );
  end if;

  if v_branch_id is null then
    -- Compatibility mode before physical Primary Branch provisioning.
    v_branch_stocks := '[]'::jsonb;
  else
    v_branch_stocks := private.filter_branch_json_array(
      v_payload -> 'branchStocks',
      v_branch_id,
      false
    );
  end if;

  select coalesce(array_agg(stock.value ->> 'productId'), '{}'::text[])
  into v_product_ids
  from jsonb_array_elements(v_branch_stocks) as stock(value)
  where nullif(stock.value ->> 'productId', '') is not null;

  select coalesce(jsonb_agg(product.value), '[]'::jsonb)
  into v_products
  from jsonb_array_elements(
    case
      when jsonb_typeof(v_payload -> 'products') = 'array' then v_payload -> 'products'
      else '[]'::jsonb
    end
  ) as product(value)
  where (
    v_branch_id is not null
    and coalesce(product.value ->> 'branchId', product.value ->> 'branch_id') = v_branch_id::text
  )
  or (
    v_include_unassigned
    and nullif(coalesce(product.value ->> 'branchId', product.value ->> 'branch_id'), '') is null
  )
  or product.value ->> 'id' = any(v_product_ids);

  v_settings := coalesce(v_payload -> 'settings', '{}'::jsonb)
    || jsonb_build_object(
      'staffs',
      case
        when v_branch_id is null then private.filter_branch_json_array(
          v_payload -> 'settings' -> 'staffs',
          '00000000-0000-0000-0000-000000000000'::uuid,
          true
        )
        else private.filter_branch_json_array(
          v_payload -> 'settings' -> 'staffs',
          v_branch_id,
          v_include_unassigned
        )
      end,
      'paymentChannels',
      private.filter_branch_json_array(
        v_payload -> 'settings' -> 'paymentChannels',
        coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        v_include_unassigned
      )
    );

  v_payload := v_payload || jsonb_build_object(
    'products', v_products,
    'sales', private.filter_branch_json_array(v_payload -> 'sales', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'expenses', private.filter_branch_json_array(v_payload -> 'expenses', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'deliveries', private.filter_branch_json_array(v_payload -> 'deliveries', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'pendingDeliveryNotes', private.filter_branch_json_array(v_payload -> 'pendingDeliveryNotes', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'purchases', private.filter_branch_json_array(v_payload -> 'purchases', coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), v_include_unassigned),
    'branches', coalesce(v_context -> 'branches', '[]'::jsonb),
    'branchStocks', v_branch_stocks,
    'branchStaffAssignments', case
      when v_branch_id is null then '[]'::jsonb
      else private.filter_branch_json_array(v_payload -> 'branchStaffAssignments', v_branch_id, false)
    end,
    'settings', v_settings
  );

  return jsonb_build_object(
    'payload', v_payload,
    'updatedAt', v_updated_at,
    'accessMode', case when v_branch_id is null then 'compatibility_primary' else 'branch' end
  );
end;
$$;

create or replace function public.save_current_branch_workspace(p_workspace jsonb)
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
  v_include_unassigned boolean := false;
  v_existing jsonb;
  v_existing_scoped jsonb;
  v_next jsonb;
  v_existing_settings jsonb;
  v_incoming_settings jsonb;
  v_next_settings jsonb;
  v_key text;
  v_permission_key text;
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
      'sales', 'expenses', 'deliveries', 'pendingDeliveryNotes', 'purchases',
      'branchStocks', 'branchStaffAssignments'
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

    -- Tenant-wide metadata/tombstones are merge-only for branch-scoped saves.
    v_next := v_next || jsonb_build_object(
      'productTombstones',
      coalesce(v_existing -> 'productTombstones', '{}'::jsonb)
        || coalesce(p_workspace -> 'productTombstones', '{}'::jsonb),
      'saleTombstones',
      coalesce(v_existing -> 'saleTombstones', '{}'::jsonb)
        || coalesce(p_workspace -> 'saleTombstones', '{}'::jsonb)
    );
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return public.get_current_branch_workspace();
end;
$$;

revoke all on function public.get_current_branch_workspace() from public, anon;
revoke all on function public.save_current_branch_workspace(jsonb) from public, anon;
grant execute on function public.get_current_branch_workspace() to authenticated;
grant execute on function public.save_current_branch_workspace(jsonb) to authenticated;

-- Raw JSON rows are reserved for tenant administrators. Branch-assigned users
-- must use the filtered RPCs above, so changing a URL/request cannot reveal
-- another branch's records.
drop policy if exists tenant_workspace_isolation on public.tenant_workspaces;
create policy tenant_workspace_admin_isolation on public.tenant_workspaces
  for all
  to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.is_tenant_branch_administrator(tenant_id)
  )
  with check (
    tenant_id = private.current_tenant_id()
    and private.is_tenant_branch_administrator(tenant_id)
  );

drop policy if exists tenant_data_read_own on public.tenant_data;
drop policy if exists tenant_data_insert_own on public.tenant_data;
drop policy if exists tenant_data_update_own on public.tenant_data;
drop policy if exists tenant_data_delete_own on public.tenant_data;

create policy tenant_data_admin_read on public.tenant_data
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.is_tenant_branch_administrator(tenant_id)
  );
create policy tenant_data_admin_insert on public.tenant_data
  for insert to authenticated
  with check (
    tenant_id = private.current_tenant_id()
    and private.is_tenant_branch_administrator(tenant_id)
  );
create policy tenant_data_admin_update on public.tenant_data
  for update to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.is_tenant_branch_administrator(tenant_id)
  )
  with check (
    tenant_id = private.current_tenant_id()
    and private.is_tenant_branch_administrator(tenant_id)
  );
create policy tenant_data_admin_delete on public.tenant_data
  for delete to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.is_tenant_branch_administrator(tenant_id)
  );

commit;
