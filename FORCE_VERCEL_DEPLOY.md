# Force Vercel to Deploy Latest Commit

## Problem
Vercel is deploying old commit `a72dac2` instead of latest `ab45bbe` which has the API routes.

## Immediate Solution: Manual Redeploy in Vercel

### Step 1: Go to Deployments
1. Vercel Dashboard → Your Project → **Deployments** tab

### Step 2: Create New Deployment
1. Click **"Create Deployment"** or look for a **"Deploy"** button
2. Or click **"..."** on any deployment → **"Redeploy"**
3. **IMPORTANT**: When redeploying, make sure:
   - **Branch**: `main`
   - **Commit**: Select the latest commit (should be `ab45bbe` or newer)

### Step 3: Verify Git Connection
1. Go to **Settings** → **Git**
2. Verify:
   - **Repository**: `princecjqlara/tokko`
   - **Production Branch**: `main`
   - If it shows a different branch, change it to `main`

### Step 4: Check Auto-Deploy Settings
1. In **Settings** → **Git**
2. Make sure **"Automatic deployments from Git"** is enabled
3. This ensures new commits trigger deployments

## Alternative: Reconnect Git Repository

If manual redeploy doesn't work:

1. Go to **Settings** → **Git**
2. Click **"Disconnect"** (temporarily)
3. Click **"Connect Git Repository"**
4. Select: `princecjqlara/tokko`
5. Select branch: `main`
6. This will trigger a fresh deployment with latest code

## After Redeploy

Check the new deployment:
- **Commit**: Should show `ab45bbe` or newer
- **Build Logs**: Should show API routes in route list
- **Status**: Should be "Ready"

Then test the webhook endpoint - it should work!

