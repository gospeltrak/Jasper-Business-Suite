-- Emergency rollback of the bootstrap read-path optimization ONLY.
-- No business data, branches, roles, transactions, audit records or backups modified.
-- Execute with Supabase apply_migration ONLY if response parity checks fail.
begin;
CREATE OR REPLACE FUNCTION public.get_current_branch_workspace_bootstrap_v3()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_scoped jsonb;
  v_payload jsonb;
begin
  if v_tenant_id is null or (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An active tenant account is required.';
  end if;

  if not private.workspace_normalized_reads_ready(v_tenant_id) then
    return public.get_current_branch_workspace_v2();
  end if;

  -- Preserve the established product, stock, settings and permission scope.
  -- Historical ledgers are delivered independently by the cursor RPC.
  v_scoped := public.get_current_branch_workspace();
  v_payload := v_scoped -> 'payload';
  if v_payload is null then
    return v_scoped || jsonb_build_object('readSource', 'normalized_paginated');
  end if;

  v_payload := v_payload || jsonb_build_object(
    'sales', '[]'::jsonb,
    'expenses', '[]'::jsonb,
    'deliveries', '[]'::jsonb,
    'purchases', '[]'::jsonb
  );

  return jsonb_set(v_scoped, '{payload}', v_payload, true)
    || jsonb_build_object('readSource', 'normalized_paginated');
end;
$function$;

commit;
