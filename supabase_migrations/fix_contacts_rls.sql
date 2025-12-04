-- Fix RLS for contacts table to allow server-side inserts
-- This is needed when using NextAuth (not Supabase Auth)

-- Option 1: Disable RLS (simplest for server-side operations)
-- Uncomment the line below if you want to disable RLS entirely
-- ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;

-- Option 2: Create a policy that allows all operations (if using service role key)
-- This is safer than disabling RLS entirely
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

-- Create permissive policies for server-side operations
-- These allow the service role key to perform all operations
CREATE POLICY "Allow all operations for service role"
    ON public.contacts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Note: If you're using SUPABASE_SERVICE_ROLE_KEY in your server code,
-- the service role key bypasses RLS automatically, so these policies
-- are only needed if you want to allow anon key access too.


