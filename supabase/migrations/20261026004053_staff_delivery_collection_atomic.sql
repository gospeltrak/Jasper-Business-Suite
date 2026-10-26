CREATE OR REPLACE FUNCTION private.has_branch_permission(p_tenant_id uuid, p_branch_id uuid, p_permission_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_key text := lower(nullif(btrim(p_permission_key), ''));
  v_module text;
  v_action text;
  v_profile_value text;
begin
  if v_key is null or not private.is_active_tenant_member(p_tenant_id) then
    return false;
  end if;
  if private.is_tenant_branch_administrator(p_tenant_id) then
    return true;
  end if;
  if not private.is_branch_assigned(p_tenant_id, p_branch_id) then
    return false;
  end if;
  if exists (
    select 1 from public.branch_permission_grants g
    where g.tenant_id=p_tenant_id and g.staff_id=(select auth.uid())
      and g.permission_key=v_key and g.effect='deny'
      and (g.branch_id is null or g.branch_id=p_branch_id)
  ) then return false; end if;
  if exists (
    select 1 from public.branch_permission_grants g
    where g.tenant_id=p_tenant_id and g.staff_id=(select auth.uid())
      and g.permission_key=v_key and g.effect='allow'
      and (g.branch_id is null or g.branch_id=p_branch_id)
  ) then return true; end if;

  -- The Roles UI and staff provisioning persist { pos: { write: true } },
  -- not { "pos.write": true }. The saved user override is authoritative
  -- for real module read/write/edit permissions, including explicit false.
  v_module := split_part(v_key,'.',1);
  v_action := split_part(v_key,'.',2);
  if v_action in ('read','write','edit') and v_key = v_module || '.' || v_action then
    select u.role_permissions #>> array[v_module,v_action] into v_profile_value
    from public.users u
    where u.id=(select auth.uid()) and u.tenant_id=p_tenant_id and u.is_active;
    if v_profile_value in ('true','false') then
      return v_profile_value = 'true';
    end if;
  end if;

  if exists (
    select 1 from public.branch_staff_assignments a
    join public.branch_roles r
      on r.tenant_id=a.tenant_id and r.id=a.branch_role_id and r.status='active'
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
      and a.staff_id=(select auth.uid()) and a.status='active'
      and (a.starts_at is null or a.starts_at<=now())
      and (a.ends_at is null or a.ends_at>now())
      and (r.permissions @> jsonb_build_object(v_key,true)
        or (v_action in ('read','write','edit')
          and v_key=v_module||'.'||v_action
          and r.permissions #>> array[v_module,v_action]='true'))
  ) then return true; end if;
  if exists (
    select 1 from public.branch_staff_assignments a
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
      and a.staff_id=(select auth.uid()) and a.status='active'
      and (a.starts_at is null or a.starts_at<=now())
      and (a.ends_at is null or a.ends_at>now())
      and (a.permissions @> jsonb_build_object(v_key,true)
        or (v_action in ('read','write','edit')
          and v_key=v_module||'.'||v_action
          and a.permissions #>> array[v_module,v_action]='true'))
  ) then return true; end if;
  -- Delivery UI is a POS workflow. Inherit POS write only when no delivery
  -- override or explicit branch deny resolved above; never inherit money_bank.post.
  if v_key='deliveries.write' then
    if exists (
      select 1 from public.branch_staff_assignments a
      left join public.branch_roles r on r.id=a.branch_role_id and r.tenant_id=a.tenant_id and r.status='active'
      where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.staff_id=(select auth.uid())
        and a.status='active' and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
        and (a.permissions #>> array['deliveries','write']='false' or r.permissions #>> array['deliveries','write']='false')
    ) then return false; end if;
    return private.has_branch_permission(p_tenant_id,p_branch_id,'pos.write');
  end if;
  return false;
end;
$function$
;


-- Collect only the stored delivery fee in the authenticated active branch.
-- The caller supplies no amount, tenant, branch, or arbitrary journal metadata.
create or replace function public.collect_current_branch_delivery_payment(
  p_delivery_id text, p_source_account_key text default null
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_actor uuid:=(select auth.uid()); v_tenant uuid:=private.current_tenant_id();
  v_context jsonb; v_branch uuid; v_snapshot jsonb; v_delivery jsonb; v_next jsonb;
  v_saved jsonb; v_committed jsonb; v_amount numeric(18,2); v_balance numeric(18,2);
  v_account public.branch_payment_accounts%rowtype; v_existing public.treasury_journals%rowtype;
  v_journal uuid; v_now timestamptz:=clock_timestamp();
begin
  if v_actor is null or v_tenant is null or not private.is_active_tenant_member(v_tenant) then
    raise exception using errcode='42501',message='An active tenant session is required.';
  end if;
  v_context:=public.get_current_branch_context();
  v_branch:=nullif(v_context->>'activeBranchId','')::uuid;
  if v_context->>'activeScope' is distinct from 'branch' or v_branch is null
    or not private.can_write_branch(v_tenant,v_branch,'deliveries.write') then
    raise exception using errcode='42501',message='Delivery collection permission is required for the selected branch.';
  end if;
  if nullif(btrim(p_delivery_id),'') is null or length(p_delivery_id)>180 then
    raise exception using errcode='22023',message='A valid delivery reference is required.';
  end if;
  perform 1 from public.tenant_workspaces where tenant_id=v_tenant for update;
  if not found then raise exception using errcode='P0002',message='Delivery workspace is unavailable.';end if;
  if private.normalized_writes_enabled(v_tenant) then
    v_snapshot:=private.normalized_mutation_snapshot(v_tenant,array['deliveries']);
  else
    select payload into v_snapshot from public.tenant_workspaces where tenant_id=v_tenant;
  end if;
  select item into v_delivery from jsonb_array_elements(coalesce(v_snapshot->'deliveries','[]'::jsonb)) item
    where item->>'id'=btrim(p_delivery_id);
  if v_delivery is null
    or (nullif(v_delivery->>'branchId','') is not null and v_delivery->>'branchId'<>v_branch::text)
    or (nullif(v_delivery->>'branchId','') is null and not coalesce((v_context->'selectedBranch'->>'includesUnassignedHistoricalRecords')::boolean,false)) then
    raise exception using errcode='P0002',message='Delivery is not available in the selected branch.';
  end if;
  if v_delivery->>'status'='Cancelled' or v_delivery->>'deliveryPaymentStatus'='cancelled' then
    raise exception using errcode='23514',message='A cancelled delivery cannot collect payment.';
  end if;
  v_amount:=round(coalesce((v_delivery->>'deliveryCost')::numeric,0),2);
  if v_amount='NaN'::numeric or v_amount<0 then raise exception using errcode='23514',message='Delivery fee is invalid.';end if;
  if v_amount>0 then
    select * into v_account from public.branch_payment_accounts
      where tenant_id=v_tenant and branch_id=v_branch and source_key=btrim(p_source_account_key)
        and status='active' and not is_locked for update;
    if v_account.id is null then
      raise exception using errcode='23514',message='Delivery payment account is unavailable in the selected branch.';
    end if;
    select * into v_existing from public.treasury_journals
      where tenant_id=v_tenant and idempotency_key='delivery:'||btrim(p_delivery_id)||':v1';
    if found then
      if v_existing.source_type<>'delivery' or v_existing.source_id<>btrim(p_delivery_id)
        or v_existing.journal_type<>'money_in' or v_existing.currency<>v_account.currency
        or exists(select 1 from public.treasury_journals where tenant_id=v_tenant and reversal_of_journal_id=v_existing.id)
        or (select count(*) from public.treasury_journal_lines where journal_id=v_existing.id and tenant_id=v_tenant)<>1
        or not exists(select 1 from public.treasury_journal_lines where journal_id=v_existing.id and tenant_id=v_tenant
          and branch_id=v_branch and account_id=v_account.id and signed_amount=v_amount) then
        raise exception using errcode='23505',message='Delivery payment conflicts with an existing journal. Check payment history.';
      end if;
      v_journal:=v_existing.id;
    else
      if v_delivery->>'deliveryPaymentStatus'='collected' or nullif(v_delivery->>'treasuryJournalId','') is not null then
        raise exception using errcode='23514',message='Delivery already has a collection record. Check payment history.';
      end if;
      insert into public.treasury_journals(tenant_id,journal_type,source_type,source_id,idempotency_key,currency,
        description,external_cash_flow,posted_by,metadata)
      values(v_tenant,'money_in','delivery',btrim(p_delivery_id),'delivery:'||btrim(p_delivery_id)||':v1',v_account.currency,
        'Collected delivery income for '||btrim(p_delivery_id),true,v_actor,jsonb_build_object('saleId',v_delivery->>'saleId','sourceAccountKey',p_source_account_key))
      returning id into v_journal;
      insert into public.branch_account_balances(tenant_id,branch_id,account_id,currency,current_balance,row_version)
        values(v_tenant,v_branch,v_account.id,v_account.currency,0,0)
        on conflict(tenant_id,account_id,currency) do nothing;
      update public.branch_account_balances set current_balance=current_balance+v_amount,row_version=row_version+1,updated_at=v_now
        where tenant_id=v_tenant and account_id=v_account.id and currency=v_account.currency returning current_balance into v_balance;
      insert into public.treasury_journal_lines(tenant_id,journal_id,branch_id,account_id,currency,signed_amount,balance_after)
        values(v_tenant,v_journal,v_branch,v_account.id,v_account.currency,v_amount,v_balance);
    end if;
    if v_balance is null then select current_balance into v_balance from public.branch_account_balances where tenant_id=v_tenant and account_id=v_account.id and currency=v_account.currency;end if;
  elsif nullif(v_delivery->>'treasuryJournalId','') is not null then
    raise exception using errcode='23514',message='Delivery already has a collection record. Check payment history.';
  end if;
  if v_delivery->>'status'='Delivered' and v_delivery->>'deliveryPaymentStatus'='collected'
    and (v_delivery->>'treasuryJournalId') is not distinct from v_journal::text then
    return jsonb_build_object('delivery',v_delivery,'journalId',v_journal,'branchId',v_branch,'accountId',v_account.id,'balance',v_balance,'status','already_collected');
  end if;
  v_delivery:=v_delivery||jsonb_build_object('branchId',v_branch,'status','Delivered','deliveryPaymentStatus','collected',
    'deliveredAt',v_now,'paymentCollectedAt',v_now,'syncUpdatedAt',v_now);
  if v_journal is not null then
    v_delivery:=v_delivery||jsonb_build_object('treasuryJournalId',v_journal,'deliveryPaymentAccountId',v_account.source_key,'deliveryPaymentMethod',v_account.account_name);
  end if;
  select coalesce(jsonb_agg(case when item->>'id'=btrim(p_delivery_id) then v_delivery else item end order by ordinal),'[]'::jsonb)
    into v_next from jsonb_array_elements(coalesce(v_snapshot->'deliveries','[]'::jsonb)) with ordinality as entries(item,ordinal);
  v_saved:=public.save_current_branch_deliveries(v_next);
  select item into v_committed from jsonb_array_elements(coalesce(v_saved->'deliveries','[]'::jsonb)) item where item->>'id'=btrim(p_delivery_id);
  if v_committed->>'status' is distinct from 'Delivered' or v_committed->>'deliveryPaymentStatus' is distinct from 'collected'
    or (v_committed->>'treasuryJournalId') is distinct from v_journal::text then
    raise exception using errcode='23514',message='Delivery payment was not saved. No funds were recorded.';
  end if;
  return jsonb_build_object('delivery',v_committed,'journalId',v_journal,'branchId',v_branch,'accountId',v_account.id,'balance',v_balance,'status','collected');
end;
$function$;
revoke all on function public.collect_current_branch_delivery_payment(text,text) from public,anon;
grant execute on function public.collect_current_branch_delivery_payment(text,text) to authenticated;

