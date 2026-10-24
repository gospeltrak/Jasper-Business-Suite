-- New empty tenants start with normalized writes; imported/non-empty tenants still require verified cutover.
create or replace function private.initialize_empty_normalized_workspace()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_key text;
begin
 if exists(select 1 from public.workspace_migration_state where tenant_id=new.tenant_id) then return new;end if;
 foreach v_key in array array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes'] loop
  if jsonb_typeof(coalesce(new.payload->v_key,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(new.payload->v_key,'[]'::jsonb))<>0 then return new;end if;
 end loop;
 if exists(select 1 from public.products where tenant_id=new.tenant_id)
   or exists(select 1 from public.sales where tenant_id=new.tenant_id)
   or exists(select 1 from public.purchases where tenant_id=new.tenant_id) then return new;end if;
 insert into public.workspace_migration_state(tenant_id,migration_version,phase,read_mode,dual_write_enabled,normalized_writes_enabled,normalized_writes_activated_at,last_verified_at)
 values(new.tenant_id,'workspace-normalization-v1','normalized','normalized',false,true,statement_timestamp(),statement_timestamp());
 insert into private.normalized_write_cutover_archives(tenant_id,payload,source_updated_at,source_payload_hash)
 values(new.tenant_id,new.payload,new.updated_at,md5(new.payload::text));
 new.payload:=(new.payload-array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes'])||jsonb_build_object('businessStorage','normalized');
 return new;
end;
$$;
revoke all on function private.initialize_empty_normalized_workspace() from public,anon,authenticated;
create trigger initialize_empty_normalized_workspace before insert on public.tenant_workspaces
for each row execute function private.initialize_empty_normalized_workspace();

create or replace function private.guard_legacy_business_data_writes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.normalized_writes_enabled(private.safe_uuid(new.tenant_id)) and private.legacy_business_data_key(new.data_key) is not null then
  if (jsonb_typeof(new.payload)='array' and jsonb_array_length(new.payload)>0)
    or (jsonb_typeof(new.payload)='object' and exists(select 1 from jsonb_each(new.payload) as entry(key,value)
      where case when jsonb_typeof(value)='array' then jsonb_array_length(value)>0 else value not in ('null'::jsonb,'{}'::jsonb) end)) then
    raise exception using errcode='55000',message='Use the normalized business save API. Legacy business snapshots are read-only.';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.guard_legacy_business_data_writes() from public,anon,authenticated;
create trigger guard_legacy_business_data_writes before insert or update of payload on public.tenant_data
for each row execute function private.guard_legacy_business_data_writes();

-- A stale legacy outbox item can never backfill over a tenant using direct normalized writes.
do $patch$
declare v_definition text;
begin
 v_definition:=pg_get_functiondef('private.process_workspace_normalization_queue(integer)'::regprocedure);
 v_definition:=replace(v_definition,'and state.dual_write_enabled','and state.dual_write_enabled and not state.normalized_writes_enabled');
 execute v_definition;
end;
$patch$;

