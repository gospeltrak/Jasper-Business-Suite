-- Performance fix: editing a single product was slow because the client's
-- only save path (save_current_branch_workspace) always round-trips the
-- ENTIRE tenant workspace -- every sale, purchase, expense and delivery --
-- even when only the products array actually changed. As a tenant's
-- transaction history grows, that full read-merge-write cycle gets
-- progressively slower for something as small as a single price edit.
--
-- This adds a narrow, products-only save RPC. It touches only the
-- `products` and `productTombstones` keys of the workspace payload (via the
-- same private.merge_workspace_products_by_id ID-based merge the full save
-- already uses for products, so nothing about merge semantics changes) and
-- never reads or rewrites sales/purchases/expenses/deliveries/settings.
-- Authorization mirrors exactly what save_current_branch_workspace already
-- enforces for the 'products' key in each scope.

begin;

create or replace function public.save_current_branch_products(
  p_products jsonb,
  p_product_tombstones jsonb default '{}'::jsonb
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
  v_existing jsonb;
  v_existing_products jsonb;
  v_existing_tombstones jsonb;
  v_merged_products jsonb;
  v_merged_tombstones jsonb;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_products is null or jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'A valid products array is required.';
  end if;
  if p_product_tombstones is null or jsonb_typeof(p_product_tombstones) <> 'object' then
    p_product_tombstones := '{}'::jsonb;
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;

  if v_scope = 'all_branches' then
    if not (
      coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
      and private.is_tenant_branch_administrator(v_tenant_id)
    ) then
      raise exception using errcode = '42501', message = 'All Branches access is not permitted.';
    end if;
  elsif v_scope = 'compatibility_primary' then
    if not private.is_tenant_branch_administrator(v_tenant_id) then
      raise exception using
        errcode = '42501',
        message = 'Only a tenant administrator may write the compatibility workspace.';
    end if;
  elsif v_scope = 'branch' then
    if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
      raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
    end if;
    if not private.is_tenant_branch_administrator(v_tenant_id)
      and not private.can_write_branch(v_tenant_id, v_branch_id, 'products.write')
    then
      raise exception using errcode = '42501', message = 'Write permission is required for products.';
    end if;
  else
    raise exception using errcode = '42501', message = 'No writable branch is selected.';
  end if;

  select workspace.payload
  into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);

  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);
  v_existing_tombstones := coalesce(v_existing -> 'productTombstones', '{}'::jsonb);

  v_merged_products := private.merge_workspace_products_by_id(v_existing_products, p_products);
  v_merged_tombstones := v_existing_tombstones || p_product_tombstones;

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (
    v_tenant_id,
    jsonb_build_object('products', v_merged_products, 'productTombstones', v_merged_tombstones),
    statement_timestamp(),
    v_actor_id
  )
  on conflict (tenant_id) do update
  set payload = jsonb_set(
        jsonb_set(public.tenant_workspaces.payload, '{products}', v_merged_products, true),
        '{productTombstones}',
        v_merged_tombstones,
        true
      ),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object(
    'products', v_merged_products,
    'productTombstones', v_merged_tombstones
  );
end;
$$;

revoke all on function public.save_current_branch_products(jsonb, jsonb) from public, anon;
grant execute on function public.save_current_branch_products(jsonb, jsonb) to authenticated;

commit;
