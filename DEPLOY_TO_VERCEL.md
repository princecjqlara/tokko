# 🚀 Deploy to Vercel - Step by Step Guide

## ✅ Pre-Deployment Checklist

- [x] Build successful (`npm run build` passed)
- [x] Code committed and pushed to GitHub
- [x] All webhook handlers fixed
- [x] Auto-fetch logic implemented

## Step 1: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select your repository: `princecjqlara/tokko`
4. Vercel will auto-detect Next.js
5. Click **"Deploy"**

### Option B: Via Vercel CLI

```bash
npm i -g vercel
vercel
```

## Step 2: Set Environment Variables

**IMPORTANT**: After deployment, you MUST set these environment variables in Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add each variable below for **Production**, **Preview**, and **Development**:

### Required Environment Variables:

```
NEXTAUTH_SECRET=+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=

NEXTAUTH_URL=https://tokko-official.vercel.app

FACEBOOK_CLIENT_ID=1350694239880908

FACEBOOK_CLIENT_SECRET=da01b7d8d749d6e9f89cb23618c9e87d

FACEBOOK_APP_SECRET=da01b7d8d749d6e9f89cb23618c9e87d

FACEBOOK_WEBHOOK_VERIFY_TOKEN=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac

NEXT_PUBLIC_SUPABASE_URL=https://ucirfbweulbvjxmvtiox.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc

SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
```

**⚠️ Note**: Get `SUPABASE_SERVICE_ROLE_KEY` from:
- Supabase Dashboard → Project Settings → API
- Copy the `service_role` key (not the `anon` key)

### Optional but Recommended:

```
SUPABASE_DB_URL=postgresql://postgres:demet5732595@db.ucirfbweulbvjxmvtiox.supabase.co:5432/postgres

SUPABASE_DB_POOLER_TRANSACTION=postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres

SUPABASE_DB_POOLER_SESSION=postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

## Step 3: Redeploy After Setting Variables

1. After adding all environment variables, go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

## Step 4: Verify Deployment

### Test the webhook endpoint:

```bash
curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
```

**Expected response**: `test123`

### Test the main app:

Visit: https://tokko-official.vercel.app

## Step 5: Configure Facebook Webhook

1. Go to: https://developers.facebook.com/apps/1350694239880908/
2. Navigate to **Webhooks** → **Page**
3. Click **"Add Webhook"** or **"Edit"** if one exists
4. Enter:
   - **Callback URL**: `https://tokko-official.vercel.app/api/webhooks/facebook`
   - **Verify Token**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
5. Click **"Verify and Save"**
6. Subscribe to these webhook fields:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `messaging_optins`
   - ✅ `messaging_deliveries`
   - ✅ `messaging_reads`

## Step 6: Update Facebook OAuth Redirect URIs

1. Go to: https://developers.facebook.com/apps/1350694239880908/fb-login/settings/
2. Under **Valid OAuth Redirect URIs**, add:
   - `https://tokko-official.vercel.app/api/auth/callback/facebook`
3. Click **"Save Changes"**

## Step 7: Subscribe Pages to Webhook

1. Go to: https://developers.facebook.com/apps/1350694239880908/webhooks/
2. Click **"Page"** in the left sidebar
3. For each page, click **"Subscribe"**
4. Select the pages you want to receive events from
5. Click **"Subscribe"**

## ✅ Verification Checklist

After deployment, verify:

- [ ] Site is accessible at https://tokko-official.vercel.app
- [ ] Webhook verification endpoint works
- [ ] Facebook Login works
- [ ] Contacts can be fetched
- [ ] Webhook receives events from Facebook
- [ ] Auto-fetch triggers when new messages arrive

## 🐛 Troubleshooting

### Build Fails
- Check Vercel build logs for errors
- Ensure all environment variables are set
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

### Webhook Verification Fails
- Verify `FACEBOOK_WEBHOOK_VERIFY_TOKEN` matches exactly
- Ensure deployment is complete before testing
- Check Vercel function logs

### Environment Variables Not Working
- Redeploy after adding variables
- Check for typos in variable names
- Ensure variables are set for correct environment (Production)

### 404 on Webhook Endpoint
- Wait for deployment to complete
- Check that route file exists: `app/api/webhooks/facebook/route.ts`
- Verify the route is exported correctly

## 📝 Post-Deployment Notes

1. **Cron Jobs**: The scheduled message processor runs every 5 minutes (configured in `vercel.json`)
2. **Auto-Fetch**: After initial sync, the system polls for new messages every 3 seconds
3. **Webhooks**: New messages trigger immediate contact fetches
4. **Database**: All contacts are stored in Supabase and persist between sessions

## 🎉 You're Done!

Your app is now deployed and ready to use. Test it by:
1. Logging in with Facebook
2. Fetching your contacts
3. Sending a test message to trigger webhook

