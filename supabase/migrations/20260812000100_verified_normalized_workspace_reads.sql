-- Verified normalized reads with an immediate, data-preserving rollback switch.
begin;

create or replace function public.get_current_branch_workspace_v2()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_scoped jsonb; v_payload jsonb; v_state public.workspace_migration_state%rowtype;
  v_content jsonb; v_stock jsonb; v_latest_match boolean := false;
  v_latest_hash text; v_current_hash text; v_key text; v_table regclass; v_records jsonb;
begin
  if v_tenant_id is null or (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  v_scoped := public.get_current_branch_workspace();
  v_payload := v_scoped -> 'payload';
  if v_payload is null then return v_scoped || jsonb_build_object('readSource', 'legacy_empty'); end if;

  select * into v_state from public.workspace_migration_state where tenant_id = v_tenant_id;
  if not found or v_state.read_mode <> 'normalized' then
    return v_scoped || jsonb_build_object('readSource', 'legacy');
  end if;

  select md5(payload::text) into v_current_hash
  from public.tenant_workspaces where tenant_id = v_tenant_id;
  select is_match, source_payload_hash into v_latest_match, v_latest_hash
  from public.workspace_reconciliation_runs where tenant_id = v_tenant_id
  order by checked_at desc, id desc limit 1;
  v_content := public.validate_workspace_shadow_content(v_tenant_id);
  v_stock := public.validate_branch_stock_shadow(v_tenant_id);
  if not coalesce(v_state.dual_write_enabled, false)
    or v_state.last_verified_at is null
    or v_state.last_source_hash is distinct from v_current_hash
    or not coalesce(v_latest_match, false) or v_latest_hash is distinct from v_current_hash
    or not coalesce((v_content ->> 'allMatch')::boolean, false)
    or not coalesce((v_stock ->> 'allMatch')::boolean, false)
    or exists (select 1 from public.workspace_normalization_outbox
               where tenant_id = v_tenant_id and status in ('pending', 'processing', 'failed'))
  then return v_scoped || jsonb_build_object('readSource', 'legacy_fallback'); end if;

  -- Keep the established branch/permission scope: only replace rows already
  -- present in the scoped legacy result. Protected non-legacy rows stay intact.
  for v_key, v_table in select * from (values
    ('products', 'public.products'::regclass), ('sales', 'public.sales'::regclass),
    ('expenses', 'public.expenses'::regclass), ('deliveries', 'public.deliveries'::regclass),
    ('purchases', 'public.purchases'::regclass), ('branchStocks', 'public.branch_stock'::regclass)
  ) x(payload_key, source_table) loop
    execute format(
      'select coalesce(jsonb_agg(r.source_record order by r.source_ordinal), ''[]''::jsonb)
       from %s r where r.tenant_id = $1 and r.legacy_id is not null
       and r.legacy_id in (select coalesce(nullif(btrim(i ->> ''id''), ''''), ''hash:'' || md5(i::text))
                           from jsonb_array_elements(coalesce($2 -> $3, ''[]''::jsonb)) i)', v_table)
      into v_records using v_tenant_id, v_payload, v_key;
    v_payload := jsonb_set(v_payload, array[v_key], v_records, true);
  end loop;
  return jsonb_set(v_scoped, '{payload}', v_payload, true) || jsonb_build_object('readSource', 'normalized');
end; $$;

revoke all on function public.get_current_branch_workspace_v2() from public, anon;
grant execute on function public.get_current_branch_workspace_v2() to authenticated;

create or replace function private.activate_workspace_normalized_read(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_content jsonb; v_stock jsonb;
begin
  v_content := public.validate_workspace_shadow_content(p_tenant_id);
  v_stock := public.validate_branch_stock_shadow(p_tenant_id);
  if not coalesce((v_content ->> 'allMatch')::boolean, false)
    or not coalesce((v_stock ->> 'allMatch')::boolean, false)
    or exists (select 1 from public.workspace_normalization_outbox
               where tenant_id = p_tenant_id and status in ('pending', 'processing', 'failed'))
  then raise exception using errcode = '55000', message = 'Normalized read verification gates did not pass.'; end if;
  update public.workspace_migration_state
  set phase='normalized', read_mode='normalized', dual_write_enabled=true,
      last_error='{}'::jsonb, updated_at=now()
  where tenant_id=p_tenant_id and last_verified_at is not null;
  if not found then raise exception using errcode='P0002', message='Verified workspace migration state was not found.'; end if;
end; $$;

create or replace function private.rollback_workspace_normalized_read(p_tenant_id uuid, p_reason text default 'manual_rollback')
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.workspace_migration_state
  set phase='rolled_back', read_mode='legacy', dual_write_enabled=true,
      last_error=jsonb_build_object('code','normalized_read_rollback','reason',left(coalesce(p_reason,'manual_rollback'),240),'at',now()), updated_at=now()
  where tenant_id=p_tenant_id;
  if not found then raise exception using errcode='P0002', message='Workspace migration state was not found.'; end if;
end; $$;

revoke all on function private.activate_workspace_normalized_read(uuid) from public, anon, authenticated, service_role;
revoke all on function private.rollback_workspace_normalized_read(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.activate_workspace_normalized_read(uuid) to postgres;
grant execute on function private.rollback_workspace_normalized_read(uuid, text) to postgres;
commit;
