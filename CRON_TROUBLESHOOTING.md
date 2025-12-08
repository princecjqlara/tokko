# Cron Scheduling Troubleshooting Guide

## Recent Fixes Applied

1. ✅ **Added `export const dynamic = 'force-dynamic'`** - Prevents Next.js from caching responses
2. ✅ **Improved Vercel Cron Detection** - Checks multiple header formats and User-Agent patterns
3. ✅ **More Permissive Authentication** - Allows requests without auth headers (Vercel Cron behavior)
4. ✅ **Comprehensive Logging** - Logs all headers for debugging

## Common Issues & Solutions

### Issue 1: Cron Job Not Running at All

**Symptoms:**
- No logs in Vercel dashboard
- Cron job never executes

**Solutions:**
1. **Check Vercel Plan**: Cron jobs require a **paid Vercel plan** (Pro or higher). Hobby plan doesn't support cron jobs.
2. **Verify vercel.json**: Ensure `vercel.json` is in the root directory and properly formatted
3. **Check Path**: The path in `vercel.json` must match your API route exactly:
   - `vercel.json`: `"path": "/api/facebook/messages/process-scheduled"`
   - Route file: `app/api/facebook/messages/process-scheduled/route.ts`
4. **Redeploy**: After changing `vercel.json`, you must redeploy for changes to take effect
5. **Check Vercel Dashboard**: Go to Project → Cron Jobs tab to see if cron is registered

### Issue 2: Cron Runs But Returns 401 Unauthorized

**Symptoms:**
- Cron appears in logs but returns 401 error
- "Unauthorized" messages in function logs

**Solutions:**
1. **Remove CRON_SECRET Temporarily**: If `CRON_SECRET` is set in Vercel env vars, temporarily remove it to test
2. **Check Headers**: Look at the logs for `[Process Scheduled] Request received with headers` - this shows what Vercel is actually sending
3. **Update Code**: The latest code should handle Vercel Cron requests even without auth headers

### Issue 3: Cron Runs But Messages Don't Send

**Symptoms:**
- Cron executes successfully
- Returns success but messages remain in "pending" status

**Solutions:**
1. **Check Database**: Verify `scheduled_messages` table exists and has data
   ```sql
   SELECT * FROM scheduled_messages 
   WHERE status = 'pending' 
   ORDER BY scheduled_for;
   ```
2. **Check scheduled_for Time**: Ensure `scheduled_for` is in the past (UTC timezone)
3. **Check Logs**: Look for errors in the cron execution logs
4. **Verify Contacts Exist**: Make sure the contact_ids in scheduled_messages still exist in the contacts table
5. **Check Page Access Tokens**: Verify `facebook_pages` table has valid `page_access_token` values

### Issue 4: Messages Stuck in "processing" Status

**Symptoms:**
- Messages have status "processing" but never complete

**Solutions:**
1. **Automatic Recovery**: The code now automatically retries messages stuck in "processing" for more than 30 minutes
2. **Manual Reset**: You can manually reset stuck messages:
   ```sql
   UPDATE scheduled_messages 
   SET status = 'pending' 
   WHERE status = 'processing' 
   AND updated_at < NOW() - INTERVAL '30 minutes';
   ```

## Testing the Cron Endpoint

### Manual Test (Without Authentication)
```bash
curl https://your-domain.vercel.app/api/facebook/messages/process-scheduled
```

### Manual Test (With Authentication)
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/facebook/messages/process-scheduled
```

### Expected Response
```json
{
  "success": true,
  "message": "No scheduled messages to process",
  "processed": 0
}
```

Or if there are messages:
```json
{
  "success": true,
  "results": {
    "processed": 1,
    "success": 1,
    "failed": 0,
    "errors": []
  }
}
```

## Debugging Steps

1. **Check Vercel Cron Dashboard**
   - Go to your Vercel project
   - Navigate to "Cron Jobs" tab
   - Check execution history and logs

2. **Check Function Logs**
   - In Vercel dashboard, go to "Functions" tab
   - Find `/api/facebook/messages/process-scheduled`
   - Check execution logs for errors

3. **Enable Detailed Logging**
   - The code now logs all headers received
   - Look for: `[Process Scheduled] Request received with headers`
   - This shows exactly what Vercel is sending

4. **Test Database Query**
   ```sql
   -- Check if there are pending messages
   SELECT COUNT(*) FROM scheduled_messages WHERE status = 'pending';
   
   -- Check if messages are due
   SELECT * FROM scheduled_messages 
   WHERE status = 'pending' 
   AND scheduled_for <= NOW()
   ORDER BY scheduled_for;
   ```

5. **Verify Route is Deployed**
   - Check that the route file exists: `app/api/facebook/messages/process-scheduled/route.ts`
   - Ensure it exports `GET` and `POST` handlers
   - Verify `export const dynamic = 'force-dynamic'` is present

## Environment Variables

- `CRON_SECRET` (optional): If set, requires Bearer token for manual calls, but allows Vercel Cron without auth
- Ensure all other required env vars are set (Supabase keys, etc.)

## Next Steps if Still Not Working

1. Check Vercel plan upgrade requirements
2. Verify the route is accessible manually via curl
3. Check Vercel deployment logs for any build errors
4. Review Vercel Cron documentation: https://vercel.com/docs/cron-jobs
5. Consider using an alternative like:
   - External cron service (cron-job.org, EasyCron)
   - Serverless function with scheduled trigger
   - Database triggers if using Supabase








