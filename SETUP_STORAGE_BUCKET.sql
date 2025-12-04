-- ============================================
-- SUPABASE STORAGE BUCKET SETUP SQL
-- ============================================
-- Run this in Supabase Dashboard -> SQL Editor
-- DO NOT run TypeScript files (.ts) - only run this SQL file
-- ============================================

-- Step 1: Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'message-attachments',
    'message-attachments',
    true, -- Public bucket so files can be accessed via URL
    26214400, -- 25MB limit (25 * 1024 * 1024)
    ARRAY[
        -- Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        -- Videos
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-ms-wmv',
        'video/webm',
        -- Audio
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'audio/webm',
        -- Documents
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

-- Step 2: Drop existing policies (if any)
DROP POLICY IF EXISTS "Allow all operations on message-attachments" ON storage.objects;

-- Step 3: Create storage policy that allows all operations
-- Since you're using service_role key, RLS is bypassed anyway
-- But we still need a policy for the bucket to work
CREATE POLICY "Allow all operations on message-attachments"
ON storage.objects
FOR ALL
USING (bucket_id = 'message-attachments')
WITH CHECK (bucket_id = 'message-attachments');

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, verify the bucket was created:
-- SELECT * FROM storage.buckets WHERE id = 'message-attachments';
-- ============================================


