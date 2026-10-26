-- Read-path-only optimization. Never mutate user, staff or financial data.
-- The full public workspace reader remains unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

CREATE OR REPLACE FUNCTION private.get_current_branch_workspace_lightweight()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Paginated ledgers are loaded independently. Do not aggregate them
  -- only to discard them in bootstrap_v3.
  select case when private.normalized_writes_enabled(v_tenant_id)
    then private.normalized_business_snapshot(v_tenant_id, array['products','branchStocks','pendingDeliveryNotes'])
    else workspace.payload end, workspace.updated_at
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
$function$


revoke all on function private.get_current_branch_workspace_lightweight() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_current_branch_workspace_bootstrap_v3()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_scoped jsonb;
  v_payload jsonb;
begin
  if v_tenant_id is null or (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  if not private.workspace_normalized_reads_ready(v_tenant_id) then
    return public.get_current_branch_workspace_v2();
  end if;

  -- Preserve the established product, stock, settings and permission scope.
  -- Historical ledgers are delivered independently by the cursor RPC.
  v_scoped := private.get_current_branch_workspace_lightweight();
  v_payload := v_scoped -> 'payload';
  if v_payload is null then
    return v_scoped || jsonb_build_object('readSource', 'normalized_paginated');
  end if;

  v_payload := v_payload || jsonb_build_object(
    'sales', '[]'::jsonb,
    'expenses', '[]'::jsonb,
    'deliveries', '[]'::jsonb,
    'purchases', '[]'::jsonb
  );

  return jsonb_set(v_scoped, '{payload}', v_payload, true)
    || jsonb_build_object('readSource', 'normalized_paginated');
end;
$function$


commit;
