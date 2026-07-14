-- Enforce the product rule: one account may be active on at most two devices.
-- A third device receives a clear reason and must not silently replace another.
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
    return jsonb_build_object('allowed', false, 'reason_code', 'account_inactive', 'reason', 'This account is not active.');
  end if;

  -- Remove only abandoned sessions. A healthy client sends a heartbeat every
  -- five minutes, so fifteen minutes means the browser is no longer connected.
  update public.user_sessions
  set is_active = false, logout_at = coalesce(logout_at, now()), updated_at = now()
  where user_id = v_user.id
    and is_active
    and last_activity_at < now() - interval '15 minutes';

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
    return jsonb_build_object(
      'allowed', false,
      'reason_code', 'device_limit',
      'reason', 'This account is open on two devices. Log out from one device, then try again.'
    );
  end if;

  insert into public.user_sessions (user_id, tenant_id, device_id, device_label, user_agent, account_type, role_key)
  values (v_user.id, v_user.tenant_id, p_device_id, p_device_label, p_user_agent, v_user.account_type, coalesce(v_user.role_key, v_user.role))
  returning * into v_session;
  return jsonb_build_object('allowed', true, 'session_id', v_session.id);
end;
$$;

grant execute on function public.start_user_session(text, text, text) to authenticated;
