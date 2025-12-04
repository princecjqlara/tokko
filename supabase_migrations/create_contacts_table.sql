-- Create contacts table for storing Facebook contacts
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.contacts (
    id BIGSERIAL PRIMARY KEY,
    contact_id TEXT NOT NULL,
    page_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    contact_name TEXT,
    page_name TEXT,
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    last_contact_message_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tags JSONB DEFAULT '[]'::jsonb,
    role TEXT DEFAULT '',
    avatar TEXT,
    date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one contact per page per user
    CONSTRAINT unique_contact_per_page_user UNIQUE (contact_id, page_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_page_id ON public.contacts(page_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_id ON public.contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON public.contacts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_date ON public.contacts(date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

-- Create policy: Users can only see their own contacts
CREATE POLICY "Users can view their own contacts"
    ON public.contacts
    FOR SELECT
    USING (auth.uid()::text = user_id OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create policy: Users can insert their own contacts
CREATE POLICY "Users can insert their own contacts"
    ON public.contacts
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create policy: Users can update their own contacts
CREATE POLICY "Users can update their own contacts"
    ON public.contacts
    FOR UPDATE
    USING (auth.uid()::text = user_id OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create policy: Users can delete their own contacts
CREATE POLICY "Users can delete their own contacts"
    ON public.contacts
    FOR DELETE
    USING (auth.uid()::text = user_id OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Note: If you're using NextAuth (not Supabase Auth), you may need to adjust the RLS policies
-- to use service_role key or disable RLS for server-side operations

-- IMPORTANT: For NextAuth.js (not Supabase Auth), you need to either:
-- 1. Disable RLS for server-side operations (recommended for this use case)
-- 2. Or use service_role key in your server-side Supabase client

-- Option 1: Disable RLS (if using NextAuth with service_role key)
-- ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;

-- Option 2: Create a policy that allows service_role access
-- This requires using SUPABASE_SERVICE_ROLE_KEY in your server-side code
-- CREATE POLICY "Service role can manage all contacts"
--     ON public.contacts
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

