-- Cursor-paginated, branch-scoped reads from verified normalized workspace tables.
-- JSONB source_record is returned only as the compatibility representation expected
-- by the current client; filtering, ordering and pagination use normalized columns.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create index if not exists expenses_tenant_time_idx
  on public.expenses (tenant_id, "timestamp" desc, id);
create index if not exists deliveries_tenant_time_idx
  on public.deliveries (tenant_id, "timestamp" desc, id);
create index if not exists purchases_tenant_time_idx
  on public.purchases (tenant_id, "timestamp" desc, id);

create or replace function private.workspace_normalized_reads_ready(p_tenant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_state public.workspace_migration_state%rowtype;
  v_current_hash text;
  v_latest_hash text;
  v_latest_match boolean := false;
begin
  select * into v_state
  from public.workspace_migration_state
  where tenant_id = p_tenant_id;

  if not found
    or v_state.read_mode <> 'normalized'
    or not coalesce(v_state.dual_write_enabled, false)
    or v_state.last_verified_at is null
  then
    return false;
  end if;

  select md5(workspace.payload::text)
  into v_current_hash
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = p_tenant_id;

  select run.is_match, run.source_payload_hash
  into v_latest_match, v_latest_hash
  from public.workspace_reconciliation_runs as run
  where run.tenant_id = p_tenant_id
  order by run.checked_at desc, run.id desc
  limit 1;

  return v_state.last_source_hash is not distinct from v_current_hash
    and coalesce(v_latest_match, false)
    and v_latest_hash is not distinct from v_current_hash
    and not exists (
      select 1
      from public.workspace_normalization_outbox as outbox
      where outbox.tenant_id = p_tenant_id
        and outbox.status in ('pending', 'running', 'processing', 'failed')
    );
end;
$$;

create or replace function public.get_current_branch_workspace_page(
  p_collection text,
  p_limit integer default 100,
  p_cursor_timestamp timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean := false;
  v_all_branches boolean := false;
  v_table regclass;
  v_page_size integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_wrapped jsonb := '[]'::jsonb;
  v_records jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_next_cursor jsonb := null;
begin
  if v_tenant_id is null or (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  if (p_cursor_timestamp is null) <> (p_cursor_id is null) then
    raise exception using errcode = '22023', message = 'Both cursor fields are required.';
  end if;

  v_table := case p_collection
    when 'sales' then 'public.sales'::regclass
    when 'expenses' then 'public.expenses'::regclass
    when 'deliveries' then 'public.deliveries'::regclass
    when 'purchases' then 'public.purchases'::regclass
    else null
  end;
  if v_table is null then
    raise exception using errcode = '22023', message = 'Unsupported workspace collection.';
  end if;

  if not private.workspace_normalized_reads_ready(v_tenant_id) then
    return jsonb_build_object(
      'collection', p_collection,
      'records', '[]'::jsonb,
      'hasMore', false,
      'nextCursor', null,
      'readSource', 'legacy_fallback',
      'fallbackRequired', true
    );
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if v_scope = 'all_branches'
    and coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
  then
    v_all_branches := true;
    v_include_unassigned := true;
    v_branch_id := null;
  elsif v_scope = 'compatibility_primary' then
    v_include_unassigned := true;
    v_branch_id := null;
  elsif v_scope = 'branch' and v_branch_id is not null then
    v_include_unassigned := coalesce(
      (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
      false
    );
  else
    return jsonb_build_object(
      'collection', p_collection,
      'records', '[]'::jsonb,
      'hasMore', false,
      'nextCursor', null,
      'readSource', 'normalized',
      'fallbackRequired', false
    );
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(
       ''record'', page.source_record,
       ''cursorTimestamp'', page.sort_time,
       ''cursorId'', page.id
     ) order by page.sort_time desc, page.id), ''[]''::jsonb)
     from (
       select row_data.id, row_data."timestamp" as sort_time, row_data.source_record
       from %s as row_data
       where row_data.tenant_id = $1
         and row_data.legacy_id is not null
         and row_data.source_record is not null
         and ($2
           or row_data.branch_id = $3
           or ($4 and row_data.branch_id is null))
         and ($5::timestamptz is null
           or row_data."timestamp" < $5
           or (row_data."timestamp" = $5 and row_data.id > $6))
       order by row_data."timestamp" desc, row_data.id
       limit $7
     ) as page',
    v_table
  )
  into v_wrapped
  using v_tenant_id, v_all_branches, v_branch_id, v_include_unassigned,
        p_cursor_timestamp, p_cursor_id, v_page_size + 1;

  v_has_more := jsonb_array_length(v_wrapped) > v_page_size;
  if v_has_more then
    v_wrapped := v_wrapped - v_page_size;
  end if;

  select coalesce(jsonb_agg(item -> 'record' order by ordinal), '[]'::jsonb)
  into v_records
  from jsonb_array_elements(v_wrapped) with ordinality as page(item, ordinal);

  if v_has_more and jsonb_array_length(v_wrapped) > 0 then
    v_next_cursor := jsonb_build_object(
      'timestamp', v_wrapped -> (jsonb_array_length(v_wrapped) - 1) ->> 'cursorTimestamp',
      'id', v_wrapped -> (jsonb_array_length(v_wrapped) - 1) ->> 'cursorId'
    );
  end if;

  return jsonb_build_object(
    'collection', p_collection,
    'records', v_records,
    'hasMore', v_has_more,
    'nextCursor', v_next_cursor,
    'readSource', 'normalized',
    'fallbackRequired', false
  );
end;
$$;

create or replace function public.get_current_branch_workspace_bootstrap_v3()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_scoped jsonb;
  v_payload jsonb;
begin
  if v_tenant_id is null or (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  if not private.workspace_normalized_reads_ready(v_tenant_id) then
    return public.get_current_branch_workspace_v2();
  end if;

  -- Preserve the established product, stock, settings and permission scope.
  -- Historical ledgers are delivered independently by the cursor RPC.
  v_scoped := public.get_current_branch_workspace();
  v_payload := v_scoped -> 'payload';
  if v_payload is null then
    return v_scoped || jsonb_build_object('readSource', 'normalized_paginated');
  end if;

  v_payload := v_payload || jsonb_build_object(
    'sales', '[]'::jsonb,
    'expenses', '[]'::jsonb,
    'deliveries', '[]'::jsonb,
    'purchases', '[]'::jsonb
  );

  return jsonb_set(v_scoped, '{payload}', v_payload, true)
    || jsonb_build_object('readSource', 'normalized_paginated');
end;
$$;

revoke all on function private.workspace_normalized_reads_ready(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.workspace_normalized_reads_ready(uuid) to postgres;

revoke all on function public.get_current_branch_workspace_page(text, integer, timestamptz, uuid)
  from public, anon;
grant execute on function public.get_current_branch_workspace_page(text, integer, timestamptz, uuid)
  to authenticated;

revoke all on function public.get_current_branch_workspace_bootstrap_v3()
  from public, anon;
grant execute on function public.get_current_branch_workspace_bootstrap_v3()
  to authenticated;

commit;
