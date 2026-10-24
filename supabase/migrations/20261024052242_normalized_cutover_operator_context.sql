CREATE OR REPLACE FUNCTION private.enable_normalized_business_writes(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_workspace public.tenant_workspaces%rowtype;v_note jsonb;v_ordinal bigint;v_branch uuid;
begin
  select * into strict v_workspace from public.tenant_workspaces where tenant_id=p_tenant_id for update;
  if private.normalized_writes_enabled(p_tenant_id) then return;end if;
  if not private.workspace_normalized_reads_ready(p_tenant_id)
    or not (public.validate_workspace_shadow_content(p_tenant_id)->>'allMatch')::boolean
    or not (public.validate_branch_stock_shadow(p_tenant_id)->>'allMatch')::boolean then
    raise exception using errcode='55000',message='Verified normalized read cutover is required before direct writes.';
  end if;
  insert into private.normalized_write_cutover_archives(tenant_id,payload,source_updated_at,source_payload_hash)
  values(p_tenant_id,v_workspace.payload,v_workspace.updated_at,md5(v_workspace.payload::text)) on conflict(tenant_id) do nothing;
  update public.workspace_migration_state set normalized_writes_enabled=true,normalized_writes_activated_at=statement_timestamp(),
    dual_write_enabled=false,phase='normalized',read_mode='normalized',last_error='{}',updated_at=statement_timestamp() where tenant_id=p_tenant_id;
  for v_note,v_ordinal in select item,ordinal from jsonb_array_elements(coalesce(v_workspace.payload->'pendingDeliveryNotes','[]'::jsonb)) with ordinality as notes(item,ordinal) loop
    v_branch:=private.safe_uuid(v_note->>'branchId');
    if v_branch is not null and not exists(select 1 from public.branches where tenant_id=p_tenant_id and id=v_branch) then raise exception using errcode='23503',message='A pending note references another tenant branch.';end if;
    insert into public.pending_delivery_notes(tenant_id,branch_id,legacy_id,status,reference,source_record,source_ordinal,source_updated_at)
    values(p_tenant_id,v_branch,coalesce(nullif(btrim(v_note->>'id'),''),'hash:'||md5(v_note::text)),v_note->>'status',v_note->>'reference',v_note,v_ordinal,v_workspace.updated_at)
    on conflict(tenant_id,legacy_id) do update set branch_id=excluded.branch_id,status=excluded.status,reference=excluded.reference,
      source_record=excluded.source_record,source_ordinal=excluded.source_ordinal,source_active=true,source_updated_at=excluded.source_updated_at;
  end loop;
  update public.tenant_workspaces set payload=(payload-array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes'])||jsonb_build_object('businessStorage','normalized'),
    updated_at=statement_timestamp() where tenant_id=p_tenant_id;
  update public.workspace_normalization_outbox set status='completed',locked_at=null,locked_by=null,last_error='{}',updated_at=statement_timestamp() where tenant_id=p_tenant_id;
end;
$function$
;
