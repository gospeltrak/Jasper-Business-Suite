-- ==========================================
-- 1. CLEANUP SEED DATA
-- ==========================================
-- To add a foreign key to auth.users, any existing users in public.users MUST exist in auth.users.
-- Since the dummy admin (e.g. 22222222-...) doesn't exist in auth.users, we must delete it first.
-- You can create a real user through the new signup flow later.
DELETE FROM public.users WHERE id NOT IN (SELECT id FROM auth.users);

-- ==========================================
-- 2. ALTER STRUCTURE
-- ==========================================
-- Drop the default UUID generation, so we explicitly rely on auth.users ID
ALTER TABLE public.users 
  ALTER COLUMN id DROP DEFAULT;

-- Add the foreign key referencing Supabase's native auth.users table
ALTER TABLE public.users 
  ADD CONSTRAINT users_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- ==========================================
-- 3. AUTOMATION (OPTIONAL BUT RECOMMENDED)
-- ==========================================
-- If you want Supabase to automatically insert a user into 'public.users' 
-- whenever someone signs up, you typically use a trigger. 
-- However, since your app requires setting 'tenant_id', it's better to manage 
-- both the Tenant and User creation inside a transaction or a backend endpoint (see server.ts).
