-- Every business mutation below is rolled back, including treasury entries and cutover flags.
do $qa$
declare
 v_tenant uuid;v_actor uuid;v_branch uuid;v_currency text;v_original jsonb;v_initial jsonb;v_snapshot jsonb;
 v_prefix text:='qa-direct-'||gen_random_uuid()::text;v_product jsonb;v_stock jsonb;v_purchase jsonb;v_sale jsonb;
 v_a uuid:=gen_random_uuid();v_b uuid:=gen_random_uuid();v_payment uuid:=gen_random_uuid();v_payment_b uuid:=gen_random_uuid();v_external uuid:=gen_random_uuid();
 v_result jsonb;v_journal uuid;v_balance numeric;v_rec_id uuid;v_count bigint;v_checks jsonb:='[]'::jsonb;
begin
 begin
  select w.tenant_id,w.payload,u.id,b.id,t.currency_code into v_tenant,v_original,v_actor,v_branch,v_currency
  from public.tenant_workspaces w join public.users u on u.tenant_id=w.tenant_id join public.branches b on b.tenant_id=w.tenant_id join public.tenants t on t.id=w.tenant_id
  where u.is_active and lower(coalesce(u.role_key,u.role,'')) in ('admin','owner','tenant_owner','business_owner','company_admin')
    and b.is_default and b.status='active' and not b.is_locked
  order by jsonb_array_length(w.payload->'products') desc limit 1;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  insert into public.branch_user_preferences(tenant_id,user_id,active_scope,active_branch_id) values(v_tenant,v_actor,'branch',v_branch)
  on conflict(tenant_id,user_id) do update set active_scope='branch',active_branch_id=excluded.active_branch_id;
  perform private.enable_normalized_business_writes(v_tenant);
  v_initial:=public.get_current_branch_workspace()->'payload';
  if not exists(select 1 from private.normalized_write_cutover_archives where tenant_id=v_tenant and payload=v_original) then raise exception 'Cutover backup differs';end if;

  v_product:=jsonb_build_object('id',v_prefix||'-product','tenantId',v_tenant,'branchId',v_branch,'name','QA Direct Product','costPrice',100,'sellingPrice',200,
    'stockQty',10,'shopStockQty',10,'storeStockQty',0,'alertQty',1,'syncUpdatedAt',clock_timestamp());
  v_stock:=jsonb_build_object('id',v_prefix||'-stock','tenantId',v_tenant,'branchId',v_branch,'productId',v_prefix||'-product','quantity',10,
    'shopStockQty',10,'storeStockQty',0,'buyingPrice',100,'sellingPrice',200,'updatedAt',clock_timestamp());
  perform public.save_current_branch_products(jsonb_build_array(v_product),'{}',jsonb_build_array(v_stock));
  select id into v_rec_id from public.products where tenant_id=v_tenant and legacy_id=v_prefix||'-product' and stock_qty=10 and selling_price=200;
  if v_rec_id is null then raise exception 'Typed product was not created';end if;
  v_checks:=v_checks||jsonb_build_array('Product and branch stock save immediately into typed rows with stable legacy IDs');

  v_product:=v_product||jsonb_build_object('stockQty',15,'shopStockQty',15,'syncUpdatedAt',clock_timestamp());
  v_stock:=v_stock||jsonb_build_object('quantity',15,'shopStockQty',15,'updatedAt',clock_timestamp());
  v_purchase:=jsonb_build_object('id',v_prefix||'-purchase','tenantId',v_tenant,'branchId',v_branch,'supplierId','qa-supplier','supplierName','QA supplier',
    'items',jsonb_build_array(jsonb_build_object('productId',v_prefix||'-product','productName','QA Direct Product','qty',5,'costPrice',100)),
    'totalAmount',500,'amountPaid',0,'amountDue',500,'paymentMethod','Credit','destination','shop','deliveryStatus','Pending','timestamp',clock_timestamp());
  perform public.save_current_branch_purchases(jsonb_build_array(v_purchase),'{}',jsonb_build_array(v_product),jsonb_build_array(v_stock));
  if not exists(select 1 from public.purchases where tenant_id=v_tenant and legacy_id=v_prefix||'-purchase' and amount_due=500)
    or not exists(select 1 from public.purchase_items where tenant_id=v_tenant and product_id=v_rec_id and qty=5)
    or not exists(select 1 from public.branch_stock where tenant_id=v_tenant and legacy_id=v_prefix||'-stock' and quantity=15) then raise exception 'Atomic normalized purchase/stock failed';end if;
  v_checks:=v_checks||jsonb_build_array('Credit purchase, item foreign keys and received stock commit together');

  insert into public.branch_payment_accounts(id,tenant_id,branch_id,account_name,account_type,currency,source_key)
  values(v_a,v_tenant,v_branch,'QA Direct Cash','cash',v_currency,v_prefix||'-cash'),(v_b,v_tenant,v_branch,'QA Direct Bank','bank',v_currency,v_prefix||'-bank');
  insert into public.branch_account_balances(tenant_id,branch_id,account_id,currency,current_balance)
  values(v_tenant,v_branch,v_a,v_currency,100000),(v_tenant,v_branch,v_b,v_currency,100000);
  v_result:=public.add_current_branch_purchase_payment(v_prefix||'-purchase',v_payment,200,'registered',v_prefix||'-cash');
  v_journal:=(v_result->'purchase'->'payments'->0->>'treasuryJournalId')::uuid;
  perform public.add_current_branch_purchase_payment(v_prefix||'-purchase',v_payment,200,'registered',v_prefix||'-cash');
  perform public.add_current_branch_purchase_payment(v_prefix||'-purchase',v_payment_b,100,'registered',v_prefix||'-bank');
  perform public.add_current_branch_purchase_payment(v_prefix||'-purchase',v_external,50,'external',null);
  if not exists(select 1 from public.purchases where tenant_id=v_tenant and legacy_id=v_prefix||'-purchase' and amount_paid=350 and amount_due=150
    and jsonb_array_length(source_record->'payments')=3) then raise exception 'Typed payment totals differ';end if;
  select current_balance into v_balance from public.branch_account_balances where account_id=v_a;
  if v_balance<>99800 then raise exception 'Retry debited twice';end if;
  perform public.reverse_current_tenant_treasury_journal(v_journal,v_prefix||'-reverse','QA direct payment reversal');
  if not exists(select 1 from public.purchases where tenant_id=v_tenant and legacy_id=v_prefix||'-purchase' and amount_paid=150 and amount_due=350
    and source_record->'payments'->0 ? 'reversedAt') then raise exception 'Reversal did not restore typed supplier due';end if;
  v_checks:=v_checks||jsonb_build_array('Multiple treasury accounts, external funding, retry and reversal update normalized purchase totals and audit history exactly');

  perform public.save_current_branch_purchases(jsonb_build_array(v_purchase),'{}',null,null);
  if not exists(select 1 from public.purchases where tenant_id=v_tenant and legacy_id=v_prefix||'-purchase' and amount_paid=150) then raise exception 'Old snapshot reverted payment';end if;
  begin
    perform public.save_current_branch_purchases('[]',jsonb_build_object(v_prefix||'-purchase',clock_timestamp()),null,null);
    raise exception 'Installment audit history deleted';
  exception when check_violation then null;end;
  v_checks:=v_checks||jsonb_build_array('Stale purchase snapshots cannot undo payments and installment history cannot be deleted');

  v_sale:=jsonb_build_object('id',v_prefix||'-sale','tenantId',v_tenant,'branchId',v_branch,'reference','QA Direct Sale','total',200,'tax',0,'amountPaid',0,'amountDue',200,
    'paymentMethod','Credit','channel','retail','timestamp',clock_timestamp(),
    'items',jsonb_build_array(jsonb_build_object('productId',v_prefix||'-product','productName','QA Direct Product','qty',1,'price',200)));
  perform public.append_offline_sale_to_branch(v_sale);
  perform public.append_offline_sale_to_branch(v_sale);
  if not exists(select 1 from public.sales where tenant_id=v_tenant and legacy_id=v_prefix||'-sale' and total=200)
    or not exists(select 1 from public.sale_items where tenant_id=v_tenant and product_id=v_rec_id and qty=1)
    or not exists(select 1 from public.products where id=v_rec_id and stock_qty=14)
    or not exists(select 1 from public.branch_stock where tenant_id=v_tenant and legacy_id=v_prefix||'-stock' and quantity=14) then raise exception 'Offline sale duplicated or branch stock did not follow product delta';end if;
  v_checks:=v_checks||jsonb_build_array('Offline sale sync writes normalized invoice/items and deducts branch stock once');

  v_result:=public.post_current_tenant_treasury_split_outgoing_entry(v_branch,jsonb_build_array(jsonb_build_object('accountId',v_a,'amount',75)),
    'expense',v_prefix||'-expense',v_prefix||'-expense-payment','QA expense','{}');
  perform public.save_current_branch_expenses(jsonb_build_array(jsonb_build_object('id',v_prefix||'-expense','tenantId',v_tenant,'branchId',v_branch,
    'category','QA','description','QA direct expense','amount',75,'timestamp',clock_timestamp(),'treasuryJournalId',v_result->>'journalId')),'{}');
  perform public.save_current_branch_expenses('[]',jsonb_build_object(v_prefix||'-expense',clock_timestamp()));
  if not exists(select 1 from public.expenses where tenant_id=v_tenant and legacy_id=v_prefix||'-expense' and not source_active)
    or not exists(select 1 from public.branch_account_balances where account_id=v_a and current_balance=100000) then raise exception 'Expense deletion/reversal did not commit atomically';end if;
  v_checks:=v_checks||jsonb_build_array('Expense deletion archives its row and reverses its treasury journal in one transaction');

  perform public.route_current_branch_business_data('pending_delivery_notes_map',jsonb_build_object(v_tenant::text,jsonb_build_array(jsonb_build_object('id',v_prefix||'-note','tenantId',v_tenant,'branchId',v_branch,'status','Draft'))),true);
  if not exists(select 1 from public.pending_delivery_notes where tenant_id=v_tenant and legacy_id=v_prefix||'-note' and source_active) then raise exception 'Pending note did not save';end if;
  perform public.route_current_branch_business_data('pending_delivery_notes_map',jsonb_build_object(v_tenant::text,'[]'::jsonb),true);
  if not exists(select 1 from public.pending_delivery_notes where tenant_id=v_tenant and legacy_id=v_prefix||'-note' and not source_active) then raise exception 'Pending note did not archive';end if;
  v_checks:=v_checks||jsonb_build_array('Legacy document sync routes into normalized rows, including explicit deletion');

  v_snapshot:=public.get_current_branch_workspace()->'payload';
  perform public.save_current_branch_workspace(v_snapshot);
  if exists(select 1 from public.tenant_workspaces where tenant_id=v_tenant and payload ?| array['products','sales','purchases','expenses','deliveries','branchStocks','pendingDeliveryNotes'])
    or exists(select 1 from public.workspace_normalization_outbox where tenant_id=v_tenant and status<>'completed')
    or not private.workspace_normalized_reads_ready(v_tenant) then raise exception 'A save still depends on a business blob or queue';end if;
  begin
    update public.tenant_workspaces set payload=v_original where tenant_id=v_tenant;
    raise exception 'Legacy blob overwrite accepted';
  exception when object_not_in_prerequisite_state then null;end;
  v_checks:=v_checks||jsonb_build_array('All saves reload immediately with no business blob and no normalization queue; stale clients cannot overwrite the normalized source');
  if not (public.reconcile_workspace_normalization(v_tenant,null)).is_match
    or not (public.validate_workspace_shadow_content(v_tenant)->>'allMatch')::boolean
    or not (public.validate_branch_stock_shadow(v_tenant)->>'allMatch')::boolean then
    raise exception 'Normalized integrity audit failed after writes';
  end if;
  perform private.rollback_workspace_normalized_read(v_tenant,'QA direct rollback');
  if private.normalized_writes_enabled(v_tenant) or not exists(select 1 from jsonb_array_elements(public.get_current_branch_workspace()->'payload'->'sales') as sale where sale->>'id'=v_prefix||'-sale') then raise exception 'Rollback lost post-cutover records';end if;
  v_checks:=v_checks||jsonb_build_array('Rollback reconstructs the latest data, including records created after cutover');
  raise exception using errcode='P7777',message='Successful direct-write QA rollback';
 exception when sqlstate 'P7777' then perform set_config('qa.direct_writes',v_checks::text,true);
 end;
end $qa$;
select current_setting('qa.direct_writes')::jsonb as checks;

