-- Disposable PostgreSQL 17 fixture; no real user state or tokens.
INSERT INTO public.tenant_data(tenant_id,data_key,payload) VALUES
 ('11111111-1111-1111-1111-111111111111','application_state',
 '{"jasper_settings_local":"{\"theme\":\"emerald\",\"units\":[\"kg\",\"pcs\"]}",
   "jasper_platform_banner":"data:image/png;base64,AAEC",
   "demo_empty":"",
   "literal_null":"null"}'::jsonb),
 ('22222222-2222-2222-2222-222222222222','application_state',
 '{"jasper_settings_local":"{\"theme\":\"light\"}","draft":"testing"}'::jsonb);
-- Verify original every tenant's legacy app state is never overwritten.
CREATE TABLE public.ci_original_app_state AS
SELECT tenant_id,md5(payload::text) payload_hash
FROM public.tenant_data WHERE data_key='application_state';
