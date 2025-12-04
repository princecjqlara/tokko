# Fix: Pages Not Stored in Database

## Problem
The error "No access token for page" means pages aren't stored in the `facebook_pages` table yet.

## Solution: Fetch and Store Pages

### Step 1: Trigger Page Fetch
1. Go to: https://tokko-official.vercel.app/bulk-message
2. The app should automatically fetch your Facebook pages when you load the page
3. Check the browser console (F12) for any errors

### Step 2: Verify Pages Are Stored
1. Go to **Supabase Dashboard** → **Table Editor**
2. Click on `facebook_pages` table
3. Check if you see any rows with your page information
4. If empty, pages weren't stored

### Step 3: Manually Fetch Pages (If Needed)
If pages aren't automatically fetched:

1. Go to: https://tokko-official.vercel.app/api/facebook/pages
2. This should fetch and store your pages
3. Check Supabase `facebook_pages` table again

### Step 4: Check Page Access Tokens
In the `facebook_pages` table, verify:
- ✅ `page_id` is set
- ✅ `page_name` is set
- ✅ `page_access_token` is set (this is critical!)

If `page_access_token` is empty or null, that's the problem.

## Common Issues

### Issue: Pages Not Fetching
- **Cause**: Facebook API permissions or rate limits
- **Fix**: Check browser console for errors, try again later

### Issue: Access Tokens Missing
- **Cause**: Facebook API didn't return access tokens
- **Fix**: Re-authenticate with Facebook (log out and log back in)

### Issue: Pages Not Storing
- **Cause**: Database error or RLS blocking
- **Fix**: Check Supabase logs, verify service_role key is set

## Quick Test
1. Open browser console (F12)
2. Go to: https://tokko-official.vercel.app/bulk-message
3. Look for API calls to `/api/facebook/pages`
4. Check if it succeeds and stores pages

## After Pages Are Stored
Once pages are in the `facebook_pages` table:
1. Try sending a message again
2. Should work now!

