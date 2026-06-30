-- Ensure RLS policies allow upsert on tenant_data for platform records
-- (saas-global tenant_id used by all admin platform data)

ALTER TABLE public.tenant_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_data' AND policyname='tenant_data_select') THEN
    EXECUTE 'CREATE POLICY tenant_data_select ON public.tenant_data FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_data' AND policyname='tenant_data_insert') THEN
    EXECUTE 'CREATE POLICY tenant_data_insert ON public.tenant_data FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_data' AND policyname='tenant_data_update') THEN
    EXECUTE 'CREATE POLICY tenant_data_update ON public.tenant_data FOR UPDATE USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_data' AND policyname='tenant_data_delete') THEN
    EXECUTE 'CREATE POLICY tenant_data_delete ON public.tenant_data FOR DELETE USING (true)';
  END IF;
END $$;

-- Verify constraint exists
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'public.tenant_data'::regclass 
AND contype = 'u';
