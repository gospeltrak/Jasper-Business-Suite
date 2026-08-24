-- Keep invoice/quote product sources aligned with the stock quantities shown
-- by each branch. Legacy workspaces can have the location quantities populated
-- while the aggregate quantity is still zero, so the previous RPC hid valid
-- products from every branch picker.
create or replace function public.list_cross_branch_document_sources()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := (select private.current_tenant_id());
begin
  if v_tenant_id is null or not coalesce(private.can_view_consolidated_branches(v_tenant_id), false) then
    raise exception 'Consolidated branch documents require active Tanzanite access.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', branch.id,
        'branchName', branch.branch_name,
        'branchCode', branch.branch_code,
        'businessName', branch.business_name,
        'isDefault', branch.is_default,
        'address', branch.address,
        'city', branch.city,
        'region', branch.region,
        'country', branch.country,
        'phone', branch.phone,
        'email', branch.email,
        'branding', coalesce((
          select jsonb_object_agg(
            setting.setting_scope || '.' || setting.setting_key,
            setting.setting_value
          )
          from public.branch_settings as setting
          where setting.tenant_id = branch.tenant_id
            and setting.branch_id = branch.id
            and setting.setting_scope in ('business', 'branding', 'documents', 'tax')
        ), '{}'::jsonb)
      ) order by branch.is_default desc, branch.branch_name)
      from public.branches as branch
      where branch.tenant_id = v_tenant_id
        and branch.status = 'active'
        and branch.archived_at is null
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'branchId', stock.branch_id,
        'productId', stock.product_id,
        'quantity', greatest(
          coalesce(stock.quantity, 0),
          coalesce(stock.shop_stock_qty, 0) + coalesce(stock.store_stock_qty, 0)
        ),
        'sellingPrice', coalesce(price.retail_price, stock.selling_price),
        'wholesalePrice', price.wholesale_price
      ) order by stock.branch_id, stock.product_id)
      from public.branch_stock as stock
      left join public.branch_product_prices as price
        on price.tenant_id = stock.tenant_id
       and price.branch_id = stock.branch_id
       and price.product_id = stock.product_id
       and price.effective_from <= now()
       and (price.effective_to is null or price.effective_to > now())
      where stock.tenant_id = v_tenant_id
        and greatest(
          coalesce(stock.quantity, 0),
          coalesce(stock.shop_stock_qty, 0) + coalesce(stock.store_stock_qty, 0)
        ) > 0
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_cross_branch_document_sources() from public;
grant execute on function public.list_cross_branch_document_sources() to authenticated;
