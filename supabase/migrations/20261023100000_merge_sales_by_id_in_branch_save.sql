-- Fixes a real lost-update race in save_current_branch_sales, found while
-- auditing offline sync: for the 'branch'/'compatibility_primary' scope it
-- replaces the whole branch slice with whatever array the calling client
-- sends (private.replace_branch_json_array). Two sessions on the same
-- branch saving within ~10s of each other (DashboardOverview's
-- LOCAL_WORKSPACE_PROTECTION_MS, which suppresses the realtime refresh
-- right after a local write) can silently discard one session's sale --
-- its own local snapshot never learned about the other session's write
-- before it pushed its own "full" array. This is not specific to the
-- offline-APK feature; it already affects two ordinary online sessions.
--
-- Fix: merge the branch's sales by id instead of replacing, picking the
-- record with the latest known timestamp (incoming wins exact ties, same
-- as the client's own mergeSalesForSync in saleSync.ts, which this
-- mirrors) and permanently excluding any id present in the tombstone map
-- -- a recorded deletion is authoritative regardless of timestamps, exactly
-- like the client-side merge already treats it, so a sale can never
-- resurrect after being deleted. Function name/signature of
-- save_current_branch_sales is unchanged -- no client-side changes needed.
--
-- Scope: only the 'branch'/'compatibility_primary' path (the one used by
-- every normal POS save) changes. The rarer 'all_branches' admin-aggregate
-- path is left as-is for now.

begin;

