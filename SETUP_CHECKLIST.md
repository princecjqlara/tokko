# Setup Checklist

## ✅ Completed
- [x] Supabase client installed and configured
- [x] Environment variables file created (.env.local)
- [x] Facebook App ID added
- [x] Supabase credentials added
- [x] NextAuth configured with Supabase support

## ⚠️ Still Needed

### 1. Facebook App Secret (REQUIRED)
**Action Required:**
1. Go to: https://developers.facebook.com/apps/1350694239880908/settings/basic/
2. Click "Show" next to App Secret
3. Copy the App Secret
4. Update `.env.local`:
   ```
   FACEBOOK_CLIENT_SECRET=your-actual-secret-here
   ```

### 2. Facebook OAuth Redirect URIs
**Action Required:**
1. Go to: https://developers.facebook.com/apps/1350694239880908/fb-login/settings/
2. Add these Valid OAuth Redirect URIs:
   - `http://localhost:3000/api/auth/callback/facebook` (for local development)
   - `https://tokko-official.vercel.app/api/auth/callback/facebook` (for Vercel production)

### 2a. Facebook App Permissions (REQUIRED - Fixes "app needs at least one supported permission" error)

**⚠️ IMPORTANT FOR BUSINESS TYPE APPS:**
If your app is a **Business type app**, Facebook requires at least **one additional permission** beyond `email` and `public_profile`. The code now includes `pages_show_list` to satisfy this requirement.

**Action Required:**
1. Go to: https://developers.facebook.com/apps/1350694239880908/settings/basic/
2. Check your app type:
   - If it's a **Business type app**: The code now requests `email public_profile pages_show_list`
   - If it's a **Consumer/Other type app**: You can use just `email public_profile`
3. Make sure your app is in **"Development" mode** (not Live mode)
4. Go to: https://developers.facebook.com/apps/1350694239880908/fb-login/settings/
5. Make sure these are enabled:
   - ✅ **Client OAuth Login** = ON
   - ✅ **Web OAuth Login** = ON
6. Scroll down to **"Valid OAuth Redirect URIs"** and add:
   - `http://localhost:3000/api/auth/callback/facebook` (local)
   - `https://tokko-official.vercel.app/api/auth/callback/facebook` (production)
7. Go to: https://developers.facebook.com/apps/1350694239880908/roles/roles/
8. Make sure you (the developer) are added as a **Developer** or **Admin**

**Note:** In Development mode, only developers/test users can log in. To test:
- Use your own Facebook account (if you're a developer/admin)
- Or add test users at: https://developers.facebook.com/apps/1350694239880908/roles/test-users/

**If you're using Facebook Login for Business:**
- The code uses regular Facebook Login (not Facebook Login for Business)
- If you need Facebook Login for Business, you'll need to implement the `config_id` approach (more complex)
- Alternatively, you can switch your app back to regular Facebook Login in the App Dashboard

### 3. Vercel Environment Variables
**Action Required:**
1. Go to your Vercel project: https://vercel.com/dashboard
2. Navigate to: Settings → Environment Variables
3. Add all variables from `.env.local`:
   - `NEXTAUTH_URL` = `https://tokko-official.vercel.app`
   - `NEXTAUTH_SECRET` = `+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=`
   - `FACEBOOK_CLIENT_ID` = `1350694239880908`
   - `FACEBOOK_CLIENT_SECRET` = (your Facebook App Secret)
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ucirfbweulbvjxmvtiox.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
   - `SUPABASE_DB_URL` = (your database URL)
   - `SUPABASE_DB_POOLER_TRANSACTION` = (your pooler URL)
   - `SUPABASE_DB_POOLER_SESSION` = (your session pooler URL)

### 4. Update NEXTAUTH_URL for Production
**Note:** The `.env.local` file has `NEXTAUTH_URL=http://localhost:3000` for local development.
In Vercel, set `NEXTAUTH_URL=https://tokko-official.vercel.app`

## 📝 Files Created
- `lib/supabase.ts` - Client-side Supabase client
- `lib/supabase-server.ts` - Server-side Supabase client
- `.env.local` - Local environment variables (DO NOT COMMIT)

## 🔒 Security Notes
- Never commit `.env.local` to git (already in .gitignore)
- Keep your Facebook App Secret secure
- Use Vercel's environment variables for production secrets

