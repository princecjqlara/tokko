# Debug Message Sending Failure

## What to Check

### 1. Check Vercel Function Logs
1. Go to **Vercel Dashboard** → Your Project → **Functions**
2. Click on `/api/facebook/messages/send`
3. Look for error messages in the logs
4. Copy the exact error message

### 2. Common Issues

#### Issue: "No access token for page"
- **Cause**: Page not stored in `facebook_pages` table
- **Fix**: Connect pages first by going to `/bulk-message` and letting it fetch pages

#### Issue: "Table not found"
- **Cause**: Tables weren't created correctly
- **Fix**: Check Supabase Table Editor - do you see `facebook_pages` and `user_pages`?

#### Issue: "Unauthorized"
- **Cause**: Session expired or invalid
- **Fix**: Log out and log back in

#### Issue: "No contacts found"
- **Cause**: Contacts query failing
- **Fix**: Check if contacts exist in database

### 3. Check Database Tables
1. Go to **Supabase Dashboard** → **Table Editor**
2. Verify you see:
   - ✅ `facebook_pages` table
   - ✅ `user_pages` table
   - ✅ `contacts` table

### 4. Check Pages Are Connected
1. Go to: https://tokko-official.vercel.app/bulk-message
2. The app should automatically fetch and store your Facebook pages
3. Check browser console for any errors

## What Error Are You Seeing?

Please share:
1. The exact error message (from browser console or Vercel logs)
2. What happens when you click "Send Broadcast"?
3. Do you see any error messages on the page?


