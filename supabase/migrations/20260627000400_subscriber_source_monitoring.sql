-- Subscriber source tracking and agent-monitoring source of truth.
-- No demo rows are inserted. Existing records remain valid.

create table if not exists public.affiliate_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  phone_whatsapp text,
  nida_number text,
  tin_number text,
  mobile_money_number text,
  mobile_money_provider text,
  agent_code text not null unique,
  agent_link text not null,
  status text not null default 'active' check (status in ('active', 'pending', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.affiliate_agents (
  user_id,
  display_name,
  phone_whatsapp,
  mobile_money_number,
  agent_code,
  agent_link,
  status
)
select distinct
  u.id,
  coalesce(nullif(u.name, ''), nullif(u.email, ''), 'Affiliate Agent'),
  nullif(coalesce(u.phone, u.username_phone), ''),
  nullif(coalesce(u.phone, u.username_phone), ''),
  'AGENT-' || upper(substr(replace(u.id::text, '-', ''), 1, 8)),
  '/affiliate/register?agent=' || lower('AGENT-' || substr(replace(u.id::text, '-', ''), 1, 8)),
  case when u.is_active then 'active' else 'suspended' end
from public.users u
where exists (
  select 1
  from public.affiliate_agent_assignments assignment
  where assignment.agent_user_id = u.id
    and assignment.ended_at is null
)
on conflict (user_id) do nothing;

create table if not exists public.subscriber_source_tracking (
  id uuid primary key default gen_random_uuid(),
  subscriber_user_id uuid references public.users(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  source_type text not null default 'unknown',
  referral_code_used text,
  promo_code_used text,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  agent_id uuid references public.users(id) on delete set null,
  sub_affiliate_id uuid references public.affiliates(id) on delete set null,
  parent_agent_id uuid references public.users(id) on delete set null,
  subscription_id text,
  revenue_generated numeric(14, 2) not null default 0,
  status text not null default 'registered',
  registration_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_user_id)
);

alter table public.subscriber_source_tracking
  drop constraint if exists subscriber_source_tracking_source_type_check;
alter table public.subscriber_source_tracking
  add constraint subscriber_source_tracking_source_type_check
  check (source_type in ('organic', 'organic_affiliate', 'sub_affiliate', 'unknown', 'untracked'));

create index if not exists subscriber_source_type_idx
  on public.subscriber_source_tracking (source_type, created_at desc);
create index if not exists subscriber_source_affiliate_idx
  on public.subscriber_source_tracking (affiliate_id, created_at desc)
  where affiliate_id is not null;
create index if not exists subscriber_source_agent_idx
  on public.subscriber_source_tracking (agent_id, created_at desc)
  where agent_id is not null;
create index if not exists subscriber_source_sub_affiliate_idx
  on public.subscriber_source_tracking (sub_affiliate_id, created_at desc)
  where sub_affiliate_id is not null;

insert into public.subscriber_source_tracking (
  subscriber_user_id,
  tenant_id,
  source_type,
  referral_code_used,
  promo_code_used,
  affiliate_id,
  agent_id,
  sub_affiliate_id,
  parent_agent_id,
  revenue_generated,
  status,
  registration_source,
  created_at
)
select
  referral.registered_user_id,
  referral.registered_tenant_id,
  case
    when affiliate.affiliate_type = 'sub_affiliate' then 'sub_affiliate'
    when affiliate.affiliate_type = 'organic' then 'organic_affiliate'
    else 'unknown'
  end,
  referral.referral_code,
  referral.promo_code_used,
  referral.affiliate_id,
  referral.agent_id,
  referral.sub_affiliate_id,
  referral.agent_id,
  coalesce(referral.revenue_generated, 0),
  referral.status,
  coalesce(referral.registration_source, referral.source),
  coalesce(referral.registered_at, referral.created_at, now())
from public.affiliate_referrals referral
left join public.affiliates affiliate on affiliate.id = referral.affiliate_id
where referral.registered_user_id is not null
on conflict (subscriber_user_id) do nothing;

alter table public.affiliate_agents enable row level security;
alter table public.subscriber_source_tracking enable row level security;

drop policy if exists affiliate_agents_platform_or_self_read on public.affiliate_agents;
create policy affiliate_agents_platform_or_self_read on public.affiliate_agents for select to authenticated
  using (private.is_platform_admin() or user_id = auth.uid());

drop policy if exists affiliate_agents_platform_manage on public.affiliate_agents;
create policy affiliate_agents_platform_manage on public.affiliate_agents for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists subscriber_source_platform_or_scoped_read on public.subscriber_source_tracking;
create policy subscriber_source_platform_or_scoped_read on public.subscriber_source_tracking for select to authenticated
  using (
    private.is_platform_admin()
    or subscriber_user_id = auth.uid()
    or affiliate_id = private.current_affiliate_id()
    or sub_affiliate_id = private.current_affiliate_id()
    or agent_id = auth.uid()
  );

drop policy if exists subscriber_source_platform_manage on public.subscriber_source_tracking;
create policy subscriber_source_platform_manage on public.subscriber_source_tracking for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
