-- Additive login lookup indexes.
-- These indexes do not update or remove tenant/user data.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create index if not exists users_phone_active_lookup_idx
  on public.users (phone, is_active)
  include (email, tenant_id, account_type, role_key)
  where phone is not null;

create index if not exists users_name_id_idx
  on public.users (name, id);

commit;
