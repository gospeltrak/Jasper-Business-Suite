-- Existing duplicate barcodes are legacy data: leave those rows untouched.
-- Enforce new barcode uniqueness per tenant on writes to normalized products.
-- Also allows legacy INSERT ON CONFLICT UPDATE calls to preserve old codes.

CREATE OR REPLACE FUNCTION private.reject_new_product_barcode_duplicate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text;
  v_previous_code text;
begin
  if new.source_active is not true then
    return new;
  end if;

  v_code := lower(btrim(coalesce(nullif(btrim(new.barcode), ''), nullif(btrim(new.sku), ''), '')));
  if v_code = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_previous_code := lower(btrim(coalesce(nullif(btrim(old.barcode), ''), nullif(btrim(old.sku), ''), '')));
    -- Do not penalize legacy duplicates for ordinary edits, prices or stock.
    if old.tenant_id = new.tenant_id and old.source_active is true and v_previous_code = v_code then
      return new;
    end if;
  elsif new.legacy_id is not null then
    -- Normalized saves use INSERT ... ON CONFLICT (tenant_id, legacy_id)
    -- DO UPDATE. Their BEFORE INSERT trigger also fires on an update.
    -- Keep existing legacy barcodes, including historical duplicates, intact.
    if exists (
      select 1
      from public.products p
      where p.tenant_id = new.tenant_id
        and p.legacy_id = new.legacy_id
        and p.source_active is true
        and lower(btrim(coalesce(nullif(btrim(p.barcode), ''), nullif(btrim(p.sku), ''), ''))) = v_code
    ) then
      return new;
    end if;
  end if;

  -- A tenant-scoped transactional lock closes the race between concurrent
  -- product registrations that would otherwise both pass an existence check.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('orvix-product-barcode:' || new.tenant_id::text || ':' || v_code, 0)
  );

  if exists (
    select 1
    from public.products p
    where p.tenant_id = new.tenant_id
      and p.id <> new.id
      and p.source_active is true
      and lower(btrim(coalesce(nullif(btrim(p.barcode), ''), nullif(btrim(p.sku), ''), ''))) = v_code
  ) then
    raise exception using
      errcode = '23505',
      message = 'This barcode is already registered to another product.',
      detail = 'Use a different barcode or edit the existing product.';
  end if;
  return new;
end;
$function$

CREATE TRIGGER products_reject_new_duplicate_barcodes BEFORE INSERT OR UPDATE OF barcode, sku, tenant_id, legacy_id, source_active ON public.products FOR EACH ROW EXECUTE FUNCTION private.reject_new_product_barcode_duplicate();
