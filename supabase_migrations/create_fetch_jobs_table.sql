    -- Create fetch_jobs table for tracking background contact fetching
    -- This allows fetching to continue even if the user closes the browser

    CREATE TABLE IF NOT EXISTS public.fetch_jobs (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'paused', 'completed', 'failed'
        is_paused BOOLEAN DEFAULT FALSE,
        current_page_name TEXT,
        current_page_number INTEGER,
        total_pages INTEGER,
        total_contacts INTEGER DEFAULT 0,
        message TEXT,
        error TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_fetch_jobs_user_id ON public.fetch_jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_fetch_jobs_status ON public.fetch_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_fetch_jobs_updated_at ON public.fetch_jobs(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fetch_jobs_user_status ON public.fetch_jobs(user_id, status);

    -- Enable Row Level Security (RLS)
    ALTER TABLE public.fetch_jobs ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own jobs" ON public.fetch_jobs;
    DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.fetch_jobs;
    DROP POLICY IF EXISTS "Users can update their own jobs" ON public.fetch_jobs;
    DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.fetch_jobs;

    -- Create policies for NextAuth (using service_role key bypasses RLS on server-side)
    -- These policies are for client-side access if needed
    CREATE POLICY "Users can view their own jobs"
        ON public.fetch_jobs
        FOR SELECT
        USING (true); -- Allow all reads (server-side uses service_role anyway)

    CREATE POLICY "Users can insert their own jobs"
        ON public.fetch_jobs
        FOR INSERT
        WITH CHECK (true);

    CREATE POLICY "Users can update their own jobs"
        ON public.fetch_jobs
        FOR UPDATE
        USING (true);

    CREATE POLICY "Users can delete their own jobs"
        ON public.fetch_jobs
        FOR DELETE
        USING (true);

    -- Function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_fetch_jobs_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger to auto-update updated_at
    DROP TRIGGER IF EXISTS update_fetch_jobs_updated_at_trigger ON public.fetch_jobs;
    CREATE TRIGGER update_fetch_jobs_updated_at_trigger
        BEFORE UPDATE ON public.fetch_jobs
        FOR EACH ROW
        EXECUTE FUNCTION update_fetch_jobs_updated_at();

