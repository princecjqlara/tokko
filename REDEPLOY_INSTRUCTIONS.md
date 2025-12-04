# Manual Redeploy Instructions

## Option 1: Redeploy from Vercel Dashboard (Recommended)

1. Go to Vercel Dashboard → Your Project → **Deployments** tab
2. Find the latest deployment (or any deployment)
3. Click the **"..."** (three dots) menu
4. Click **"Redeploy"**
5. Make sure it's deploying from:
   - **Branch**: `main`
   - **Commit**: Latest commit (should be visible)
6. Click **"Redeploy"**

## Option 2: Wait for Auto-Deploy

Since you just connected the repository, Vercel should automatically:
- Detect the connection
- Start a new deployment
- Deploy the latest commit from `princecjqlara/tokko`

Check the **Deployments** tab - you should see a new deployment starting automatically.

## What to Look For

After redeploy starts, check:

1. **Deployment Status**: Should show "Building" then "Ready"
2. **Commit**: Should show the latest commit (not "Initial commit")
3. **Repository**: Should show `princecjqlara/tokko`
4. **Build Logs**: Should show API routes in the route list

## After Deployment Completes

Once status shows "Ready":
1. Wait 1-2 minutes for propagation
2. Test the webhook endpoint
3. Verify in Facebook


