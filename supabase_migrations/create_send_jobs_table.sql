-- Create send_jobs table for tracking background message sending
-- This allows sending large batches without timing out

CREATE TABLE IF NOT EXISTS public.send_jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_ids JSONB NOT NULL, -- Array of contact IDs to send to
    message TEXT NOT NULL,
    attachment JSONB, -- { type: string, url: string } or null
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb, -- Array of error objects
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_send_jobs_user_id ON public.send_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_send_jobs_status ON public.send_jobs(status);
CREATE INDEX IF NOT EXISTS idx_send_jobs_updated_at ON public.send_jobs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_send_jobs_user_status ON public.send_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_send_jobs_pending ON public.send_jobs(status) 
    WHERE status IN ('pending', 'running');

-- Enable Row Level Security (RLS)
ALTER TABLE public.send_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own send jobs" ON public.send_jobs;
DROP POLICY IF EXISTS "Users can insert their own send jobs" ON public.send_jobs;
DROP POLICY IF EXISTS "Users can update their own send jobs" ON public.send_jobs;
DROP POLICY IF EXISTS "Users can delete their own send jobs" ON public.send_jobs;

-- Create policies for NextAuth (using service_role key bypasses RLS on server-side)
-- These policies are for client-side access if needed
CREATE POLICY "Users can view their own send jobs"
    ON public.send_jobs
    FOR SELECT
    USING (true); -- Allow all reads (server-side uses service_role anyway)

CREATE POLICY "Users can insert their own send jobs"
    ON public.send_jobs
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own send jobs"
    ON public.send_jobs
    FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete their own send jobs"
    ON public.send_jobs
    FOR DELETE
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_send_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_send_jobs_updated_at_trigger ON public.send_jobs;
CREATE TRIGGER update_send_jobs_updated_at_trigger
    BEFORE UPDATE ON public.send_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_send_jobs_updated_at();


