begin;

-- Lets a platform admin push an in-app notification to one or more tenants,
-- landing in the same real, server-authorized inbox tenants already read
-- from (branch_notification_events / branch_notification_recipients --
-- see 20260722000600_multibranch_audit_notifications_reporting.sql). All
-- users of each target tenant receive it, delivered immediately.

drop function if exists public.super_admin_send_notification(uuid[], text, text, text);

create function public.super_admin_send_notification(
  p_tenant_ids uuid[],
  p_title text,
  p_message text,
  p_priority text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_now timestamptz := transaction_timestamp();
  v_title text := nullif(btrim(p_title), '');
  v_message text := nullif(btrim(p_message), '');
  v_priority text := lower(coalesce(nullif(btrim(p_priority), ''), 'normal'));
  v_tenant_id uuid;
  v_event_id uuid;
  v_tenant_count integer := 0;
  v_recipient_count integer := 0;
  v_sent_tenant_ids uuid[] := '{}';
begin
  if v_actor_id is null or not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform administrator access is required.';
  end if;
  if p_tenant_ids is null or array_length(p_tenant_ids, 1) is null then
    raise exception using errcode = '22023', message = 'At least one target tenant is required.';
  end if;
  if array_length(p_tenant_ids, 1) > 5000 then
    raise exception using errcode = '22023', message = 'Too many target tenants in a single request.';
  end if;
  if v_title is null or v_message is null then
    raise exception using errcode = '22023', message = 'A title and message are required.';
  end if;
  if v_priority not in ('low', 'normal', 'high', 'critical') then
    v_priority := 'normal';
  end if;

  for v_tenant_id in select distinct t from unnest(p_tenant_ids) as t loop
    if not exists (select 1 from public.tenants where id = v_tenant_id) then
      continue;
    end if;

    insert into public.branch_notification_events (
      tenant_id, event_type, module_name, title, message, entity_type, priority, created_by
    ) values (
      v_tenant_id, 'admin_message', 'system', v_title, v_message, 'admin_message', v_priority, v_actor_id
    )
    returning id into v_event_id;

    insert into public.branch_notification_recipients (
      tenant_id, event_id, recipient_user_id, delivery_channel, delivery_status, delivered_at
    )
    select v_tenant_id, v_event_id, u.id, 'in_app', 'delivered', v_now
    from public.users as u
    where u.tenant_id = v_tenant_id;

    get diagnostics v_recipient_count = row_count;
    v_tenant_count := v_tenant_count + 1;
    v_sent_tenant_ids := array_append(v_sent_tenant_ids, v_tenant_id);
  end loop;

  return jsonb_build_object(
    'tenantsSent', v_tenant_count,
    'sentTenantIds', to_jsonb(v_sent_tenant_ids)
  );
end;
$$;

revoke all on function public.super_admin_send_notification(uuid[], text, text, text)
  from public, anon;
grant execute on function public.super_admin_send_notification(uuid[], text, text, text)
  to authenticated;

commit;
