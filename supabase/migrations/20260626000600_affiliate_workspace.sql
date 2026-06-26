-- Database-backed affiliate workspace. No demo records are inserted here.
-- Every row is scoped to its affiliate, assigned agent, or platform administrator.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and is_active
      and (
        account_type in ('super_admin', 'admin')
        or lower(coalesce(role_key, role, '')) in ('superadmin', 'super_admin', 'admin')
      )
  );
$$;

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  referral_code text not null,
  referral_slug text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'pending')),
  payout_method text,
  payout_account text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referral_code),
  unique (referral_slug)
);

create table if not exists public.affiliate_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_group_memberships (
  group_id uuid not null references public.affiliate_groups(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, affiliate_id)
);

create table if not exists public.affiliate_agent_assignments (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  agent_user_id uuid not null references public.users(id) on delete cascade,
  is_primary boolean not null default true,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (affiliate_id, agent_user_id)
);

create unique index if not exists affiliate_agent_one_primary_idx
  on public.affiliate_agent_assignments (affiliate_id)
  where is_primary and ended_at is null;
create index if not exists affiliate_agent_agent_idx
  on public.affiliate_agent_assignments (agent_user_id, affiliate_id)
  where ended_at is null;

create or replace function private.current_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.affiliates where user_id = auth.uid() limit 1;
$$;

create or replace function private.is_assigned_affiliate_agent(p_affiliate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.affiliate_agent_assignments assignment
    where assignment.affiliate_id = p_affiliate_id
      and assignment.agent_user_id = auth.uid()
      and assignment.ended_at is null
  );
$$;

create or replace function private.is_affiliate_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.affiliate_group_memberships membership
    join public.affiliates affiliate on affiliate.id = membership.affiliate_id
    where membership.group_id = p_group_id
      and affiliate.user_id = auth.uid()
  );
$$;

create or replace function private.is_group_affiliate_agent(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.affiliate_group_memberships membership
    join public.affiliate_agent_assignments assignment
      on assignment.affiliate_id = membership.affiliate_id
    where membership.group_id = p_group_id
      and assignment.agent_user_id = auth.uid()
      and assignment.ended_at is null
  );
$$;

revoke all on function private.is_platform_admin() from public;
revoke all on function private.current_affiliate_id() from public;
revoke all on function private.is_assigned_affiliate_agent(uuid) from public;
revoke all on function private.is_affiliate_group_member(uuid) from public;
revoke all on function private.is_group_affiliate_agent(uuid) from public;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.current_affiliate_id() to authenticated;
grant execute on function private.is_assigned_affiliate_agent(uuid) to authenticated;
grant execute on function private.is_affiliate_group_member(uuid) to authenticated;
grant execute on function private.is_group_affiliate_agent(uuid) to authenticated;

create table if not exists public.affiliate_tasks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  group_id uuid references public.affiliate_groups(id) on delete cascade,
  assigned_by uuid not null references public.users(id) on delete restrict,
  title text not null,
  body text,
  task_type text not null default 'task' check (task_type in ('task', 'note', 'instruction')),
  status text not null default 'new' check (status in ('new', 'pending', 'completed', 'reviewed')),
  due_at timestamptz,
  attachment_url text,
  attachment_name text,
  attachment_mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_task_target_check check ((affiliate_id is not null) <> (group_id is not null))
);

