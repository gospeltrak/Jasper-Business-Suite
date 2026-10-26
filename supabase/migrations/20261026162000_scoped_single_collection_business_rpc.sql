-- Performance-only RPC rewrite: NO DELETE/UPDATE/INSERT/TRUNCATE/DROP.
-- Isolated per collection, same tenant/branch scope and response structure.
-- Prior public RPC remains as-is for __all__, and all existing write RPCs
-- remain unchanged. Execute only after read-only equivalence tests.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function private.scoped_normalized_business_collection(
  p_tenant uuid, p_key text
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_context jsonb;
  v_scope text;
  v_branch uuid;
  v_unassigned boolean := false;
  v_payload jsonb;
  v_items jsonb;
begin
  if p_tenant is null or p_tenant is distinct from private.current_tenant_id()
    or (select auth.uid()) is null
    or not private.normalized_writes_enabled(p_tenant) then
    raise exception using errcode='42501',message='An active normalized tenant account is required.';
  end if;
  if p_key not in ('products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes') then
    raise exception using errcode='22023',message='Unsupported normalized collection.';
  end if;

  -- Existing protected lightweight loader implements identical product scope,
  -- branch-stock association and historical-unassigned compatibility.
  if p_key in ('products','branchStocks','pendingDeliveryNotes') then
    return coalesce(private.get_current_branch_workspace_lightweight()->'payload'->p_key,'[]'::jsonb);
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context->>'activeScope','no_branch_access');
  v_branch := nullif(v_context->>'activeBranchId','')::uuid;
  if v_scope='all_branches'
    and coalesce((v_context->>'canViewAllBranches')::boolean,false) then
    return coalesce(private.normalized_business_snapshot(p_tenant,ARRAY[p_key])->p_key,'[]'::jsonb);
  end if;
  if v_scope='compatibility_primary' then
    v_unassigned:=true;
  elsif v_scope='branch' and v_branch is not null then
    v_unassigned:=coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false);
  else
    return '[]'::jsonb;
  end if;
  v_payload:=private.normalized_business_snapshot(p_tenant,ARRAY[p_key]);
  v_items:=private.filter_branch_json_array(
    v_payload->p_key,
    coalesce(v_branch,'00000000-0000-0000-0000-000000000000'::uuid),
    v_unassigned
  );
  return coalesce(v_items,'[]'::jsonb);
end;
$function$;

revoke all on function private.scoped_normalized_business_collection(uuid,text) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION public.route_current_branch_business_data(p_key text, p_payload jsonb DEFAULT NULL::jsonb, p_write boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tenant uuid:=private.current_tenant_id();v_key text;v_records jsonb;v_result jsonb;v_payload jsonb;
begin
 if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication is required.';end if;
 if v_tenant is null then return jsonb_build_object('handled',false);end if;
 v_key:=private.legacy_business_data_key(p_key);
 if not private.normalized_writes_enabled(v_tenant) or (v_key is null and p_key<>'__all__') then return jsonb_build_object('handled',false);end if;
 if p_write then
   if v_key is null then raise exception using errcode='22023',message='A supported business collection is required.';end if;
   v_records:=case when jsonb_typeof(p_payload)='array' then p_payload else p_payload->v_tenant::text end;
   if jsonb_typeof(v_records) is distinct from 'array' then raise exception using errcode='22023',message='A records array is required.';end if;
   case v_key
    when 'products' then perform public.save_current_branch_products(v_records,'{}'::jsonb);
    when 'sales' then perform public.save_current_branch_sales(v_records,'{}'::jsonb,null,null);
    when 'expenses' then perform public.save_current_branch_expenses(v_records,'{}'::jsonb);
    when 'deliveries' then perform public.save_current_branch_deliveries(v_records,'{}'::jsonb);
    when 'purchases' then perform public.save_current_branch_purchases(v_records,'{}'::jsonb,null,null);
    when 'pendingDeliveryNotes' then perform private.save_direct_pending_notes(v_tenant,v_records);
    else
      v_payload:=public.get_current_branch_workspace()->'payload';
      perform public.save_current_branch_workspace(jsonb_set(v_payload,array[v_key],v_records,true));
   end case;
 end if;
 -- Fast path: one-key reads/writes must not aggregate ALL normalized sales,
 -- purchases, expenses and stock. The full legacy __all__ read is untouched.
 if p_key='__all__' then
   v_payload:=public.get_current_branch_workspace()->'payload';
 else
   v_records:=private.scoped_normalized_business_collection(v_tenant,v_key);
 end if;
 if p_key='__all__' then
   select coalesce(jsonb_object_agg(data_key,payload),'{}'::jsonb) into v_result from public.tenant_data
     where tenant_id=v_tenant::text and private.legacy_business_data_key(data_key) is null
       and data_key not like 'workspace_backup_%' and data_key not like 'data_backup_%';
   -- Build legacy map aliases as one JSONB object, then append once.
   -- The old implementation repeatedly copied the full workspace JSONB
   -- (and its large product/sales arrays) nine times per __all__ request.
   -- Values, keys, precedence, branches and permission checks stay identical.
   v_result:=v_result || v_payload || jsonb_build_object(
     'products_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'products','[]'::jsonb)),
     'sales_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'sales','[]'::jsonb)),
     'expenses_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'expenses','[]'::jsonb)),
     'deliveries_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'deliveries','[]'::jsonb)),
     'purchases_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'purchases','[]'::jsonb)),
     'pendingDeliveryNotes_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'pendingDeliveryNotes','[]'::jsonb)),
     'branchStocks_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'branchStocks','[]'::jsonb)),
     'pending_delivery_notes_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'pendingDeliveryNotes','[]'::jsonb)),
     'branch_stocks_map', jsonb_build_object(v_tenant::text,coalesce(v_payload->'branchStocks','[]'::jsonb))
   );
 else
   v_result:=case when p_key like '%\_map' escape '\' then jsonb_build_object(v_tenant::text,coalesce(v_records,'[]'::jsonb)) else coalesce(v_records,'[]'::jsonb) end;
 end if;
 return jsonb_build_object('handled',true,'payload',v_result);
end;
$function$

commit;
