-- Real-data regression, entirely rolled back (including audit rows and test flags).
do $qa$
declare
 v_tenant uuid; v_payload jsonb; v_time timestamptz; v_batch uuid; v_run public.workspace_reconciliation_runs%rowtype;
 v_sale text; v_sale_id uuid; v_stock text; v_stock_id uuid; v_actor uuid; v_staff uuid;
 v_table text; v_leaks bigint; v_native_hash text; v_hash text; v_checks jsonb:='[]'::jsonb;
begin
 begin
  select tenant_id,payload,updated_at into v_tenant,v_payload,v_time from public.tenant_workspaces
    where jsonb_array_length(coalesce(payload->'sales','[]'::jsonb))>0 and jsonb_array_length(coalesce(payload->'branchStocks','[]'::jsonb))>0
    order by jsonb_array_length(payload->'sales') desc limit 1;
  select md5(coalesce(jsonb_agg(to_jsonb(p)-'source_active' order by id)::text,'[]')) into v_native_hash from public.products p where tenant_id=v_tenant and legacy_id is null;
  select (public.normalize_workspace_snapshot(v_tenant,v_time)).id into v_batch;
  perform public.normalize_branch_stock_snapshot(v_tenant,v_time);
  perform public.refresh_workspace_source_ordinals(v_tenant);
  v_run:=public.reconcile_workspace_normalization(v_tenant,v_batch);
  if not v_run.is_match or v_run.source_payload_hash is distinct from md5(v_payload::text)
    or not (public.validate_workspace_shadow_content(v_tenant)->>'allMatch')::boolean
    or not (public.validate_branch_stock_shadow(v_tenant)->>'allMatch')::boolean then raise exception 'Current snapshot did not reconcile'; end if;
  v_checks:=v_checks||jsonb_build_array('Counts, money totals, content and stock match the authoritative snapshot; reconciliation hash is populated');
  v_sale:=v_payload->'sales'->0->>'id';
  v_stock:=v_payload->'branchStocks'->0->>'id';
  select id into v_sale_id from public.sales where tenant_id=v_tenant and legacy_id=v_sale;
  select id into v_stock_id from public.branch_stock where tenant_id=v_tenant and legacy_id=v_stock;
  update public.tenant_workspaces set payload=jsonb_set(jsonb_set(v_payload,'{sales}',(v_payload->'sales')-0,true),'{branchStocks}',(v_payload->'branchStocks')-0,true),updated_at=clock_timestamp() where tenant_id=v_tenant returning updated_at into v_time;
  select (public.normalize_workspace_snapshot(v_tenant,v_time)).id into v_batch;
  perform public.normalize_branch_stock_snapshot(v_tenant,v_time);
  perform public.refresh_workspace_source_ordinals(v_tenant);
  v_run:=public.reconcile_workspace_normalization(v_tenant,v_batch);
  if not v_run.is_match or not (public.validate_workspace_shadow_content(v_tenant)->>'allMatch')::boolean
    or not (public.validate_branch_stock_shadow(v_tenant)->>'allMatch')::boolean then raise exception 'Retiring source records did not reconcile'; end if;
  if not exists(select 1 from public.sales where id=v_sale_id and legacy_id=v_sale and not source_active)
    or not exists(select 1 from public.branch_stock where id=v_stock_id and legacy_id=v_stock and not source_active)
    or exists(select 1 from public.sale_items where sale_id=v_sale_id and legacy_id is not null and source_active) then raise exception 'Historical rows or child IDs were lost or still live'; end if;
  v_checks:=v_checks||jsonb_build_array('Removed source rows and children remain archived with the same IDs and do not inflate totals');
  update public.tenant_workspaces set payload=v_payload,updated_at=clock_timestamp() where tenant_id=v_tenant returning updated_at into v_time;
  select (public.normalize_workspace_snapshot(v_tenant,v_time)).id into v_batch;
  perform public.normalize_branch_stock_snapshot(v_tenant,v_time);
  perform public.refresh_workspace_source_ordinals(v_tenant);
  v_run:=public.reconcile_workspace_normalization(v_tenant,v_batch);
  if not v_run.is_match or not exists(select 1 from public.sales where id=v_sale_id and legacy_id=v_sale and source_active)
    or not exists(select 1 from public.branch_stock where id=v_stock_id and legacy_id=v_stock and source_active) then raise exception 'Restoring source records changed their IDs'; end if;
  select md5(coalesce(jsonb_agg(to_jsonb(p)-'source_active' order by id)::text,'[]')) into v_hash from public.products p where tenant_id=v_tenant and legacy_id is null;
  if v_hash is distinct from v_native_hash then raise exception 'Protected native products changed'; end if;
  v_checks:=v_checks||jsonb_build_array('Repeated backfill is idempotent; restoring a record reuses its IDs; native products stay unchanged');

  select id into v_actor from public.users where tenant_id=v_tenant and is_active and lower(coalesce(role_key,role,'')) in ('admin','owner','tenant_owner','business_owner','company_admin') limit 1;
  select id into v_staff from public.users where tenant_id=v_tenant and is_active and id<>v_actor and lower(role)<>'superadmin' limit 1;
  if v_actor is null or v_staff is null then raise exception 'Missing owner/staff RLS test identities'; end if;
  foreach v_actor in array array[v_actor,v_staff] loop
    perform set_config('request.jwt.claim.sub',v_actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    foreach v_table in array array['products','sales','sale_items','expenses','deliveries','purchases','purchase_items','branch_stock'] loop
      execute format('select count(*) from public.%I where tenant_id<>$1',v_table) into v_leaks using v_tenant;
      if v_leaks<>0 then raise exception 'RLS leaked rows in %',v_table; end if;
    end loop;
    execute 'reset role';
  end loop;
  if has_function_privilege('anon','public.get_current_branch_workspace_page(text,integer,timestamp with time zone,uuid)','execute')
    or has_function_privilege('authenticated','private.refresh_workspace_source_activity(uuid,jsonb)','execute') then raise exception 'Unsafe normalization grants'; end if;
  v_checks:=v_checks||jsonb_build_array('Owner and staff cannot read another tenant from any normalized business table; anonymous/private helper execution is blocked');
  raise exception using errcode='P7777',message='Successful QA rollback';
 exception when sqlstate 'P7777' then perform set_config('qa.source_activity_checks',v_checks::text,true);
 end;
end $qa$;
select current_setting('qa.source_activity_checks')::jsonb as checks;
