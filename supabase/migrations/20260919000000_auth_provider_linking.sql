-- Migration to support professional authentication linking
-- Add auth_provider to track registration method and prevent duplicates
alter table public.users 
  add column if not exists auth_provider text default 'password';

-- Index for fast lookup by email to prevent duplicates efficiently
create index if not exists idx_users_email_normalized 
  on public.users (lower(trim(email)));
