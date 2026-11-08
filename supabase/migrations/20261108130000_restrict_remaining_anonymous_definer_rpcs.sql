-- Scope: remaining public SECURITY DEFINER RPCs intended for signed-in tenant/affiliate users.
-- Only anonymous/PUBLIC execution is revoked. Existing explicit authenticated and service_role
-- grants are retained. No changes to functions' bodies, tables, RLS, or tenant data.
-- The separately reviewed backend-only provisioning RPC is handled by the preceding migration.
DO $hardening$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = ANY(ARRAY[
        'activate_current_tenant_primary_branch',
        'complete_affiliate_task',
        'convert_cross_branch_document_to_sales',
        'create_cross_branch_commercial_document',
        'create_current_tenant_branch',
        'end_user_session',
        'get_current_branch_context',
        'get_current_branch_entitlement',
        'list_cross_branch_document_sources',
        'list_current_user_branches',
        'record_affiliate_activity',
        'record_partner_affiliate_action',
        'select_current_branch',
        'touch_user_session',
        'update_cross_branch_commercial_document',
        'update_current_sales_document'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
  END LOOP;
END;
$hardening$;
