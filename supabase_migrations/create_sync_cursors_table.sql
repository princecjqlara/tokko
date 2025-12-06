-- Create sync_cursors table to track pagination progress for resumable syncs
-- This allows syncing 50,000+ contacts across multiple runs

CREATE TABLE IF NOT EXISTS public.sync_cursors (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    page_id VARCHAR(255) NOT NULL,
    cursor_url TEXT,  -- The Facebook pagination cursor/next URL
    contacts_synced INTEGER DEFAULT 0,
    conversations_processed INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint: one cursor per user per page
    UNIQUE(user_id, page_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sync_cursors_user_page ON public.sync_cursors(user_id, page_id);

-- RLS policies (allow all for service role)
ALTER TABLE public.sync_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for sync_cursors" ON public.sync_cursors;
CREATE POLICY "Allow all operations for sync_cursors"
    ON public.sync_cursors
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.sync_cursors IS 'Stores pagination cursors for resumable contact syncs';
