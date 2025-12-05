# Schedule Debug Checklist

## Issues Fixed

### 1. ✅ Timezone Conversion
- **Problem**: `datetime-local` input was being interpreted in browser's local timezone instead of Philippine time
- **Fix**: Updated conversion to manually parse the datetime string and treat it as Philippine time (UTC+8), then convert to UTC for storage
- **Location**: `app/bulk-message/page.tsx` lines 1668-1686

### 2. ✅ Added Debug Logging
- Added comprehensive logging in both send and process-scheduled routes
- Logs show timezone conversions, scheduled times in both UTC and Philippine time
- **Location**: 
  - `app/api/facebook/messages/send/route.ts` lines 106-114
  - `app/api/facebook/messages/process-scheduled/route.ts` lines 449-470

## How to Debug Schedule Issues

### 1. Check if Messages are Being Scheduled
```sql
SELECT 
  id,
  user_id,
  status,
  scheduled_for,
  scheduled_for AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila' as scheduled_for_ph,
  created_at,
  updated_at
FROM scheduled_messages
ORDER BY scheduled_for DESC
LIMIT 20;
```

### 2. Check if Cron Job is Running
- Go to Vercel Dashboard → Your Project → Cron Jobs
- Look for `/api/facebook/messages/process-scheduled`
- Check execution history and logs
- Should run every 5 minutes

### 3. Manually Trigger Cron Job
```bash
# Test the endpoint manually
curl https://your-domain.vercel.app/api/facebook/messages/process-scheduled
```

### 4. Check Logs for Timezone Issues
Look for these log messages:
- `[Schedule] Input: ... → Philippine time: ... → UTC: ...` (from frontend)
- `[Send Message API] Scheduling message: ...` (from backend)
- `[Process Scheduled] Checking for scheduled messages: ...` (from cron)

### 5. Verify Timezone Conversion
When user enters "2024-12-20T15:30" (3:30 PM Philippine time):
- Should be stored as: `2024-12-20T07:30:00.000Z` (7:30 AM UTC)
- When displayed back: Should show as 3:30 PM Philippine time

### 6. Check Database Query
The cron job queries:
```sql
SELECT * FROM scheduled_messages
WHERE status = 'pending'
AND scheduled_for <= NOW()
ORDER BY scheduled_for ASC
LIMIT 10;
```

## Common Issues

### Issue 1: Messages Not Being Scheduled
**Symptoms**: No entry in `scheduled_messages` table after clicking Schedule

**Check**:
1. Open browser console, look for `[Schedule]` log messages
2. Check network tab for `/api/facebook/messages/send` request
3. Verify response has `scheduled: true`

### Issue 2: Messages Scheduled But Not Sending
**Symptoms**: Messages in `scheduled_messages` table with status "pending" but not being sent

**Check**:
1. Verify `scheduled_for` is in the past (UTC time)
2. Check if cron job is running (Vercel dashboard)
3. Manually trigger: `curl https://your-domain.vercel.app/api/facebook/messages/process-scheduled`
4. Check logs for errors

### Issue 3: Wrong Time Being Used
**Symptoms**: Messages sending at wrong time

**Check**:
1. Look at `[Schedule]` log in browser console
2. Check `scheduled_for` in database (should be UTC)
3. Verify conversion: Philippine time - 8 hours = UTC time

### Issue 4: Cron Job Not Running
**Symptoms**: No executions in Vercel cron dashboard

**Check**:
1. Verify `vercel.json` is deployed
2. Check Vercel plan (cron requires paid plan)
3. Verify cron path: `/api/facebook/messages/process-scheduled`
4. Check for deployment errors

## Testing the Fix

1. **Test Scheduling**:
   - Select contacts
   - Enter message
   - Set schedule date to 1 minute in the future (Philippine time)
   - Click Schedule
   - Check browser console for `[Schedule]` log
   - Check database for entry

2. **Test Processing**:
   - Wait for scheduled time to pass
   - Check Vercel logs for cron execution
   - Or manually trigger: `curl https://your-domain.vercel.app/api/facebook/messages/process-scheduled`
   - Check database - status should change from "pending" to "sent" or "failed"

3. **Verify Timezone**:
   - Schedule for 3:00 PM Philippine time
   - Check database - `scheduled_for` should be 7:00 AM UTC (3 PM - 8 hours)
   - When cron runs at 7:00 AM UTC, it should send (which is 3:00 PM Philippine time)

## Files Modified

1. `app/bulk-message/page.tsx` - Fixed timezone conversion
2. `app/api/facebook/messages/send/route.ts` - Added debug logging
3. `app/api/facebook/messages/process-scheduled/route.ts` - Added debug logging
