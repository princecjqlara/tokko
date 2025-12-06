# Auto-Fetch Fix - Improvements Made

## 🔧 Issues Fixed

### 1. **Frontend Polling Logic** ✅
**Problem:** Polling was too restrictive and didn't provide enough debugging information.

**Fixes:**
- Removed strict `hasFetchedRef` requirement that was blocking polling
- Added comprehensive logging to track polling activity
- Added status change detection to log when jobs change state
- Improved error handling and reporting
- Added periodic status logs (every 60 seconds) for debugging

**Code Location:** `app/bulk-message/page.tsx` (lines 1124-1168)

### 2. **Background API Job Detection** ✅
**Problem:** API wasn't prioritizing pending jobs, making detection unreliable.

**Fixes:**
- Now prioritizes active jobs (pending/running/paused) over completed ones
- Added better error handling
- Added logging when pending jobs are detected
- Returns `hasPendingJob` flag for easier frontend checks

**Code Location:** `app/api/facebook/contacts/background/route.ts` (GET endpoint)

### 3. **Webhook Error Handling** ✅
**Problem:** Webhook errors were silently failing, making debugging difficult.

**Fixes:**
- Added comprehensive error logging at each step
- Better error handling for database operations
- Handles case where job is already pending (updates instead of creating duplicate)
- More detailed logging for each user processed
- Logs when no users are found for a page

**Code Location:** `app/api/webhooks/facebook/route.ts` (`triggerContactFetch` function)

## 🔍 How to Debug Auto-Fetch Issues

### Step 1: Check Browser Console
Open the bulk-message page and check the browser console (F12). You should see:

**Expected Logs:**
```
[Frontend] Auto-fetch polling started - will check for new messages every 3 seconds
[Frontend] Polling active { hasFetched: true, jobStatus: "none", pollCount: 20 }
```

**When a job is detected:**
```
[Frontend] Job status changed: none → pending
[Frontend] 🚀 New message detected, starting immediate auto-fetch...
```

### Step 2: Check Vercel Function Logs
Go to Vercel Dashboard → Your Project → Functions → `/api/webhooks/facebook`

**Expected Logs when webhook receives event:**
```
[Webhook] triggerContactFetch called for page {pageId}, contact {contactId}
[Webhook] Found {count} user(s) for page {pageId}
✅ [Webhook] Created pending fetch job {jobId} for user {userId}...
```

### Step 3: Check Database
Query the `fetch_jobs` table:
```sql
SELECT * FROM fetch_jobs 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY updated_at DESC 
LIMIT 5;
```

Look for:
- Jobs with `status = 'pending'` - these should trigger auto-fetch
- Recent `updated_at` timestamps
- `message` field should contain "🔄 New message from..."

### Step 4: Test Webhook Manually
Send a test message to your Facebook Page, then check:
1. **Vercel Logs** - Should see webhook POST request
2. **Database** - Should see new pending job created
3. **Browser Console** - Should see auto-fetch trigger within 3 seconds

## 🐛 Common Issues & Solutions

### Issue: Polling Not Starting
**Symptoms:** No logs in browser console about polling

**Solutions:**
1. Check if user is authenticated (`status === "authenticated"`)
2. Check if initial sync completed (`hasFetchedRef.current === true`)
3. Check browser console for JavaScript errors
4. Verify `/api/facebook/contacts/background` endpoint is accessible

### Issue: Jobs Created But Not Detected
**Symptoms:** Jobs appear in database but frontend doesn't detect them

**Solutions:**
1. Check browser console for polling logs
2. Verify job status is exactly `"pending"` (not "Pending" or "PENDING")
3. Check if `isFetchingRef.current` is blocking (should be `false`)
4. Manually call `/api/facebook/contacts/background` to see what it returns

### Issue: Webhook Not Creating Jobs
**Symptoms:** No jobs created when messages arrive

**Solutions:**
1. Check Vercel logs for webhook POST requests
2. Verify webhook is subscribed in Facebook App Dashboard
3. Check if `user_pages` table has entries for the page
4. Check webhook logs for errors (should see detailed error messages now)

### Issue: Jobs Stuck in Pending
**Symptoms:** Jobs stay in "pending" status and never start

**Solutions:**
1. Check browser console - should see auto-fetch trigger
2. Verify `fetchContactsRealtime` function is available
3. Check for JavaScript errors preventing fetch
4. Manually trigger fetch to test if it works

## 📊 Testing Checklist

- [ ] Browser console shows "Auto-fetch polling started"
- [ ] Polling logs appear every 60 seconds
- [ ] Webhook receives POST requests (check Vercel logs)
- [ ] Jobs are created in database when messages arrive
- [ ] Frontend detects pending jobs within 3 seconds
- [ ] Auto-fetch starts automatically when job detected
- [ ] New contacts appear in UI after auto-fetch

## 🎯 Next Steps

1. **Deploy the changes** to Vercel
2. **Test with a real message** - send a test message to your page
3. **Monitor the logs** - check both browser console and Vercel logs
4. **Verify auto-fetch works** - new contacts should appear automatically

## 📝 Code Changes Summary

1. **Frontend Polling** (`app/bulk-message/page.tsx`):
   - Improved polling logic with better conditions
   - Added comprehensive logging
   - Better error handling

2. **Background API** (`app/api/facebook/contacts/background/route.ts`):
   - Prioritizes active jobs
   - Better job detection
   - Added `hasPendingJob` flag

3. **Webhook Handler** (`app/api/webhooks/facebook/route.ts`):
   - Enhanced error handling
   - Detailed logging at each step
   - Handles edge cases better

All changes maintain backward compatibility and improve reliability of the auto-fetch system.

