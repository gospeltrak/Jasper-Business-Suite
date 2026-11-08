-- Isolated PostgreSQL-only ACL smoke fixture. Never run against production.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS public;
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
 LANGUAGE plpgsql AS $fn$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $fn$;
DO $$
DECLARE sig text;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'activate_current_tenant_primary_branch()',
 'complete_affiliate_task(uuid)',
 'configure_multibranch_rollout(boolean,text)',
 'configure_tenant_branch_capacity(uuid,integer,boolean,text)',
 'convert_cross_branch_document_to_sales(uuid,text)',
 'create_affiliate_commission_from_revenue(uuid,numeric,uuid,date,date)',
 'create_cross_branch_commercial_document(jsonb)',
 'create_current_tenant_branch(text,text,text,text,text,text,text,text,text,text,text,date,uuid)',
 'end_user_session(uuid)',
 'get_current_branch_context()',
 'get_current_branch_entitlement()',
 'list_cross_branch_document_sources()',
 'list_current_user_branches()',
 'provision_primary_branch_for_new_tenant(uuid,uuid)',
 'record_affiliate_activity(text,text,uuid,jsonb)',
 'record_partner_affiliate_action(uuid,text,jsonb)',
 'select_current_branch(uuid,text)',
 'touch_user_session(uuid)',
 'update_cross_branch_commercial_document(uuid,jsonb)',
 'update_current_sales_document(uuid,jsonb)'
 ]
 LOOP
   EXECUTE format('CREATE FUNCTION public.%s RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS $body$ BEGIN NULL; END $body$',sig);
   EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role',sig);
 END LOOP;
END $$;
