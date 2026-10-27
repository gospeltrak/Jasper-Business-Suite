-- STAGING CANDIDATE ONLY. DO NOT RUN ON LIVE PRODUCTION.
--
-- Performance goal:
-- private.normalized_mutation_snapshot() currently invokes
-- private.normalized_business_snapshot() then get_current_branch_workspace()
-- which rebuilds the same full normalized business snapshot again.
-- Under authorized all_branches scope, get_current_branch_workspace()->'payload'
-- equals that first snapshot (see exact original SQL in PostgreSQL).
-- Return it directly, avoiding a redundant JSONB aggregation/sort/read.
--
-- Non-admin/branch/compatibility/no-access paths still call the original
-- get_current_branch_workspace() and keep their permission+scope behavior.
-- No table/index/trigger/settings/record is modified by authoring this file.
--
-- This SQL changes a function definition *only if explicitly executed*.
-- Run on a staging clone with a restore-tested database snapshot and compare
-- output/side effects before scheduling any production migration.
BEGIN;

DO $expected_version$
BEGIN
  IF md5(pg_get_functiondef(
    'private.normalized_mutation_snapshot(uuid,text[])'::regprocedure
  )) IS DISTINCT FROM '79fa2d46e0a22da25bdb99b8bfe89de1' THEN
    RAISE EXCEPTION
      'Normalized mutation snapshot has changed; review source before applying this patch.';
  END IF;
END
$expected_version$;

CREATE OR REPLACE FUNCTION private.normalized_mutation_snapshot(
  p_tenant_id uuid,
  p_keys text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
  v_scoped jsonb;
  v_key text;
  v_context jsonb;
BEGIN
  v_result := private.normalized_business_snapshot(p_tenant_id, p_keys);
  IF p_keys = ARRAY[]::text[] THEN
    RETURN v_result;
  END IF;

  -- With authorized all-branches access the scoped loader would return
  -- this very same snapshot. Only take this shortcut for the signed-in
  -- tenant and a known, supported subset of collection keys.
  IF (SELECT auth.uid()) IS NOT NULL
     AND p_tenant_id = private.current_tenant_id()
     AND (p_keys IS NULL OR (
       p_keys <@ ARRAY[
         'products', 'sales', 'expenses', 'deliveries',
         'purchases', 'branchStocks', 'pendingDeliveryNotes'
       ]::text[]
       AND array_position(p_keys, NULL) IS NULL
     ))
  THEN
    v_context := public.get_current_branch_context();
    IF v_context ->> 'activeScope' = 'all_branches'
      AND coalesce((v_context ->> 'canViewAllBranches')::boolean, false)
    THEN
      RETURN v_result;
    END IF;
  END IF;

  -- Important: non-all-branch scopes still perform the original
  -- permission-checked workspace read. DO NOT remove or replace this.
  v_scoped := public.get_current_branch_workspace() -> 'payload';
  FOREACH v_key IN ARRAY coalesce(
    p_keys,
    ARRAY[
      'products', 'sales', 'expenses', 'deliveries',
      'purchases', 'branchStocks', 'pendingDeliveryNotes'
    ]
  ) LOOP
    v_result := jsonb_set(
      v_result,
      ARRAY[v_key],
      coalesce(v_scoped -> v_key, '[]'::jsonb),
      true
    );
  END LOOP;
  RETURN v_result;
END;
$function$;

COMMIT;
