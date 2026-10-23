-- Offline-APK purchase sync, mirroring 20261022120000_append_offline_sale_rpc.sql:
-- a single purchase queued while a device was offline must be ADDED to the
-- branch's purchases list, never used to REPLACE it -- save_current_branch_purchases
-- replaces the whole branch slice with whatever array the client sends,
-- which would silently discard any purchase another device added while
-- this one was offline. This function appends exactly one purchase by id,
-- inside the same row-locked transaction pattern, idempotent by purchase id
-- so a retried sync cannot duplicate the purchase or double-increase stock.
--
-- Scope: purchase + stock only (shopStockQty/storeStockQty/stockQty,
-- increased by each item's baseQty, based on the purchase's single
-- `destination`). branchStocks (per-branch stock rows) are intentionally
-- left untouched here -- same scoping decision as the sales RPC's
-- per-batch skip -- and stay correct only via the normal online save path
-- until a future stage, if ever needed. Treasury/Money & Bank posting for
-- an offline purchase is a separate client-side step after this call
-- succeeds (reusing the already-idempotent
-- public.post_current_tenant_treasury_split_outgoing_entry with the
-- purchase's own id as idempotency key), not duplicated here.
--
-- This is entirely separate from, and does not touch, the not-yet-applied
-- native-tenant-workspace migrations (20261015100000 / 20261015110000).

begin;

create or replace function public.append_offline_purchase_to_branch(
  p_purchase jsonb
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
  v_existing_purchases jsonb;
  v_existing_products jsonb;
  v_purchase_id text;
  v_already_present boolean;
  v_destination text;
  v_next_purchases jsonb;
  v_next_products jsonb;
  v_next_payload jsonb;
  v_item jsonb;
  v_product_id text;
  v_add numeric;
  v_product jsonb;
  v_idx int;
begin
  if v_actor_id is null or v_tenant_id is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;
  if p_purchase is null or jsonb_typeof(p_purchase) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid purchase object is required.';
  end if;
  v_purchase_id := nullif(p_purchase ->> 'id', '');
  if v_purchase_id is null then
    raise exception using errcode = '22023', message = 'A purchase id is required.';
  end if;
  v_destination := coalesce(nullif(p_purchase ->> 'destination', ''), 'shop');

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
    raise exception using errcode = '42501', message = 'A single writable branch must be selected to sync an offline purchase.';
  end if;
  if not private.is_tenant_branch_administrator(v_tenant_id)
    and not private.can_write_branch(v_tenant_id, v_branch_id, 'products.write')
  then
    raise exception using errcode = '42501', message = 'Write permission is required for purchases.';
  end if;

  -- Lock this tenant's workspace row for the whole operation -- the same
  -- "for update" pattern save_current_branch_purchases and
  -- append_offline_sale_to_branch already use.
  select workspace.payload into v_existing
  from public.tenant_workspaces as workspace
  where workspace.tenant_id = v_tenant_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_existing_purchases := coalesce(v_existing -> 'purchases', '[]'::jsonb);
  v_existing_products := coalesce(v_existing -> 'products', '[]'::jsonb);

  -- Idempotency: a purchase id already present means this is a retried
  -- sync. Return success without increasing stock again.
  select exists(
    select 1 from jsonb_array_elements(v_existing_purchases) as item
    where item.value ->> 'id' = v_purchase_id
  ) into v_already_present;

  if v_already_present then
    return jsonb_build_object('status', 'already_synced', 'purchases', v_existing_purchases, 'products', v_existing_products);
  end if;

  v_next_products := v_existing_products;
  for v_item in
    select value from jsonb_array_elements(coalesce(p_purchase -> 'items', '[]'::jsonb))
    order by (value ->> 'productId')
  loop
    v_product_id := nullif(v_item ->> 'productId', '');
    if v_product_id is null then continue; end if;
    v_add := coalesce((v_item ->> 'baseQty')::numeric, (v_item ->> 'qty')::numeric, 0);
    if v_add <= 0 then continue; end if;

    select (arr.idx - 1), arr.value into v_idx, v_product
    from jsonb_array_elements(v_next_products) with ordinality as arr(value, idx)
    where arr.value ->> 'id' = v_product_id
    limit 1;
    if v_product is null then continue; end if;

    if v_destination = 'store' then
      v_product := jsonb_set(
        v_product, '{storeStockQty}',
        to_jsonb(coalesce((v_product ->> 'storeStockQty')::numeric, 0) + v_add)
      );
    else
      v_product := jsonb_set(
        v_product, '{shopStockQty}',
        to_jsonb(coalesce((v_product ->> 'shopStockQty')::numeric, 0) + v_add)
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

  v_next_purchases := v_existing_purchases || jsonb_build_array(p_purchase);

  v_next_payload := jsonb_set(v_existing, '{purchases}', v_next_purchases, true);
  v_next_payload := jsonb_set(v_next_payload, '{products}', v_next_products, true);

  insert into public.tenant_workspaces (tenant_id, payload, updated_at, updated_by)
  values (v_tenant_id, v_next_payload, statement_timestamp(), v_actor_id)
  on conflict (tenant_id) do update
  set payload = v_next_payload,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  return jsonb_build_object('status', 'synced', 'purchases', v_next_purchases, 'products', v_next_products);
end;
$$;

revoke all on function public.append_offline_purchase_to_branch(jsonb) from public, anon;
grant execute on function public.append_offline_purchase_to_branch(jsonb) to authenticated;

commit;
