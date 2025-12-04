# Auto-Fetch Pages Before Sending Messages

## Problem
Pages are not in the `facebook_pages` table, so messages can't be sent.

## Solution: Fetch Pages First

### Step 1: Fetch Your Pages
Go to this URL in your browser:
```
https://tokko-official.vercel.app/api/facebook/pages
```

This will:
1. Fetch all your Facebook pages
2. Store them in `facebook_pages` table with access tokens
3. Store user-page relationships in `user_pages` table

### Step 2: Verify Pages Are Stored
1. Go to **Supabase Dashboard** → **Table Editor**
2. Click on `facebook_pages` table
3. You should see rows with:
   - `page_id`: `663521640185928`, `656646850875530`, etc.
   - `page_name`: Your page names
   - `page_access_token`: Access tokens (should be filled)

### Step 3: Try Sending Again
Once pages are stored:
1. Go back to: https://tokko-official.vercel.app/bulk-message
2. Select contacts
3. Send a message
4. Should work now!

## Why This Happens
The pages need to be fetched from Facebook API and stored in the database before messages can be sent. The `/api/facebook/pages` endpoint does this automatically, but it needs to be called first.

## Automatic Fix
The bulk message page should automatically call `/api/facebook/pages` when you load it. If it doesn't:
1. Check browser console (F12) for errors
2. Manually call the endpoint as shown above