create table if not exists public.affiliate_meetings (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  group_id uuid references public.affiliate_groups(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  title text not null,
  notes text,
  meeting_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_meeting_target_check check ((affiliate_id is not null) <> (group_id is not null))
);

create table if not exists public.affiliate_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id) on delete restrict,
  campaign_name text not null,
  title text not null,
  description text,
  recommended_caption text,
  media_url text not null,
  media_name text,
  media_mime_type text,
  media_size_bytes bigint,
  duration_seconds integer,
  campaign_url text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_ad_assignments (
  campaign_id uuid not null references public.affiliate_ad_campaigns(id) on delete cascade,
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  group_id uuid references public.affiliate_groups(id) on delete cascade,
  assigned_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (campaign_id, affiliate_id, group_id),
  constraint affiliate_ad_assignment_target_check check ((affiliate_id is not null) <> (group_id is not null))
);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referral_code text not null,
  registered_tenant_id uuid references public.tenants(id) on delete set null,
  registered_user_id uuid references public.users(id) on delete set null,
  status text not null default 'clicked' check (status in ('clicked', 'registered', 'converted', 'cancelled')),
  source text,
  clicked_at timestamptz,
  registered_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referral_id uuid references public.affiliate_referrals(id) on delete set null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'TZS',
  commission_rate numeric(7, 4),
  status text not null default 'pending' check (status in ('pending', 'available', 'paid', 'void')),
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  available_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'TZS',
  payout_method text,
  payout_reference text,
  status text not null default 'requested' check (status in ('requested', 'processing', 'paid', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_activity_events (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  event_type text not null check (event_type in ('referral_click', 'ad_view', 'ad_download', 'campaign_link_copy', 'task_download', 'meeting_join')),
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_tasks_target_idx on public.affiliate_tasks (affiliate_id, status, created_at desc);
create index if not exists affiliate_tasks_group_idx on public.affiliate_tasks (group_id, status, created_at desc);
create index if not exists affiliate_meetings_target_idx on public.affiliate_meetings (affiliate_id, starts_at desc);
create index if not exists affiliate_meetings_group_idx on public.affiliate_meetings (group_id, starts_at desc);
create index if not exists affiliate_ad_assignments_affiliate_idx on public.affiliate_ad_assignments (affiliate_id, campaign_id);
create index if not exists affiliate_ad_assignments_group_idx on public.affiliate_ad_assignments (group_id, campaign_id);
create index if not exists affiliate_referrals_affiliate_idx on public.affiliate_referrals (affiliate_id, status, created_at desc);
create index if not exists affiliate_commissions_affiliate_idx on public.affiliate_commissions (affiliate_id, status, created_at desc);
create index if not exists affiliate_payouts_affiliate_idx on public.affiliate_payouts (affiliate_id, status, requested_at desc);
create index if not exists affiliate_activity_events_affiliate_idx on public.affiliate_activity_events (affiliate_id, event_type, created_at desc);

create or replace function private.can_access_affiliate_target(p_affiliate_id uuid, p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_platform_admin()
    or (p_affiliate_id is not null and p_affiliate_id = private.current_affiliate_id())
    or (p_group_id is not null and private.is_affiliate_group_member(p_group_id))
    or (p_affiliate_id is not null and private.is_assigned_affiliate_agent(p_affiliate_id))
    or (p_group_id is not null and private.is_group_affiliate_agent(p_group_id));
$$;

create or replace function private.can_manage_affiliate_target(p_affiliate_id uuid, p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_platform_admin()
    or (p_affiliate_id is not null and private.is_assigned_affiliate_agent(p_affiliate_id))
    or (p_group_id is not null and private.is_group_affiliate_agent(p_group_id));
$$;

revoke all on function private.can_access_affiliate_target(uuid, uuid) from public;
revoke all on function private.can_manage_affiliate_target(uuid, uuid) from public;
grant execute on function private.can_access_affiliate_target(uuid, uuid) to authenticated;
grant execute on function private.can_manage_affiliate_target(uuid, uuid) to authenticated;

alter table public.affiliates enable row level security;
alter table public.affiliate_groups enable row level security;
alter table public.affiliate_group_memberships enable row level security;
alter table public.affiliate_agent_assignments enable row level security;
alter table public.affiliate_tasks enable row level security;
alter table public.affiliate_meetings enable row level security;
alter table public.affiliate_ad_campaigns enable row level security;
alter table public.affiliate_ad_assignments enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_activity_events enable row level security;

create policy affiliates_read_scoped on public.affiliates for select to authenticated
  using (user_id = auth.uid() or private.is_platform_admin() or private.is_assigned_affiliate_agent(id));
create policy affiliates_update_self_or_admin on public.affiliates for update to authenticated
  using (user_id = auth.uid() or private.is_platform_admin())
  with check (user_id = auth.uid() or private.is_platform_admin());
create policy affiliates_admin_insert on public.affiliates for insert to authenticated
  with check (private.is_platform_admin());

create policy affiliate_groups_admin_manage on public.affiliate_groups for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy affiliate_groups_member_or_agent_read on public.affiliate_groups for select to authenticated
  using (private.is_affiliate_group_member(id) or private.is_group_affiliate_agent(id));
create policy affiliate_group_memberships_scoped_read on public.affiliate_group_memberships for select to authenticated
  using (affiliate_id = private.current_affiliate_id() or private.is_assigned_affiliate_agent(affiliate_id) or private.is_platform_admin());
create policy affiliate_group_memberships_admin_manage on public.affiliate_group_memberships for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy affiliate_agent_assignments_scoped_read on public.affiliate_agent_assignments for select to authenticated
  using (affiliate_id = private.current_affiliate_id() or agent_user_id = auth.uid() or private.is_platform_admin());
create policy affiliate_agent_assignments_admin_manage on public.affiliate_agent_assignments for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy affiliate_tasks_scoped_read on public.affiliate_tasks for select to authenticated
  using (private.can_access_affiliate_target(affiliate_id, group_id));
create policy affiliate_tasks_agent_or_admin_create on public.affiliate_tasks for insert to authenticated
  with check (private.can_manage_affiliate_target(affiliate_id, group_id) and (private.is_platform_admin() or assigned_by = auth.uid()));
create policy affiliate_tasks_agent_or_admin_manage on public.affiliate_tasks for update to authenticated
  using (private.can_manage_affiliate_target(affiliate_id, group_id))
  with check (private.can_manage_affiliate_target(affiliate_id, group_id));

create policy affiliate_meetings_scoped_read on public.affiliate_meetings for select to authenticated
  using (private.can_access_affiliate_target(affiliate_id, group_id));
create policy affiliate_meetings_agent_or_admin_manage on public.affiliate_meetings for all to authenticated
  using (private.can_manage_affiliate_target(affiliate_id, group_id))
  with check (private.can_manage_affiliate_target(affiliate_id, group_id) and (private.is_platform_admin() or created_by = auth.uid()));

create policy affiliate_ad_campaigns_admin_manage on public.affiliate_ad_campaigns for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy affiliate_ad_campaigns_assigned_read on public.affiliate_ad_campaigns for select to authenticated
  using (exists (
    select 1 from public.affiliate_ad_assignments assignment
    where assignment.campaign_id = id
      and private.can_access_affiliate_target(assignment.affiliate_id, assignment.group_id)
  ));
create policy affiliate_ad_assignments_scoped_read on public.affiliate_ad_assignments for select to authenticated
  using (private.can_access_affiliate_target(affiliate_id, group_id));
create policy affiliate_ad_assignments_admin_manage on public.affiliate_ad_assignments for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy affiliate_referrals_scoped_read on public.affiliate_referrals for select to authenticated
  using (affiliate_id = private.current_affiliate_id() or private.is_platform_admin() or private.is_assigned_affiliate_agent(affiliate_id));
create policy affiliate_referrals_admin_manage on public.affiliate_referrals for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy affiliate_commissions_scoped_read on public.affiliate_commissions for select to authenticated
  using (affiliate_id = private.current_affiliate_id() or private.is_platform_admin() or private.is_assigned_affiliate_agent(affiliate_id));
create policy affiliate_commissions_admin_manage on public.affiliate_commissions for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy affiliate_payouts_scoped_read on public.affiliate_payouts for select to authenticated
  using (affiliate_id = private.current_affiliate_id() or private.is_platform_admin() or private.is_assigned_affiliate_agent(affiliate_id));
create policy affiliate_payouts_self_request on public.affiliate_payouts for insert to authenticated
  with check (affiliate_id = private.current_affiliate_id());
create policy affiliate_payouts_admin_manage on public.affiliate_payouts for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy affiliate_activity_events_self_insert on public.affiliate_activity_events for insert to authenticated
  with check (affiliate_id = private.current_affiliate_id());
create policy affiliate_activity_events_scoped_read on public.affiliate_activity_events for select to authenticated
  using (affiliate_id = private.current_affiliate_id() or private.is_platform_admin() or private.is_assigned_affiliate_agent(affiliate_id));

create or replace function public.complete_affiliate_task(p_task_id uuid)
returns public.affiliate_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.affiliate_tasks%rowtype;
begin
  select * into v_task
  from public.affiliate_tasks
  where id = p_task_id
    and (
      affiliate_id = private.current_affiliate_id()
      or (group_id is not null and private.is_affiliate_group_member(group_id))
    );
  if not found then
    raise exception 'Task is not assigned to this affiliate account';
  end if;

  update public.affiliate_tasks
  set status = 'completed', updated_at = now()
  where id = p_task_id
  returning * into v_task;
  return v_task;
end;
$$;

revoke all on function public.complete_affiliate_task(uuid) from public;
grant execute on function public.complete_affiliate_task(uuid) to authenticated;

create or replace function public.record_affiliate_activity(
  p_event_type text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_event_id uuid;
begin
  select private.current_affiliate_id() into v_affiliate_id;
  if v_affiliate_id is null then
    raise exception 'Affiliate account required';
  end if;

  insert into public.affiliate_activity_events (affiliate_id, event_type, resource_type, resource_id, metadata)
  values (v_affiliate_id, p_event_type, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_event_id;
  return v_event_id;
end;
$$;

revoke all on function public.record_affiliate_activity(text, text, uuid, jsonb) from public;
grant execute on function public.record_affiliate_activity(text, text, uuid, jsonb) to authenticated;
