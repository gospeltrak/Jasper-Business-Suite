begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.save_current_sales_document(p_document jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant_id uuid := (select private.current_tenant_id());
  v_id uuid := coalesce(private.safe_uuid(p_document ->> 'id'), gen_random_uuid());
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

  select document.document_payload
  into v_payload
  from public.sales_documents as document
  where document.id = v_id
    and document.tenant_id = v_tenant_id
    and document.deleted_at is null;
  if v_payload is not null then
    return v_payload;
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

commit;
