-- Additive branch identity editor. No tenant workspace, stock, ledger, sale,
-- invoice, payment account, or historical record is rewritten.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.update_current_tenant_branch_profile(
  p_branch_id uuid,
  p_address text,
  p_phone text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_branch public.branches%rowtype;
begin
  select app_user.tenant_id
  into v_tenant_id
  from public.users as app_user
  where app_user.id = v_actor_id
    and app_user.is_active
  limit 1;

  if v_tenant_id is null
    or not private.can_write_branch(v_tenant_id, p_branch_id, 'branches.manage')
  then
    raise exception 'Branch profile access denied.' using errcode = '42501';
  end if;

  if char_length(coalesce(btrim(p_address), '')) > 500
    or char_length(coalesce(btrim(p_phone), '')) > 40
    or char_length(coalesce(btrim(p_email), '')) > 254
  then
    raise exception 'One or more branch details exceed the allowed length.' using errcode = '22023';
  end if;

  if nullif(btrim(p_email), '') is not null
    and lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'A valid branch email address is required.' using errcode = '22023';
  end if;

  update public.branches as branch
  set address = nullif(btrim(p_address), ''),
      phone = nullif(btrim(p_phone), ''),
      email = nullif(lower(btrim(p_email)), ''),
      updated_at = now()
  where branch.tenant_id = v_tenant_id
    and branch.id = p_branch_id
    and branch.archived_at is null
  returning branch.* into v_branch;

  if v_branch.id is null then
    raise exception 'Branch not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_branch.id,
    'tenantId', v_branch.tenant_id,
    'address', v_branch.address,
    'phone', v_branch.phone,
    'email', v_branch.email,
    'updatedAt', v_branch.updated_at
  );
end;
$$;

revoke all on function public.update_current_tenant_branch_profile(uuid, text, text, text)
  from public, anon;
grant execute on function public.update_current_tenant_branch_profile(uuid, text, text, text)
  to authenticated;

commit;
