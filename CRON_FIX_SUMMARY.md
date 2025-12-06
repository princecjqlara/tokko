# Cron Scheduling Fix Summary

## Issues Fixed

### 1. ✅ Authentication Issue (CRITICAL)
**Problem**: The cron endpoint was blocking all Vercel Cron requests because it required an Authorization Bearer token, but Vercel Cron doesn't automatically send auth headers.

**Fix**: Updated `app/api/facebook/messages/process-scheduled/route.ts` to:
- Check for `x-vercel-cron` header (sent by Vercel Cron)
- Check User-Agent for "vercel" (additional Vercel Cron identifier)
- Allow Vercel Cron requests without Bearer token if CRON_SECRET is set
- Still require Bearer token for manual/API calls when CRON_SECRET is configured

### 2. ✅ Stuck Messages Recovery
**Problem**: If a cron job failed while processing a message, the message could remain in "processing" status indefinitely.

**Fix**: Added logic to also process messages that have been in "processing" status for more than 30 minutes, treating them as stuck and retrying them.

### 3. ✅ Enhanced Logging
**Problem**: Insufficient logging made it difficult to debug cron job issues.

**Fix**: Added comprehensive logging including:
- Authentication status (Vercel Cron vs manual)
- Detailed error messages with codes
- Message processing counts and IDs
- Timestamp tracking

## How to Verify Cron is Working

### 1. Check Vercel Dashboard
1. Go to your Vercel project dashboard
2. Navigate to the "Cron Jobs" tab
3. Check the execution logs for `/api/facebook/messages/process-scheduled`
4. Look for successful runs every 5 minutes

### 2. Manual Testing
You can manually trigger the cron endpoint to test:

```bash
# Without authentication (if CRON_SECRET is not set)
curl https://your-domain.vercel.app/api/facebook/messages/process-scheduled

# With authentication (if CRON_SECRET is set)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/facebook/messages/process-scheduled
```

### 3. Check Database
Query your `scheduled_messages` table to see:
- Messages with status "pending" that should be sent
- Messages with status "sent" (successfully processed)
- Messages with status "failed" (check errors field)
- Messages with status "processing" (should be temporary)

```sql
SELECT 
  id,
  status,
  scheduled_for,
  sent_count,
  failed_count,
  errors,
  created_at,
  processed_at
FROM scheduled_messages
ORDER BY scheduled_for DESC
LIMIT 20;
```

### 4. Check Application Logs
Look for these log messages in Vercel function logs:
- `[Process Scheduled] Request authorized` - Cron job is running
- `[Process Scheduled] Found X scheduled message(s) to process` - Messages found
- `[Process Scheduled] No scheduled messages to process` - No messages to send (normal)
- Error messages if something fails

## Configuration

### vercel.json
The cron is configured to run every 5 minutes:
```json
{
  "crons": [
    {
      "path": "/api/facebook/messages/process-scheduled",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Environment Variables (Optional)
If you want to secure the endpoint, set:
```
CRON_SECRET=your-secret-token-here
```

Note: Even with CRON_SECRET set, Vercel Cron requests will be allowed (they're identified by headers/User-Agent). Manual API calls will require the Bearer token.

## Troubleshooting

### Cron Not Running
1. **Check deployment**: Ensure `vercel.json` is deployed and recognized by Vercel
2. **Check Vercel plan**: Cron jobs require a paid Vercel plan (not available on Hobby plan)
3. **Check logs**: Look for authentication errors or other issues

### Messages Not Sending
1. **Verify database**: Check that `scheduled_messages` table exists and has data
2. **Check scheduled_for**: Ensure the time is in the past (messages won't send if scheduled for future)
3. **Check status**: Look for messages stuck in "processing" or "failed" status
4. **Check logs**: Look for error messages in the cron execution logs

### Authentication Errors
- If you see 401 errors in logs, check that Vercel Cron requests are being identified correctly
- The code now checks for `x-vercel-cron` header and User-Agent
- If still failing, temporarily remove CRON_SECRET to test, or check the logs for which headers are being received

## Next Steps

1. **Deploy the changes** to Vercel
2. **Monitor the cron logs** for the next few runs
3. **Test with a scheduled message** - schedule a message for a few minutes in the future
4. **Verify it sends** when the cron runs

