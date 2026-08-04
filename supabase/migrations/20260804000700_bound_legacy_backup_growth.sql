-- Bound future application-level backup growth while preserving every existing
-- backup row. Older timestamped rows become an immutable legacy archive for
-- authenticated browser clients.

begin;

create table if not exists public.tenant_data_archive_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  captured_at timestamptz not null default now(),
  backup_row_count bigint not null,
  live_row_count bigint not null,
  oldest_backup_at timestamptz,
  newest_backup_at timestamptz,
  key_prefix_counts jsonb not null default '{}'::jsonb
);

create index if not exists tenant_data_archive_snapshots_tenant_time_idx
  on public.tenant_data_archive_snapshots (tenant_id, captured_at desc);

alter table public.tenant_data_archive_snapshots enable row level security;
alter table public.tenant_data_archive_snapshots force row level security;
revoke all on table public.tenant_data_archive_snapshots
  from public, anon, authenticated, service_role;
grant select, insert on table public.tenant_data_archive_snapshots to service_role;

insert into public.tenant_data_archive_snapshots (
  tenant_id,
  backup_row_count,
  live_row_count,
  oldest_backup_at,
  newest_backup_at,
  key_prefix_counts
)
select
  tenant_id,
  count(*) filter (
    where data_key like 'data_backup_%'
       or data_key like 'workspace_backup_%'
       or data_key like 'manual_backup_%'
       or data_key like '%recovery_backup%'
  ),
  count(*) filter (
    where not (
      data_key like 'data_backup_%'
      or data_key like 'workspace_backup_%'
      or data_key like 'manual_backup_%'
      or data_key like '%recovery_backup%'
    )
  ),
  min(updated_at) filter (
    where data_key like 'data_backup_%'
       or data_key like 'workspace_backup_%'
       or data_key like 'manual_backup_%'
       or data_key like '%recovery_backup%'
  ),
  max(updated_at) filter (
    where data_key like 'data_backup_%'
       or data_key like 'workspace_backup_%'
       or data_key like 'manual_backup_%'
       or data_key like '%recovery_backup%'
  ),
  jsonb_build_object(
    'dataBackup', count(*) filter (where data_key like 'data_backup_%'),
    'workspaceBackup', count(*) filter (where data_key like 'workspace_backup_%'),
    'manualBackup', count(*) filter (where data_key like 'manual_backup_%'),
    'recoveryBackup', count(*) filter (where data_key like '%recovery_backup%')
  )
from public.tenant_data
group by tenant_id;

create or replace function private.bound_tenant_data_backup_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_key text;
begin
  if new.data_key like 'data_backup_%'
    and new.data_key not like 'data_backup_latest_%'
  then
    v_source_key := nullif(btrim(new.payload ->> 'sourceDataKey'), '');
    v_source_key := coalesce(
      regexp_replace(v_source_key, '[^a-zA-Z0-9_-]+', '_', 'g'),
      'legacy'
    );
    new.data_key := 'data_backup_latest_' || left(v_source_key, 120);
  elsif new.data_key like 'workspace_backup_%'
    and new.data_key <> 'workspace_backup_latest'
  then
    new.data_key := 'workspace_backup_latest';
  end if;
  return new;
end;
$$;

create or replace function private.protect_legacy_tenant_data_backup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    old.data_key like 'data_backup_%'
      and old.data_key not like 'data_backup_latest_%'
  ) or (
    old.data_key like 'workspace_backup_%'
      and old.data_key <> 'workspace_backup_latest'
  ) or old.data_key like 'manual_backup_%'
    or old.data_key like '%recovery_backup%'
  then
    if coalesce((select auth.role()), 'postgres') not in ('service_role', 'postgres') then
      raise exception using
        errcode = '42501',
        message = 'Legacy backup rows are immutable.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists bound_tenant_data_backup_key_before_insert
  on public.tenant_data;
create trigger bound_tenant_data_backup_key_before_insert
before insert on public.tenant_data
for each row execute function private.bound_tenant_data_backup_key();

drop trigger if exists protect_legacy_tenant_data_backup_before_change
  on public.tenant_data;
create trigger protect_legacy_tenant_data_backup_before_change
before update or delete on public.tenant_data
for each row execute function private.protect_legacy_tenant_data_backup();

commit;
