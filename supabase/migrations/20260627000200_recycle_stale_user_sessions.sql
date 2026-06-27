-- Prevent abandoned browser/login attempts from locking users out.
-- A new verified login keeps the latest two sessions by retiring the oldest one.
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
  v_recycled_count integer := 0;
begin
  select * into v_user from public.users where id = auth.uid() limit 1;
  if not found or not v_user.is_active then
    return jsonb_build_object('allowed', false, 'reason', 'Account is not active.');
  end if;

  update public.user_sessions
  set is_active = false, logout_at = coalesce(logout_at, now()), updated_at = now()
  where user_id = v_user.id
    and is_active
    and last_activity_at < now() - interval '6 minutes';

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
    with retired as (
      select id
      from public.user_sessions
      where user_id = v_user.id and is_active
      order by last_activity_at asc nulls first
      limit greatest(v_active_count - 1, 1)
    )
    update public.user_sessions s
    set is_active = false, logout_at = coalesce(s.logout_at, now()), updated_at = now()
    from retired
    where s.id = retired.id;

    get diagnostics v_recycled_count = row_count;
  end if;

  insert into public.user_sessions (user_id, tenant_id, device_id, device_label, user_agent, account_type, role_key)
  values (v_user.id, v_user.tenant_id, p_device_id, p_device_label, p_user_agent, v_user.account_type, coalesce(v_user.role_key, v_user.role))
  returning * into v_session;
  return jsonb_build_object('allowed', true, 'session_id', v_session.id, 'recycled_sessions', v_recycled_count);
end;
$$;

grant execute on function public.start_user_session(text, text, text) to authenticated;
