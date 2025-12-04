# Vercel Deployment Troubleshooting Guide

## Common Deployment Errors and Solutions

### Error 1: "Missing Supabase environment variables"
**Error Message:**
```
Error: Missing Supabase environment variables
```

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these **REQUIRED** variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ucirfbweulbvjxmvtiox.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` = (your service role key - get from Supabase Dashboard → Settings → API)

3. **Important:** Make sure variable names match exactly (case-sensitive)
4. Set for **Production**, **Preview**, and **Development** environments
5. Click **Save** and **Redeploy**

---

### Error 2: "NEXTAUTH_SECRET is not set"
**Error Message:**
```
Error: NEXTAUTH_SECRET is not set. Please create a .env.local file with NEXTAUTH_SECRET.
```

**Solution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add:
   - `NEXTAUTH_SECRET` = `+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=`
   - `NEXTAUTH_URL` = `https://tokko-official.vercel.app`
3. Redeploy

---

### Error 3: "No authentication providers configured"
**Error Message:**
```
Error: No authentication providers configured. Please set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env.local
```

**Solution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add:
   - `FACEBOOK_CLIENT_ID` = `1350694239880908`
   - `FACEBOOK_CLIENT_SECRET` = (your Facebook App Secret)
3. Redeploy

---

### Error 4: Build Timeout
**Error Message:**
```
Build exceeded maximum execution time
```

**Solution:**
1. Check if you're on Vercel Hobby plan (10-second function limit)
2. The stream route uses `maxDuration = 300` (5 minutes) which requires **Vercel Pro plan**
3. Options:
   - Upgrade to Vercel Pro plan, OR
   - Reduce `maxDuration` in `app/api/facebook/contacts/stream/route.ts` to 10 seconds (may not be enough for large syncs)

---

### Error 5: Function Execution Timeout
**Error Message:**
```
Function execution exceeded timeout
```

**Solution:**
- Same as Error 4 - requires Vercel Pro plan for 5-minute functions
- Or implement background job processing instead of long-running streams

---

## Complete Environment Variables Checklist

Copy and paste these into Vercel:

```
NEXTAUTH_SECRET=+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=
NEXTAUTH_URL=https://tokko-official.vercel.app
FACEBOOK_CLIENT_ID=1350694239880908
FACEBOOK_CLIENT_SECRET=da01b7d8d749d6e9f89cb23618c9e87d
FACEBOOK_APP_SECRET=da01b7d8d749d6e9f89cb23618c9e87d
FACEBOOK_WEBHOOK_VERIFY_TOKEN=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac
NEXT_PUBLIC_SUPABASE_URL=https://ucirfbweulbvjxmvtiox.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc
SUPABASE_SERVICE_ROLE_KEY=(GET FROM SUPABASE DASHBOARD → Settings → API → service_role key)
```

**⚠️ IMPORTANT:** Replace `SUPABASE_SERVICE_ROLE_KEY` with your actual service role key from Supabase!

---

## Step-by-Step Deployment Fix

1. **Check Vercel Build Logs**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on the failed deployment
   - Check the "Build Logs" tab for the exact error

2. **Verify All Environment Variables**
   - Go to Settings → Environment Variables
   - Compare with the checklist above
   - Make sure all variables are set for **Production** environment

3. **Get SUPABASE_SERVICE_ROLE_KEY**
   - Go to: https://supabase.com/dashboard/project/ucirfbweulbvjxmvtiox/settings/api
   - Scroll to "Project API keys"
   - Copy the **service_role** key (NOT the anon key)
   - Add it to Vercel as `SUPABASE_SERVICE_ROLE_KEY`

4. **Redeploy**
   - After adding/updating variables, go to Deployments
   - Click "..." on the latest deployment
   - Click "Redeploy"

5. **Check Deployment Status**
   - Wait for deployment to complete
   - Check if build succeeds
   - If it still fails, check the build logs for the specific error

---

## Quick Test After Deployment

1. Test the webhook endpoint:
   ```bash
   curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
   ```
   Should return: `test123`

2. Test the home page loads:
   ```bash
   curl https://tokko-official.vercel.app
   ```
   Should return HTML (not an error)

---

## Still Having Issues?

1. **Check Vercel Build Logs** - The exact error message will tell you what's missing
2. **Verify Node.js Version** - Vercel auto-detects, but you can set it in `package.json`:
   ```json
   "engines": {
     "node": ">=18.0.0"
   }
   ```
3. **Check for TypeScript Errors** - Run `npm run build` locally first
4. **Verify All Dependencies** - Make sure `package.json` has all required packages

