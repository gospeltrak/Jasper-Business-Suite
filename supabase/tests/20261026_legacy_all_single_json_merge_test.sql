-- Regression test: prove the optimized legacy __all__ route produces the
-- exact same JSONB as the prior loop for realistic and conflicting keys.
-- Uses synthetic JSON only; no table reads or writes.
begin transaction read only;
do $test$
declare
  v_tenant text := '11111111-1111-4111-8111-111111111111';
  v_payload jsonb;
  v_initial jsonb;
  v_legacy jsonb;
  v_optimized jsonb;
  v_key text;
  v_case integer;
begin
  for v_case in 1..4 loop
    case v_case
    when 1 then
      v_payload := jsonb_build_object('products',jsonb_build_array(jsonb_build_object('id','p1')),
        'sales',jsonb_build_array(jsonb_build_object('id','sale1')),
        'settings',jsonb_build_object('language','sw'),
        'expenses',jsonb_build_array(), 'branchStocks',jsonb_build_array(jsonb_build_object('id','st1')));
      v_initial := jsonb_build_object('theme','light','settings',jsonb_build_object('language','en'));
    when 2 then
      v_payload := jsonb_build_object('branches',jsonb_build_array(),'users',jsonb_build_array());
      v_initial := '{}'::jsonb;
    when 3 then
      v_payload := jsonb_build_object('pendingDeliveryNotes',jsonb_build_array(jsonb_build_object('id','note1')),
        'branchStocks',jsonb_build_array(),'deliveries',jsonb_build_array(jsonb_build_object('id','d1')));
      v_initial := jsonb_build_object('sales_map','stale','pending_delivery_notes_map','stale',
        'branch_stocks_map','stale','products_map',jsonb_build_object(v_tenant,jsonb_build_array('old')));
    else
      v_payload := jsonb_build_object('products',jsonb_build_array(), 'sales',jsonb_build_array(),
        'purchases',jsonb_build_array(jsonb_build_object('id','purchase1')),
        'expenses',jsonb_build_array(jsonb_build_object('id','expense1')),
        'pendingDeliveryNotes',jsonb_build_array(),
        'deliveries',jsonb_build_array(),
        'branchStocks',jsonb_build_array());
      v_initial := jsonb_build_object('tenant_data_flags',jsonb_build_object('archived',false));
    end case;

    v_legacy := v_initial || v_payload;
    for v_key in select unnest(array['products','sales','expenses','deliveries',
        'purchases','pendingDeliveryNotes','branchStocks'])
    loop
      v_legacy := v_legacy || jsonb_build_object(v_key||'_map',
        jsonb_build_object(v_tenant,coalesce(v_payload->v_key,'[]'::jsonb)));
    end loop;
    v_legacy := v_legacy || jsonb_build_object(
      'pending_delivery_notes_map',
      jsonb_build_object(v_tenant,coalesce(v_payload->'pendingDeliveryNotes','[]'::jsonb)),
      'branch_stocks_map',
      jsonb_build_object(v_tenant,coalesce(v_payload->'branchStocks','[]'::jsonb)));

    v_optimized := v_initial || v_payload || jsonb_build_object(
      'products_map', jsonb_build_object(v_tenant,coalesce(v_payload->'products','[]'::jsonb)),
      'sales_map', jsonb_build_object(v_tenant,coalesce(v_payload->'sales','[]'::jsonb)),
      'expenses_map', jsonb_build_object(v_tenant,coalesce(v_payload->'expenses','[]'::jsonb)),
      'deliveries_map', jsonb_build_object(v_tenant,coalesce(v_payload->'deliveries','[]'::jsonb)),
      'purchases_map', jsonb_build_object(v_tenant,coalesce(v_payload->'purchases','[]'::jsonb)),
      'pendingDeliveryNotes_map', jsonb_build_object(v_tenant,coalesce(v_payload->'pendingDeliveryNotes','[]'::jsonb)),
      'branchStocks_map', jsonb_build_object(v_tenant,coalesce(v_payload->'branchStocks','[]'::jsonb)),
      'pending_delivery_notes_map', jsonb_build_object(v_tenant,coalesce(v_payload->'pendingDeliveryNotes','[]'::jsonb)),
      'branch_stocks_map', jsonb_build_object(v_tenant,coalesce(v_payload->'branchStocks','[]'::jsonb)));

    if v_optimized is distinct from v_legacy then
      raise exception 'Legacy __all__ payload regression for synthetic case %', v_case;
    end if;
  end loop;
end;
$test$;
rollback;
