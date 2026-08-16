-- Fix create_cross_branch_commercial_document: the initial insert set
-- discount_amount without also setting subtotal/total_amount (they stayed at
-- their column default of 0 until a later update), so any document with a
-- discount above zero violated cross_branch_documents_amounts_check
-- (discount_amount <= subtotal) at insert time. Subtotal/total are now
-- computed from the submitted items before the insert, so the row is valid
-- the moment it is created. Additive only: no table/constraint changes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.create_cross_branch_commercial_document(
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid := (select private.current_tenant_id());
  v_document_id uuid;
  v_issuing_branch_id uuid;
  v_document_type text;
  v_document_number text;
  v_item jsonb;
  v_line_number integer := 0;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2);
  v_tax numeric(14,2);
  v_delivery numeric(14,2);
  v_total numeric(14,2);
  v_branding jsonb;
begin
  if v_tenant_id is null or not coalesce(private.can_view_consolidated_branches(v_tenant_id), false) then
    raise exception 'Cross-branch documents require active Tanzanite access.'
      using errcode = '42501';
  end if;

  v_issuing_branch_id := nullif(p_document ->> 'issuingBranchId', '')::uuid;
  v_document_type := lower(coalesce(p_document ->> 'documentType', ''));
  v_document_number := btrim(coalesce(p_document ->> 'documentNumber', ''));
  v_discount := greatest(0, coalesce((p_document ->> 'discountAmount')::numeric, 0));
  v_tax := greatest(0, coalesce((p_document ->> 'taxAmount')::numeric, 0));
  v_delivery := greatest(0, coalesce((p_document ->> 'deliveryAmount')::numeric, 0));

  if v_document_type not in ('price_quote', 'proforma_invoice') then
    raise exception 'Invalid commercial document type.' using errcode = '22023';
  end if;
  if v_document_number = '' or jsonb_array_length(coalesce(p_document -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Document number and at least one item are required.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_document -> 'items') > 500 then
    raise exception 'A document may contain at most 500 items.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.branches
    where tenant_id = v_tenant_id and id = v_issuing_branch_id
      and status = 'active' and archived_at is null
  ) then
    raise exception 'Issuing branch is unavailable.' using errcode = '22023';
  end if;

  select coalesce(sum(round(
    coalesce((elem ->> 'quantity')::numeric, 0) * coalesce((elem ->> 'unitPrice')::numeric, 0), 2
  )), 0)
  into v_subtotal
  from jsonb_array_elements(p_document -> 'items') as elem;

  if v_discount > v_subtotal then
    raise exception 'Document discount cannot exceed subtotal.' using errcode = '22023';
  end if;
  v_total := v_subtotal - v_discount + v_tax + v_delivery;

  select jsonb_build_object(
    'branchId', branch.id,
    'branchName', branch.branch_name,
    'businessName', branch.business_name,
    'address', branch.address,
    'city', branch.city,
    'region', branch.region,
    'country', branch.country,
    'phone', branch.phone,
    'email', branch.email,
    'settings', coalesce(jsonb_object_agg(
      setting.setting_scope || '.' || setting.setting_key,
      setting.setting_value
    ) filter (where setting.id is not null), '{}'::jsonb)
  )
  into v_branding
  from public.branches as branch
  left join public.branch_settings as setting
    on setting.tenant_id = branch.tenant_id
   and setting.branch_id = branch.id
   and setting.setting_scope in ('business', 'branding', 'documents', 'tax')
  where branch.tenant_id = v_tenant_id and branch.id = v_issuing_branch_id
  group by branch.id, branch.branch_name, branch.business_name, branch.address,
    branch.city, branch.region, branch.country, branch.phone, branch.email;

  insert into public.cross_branch_commercial_documents (
    tenant_id, issuing_branch_id, document_type, document_number,
    customer_name, customer_phone, customer_address, issue_date, currency,
    subtotal, discount_amount, tax_amount, delivery_amount, total_amount,
    notes, branding_snapshot, created_by
  )
  values (
    v_tenant_id, v_issuing_branch_id, v_document_type, v_document_number,
    coalesce(nullif(btrim(p_document ->> 'customerName'), ''), 'General Customer'),
    nullif(btrim(p_document ->> 'customerPhone'), ''),
    nullif(btrim(p_document ->> 'customerAddress'), ''),
    coalesce(nullif(p_document ->> 'issueDate', '')::date, current_date),
    coalesce(nullif(btrim(p_document ->> 'currency'), ''), 'TZS'),
    v_subtotal, v_discount, v_tax, v_delivery, v_total,
    nullif(btrim(p_document ->> 'notes'), ''),
    coalesce(v_branding, '{}'::jsonb), v_actor_id
  )
  returning id into v_document_id;

  for v_item in select value from jsonb_array_elements(p_document -> 'items')
  loop
    v_line_number := v_line_number + 1;
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0
      or coalesce((v_item ->> 'unitPrice')::numeric, -1) < 0 then
      raise exception 'Every item requires a positive quantity and non-negative price.'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.branch_stock as stock
      join public.branches as branch
        on branch.tenant_id = stock.tenant_id and branch.id = stock.branch_id
      where stock.tenant_id = v_tenant_id
        and stock.branch_id = nullif(v_item ->> 'sourceBranchId', '')::uuid
        and stock.product_id = btrim(v_item ->> 'productId')
        and branch.status = 'active' and branch.archived_at is null
    ) then
      raise exception 'A selected product is not available in its source branch.'
        using errcode = '22023';
    end if;

    insert into public.cross_branch_commercial_document_items (
      tenant_id, document_id, line_number, source_branch_id, product_id,
      product_name_snapshot, unit_snapshot, quantity, unit_price, line_total,
      internal_source_metadata
    )
    values (
      v_tenant_id, v_document_id, v_line_number,
      nullif(v_item ->> 'sourceBranchId', '')::uuid,
      btrim(v_item ->> 'productId'),
      coalesce(nullif(btrim(v_item ->> 'productName'), ''), 'Item'),
      nullif(btrim(v_item ->> 'unit'), ''),
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unitPrice')::numeric,
      round((v_item ->> 'quantity')::numeric * (v_item ->> 'unitPrice')::numeric, 2),
      jsonb_build_object('sourceBranchHiddenFromCustomer', true)
    );
  end loop;

  return jsonb_build_object(
    'documentId', v_document_id,
    'documentNumber', v_document_number,
    'subtotal', v_subtotal,
    'total', v_total,
    'itemCount', v_line_number,
    'brandingSnapshot', coalesce(v_branding, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.create_cross_branch_commercial_document(jsonb) from public;
grant execute on function public.create_cross_branch_commercial_document(jsonb) to authenticated;

commit;
