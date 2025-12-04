-- Create storage bucket policies for message-attachments
-- Note: The bucket itself must be created in Supabase Dashboard -> Storage
-- This SQL only creates the policies for the bucket

-- Step 1: Create the storage bucket (if it doesn't exist)
-- Note: Buckets are typically created via Dashboard or API, but we can try via SQL
-- If this fails, create the bucket manually in Supabase Dashboard -> Storage

-- Insert bucket into storage.buckets (if not exists)
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

-- Step 2: Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Step 3: Create policy for public read access (so files can be accessed via URL)
CREATE POLICY "Public can view attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'message-attachments');

-- Step 4: Create policy for authenticated users to upload files
-- This allows any authenticated user to upload to the bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.role() = 'authenticated'
);

-- Step 5: Create policy for users to upload files in their own folder
-- Files are stored as: {user_id}/{filename}
-- This ensures users can only upload to their own folder
CREATE POLICY "Users can upload their own attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 6: Create policy for users to delete their own files
CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Alternative: If using NextAuth (not Supabase Auth), you may need to disable RLS
-- or create policies that work with service_role key
-- Uncomment the following if you're using NextAuth with service_role:

-- DROP POLICY IF EXISTS "Service role can manage all attachments" ON storage.objects;
-- CREATE POLICY "Service role can manage all attachments"
-- ON storage.objects
-- FOR ALL
-- USING (true)
-- WITH CHECK (true);

-- Note: Since you're using NextAuth (not Supabase Auth), the auth.uid() checks above
-- won't work. You'll need to either:
-- 1. Use service_role key in your server-side code (which bypasses RLS)
-- 2. Or create a policy that allows all operations (less secure but simpler)

-- For NextAuth setup, recommended approach:
-- Use SUPABASE_SERVICE_ROLE_KEY in server-side code, which bypasses RLS
-- Then you can use this simpler policy:

-- DROP POLICY IF EXISTS "Allow all operations on message-attachments" ON storage.objects;
-- CREATE POLICY "Allow all operations on message-attachments"
-- ON storage.objects
-- FOR ALL
-- USING (bucket_id = 'message-attachments')
-- WITH CHECK (bucket_id = 'message-attachments');

