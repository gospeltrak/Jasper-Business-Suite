-- Raise the server-side cap on get_current_branch_workspace_page's page size
-- from 200 to 1000. The client paginates sales/expenses/deliveries/purchases
-- sequentially (one round of 4 parallel collection fetches at a time, next
-- round only starts once the previous one resolves), so for a tenant with a
-- large history this round-trip count dominated total login-to-data-visible
-- time -- a tenant with 10,000+ sales rows needed 50+ sequential RPC round
-- trips. Total data transferred is unchanged; this only reduces how many
-- round trips it takes to move it, with no schema change.

begin;

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
  v_page_size integer := least(greatest(coalesce(p_limit, 100), 1), 1000);
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

commit;
