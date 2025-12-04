-- Simple storage bucket setup for NextAuth (using service_role key)
-- This version works when using SUPABASE_SERVICE_ROLE_KEY which bypasses RLS

-- Step 1: Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'message-attachments',
    'message-attachments',
    true, -- Public bucket so files can be accessed via URL
    26214400, -- 25MB limit (25 * 1024 * 1024)
    ARRAY[
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/webm',
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
)
ON CONFLICT (id) DO UPDATE
SET 
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 2: Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on message-attachments" ON storage.objects;

-- Step 3: Create simple policy that allows all operations
-- Since you're using service_role key, RLS is bypassed anyway
-- But we still need a policy for the bucket to work
CREATE POLICY "Allow all operations on message-attachments"
ON storage.objects
FOR ALL
USING (bucket_id = 'message-attachments')
WITH CHECK (bucket_id = 'message-attachments');

-- Note: If the bucket creation fails with "relation storage.buckets does not exist"
-- or permission errors, create the bucket manually:
-- 1. Go to Supabase Dashboard -> Storage
-- 2. Click "New bucket"
-- 3. Name: message-attachments
-- 4. Make it Public
-- 5. Set file size limit to 25MB
-- 6. Then run only the policy creation part (Step 2 and 3) above


