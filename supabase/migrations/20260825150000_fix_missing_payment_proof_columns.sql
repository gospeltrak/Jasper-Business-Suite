-- tenant_payment_proofs was designed assuming tenant_name and
-- rejected_reason columns (server.ts's insert/update code and the
-- platform_payment_proof_notification trigger both reference them), but
-- neither was ever actually added to the tracked table definition. This
-- broke every payment submission, approval, and rejection with
-- "Could not find the 'tenant_name' column ... in the schema cache" the
-- moment a real tenant tried to pay.

begin;

alter table public.tenant_payment_proofs
  add column if not exists tenant_name text,
  add column if not exists rejected_reason text;

-- Backfill tenant_name for any rows already sitting in the table so the
-- admin approvals list and the notification trigger have something to show.
update public.tenant_payment_proofs as proof
set tenant_name = tenant.name
from public.tenants as tenant
where tenant.id = proof.tenant_id
  and proof.tenant_name is null;

commit;
