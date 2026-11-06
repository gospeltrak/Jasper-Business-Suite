-- Consolidated invoices: repair stale all-branch staff grants only when
-- the same tenant explicitly granted quote/invoice write permissions.
-- Do not broaden access to assigned-branch-only staff or another tenant.
begin;

update public.branch_staff_access_profiles as profile
set can_view_consolidated = true,
    updated_at = now()
from public.users as staff
where staff.id = profile.staff_id
  and staff.tenant_id = profile.tenant_id
  and staff.is_active = true
  and profile.status = 'active'
  and profile.access_scope = 'all_branches'
  and profile.can_view_consolidated = false
  and (
    lower(coalesce(staff.role_permissions -> 'price quote' ->> 'write', 'false')) = 'true'
    or lower(coalesce(staff.role_permissions -> 'quotation' ->> 'write', 'false')) = 'true'
    or lower(coalesce(staff.role_permissions -> 'all' ->> 'write', 'false')) = 'true'
  );

-- Permissions are recomputed from the user's current role on EVERY request.
-- Revoking quote.write or all-branch access immediately stops consolidated
-- document access even if the historical profile flag is still true.
create or replace function private.can_view_consolidated_branches(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select coalesce(private.can_operate_additional_branches(p_tenant_id), false)
    and (
      private.is_tenant_branch_administrator(p_tenant_id)
      or exists (
        select 1
        from public.branch_staff_access_profiles as profile
        join public.users as staff
          on staff.id = profile.staff_id and staff.tenant_id = profile.tenant_id
        where profile.tenant_id = p_tenant_id
          and profile.staff_id = (select auth.uid())
          and profile.status = 'active'
          and profile.access_scope = 'all_branches'
          and profile.can_view_consolidated = true
          and staff.is_active = true
          and (
            lower(coalesce(staff.role_permissions -> 'price quote' ->> 'write', 'false')) = 'true'
            or lower(coalesce(staff.role_permissions -> 'quotation' ->> 'write', 'false')) = 'true'
            or lower(coalesce(staff.role_permissions -> 'all' ->> 'write', 'false')) = 'true'
          )
      )
    );
$function$;

-- Payment details on consolidated quotes/invoices are informational only,
-- never Money & Bank postings. No historical document amounts are changed.
alter table public.cross_branch_commercial_documents
  add column if not exists payment_method text not null default '',
  add column if not exists payment_account_number text,
  add column if not exists payment_account_name text,
  add column if not exists payment_amount numeric(14,2) not null default 0;

CREATE OR REPLACE FUNCTION public.create_cross_branch_commercial_document(p_document jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_payment_method text;
  v_payment_amount numeric(14,2);
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
  -- Payment is a document instruction, not a treasury posting.
  -- Cash/Credit must never require bank account or delivery fees.
  v_delivery := greatest(0, coalesce((p_document ->> 'deliveryAmount')::numeric, 0));
  v_payment_method := left(coalesce(nullif(btrim(p_document ->> 'paymentMethod'), ''), 'Cash'), 120);

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
  v_payment_amount := case when lower(v_payment_method) = 'credit' then 0
    else least(v_total,greatest(0,coalesce((p_document ->> 'paymentAmount')::numeric,v_total))) end;

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
    'logoLightUrl', branch.logo_light_url,
    'logoDarkUrl', branch.logo_dark_url,
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
    branch.city, branch.region, branch.country, branch.phone, branch.email,
    branch.logo_light_url, branch.logo_dark_url;

  insert into public.cross_branch_commercial_documents (
    tenant_id, issuing_branch_id, document_type, document_number,
    customer_name, customer_phone, customer_address, issue_date, currency,
    subtotal, discount_amount, tax_amount, delivery_amount, total_amount,
    notes, branding_snapshot, created_by,
    payment_method, payment_account_number, payment_account_name, payment_amount
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
    coalesce(v_branding, '{}'::jsonb), v_actor_id,
    v_payment_method,
    case when lower(v_payment_method) in ('cash','credit') then null else left(nullif(btrim(p_document ->> 'paymentAccountNumber'), ''), 180) end,
    case when lower(v_payment_method) in ('cash','credit') then null else left(nullif(btrim(p_document ->> 'paymentAccountName'), ''), 180) end,
    v_payment_amount
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
      select 1 from public.branches as branch
      where branch.tenant_id = v_tenant_id
        and branch.id = nullif(v_item ->> 'sourceBranchId', '')::uuid
        and branch.status = 'active' and branch.archived_at is null
    ) then
      raise exception 'Selected source branch is unavailable.' using errcode = '22023';
    end if;
    if btrim(coalesce(v_item ->> 'productId', '')) = '' then
      raise exception 'A selected product is missing its id.' using errcode = '22023';
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
$function$
;
CREATE OR REPLACE FUNCTION public.update_cross_branch_commercial_document(p_document_id uuid, p_document jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant_id uuid := (select private.current_tenant_id());
  v_issuing_branch_id uuid;
  v_status text;
  v_item jsonb;
  v_line_number integer := 0;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2);
  v_tax numeric(14,2);
  v_delivery numeric(14,2);
  v_payment_method text;
  v_total numeric(14,2);
begin
  if v_tenant_id is null or not coalesce(private.can_view_consolidated_branches(v_tenant_id), false) then
    raise exception 'Cross-branch documents require active Tanzanite access.'
      using errcode = '42501';
  end if;

  select status, issuing_branch_id into v_status, v_issuing_branch_id
  from public.cross_branch_commercial_documents
  where tenant_id = v_tenant_id and id = p_document_id and deleted_at is null
  for update;

  if v_issuing_branch_id is null then
    raise exception 'Document was not found.' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'Only a pending document can be edited.' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_document -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'At least one item is required.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_document -> 'items') > 500 then
    raise exception 'A document may contain at most 500 items.' using errcode = '22023';
  end if;

  v_discount := greatest(0, coalesce((p_document ->> 'discountAmount')::numeric, 0));
  v_tax := greatest(0, coalesce((p_document ->> 'taxAmount')::numeric, 0));
  v_delivery := greatest(0, coalesce((p_document ->> 'deliveryAmount')::numeric, 0));
  v_payment_method := left(coalesce(nullif(btrim(p_document ->> 'paymentMethod'), ''), 'Cash'), 120);

  select coalesce(sum(round(
    coalesce((elem ->> 'quantity')::numeric, 0) * coalesce((elem ->> 'unitPrice')::numeric, 0), 2
  )), 0)
  into v_subtotal
  from jsonb_array_elements(p_document -> 'items') as elem;

  if v_discount > v_subtotal then
    raise exception 'Document discount cannot exceed subtotal.' using errcode = '22023';
  end if;
  v_total := v_subtotal - v_discount + v_tax + v_delivery;

  update public.cross_branch_commercial_documents
  set customer_name = coalesce(nullif(btrim(p_document ->> 'customerName'), ''), 'General Customer'),
      customer_phone = nullif(btrim(p_document ->> 'customerPhone'), ''),
      customer_address = nullif(btrim(p_document ->> 'customerAddress'), ''),
      issue_date = coalesce(nullif(p_document ->> 'issueDate', '')::date, issue_date),
      subtotal = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      delivery_amount = v_delivery,
      total_amount = v_total,
      payment_method = v_payment_method,
      payment_account_number = case when lower(v_payment_method) in ('cash','credit') then null else left(nullif(btrim(p_document ->> 'paymentAccountNumber'), ''),180) end,
      payment_account_name = case when lower(v_payment_method) in ('cash','credit') then null else left(nullif(btrim(p_document ->> 'paymentAccountName'), ''),180) end,
      payment_amount = case when lower(v_payment_method)='credit' then 0
        else least(v_total,greatest(0,coalesce((p_document ->> 'paymentAmount')::numeric,v_total))) end,
      notes = nullif(btrim(p_document ->> 'notes'), ''),
      updated_at = now()
  where tenant_id = v_tenant_id and id = p_document_id;

  delete from public.cross_branch_commercial_document_items
  where tenant_id = v_tenant_id and document_id = p_document_id;

  for v_item in select value from jsonb_array_elements(p_document -> 'items')
  loop
    v_line_number := v_line_number + 1;
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0
      or coalesce((v_item ->> 'unitPrice')::numeric, -1) < 0 then
      raise exception 'Every item requires a positive quantity and non-negative price.'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.branches as branch
      where branch.tenant_id = v_tenant_id
        and branch.id = nullif(v_item ->> 'sourceBranchId', '')::uuid
        and branch.status = 'active' and branch.archived_at is null
    ) then
      raise exception 'Selected source branch is unavailable.' using errcode = '22023';
    end if;
    if btrim(coalesce(v_item ->> 'productId', '')) = '' then
      raise exception 'A selected product is missing its id.' using errcode = '22023';
    end if;

    insert into public.cross_branch_commercial_document_items (
      tenant_id, document_id, line_number, source_branch_id, product_id,
      product_name_snapshot, unit_snapshot, quantity, unit_price, line_total,
      internal_source_metadata
    )
    values (
      v_tenant_id, p_document_id, v_line_number,
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
    'documentId', p_document_id,
    'subtotal', v_subtotal,
    'total', v_total,
    'itemCount', v_line_number
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.list_current_commercial_documents()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with tenant as (
    select private.current_tenant_id() as id
  ), standard_documents as (
    select (
      coalesce(nullif(document.document_payload, '{}'::jsonb), jsonb_build_object(
        'id', document.id,
        'tenantId', document.tenant_id,
        'type', case when document.type = 'proforma' then 'proforma invoice' else 'price quote' end,
        'documentNumber', document.document_number,
        'customerName', document.customer_name,
        'customerPhone', document.customer_phone,
        'customerAddress', document.customer_address,
        'total', document.total,
        'tax', document.tax,
        'deliveryCost', document.delivery_cost,
        'hasVat', document.has_vat,
        'status', document.status,
        'timestamp', document.timestamp,
        'items', '[]'::jsonb
      )) || jsonb_build_object('updatedAt', document.updated_at)
    ) || case when document.deleted_at is null then '{}'::jsonb else jsonb_build_object('deletedAt', document.deleted_at) end as payload,
    document.updated_at
    from public.sales_documents document, tenant
    where document.tenant_id = tenant.id
  ), cross_documents as (
    select (
      jsonb_build_object(
        'id', document.id,
        'serverDocumentId', document.id,
        'tenantId', document.tenant_id,
        'type', case when document.document_type = 'proforma_invoice' then 'proforma invoice' else 'price quote' end,
        'documentNumber', document.document_number,
        'customerName', document.customer_name,
        'customerPhone', coalesce(document.customer_phone, ''),
        'customerAddress', coalesce(document.customer_address, ''),
        'items', coalesce((select jsonb_agg(jsonb_build_object(
          'productId', item.product_id,
          'productName', item.product_name_snapshot,
          'qty', item.quantity,
          'price', item.unit_price,
          'unit', item.unit_snapshot,
          'sourceBranchId', item.source_branch_id,
          'discount', 0,
          'discountType', 'percent'
        ) order by item.line_number) from public.cross_branch_commercial_document_items item
          where item.tenant_id = document.tenant_id and item.document_id = document.id), '[]'::jsonb),
        'total', document.total_amount,
        'tax', document.tax_amount,
        'discountAmount', document.discount_amount,
        'deliveryCost', document.delivery_amount,
        'paymentMethod', document.payment_method,
        'paymentAccountNumber', coalesce(document.payment_account_number,''),
        'paymentAccountName', coalesce(document.payment_account_name,''),
        'paymentAmount', document.payment_amount,
        'timestamp', document.issue_date::timestamptz,
        'status', document.status,
        'issuingBranchId', document.issuing_branch_id,
        'brandingSnapshot', document.branding_snapshot,
        'convertedAt', document.converted_at,
        'updatedAt', document.updated_at
      )
    ) || case when document.deleted_at is null then '{}'::jsonb else jsonb_build_object('deletedAt', document.deleted_at) end as payload,
    document.updated_at
    from public.cross_branch_commercial_documents document, tenant
    where document.tenant_id = tenant.id
  )
  select coalesce(jsonb_agg(payload order by updated_at desc), '[]'::jsonb)
  from (
    select * from standard_documents
    union all
    select * from cross_documents
  ) documents;
$function$
;

commit;
