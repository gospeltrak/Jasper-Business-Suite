-- Unified internal account metadata and two-device session control.
alter table public.users
  add column if not exists account_type text not null default 'business_user',
  add column if not exists username_phone text,
  add column if not exists role_key text,
  add column if not exists role_permissions jsonb not null default '{}'::jsonb,
  add column if not exists profile_image_url text,
  add column if not exists signature_url text,
  add column if not exists is_active boolean not null default true;

update public.users
set username_phone = coalesce(nullif(trim(phone), ''), username_phone)
where username_phone is null;

update public.users
set role_key = coalesce(nullif(trim(role), ''), role_key, 'business_user')
where role_key is null;

create unique index if not exists users_username_phone_unique
  on public.users (username_phone)
  where username_phone is not null;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  device_id text not null,
  device_label text,
  user_agent text,
  ip_hint text,
  account_type text not null,
  role_key text,
  login_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  logout_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_sessions_active_device_unique
  on public.user_sessions (user_id, device_id)
  where is_active;
create index if not exists user_sessions_active_user_idx
  on public.user_sessions (user_id, last_activity_at desc)
  where is_active;

alter table public.user_sessions enable row level security;
alter table public.user_sessions force row level security;
drop policy if exists user_sessions_read_own on public.user_sessions;
create policy user_sessions_read_own on public.user_sessions
  for select to authenticated using (user_id = auth.uid());

create or replace function public.start_user_session(
  p_device_id text,
  p_device_label text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_session public.user_sessions%rowtype;
  v_active_count integer;
begin
  select * into v_user from public.users where id = auth.uid() limit 1;
  if not found or not v_user.is_active then
    return jsonb_build_object('allowed', false, 'reason', 'Account is not active.');
  end if;

  update public.user_sessions
  set is_active = false, logout_at = coalesce(logout_at, now()), updated_at = now()
  where user_id = v_user.id
    and is_active
    and last_activity_at < now() - interval '30 minutes';

  select * into v_session
  from public.user_sessions
  where user_id = v_user.id and device_id = p_device_id and is_active
  limit 1;

  if found then
    update public.user_sessions
    set last_activity_at = now(), device_label = p_device_label, user_agent = p_user_agent, updated_at = now()
    where id = v_session.id
    returning * into v_session;
    return jsonb_build_object('allowed', true, 'session_id', v_session.id);
  end if;

  select count(*) into v_active_count
  from public.user_sessions
  where user_id = v_user.id and is_active;

  if v_active_count >= 2 then
    return jsonb_build_object('allowed', false, 'reason', 'This account is already active on two devices. Please log out from another device first.');
  end if;

  insert into public.user_sessions (user_id, tenant_id, device_id, device_label, user_agent, account_type, role_key)
  values (v_user.id, v_user.tenant_id, p_device_id, p_device_label, p_user_agent, v_user.account_type, coalesce(v_user.role_key, v_user.role))
  returning * into v_session;
  return jsonb_build_object('allowed', true, 'session_id', v_session.id);
end;
$$;

create or replace function public.touch_user_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_sessions
  set last_activity_at = now(), updated_at = now()
  where id = p_session_id and user_id = auth.uid() and is_active;
  return found;
end;
$$;

create or replace function public.end_user_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_sessions
  set is_active = false, logout_at = now(), updated_at = now()
  where id = p_session_id and user_id = auth.uid() and is_active;
  return found;
end;
$$;

revoke all on function public.start_user_session(text, text, text) from public;
revoke all on function public.touch_user_session(uuid) from public;
revoke all on function public.end_user_session(uuid) from public;
grant execute on function public.start_user_session(text, text, text) to authenticated;
grant execute on function public.touch_user_session(uuid) to authenticated;
grant execute on function public.end_user_session(uuid) to authenticated;
