
-- Orvix Pro: isolated shift-audit workflow. No treasury postings or sales
-- reconciliation are implied by these records.
create table if not exists public.orvix_pro_shift_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  cashier_id uuid not null references public.users(id) on delete restrict,
  cashier_name text not null,
  currency_code text not null default 'TZS',
  opening_float numeric(18,2) not null check (opening_float >= 0),
  counted_cash numeric(18,2) check (counted_cash is null or counted_cash >= 0),
  status text not null default 'open' check (status in ('open','submitted','reviewed','flagged')),
  opened_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete restrict,
  review_note text,
  cashier_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pro_shift_submitted_count check ((status='open' and counted_cash is null and submitted_at is null) or (status<>'open' and counted_cash is not null and submitted_at is not null)),
  constraint pro_shift_review_stamp check ((status in ('open','submitted') and reviewed_at is null and reviewed_by is null) or (status in ('reviewed','flagged') and reviewed_at is not null and reviewed_by is not null))
);
create unique index if not exists orvix_pro_one_open_shift_per_cashier
  on public.orvix_pro_shift_sessions(tenant_id,branch_id,cashier_id) where status = 'open';
create index if not exists orvix_pro_shift_scope_history
  on public.orvix_pro_shift_sessions(tenant_id,branch_id,opened_at desc);

create table if not exists public.orvix_pro_shift_audit (
 id uuid primary key default gen_random_uuid(),
 shift_id uuid not null references public.orvix_pro_shift_sessions(id) on delete restrict,
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 branch_id uuid not null references public.branches(id) on delete restrict,
 actor_id uuid not null references public.users(id) on delete restrict,
 event_type text not null check(event_type in ('opened','cash_count_submitted','review_approved','review_flagged')),
 snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists orvix_pro_audit_shift
 on public.orvix_pro_shift_audit(shift_id,created_at);
alter table public.orvix_pro_shift_sessions enable row level security;
alter table public.orvix_pro_shift_sessions force row level security;
alter table public.orvix_pro_shift_audit enable row level security;
alter table public.orvix_pro_shift_audit force row level security;
revoke all on public.orvix_pro_shift_sessions from public,anon,authenticated;
revoke all on public.orvix_pro_shift_audit from public,anon,authenticated;
comment on table public.orvix_pro_shift_sessions is 'Opt-in Pro manual shift opening and cash count audit; not a verified treasury or sales reconciliation.';
comment on column public.orvix_pro_shift_sessions.counted_cash is 'Physical cash declared by cashier; not independently verified and does not move funds.';

-- Every state transition and its audit row are committed in the same DB transaction.
create or replace function private.capture_orvix_pro_shift_audit()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  event_label text;
  acting_user uuid;
begin
  if TG_OP='INSERT' then
    event_label := 'opened';
    acting_user := NEW.cashier_id;
  elsif NEW.status is distinct from OLD.status then
    event_label := case NEW.status
      when 'submitted' then 'cash_count_submitted'
      when 'reviewed' then 'review_approved'
      when 'flagged' then 'review_flagged'
      else null
    end;
    acting_user := coalesce(NEW.reviewed_by,NEW.cashier_id);
  else
    raise exception 'Orvix Pro shifts are immutable outside state transitions';
  end if;
  if event_label is null then raise exception 'Unexpected Orvix Pro shift transition'; end if;
  insert into public.orvix_pro_shift_audit
    (shift_id,tenant_id,branch_id,actor_id,event_type,snapshot)
  values (NEW.id,NEW.tenant_id,NEW.branch_id,acting_user,event_label,
    jsonb_build_object('status',NEW.status,'opening_float',NEW.opening_float,
      'counted_cash',NEW.counted_cash,'opened_at',NEW.opened_at,
      'submitted_at',NEW.submitted_at,'reviewed_at',NEW.reviewed_at));
  return NEW;
end; $$;
revoke all on function private.capture_orvix_pro_shift_audit() from public,anon,authenticated;
drop trigger if exists trg_orvix_pro_shift_audit on public.orvix_pro_shift_sessions;
create trigger trg_orvix_pro_shift_audit after insert or update
on public.orvix_pro_shift_sessions for each row
execute function private.capture_orvix_pro_shift_audit();