create or replace function private.merge_branch_sales_json_array(
  p_existing jsonb,
  p_incoming jsonb,
  p_branch_id uuid,
  p_include_unassigned boolean,
  p_tombstones jsonb
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with other_branch_items as (
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(p_existing) = 'array' then p_existing else '[]'::jsonb end
    ) as item(value)
    where not (
      coalesce(item.value ->> 'branchId', item.value ->> 'branch_id') = p_branch_id::text
      or (
        p_include_unassigned
        and nullif(coalesce(item.value ->> 'branchId', item.value ->> 'branch_id'), '') is null
      )
    )
  ),
  branch_candidates as (
    select item.value, 0 as src_rank
    from jsonb_array_elements(
      private.filter_branch_json_array(p_existing, p_branch_id, p_include_unassigned)
    ) as item(value)
    union all
    select item.value, 1 as src_rank
    from jsonb_array_elements(
      private.filter_branch_json_array(p_incoming, p_branch_id, p_include_unassigned)
    ) as item(value)
  ),
  dated as (
    select
      value,
      value ->> 'id' as id,
      src_rank,
      greatest(
        coalesce(nullif(value ->> 'syncUpdatedAt', '')::timestamptz, '-infinity'::timestamptz),
        coalesce(nullif(value ->> 'updatedAt', '')::timestamptz, '-infinity'::timestamptz),
        coalesce(nullif(value ->> 'actualTimestamp', '')::timestamptz, '-infinity'::timestamptz),
        coalesce(nullif(value ->> 'timestamp', '')::timestamptz, '-infinity'::timestamptz)
      ) as rec_time
    from branch_candidates
    where nullif(value ->> 'id', '') is not null
  ),
  picked as (
    select distinct on (id) value, id
    from dated
    order by id, rec_time desc, src_rank desc
  ),
  not_tombstoned as (
    select value
    from picked
    where not (
      p_tombstones is not null
      and jsonb_typeof(p_tombstones) = 'object'
      and nullif(p_tombstones ->> id, '') is not null
    )
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  from (
    select value from other_branch_items
    union all
    select value from not_tombstoned
  ) as combined;
$$;

create or replace function public.save_current_branch_sales(
  p_sales jsonb,
  p_sale_tombstones jsonb default '{}'::jsonb,
  p_products jsonb default null,
  p_deliveries jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := private.current_tenant_id();
  v_context jsonb;
  v_scope text;
  v_branch_id uuid;
  v_include_unassigned boolean;
  v_existing jsonb;
  v_existing_sales jsonb;
  v_existing_deliveries jsonb;
  v_existing_products jsonb;
  v_existing_sale_tombstones jsonb;
  v_next_sales jsonb;
  v_next_deliveries jsonb;
  v_next_products jsonb;
  v_next_sale_tombstones jsonb;
  v_existing_count integer;
  v_incoming_count integer;
  v_next_payload jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_sales is null or jsonb_typeof(p_sales) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid sales array is required.';
  end if;
  if p_sale_tombstones is null or jsonb_typeof(p_sale_tombstones) <> 'object' then
    p_sale_tombstones := '{}'::jsonb;
  end if;
  if p_products is not null and jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'products, when provided, must be an array.';
  end if;
  if p_deliveries is not null and jsonb_typeof(p_deliveries) <> 'array' then
    raise exception using errcode = '22023', message = 'deliveries, when provided, must be an array.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_sales := coalesce(v_existing -> 'sales', '[]'::jsonb);
  v_existing_deliveries := coalesce(v_existing -> 'deliveries', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_sale_tombstones := coalesce(v_existing -> 'saleTombstones', '{}'::jsonb);

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;

    v_existing_count := jsonb_array_length(v_existing_sales);
    v_incoming_count := jsonb_array_length(p_sales);
    if v_existing_count > 0 and v_incoming_count = 0 then
      v_next_sales := v_existing_sales;
    else
      if v_existing_count > 0 and v_incoming_count > 0
        and v_incoming_count < (v_existing_count * 0.5)
      then
        raise warning using message = format(
          'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=sales existing=%s incoming=%s',
          v_tenant_id, v_existing_count, v_incoming_count
        );
      end if;
      v_next_sales := p_sales;
    end if;

    if p_deliveries is not null then
      v_existing_count := jsonb_array_length(v_existing_deliveries);
      v_incoming_count := jsonb_array_length(p_deliveries);
      if v_existing_count > 0 and v_incoming_count = 0 then
        v_next_deliveries := v_existing_deliveries;
      else
        if v_existing_count > 0 and v_incoming_count > 0
          and v_incoming_count < (v_existing_count * 0.5)
        then
          raise warning using message = format(
            'Suspicious branch ledger shrink: tenant=%s scope=all_branches key=deliveries existing=%s incoming=%s',
            v_tenant_id, v_existing_count, v_incoming_count
          );
        end if;
        v_next_deliveries := p_deliveries;
      end if;
    end if;

    v_next_sale_tombstones := coalesce(p_sale_tombstones, v_existing_sale_tombstones);
  elsif v_scope in ('branch', 'compatibility_primary') then
    if v_scope = 'compatibility_primary' then
      v_include_unassigned := true;
      v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
      if not private.is_tenant_branch_administrator(v_tenant_id) then
        raise exception using
          errcode = '42501',
          message = 'Only a tenant administrator may write the compatibility workspace.';
      end if;
    else
      if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
        raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
      end if;
      v_include_unassigned := coalesce(
        (v_context -> 'selectedBranch' ->> 'includesUnassignedHistoricalRecords')::boolean,
        false
      );
      if not private.is_tenant_branch_administrator(v_tenant_id)
        and not private.can_write_branch(v_tenant_id, v_branch_id, 'pos.write')
      then
        raise exception using errcode = '42501', message = 'Write permission is required for sales.';
      end if;
    end if;

    v_existing_count := jsonb_array_length(
      private.filter_branch_json_array(v_existing_sales, v_branch_id, v_include_unassigned)
    );
    v_incoming_count := jsonb_array_length(
      private.filter_branch_json_array(p_sales, v_branch_id, v_include_unassigned)
    );
    if v_existing_count > 0 and v_incoming_count > 0
      and v_incoming_count < (v_existing_count * 0.5)
    then
      raise warning using message = format(
        'Suspicious branch ledger shrink: tenant=%s branch=%s key=sales existing=%s incoming=%s',
        v_tenant_id, v_branch_id, v_existing_count, v_incoming_count
      );
    end if;

    -- Tombstones are merged BEFORE the sales merge below so a deletion
    -- recorded by either side is always honored, never a stale one.
    v_next_sale_tombstones := v_existing_sale_tombstones || p_sale_tombstones;

    v_next_sales := private.merge_branch_sales_json_array(
      v_existing_sales, p_sales, v_branch_id, v_include_unassigned, v_next_sale_tombstones
    );

    if p_deliveries is not null then
      v_next_deliveries := private.replace_branch_json_array(
        v_existing_deliveries, p_deliveries, v_branch_id, v_include_unassigned
      );
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  if p_products is not null then
    v_next_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  end if;

  v_next_payload := jsonb_set(v_existing, '{sales}', v_next_sales, true);
  v_next_payload := jsonb_set(v_next_payload, '{saleTombstones}', v_next_sale_tombstones, true);
  if v_next_deliveries is not null then
    v_next_payload := jsonb_set(v_next_payload, '{deliveries}', v_next_deliveries, true);
  end if;
  if v_next_products is not null then
    v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);
  end if;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object(
    'sales', v_next_sales,
    'saleTombstones', v_next_sale_tombstones,
    'deliveries', v_next_deliveries,
    'products', v_next_products
  );
end;
$$;

revoke all on function public.save_current_branch_sales(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_current_branch_sales(jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
