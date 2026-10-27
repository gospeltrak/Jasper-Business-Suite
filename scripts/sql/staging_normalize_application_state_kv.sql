-- STAGING ONLY. Split tenant_data.application_state's single JSON blob
-- into one typed TEXT key/value row for each Storage API entry.
-- Legacy tenant_data rows and data_backup_% are NEVER edited or deleted.
-- This candidate does NOT activate client reads; state='shadow' until
-- independent restore-tested staging verification and explicit cutover.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('app.orvix_inventory_backfill_permission',true)
     IS DISTINCT FROM 'STAGING_ONLY_RESTORE_TESTED' THEN
    RAISE EXCEPTION 'Refusing application_state normalization outside restored staging.';
  END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS public.orvix_tenant_application_state_entries (
  tenant_id text NOT NULL,
  state_key text NOT NULL,
  state_value text,
  is_deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,state_key),
  CHECK(is_deleted OR state_value IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.orvix_tenant_application_state_status (
  tenant_id text PRIMARY KEY,
  state text NOT NULL DEFAULT 'shadow'
    CHECK(state IN ('shadow','active','disabled')),
  source_payload_hash text NOT NULL,
  source_entry_count integer NOT NULL CHECK(source_entry_count>=0),
  migrated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orvix_tenant_application_state_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_tenant_application_state_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_tenant_application_state_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orvix_tenant_application_state_status FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.orvix_tenant_application_state_entries FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.orvix_tenant_application_state_status FROM PUBLIC,anon,authenticated;

-- Active tenants will later need to edit just one state key rather than
-- rewrite all entries. RLS both scopes read and write to authenticated
-- current_tenant_id(), with no DELETE permission.
GRANT SELECT,INSERT,UPDATE ON public.orvix_tenant_application_state_entries TO authenticated;
GRANT SELECT ON public.orvix_tenant_application_state_status TO authenticated;
DO $policies$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('orvix_tenant_application_state_entries',
      'orvix_tenant_application_state_status')) THEN
    RAISE EXCEPTION 'Existing application state policies must be reviewed before reapplying.';
  END IF;
  EXECUTE 'CREATE POLICY orvix_app_state_select ON public.orvix_tenant_application_state_entries
    FOR SELECT TO authenticated
    USING (tenant_id=(select private.current_tenant_id())::text)';
  EXECUTE 'CREATE POLICY orvix_app_state_insert ON public.orvix_tenant_application_state_entries
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id=(select private.current_tenant_id())::text)';
  EXECUTE 'CREATE POLICY orvix_app_state_update ON public.orvix_tenant_application_state_entries
    FOR UPDATE TO authenticated
    USING (tenant_id=(select private.current_tenant_id())::text)
    WITH CHECK (tenant_id=(select private.current_tenant_id())::text)';
  EXECUTE 'CREATE POLICY orvix_app_state_status_select ON public.orvix_tenant_application_state_status
    FOR SELECT TO authenticated
    USING (tenant_id=(select private.current_tenant_id())::text)';
END $policies$;

DO $validate$
DECLARE v_bad bigint;
BEGIN
  SELECT COUNT(*) INTO v_bad FROM public.tenant_data t
  WHERE t.data_key='application_state'
    AND jsonb_typeof(t.payload) IS DISTINCT FROM 'object';
  IF v_bad>0 THEN
    RAISE EXCEPTION 'Unexpected application_state JSON shape on % tenant rows.',v_bad;
  END IF;
  SELECT count(*) INTO v_bad
  FROM public.tenant_data t
  CROSS JOIN LATERAL jsonb_each(t.payload) e
  WHERE t.data_key='application_state'
    AND jsonb_typeof(e.value) IS DISTINCT FROM 'string';
  IF v_bad>0 THEN
    RAISE EXCEPTION 'Application state contains % non-string values; refusing lossy conversion.',v_bad;
  END IF;
END $validate$;

INSERT INTO public.orvix_tenant_application_state_entries
  (tenant_id,state_key,state_value,is_deleted,updated_at)
SELECT t.tenant_id,e.key,e.value #>> '{}',false,t.updated_at
FROM public.tenant_data t
CROSS JOIN LATERAL jsonb_each(t.payload) e
WHERE t.data_key='application_state'
ON CONFLICT(tenant_id,state_key) DO NOTHING;

INSERT INTO public.orvix_tenant_application_state_status
  (tenant_id,state,source_payload_hash,source_entry_count)
SELECT t.tenant_id,'shadow',md5(t.payload::text),
  (SELECT count(*) FROM jsonb_object_keys(t.payload))
FROM public.tenant_data t
WHERE t.data_key='application_state'
ON CONFLICT(tenant_id) DO NOTHING;

-- Compare exact JSONB reconstruction per tenant, not merely key counts.
-- An existing divergent normalized row must abort the entire transaction.
DO $parity$
DECLARE v_bad bigint;
BEGIN
  SELECT count(*) INTO v_bad FROM public.tenant_data t
  JOIN public.orvix_tenant_application_state_status h
    ON h.tenant_id=t.tenant_id
  WHERE t.data_key='application_state'
    AND (
      h.state IS DISTINCT FROM 'shadow'
      OR h.source_payload_hash IS DISTINCT FROM md5(t.payload::text)
      OR h.source_entry_count IS DISTINCT FROM
         (SELECT count(*) FROM jsonb_object_keys(t.payload))
      OR (
        SELECT coalesce(jsonb_object_agg(e.state_key,e.state_value),
          '{}'::jsonb)
        FROM public.orvix_tenant_application_state_entries e
        WHERE e.tenant_id=t.tenant_id AND NOT e.is_deleted
      ) IS DISTINCT FROM t.payload
    );
  IF v_bad>0 THEN
    RAISE EXCEPTION 'Application state key/value reconstruction drift for % tenants.',v_bad;
  END IF;
END $parity$;
COMMIT;
-- The client can read these only AFTER a separate reviewed
-- shadow-to-active marker release. Never flip markers in this script.
