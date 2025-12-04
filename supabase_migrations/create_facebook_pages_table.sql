-- Create facebook_pages table for storing Facebook page information
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.facebook_pages (
    page_id TEXT PRIMARY KEY,
    page_name TEXT NOT NULL,
    page_access_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_facebook_pages_updated_at ON public.facebook_pages(updated_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage all pages" ON public.facebook_pages;

-- Create policy: Allow service role to manage all pages
-- This is needed because we use SUPABASE_SERVICE_ROLE_KEY for server-side operations
CREATE POLICY "Service role can manage all pages"
    ON public.facebook_pages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Note: Since we're using NextAuth (not Supabase Auth) with service_role key,
-- RLS is effectively bypassed for server-side operations


