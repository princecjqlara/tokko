# Deploy to Vercel - Quick Guide

## ⚠️ Build Failed - Missing Environment Variables

The deployment failed because environment variables are not set in Vercel. Follow these steps:

## Step 1: Set Environment Variables in Vercel Dashboard

1. Go to: **https://vercel.com/dashboard**
2. Select your project: **herman**
3. Go to: **Settings → Environment Variables**
4. Add each variable below (click "Add New" for each):

### Required Environment Variables:

| Key | Value | Environments |
|----|-------|--------------|
| `NEXTAUTH_SECRET` | `+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=` | Production, Preview, Development |
| `NEXTAUTH_URL` | `https://tokko-official.vercel.app` | Production, Preview, Development |
| `FACEBOOK_CLIENT_ID` | `1350694239880908` | Production, Preview, Development |
| `FACEBOOK_CLIENT_SECRET` | `da01b7d8d749d6e9f89cb23618c9e87d` | Production, Preview, Development |
| `FACEBOOK_APP_SECRET` | `da01b7d8d749d6e9f89cb23618c9e87d` | Production, Preview, Development |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ucirfbweulbvjxmvtiox.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc3NzQ3NCwiZXhwIjoyMDgwMzUzNDc0fQ.to6dmDwHoYeqyXAaU51PnM6SG2CJhRxl9KNEjWoDMiw` | Production, Preview, Development |

**Important:**
- Copy values exactly (no extra spaces)
- Set for **Production**, **Preview**, and **Development** environments
- Click **"Save"** after adding all variables

## Step 2: Redeploy

After setting all environment variables:

1. Go to **Deployments** tab
2. Find the failed deployment
3. Click **"..."** (three dots) → **"Redeploy"**
4. Wait for the build to complete

## Step 3: Verify Deployment

Once deployment succeeds:
- Visit: `https://tokko-official.vercel.app`
- Test the application
- Check Vercel logs if there are any issues

## Alternative: Use Vercel CLI (if you prefer)

If you want to set variables via CLI, you'll need to run these commands interactively:

```bash
# For each variable, you'll be prompted to enter the value
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add FACEBOOK_CLIENT_ID production
vercel env add FACEBOOK_CLIENT_SECRET production
vercel env add FACEBOOK_APP_SECRET production
vercel env add FACEBOOK_WEBHOOK_VERIFY_TOKEN production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Then redeploy
vercel --prod
```

However, the **dashboard method is recommended** as it's faster and less error-prone.


