alter table public.affiliate_tasks
  add column if not exists sender_name text;

alter table public.affiliate_meetings
  add column if not exists host_name text;
