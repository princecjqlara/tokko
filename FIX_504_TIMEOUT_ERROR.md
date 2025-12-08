# Fix for 504 Timeout Error in Message Sending

## Problem

The `/api/facebook/messages/send` endpoint was timing out with a 504 Gateway Timeout error when sending messages to large batches of contacts (e.g., 767 contacts). This happened because:

1. **Vercel serverless function timeout**: The function was trying to send all messages synchronously, which exceeded Vercel's timeout limit (10 seconds for Hobby plan, 60-300 seconds for Pro plan)
2. **No timeout protection**: The route didn't have `maxDuration` configured
3. **Synchronous processing**: Large batches were processed in a single request, causing timeouts before completion

## Solution Implemented

### 1. Added `maxDuration` Configuration
- Added `export const maxDuration = 300` to allow up to 5 minutes execution time (requires Vercel Pro plan)
- Added `export const dynamic = "force-dynamic"` to prevent caching

### 2. Background Job System for Large Batches
- Created `send_jobs` table to track background message sending jobs
- For batches > 100 contacts, the API now:
  - Creates a background job in the database
  - Returns immediately with a job ID
  - Processes messages asynchronously in the background
- Created `/api/facebook/messages/process-send-job` route to process background jobs
- Created `/api/facebook/messages/send-job-status` route to check job status

### 3. Timeout Protection
- Added timeout checking in the send route
- Returns partial results if approaching timeout (280 seconds buffer)
- Provides helpful error messages to users

### 4. Frontend Updates
- Updated frontend to handle background job responses
- Shows appropriate messages for large batches being processed in background
- Handles partial results due to timeout

## Files Changed

1. **`app/api/facebook/messages/send/route.ts`**
   - Added `maxDuration` and `dynamic` exports
   - Added background job creation for large batches (>100 contacts)
   - Added timeout protection with partial result return

2. **`app/api/facebook/messages/process-send-job/route.ts`** (NEW)
   - Processes background send jobs
   - Handles both POST (single job) and GET (multiple pending jobs) requests
   - Updates job status and progress in real-time

3. **`app/api/facebook/messages/send-job-status/route.ts`** (NEW)
   - Allows frontend to check job status
   - Returns current progress (sent/failed counts, errors, etc.)

4. **`app/bulk-message/page.tsx`**
   - Updated to handle background job responses
   - Shows appropriate messages for large batches

5. **`supabase_migrations/create_send_jobs_table.sql`** (NEW)
   - Migration file to create the `send_jobs` table

## Database Migration Required

You need to run the migration to create the `send_jobs` table:

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase_migrations/create_send_jobs_table.sql`
4. Run the migration

**Option B: Using Supabase CLI** (if you have it set up)
```bash
supabase migration up
```

## How It Works

### Small Batches (≤100 contacts)
- Messages are sent synchronously in the same request
- Results are returned immediately
- If timeout approaches, partial results are returned with a warning

### Large Batches (>100 contacts)
1. API creates a `send_jobs` entry with status "pending"
2. Returns immediately with job ID and message
3. Background job processor picks up the job (via POST trigger or GET cron)
4. Processes messages in chunks, updating progress periodically
5. Updates job status to "completed" or "failed" when done

### Job Status Tracking
- `status`: "pending" → "running" → "completed"/"failed"
- `sent_count`: Number of successfully sent messages
- `failed_count`: Number of failed messages
- `errors`: Array of error details
- `updated_at`: Last update timestamp

## Testing

1. **Small batch test**: Send to <100 contacts - should work synchronously
2. **Large batch test**: Send to >100 contacts - should create background job
3. **Status check**: Query `/api/facebook/messages/send-job-status?jobId=<id>` to check progress
4. **Timeout test**: Send a very large batch (>500) to test timeout protection

## Notes

- **Vercel Plan**: The `maxDuration = 300` requires Vercel Pro plan. On Hobby plan, the limit is 10 seconds.
- **Background Processing**: Jobs are triggered immediately when created, but can also be processed via:
  - Manual POST to `/api/facebook/messages/process-send-job` with jobId
  - GET request to `/api/facebook/messages/process-send-job` (processes pending jobs)
  - Cron job (can be added to `vercel.json` if needed)

## Future Improvements

1. Add cron job to `vercel.json` to automatically process pending send jobs
2. Add frontend UI to show job progress in real-time
3. Add job cancellation capability
4. Add email/notification when job completes


