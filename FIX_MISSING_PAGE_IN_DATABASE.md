# Fix: Page Not in Database

## Error
```
No access token for page 656646850875530: { code: 'PGRST116', details: 'The result contains 0 rows' }
```

This means the page `656646850875530` is not stored in the `facebook_pages` table.

## Solution: Fetch and Store Pages

### Step 1: Trigger Page Fetch
The pages need to be fetched from Facebook and stored in the database first.

**Option A: Automatic (Recommended)**
1. Go to: https://tokko-official.vercel.app/bulk-message
2. The app should automatically call `/api/facebook/pages` when you load the page
3. This will fetch and store your pages

**Option B: Manual**
1. Go directly to: https://tokko-official.vercel.app/api/facebook/pages
2. This will fetch your Facebook pages and store them in the database
3. You should see a JSON response with your pages

### Step 2: Verify Pages Are Stored
1. Go to **Supabase Dashboard** → **Table Editor**
2. Click on `facebook_pages` table
3. You should see rows with:
   - `page_id`: `656646850875530` (or your page IDs)
   - `page_name`: Your page name
   - `page_access_token`: The access token (should be filled)

### Step 3: Check Browser Console
1. Open browser console (F12)
2. Go to: https://tokko-official.vercel.app/bulk-message
3. Look for:
   - API call to `/api/facebook/pages`
   - Any errors in the console
   - Success messages

### Step 4: Try Sending Again
Once pages are stored:
1. Go back to bulk message page
2. Select contacts
3. Send a message
4. Should work now!

## If Pages Still Don't Store

### Check 1: Authentication
- Make sure you're logged in with Facebook
- Your session should have a valid access token

### Check 2: Facebook Permissions
- Make sure your Facebook app has `pages_show_list` permission
- Check Facebook App Dashboard → Permissions

### Check 3: Database Permissions
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Check Vercel function logs for database errors

### Check 4: Manual Check
1. Go to: https://tokko-official.vercel.app/api/facebook/pages
2. Check the response - do you see your pages?
3. Check Vercel function logs for `/api/facebook/pages` - any errors?

## Quick Fix Command

If you want to test the API directly:
```bash
curl https://tokko-official.vercel.app/api/facebook/pages
```

This should fetch and store your pages.


