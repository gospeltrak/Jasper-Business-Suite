begin;

-- A payment approval may only activate the exact package selected when the
-- tenant submitted the receipt. The tenant row is updated earlier in the same
-- activation transaction, so any mismatch raises and rolls back every change.
create or replace function private.enforce_payment_proof_package_activation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_active_package_id text;
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    select lower(coalesce(tenant.active_package_id, tenant.subscription_plan, ''))
    into v_active_package_id
    from public.tenants as tenant
    where tenant.id = new.tenant_id;

    if v_active_package_id is distinct from lower(new.requested_package_id) then
      raise exception using
        errcode = '22023',
        message = 'The activated package must match the package on the payment proof.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_payment_proof_package_activation on public.tenant_payment_proofs;
create trigger lock_payment_proof_package_activation
before update of status on public.tenant_payment_proofs
for each row execute function private.enforce_payment_proof_package_activation();

revoke all on function private.enforce_payment_proof_package_activation() from public;

commit;
