-- Create user_pages table for storing user-page relationships
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.user_pages (
    user_id TEXT NOT NULL,
    page_id TEXT NOT NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite primary key: one relationship per user-page pair
    PRIMARY KEY (user_id, page_id),
    
    -- Foreign key to facebook_pages (optional, for referential integrity)
    CONSTRAINT fk_user_pages_facebook_pages 
        FOREIGN KEY (page_id) 
        REFERENCES public.facebook_pages(page_id) 
        ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_pages_user_id ON public.user_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pages_page_id ON public.user_pages(page_id);
CREATE INDEX IF NOT EXISTS idx_user_pages_connected_at ON public.user_pages(connected_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage all user pages" ON public.user_pages;

-- Create policy: Allow service role to manage all user-page relationships
-- This is needed because we use SUPABASE_SERVICE_ROLE_KEY for server-side operations
CREATE POLICY "Service role can manage all user pages"
    ON public.user_pages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Note: Since we're using NextAuth (not Supabase Auth) with service_role key,
-- RLS is effectively bypassed for server-side operations


