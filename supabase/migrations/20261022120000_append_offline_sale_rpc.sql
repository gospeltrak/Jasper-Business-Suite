-- Offline-APK sale sync: a single sale queued while a device was offline
-- must be ADDED to the branch's sales list, never used to REPLACE it.
-- save_current_branch_sales (20260930120000) is the right call for a normal
-- online save (the client always holds the full current list there), but it
-- replaces the whole branch slice with whatever array the client sends --
-- unsafe for a device that went offline and is now pushing a list built
-- from a stale snapshot, since it would silently discard any sale another
-- device added in the meantime. This function instead appends exactly one
-- sale by id, inside the same row-locked transaction used everywhere else
-- in this file (public.tenant_workspaces ... for update), and is idempotent
-- by sale id so a retried sync (e.g. after a network timeout) cannot
-- duplicate the sale or double-decrement stock.
--
-- Scope: sale + stock only (shopStockQty/storeStockQty/stockQty, from each
-- item's baseQuantityDeducted). Per-batch remaining-quantity bookkeeping
-- (product.batches[].quantityRemaining) is intentionally left untouched --
-- replicating the FEFO batch-selection logic server-side is a separate,
-- larger piece of work and batch counts already drift far less than the
-- headline stock count. Treasury/Money & Bank posting for an offline sale
-- is a separate client-side step after this call succeeds (reusing the
-- already-idempotent public.post_current_tenant_treasury_split_entry with
-- the sale's own id as idempotency key) -- not duplicated here, to avoid
-- re-implementing payment-channel reconciliation (TypeScript business
-- logic) inside SQL.
--
-- This is entirely separate from, and does not touch, the not-yet-applied
-- native-tenant-workspace migrations (20261015100000 / 20261015110000) --
-- it only ever operates on public.tenant_workspaces, exactly like every
-- other *_only_save_rpc function in this file set.

begin;

create or replace function public.append_offline_sale_to_branch(
  p_sale jsonb
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
  v_existing_sales jsonb;
  v_existing_products jsonb;
  v_sale_id text;
  v_already_present boolean;
  v_next_sales jsonb;
  v_next_products jsonb;
  v_next_payload jsonb;
  v_item jsonb;
  v_product_id text;
  v_deduct numeric;
  v_channel text;
  v_product jsonb;
  v_idx int;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_sale is null or jsonb_typeof(p_sale) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid sale object is required.';
  end if;
  v_sale_id := nullif(p_sale ->> 'id', '');
  if v_sale_id is null then
    raise exception using errcode = '22023', message = 'A sale id is required.';
  end if;

  v_context := public.get_current_branch_context();
  v_scope := coalesce(v_context ->> 'activeScope', 'no_branch_access');
  v_branch_id := nullif(v_context ->> 'activeBranchId', '')::uuid;
  if v_scope = 'compatibility_primary' then
    v_branch_id := coalesce(v_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
  elsif v_scope = 'branch' then
    if v_branch_id is null or not private.can_read_branch(v_tenant_id, v_branch_id) then
      raise exception using errcode = '42501', message = 'The selected branch is not accessible.';
    end if;
  else
    raise exception using errcode = '42501', message = 'A single writable branch must be selected to sync an offline sale.';
  end if;
  if not private.is_tenant_branch_administrator(v_tenant_id)
    and not private.can_write_branch(v_tenant_id, v_branch_id, 'pos.write')
  then
    raise exception using errcode = '42501', message = 'Write permission is required for sales.';
  end if;

  -- Lock this tenant's workspace row for the whole operation -- the same
  -- "for update" pattern save_current_branch_sales already uses, so this
  -- can never interleave with a normal online save for the same tenant.
  select workspace.payload into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_sales := coalesce(v_existing -> 'sales', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);

  -- Idempotency: a sale id already present means this is a retried sync.
  -- Return success without touching stock again.
  select exists(
    select 1 from jsonb_array_elements(v_existing_sales) as item
    where item.value ->> 'id' = v_sale_id
  ) into v_already_present;

  if v_already_present then
    return jsonb_build_object('status', 'already_synced', 'sales', v_existing_sales, 'products', v_existing_products);
  end if;

  v_next_products := v_existing_products;
  for v_item in
    select value from jsonb_array_elements(coalesce(p_sale -> 'items', '[]'::jsonb))
    order by (value ->> 'productId')
  loop
    v_product_id := nullif(v_item ->> 'productId', '');
    if v_product_id is null then continue; end if;
    v_deduct := coalesce((v_item ->> 'baseQuantityDeducted')::numeric, (v_item ->> 'qty')::numeric, 0);
    if v_deduct <= 0 then continue; end if;
    v_channel := coalesce(nullif(v_item ->> 'channel', ''), 'shop');

    select (arr.idx - 1), arr.value into v_idx, v_product
    from jsonb_array_elements(v_next_products) with ordinality as arr(value, idx)
    where arr.value ->> 'id' = v_product_id
    limit 1;
    if v_product is null then continue; end if;

    if v_channel = 'store' then
      v_product := jsonb_set(
        v_product, '{storeStockQty}',
        to_jsonb(greatest(0, coalesce((v_product ->> 'storeStockQty')::numeric, 0) - v_deduct))
      );
    else
      v_product := jsonb_set(
        v_product, '{shopStockQty}',
        to_jsonb(greatest(0, coalesce((v_product ->> 'shopStockQty')::numeric, 0) - v_deduct))
      );
    end if;
    v_product := jsonb_set(
      v_product, '{stockQty}',
      to_jsonb(
        greatest(0, coalesce((v_product ->> 'shopStockQty')::numeric, 0))
        + greatest(0, coalesce((v_product ->> 'storeStockQty')::numeric, 0))
      )
    );
    v_product := jsonb_set(v_product, '{syncUpdatedAt}', to_jsonb(now()));
    v_next_products := jsonb_set(v_next_products, array[v_idx::text], v_product);
  end loop;

  v_next_sales := v_existing_sales || jsonb_build_array(p_sale);

  v_next_payload := jsonb_set(v_existing, '{sales}', v_next_sales, true);
  v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object('status', 'synced', 'sales', v_next_sales, 'products', v_next_products);
end;
$$;

revoke all on function public.append_offline_sale_to_branch(jsonb) from public, anon;
grant execute on function public.append_offline_sale_to_branch(jsonb) to authenticated;

commit;
