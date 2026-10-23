set local lock_timeout='5s';
create or replace function private.preserve_purchase_payment_state(p_existing jsonb,p_incoming jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_incoming jsonb := coalesce(p_incoming,'[]'::jsonb);
  v_old jsonb;
  v_new jsonb;
  v_result jsonb := '[]'::jsonb;
  v_fields text[] := array['amountPaid','amountDue','payments','paymentAllocations','paidFromAccountId','paymentMethod','syncUpdatedAt','updatedAt'];
begin
  for v_new in select value from jsonb_array_elements(v_incoming) loop
    select value into v_old from jsonb_array_elements(coalesce(p_existing,'[]'::jsonb)) where value->>'id'=v_new->>'id';
    if jsonb_array_length(coalesce(v_old->'payments','[]'::jsonb))>0 then
      if (v_new->>'totalAmount')::numeric < (v_old->>'amountPaid')::numeric then
        raise exception using errcode='23514',message='Purchase total cannot be less than its recorded payments.';
      end if;
      v_new := (v_new-v_fields) || (select jsonb_object_agg(key,value) from jsonb_each(v_old) where key=any(v_fields));
      v_new := jsonb_set(v_new,'{amountDue}',to_jsonb((v_new->>'totalAmount')::numeric-(v_old->>'amountPaid')::numeric),true);
    end if;
    v_result := v_result||jsonb_build_array(v_new);
  end loop;
  for v_old in select value from jsonb_array_elements(coalesce(p_existing,'[]'::jsonb)) loop
    if jsonb_array_length(coalesce(v_old->'payments','[]'::jsonb))>0
      and not exists(select 1 from jsonb_array_elements(v_result) where value->>'id'=v_old->>'id') then
      raise exception using errcode='23514',message='Purchases with recorded installments must be kept for payment audit history.';
    end if;
  end loop;
  return v_result;
end;
$$;
revoke all on function private.preserve_purchase_payment_state(jsonb,jsonb) from public,anon,authenticated;


do $guard$
declare v_definition text;
begin
  v_definition := pg_get_functiondef('public.save_current_branch_purchases(jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  v_definition := replace(v_definition,
    '  v_next_purchases := private.preserve_purchase_payment_state(v_existing_purchases,v_next_purchases);',
    '  if exists(select 1 from jsonb_array_elements(v_existing_purchases) as item where jsonb_array_length(coalesce(item->''payments'',''[]''::jsonb))>0 and v_next_purchase_tombstones ? (item->>''id'')) then raise exception using errcode=''23514'',message=''Purchases with recorded installments must be kept for payment audit history.''; end if;'||chr(10)||
    '  v_next_purchases := private.preserve_purchase_payment_state(v_existing_purchases,v_next_purchases);');
  execute v_definition;
  v_definition := pg_get_functiondef('public.save_current_branch_workspace(jsonb)'::regprocedure);
  v_definition := replace(v_definition,
    '  v_next := jsonb_set(v_next, ''{purchases}'', private.preserve_purchase_payment_state(v_existing->''purchases'',v_next->''purchases''),true);',
    '  if exists(select 1 from jsonb_array_elements(coalesce(v_existing->''purchases'',''[]''::jsonb)) as item where jsonb_array_length(coalesce(item->''payments'',''[]''::jsonb))>0 and coalesce(v_next->''purchaseTombstones'',''{}''::jsonb) ? (item->>''id'')) then raise exception using errcode=''23514'',message=''Purchases with recorded installments must be kept for payment audit history.''; end if;'||chr(10)||
    '  v_next := jsonb_set(v_next, ''{purchases}'', private.preserve_purchase_payment_state(v_existing->''purchases'',v_next->''purchases''),true);');
  execute v_definition;
end;
$guard$;
