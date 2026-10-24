CREATE OR REPLACE FUNCTION public.reconcile_workspace_normalization(p_tenant_id uuid, p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS workspace_reconciliation_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_workspace public.tenant_workspaces%rowtype;
  v_version text;
  v_source_counts jsonb;
  v_target_counts jsonb;
  v_source_totals jsonb;
  v_target_totals jsonb;
  v_mismatches jsonb;
  v_is_match boolean;
  v_result public.workspace_reconciliation_runs%rowtype;
begin
  select * into v_workspace from public.tenant_workspaces where tenant_id = p_tenant_id;
  if not found then raise exception using errcode = 'P0002', message = 'Tenant workspace was not found.'; end if;
  if private.normalized_writes_enabled(p_tenant_id) then v_workspace.payload:=private.normalized_business_snapshot(p_tenant_id);end if;
  select coalesce(state.migration_version, 'workspace-normalization-v1')
    into v_version from public.workspace_migration_state state where state.tenant_id = p_tenant_id;
  v_version := coalesce(v_version, 'workspace-normalization-v1');

  select jsonb_build_object(
    'products', jsonb_array_length(coalesce(v_workspace.payload -> 'products', '[]'::jsonb)),
    'sales', jsonb_array_length(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)),
    'saleItems', coalesce((select sum(jsonb_array_length(coalesce(item -> 'items', '[]'::jsonb))) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'expenses', jsonb_array_length(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb)),
    'deliveries', jsonb_array_length(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)),
    'purchases', jsonb_array_length(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)),
    'purchaseItems', coalesce((select sum(jsonb_array_length(coalesce(item -> 'items', '[]'::jsonb))) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0)
  ) into v_source_counts;

  select jsonb_build_object(
    'products', (select count(*) from public.products where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'sales', (select count(*) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'saleItems', (select count(*) from public.sale_items where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'expenses', (select count(*) from public.expenses where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'deliveries', (select count(*) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'purchases', (select count(*) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active),
    'purchaseItems', (select count(*) from public.purchase_items where tenant_id = p_tenant_id and legacy_id is not null and source_active)
  ) into v_target_counts;

  select jsonb_build_object(
    'salesTotal', coalesce((select sum(private.safe_numeric(item ->> 'total')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'salesTax', coalesce((select sum(private.safe_numeric(item ->> 'tax')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'salesPaid', coalesce((select sum(private.safe_numeric(item ->> 'amountPaid')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'salesDue', coalesce((select sum(private.safe_numeric(item ->> 'amountDue')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'sales', '[]'::jsonb)) item), 0),
    'expenseAmount', coalesce((select sum(private.safe_numeric(item ->> 'amount')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'expenses', '[]'::jsonb)) item), 0),
    'deliveryTotal', coalesce((select sum(private.safe_numeric(item ->> 'totalAmount')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)) item), 0),
    'deliveryCost', coalesce((select sum(private.safe_numeric(item ->> 'deliveryCost')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'deliveries', '[]'::jsonb)) item), 0),
    'purchaseTotal', coalesce((select sum(private.safe_numeric(item ->> 'totalAmount')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0),
    'purchasePaid', coalesce((select sum(private.safe_numeric(item ->> 'amountPaid')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0),
    'purchaseDue', coalesce((select sum(private.safe_numeric(item ->> 'amountDue')) from jsonb_array_elements(coalesce(v_workspace.payload -> 'purchases', '[]'::jsonb)) item), 0)
  ) into v_source_totals;

  select jsonb_build_object(
    'salesTotal', coalesce((select sum(total) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'salesTax', coalesce((select sum(tax) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'salesPaid', coalesce((select sum(amount_paid) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'salesDue', coalesce((select sum(amount_due) from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'expenseAmount', coalesce((select sum(amount) from public.expenses where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'deliveryTotal', coalesce((select sum(total_amount) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'deliveryCost', coalesce((select sum(delivery_cost) from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'purchaseTotal', coalesce((select sum(total_amount) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'purchasePaid', coalesce((select sum(amount_paid) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0),
    'purchaseDue', coalesce((select sum(amount_due) from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active), 0)
  ) into v_target_totals;

  v_mismatches := jsonb_strip_nulls(jsonb_build_object(
    'counts', case when v_source_counts is distinct from v_target_counts then jsonb_build_object('source', v_source_counts, 'target', v_target_counts) end,
    'totals', case when v_source_totals is distinct from v_target_totals then jsonb_build_object('source', v_source_totals, 'target', v_target_totals) end
  ));
  v_is_match := v_mismatches = '{}'::jsonb;
  insert into public.workspace_reconciliation_runs(batch_id, tenant_id, migration_version, source_updated_at, source_payload_hash, source_counts, target_counts, source_totals, target_totals, mismatch_details, is_match)
  values(p_batch_id, p_tenant_id, v_version, v_workspace.updated_at, md5(v_workspace.payload::text), v_source_counts, v_target_counts, v_source_totals, v_target_totals, v_mismatches, v_is_match)
  returning * into v_result;
  if p_batch_id is not null then
    update public.workspace_migration_batches
    set status = case when v_is_match then 'verified' else 'processed' end,
        completed_at = case when v_is_match then statement_timestamp() else completed_at end,
        error_details = case when v_is_match then '{}'::jsonb else v_mismatches end,
        updated_at = statement_timestamp()
    where id = p_batch_id
      and tenant_id = p_tenant_id;
  end if;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_workspace_shadow_content(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if private.normalized_writes_enabled(p_tenant_id) then v_payload:=private.normalized_business_snapshot(p_tenant_id);end if;

  v_products := coalesce(v_payload -> 'products', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.products where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_sales := coalesce(v_payload -> 'sales', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.sales where tenant_id = p_tenant_id and legacy_id is not null and source_active
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
    where child.tenant_id = p_tenant_id and child.legacy_id is not null and child.source_active
  ), '[]'::jsonb);
  v_expenses := coalesce(v_payload -> 'expenses', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.expenses where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_deliveries := coalesce(v_payload -> 'deliveries', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.deliveries where tenant_id = p_tenant_id and legacy_id is not null and source_active
  ), '[]'::jsonb);
  v_purchases := coalesce(v_payload -> 'purchases', '[]'::jsonb) = coalesce((
    select jsonb_agg(source_record order by source_ordinal)
    from public.purchases where tenant_id = p_tenant_id and legacy_id is not null and source_active
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
    where child.tenant_id = p_tenant_id and child.legacy_id is not null and child.source_active
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
$function$
;

CREATE OR REPLACE FUNCTION public.validate_branch_stock_shadow(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if private.normalized_writes_enabled(p_tenant_id) then v_source:=private.normalized_business_snapshot(p_tenant_id,array['branchStocks'])->'branchStocks';end if;
  select coalesce(jsonb_agg(source_record order by source_ordinal), '[]'::jsonb),
         count(*), coalesce(sum(quantity), 0)
  into v_target, v_target_count, v_target_quantity
  from public.branch_stock where tenant_id = p_tenant_id and legacy_id is not null and source_active;
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
$function$
;


