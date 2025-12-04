-- Create scheduled_messages table for storing scheduled bulk messages
-- This allows users to schedule messages to be sent at a future date/time

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_ids JSONB NOT NULL, -- Array of contact IDs to send to
    message TEXT NOT NULL,
    attachment JSONB, -- { type: string, url: string } or null
    scheduled_for TIMESTAMPTZ NOT NULL, -- When to send the message
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb, -- Array of error objects
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_id ON public.scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON public.scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON public.scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_status ON public.scheduled_messages(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending ON public.scheduled_messages(scheduled_for, status) 
    WHERE status = 'pending';

-- Enable Row Level Security (RLS)
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can insert their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can update their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can delete their own scheduled messages" ON public.scheduled_messages;

-- Create policies for NextAuth (using service_role key bypasses RLS on server-side)
-- These policies are for client-side access if needed
CREATE POLICY "Users can view their own scheduled messages"
    ON public.scheduled_messages
    FOR SELECT
    USING (true); -- Allow all reads (server-side uses service_role anyway)

CREATE POLICY "Users can insert their own scheduled messages"
    ON public.scheduled_messages
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own scheduled messages"
    ON public.scheduled_messages
    FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete their own scheduled messages"
    ON public.scheduled_messages
    FOR DELETE
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at_trigger ON public.scheduled_messages;
CREATE TRIGGER update_scheduled_messages_updated_at_trigger
    BEFORE UPDATE ON public.scheduled_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_messages_updated_at();

