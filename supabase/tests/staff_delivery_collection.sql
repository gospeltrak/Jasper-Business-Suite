-- All test deliveries, grants, journals and balances are rolled back.
do $qa$
declare
 v_actor uuid:=nullif(current_setting('qa.staff_user_id',true),'')::uuid;
 v_tenant uuid;v_branch uuid;v_account uuid;v_other_account uuid;v_source text;v_sale text;
 v_prefix text:='qa-delivery-'||gen_random_uuid()::text;v_delivery jsonb;v_result jsonb;v_saved jsonb;
 v_before numeric;v_after numeric;v_other_before numeric;v_hash text;v_after_hash text;
 v_checks jsonb:='[]';v_messages text;v_grant uuid;v_denied boolean;
begin
 if v_actor is null then
   select u.id into strict v_actor from public.users u join public.branch_user_preferences p on p.user_id=u.id
    where u.is_active and lower(coalesce(u.role_key,''))='seller' and p.active_scope='branch'
      and u.role_permissions#>>array['pos','write']='true' order by u.id limit 1;
 end if;
 select u.tenant_id,p.active_branch_id into strict v_tenant,v_branch from public.users u
   join public.branch_user_preferences p on p.user_id=u.id where u.id=v_actor;
 select md5(coalesce(jsonb_agg(to_jsonb(b) order by tenant_id,account_id,currency)::text,'[]')) into v_hash from public.branch_account_balances b;
 begin
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  if private.can_write_branch(v_tenant,v_branch,'money_bank.post') then raise exception 'Test requires a seller without manual treasury posting';end if;
  if not private.can_write_branch(v_tenant,v_branch,'deliveries.write') then raise exception 'Delivery did not inherit the existing POS permission';end if;
  v_checks:=v_checks||jsonb_build_array('Existing POS permission authorizes delivery workflow; generic Money & Bank remains denied');
  select a.id,a.source_key into strict v_account,v_source from public.branch_payment_accounts a
    where a.tenant_id=v_tenant and a.branch_id=v_branch and a.status='active' and not a.is_locked
    order by (a.source_key ilike '%mpesa%') desc,a.id limit 1;
  select current_balance into v_before from public.branch_account_balances where account_id=v_account;
  v_before:=coalesce(v_before,0);
  select a.id into v_other_account from public.branch_payment_accounts a where a.tenant_id=v_tenant and a.branch_id<>v_branch and a.source_key=v_source limit 1;
  select current_balance into v_other_before from public.branch_account_balances where account_id=v_other_account;
  select legacy_id into v_sale from public.sales where tenant_id=v_tenant and source_active and (branch_id=v_branch or branch_id is null) order by source_ordinal limit 1;
  v_delivery:=jsonb_build_object('id',v_prefix,'tenantId',v_tenant,'branchId',v_branch,'saleId',v_sale,'items','[]'::jsonb,
    'customerName','QA rolled back','customerPhone','','totalAmount',125,'deliveryCost',125,'status','Dispatched','timestamp',clock_timestamp());
  execute 'set local role authenticated';
  perform public.save_current_branch_deliveries(jsonb_build_array(v_delivery),'{}'::jsonb);
  v_result:=public.collect_current_branch_delivery_payment(v_prefix,v_source);
  perform public.collect_current_branch_delivery_payment(v_prefix,v_source);
  execute 'reset role';
  select current_balance into v_after from public.branch_account_balances where account_id=v_account;
  if v_after<>v_before+125 then raise exception 'Collection did not credit the account exactly once';end if;
  if (select count(*) from public.treasury_journals where tenant_id=v_tenant and source_type='delivery' and source_id=v_prefix)<>1 then raise exception 'Duplicate collection journal';end if;
  if not exists(select 1 from public.deliveries where tenant_id=v_tenant and legacy_id=v_prefix and source_active and status='Delivered'
    and source_record->>'deliveryPaymentStatus'='collected' and source_record->>'treasuryJournalId'=v_result->>'journalId') then raise exception 'Delivery status and journal did not commit together';end if;
  if v_other_account is not null and (select current_balance from public.branch_account_balances where account_id=v_other_account) is distinct from v_other_before then raise exception 'Another branch account changed';end if;
  v_checks:=v_checks||jsonb_build_array('Staff saves delivery, collects M-Pesa/account payment, and records status and ledger atomically','Retry credits once; another branch sharing the same source key is unchanged');
  -- New fees must use the actual configured branch account.
  execute 'set local role authenticated';
  begin perform public.collect_current_branch_delivery_payment(v_prefix||'-missing',v_source);raise exception 'Missing delivery accepted';exception when no_data_found then null;end;
  begin perform public.post_current_tenant_treasury_split_entry(v_branch,jsonb_build_array(jsonb_build_object('accountId',v_account,'amount',1)),
    'other',v_prefix||'-manual',v_prefix||'-manual','QA denied','{}');raise exception 'Manual treasury posting permitted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  v_checks:=v_checks||jsonb_build_array('Unrelated delivery references and manual treasury posting are denied');
  -- Explicit delivery deny must win over inherited POS permission, including retries.
  insert into public.branch_permission_grants(tenant_id,branch_id,staff_id,permission_key,effect)
   values(v_tenant,v_branch,v_actor,'deliveries.write','deny') returning id into v_grant;
  execute 'set local role authenticated';
  begin perform public.collect_current_branch_delivery_payment(v_prefix,v_source);raise exception 'Explicit delivery deny ignored';exception when insufficient_privilege then null;end;
  execute 'reset role';
  delete from public.branch_permission_grants where id=v_grant;
  v_checks:=v_checks||jsonb_build_array('Explicit branch delivery deny overrides POS inheritance');
  -- Zero-fee delivery can finish without creating fake money.
  v_delivery:=v_delivery||jsonb_build_object('id',v_prefix||'-zero','deliveryCost',0,'status','Dispatched','syncUpdatedAt',clock_timestamp());
  execute 'set local role authenticated';
  perform public.save_current_branch_deliveries(jsonb_build_array(v_delivery),'{}'::jsonb);
  v_result:=public.collect_current_branch_delivery_payment(v_prefix||'-zero',null);
  execute 'reset role';
  if v_result->>'journalId' is not null or v_result->'delivery'->>'status'<>'Delivered' then raise exception 'Zero-fee collection created a journal or failed';end if;
  v_checks:=v_checks||jsonb_build_array('Zero-fee delivery finishes without a treasury journal');
  v_delivery:=v_delivery||jsonb_build_object('id',v_prefix||'-invalid','deliveryCost',-1,'syncUpdatedAt',clock_timestamp());
  execute 'set local role authenticated';
  perform public.save_current_branch_deliveries(jsonb_build_array(v_delivery),'{}'::jsonb);
  begin perform public.collect_current_branch_delivery_payment(v_prefix||'-invalid',v_source);raise exception 'Negative delivery fee accepted';exception when check_violation then null;end;
  execute 'reset role';
  v_checks:=v_checks||jsonb_build_array('Invalid fee is rejected without changing account balance');
  execute 'set local role anon';
  begin perform public.collect_current_branch_delivery_payment(v_prefix,v_source);raise exception 'Anonymous collection accepted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  v_checks:=v_checks||jsonb_build_array('Anonymous callers cannot execute collection');
  raise exception using errcode='P7777',message='Successful staff delivery QA rollback';
 exception when sqlstate 'P7777' then null;
 end;
 select md5(coalesce(jsonb_agg(to_jsonb(b) order by tenant_id,account_id,currency)::text,'[]')) into v_after_hash from public.branch_account_balances b;
 if v_hash is distinct from v_after_hash then raise exception 'QA did not roll treasury balances back';end if;
 perform set_config('qa.staff_delivery_result',jsonb_build_object('actorId',v_actor,'checks',v_checks,'treasuryBalances','unchanged after rollback')::text,true);
end $qa$;
select current_setting('qa.staff_delivery_result')::jsonb as result;

