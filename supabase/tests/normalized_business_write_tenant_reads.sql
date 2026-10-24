-- Verify real owner/staff RPC responses, bounded pagination and rollback; persist nothing.
do $qa$
declare v_user record; v_tenant uuid; v_collection text; v_legacy jsonb; v_normalized jsonb; v_page jsonb;
 v_records jsonb; v_expected jsonb; v_actual jsonb; v_cursor_time timestamptz; v_cursor_id uuid;
 v_pages integer; v_checks integer:=0; v_users integer:=0;v_hash text;v_after_hash text;
begin
 begin
  select md5(coalesce(jsonb_agg(to_jsonb(b) order by tenant_id,account_id,currency)::text,'[]')) into v_hash from public.branch_account_balances b;
  for v_tenant in select tenant_id from public.workspace_migration_state loop perform private.enable_normalized_business_writes(v_tenant);end loop;
  for v_user in select u.id,u.tenant_id from public.users u join public.workspace_migration_state m on m.tenant_id=u.tenant_id
    where u.is_active and m.read_mode='normalized' and lower(u.role)<>'superadmin' order by u.tenant_id,u.id loop
    perform set_config('request.jwt.claim.sub',v_user.id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user.id,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    v_legacy:=public.get_current_branch_workspace();
    v_normalized:=public.get_current_branch_workspace_v2();
    if v_normalized->>'readSource'<>'normalized' or v_normalized->'payload' is distinct from v_legacy->'payload' then
      raise exception 'Normalized branch bootstrap differed for user %',v_user.id;
    end if;
    foreach v_collection in array array['sales','expenses','deliveries','purchases'] loop
      v_records:='[]';v_cursor_time:=null;v_cursor_id:=null;v_pages:=0;
      loop
        v_page:=public.get_current_branch_workspace_page(v_collection,7,v_cursor_time,v_cursor_id);
        if (v_page->>'fallbackRequired')::boolean or v_page->>'readSource'<>'normalized' then raise exception 'Page unexpectedly used legacy fallback'; end if;
        v_records:=v_records||coalesce(v_page->'records','[]'::jsonb);
        v_pages:=v_pages+1;
        if v_pages>1000 then raise exception 'Cursor pagination did not terminate'; end if;
        exit when not (v_page->>'hasMore')::boolean;
        v_cursor_time:=(v_page->'nextCursor'->>'timestamp')::timestamptz;
        v_cursor_id:=(v_page->'nextCursor'->>'id')::uuid;
      end loop;
      select coalesce(jsonb_agg(item order by item::text),'[]'::jsonb) into v_expected from jsonb_array_elements(coalesce(v_legacy->'payload'->v_collection,'[]'::jsonb)) as item;
      select coalesce(jsonb_agg(item order by item::text),'[]'::jsonb) into v_actual from jsonb_array_elements(v_records) as item;
      if v_expected is distinct from v_actual then raise exception 'Paged % records differed for user %',v_collection,v_user.id; end if;
      v_checks:=v_checks+1;
    end loop;
    execute 'reset role';
    v_users:=v_users+1;
  end loop;
  if v_users<9 then raise exception 'Not all tenant identities were tested'; end if;
  if exists(select 1 from public.tenant_workspaces where payload ?| array['products','sales','purchases','expenses','deliveries','branchStocks','pendingDeliveryNotes']) then raise exception 'A tenant still reads a business workspace blob';end if;
  select md5(coalesce(jsonb_agg(to_jsonb(b) order by tenant_id,account_id,currency)::text,'[]')) into v_after_hash from public.branch_account_balances b;
  if v_hash is distinct from v_after_hash then raise exception 'Cutover changed treasury balances';end if;
  raise exception using errcode='P7777',message='Successful cutover QA rollback';
 exception when sqlstate 'P7777' then perform set_config('qa.normalized_cutover',jsonb_build_object('testedUsers',v_users,'pagedLedgerChecks',v_checks,'directWriteTenants',9,'treasuryBalances','unchanged')::text,true);
 end;
end $qa$;
select current_setting('qa.normalized_cutover')::jsonb as result;


