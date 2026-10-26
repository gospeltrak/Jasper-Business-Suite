-- Integration tests execute real RPCs as authenticated staff. All fixtures and financial writes roll back.
do $qa$
declare
 v_actor uuid:=nullif(current_setting('qa.staff_user_id',true),'')::uuid;
 v_tenant uuid; v_branch uuid; v_account uuid; v_destination uuid; v_source text; v_target text;
 v_other_account uuid; v_other_key text; v_other_branch uuid;
 v_owner uuid; v_role jsonb; v_settings jsonb;
 v_prefix text:='qa-roles-'||gen_random_uuid(); v_expense jsonb; v_purchase jsonb; v_sale jsonb;
 v_saved jsonb; v_result jsonb; v_version text; v_before numeric; v_expected numeric; v_hash text; v_after text;
 v_checks jsonb:='[]'; v_payment uuid:=gen_random_uuid(); v_transfer text:=gen_random_uuid()::text; v_grant uuid;
begin
 if v_actor is null then select id into strict v_actor from public.users where is_active and lower(role_key)='seller' order by id limit 1; end if;
 select u.tenant_id,p.active_branch_id into strict v_tenant,v_branch from public.users u join public.branch_user_preferences p
   on p.user_id=u.id and p.tenant_id=u.tenant_id where u.id=v_actor and p.active_scope='branch';
 select md5(jsonb_build_object('balances',(select jsonb_agg(to_jsonb(b) order by tenant_id,account_id,currency) from public.branch_account_balances b),
   'journals',(select count(*) from public.treasury_journals),'expenses',(select count(*) from public.expenses),
   'purchases',(select count(*) from public.purchases),'sales',(select count(*) from public.sales))::text) into v_hash;
 begin
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  update public.users set role_permissions=role_permissions||jsonb_build_object(
    'cashAndBank',jsonb_build_object('read',false,'write',false,'edit',false),
    'fundTransfers',jsonb_build_object('read',false,'write',false,'edit',false),
    'expenses',jsonb_build_object('read',true,'write',true,'edit',false),
    'purchases',jsonb_build_object('read',true,'write',true,'edit',false),
    'paymentIn',jsonb_build_object('read',true,'write',true,'edit',false),
    'paymentOut',jsonb_build_object('read',true,'write',true,'edit',false)) where id=v_actor;
  if private.can_write_branch(v_tenant,v_branch,'money_bank.post') or private.has_branch_permission(v_tenant,v_branch,'cashandbank.read') then raise exception 'Staff unexpectedly has Money & Bank access'; end if;
  select id,source_key into strict v_account,v_source from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch and status='active' and not is_locked order by (source_key ilike '%mpesa%') desc,id limit 1;
  select id,source_key into strict v_destination,v_target from public.branch_payment_accounts where tenant_id=v_tenant and branch_id=v_branch and status='active' and not is_locked and id<>v_account order by id limit 1;
  select id,source_key,branch_id into v_other_account,v_other_key,v_other_branch from public.branch_payment_accounts where tenant_id=v_tenant and branch_id<>v_branch and status='active' and not is_locked order by id limit 1;
  perform private.post_current_tenant_treasury_entry_authorized(v_branch,v_account,1000,'in','manual',v_prefix,v_prefix,'QA funding rolled back','{}');
  select current_balance into v_before from public.branch_account_balances where account_id=v_account;
  v_expense:=jsonb_build_object('id',v_prefix||'-expense','tenantId',v_tenant,'branchId',v_branch,'category','QA','description','QA rolled back',
    'amount',10,'paidFromAccountId',v_source,'timestamp',clock_timestamp(),'staffName','QA');
  execute 'set local role authenticated';
  v_result:=public.save_current_branch_expense_payment(v_expense,null);
  v_saved:=v_result->'expense';
  perform public.save_current_branch_expense_payment(v_expense,null);
  begin perform public.save_current_branch_expense_payment(v_saved||'{"description":"Unauthorized edit"}'::jsonb,v_saved->>'syncUpdatedAt'); raise exception 'Expense edit without permission accepted'; exception when insufficient_privilege then null; end;
  begin perform public.save_current_branch_expenses(jsonb_build_array(v_saved||'{"description":"Unauthorized bulk edit"}'::jsonb),'{}'::jsonb); raise exception 'Bulk expense edit bypassed role'; exception when insufficient_privilege then null; end;
  begin perform public.post_current_tenant_treasury_entry(v_branch,v_account,1,'out','expense',v_prefix||'-forged',v_prefix||'-forged','Denied','{}'); raise exception 'Generic treasury was allowed'; exception when insufficient_privilege then null; end;
  begin perform private.post_current_tenant_treasury_entry_authorized(v_branch,v_account,1,'out','expense',v_prefix,v_prefix,'Denied','{}'); raise exception 'Private core callable'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  if (select current_balance from public.branch_account_balances where account_id=v_account)<>v_before-10 then raise exception 'Expense debited more than once'; end if;
  v_checks:=v_checks||jsonb_build_array('Expense create posts without Money & Bank access; retry debits once; unauthorized edit and manual/private treasury calls denied');
  update public.users set role_permissions=jsonb_set(role_permissions,'{expenses,edit}','true') where id=v_actor;
  execute 'set local role authenticated';
  v_result:=public.save_current_branch_expense_payment(v_saved||'{"amount":12,"description":"Authorized correction"}'::jsonb,v_saved->>'syncUpdatedAt');
  begin perform public.save_current_branch_expense_payment(v_saved||'{"amount":13}'::jsonb,v_saved->>'syncUpdatedAt'); raise exception 'Stale edit accepted'; exception when serialization_failure then null; end;
  execute 'reset role';
  if (select current_balance from public.branch_account_balances where account_id=v_account)<>v_before-12 then raise exception 'Expense correction balance incorrect'; end if;
  v_checks:=v_checks||jsonb_build_array('Owner-authorized expense edit reverses old journal and posts correction atomically; stale edit rejected');
  -- Failed replacement must roll back the reversal too.
  v_saved:=v_result->'expense';
  execute 'set local role authenticated';
  begin perform public.save_current_branch_expense_payment(v_saved||'{"paidFromAccountId":"qa-missing"}'::jsonb,v_saved->>'syncUpdatedAt'); raise exception 'Missing account accepted'; exception when check_violation then null; end;
  execute 'reset role';
  if (select current_balance from public.branch_account_balances where account_id=v_account)<>v_before-12 then raise exception 'Failed correction changed balance'; end if;
  v_checks:=v_checks||jsonb_build_array('Failed expense correction leaves original payment and balance intact');
  v_purchase:=jsonb_build_object('id',v_prefix||'-purchase','tenantId',v_tenant,'branchId',v_branch,'supplierName','QA','timestamp',clock_timestamp(),
    'items','[]'::jsonb,'destination','shop','totalAmount',10,'amountPaid',6,'amountDue',4,
    'paymentAllocations',jsonb_build_array(jsonb_build_object('fundingType','registered','sourceKey',v_source,'accountId',v_source,'amount',4),jsonb_build_object('fundingType','external','amount',2)));
  execute 'set local role authenticated';
  v_result:=public.save_current_branch_funded_purchase(v_purchase,null,null);
  perform public.save_current_branch_funded_purchase(v_purchase,null,null);
  v_result:=public.add_current_branch_purchase_payment(v_prefix||'-purchase',v_payment,3,'registered',v_source);
  perform public.add_current_branch_purchase_payment(v_prefix||'-purchase',v_payment,3,'registered',v_source);
  begin perform public.add_current_branch_purchase_payment(v_prefix||'-purchase',gen_random_uuid(),2,'registered',v_source); raise exception 'Purchase overpayment accepted'; exception when check_violation then null; end;
  execute 'reset role';
  if (select current_balance from public.branch_account_balances where account_id=v_account)<>v_before-19 then raise exception 'Purchase balance incorrect'; end if;
  if (v_result->'purchase'->>'amountPaid')::numeric<>9 then raise exception 'Purchase paid amount incorrect'; end if;
  begin
    perform private.post_current_tenant_treasury_split_outgoing_entry_authorized(v_branch,jsonb_build_array(jsonb_build_object('accountId',v_account,'amount',5)),
      'purchase',v_prefix||'-purchase','purchase:'||v_prefix||'-purchase:v1','QA conflicting retry','{}');
    raise exception 'Conflicting payment allocations were accepted';
  exception when unique_violation then null; end;
  v_checks:=v_checks||jsonb_build_array('Purchase split registered/external funding and credit installment post once without Money & Bank; overpayment denied');
  execute 'set local role authenticated';
  begin perform public.save_current_branch_funded_purchase(v_purchase||jsonb_build_object('id',v_prefix||'-bad','paymentAllocations','[]'::jsonb),null,null); raise exception 'Unbalanced purchase accepted'; exception when check_violation then null; end;
  v_result:=public.save_current_branch_funded_purchase(v_purchase||jsonb_build_object('id',v_prefix||'-credit','amountPaid',0,'amountDue',10,'paymentAllocations','[]'::jsonb),null,null);
  execute 'reset role';
  if nullif(v_result->'purchase'->>'treasuryJournalId','') is not null then raise exception 'Credit purchase got a fake journal'; end if;
  v_checks:=v_checks||jsonb_build_array('Credit purchase retains debt with no treasury deduction; invalid funding rejected');
  v_sale:=jsonb_build_object('id',v_prefix||'-sale','tenantId',v_tenant,'branchId',v_branch,'total',10,'amountPaid',0,'paymentMethod','Credit',
    'items','[]'::jsonb,'reference',v_prefix,'timestamp',clock_timestamp(),'syncUpdatedAt',clock_timestamp(),'syncStatus','synced','cashierName','QA');
  perform private.persist_payment_operation(v_tenant,'sales',v_sale);
  v_payment:=gen_random_uuid();
  execute 'set local role authenticated';
  v_result:=public.add_current_branch_sale_payment(v_prefix||'-sale',v_payment,5,v_source,null);
  perform public.add_current_branch_sale_payment(v_prefix||'-sale',v_payment,5,v_source,null);
  begin perform public.add_current_branch_sale_payment(v_prefix||'-sale',gen_random_uuid(),6,v_source,null); raise exception 'Sale overpayment accepted'; exception when check_violation then null; end;
  execute 'reset role';
  if (select current_balance from public.branch_account_balances where account_id=v_account)<>v_before-14 then raise exception 'Sale payment did not credit exactly once'; end if;
  if (v_result->'sale'->>'amountPaid')::numeric<>5 or jsonb_array_length(v_result->'sale'->'payments')<>1 then raise exception 'Sale installment/history incorrect'; end if;
  execute 'set local role authenticated';
  perform public.save_current_branch_sales(jsonb_build_array(v_sale||jsonb_build_object('syncUpdatedAt',clock_timestamp())),'{}'::jsonb,null,null);
  execute 'reset role';
  select source_record into v_saved from public.sales where tenant_id=v_tenant and legacy_id=v_prefix||'-sale' and source_active;
  if (v_saved->>'amountPaid')::numeric<>5 or jsonb_array_length(v_saved->'payments')<>1 then raise exception 'Stale sale edit lost committed installment'; end if;
  v_checks:=v_checks||jsonb_build_array('Sales Add Payment credits treasury and persists one history entry atomically; retry and overpayment protected');
  execute 'set local role authenticated';
  begin perform public.transfer_current_tenant_treasury_funds(v_account,v_destination,1,v_transfer,'Denied','{}'); raise exception 'Transfer without grant accepted'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  update public.users set role_permissions=jsonb_set(role_permissions,'{fundTransfers,write}','true') where id=v_actor;
  if v_other_account is not null then
    insert into public.branch_permission_grants(tenant_id,branch_id,staff_id,permission_key,effect)
      values(v_tenant,v_other_branch,v_actor,'money_bank.transfer','deny');
  end if;
  execute 'set local role authenticated';
  v_result:=public.transfer_current_tenant_treasury_funds(v_account,v_destination,1,v_transfer,'Allowed','{}');
  if v_result ? 'sourceBalance' or v_result ? 'destinationBalance' then raise exception 'Transfer exposed restricted balances'; end if;
  perform public.transfer_current_tenant_treasury_funds(v_account,v_destination,1,v_transfer,'Allowed','{}');
  if v_other_account is not null then
    begin perform public.transfer_current_tenant_treasury_funds(v_account,v_other_account,1,v_prefix||'-cross','Denied','{}'); raise exception 'Unassigned branch transfer accepted'; exception when insufficient_privilege then null; end;
  end if;
  execute 'reset role';
  update public.users set role_permissions=jsonb_set(role_permissions,'{fundTransfers,write}','false') where id=v_actor;
  execute 'set local role authenticated';
  begin perform public.transfer_current_tenant_treasury_funds(v_account,v_destination,1,v_transfer,'Revoked','{}'); raise exception 'Revoked transfer replay accepted'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  v_checks:=v_checks||jsonb_build_array('Transfers require owner authorization; repeats post once; denied destination branch and revoked replay rejected');
  insert into public.branch_permission_grants(tenant_id,branch_id,staff_id,permission_key,effect) values(v_tenant,v_branch,v_actor,'expenses.write','deny') returning id into v_grant;
  execute 'set local role authenticated';
  begin perform public.save_current_branch_expense_payment(v_expense||jsonb_build_object('id',v_prefix||'-denied'),null); raise exception 'Explicit branch deny ignored'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  v_checks:=v_checks||jsonb_build_array('Explicit branch denies are enforced');
  -- Owner role changes must reach staff profiles; earlier auto-grants must not defeat a saved false.
  update public.users set role_permissions=jsonb_set(role_permissions,'{purchases,write}','false') where id=v_actor;
  if private.can_write_branch(v_tenant,v_branch,'purchases.write') then raise exception 'Saved role revocation ignored'; end if;
  select id into strict v_owner from public.users where tenant_id=v_tenant and is_active and lower(coalesce(role_key,role)) in ('admin','owner') order by id limit 1;
  select role_permissions into v_role from public.users where id=v_actor;
  -- Existing staff can still carry a copy of an earlier preset.
  v_role:=jsonb_set(v_role,'{paymentOut,write}','false'::jsonb);
  update public.users set role_key=v_prefix where id=v_actor;
  select payload->'settings' into v_settings from public.tenant_workspaces where tenant_id=v_tenant;
  v_settings:=coalesce(v_settings,'{}'::jsonb)||jsonb_build_object('customRoles',coalesce(v_settings->'customRoles','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',v_prefix,'name',v_prefix,'permissions',v_role)));
  perform set_config('app.jasper_explicit_settings_tenant',v_tenant::text,true);
  perform private.persist_normalized_business_snapshot(v_tenant,jsonb_build_object('settings',v_settings));
  v_settings:=jsonb_set(v_settings,array['customRoles',((jsonb_array_length(v_settings->'customRoles')-1)::text),'permissions','fundTransfers','write'],'true'::jsonb);
  update public.users set active_tenant=v_tenant where id=v_owner;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.save_current_tenant_settings(jsonb_build_object('customRoles',v_settings->'customRoles','settingsSync',jsonb_build_object('customRoles',clock_timestamp())));
  execute 'reset role';
  if not (select role_permissions#>>'{fundTransfers,write}'='true' from public.users where id=v_actor) then
    raise exception 'Owner role change did not reach assigned staff: %',jsonb_build_object(
      'profileUnchanged',(select role_permissions=v_role from public.users where id=v_actor),
      'savedRole',(select item->'permissions'->'fundTransfers' from public.tenant_workspaces w,jsonb_array_elements(w.payload->'settings'->'customRoles') item where w.tenant_id=v_tenant and item->>'id'=v_prefix),
      'profileRoleMatches',(select role_key=v_prefix from public.users where id=v_actor));
  end if;
  v_checks:=v_checks||jsonb_build_array('Owner role preset changes update assigned staff; saved permission revocation remains authoritative');
  raise exception using errcode='P7777',message='Successful QA rollback';
 exception when sqlstate 'P7777' then null;
 end;
 select md5(jsonb_build_object('balances',(select jsonb_agg(to_jsonb(b) order by tenant_id,account_id,currency) from public.branch_account_balances b),
   'journals',(select count(*) from public.treasury_journals),'expenses',(select count(*) from public.expenses),
   'purchases',(select count(*) from public.purchases),'sales',(select count(*) from public.sales))::text) into v_after;
 if v_after is distinct from v_hash then raise exception 'QA rollback changed production data'; end if;
 perform set_config('qa.result',jsonb_build_object('checks',v_checks,'productionUnchanged',true)::text,true);
end $qa$;
select current_setting('qa.result')::jsonb;
