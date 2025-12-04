# Vercel Settings Verification Checklist

## Your Git Configuration
- **Repository**: `https://github.com/princecjqlara/tokko.git`
- **Branch**: `main`
- **Latest Commit**: `ab45bbe` (Force Vercel rebuild)

## Verify in Vercel Dashboard

### Step 1: Check Git Connection
1. Go to: https://vercel.com/dashboard
2. Select your project (`tokko-official` or similar)
3. Go to **Settings** → **Git**
4. Verify:
   - ✅ **Repository**: Should show `princecjqlara/tokko`
   - ✅ **Production Branch**: Should be `main` (NOT `master`)
   - ✅ **Latest Commit**: Should show `ab45bbe` or newer

### Step 2: Check Root Directory (CRITICAL!)
1. Go to **Settings** → **General**
2. Scroll to **"Build & Development Settings"**
3. Check **"Root Directory"**:
   - ✅ Should be **empty** or **`.`** (dot)
   - ❌ If it's set to anything else (like `app`, `src`, etc.), that's the problem!

### Step 3: Check Latest Deployment
1. Go to **Deployments** tab
2. Click on the **latest deployment**
3. Verify:
   - **Commit**: Should be `ab45bbe` or newer
   - **Branch**: Should be `main`
   - **Status**: Should be "Ready" or "Building"

### Step 4: Check Build Logs
In the latest deployment, check the build logs for:
```
Route (app)
├ ƒ /api/webhooks/facebook    ← Should be here!
```

## Common Issues

### Issue 1: Root Directory is Wrong
**If Root Directory is set to a subdirectory:**
- Vercel won't find `app/api/` because it's looking in the wrong place
- **Fix**: Set Root Directory to `.` or empty

### Issue 2: Wrong Branch
**If Production Branch is `master` but you're using `main`:**
- Vercel is deploying old code
- **Fix**: Change Production Branch to `main`

### Issue 3: Wrong Repository
**If Repository doesn't match:**
- Vercel is connected to a different repo
- **Fix**: Reconnect to `princecjqlara/tokko`

## Quick Verification
Check if the file exists in GitHub:
https://github.com/princecjqlara/tokko/blob/main/app/api/webhooks/facebook/route.ts

If this URL shows the file, then GitHub has it. The issue is Vercel configuration.

## Most Likely Issue
**Root Directory** is probably set incorrectly. This is the #1 cause of missing API routes.

