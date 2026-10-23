do $qa$
declare
  v_tenant uuid; v_actor uuid; v_branch uuid; v_currency text;
  v_a uuid:=gen_random_uuid(); v_b uuid:=gen_random_uuid(); v_low uuid:=gen_random_uuid();
  v_id uuid:=gen_random_uuid(); v_id_b uuid:=gen_random_uuid(); v_id_external uuid:=gen_random_uuid();
  v_prefix text:='qa-installment-'||gen_random_uuid()::text;
  v_original jsonb; v_stale jsonb; v_fixture jsonb; v_result jsonb; v_posted jsonb; v_reversal jsonb;
  v_balance numeric; v_journal uuid; v_checks jsonb:='[]'::jsonb;
begin
 begin
  select u.tenant_id,u.id,b.id,t.currency_code into v_tenant,v_actor,v_branch,v_currency
  from public.users u join public.branches b on b.tenant_id=u.tenant_id join public.tenants t on t.id=u.tenant_id
  where u.is_active and lower(coalesce(u.role_key,u.role,'')) in ('admin','owner','tenant_owner','business_owner','company_admin')
    and b.is_default and b.status='active' and not b.is_locked and b.archived_at is null
  order by b.created_at limit 1;
  if v_actor is null then raise exception 'No test context'; end if;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  insert into public.branch_user_preferences(tenant_id,user_id,active_scope,active_branch_id)
  values(v_tenant,v_actor,'branch',v_branch) on conflict(tenant_id,user_id)
  do update set active_scope='branch',active_branch_id=excluded.active_branch_id;
  select payload into v_original from public.tenant_workspaces where tenant_id=v_tenant;
  insert into public.branch_payment_accounts(id,tenant_id,branch_id,account_name,account_type,currency,source_key)
  values(v_a,v_tenant,v_branch,'QA cash','cash',v_currency,v_prefix||'-a'),
    (v_b,v_tenant,v_branch,'QA bank','bank',v_currency,v_prefix||'-b'),
    (v_low,v_tenant,v_branch,'QA low','cash',v_currency,v_prefix||'-low');
  insert into public.branch_account_balances(tenant_id,branch_id,account_id,currency,current_balance)
  values(v_tenant,v_branch,v_a,v_currency,100000),(v_tenant,v_branch,v_b,v_currency,100000),(v_tenant,v_branch,v_low,v_currency,5000);
  v_fixture:=jsonb_build_object('id',v_prefix,'tenantId',v_tenant,'branchId',v_branch,'supplierId','qa-supplier','supplierName','QA supplier',
    'items','[]'::jsonb,'totalAmount',100000,'amountPaid',20000,'amountDue',80000,'paidFromAccountId',v_prefix||'-a',
    'paymentMethod','Cash','timestamp',now()-interval '20 days','destination','shop','deliveryStatus','Pending');
  v_stale:=jsonb_set(v_original,'{purchases}',coalesce(v_original->'purchases','[]'::jsonb)||jsonb_build_array(v_fixture),true);
  update public.tenant_workspaces set payload=v_stale where tenant_id=v_tenant;

  v_result:=public.add_current_branch_purchase_payment(v_prefix,v_id,30000,'registered',v_prefix||'-a');
  v_posted:=v_result->'purchase'; v_journal:=(v_posted->'payments'->0->>'treasuryJournalId')::uuid;
  select current_balance into v_balance from public.branch_account_balances where account_id=v_a;
  if v_balance<>70000 or (v_posted->>'amountPaid')::numeric<>50000 or (v_posted->>'amountDue')::numeric<>50000 then raise exception 'Debit or liability mismatch'; end if;
  if not exists(select 1 from public.treasury_journals j join public.treasury_journal_lines l on l.journal_id=j.id
    where j.id=v_journal and j.metadata->>'purchaseId'=v_prefix and j.source_type='supplier_payment' and l.account_id=v_a and l.signed_amount=-30000
      and j.metadata->>'purchasePaymentId'=v_id::text) then raise exception 'Missing linked journal'; end if;
  if jsonb_array_length(v_posted->'paymentAllocations')<>2 or (v_posted->'paymentAllocations'->0->>'amount')::numeric<>20000 then raise exception 'Legacy initial funding lost'; end if;
  v_checks:=v_checks||jsonb_build_array('Treasury debit, supplier due, journal and legacy initial funding agree');

  perform public.add_current_branch_purchase_payment(v_prefix,v_id,30000,'registered',v_prefix||'-a');
  select current_balance into v_balance from public.branch_account_balances where account_id=v_a;
  if v_balance<>70000 then raise exception 'Retry debited twice'; end if;
  begin
    perform public.add_current_branch_purchase_payment(v_prefix,v_id,31000,'registered',v_prefix||'-a');
    raise exception 'Changed retry accepted';
  exception when unique_violation then null; end;
  v_checks:=v_checks||jsonb_build_array('Same payment retry debits once; changed retry is rejected');

  v_result:=public.add_current_branch_purchase_payment(v_prefix,v_id_b,20000,'registered',v_prefix||'-b');
  v_result:=public.add_current_branch_purchase_payment(v_prefix,v_id_external,10000,'external',null);
  if (v_result->'purchase'->>'amountDue')::numeric<>20000 then raise exception 'Mixed funding due mismatch'; end if;
  if exists(select 1 from public.branch_account_balances where account_id=v_a and current_balance<>70000)
    or exists(select 1 from public.branch_account_balances where account_id=v_b and current_balance<>80000) then raise exception 'External payment debited treasury'; end if;
  if jsonb_array_length(v_result->'purchase'->'payments')<>3 or exists(select 1 from public.treasury_journals where idempotency_key='purchase-installment:'||v_id_external::text) then raise exception 'Incorrect external journal'; end if;
  v_checks:=v_checks||jsonb_build_array('Different treasury accounts and external installments settle the same invoice correctly');

  begin
    perform public.add_current_branch_purchase_payment(v_prefix,gen_random_uuid(),25000,'registered',v_prefix||'-a');
    raise exception 'Overpayment accepted';
  exception when check_violation then null; end;
  begin
    perform public.add_current_branch_purchase_payment(v_prefix,gen_random_uuid(),10000,'registered',v_prefix||'-low');
    raise exception 'Insufficient funds accepted';
  exception when check_violation then null; end;
  select current_balance into v_balance from public.branch_account_balances where account_id=v_low;
  if v_balance<>5000 then raise exception 'Failed payment changed balance'; end if;
  if exists(select 1 from public.treasury_journal_lines where account_id=v_low) then raise exception 'Failed payment left journal'; end if;
  v_checks:=v_checks||jsonb_build_array('Overpayment and insufficient funds leave no partial debit or payment');

  update public.branch_payment_accounts set is_locked=true,lock_reason='QA' where id=v_a;
  begin
    perform public.add_current_branch_purchase_payment(v_prefix,gen_random_uuid(),1000,'registered',v_prefix||'-a');
    raise exception 'Locked account accepted';
  exception when check_violation then null; end;
  update public.branch_payment_accounts set is_locked=false,lock_reason=null where id=v_a;
  begin
    perform public.add_current_branch_purchase_payment(v_prefix,gen_random_uuid(),1000,'registered','another-tenant-account');
    raise exception 'Foreign account accepted';
  exception when check_violation then null; end;
  begin
    perform public.add_current_branch_purchase_payment(v_prefix,gen_random_uuid(),'NaN'::numeric,'external',null);
    raise exception 'NaN accepted';
  exception when invalid_parameter_value then null; end;
  v_checks:=v_checks||jsonb_build_array('Locked/foreign accounts and invalid amounts rejected');

  perform public.save_current_branch_purchases(p_purchases=>v_stale->'purchases',p_purchase_tombstones=>'{}',p_products=>null,p_branch_stocks=>null);
  perform public.save_current_branch_workspace(v_stale);
  select item into v_posted from public.tenant_workspaces w,jsonb_array_elements(w.payload->'purchases') as item where w.tenant_id=v_tenant and item->>'id'=v_prefix;
  if (v_posted->>'amountPaid')::numeric<>80000 or jsonb_array_length(v_posted->'payments')<>3 then raise exception 'Stale save undid installment'; end if;
  if exists(select 1 from jsonb_array_elements(v_original->'purchases') as old(item) where not exists(
    select 1 from public.tenant_workspaces w,jsonb_array_elements(w.payload->'purchases') as saved(item) where w.tenant_id=v_tenant and saved.item=old.item)) then raise exception 'Old purchase lost'; end if;
  v_checks:=v_checks||jsonb_build_array('Old purchase records unchanged; stale narrow and full autosaves cannot undo installments');

  v_reversal:=public.reverse_current_tenant_treasury_journal(v_journal,v_prefix||'-reverse','QA reversal');
  perform public.reverse_current_tenant_treasury_journal(v_journal,v_prefix||'-reverse','QA reversal retry');
  select current_balance into v_balance from public.branch_account_balances where account_id=v_a;
  select item into v_posted from public.tenant_workspaces w,jsonb_array_elements(w.payload->'purchases') as item where w.tenant_id=v_tenant and item->>'id'=v_prefix;
  if v_balance<>100000 or (v_posted->>'amountPaid')::numeric<>50000 or (v_posted->>'amountDue')::numeric<>50000
    or not (v_posted->'payments'->0 ? 'reversedAt') or jsonb_array_length(v_posted->'paymentAllocations')<>3 then raise exception 'Reversal state inconsistent'; end if;
  perform public.save_current_branch_purchases(p_purchases=>v_result->'purchase'||'[]'::jsonb,p_purchase_tombstones=>'{}',p_products=>null,p_branch_stocks=>null);
  v_checks:=v_checks||jsonb_build_array('Reversal restores treasury and supplier debt once while retaining payment audit history');

  if has_function_privilege('anon','public.add_current_branch_purchase_payment(text,uuid,numeric,text,text)','execute')
    or has_function_privilege('authenticated','private.preserve_purchase_payment_state(jsonb,jsonb)','execute') then raise exception 'Unsafe grants'; end if;
  v_checks:=v_checks||jsonb_build_array('Anonymous RPC and direct private helper execution denied');
  begin
    perform public.save_current_branch_purchases(p_purchases=>'[]'::jsonb,p_purchase_tombstones=>jsonb_build_object(v_prefix,now()),p_products=>null,p_branch_stocks=>null);
    raise exception 'Installment purchase deleted with tombstone';
  exception when check_violation then null; end;
  begin
    perform public.save_current_branch_workspace(jsonb_set(v_stale,'{purchaseTombstones}',jsonb_build_object(v_prefix,now()),true));
    raise exception 'Full save tombstone hid installment purchase';
  exception when check_violation then null; end;
  v_checks:=v_checks||jsonb_build_array('Installment audit history cannot be deleted or hidden by stale purchase tombstones');
  update public.tenant_workspaces set payload=jsonb_set(payload,'{purchases}',(payload->'purchases')||jsonb_build_array(v_fixture||jsonb_build_object('id',v_prefix||'-foreign','branchId',gen_random_uuid())),true) where tenant_id=v_tenant;
  begin
    perform public.add_current_branch_purchase_payment(v_prefix||'-foreign',gen_random_uuid(),1000,'external',null);
    raise exception 'Cross-branch purchase was payable';
  exception when insufficient_privilege then null; end;
  v_checks:=v_checks||jsonb_build_array('A purchase assigned to another branch cannot be paid');

  raise exception using errcode='P7777',message='QA successful rollback';
 exception when sqlstate 'P7777' then perform set_config('qa.installment_checks',v_checks::text,true);
 end;
end;
$qa$;
select jsonb_build_object('checks',current_setting('qa.installment_checks')::jsonb,
 'test_accounts_remaining',(select count(*) from public.branch_payment_accounts where source_key like 'qa-installment-%'),
 'test_purchases_remaining',(select count(*) from public.tenant_workspaces w,jsonb_array_elements(w.payload->'purchases') as item where item->>'id' like 'qa-installment-%')) as result;

