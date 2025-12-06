# Auto-Fetch New Contacts - Status Check

## ✅ Auto-Fetch System Overview

Your application **DOES have auto-fetch functionality** for new contacts. Here's how it works:

### How Auto-Fetch Works

1. **Webhook-Based Trigger** (Primary Method)
   - When Facebook receives a new message on your page, it sends a webhook event to `/api/webhooks/facebook`
   - The webhook handler (`app/api/webhooks/facebook/route.ts`) processes the event
   - It creates a "pending" fetch job in the `fetch_jobs` table
   - This triggers an immediate contact fetch

2. **Frontend Polling** (Secondary Method)
   - The frontend polls `/api/facebook/contacts/background` every **3 seconds**
   - It checks for pending fetch jobs
   - When a pending job is detected, it automatically starts fetching new contacts
   - This ensures new contacts appear in real-time

3. **Automatic Fetch Flow**
   ```
   New Message → Facebook Webhook → Create Fetch Job → Frontend Polling Detects → Auto-Fetch Starts
   ```

## 🔍 How to Verify Auto-Fetch is Working

### Step 1: Check Webhook Configuration

1. **Verify Environment Variables in Vercel:**
   - `FACEBOOK_WEBHOOK_VERIFY_TOKEN` - Must be set
   - `FACEBOOK_APP_SECRET` - Must be set (for signature verification)

2. **Check Facebook App Webhook Settings:**
   - Go to: https://developers.facebook.com/apps/1350694239880908/
   - Navigate to **Webhooks** → **Page**
   - Verify webhook is subscribed and active
   - Check that callback URL is: `https://tokko-official.vercel.app/api/webhooks/facebook`

3. **Test Webhook Endpoint:**
   ```bash
   curl "https://tokko-official.verman.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
   ```
   Should return: `test123` (not 404 or 403)

### Step 2: Check Frontend Polling

1. **Open Browser Console** (F12) on the bulk-message page
2. **Look for these log messages:**
   - `"[Frontend] 🚀 New message detected, starting immediate auto-fetch..."`
   - `"✅ [Frontend] Sync completed. Auto-fetching enabled - will check for new messages every 3 seconds."`

3. **Verify Polling is Active:**
   - Check console for polling activity every 3 seconds
   - Should see: `"Error checking for new messages:"` only if there's an error (otherwise silent)

### Step 3: Test Auto-Fetch Manually

1. **Send a test message** to your Facebook Page from another account
2. **Watch the browser console** - should see auto-fetch trigger within 3 seconds
3. **Check Vercel Function Logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for `/api/webhooks/facebook` POST requests
   - Should see webhook events being received

### Step 4: Check Database

1. **Check `fetch_jobs` table:**
   ```sql
   SELECT * FROM fetch_jobs 
   WHERE user_id = 'YOUR_USER_ID' 
   ORDER BY updated_at DESC 
   LIMIT 5;
   ```
   - Should see jobs with status: `pending`, `running`, or `completed`
   - Recent jobs should have messages like: `"🔄 New message from ... - auto-fetching..."`

2. **Check `contacts` table:**
   - New contacts should appear automatically after webhook triggers
   - Check `updated_at` timestamp to see when contacts were last updated

## ⚠️ Common Issues & Fixes

### Issue 1: Webhook Not Receiving Events

**Symptoms:**
- No webhook events in Vercel logs
- No fetch jobs being created

**Fixes:**
1. Verify webhook is subscribed in Facebook App Dashboard
2. Check that pages are subscribed to webhook events
3. Verify callback URL is correct and accessible
4. Check `FACEBOOK_WEBHOOK_VERIFY_TOKEN` matches in Vercel and Facebook

### Issue 2: Frontend Not Polling

**Symptoms:**
- No console logs about polling
- Contacts not updating automatically

**Fixes:**
1. Check browser console for JavaScript errors
2. Verify user is authenticated (`status === "authenticated"`)
3. Check that `hasFetchedRef.current` is `true` (initial sync completed)
4. Verify `/api/facebook/contacts/background` endpoint is accessible

### Issue 3: Fetch Jobs Created But Not Processed

**Symptoms:**
- Jobs appear in database with `pending` status
- But frontend doesn't start fetching

**Fixes:**
1. Check if `isFetchingRef.current` is blocking (should be `false`)
2. Verify `fetchingProgress.isFetching` is `false`
3. Check browser console for errors when polling
4. Manually trigger fetch to test if it works

### Issue 4: Webhook Signature Verification Failing

**Symptoms:**
- Webhook returns 403 errors
- Events not being processed

**Fixes:**
1. Verify `FACEBOOK_APP_SECRET` is set correctly in Vercel
2. Check that it matches your Facebook App Secret
3. Ensure no extra spaces or newlines in the secret

## 📊 Auto-Fetch Status Indicators

### ✅ Working Correctly:
- ✅ Webhook endpoint returns challenge on GET request
- ✅ Webhook receives POST events (check Vercel logs)
- ✅ Fetch jobs are created in database when messages arrive
- ✅ Frontend polls every 3 seconds (check console)
- ✅ New contacts appear automatically in UI
- ✅ Console shows: `"🚀 New message detected, starting immediate auto-fetch..."`

### ❌ Not Working:
- ❌ Webhook returns 404 or 403
- ❌ No webhook events in Vercel logs
- ❌ No fetch jobs created
- ❌ Frontend polling errors in console
- ❌ Contacts don't update automatically

## 🔧 Manual Testing Steps

1. **Test Webhook Endpoint:**
   ```bash
   # Replace YOUR_TOKEN with your actual verify token
   curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
   ```

2. **Send Test Message:**
   - Use another Facebook account to send a message to your page
   - Watch Vercel function logs for webhook event
   - Check browser console for auto-fetch trigger

3. **Check Database:**
   ```sql
   -- Check recent fetch jobs
   SELECT * FROM fetch_jobs ORDER BY updated_at DESC LIMIT 5;
   
   -- Check recent contacts
   SELECT contact_id, contact_name, page_name, updated_at 
   FROM contacts 
   ORDER BY updated_at DESC 
   LIMIT 10;
   ```

## 📝 Code Locations

- **Webhook Handler**: `app/api/webhooks/facebook/route.ts`
- **Background Fetch API**: `app/api/facebook/contacts/background/route.ts`
- **Frontend Polling**: `app/bulk-message/page.tsx` (lines 1124-1168)
- **Contact Fetching**: `app/api/facebook/contacts/stream/route.ts`

## 🎯 Summary

Your auto-fetch system is **fully implemented** and should work automatically. The system:
- ✅ Listens for Facebook webhook events
- ✅ Creates fetch jobs when new messages arrive
- ✅ Polls for pending jobs every 3 seconds
- ✅ Automatically fetches new contacts
- ✅ Updates the UI in real-time

If it's not working, check the webhook configuration and frontend polling status using the steps above.

