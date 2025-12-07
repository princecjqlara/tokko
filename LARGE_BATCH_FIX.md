# Large Batch Message Send Fix

## Problem
Messages were not being sent when there were many contacts (>100). The background job was created but not processing.

## Root Cause
When creating background jobs for large batches, the status was set to "processing" to prevent cron from picking them up. However, if the direct trigger failed (network issues, timeout, etc.), the job would remain in "processing" status indefinitely because:

1. The async fetch trigger might fail silently
2. Cron only processes jobs with status "pending" or "running" 
3. Jobs stuck in "processing" status were never picked up

## Fix Applied

### 1. **Changed Job Status to "pending"**
- Changed initial job status from "processing" to "pending"
- This allows the cron job (runs every 2 minutes) to pick up the job if the direct trigger fails
- Ensures jobs are always processed even if immediate trigger fails

### 2. **Improved Error Handling**
- Added timeout to the fetch trigger (5 seconds)
- Better error logging when trigger fails
- Clear messaging that cron will pick up the job if trigger fails

### 3. **Better User Feedback**
- Updated success message to inform users that processing will start immediately
- Mentions that if no progress is seen, check back in 2 minutes (cron interval)

## How It Works Now

1. **User sends message to >100 contacts**
   - System creates a background job with status "pending"
   - Tries to trigger processing immediately via fetch
   - Returns success to user immediately

2. **If immediate trigger succeeds:**
   - Job starts processing right away
   - Status changes to "running" during processing

3. **If immediate trigger fails:**
   - Job remains in "pending" status
   - Cron job (runs every 2 minutes) picks it up automatically
   - Processing starts within 2 minutes at most

## Cron Configuration

- **Path**: `/api/facebook/messages/process-send-job`
- **Schedule**: Every 2 minutes (`*/2 * * * *`)
- **Processes**: Up to 5 pending/running jobs per run

## Expected Behavior

✅ Large batches (>100 contacts) create background jobs
✅ Jobs are processed immediately if trigger succeeds
✅ Jobs are automatically picked up by cron if trigger fails
✅ Users get immediate feedback that processing started
✅ Jobs never get stuck in unprocessed state

## Testing

1. **Test with >100 contacts:**
   - Select 100+ contacts
   - Send message
   - Should see success message with job ID
   - Check that messages are being sent (either immediately or within 2 minutes)

2. **Monitor job status:**
   - Can check job status via `/api/facebook/messages/send-job-status?jobId=<id>`
   - Status should change from "pending" → "running" → "completed"

3. **Check logs:**
   - Vercel function logs should show job creation and processing
   - If trigger fails, should see warning that cron will pick it up

## Files Modified

- `app/api/facebook/messages/send/route.ts` - Changed job status to "pending" and improved error handling
