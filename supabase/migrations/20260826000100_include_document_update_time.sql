begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
$$;

revoke all on function public.list_current_commercial_documents() from public;
grant execute on function public.list_current_commercial_documents() to authenticated;

commit;