-- STAGING/ROLLBACK ONLY: restore exactly the original helper after evaluating
-- candidate_avoid_duplicate_normalized_admin_snapshot.sql.
-- No business rows, backups, tables, triggers or permissions are modified.
BEGIN;

DO $verify_candidate$
BEGIN
  IF position(
    'Under authorized all-branches access'
    IN pg_get_functiondef('private.normalized_mutation_snapshot(uuid,text[])'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'Not the reviewed candidate version. Refusing to overwrite.';
  END IF;
END
$verify_candidate$;

CREATE OR REPLACE FUNCTION private.normalized_mutation_snapshot(p_tenant_id uuid, p_keys text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;v_scoped jsonb;v_key text;
begin
 v_result:=private.normalized_business_snapshot(p_tenant_id,p_keys);
 if p_keys=array[]::text[] then return v_result;end if;
 v_scoped:=public.get_current_branch_workspace()->'payload';
 foreach v_key in array coalesce(p_keys,array['products','sales','expenses','deliveries','purchases','branchStocks','pendingDeliveryNotes']) loop
  v_result:=jsonb_set(v_result,array[v_key],coalesce(v_scoped->v_key,'[]'::jsonb),true);
 end loop;
 return v_result;
end;
$function$;

COMMIT;
