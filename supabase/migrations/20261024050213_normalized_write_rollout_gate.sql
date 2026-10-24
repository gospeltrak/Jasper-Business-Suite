create table if not exists private.normalized_write_rollout_control(id boolean primary key default true check(id),enabled boolean not null default false,updated_at timestamptz not null default now());
revoke all on private.normalized_write_rollout_control from public,anon,authenticated;
insert into private.normalized_write_rollout_control(id,enabled) values(true,false) on conflict(id) do nothing;
CREATE OR REPLACE FUNCTION private.initialize_empty_normalized_workspace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_key text;
begin
 if not coalesce((select enabled from private.normalized_write_rollout_control where id=true),false) then return new;end if;
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
$function$
;
