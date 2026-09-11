alter table public.sales_documents
  add column if not exists document_payload jsonb not null default '{}'::jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.cross_branch_commercial_documents
  add column if not exists deleted_at timestamptz;

create index if not exists sales_documents_tenant_updated_idx
  on public.sales_documents (tenant_id, updated_at desc);

create or replace function public.save_current_sales_document(p_document jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant_id uuid := (select private.current_tenant_id());
  v_id uuid := gen_random_uuid();
  v_type text;
  v_branch_id uuid := private.safe_uuid(coalesce(p_document ->> 'issuingBranchId', p_document ->> 'branchId'));
  v_payload jsonb;
begin
  if v_tenant_id is null then
    raise exception 'A valid tenant session is required.' using errcode = '42501';
  end if;
  if p_document is null or jsonb_typeof(p_document) <> 'object' then
    raise exception 'A document payload is required.' using errcode = '22023';
  end if;

  v_type := case lower(coalesce(p_document ->> 'type', ''))
    when 'price quote' then 'quotation'
    when 'quotation' then 'quotation'
    when 'proforma invoice' then 'proforma'
    when 'proforma' then 'proforma'
    else null
  end;
  if v_type is null then
    raise exception 'Unsupported sales document type.' using errcode = '22023';
  end if;
  if v_branch_id is not null and not exists (
    select 1 from public.branches where tenant_id = v_tenant_id and id = v_branch_id
  ) then
    raise exception 'The document branch is not available to this tenant.' using errcode = '42501';
  end if;

  v_payload := p_document || jsonb_build_object(
    'id', v_id,
    'tenantId', v_tenant_id
  );

  insert into public.sales_documents (
    id, tenant_id, branch_id, type, document_number, total, tax,
    delivery_cost, has_vat, customer_name, customer_phone, customer_address,
    notes, status, tagline, timestamp, document_payload, updated_at
  ) values (
    v_id, v_tenant_id, v_branch_id, v_type,
    left(coalesce(nullif(btrim(p_document ->> 'documentNumber'), ''), 'DOC-' || substr(v_id::text, 1, 8)), 120),
    greatest(coalesce((p_document ->> 'total')::numeric, 0), 0),
    greatest(coalesce((p_document ->> 'tax')::numeric, 0), 0),
    greatest(coalesce((p_document ->> 'deliveryCost')::numeric, 0), 0),
    coalesce((p_document ->> 'hasVat')::boolean, false),
    left(coalesce(nullif(btrim(p_document ->> 'customerName'), ''), 'Customer'), 240),
    left(nullif(btrim(p_document ->> 'customerPhone'), ''), 80),
    left(nullif(btrim(p_document ->> 'customerAddress'), ''), 500),
    left(nullif(btrim(p_document ->> 'notes'), ''), 2000),
    coalesce(nullif(btrim(p_document ->> 'status'), ''), 'pending'),
    left(nullif(btrim(p_document ->> 'tagline'), ''), 500),
    coalesce(private.safe_timestamptz(p_document ->> 'timestamp'), now()),
    v_payload, now()
  );

  return v_payload;
end;
$$;

create or replace function public.update_current_sales_document(p_document_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := (select private.current_tenant_id());
  v_payload jsonb;
begin
  if v_tenant_id is null then
    raise exception 'A valid tenant session is required.' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'A document patch is required.' using errcode = '22023';
  end if;

  update public.sales_documents
  set document_payload = document_payload || p_patch,
      status = coalesce(nullif(btrim(p_patch ->> 'status'), ''), status),
      deleted_at = case when p_patch ? 'deletedAt' then private.safe_timestamptz(p_patch ->> 'deletedAt') else deleted_at end,
      updated_at = now()
  where tenant_id = v_tenant_id and id = p_document_id
  returning document_payload into v_payload;

  if v_payload is null then
    update public.cross_branch_commercial_documents
    set status = coalesce(nullif(btrim(p_patch ->> 'status'), ''), status),
        deleted_at = case when p_patch ? 'deletedAt' then private.safe_timestamptz(p_patch ->> 'deletedAt') else deleted_at end,
        updated_at = now()
    where tenant_id = v_tenant_id and id = p_document_id
    returning p_patch || jsonb_build_object('id', id, 'serverDocumentId', id) into v_payload;
  end if;
  if v_payload is null then
    raise exception 'Sales document was not found.' using errcode = 'P0002';
  end if;
  return v_payload;
end;
$$;

create or replace function public.list_current_commercial_documents()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with tenant as (
    select private.current_tenant_id() as id
  ), standard_documents as (
    select coalesce(nullif(document.document_payload, '{}'::jsonb), jsonb_build_object(
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
    )) || case when document.deleted_at is null then '{}'::jsonb else jsonb_build_object('deletedAt', document.deleted_at) end as payload,
    document.updated_at
    from public.sales_documents document, tenant
    where document.tenant_id = tenant.id
  ), cross_documents as (
    select jsonb_build_object(
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
      'timestamp', document.issue_date::timestamptz,
      'status', document.status,
      'issuingBranchId', document.issuing_branch_id,
      'brandingSnapshot', document.branding_snapshot,
      'convertedAt', document.converted_at
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
$$;

revoke all on function public.save_current_sales_document(jsonb) from public;
revoke all on function public.update_current_sales_document(uuid, jsonb) from public;
revoke all on function public.list_current_commercial_documents() from public;
grant execute on function public.save_current_sales_document(jsonb) to authenticated;
grant execute on function public.update_current_sales_document(uuid, jsonb) to authenticated;
grant execute on function public.list_current_commercial_documents() to authenticated;
